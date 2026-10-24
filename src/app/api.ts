// Cliente da API. Todas as chamadas levam o cabeçalho X-Requested-With (proteção CSRF no Worker).

export class ErroApi extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
    public email?: string,
  ) {
    super(message);
  }
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const init: RequestInit = { method: metodo, headers: { 'X-Requested-With': 'planejador' }, credentials: 'same-origin' };
  if (corpo instanceof FormData) init.body = corpo;
  else if (corpo !== undefined) {
    init.body = JSON.stringify(corpo);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`/api${caminho}`, init);
  } catch {
    throw new ErroApi('Sem conexão. Verifique a internet e tente de novo.', 0);
  }
  const tipo = res.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) {
    // O Cloudflare Access redireciona para a tela de login quando a sessão expira
    if (res.redirected || res.status === 401 || res.status === 403) throw new ErroApi('Sua sessão expirou. Recarregue a página.', 401, 'sem_login');
    throw new ErroApi(`O servidor respondeu de forma inesperada (${res.status}).`, res.status);
  }
  const dados = await res.json();
  if (!res.ok) throw new ErroApi(dados.erro || 'Erro inesperado.', res.status, dados.codigo, dados.email);
  return dados as T;
}

export const api = {
  get: <T>(c: string) => requisitar<T>('GET', c),
  post: <T>(c: string, b?: unknown) => requisitar<T>('POST', c, b ?? {}),
  put: <T>(c: string, b: unknown) => requisitar<T>('PUT', c, b),
  patch: <T>(c: string, b: unknown) => requisitar<T>('PATCH', c, b),
  del: <T>(c: string) => requisitar<T>('DELETE', c),
};

/** POST que devolve uma linha JSON por evento (geração de planos). */
export async function postStream<E>(caminho: string, corpo: FormData, aoEvento: (e: E) => void): Promise<void> {
  const res = await fetch(`/api${caminho}`, { method: 'POST', body: corpo, headers: { 'X-Requested-With': 'planejador' }, credentials: 'same-origin' });
  if (!res.ok || !res.body) {
    const dados = await res.json().catch(() => ({}));
    throw new ErroApi(dados.erro || `Erro ${res.status}`, res.status);
  }
  const leitor = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    buffer += value;
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const linha = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (linha) aoEvento(JSON.parse(linha) as E);
    }
  }
}
