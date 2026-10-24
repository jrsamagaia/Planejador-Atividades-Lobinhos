import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './env';

export function exigirAdmin(c: Context<AppEnv>) {
  if (c.get('usuario').papel !== 'admin') throw new HTTPException(403, { message: 'Apenas o administrador pode fazer isso.' });
}

export function idDaRota(c: Context<AppEnv>, nome = 'id'): number {
  const id = Number(c.req.param(nome));
  if (!Number.isInteger(id) || id <= 0) throw new HTTPException(400, { message: 'Identificador inválido.' });
  return id;
}

export function texto(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function hora(v: unknown, padrao: string): string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : padrao;
}

export function data(v: unknown): string {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  throw new HTTPException(400, { message: 'Data inválida.' });
}

export function erro(msg: string, status: 400 | 403 | 404 | 409 | 413 = 400): never {
  throw new HTTPException(status, { message: msg });
}
