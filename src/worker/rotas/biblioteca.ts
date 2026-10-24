// Biblioteca: arquivos privados no R2, metadados no D1.
// Qualquer usuário logado consulta e baixa; só o admin envia, edita, importa e exclui.
import { Hono } from 'hono';
import type { CategoriaBiblioteca } from '../../shared/types';
import { itemDe } from '../dados';
import type { AppEnv, Env } from '../env';
import { erro, exigirAdmin, idDaRota, texto } from '../util';

export const rotasBiblioteca = new Hono<AppEnv>();

const LIMITE_ARQUIVO = 95 * 1024 * 1024; // o Worker aceita corpos de até 100 MB
const EXTENSOES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp3: 'audio/mpeg',
};

function mimeDe(nome: string, informado?: string): string | null {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSOES[ext] ?? (informado && Object.values(EXTENSOES).includes(informado) ? informado : null);
}

function chaveR2(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(-80);
  return `itens/${crypto.randomUUID()}-${limpo || 'arquivo'}`;
}

async function categoriaDaSecao(env: Env, secaoId: number, id: number) {
  const cat = await env.DB.prepare('SELECT id FROM biblioteca_categorias WHERE id = ? AND secao_id = ?').bind(id, secaoId).first();
  if (!cat) erro('Categoria não encontrada.', 404);
}

async function itemDaSecao(env: Env, secaoId: number, id: number) {
  const item = await env.DB.prepare(
    'SELECT i.* FROM biblioteca_itens i JOIN biblioteca_categorias k ON k.id = i.categoria_id WHERE i.id = ? AND k.secao_id = ?',
  )
    .bind(id, secaoId)
    .first<Record<string, unknown>>();
  if (!item) erro('Material não encontrado.', 404);
  return item;
}

rotasBiblioteca.get('/', async (c) => {
  const secao = c.get('usuario').secao_id;
  const [cats, itens] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT id, nome, ordem FROM biblioteca_categorias WHERE secao_id = ? ORDER BY ordem, nome').bind(secao),
    c.env.DB.prepare(
      'SELECT i.* FROM biblioteca_itens i JOIN biblioteca_categorias k ON k.id = i.categoria_id WHERE k.secao_id = ? ORDER BY i.titulo',
    ).bind(secao),
  ]);
  return c.json({
    categorias: cats.results as unknown as CategoriaBiblioteca[],
    itens: (itens.results as Record<string, unknown>[]).map(itemDe),
  });
});

