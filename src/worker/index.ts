// Entrada do Worker: API em /api/*. O resto (interface React) é servido pelos assets.
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Sessao } from '../shared/types';
import { emailAutenticado, urlLogout } from './auth';
import { buscarUsuarioPorEmail, carregarConfig, carregarGrupoESecao, carregarTipos, criarAdminInicial } from './dados';
import type { AppEnv } from './env';
import { rotasAdmin } from './rotas/admin';
import { rotasBiblioteca } from './rotas/biblioteca';
import { rotasPlanos } from './rotas/planos';
import { garantirEsquema } from './schema';

const app = new Hono<AppEnv>().basePath('/api');

app.get('/saude', (c) => c.json({ ok: true }));

app.use('*', async (c, next) => {
  await garantirEsquema(c.env);

  // Proteção contra envio de formulários a partir de outros sites (CSRF):
  // a interface sempre manda este cabeçalho, que um site externo não consegue incluir.
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('X-Requested-With') !== 'planejador') {
    throw new HTTPException(403, { message: 'Requisição recusada.' });
  }

  const email = await emailAutenticado(c);
  if (!email) return c.json({ erro: 'Faça login para continuar.', codigo: 'sem_login' }, 401);

  const usuario = (await buscarUsuarioPorEmail(c.env, email)) ?? (await criarAdminInicial(c.env, email));
  if (!usuario || !usuario.ativo) {
    return c.json({ erro: 'Seu e-mail ainda não tem acesso. Peça ao administrador da Alcateia para liberar.', codigo: 'sem_acesso', email }, 403);
  }
  c.set('usuario', usuario);
  await next();
});

app.get('/sessao', async (c) => {
  const u = c.get('usuario');
  c.executionCtx.waitUntil(c.env.DB.prepare("UPDATE usuarios SET ultimo_acesso = datetime('now') WHERE id = ?").bind(u.id).run());
  const [{ grupo, secao }, config, tipos] = await Promise.all([
    carregarGrupoESecao(c.env, u.secao_id),
    carregarConfig(c.env, u.secao_id),
    carregarTipos(c.env, u.secao_id),
  ]);
  const sessao: Sessao = { usuario: u, grupo, secao, config, tipos, geminiConfigurado: Boolean(c.env.GEMINI_API_KEY), logoutUrl: urlLogout(c.env) };
  return c.json(sessao);
});

app.route('/planos', rotasPlanos);
app.route('/biblioteca', rotasBiblioteca);
app.route('/admin', rotasAdmin);

app.notFound((c) => c.json({ erro: 'Não encontrado.' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ erro: err.message }, err.status);
  console.error(err);
  return c.json({ erro: err.message || 'Erro inesperado. Tente novamente.' }, 500);
});

export default app;
