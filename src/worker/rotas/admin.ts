// Área administrativa: usuários, tipos de atividade, equipe/termos/horários e dados do grupo.
import { Hono } from 'hono';
import type { Configuracoes, Papel } from '../../shared/types';
import { carregarTipos, usuarioDe } from '../dados';
import type { AppEnv } from '../env';
import { erro, exigirAdmin, hora, idDaRota, texto } from '../util';

export const rotasAdmin = new Hono<AppEnv>();

rotasAdmin.use('*', async (c, next) => {
  exigirAdmin(c);
  await next();
});

const PAPEIS: Papel[] = ['admin', 'chefe', 'assistente'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Usuários ----------

rotasAdmin.get('/usuarios', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM usuarios WHERE secao_id = ? ORDER BY ativo DESC, nome, email')
    .bind(c.get('usuario').secao_id)
    .all<Record<string, unknown>>();
  return c.json(results.map(usuarioDe));
});

rotasAdmin.post('/usuarios', async (c) => {
  const body = await c.req.json<{ email?: string; nome?: string; papel?: Papel }>();
  const email = texto(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) erro('Informe um e-mail válido.');
  const papel = PAPEIS.includes(body.papel as Papel) ? body.papel! : 'chefe';
  const existe = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first();
  if (existe) erro('Este e-mail já está cadastrado.', 409);
  const novo = await c.env.DB.prepare('INSERT INTO usuarios (email, nome, papel, secao_id) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(email, texto(body.nome, 120), papel, c.get('usuario').secao_id)
    .first<Record<string, unknown>>();
  return c.json(usuarioDe(novo!));
});

rotasAdmin.patch('/usuarios/:id', async (c) => {
  const eu = c.get('usuario');
  const id = idDaRota(c);
  const alvo = await c.env.DB.prepare('SELECT * FROM usuarios WHERE id = ? AND secao_id = ?').bind(id, eu.secao_id).first<Record<string, unknown>>();
  if (!alvo) erro('Usuário não encontrado.', 404);
  const body = await c.req.json<{ nome?: string; papel?: Papel; ativo?: boolean }>();
  const papel = PAPEIS.includes(body.papel as Papel) ? body.papel! : (alvo.papel as Papel);
  const ativo = body.ativo === undefined ? Boolean(alvo.ativo) : Boolean(body.ativo);

  if (id === eu.id && (papel !== 'admin' || !ativo)) erro('Você não pode remover o seu próprio acesso de administrador.');
  if (alvo.papel === 'admin' && (papel !== 'admin' || !ativo)) {
    const admins = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE secao_id = ? AND papel = 'admin' AND ativo = 1")
      .bind(eu.secao_id)
      .first<{ n: number }>();
    if (admins!.n <= 1) erro('É preciso ter pelo menos um administrador ativo.');
  }
  const nome = body.nome !== undefined ? texto(body.nome, 120) : (alvo.nome as string);
  const atualizado = await c.env.DB.prepare('UPDATE usuarios SET nome = ?, papel = ?, ativo = ? WHERE id = ? RETURNING *')
    .bind(nome, papel, ativo ? 1 : 0, id)
    .first<Record<string, unknown>>();
  return c.json(usuarioDe(atualizado!));
});

rotasAdmin.delete('/usuarios/:id', async (c) => {
  const eu = c.get('usuario');
  const id = idDaRota(c);
  if (id === eu.id) erro('Você não pode excluir a si mesmo.');
  const planos = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM planos WHERE autor_id = ?').bind(id).first<{ n: number }>();
  if (planos!.n > 0) erro('Este usuário tem planos salvos. Desative o acesso em vez de excluir.', 409);
  const alvo = await c.env.DB.prepare('SELECT papel FROM usuarios WHERE id = ? AND secao_id = ?').bind(id, eu.secao_id).first<{ papel: string }>();
  if (!alvo) erro('Usuário não encontrado.', 404);
  if (alvo.papel === 'admin') erro('Rebaixe o administrador antes de excluir.');
  await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ---------- Tipos de atividade ----------

rotasAdmin.get('/tipos', async (c) => c.json(await carregarTipos(c.env, c.get('usuario').secao_id, true)));

function lerTipo(body: Record<string, unknown>) {
  const nome = texto(body.nome, 80);
  if (!nome) erro('Informe o nome do tipo de atividade.');
  const modo = body.modo === 'periodos' ? 'periodos' : 'bloco';
  return {
    nome,
    descricao: texto(body.descricao, 1000),
    modo,
    dias: modo === 'periodos' ? Math.min(7, Math.max(1, Number(body.dias) || 1)) : 1,
    hora_inicio: hora(body.hora_inicio, '14:00'),
    hora_fim: hora(body.hora_fim, '16:30'),
  };
}

rotasAdmin.post('/tipos', async (c) => {
  const secao = c.get('usuario').secao_id;
  const t = lerTipo(await c.req.json());
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(ordem), -1) + 1 AS o FROM tipos_atividade WHERE secao_id = ?').bind(secao).first<{ o: number }>();
  await c.env.DB.prepare('INSERT INTO tipos_atividade (secao_id, nome, descricao, modo, dias, hora_inicio, hora_fim, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(secao, t.nome, t.descricao, t.modo, t.dias, t.hora_inicio, t.hora_fim, max!.o)
    .run();
  return c.json(await carregarTipos(c.env, secao, true));
});

rotasAdmin.patch('/tipos/:id', async (c) => {
  const secao = c.get('usuario').secao_id;
  const id = idDaRota(c);
  const body = await c.req.json<Record<string, unknown>>();
  const atual = await c.env.DB.prepare('SELECT * FROM tipos_atividade WHERE id = ? AND secao_id = ?').bind(id, secao).first<Record<string, unknown>>();
  if (!atual) erro('Tipo não encontrado.', 404);
  const t = lerTipo({ ...atual, ...body });
  const ativo = body.ativo === undefined ? Boolean(atual.ativo) : Boolean(body.ativo);
  const ordem = Number.isInteger(body.ordem) ? (body.ordem as number) : (atual.ordem as number);
  await c.env.DB.prepare('UPDATE tipos_atividade SET nome = ?, descricao = ?, modo = ?, dias = ?, hora_inicio = ?, hora_fim = ?, ativo = ?, ordem = ? WHERE id = ?')
    .bind(t.nome, t.descricao, t.modo, t.dias, t.hora_inicio, t.hora_fim, ativo ? 1 : 0, ordem, id)
    .run();
  return c.json(await carregarTipos(c.env, secao, true));
});

// ---------- Configurações da seção ----------

rotasAdmin.put('/config', async (c) => {
  const secao = c.get('usuario').secao_id;
  const body = await c.req.json<Partial<Configuracoes>>();
  const config: Partial<Configuracoes> = {};
  if (Array.isArray(body.velhosLobos)) {
    config.velhosLobos = [...new Set(body.velhosLobos.map((v) => texto(v, 60)).filter(Boolean))].slice(0, 40);
    if (!config.velhosLobos.length) erro('A equipe precisa ter pelo menos um Velho Lobo.');
  }
  if (Array.isArray(body.termosAjuste)) {
    config.termosAjuste = body.termosAjuste
      .map((t) => ({ usar: texto(t?.usar, 120), emVezDe: texto(t?.emVezDe, 120) }))
      .filter((t) => t.usar && t.emVezDe)
      .slice(0, 100);
  }
  if (Array.isArray(body.horariosRapidos)) {
    config.horariosRapidos = body.horariosRapidos
      .map((h) => ({ rotulo: texto(h?.rotulo, 60), inicio: hora(h?.inicio, ''), fim: hora(h?.fim, '') }))
      .filter((h) => h.rotulo && h.inicio && h.fim)
      .slice(0, 10);
  }
  const stmts = Object.entries(config).map(([chave, valor]) =>
    c.env.DB.prepare('INSERT INTO configuracoes (secao_id, chave, valor) VALUES (?, ?, ?) ON CONFLICT (secao_id, chave) DO UPDATE SET valor = excluded.valor').bind(
      secao,
      chave,
      JSON.stringify(valor),
    ),
  );
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---------- Grupo e seção ----------

rotasAdmin.patch('/grupo', async (c) => {
  const secaoId = c.get('usuario').secao_id;
  const body = await c.req.json<{ nome?: string; numeral?: string; cor_primaria?: string; cor_secundaria?: string; secao_nome?: string }>();
  const cor = (v: unknown) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
  const secao = await c.env.DB.prepare('SELECT grupo_id FROM secoes WHERE id = ?').bind(secaoId).first<{ grupo_id: number }>();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE grupos SET nome = COALESCE(?, nome), numeral = COALESCE(?, numeral), cor_primaria = COALESCE(?, cor_primaria), cor_secundaria = COALESCE(?, cor_secundaria) WHERE id = ?',
    ).bind(texto(body.nome, 120) || null, body.numeral !== undefined ? texto(body.numeral, 20) : null, cor(body.cor_primaria), cor(body.cor_secundaria), secao!.grupo_id),
    c.env.DB.prepare('UPDATE secoes SET nome = COALESCE(?, nome) WHERE id = ?').bind(texto(body.secao_nome, 80) || null, secaoId),
  ]);
  return c.json({ ok: true });
});
