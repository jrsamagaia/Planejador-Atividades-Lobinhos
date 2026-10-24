import { Hono } from 'hono';
import { CAMINHOS, EIXOS_E_BLOCOS, PERIODOS_PADRAO } from '../../shared/progressao';
import type { ConteudoPlano, EventoGeracao, ParametrosPlano, Periodo, TipoAtividade } from '../../shared/types';
import { buscarPlano, carregarConfig, carregarTipos, listarPlanos, podeEditarPlano } from '../dados';
import type { AppEnv, Env } from '../env';
import { enviarArquivo, ErroGemini, gerarJson, type ArquivoGemini } from '../gemini';
import { aplicarTermos, ESQUEMA_RESPOSTA, INSTRUCOES_SISTEMA, montarPrompt, normalizarHorarios } from '../prompt';
import { data, erro, hora, idDaRota, texto } from '../util';

export const rotasPlanos = new Hono<AppEnv>();

const MAX_ANEXOS_BIBLIOTECA = 5;
const TIPOS_ANEXO = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp'];

rotasPlanos.get('/', async (c) => c.json(await listarPlanos(c.env, c.get('usuario').secao_id)));

rotasPlanos.get('/:id', async (c) => {
  const plano = await buscarPlano(c.env, c.get('usuario').secao_id, idDaRota(c));
  return plano ? c.json(plano) : erro('Plano não encontrado.', 404);
});

rotasPlanos.put('/:id', async (c) => {
  const u = c.get('usuario');
  const plano = await buscarPlano(c.env, u.secao_id, idDaRota(c));
  if (!plano) erro('Plano não encontrado.', 404);
  if (!podeEditarPlano(u, plano)) erro('Assistentes só podem editar os próprios planos.', 403);
  const body = await c.req.json<{ titulo?: string; conteudo?: ConteudoPlano }>();
  const titulo = texto(body.titulo, 200) || plano.titulo;
  const conteudo = body.conteudo ? validarConteudo(body.conteudo) : plano.conteudo;
  await c.env.DB.prepare("UPDATE planos SET titulo = ?, conteudo = ?, atualizado_em = datetime('now') WHERE id = ?")
    .bind(titulo, JSON.stringify(conteudo), plano.id)
    .run();
  return c.json(await buscarPlano(c.env, u.secao_id, plano.id));
});

rotasPlanos.delete('/:id', async (c) => {
  const u = c.get('usuario');
  const plano = await buscarPlano(c.env, u.secao_id, idDaRota(c));
  if (!plano) erro('Plano não encontrado.', 404);
  if (!podeEditarPlano(u, plano)) erro('Assistentes só podem excluir os próprios planos.', 403);
  await c.env.DB.prepare('DELETE FROM planos WHERE id = ?').bind(plano.id).run();
  return c.json({ ok: true });
});

