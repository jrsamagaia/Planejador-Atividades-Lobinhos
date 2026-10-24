// Servidor falso da API do Gemini, usado só nos testes automatizados.
// Responde ao envio de arquivos e ao streamGenerateContent com um plano válido em pedaços (SSE).
import { createServer } from 'node:http';

export const pedidos = [];

const atividade = (nome, duracao, tipo, horaInicio) => ({
  dia: '',
  periodo: '',
  horaInicio,
  duracao,
  tipo,
  nome,
  responsavel: 'Akelá',
  material: 'Bandeira, apito',
  areaDesenvolvimento: 'Social, Físico',
  descricao: `Passo a passo de ${nome}: reunir a Alcateia na Roca de Conselho, explicar as regras e conduzir. Antes era chamada de Rocha do Conselho.`,
  fundoDeCena: 'Como Mowgli aprendendo com Baloo.',
  planoB: 'Fazer no salão coberto.',
});

export function planoFalso() {
  // Horários propositalmente errados: o Worker recalcula a partir das durações.
  return {
    cicloPrograma: 'Diagnóstico, preparação, execução e avaliação na Roca de Conselho.',
    diferenciacaoEtaria: 'Lobinhos novos experimentam; lobos velhos lideram.',
    recursosMateriais: 'Cordas, bandeiras, cartolinas.',
    recursosHumanos: 'Akelá conduz; Baloo apoia.',
    atividades: [
      atividade('Abertura com Grande Uivo', '15 min', 'Cerimônia', '14:00'),
      atividade('Quebra-gelo e Canção', '15 min', 'Quebra-gelo', '14:20'),
      atividade('Caçada de Kaa', '40 min', 'Jogo ativo', '14:40'),
      atividade('Hidratação', '5 min', 'Pausa', '15:10'),
      atividade('Oficina de progressão', '45 min', 'Atividade de progressão', '15:15'),
      atividade('História da Jângal', '15 min', 'História', '16:00'),
      atividade('Encerramento', '15 min', 'Cerimônia', '16:20'),
    ],
  };
}

export function iniciarGeminiFalso(porta = 8790) {
  const servidor = createServer(async (req, res) => {
    let corpo = '';
    for await (const c of req) corpo += c;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/upload/v1beta/files') {
      res.writeHead(200, { 'x-goog-upload-url': `http://localhost:${porta}/upload/finalizar` }).end('{}');
      return;
    }
    if (url.pathname === '/upload/finalizar') {
      pedidos.push({ tipo: 'arquivo', bytes: corpo.length });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ file: { name: 'files/teste', uri: `https://falso/files/${pedidos.length}`, state: 'ACTIVE', mimeType: 'application/pdf' } }));
      return;
    }
    if (url.pathname.includes(':streamGenerateContent')) {
      pedidos.push({ tipo: 'gerar', modelo: url.pathname, corpo: JSON.parse(corpo) });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const json = JSON.stringify(planoFalso());
      const pedacos = json.match(/[\s\S]{1,400}/g);
      for (const [i, p] of pedacos.entries()) {
        const fim = i === pedacos.length - 1 ? { finishReason: 'STOP' } : {};
        res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: p }] }, ...fim }] })}\r\n\r\n`);
        await new Promise((r) => setTimeout(r, 20));
      }
      res.end();
      return;
    }
    res.writeHead(404).end('{}');
  });
  return new Promise((ok) => servidor.listen(porta, () => ok(servidor)));
}