rotasBiblioteca.get('/:id/arquivo', async (c) => {
  const item = await itemDaSecao(c.env, c.get('usuario').secao_id, idDaRota(c));
  if (!item.r2_key) erro('Este material ainda não foi importado.', 404);
  const obj = await c.env.BIBLIOTECA.get(item.r2_key as string);
  if (!obj) erro('Arquivo não encontrado no armazenamento.', 404);
  const nome = (item.nome_arquivo as string) || 'arquivo';
  const baixar = c.req.query('baixar') === '1';
  return new Response(obj.body, {
    headers: {
      'Content-Type': (item.tipo_mime as string) || 'application/octet-stream',
      'Content-Length': String(obj.size),
      'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

rotasBiblioteca.post('/', async (c) => {
  exigirAdmin(c);
  const u = c.get('usuario');
  const form = await c.req.formData();
  const arquivo = form.get('arquivo');
  if (!(arquivo instanceof File) || !arquivo.size) erro('Selecione um arquivo.');
  if (arquivo.size > LIMITE_ARQUIVO) erro('O arquivo passa de 95 MB.', 413);
  const mime = mimeDe(arquivo.name, arquivo.type);
  if (!mime) erro('Formato não aceito. Use PDF, Word, imagem, texto ou MP3.');
  const categoriaId = Number(form.get('categoria_id'));
  await categoriaDaSecao(c.env, u.secao_id, categoriaId);
  const titulo = texto(form.get('titulo'), 200) || arquivo.name.replace(/\.[^.]+$/, '');

  const key = chaveR2(arquivo.name);
  // O R2 exige stream de tamanho conhecido
  const fluxo = new FixedLengthStream(arquivo.size);
  const copia = arquivo.stream().pipeTo(fluxo.writable);
  await Promise.all([c.env.BIBLIOTECA.put(key, fluxo.readable, { httpMetadata: { contentType: mime } }), copia]);
  const novo = await c.env.DB.prepare(
    `INSERT INTO biblioteca_itens (categoria_id, titulo, descricao, r2_key, nome_arquivo, tamanho, tipo_mime, enviado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(categoriaId, titulo, texto(form.get('descricao'), 1000), key, arquivo.name, arquivo.size, mime, u.id)
    .first<Record<string, unknown>>();
  return c.json(itemDe(novo!));
});

rotasBiblioteca.patch('/:id', async (c) => {
  exigirAdmin(c);
  const u = c.get('usuario');
  const item = await itemDaSecao(c.env, u.secao_id, idDaRota(c));
  const body = await c.req.json<{ titulo?: string; descricao?: string; categoria_id?: number }>();
  const categoriaId = body.categoria_id ? Number(body.categoria_id) : (item.categoria_id as number);
  if (body.categoria_id) await categoriaDaSecao(c.env, u.secao_id, categoriaId);
  const atualizado = await c.env.DB.prepare('UPDATE biblioteca_itens SET titulo = ?, descricao = ?, categoria_id = ? WHERE id = ? RETURNING *')
    .bind(texto(body.titulo, 200) || item.titulo, body.descricao !== undefined ? texto(body.descricao, 1000) : item.descricao, categoriaId, item.id)
    .first<Record<string, unknown>>();
  return c.json(itemDe(atualizado!));
});

rotasBiblioteca.delete('/:id', async (c) => {
  exigirAdmin(c);
  const item = await itemDaSecao(c.env, c.get('usuario').secao_id, idDaRota(c));
  if (item.r2_key) await c.env.BIBLIOTECA.delete(item.r2_key as string);
  await c.env.DB.prepare('DELETE FROM biblioteca_itens WHERE id = ?').bind(item.id).run();
  return c.json({ ok: true });
});

/** Copia um material do endereço antigo (WordPress) para o R2. Chamado um a um pela tela da biblioteca. */
rotasBiblioteca.post('/:id/importar', async (c) => {
  exigirAdmin(c);
  const item = await itemDaSecao(c.env, c.get('usuario').secao_id, idDaRota(c));
  if (item.r2_key) return c.json(itemDe(item));
  const origem = item.url_origem as string | null;
  if (!origem || !/^https?:\/\//.test(origem)) erro('Este material não tem endereço de origem.');

  let res = await fetch(origem, { redirect: 'follow' });
  if (!res.ok && origem.startsWith('https://')) res = await fetch(origem.replace('https://', 'http://'), { redirect: 'follow' });
  if (!res.ok || !res.body) erro(`O site de origem respondeu ${res.status}. Envie o arquivo manualmente.`);
  const tamanho = Number(res.headers.get('content-length')) || 0;
  if (tamanho > LIMITE_ARQUIVO) erro('O arquivo de origem é grande demais.', 413);

  const nome = (item.nome_arquivo as string) || origem.split('/').pop() || 'arquivo.pdf';
  const mime = mimeDe(nome, res.headers.get('content-type') ?? undefined) ?? 'application/pdf';
  const key = chaveR2(nome);
  const buffer = await res.arrayBuffer();
  await c.env.BIBLIOTECA.put(key, buffer, { httpMetadata: { contentType: mime } });
  const atualizado = await c.env.DB.prepare('UPDATE biblioteca_itens SET r2_key = ?, tamanho = ?, tipo_mime = ? WHERE id = ? RETURNING *')
    .bind(key, buffer.byteLength, mime, item.id)
    .first<Record<string, unknown>>();
  return c.json(itemDe(atualizado!));
});

rotasBiblioteca.post('/categorias', async (c) => {
  exigirAdmin(c);
  const secao = c.get('usuario').secao_id;
  const nome = texto((await c.req.json<{ nome?: string }>()).nome, 80);
  if (!nome) erro('Informe o nome da categoria.');
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(ordem), -1) + 1 AS o FROM biblioteca_categorias WHERE secao_id = ?').bind(secao).first<{ o: number }>();
  const cat = await c.env.DB.prepare('INSERT INTO biblioteca_categorias (secao_id, nome, ordem) VALUES (?, ?, ?) RETURNING id, nome, ordem')
    .bind(secao, nome, max!.o)
    .first();
  return c.json(cat);
});

rotasBiblioteca.patch('/categorias/:id', async (c) => {
  exigirAdmin(c);
  const id = idDaRota(c);
  await categoriaDaSecao(c.env, c.get('usuario').secao_id, id);
  const body = await c.req.json<{ nome?: string; ordem?: number }>();
  const cat = await c.env.DB.prepare('UPDATE biblioteca_categorias SET nome = COALESCE(?, nome), ordem = COALESCE(?, ordem) WHERE id = ? RETURNING id, nome, ordem')
    .bind(texto(body.nome, 80) || null, Number.isInteger(body.ordem) ? body.ordem : null, id)
    .first();
  return c.json(cat);
});

rotasBiblioteca.delete('/categorias/:id', async (c) => {
  exigirAdmin(c);
  const id = idDaRota(c);
  await categoriaDaSecao(c.env, c.get('usuario').secao_id, id);
  const uso = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM biblioteca_itens WHERE categoria_id = ?').bind(id).first<{ n: number }>();
  if (uso!.n > 0) erro('Mova ou exclua os materiais desta categoria antes de removê-la.', 409);
  await c.env.DB.prepare('DELETE FROM biblioteca_categorias WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});
