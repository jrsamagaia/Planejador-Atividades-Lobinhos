export interface AdjustmentTerm {
  use: string;
  insteadOf: string;
}

export interface UploadedDocument {
  filename: string;
  size: number;
  text: string;
  charCount: number;
}

export interface SpecialActivity {
  type: string;
  customType?: string;
  responsible: string;
  startTime: string;
  duration: number;
}

export interface ActivityPlan {
  cicloPrograma: string;
  diferenciacaoEtaria: string;
  recursosMateriais: string;
  recursosHumanos: string;
  atividades: Activity[];
}

export interface Activity {
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

export interface GrupoEscoteiro {
  id?: string;
  nome: string;
  cnpj: string;
  endereco: string;
  email: string;
  telefone: string;
  logoUrl: string;
  observacoes: string;
  createdAt?: any;
  ativo?: boolean;
  corPrincipal?: string;
  corSecundaria?: string;
}

export interface Secao {
  id?: string;
  grupoId: string;
  nome: string;
  createdAt?: any;
  ativo?: boolean;
}

export interface Perfil {
  id?: string;
  nome: string;
  ativo: boolean;
  createdAt?: any;
}

export interface UsuarioDoc {
  uid: string;
  email: string;
  nome: string;
  perfilId: string;
  perfilNome?: string;
  grupoId: string;
  secaoId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
}
