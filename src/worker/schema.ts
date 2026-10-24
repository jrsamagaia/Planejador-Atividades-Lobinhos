// Garante o esquema e os dados iniciais no D1.
// O deploy pelo Cloudflare Workers Builds não roda `wrangler d1 migrations apply`, então o próprio
// Worker aplica o SQL (idempotente) no primeiro acesso de cada instância.
import schemaSql from '../../migrations/0001_init.sql';
import { VELHOS_LOBOS_PADRAO } from '../shared/progressao';
import type { Configuracoes } from '../shared/types';
import type { Env } from './env';

let pronto: Promise<void> | null = null;

export function garantirEsquema(env: Env): Promise<void> {
  pronto ??= aplicar(env).catch((e) => {
    pronto = null;
    throw e;
  });
  return pronto;
}

function comandos(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function aplicar(env: Env) {
  await env.DB.batch(comandos(schemaSql).map((s) => env.DB.prepare(s)));
  const existe = await env.DB.prepare('SELECT id FROM grupos LIMIT 1').first();
  if (!existe) await semear(env);
}

export const CONFIG_PADRAO: Configuracoes = {
  velhosLobos: VELHOS_LOBOS_PADRAO,
  termosAjuste: [{ usar: 'Roca de Conselho', emVezDe: 'Rocha do Conselho' }],
  horariosRapidos: [
    { rotulo: 'Tarde (padrão)', inicio: '14:00', fim: '16:30' },
    { rotulo: 'Manhã (dia de evento)', inicio: '09:00', fim: '11:30' },
  ],
};

const TIPOS_PADRAO = [
  { nome: 'Reunião', modo: 'bloco', dias: 1, ini: '14:00', fim: '16:30', descricao: 'Reunião regular de sábado da Alcateia.' },
  { nome: 'Atividade externa', modo: 'bloco', dias: 1, ini: '09:00', fim: '16:00', descricao: 'Saída da sede (passeio, visita, trilha, ação comunitária). Inclua deslocamento, cuidados de segurança e lanche.' },
  { nome: 'Bivaque', modo: 'periodos', dias: 1, ini: '07:00', fim: '22:00', descricao: 'Atividade de um dia inteiro ao ar livre, sem pernoite.' },
  { nome: 'Acantonamento', modo: 'periodos', dias: 2, ini: '07:00', fim: '22:00', descricao: 'Atividade com pernoite em local coberto (sede, salão, escola). Lobinhos dormem em colchonetes, não em barracas.' },
  { nome: 'Acampamento', modo: 'periodos', dias: 2, ini: '07:00', fim: '22:00', descricao: 'Atividade com pernoite em barracas, ao ar livre.' },
];

const WP = 'https://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/';
const BIBLIOTECA_INICIAL: [string, [string, string][]][] = [
  ['Cancioneiro', [
    ['80 Canções Escoteiras', '80-Cancoes-Escoteiras.pdf'],
    ['Cancioneiro Alerta Para Cantar', 'Cancioneiro-Alerta-Para-Cantar.pdf'],
  ]],
  ['Histórias da Jângal', [
    ['Livro da Jângal 1 — Os Irmãos de Mowgli', 'Livro-Da-Jangal-1-Os-Irmaos-De-Mowglli.pdf'],
    ['Livro da Jângal 2 — Caçadas de Kaa', 'Livro-Da-Jangal-2-Cacadas-De-Kaa.pdf'],
    ['Livro da Jângal 3 — Como Apareceu o Medo', 'Livro-Da-Jangal-3-Como-Apareceu-O-Medo.pdf'],
    ['Livro da Jângal 4 — Tigre! Tigre!', 'Livro-Da-Jangal-4-Tigre-Tigre.pdf'],
    ['Livro da Jângal 5 — Kotick, a Foca Branca', 'Livro-Da-Jangal-5-Kotick-a-Foca-Branca.pdf'],
    ['Livro da Jângal 6 — Avanço da Jângal', 'Livro-Da-Jangal-6-Avanco-Da-Jangal.pdf'],
    ['Livro da Jângal 7 — Embriaguez da Primavera', 'Livro-Da-Jangal-7-Embriagues-Da-Primavera.pdf'],
    ['O Livro da Jângal — Rudyard Kipling (1942)', 'Livro-O-Livro-da-Jangal-Rudyard-Kipling-Edicao-1942.pdf'],
    ['História da Jângal — Clássicos Ilustrados', 'Historia-da-Jangal-Classicos-Iustrados.pdf'],
    ['Interpretação do Livro da Jângal', 'Interpretacao-Livro-da-Jangal.pdf'],
    ['Revista do Baloo', 'Revista-do-Baloo.pdf'],
  ]],
  ['Organização da Alcateia', [
    ['100 ideias para reuniões de Alcateias', '100-ideias-para-reunioes-de-Alcateias.pdf'],
    ['Competências e Rotas de Aprendizagem', 'Competencias-e-Rotas-de-Aprendizagem-Ramo-Lobinho.pdf'],
    ['Organização da Alcateia', 'Organizacao-Da-Alcateia.pdf'],
    ['Primeiros Passos da Alcateia', 'Primeiros-Passos-da-Alcateia.pdf'],
    ['Reuniões Especiais de Alcateias', 'Reunioes-Especiais-de-Alcateias.pdf'],
  ]],
  ['Progressão dos Lobinhos', [
    ['A Alcateia em Ação', 'Ramo-Lobinho-A-Alcateia-Em-Acao.pdf'],
    ['Guia do Lobinho', 'Guia-do-Lobinho.pdf'],
  ]],
  ['Cozinha Mateira', [['Comidas Mateiras', 'Comidas-Mateiras.pdf']]],
  ['Propostas de atividades', [['Proposta de atividade para lobinhos — Diretrizes UEB', 'Proposta-de-atividade-para-lobinhos-Diretrizes-UEB.pdf']]],
  ['Nós e Amarras', [
    ['O Grande Livro dos Nós', 'Grande-Livro-dos-Nos.pdf'],
    ['Nós e Amarras — Ar Livre 01', 'Nos-e-Amarras-Ar-Livre-01.pdf'],
  ]],
];

async function semear(env: Env) {
  const db = env.DB;
  const grupo = await db
    .prepare("INSERT INTO grupos (nome, numeral, logo_url) VALUES ('Grupo Escoteiro Leões de Blumenau', '32/SC', '/img/logo-gelb.png') RETURNING id")
    .first<{ id: number }>();
  const secao = await db
    .prepare("INSERT INTO secoes (grupo_id, nome, ramo) VALUES (?, 'Alcateia 3', 'lobinho') RETURNING id")
    .bind(grupo!.id)
    .first<{ id: number }>();
  const s = secao!.id;

  const stmts: D1PreparedStatement[] = [];
  TIPOS_PADRAO.forEach((t, i) =>
    stmts.push(
      db
        .prepare('INSERT INTO tipos_atividade (secao_id, nome, descricao, modo, dias, hora_inicio, hora_fim, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(s, t.nome, t.descricao, t.modo, t.dias, t.ini, t.fim, i),
    ),
  );
  for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) {
    stmts.push(db.prepare('INSERT INTO configuracoes (secao_id, chave, valor) VALUES (?, ?, ?)').bind(s, chave, JSON.stringify(valor)));
  }
  await db.batch(stmts);

  for (const [i, [categoria, itens]] of BIBLIOTECA_INICIAL.entries()) {
    const cat = await db
      .prepare('INSERT INTO biblioteca_categorias (secao_id, nome, ordem) VALUES (?, ?, ?) RETURNING id')
      .bind(s, categoria, i)
      .first<{ id: number }>();
    await db.batch(
      itens.map(([titulo, arquivo]) =>
        db
          .prepare('INSERT INTO biblioteca_itens (categoria_id, titulo, url_origem, nome_arquivo, tipo_mime) VALUES (?, ?, ?, ?, ?)')
          .bind(cat!.id, titulo, WP + arquivo, arquivo, 'application/pdf'),
      ),
    );
  }
}
