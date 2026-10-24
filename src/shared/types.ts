// Tipos compartilhados entre o Worker (API) e a interface (React).

export type Papel = 'admin' | 'chefe' | 'assistente';

export interface Usuario {
  id: number;
  email: string;
  nome: string;
  papel: Papel;
  secao_id: number;
  ativo: boolean;
  ultimo_acesso: string | null;
}

export interface Grupo {
  id: number;
  nome: string;
  numeral: string | null;
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
}

export interface Secao {
  id: number;
  grupo_id: number;
  nome: string;
  ramo: string;
}

export interface TipoAtividade {
  id: number;
  nome: string;
  descricao: string;
  modo: 'bloco' | 'periodos';
  dias: number;
  hora_inicio: string;
  hora_fim: string;
  ordem: number;
  ativo: boolean;
}

export interface TermoAjuste {
  usar: string;
  emVezDe: string;
}

export interface HorarioRapido {
  rotulo: string;
  inicio: string;
  fim: string;
}

export interface Configuracoes {
  velhosLobos: string[];
  termosAjuste: TermoAjuste[];
  horariosRapidos: HorarioRapido[];
}

export interface Sessao {
  usuario: Usuario;
  grupo: Grupo;
  secao: Secao;
  config: Configuracoes;
  tipos: TipoAtividade[];
  geminiConfigurado: boolean;
  logoutUrl: string | null;
}

export interface CategoriaBiblioteca {
  id: number;
  nome: string;
  ordem: number;
}

export interface ItemBiblioteca {
  id: number;
  categoria_id: number;
  titulo: string;
  descricao: string;
  disponivel: boolean; // arquivo já está no R2
  url_origem: string | null;
  nome_arquivo: string | null;
  tamanho: number | null;
  tipo_mime: string | null;
  criado_em: string;
}

export interface Periodo {
  chave: string;
  rotulo: string;
  ativo: boolean;
  inicio: string;
  fim: string;
}

export interface AtividadeEspecial {
  descricao: string;
  responsavel: string;
  inicio: string;
  duracao: number;
}

/** O que o chefe preenche no formulário. Guardado junto do plano para poder refazer ou duplicar. */
export interface ParametrosPlano {
  titulo: string;
  tema: string;
  tipoId: number;
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
  periodosPorDia: Periodo[][];
  caminho: string;
  eixo: string;
  bloco: string;
  velhoLoboPrincipal: string;
  equipe: string[];
  bibliotecaIds: number[];
  atividadeEspecial: AtividadeEspecial | null;
  observacoes: string;
  /** Texto extraído no navegador de um documento do Word ou .txt anexado. */
  documento: { nome: string; texto: string } | null;
}

export interface Atividade {
  dia?: string;
  periodo?: string;
  horaInicio: string;
  duracao: string;
  tipo: string;
  nome: string;
  responsavel: string;
  material: string;
  areaDesenvolvimento: string;
  descricao: string;
  fundoDeCena: string;
  planoB?: string;
}

export interface ConteudoPlano {
  cicloPrograma: string;
  diferenciacaoEtaria: string;
  recursosMateriais: string;
  recursosHumanos: string;
  atividades: Atividade[];
}

export interface PlanoResumo {
  id: number;
  titulo: string;
  tipo_id: number | null;
  tipo_nome: string | null;
  data_inicio: string;
  data_fim: string;
  autor_nome: string;
  autor_id: number;
  atualizado_em: string;
}

export interface Plano extends PlanoResumo {
  parametros: ParametrosPlano;
  conteudo: ConteudoPlano;
}

/** Eventos enviados pelo /api/planos/gerar (uma linha JSON por evento). */
export type EventoGeracao =
  | { tipo: 'etapa'; mensagem: string }
  | { tipo: 'progresso'; caracteres: number }
  | { tipo: 'concluido'; plano: Plano }
  | { tipo: 'erro'; mensagem: string };
