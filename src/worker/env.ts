import type { Usuario } from '../shared/types';

export interface Env {
  DB: D1Database;
  BIBLIOTECA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_EMAIL: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  GEMINI_MODELS: string;
  GEMINI_API_KEY?: string;
  /** Só para testes automatizados: endereço alternativo da API do Gemini. */
  GEMINI_API_BASE?: string;
  /** Só em desenvolvimento local (.dev.vars): e-mail usado quando não há Cloudflare Access. */
  DEV_USER_EMAIL?: string;
}

export type AppEnv = { Bindings: Env; Variables: { usuario: Usuario } };