rotasPlanos.post('/:id/duplicar', async (c) => {
  const u = c.get('usuario');
  const plano = await buscarPlano(c.env, u.secao_id, idDaRota(c));
  if (!plano) erro('Plano não encontrado.', 404);
  const novo = await c.env.DB.prepare(
    'INSERT INTO planos (secao_id, autor_id, tipo_id, titulo, data_inicio, data_fim, parametros, conteudo) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(u.secao_id, u.id, plano.tipo_id, `${plano.titulo} (cópia)`, plano.data_inicio, plano.data_fim, JSON.stringify(plano.parametros), JSON.stringify(plano.conteudo))
    .first<{ id: number }>();
  return c.json(await buscarPlano(c.env, u.secao_id, novo!.id));
});

/**
 * Gera um plano com o Gemini. Recebe multipart (campo `parametros` em JSON + `arquivo` opcional) e responde
 * com uma linha JSON por evento (etapas, progresso e o plano salvo), para a tela acompanhar em tempo real.
 */
rotasPlanos.post('/gerar', async (c) => {
  const u = c.get('usuario');
  const form = await c.req.formData();
  const [tipos, config] = await Promise.all([carregarTipos(c.env, u.secao_id), carregarConfig(c.env, u.secao_id)]);
  const parametros = validarParametros(JSON.parse(String(form.get('parametros') || '{}')), tipos);
  const tipo = tipos.find((t) => t.id === parametros.tipoId)!;
  const arquivo = form.get('arquivo');
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!TIPOS_ANEXO.includes(arquivo.type)) erro('Anexe um PDF, imagem ou texto. Arquivos do Word são lidos direto no navegador.');
    if (arquivo.size > 50 * 1024 * 1024) erro('O anexo passa de 50 MB.', 413);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const escritor = writable.getWriter();
  const enc = new TextEncoder();
  const enviar = (e: EventoGeracao) => escritor.write(enc.encode(JSON.stringify(e) + '\n')).catch(() => {});

  const tarefa = (async () => {
    try {
      if (!c.env.GEMINI_API_KEY) throw new ErroGemini('A chave do Gemini ainda não foi configurada. Peça ao administrador.');

      const anexos: ArquivoGemini[] = [];
      const nomesDocs: string[] = [];

      const ids = parametros.bibliotecaIds.slice(0, MAX_ANEXOS_BIBLIOTECA);
      if (ids.length) {
        await enviar({ tipo: 'etapa', mensagem: 'Preparando os materiais da biblioteca…' });
        for (const id of ids) {
          const item = await prepararItemBiblioteca(c.env, u.secao_id, id);
          if (item) {
            anexos.push(item.arquivo);
            nomesDocs.push(item.titulo);
          }
        }
      }
      if (arquivo instanceof File && arquivo.size > 0) {
        await enviar({ tipo: 'etapa', mensagem: `Lendo o anexo "${arquivo.name}"…` });
        anexos.push(await enviarArquivo(c.env, await arquivo.arrayBuffer(), arquivo.size, arquivo.type, arquivo.name));
        nomesDocs.push(`${arquivo.name} (anexado pelo chefe)`);
      }

      const { results: outros } = await c.env.DB.prepare(
        `SELECT i.titulo FROM biblioteca_itens i JOIN biblioteca_categorias k ON k.id = i.categoria_id
         WHERE k.secao_id = ? AND i.r2_key IS NOT NULL ORDER BY k.ordem, i.titulo LIMIT 80`,
      )
        .bind(u.secao_id)
        .all<{ titulo: string }>();
      const outrosTitulos = outros.map((o) => o.titulo).filter((t) => !nomesDocs.includes(t));

      await enviar({ tipo: 'etapa', mensagem: 'Escrevendo o plano com o Gemini…' });
      let ultimo = 0;
      const json = await gerarJson(
        c.env,
        INSTRUCOES_SISTEMA,
        [...anexos.map((a) => ({ fileData: { fileUri: a.uri, mimeType: a.mimeType } })), { text: montarPrompt(parametros, tipo, nomesDocs, outrosTitulos) }],
        ESQUEMA_RESPOSTA,
        (n) => {
          if (n - ultimo >= 800) {
            ultimo = n;
            enviar({ tipo: 'progresso', caracteres: n });
          }
        },
      );

      let conteudo: ConteudoPlano;
      try {
        conteudo = validarConteudo(JSON.parse(json));
      } catch {
        throw new ErroGemini('A resposta do Gemini veio incompleta. Tente gerar de novo.');
      }
      if (!conteudo.atividades.length) throw new ErroGemini('O Gemini não devolveu atividades. Tente gerar de novo.');
      conteudo = normalizarHorarios(aplicarTermos(conteudo, config.termosAjuste), parametros, tipo);

      const novo = await c.env.DB.prepare(
        'INSERT INTO planos (secao_id, autor_id, tipo_id, titulo, data_inicio, data_fim, parametros, conteudo) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      )
        .bind(u.secao_id, u.id, tipo.id, parametros.titulo, parametros.dataInicio, parametros.dataFim, JSON.stringify(parametros), JSON.stringify(conteudo))
        .first<{ id: number }>();
      const plano = await buscarPlano(c.env, u.secao_id, novo!.id);
      await enviar({ tipo: 'concluido', plano: plano! });
    } catch (e) {
      console.error('[gerar]', e);
      const mensagem = e instanceof ErroGemini ? e.message : `Não foi possível gerar o plano: ${(e as Error).message}`;
      await enviar({ tipo: 'erro', mensagem });
    } finally {
      await escritor.close().catch(() => {});
    }
  })();
  c.executionCtx.waitUntil(tarefa);

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
});

/** Reaproveita o arquivo já enviado ao Gemini (vale 48 h) ou envia de novo a partir do R2. */
async function prepararItemBiblioteca(env: Env, secaoId: number, id: number): Promise<{ titulo: string; arquivo: ArquivoGemini } | null> {
  const item = await env.DB.prepare(
    `SELECT i.* FROM biblioteca_itens i JOIN biblioteca_categorias k ON k.id = i.categoria_id WHERE i.id = ? AND k.secao_id = ?`,
  )
    .bind(id, secaoId)
    .first<{ titulo: string; r2_key: string | null; tipo_mime: string | null; gemini_uri: string | null; gemini_expira: string | null }>();
  if (!item?.r2_key) return null;
  const mime = item.tipo_mime || 'application/pdf';
  if (!TIPOS_ANEXO.includes(mime)) return null;

  if (item.gemini_uri && item.gemini_expira && new Date(item.gemini_expira).getTime() > Date.now() + 3600_000) {
    return { titulo: item.titulo, arquivo: { uri: item.gemini_uri, mimeType: mime } };
  }
  const obj = await env.BIBLIOTECA.get(item.r2_key);
  if (!obj) return null;
  const arquivo = await enviarArquivo(env, obj.body, obj.size, mime, item.titulo);
  const expira = new Date(Date.now() + 47 * 3600_000).toISOString();
  await env.DB.prepare('UPDATE biblioteca_itens SET gemini_uri = ?, gemini_expira = ? WHERE id = ?').bind(arquivo.uri, expira, id).run();
  return { titulo: item.titulo, arquivo };
}

function validarParametros(raw: Record<string, unknown>, tipos: TipoAtividade[]): ParametrosPlano {
  const tipo = tipos.find((t) => t.id === Number(raw.tipoId));
  if (!tipo) erro('Escolha o tipo de atividade.');
  const titulo = texto(raw.titulo, 200);
  const tema = texto(raw.tema, 20000);
  if (!titulo) erro('Dê um nome para a atividade.');
  if (!tema) erro('Descreva o tema ou a ideia da atividade.');

  const dataInicio = data(raw.dataInicio);
  let dataFim = dataInicio;
  let periodosPorDia: Periodo[][] = [];
  if (tipo.modo === 'periodos') {
    dataFim = data(raw.dataFim);
    if (dataFim < dataInicio) erro('A data de fim deve ser depois da data de início.');
    const dias = Math.round((Date.parse(dataFim) - Date.parse(dataInicio)) / 86400_000) + 1;
    if (dias > 7) erro('O planejamento pode ter no máximo 7 dias.');
    const recebidos = Array.isArray(raw.periodosPorDia) ? (raw.periodosPorDia as unknown[][]) : [];
    periodosPorDia = Array.from({ length: dias }, (_, i) =>
      PERIODOS_PADRAO.map((pad) => {
        const r = ((recebidos[i] || []) as Record<string, unknown>[]).find((x) => x?.chave === pad.chave) || {};
        return { chave: pad.chave, rotulo: pad.rotulo, ativo: Boolean(r.ativo), inicio: hora(r.inicio, pad.inicio), fim: hora(r.fim, pad.fim) };
      }),
    );
    if (!periodosPorDia.some((d) => d.some((p) => p.ativo))) erro('Marque pelo menos um período.');
  }

  const caminho = CAMINHOS.includes(String(raw.caminho)) ? String(raw.caminho) : 'Todos';
  const eixo = String(raw.eixo) in EIXOS_E_BLOCOS ? String(raw.eixo) : 'Todos';
  const bloco = EIXOS_E_BLOCOS[eixo].includes(String(raw.bloco)) ? String(raw.bloco) : 'Todos';
  const equipe = (Array.isArray(raw.equipe) ? raw.equipe : []).map((x) => texto(x, 60)).filter(Boolean).slice(0, 30);
  if (!equipe.length) erro('Selecione pelo menos um Velho Lobo na equipe.');
  const principal = texto(raw.velhoLoboPrincipal, 60);

  const esp = raw.atividadeEspecial as Record<string, unknown> | null;
  const atividadeEspecial =
    esp && texto(esp.descricao)
      ? { descricao: texto(esp.descricao), responsavel: texto(esp.responsavel, 60), inicio: hora(esp.inicio, '14:30'), duracao: Math.min(600, Math.max(5, Number(esp.duracao) || 15)) }
      : null;

  const doc = raw.documento as Record<string, unknown> | null;
  return {
    titulo,
    tema,
    tipoId: tipo.id,
    dataInicio,
    dataFim,
    horaInicio: hora(raw.horaInicio, tipo.hora_inicio),
    horaFim: hora(raw.horaFim, tipo.hora_fim),
    periodosPorDia,
    caminho,
    eixo,
    bloco,
    velhoLoboPrincipal: equipe.includes(principal) ? principal : equipe[0],
    equipe,
    bibliotecaIds: (Array.isArray(raw.bibliotecaIds) ? raw.bibliotecaIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_ANEXOS_BIBLIOTECA),
    atividadeEspecial,
    observacoes: texto(raw.observacoes, 2000),
    documento: doc && texto(doc.texto, 60000) ? { nome: texto(doc.nome, 200) || 'documento', texto: texto(doc.texto, 60000) } : null,
  };
}

function validarConteudo(raw: unknown): ConteudoPlano {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v.slice(0, 20000) : '');
  const atividades = Array.isArray(r.atividades) ? (r.atividades as Record<string, unknown>[]) : [];
  return {
    cicloPrograma: s(r.cicloPrograma),
    diferenciacaoEtaria: s(r.diferenciacaoEtaria),
    recursosMateriais: s(r.recursosMateriais),
    recursosHumanos: s(r.recursosHumanos),
    atividades: atividades.slice(0, 200).map((a) => ({
      dia: s(a.dia),
      periodo: s(a.periodo),
      horaInicio: s(a.horaInicio),
      duracao: s(a.duracao),
      tipo: s(a.tipo),
      nome: s(a.nome),
      responsavel: s(a.responsavel),
      material: s(a.material),
      areaDesenvolvimento: s(a.areaDesenvolvimento),
      descricao: s(a.descricao),
      fundoDeCena: s(a.fundoDeCena),
      planoB: s(a.planoB),
    })),
  };
}
