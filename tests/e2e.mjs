// Testes ponta a ponta (Playwright).
// Pré-requisitos: banco local zerado e `npm run dev` rodando com o .dev.vars de teste:
//   DEV_USER_EMAIL="alcateia03gelb@gmail.com"  GEMINI_API_KEY="teste"  GEMINI_API_BASE="http://localhost:8790"
// Este script sobe o Gemini falso na porta 8790.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { iniciarGeminiFalso, pedidos } from './gemini-falso.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:8787';
const SAIDA = process.env.SAIDA || 'tests/saida';
mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
async function etapa(nome, fn) {
  try {
    await fn();
    console.log(`✓ ${nome}`);
  } catch (e) {
    falhas++;
    console.error(`✗ ${nome}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}
function esperar(cond, msg) {
  if (!cond) throw new Error(msg);
}

const geminiFalso = process.env.SEM_GEMINI_FALSO ? null : await iniciarGeminiFalso(8790);
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await navegador.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

// PDF mínimo válido para os envios
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

await etapa('API recusa escrita sem o cabeçalho anti-CSRF', async () => {
  const r = await fetch(`${BASE}/api/planos/1`, { method: 'DELETE' });
  esperar(r.status === 403, `esperado 403, veio ${r.status}`);
});

await etapa('página inicial abre com o admin logado e estado vazio', async () => {
  await page.goto(BASE);
  await page.getByRole('heading', { name: /Olá|Planos/ }).waitFor();
  await page.getByText('Nenhum plano ainda').waitFor();
  await page.screenshot({ path: `${SAIDA}/inicio.png` });
});

await etapa('admin cadastra uma pessoa', async () => {
  await page.goto(`${BASE}/admin/usuarios`);
  await page.getByRole('button', { name: 'Adicionar pessoa' }).click();
  await page.getByLabel('E-mail').fill('chefe.teste@example.com');
  await page.getByLabel('Nome (como aparece nos planos)').fill('Chefe Teste');
  await page.getByText('Assistente', { exact: true }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Chefe Teste').waitFor();
  await page.screenshot({ path: `${SAIDA}/admin-pessoas.png` });
});

await etapa('admin cria um tipo de atividade novo', async () => {
  await page.goto(`${BASE}/admin/tipos`);
  await page.getByText('Acantonamento').first().waitFor();
  await page.getByRole('button', { name: 'Novo tipo' }).click();
  await page.getByLabel('Nome').fill('Jornada');
  await page.getByLabel('Descrição para o Gemini').fill('Caminhada curta pelo bairro.');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Jornada').waitFor();
});

await etapa('biblioteca: lista os materiais a importar e aceita envio de PDF', async () => {
  await page.goto(`${BASE}/biblioteca`);
  await page.getByText(/materiais.*ainda estão no site antigo/).waitFor();
  await page.getByRole('button', { name: 'Enviar arquivo' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'jogos-da-jangal.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByLabel('Título').fill('Jogos da Jângal');
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click();
  const link = page.getByRole('link', { name: 'Jogos da Jângal' });
  await link.waitFor();
  const href = await link.getAttribute('href');
  const r = await page.request.get(`${BASE}${href}`);
  esperar(r.status() === 200 && r.headers()['content-type'] === 'application/pdf', `download falhou: ${r.status()}`);
  await page.screenshot({ path: `${SAIDA}/biblioteca.png` });
});

let planoUrl = '';
await etapa('gera um plano de reunião com material da biblioteca', async () => {
  pedidos.length = 0;
  await page.goto(`${BASE}/novo`);
  await page.getByLabel('Nome da atividade').fill('A caçada de Kaa');
  await page.getByLabel('Tema ou ideia').fill('Cuidado com a natureza a partir da história de Kaa.');
  await page.getByRole('button', { name: /Manhã \(dia de evento\)/ }).click();
  await page.getByLabel('Eixo').selectOption('Meio Ambiente');
  await page.getByLabel('Bloco').selectOption('Vida ao Ar Livre');
  await page.getByText('Jogos da Jângal').click();
  await page.screenshot({ path: `${SAIDA}/novo-plano.png`, fullPage: true });
  await page.getByRole('button', { name: 'Gerar plano' }).click();
  await page.waitForURL(/\/planos\/\d+$/, { timeout: 30000 });
  planoUrl = page.url();
  await page.getByRole('heading', { name: 'A caçada de Kaa' }).waitFor();

  const gerar = pedidos.find((p) => p.tipo === 'gerar');
  esperar(gerar, 'o Gemini não foi chamado');
  esperar(pedidos.some((p) => p.tipo === 'arquivo'), 'o PDF da biblioteca não foi enviado ao Gemini');
  const partes = gerar.corpo.contents[0].parts;
  esperar(partes.some((p) => p.fileData), 'o pedido não inclui o arquivo');
  const prompt = partes.find((p) => p.text).text;
  esperar(prompt.includes('das 09:00 às 11:30') && prompt.includes('150 minutos'), 'o horário rápido não chegou ao prompt');
  esperar(prompt.includes('Vida ao Ar Livre'), 'o bloco não chegou ao prompt');
  esperar(gerar.corpo.generationConfig.responseSchema, 'sem esquema de resposta');
});

await etapa('plano salvo: horários recalculados e termos ajustados', async () => {
  // Os horários do Gemini falso começam às 14:00; o Worker recalcula a partir das 09:00
  await page.getByRole('button', { name: /Abertura com Grande Uivo/ }).waitFor();
  const primeira = await page.locator('article').first().innerText();
  esperar(primeira.includes('09:00'), `primeira atividade deveria começar 09:00: ${primeira.slice(0, 80)}`);
  esperar((await page.locator('article').last().innerText()).includes('11:15'), 'encerramento deveria começar às 11:15');
  await page.getByRole('button', { name: 'Expandir tudo' }).click();
  const texto = await page.locator('main').innerText();
  esperar(!texto.includes('Rocha do Conselho'), 'termo de ajuste não foi aplicado');
  await page.screenshot({ path: `${SAIDA}/plano.png`, fullPage: true });
});

await etapa('edita e salva o plano', async () => {
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome do plano').fill('A caçada de Kaa (revisado)');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('heading', { name: 'A caçada de Kaa (revisado)' }).waitFor();
});

await etapa('exporta PDF e Word', async () => {
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()]);
  const caminhoPdf = `${SAIDA}/${pdf.suggestedFilename()}`;
  await pdf.saveAs(caminhoPdf);
  esperar(readFileSync(caminhoPdf).subarray(0, 4).toString() === '%PDF', 'PDF inválido');
  const [docx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Word' }).click()]);
  const caminhoDocx = `${SAIDA}/${docx.suggestedFilename()}`;
  await docx.saveAs(caminhoDocx);
  esperar(readFileSync(caminhoDocx).subarray(0, 2).toString() === 'PK', 'DOCX inválido');
});

await etapa('"Gerar de novo com ajustes" preenche o formulário', async () => {
  await page.goto(planoUrl);
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('link', { name: 'Gerar de novo com ajustes' }).click();
  await page.waitForURL(/\/novo\?base=/);
  await page.waitForFunction(() => document.querySelector('#titulo')?.value === 'A caçada de Kaa');
});

await etapa('acampamento por períodos chega ao prompt com dia e período', async () => {
  pedidos.length = 0;
  await page.goto(`${BASE}/novo`);
  await page.getByRole('button', { name: 'Limpar' }).click();
  await page.getByRole('radio', { name: 'Acampamento' }).click();
  await page.getByLabel('Nome da atividade').fill('Acampamento de primavera');
  await page.getByLabel('Tema ou ideia').fill('Vida ao ar livre.');
  await page.getByRole('button', { name: 'Gerar plano' }).click();
  await page.waitForURL(/\/planos\/\d+$/, { timeout: 30000 });
  const prompt = pedidos.find((p) => p.tipo === 'gerar').corpo.contents[0].parts.at(-1).text;
  esperar(prompt.includes('Dia 2') && prompt.includes('Café da manhã: 07:00 às 08:00'), 'períodos não chegaram ao prompt');
  esperar(!prompt.match(/Dia 2[\s\S]*Noite/), 'o último dia não deveria ter "Noite" por padrão');
});

await etapa('lista de planos mostra os planos e filtra', async () => {
  await page.goto(BASE);
  await page.getByText('A caçada de Kaa (revisado)').waitFor();
  await page.getByRole('button', { name: 'Acampamento' }).click();
  esperar(!(await page.getByText('A caçada de Kaa (revisado)').isVisible()), 'filtro por tipo não funcionou');
});

await etapa('celular: navegação inferior e formulário', async () => {
  const cel = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await cel.newPage();
  await p.goto(BASE);
  await p.getByText('A caçada de Kaa (revisado)').waitFor();
  const larguraInicio = await p.evaluate(() => document.documentElement.scrollWidth);
  esperar(larguraInicio <= 390, `rolagem horizontal na lista de planos (${larguraInicio}px)`);
  await p.screenshot({ path: `${SAIDA}/celular-inicio.png` });
  await p.getByRole('link', { name: 'Novo plano' }).last().click();
  await p.getByLabel('Nome da atividade').waitFor();
  const largura = await p.evaluate(() => document.documentElement.scrollWidth);
  esperar(largura <= 390, `rolagem horizontal no celular (${largura}px)`);
  await p.screenshot({ path: `${SAIDA}/celular-novo.png` });
  await p.goto(planoUrl);
  await p.getByRole('heading', { name: /caçada de Kaa/ }).waitFor();
  await p.screenshot({ path: `${SAIDA}/celular-plano.png` });
  await cel.close();
});

await etapa('sem erros de JavaScript na página', async () => {
  esperar(erros.length === 0, erros.join('\n'));
});

await navegador.close();
geminiFalso?.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
