// Consultas compartilhadas entre as rotas.
import type { Configuracoes, Grupo, ItemBiblioteca, Plano, PlanoResumo, Secao, TipoAtividade, Usuario } from '../shared/types';
import type { Env } from './env';
import { CONFIG_PADRAO } from './schema';

type Linha = Record<string, unknown>;

export function usuarioDe(l: Linha): Usuario {
  return {
    id: l.id as number,
    email: l.email as string,
    nome: l.nome as string,
    papel: l.papel as Usuario['papel'],
    secao_id: l.secao_id as number,
    ativo: Boolean(l.ativo),
    ultimo_acesso: (l.ultimo_acesso as string) ?? null,
  };
}

export function tipoDe(l: Linha): TipoAtividade {
  return {
    id: l.id as number,
    nome: l.nome as string,
    descricao: l.descricao as string,
    modo: l.modo as TipoAtividade['modo'],
    dias: l.dias as number,
    hora_inicio: l.hora_inicio as string,
    hora_fim: l.hora_fim as string,
    ordem: l.ordem as number,
    ativo: Boolean(l.ativo),
  };
}

export function itemDe(l: Linha): ItemBiblioteca {
  return {
    id: l.id as number,
    categoria_id: l.categoria_id as number,
    titulo: l.titulo as string,
    descricao: l.descricao as string,
    disponivel: Boolean(l.r2_key),
    url_origem: (l.url_origem as string) ?? null,
    nome_arquivo: (l.nome_arquivo as string) ?? null,
    tamanho: (l.tamanho as number) ?? null,
    tipo_mime: (l.tipo_mime as string) ?? null,
    criado_em: l.criado_em as string,
  };
}

export async function buscarUsuarioPorEmail(env: Env, email: string): Promise<Usuario | null> {
  const l = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first<Linha>();
  return l ? usuarioDe(l) : null;
}

/** Cria o primeiro administrador (ADMIN_EMAIL) na primeira vez que ele entra. */
export async function criarAdminInicial(env: Env, email: string): Promise<Usuario | null> {
  if (!env.ADMIN_EMAIL || email !== env.ADMIN_EMAIL.toLowerCase()) return null;
  const secao = await env.DB.prepare('SELECT id FROM secoes ORDER BY id LIMIT 1').first<{ id: number }>();
  if (!secao) return null;
  await env.DB.prepare("INSERT OR IGNORE INTO usuarios (email, nome, papel, secao_id) VALUES (?, 'Administrador', 'admin', ?)")
    .bind(email, secao.id)
    .run();
  return buscarUsuarioPorEmail(env, email);
}

export async function carregarConfig(env: Env, secaoId: number): Promise<Configuracoes> {
  const { results } = await env.DB.prepare('SELECT chave, valor FROM configuracoes WHERE secao_id = ?').bind(secaoId).all<{ chave: string; valor: string }>();
  const config: Configuracoes = { ...CONFIG_PADRAO };
  for (const r of results) {
    if (r.chave in config) (config as unknown as Record<string, unknown>)[r.chave] = JSON.parse(r.valor);
  }
  return config;
}

export async function carregarTipos(env: Env, secaoId: number, incluirInativos = false): Promise<TipoAtividade[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM tipos_atividade WHERE secao_id = ? ${incluirInativos ? '' : 'AND ativo = 1'} ORDER BY ordem, id`,
  )
    .bind(secaoId)
    .all<Linha>();
  return results.map(tipoDe);
}

export async function carregarGrupoESecao(env: Env, secaoId: number): Promise<{ grupo: Grupo; secao: Secao }> {
  const secao = await env.DB.prepare('SELECT id, grupo_id, nome, ramo FROM secoes WHERE id = ?').bind(secaoId).first<Secao>();
  const grupo = await env.DB.prepare('SELECT id, nome, numeral, logo_url, cor_primaria, cor_secundaria FROM grupos WHERE id = ?')
    .bind(secao!.grupo_id)
    .first<Grupo>();
  return { grupo: grupo!, secao: secao! };
}

const SELECT_PLANO = `SELECT p.*, t.nome AS tipo_nome, u.nome AS autor_nome, u.email AS autor_email
  FROM planos p LEFT JOIN tipos_atividade t ON t.id = p.tipo_id JOIN usuarios u ON u.id = p.autor_id`;

function resumoDe(l: Linha): PlanoResumo {
  return {
    id: l.id as number,
    titulo: l.titulo as string,
    tipo_id: (l.tipo_id as number) ?? null,
    tipo_nome: (l.tipo_nome as string) ?? null,
    data_inicio: l.data_inicio as string,
    data_fim: l.data_fim as string,
    autor_id: l.autor_id as number,
    autor_nome: ((l.autor_nome as string) || (l.autor_email as string)) ?? '',
    atualizado_em: l.atualizado_em as string,
  };
}

export async function listarPlanos(env: Env, secaoId: number): Promise<PlanoResumo[]> {
  const { results } = await env.DB.prepare(`${SELECT_PLANO} WHERE p.secao_id = ? ORDER BY p.data_inicio DESC, p.id DESC LIMIT 500`)
    .bind(secaoId)
    .all<Linha>();
  return results.map(resumoDe);
}

export async function buscarPlano(env: Env, secaoId: number, id: number): Promise<Plano | null> {
  const l = await env.DB.prepare(`${SELECT_PLANO} WHERE p.secao_id = ? AND p.id = ?`).bind(secaoId, id).first<Linha>();
  if (!l) return null;
  return { ...resumoDe(l), parametros: JSON.parse(l.parametros as string), conteudo: JSON.parse(l.conteudo as string) };
}

/** Chefe e admin editam qualquer plano da seção; assistente edita só os próprios. */
export function podeEditarPlano(u: Usuario, plano: PlanoResumo): boolean {
  return u.papel !== 'assistente' || plano.autor_id === u.id;
}
