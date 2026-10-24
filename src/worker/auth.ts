// Autenticação via Cloudflare Access (Zero Trust).
// O Access fica na frente do site e pede um código por e-mail. Depois do login, toda requisição chega com
// o cabeçalho Cf-Access-Jwt-Assertion (JWT assinado pela Cloudflare). Aqui validamos a assinatura,
// o público (AUD) e a validade, e só então confiamos no e-mail. Quem pode entrar é decidido pela tabela
// `usuarios` (gerenciada no painel), não pela política do Access.
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv, Env } from './env';

interface Jwk extends JsonWebKey {
  kid: string;
}

let chavesCache: { dominio: string; chaves: Jwk[]; em: number } | null = null;

async function chavesPublicas(dominio: string, forcar = false): Promise<Jwk[]> {
  if (!forcar && chavesCache && chavesCache.dominio === dominio && Date.now() - chavesCache.em < 3600_000) {
    return chavesCache.chaves;
  }
  const res = await fetch(`https://${dominio}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Não foi possível obter as chaves do Cloudflare Access (${res.status})`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  chavesCache = { dominio, chaves: keys, em: Date.now() };
  return keys;
}

function base64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function validarJwt(token: string, env: Env): Promise<string | null> {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [h, p, s] = partes;
  const cabecalho = JSON.parse(new TextDecoder().decode(base64url(h))) as { kid?: string; alg?: string };
  if (cabecalho.alg !== 'RS256') return null;

  let chaves = await chavesPublicas(env.ACCESS_TEAM_DOMAIN);
  let jwk = chaves.find((k) => k.kid === cabecalho.kid);
  if (!jwk) {
    chaves = await chavesPublicas(env.ACCESS_TEAM_DOMAIN, true);
    jwk = chaves.find((k) => k.kid === cabecalho.kid);
  }
  if (!jwk) return null;

  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, base64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;

  const dados = JSON.parse(new TextDecoder().decode(base64url(p))) as { aud?: string | string[]; exp?: number; iss?: string; email?: string };
  const auds = Array.isArray(dados.aud) ? dados.aud : [dados.aud];
  if (!auds.includes(env.ACCESS_AUD)) return null;
  if (!dados.exp || dados.exp * 1000 < Date.now()) return null;
  if (dados.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  return dados.email ? dados.email.toLowerCase() : null;
}

export function accessConfigurado(env: Env): boolean {
  return Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);
}

/** E-mail de quem fez a requisição, ou null. Lança erro se o servidor não estiver configurado. */
export async function emailAutenticado(c: Context<AppEnv>): Promise<string | null> {
  const env = c.env;
  if (accessConfigurado(env)) {
    const token = c.req.header('Cf-Access-Jwt-Assertion') || getCookie(c, 'CF_Authorization');
    if (!token) return null;
    try {
      return await validarJwt(token, env);
    } catch (e) {
      console.error('Falha ao validar o login do Cloudflare Access', e);
      return null;
    }
  }
  if (env.DEV_USER_EMAIL) return env.DEV_USER_EMAIL.toLowerCase();
  throw new Error('Login não configurado: defina ACCESS_TEAM_DOMAIN e ACCESS_AUD (veja o README).');
}

export function urlLogout(env: Env): string | null {
  return accessConfigurado(env) ? '/cdn-cgi/access/logout' : null;
}
