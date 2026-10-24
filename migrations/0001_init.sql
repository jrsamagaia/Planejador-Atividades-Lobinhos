-- Planejador da Alcateia — esquema inicial (idempotente: também é aplicado pelo Worker, ver src/worker/schema.ts)

CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  numeral TEXT,
  logo_url TEXT,
  cor_primaria TEXT NOT NULL DEFAULT '#1C3183',
  cor_secundaria TEXT NOT NULL DEFAULT '#F8D509',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS secoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id),
  nome TEXT NOT NULL,
  ramo TEXT NOT NULL DEFAULT 'lobinho',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- papel: admin (gerencia tudo) | chefe | assistente (ambos criam planos)
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nome TEXT NOT NULL DEFAULT '',
  papel TEXT NOT NULL DEFAULT 'chefe' CHECK (papel IN ('admin','chefe','assistente')),
  secao_id INTEGER NOT NULL REFERENCES secoes(id),
  ativo INTEGER NOT NULL DEFAULT 1,
  ultimo_acesso TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- modo: 'bloco' = um único bloco de horário (reunião, atividade externa)
--       'periodos' = um ou mais dias divididos em períodos (bivaque, acampamento, acantonamento)
CREATE TABLE IF NOT EXISTS tipos_atividade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secao_id INTEGER NOT NULL REFERENCES secoes(id),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  modo TEXT NOT NULL DEFAULT 'bloco' CHECK (modo IN ('bloco','periodos')),
  dias INTEGER NOT NULL DEFAULT 1,
  hora_inicio TEXT NOT NULL DEFAULT '14:00',
  hora_fim TEXT NOT NULL DEFAULT '16:30',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);

-- Configurações da seção em JSON (equipe de Velhos Lobos, termos de ajuste, horários rápidos)
CREATE TABLE IF NOT EXISTS configuracoes (
  secao_id INTEGER NOT NULL REFERENCES secoes(id),
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  PRIMARY KEY (secao_id, chave)
);

CREATE TABLE IF NOT EXISTS biblioteca_categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secao_id INTEGER NOT NULL REFERENCES secoes(id),
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- r2_key preenchido = arquivo guardado no R2 (privado).
-- url_origem = endereço antigo (WordPress), usado só para a importação.
CREATE TABLE IF NOT EXISTS biblioteca_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES biblioteca_categorias(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  r2_key TEXT,
  url_origem TEXT,
  nome_arquivo TEXT,
  tamanho INTEGER,
  tipo_mime TEXT,
  gemini_uri TEXT,
  gemini_expira TEXT,
  enviado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_categoria ON biblioteca_itens(categoria_id);

CREATE TABLE IF NOT EXISTS planos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secao_id INTEGER NOT NULL REFERENCES secoes(id),
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_id INTEGER REFERENCES tipos_atividade(id),
  titulo TEXT NOT NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  parametros TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_planos_secao_data ON planos(secao_id, data_inicio DESC);
