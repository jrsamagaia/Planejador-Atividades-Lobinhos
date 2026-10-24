// Cliente mínimo da API do Gemini (REST), sem SDK, para rodar no Worker.
// - Arquivos (PDFs da biblioteca ou anexados) vão pela Files API e ficam disponíveis por 48 h;
//   o endereço é guardado no D1 para reaproveitar nas próximas gerações.
// - A geração usa streaming (SSE) para manter a conexão viva em planos longos.
import type { Env } from './env';

const API_PADRAO = 'https://generativelanguage.googleapis.com';
const base = (env: Env) => env.GEMINI_API_BASE || API_PADRAO;

export interface ArquivoGemini {
  uri: string;
  mimeType: string;
}

function cabecalhos(env: Env, extra: Record<string, string> = {}) {
  return { 'x-goog-api-key': env.GEMINI_API_KEY ?? '', ...extra };
}

/** Envia um arquivo para a Files API e espera ficar pronto. */
export async function enviarArquivo(
  env: Env,
  corpo: ReadableStream | ArrayBuffer,
  tamanho: number,
  mimeType: string,
  nome: string,
): Promise<ArquivoGemini> {
  const inicio = await fetch(`${base(env)}/upload/v1beta/files`, {
    method: 'POST',
    headers: cabecalhos(env, {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(tamanho),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ file: { display_name: nome.slice(0, 120) } }),
  });
  const urlEnvio = inicio.headers.get('x-goog-upload-url');
  if (!inicio.ok || !urlEnvio) throw new Error(`Gemini recusou o envio do arquivo "${nome}" (${inicio.status}).`);

  let body: ReadableStream | ArrayBuffer = corpo;
  if (corpo instanceof ReadableStream) {
    const fixo = new FixedLengthStream(tamanho);
    corpo.pipeTo(fixo.writable).catch(() => {});
    body = fixo.readable;
  }
  const envio = await fetch(urlEnvio, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body,
  });
  if (!envio.ok) throw new Error(`Falha ao enviar "${nome}" ao Gemini (${envio.status}).`);
  let { file } = (await envio.json()) as { file: { name: string; uri: string; state: string; mimeType: string } };

  for (let i = 0; i < 30 && file.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`${base(env)}/v1beta/${file.name}`, { headers: cabecalhos(env) });
    if (r.ok) file = (await r.json()) as typeof file;
  }
  if (file.state === 'FAILED') throw new Error(`O Gemini não conseguiu ler "${nome}".`);
  return { uri: file.uri, mimeType: file.mimeType || mimeType };
}

type Parte = { text: string } | { fileData: { fileUri: string; mimeType: string } };

export class ErroGemini extends Error {}

/**
 * Gera conteúdo em streaming. Tenta os modelos de GEMINI_MODELS em ordem; se um estiver sobrecarregado
 * (429/503) ou não existir (404), passa para o próximo. Chama `aoReceber` com o total de caracteres.
 */
export async function gerarJson(
  env: Env,
  sistema: string,
  partes: Parte[],
  esquema: unknown,
  aoReceber: (caracteres: number) => void,
): Promise<string> {
  const modelos = env.GEMINI_MODELS.split(',').map((m) => m.trim()).filter(Boolean);
  const corpo = JSON.stringify({
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: partes }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 65536, responseMimeType: 'application/json', responseSchema: esquema },
  });

  let ultimoErro = '';
  for (const modelo of modelos) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const res = await fetch(`${base(env)}/v1beta/models/${modelo}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: cabecalhos(env, { 'Content-Type': 'application/json' }),
        body: corpo,
      });
      if (res.ok && res.body) return lerStream(res.body, aoReceber);

      const detalhe = await res.text().catch(() => '');
      ultimoErro = `${modelo}: ${res.status} ${detalhe.slice(0, 300)}`;
      console.warn('[gemini]', ultimoErro);
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new ErroGemini(
          res.status === 400 && !detalhe.includes('API key')
            ? 'O Gemini recusou o pedido. Tente reduzir os anexos ou simplificar o tema.'
            : 'A chave do Gemini é inválida ou não tem permissão. Peça ao administrador para conferir a GEMINI_API_KEY.',
        );
      }
      if (res.status !== 429 && res.status !== 503 && res.status !== 500) break; // 404 etc.: próximo modelo
      await new Promise((r) => setTimeout(r, 2000 * (tentativa + 1)));
    }
  }
  throw new ErroGemini('O Gemini está indisponível no momento. Aguarde um minuto e tente de novo.');
}

async function lerStream(body: ReadableStream<Uint8Array>, aoReceber: (n: number) => void): Promise<string> {
  const leitor = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let texto = '';
  let motivoFim = '';
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    buffer += value;
    let quebra: number;
    while ((quebra = buffer.indexOf('\n')) >= 0) {
      const linha = buffer.slice(0, quebra).trim();
      buffer = buffer.slice(quebra + 1);
      if (!linha.startsWith('data:')) continue;
      try {
        const evento = JSON.parse(linha.slice(5)) as {
          candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        };
        const c = evento.candidates?.[0];
        for (const p of c?.content?.parts ?? []) texto += p.text ?? '';
        if (c?.finishReason) motivoFim = c.finishReason;
        aoReceber(texto.length);
      } catch {
        /* linha parcial ou keep-alive */
      }
    }
  }
  if (motivoFim && motivoFim !== 'STOP') {
    throw new ErroGemini(
      motivoFim === 'MAX_TOKENS'
        ? 'O plano ficou grande demais e foi cortado. Tente com menos períodos ou menos anexos.'
        : `O Gemini interrompeu a resposta (${motivoFim}). Tente de novo.`,
    );
  }
  return texto;
}
