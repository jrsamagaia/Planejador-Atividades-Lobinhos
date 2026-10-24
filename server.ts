import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

const SYSTEM_PROMPT = `Você é um Especialista Escoteiro e um Akela (Chefe de Unidade Escoteira Local) muito experiente no Ramo Lobinho.
Seu objetivo é ajudar novos Chefes a montar cronogramas perfeitos, alinhados com o Método Escoteiro (Aprender Fazendo, Desenvolvimento Físico, Intelectual, Social, Afetivo, Espiritual e de Caráter) e com o novo sistema de Progressão Pessoal (Caminhos, Eixos e Blocos).

Você será encarregado de montar uma atividade de 150 minutos (2h 30m) para um sábado à tarde, com foco no avanço da progressão pessoal dos Lobinhos em uma etapa escolhida.

Às vezes, haverá uma "Atividade Especial" manual que VOCÊ DEVE incluir obrigatoriamente no cronograma exatamente na hora e duração informadas.

Retorne SEMPRE e EXCLUSIVAMENTE um objeto JSON com a seguinte estrutura e preenchido com dados detalhados e criativos:
{
  "cicloPrograma": "Explicação envolvente e resumida das 4 fases (Diagnóstico/Proposta, Escolha/Preparação, Execução e Avaliação) aplicadas na Alcateia, destacando a Roca de Conselho.",
  "diferenciacaoEtaria": "Dicas práticas de como aplicar esse tema de progressão para Lobinhos de 6,5 anos (foco na experimentação) vs Lobos Velhos de 10,5 anos (foco na liderança, autonomia e serviço).",
  "recursosMateriais": "Resumo dos materiais gerais necessários para a atividade inteira.",
  "recursosHumanos": "Lista dos chefes/velhos lobos necessários e seus papéis (ex: Akelá, Baloo, Bagheera, Kaa, Hathi, Ikki e Chill).",
  "atividades": [
    {
      "horaInicio": "14:00",
      "duracao": "15 min",
      "tipo": "Cerimônia / Quebra-gelo / Jogo Ativo / História / Jogo Calmo / Atividade de Progressão / etc.",
      "nome": "Nome Criativo",
      "responsavel": "Personagem/Chefe (ex: Akela)",
      "material": "Lista exata de materiais necessários.",
      "areaDesenvolvimento": "Quais das 6 áreas (Físico, Intelectual, Social, Afetivo, Espiritual, Caráter)",
      "descricao": "Explicação passo a passo rica e minuciosa (preparação prévia, explicação das regras às crianças, dinâmica do jogo/instrução, mediação e encerramento). O detalhamento deve ser profundo e autossuficiente como no Caderno do Escotista, de modo que QUALQUER LEIGO ou voluntário consiga conduzir a atividade com segurança e sem nenhuma dificuldade.",
      "fundoDeCena": "Como essa atividade contribui para o Caminho/Eixo/Bloco escolhido no universo da Jângal. O que os escotistas dirão às crianças?",
      "planoB": "Plano B minucioso para caso de chuva, mau tempo ou falta de espaço externo, adaptando a atividade para local coberto/abrigado sem perder a essência pedagógica."
    }
  ]
}

REGRAS RÍGIDAS DE TERMINOLOGIA (IMPORTANTÍSSIMO):
- Utilize SEMPRE "Roca de Conselho" (com 'C' maiúsculo) em vez de "Rocha do Conselho".
- Utilize terminologias modernas do Ramo Lobinho (Aprender Fazendo, Áreas de Desenvolvimento, Progressão Pessoal).
- Mantenha o clima da Jângal mas use os termos técnicos atuais da UEB (União dos Escoteiros do Brasil).

REGRAS RÍGIDAS DE HORÁRIO:
- O plano total deve durar 150 minutos (14:00 às 16:30).
- Se uma Atividade Especial for fornecida, ela DEVE ser incluída exatamente como solicitada (hora e duração).
- Estrutura obrigatória:
  - Início às 14:00 com Abertura (Grande Uivo, IBOGU, Inspeção, Hasteamento).
  - Pelo menos um Jogo de Movimento (Energia alta).
  - A parte central da atividade deve envolver fortemente a prática/ensino do Bloco do Eixo de Progressão escolhido.
  - Inclua breves paradas de hidratação (5 min) após grandes jogos.
  - Encerramento entre 16:15 e 16:30 (Troca de roupa, Arriamento, IBOAGU, Grande Uivo final).
- Respeite rigorosamente a linha do tempo, certificando-se de que a soma das "duracao" bata exatamente 150 minutos e os "horaInicio" estejam na sequência correta.

REGRAS DE CONTEÚDO:
- Nenhuma formatação extra além do JSON (sem \`\`\`json ou marcação Markdown). O parse precisa ser direto.
- Explore o Eixo Temático e o Bloco de atividades selecionado para o Caminho (Integrar, Descobrir, Rastrear, Caçar, Estrelas) fornecido.
- Use a lista de velhos lobos fornecida pelo usuário no prompt para atribuir responsabilidades.
- DETALHAMENTO DE ATIVIDADES PARA LEIGOS (PADRÃO CADERNO DO ESCOTISTA):
  A 'descricao' de cada atividade deve ser extremamente clara, rica em detalhes práticos e didática. Explique as regras passo a passo, a dinâmica com as matilhas, como os chefes orientam e o desfecho, garantindo que qualquer pessoa leiga consiga executar com perfeição.
  Cada atividade deve conter obrigatoriamente um 'planoB' para caso de chuva ou intempérie, com alternativas para ambiente fechado/coberto.
- SE HOUVER DOCUMENTO ANEXADO OU CONTEÚDO EXTRAÍDO:
  Você DEVE absorver todo o contexto, técnicas, regras, dinâmicas e histórias contidas no texto do documento/tema, utilizando-os para fundamentar a programação em profundidade, trazendo jogos específicos, ensinamentos e conteúdos pedagógicos do arquivo.
`;

async function startServer() {
  console.log(">>> [SERVER] Scouting Tracker Initialized");
  const app = express();
  const PORT = 3000;
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(cors());
  app.use(express.json());

  // Middleware de Log para depuração
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Servidor está online" });
  });

  // API Route for Gemini Plan Generation
  app.get("/api/generate-plan", (req, res) => {
    res.json({
      status: "ok",
      description: "Este endpoint aceita requisições POST para gerar os planos de atividade.",
      usage: "Envie um POST com as configurações apropriadas do plano."
    });
  });

  app.post("/api/generate-plan", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("[PLANNER] Sem chave GEMINI_API_KEY. Ativando gerador estruturado do Ramo Lobinho...");
        const fallbackPlan = generateLobinhoPlan(req.body);
        return res.json(fallbackPlan);
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const { prompt, tipoDuracao, dataInicio, dataFim, periodosDia1, periodosDia2 } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "No prompt provided" });
      }

      let systemInstruction = SYSTEM_PROMPT;
      if (tipoDuracao && tipoDuracao !== 'normal') {
        const duracaoNome = tipoDuracao === 'bivaque' ? 'Bivaque (1 dia)' : 'Acampamento (2 dias)';
        
        const getAtivos = (p: any) => Object.entries(p || {})
          .filter(([_, v]: any) => v.ativo)
          .map(([k, v]: any) => {
            const label = k === 'cafeManha' ? 'CAFÉ DA MANHÃ' :
                          k === 'manha' ? 'MANHÃ' :
                          k === 'almoco' ? 'ALMOÇO' :
                          k === 'tarde' ? 'TARDE' :
                          k === 'cafeTarde' ? 'CAFÉ DA TARDE' :
                          k === 'janta' ? 'JANTA' : 'NOITE';

            const hIn = parseInt(v.horaInicio.split(':')[0]);
            const mIn = parseInt(v.horaInicio.split(':')[1]);
            const hFim = parseInt(v.horaFim.split(':')[0]);
            const mFim = parseInt(v.horaFim.split(':')[1]);
            let totalMinutos = (hFim * 60 + mFim) - (hIn * 60 + mIn);
            if (totalMinutos < 0) totalMinutos += 24 * 60;

            return `${label} (${v.horaInicio} às ${v.horaFim} - PREENCHER EXATOS ${totalMinutos} MINUTOS)`;
          })
          .join(', ');

        const dia1Str = periodosDia1 ? `Dia 1: ${getAtivos(periodosDia1)}` : '';
        const dia2Str = tipoDuracao === 'acampamento' && periodosDia2 ? ` | Dia 2: ${getAtivos(periodosDia2)}` : '';
        const periodosAtivos = `${dia1Str}${dia2Str}`;

        systemInstruction = `Você é um Especialista Escoteiro e um Akela (Chefe de Unidade Escoteira Local) muito experiente no Ramo Lobinho.
Seu objetivo é ajudar novos Chefes a montar cronogramas perfeitos, alinhados com o Método Escoteiro (Aprender Fazendo, Desenvolvimento Físico, Intelectual, Social, Afetivo, Espiritual e de Caráter) e com o novo sistema de Progressão Pessoal (Caminhos, Eixos e Blocos).

Você será encarregado de planejar a programação completa de um ${duracaoNome}, que se estende de ${dataInicio} até ${dataFim}.
A programação deve obrigatoriamente cobrir os seguintes períodos selecionados pelo usuário: 
${periodosAtivos}.

Para cada período ativo de cada dia, monte uma sequência de atividades escoteiras apropriadas para lobinhos, focando no avanço de progressão escolhido.

MUITO IMPORTANTE SOBRE OS HORÁRIOS (MATEMÁTICA DO TEMPO):
- Você é EXTREMAMENTE RIGOROSO com o tempo.
- Para cada período listado acima, a soma dos minutos de "duracao" de TODAS AS ATIVIDADES desse bloco DEVE BATER EXATAMENTE com os minutos totais do bloco.
- NÃO termine um período antes, e não adicione minutos extras.
- Se o Almoço é de "12:00 às 14:00 - PREENCHER EXATOS 120 MINUTOS", crie uma ou mais atividades no Almoço cuja duração somada seja 120 minutos (ex: "Almoço" com 60 min e "Tempo Livre" com 60 min).
- Se a Tarde começa às 14:00, a PRIMEIRA atividade do bloco "Tarde" OBRIGATORIAMENTE DEVE ter "horaInicio": "14:00". Ela NUNCA pode começar antes (ex: as 13:00) ou depois.
- Calcule a soma dos minutos e verifique se bateu.

No JSON retornado, na chave 'atividades', liste sequencialmente as atividades organizadas por dias e períodos. No início de cada atividade (no campo "nome" ou "descricao"), indique o dia e o período específico. Por exemplo: "Dia 1 - Manhã: Abertura e ...", "Dia 2 - Tarde: Grande Caçada ...".

Estrutura do JSON a ser retornado: {
  "cicloPrograma": "Explicação envolvente de como as Fases do Ciclo de Programa e a Roca de Conselho se aplicam para este evento de longa duração (${tipoDuracao}).",
  "diferenciacaoEtaria": "Dicas práticas de aplicação para lobinhos novos e antigos num evento maior como este.",
  "recursosMateriais": "Resumo dos materiais gerais necessários para o Bivaque/Acampamento.",
  "recursosHumanos": "Qual equipe de Velhos Lobos é necessária para conduzir este evento.",
  "atividades": [
    {
      "horaInicio": "Horário exato da atividade, no formato HH:MM",
      "duracao": "Sempre no formato 'X min' ou 'Xh'",
      "tipo": "Cerimônia / Jogo / Palestra / Refeição / Fogão de Conselho / etc",
      "nome": "[Dia X - Período] Nome Criativo da Atividade",
      "responsavel": "Velho Lobo responsável",
      "material": "Material específico",
      "areaDesenvolvimento": "Uma ou mais das 6 áreas de desenvolvimento",
      "descricao": "Explicação passo a passo em português bem detalhada",
      "fundoDeCena": "Como se contextualiza na história do Livro da Jângal para as crianças"
    }
  ]
}

REGRAS RÍGIDAS DE TERMINOLOGIA (IMPORTANTÍSSIMO):
- Utilize SEMPRE "Roca de Conselho" (com 'C' maiúsculo) em vez de "Rocha do Conselho".
- Utilize terminologias modernas do Ramo Lobinho.

REGRAS DE CONTEÚDO:
- Nenhuma formatação extra além do JSON (sem \`\`\`json ou marcação Markdown). O parse precisa ser direto.
- Se houver Atividade Especial informada no prompt, insira-a no período correspondente.`;
      }

      console.log("[GEMINI] Solicitando geração de plano...");
      
      const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let response;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        let retries = 2;
        let delayMs = 1500;
        let success = false;

        while (retries > 0) {
          try {
            console.log(`[GEMINI] Tentando gerar plano com o modelo: ${modelName}...`);
            response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                systemInstruction,
                temperature: 0.2, // lowered temperature for more deterministic math
                responseMimeType: "application/json",
              }
            });
            success = true;
            break; // break out of retry loop if successful
          } catch (err: any) {
            lastError = err;
            retries--;
            const msg = String(err.message || "");
            const isRetryable = msg.includes("503") || msg.includes("high demand") || msg.includes("429") || msg.includes("UNAVAILABLE") || msg.includes("ResourceExhausted") || msg.includes("RESOURCE_EXHAUSTED");
            
            if (retries === 0 || !isRetryable) {
              break; // exit inner retry loop to try the next fallback model
            }
            
            console.warn(`[GEMINI] Erro temporário (503/429/UNAVAILABLE) no modelo ${modelName}. Re-tentando em ${delayMs/1000}s... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2; // exponential backoff
          }
        }

        if (success && response) {
          console.log(`[GEMINI] Plano gerado com sucesso usando o modelo: ${modelName}`);
          break;
        } else {
          console.warn(`[GEMINI] Modelo ${modelName} falhou no processo. Iniciando próximo modelo de fallback...`);
        }
      }

      if (!response) {
        console.warn("[GEMINI] Nenhuma resposta obtida da IA. Ativando gerador integrado do Ramo Lobinho...");
        const fallbackPlan = generateLobinhoPlan(req.body);
        return res.json(fallbackPlan);
      }

      let text = response.text || "{}";
      const startJson = text.indexOf('{');
      const endJson = text.lastIndexOf('}');
      if (startJson !== -1 && endJson !== -1 && endJson > startJson) {
        text = text.substring(startJson, endJson + 1);
      } else {
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      try {
        const parsedJson = JSON.parse(text);
        return res.json(parsedJson);
      } catch (parseErr: any) {
        console.warn("Falha no parse do JSON da IA, ativando gerador integrado:", text.slice(0, 150));
        const fallbackPlan = generateLobinhoPlan(req.body);
        return res.json(fallbackPlan);
      }
    } catch (error: any) {
      console.error("Gemini error:", error);
      console.warn("[PLANNER] Chave sem permissão ou falha de acesso à API (403/PERMISSION_DENIED). Ativando gerador estruturado do Ramo Lobinho (UEB)...");
      try {
        const fallbackPlan = generateLobinhoPlan(req.body);
        return res.json(fallbackPlan);
      } catch (fallbackErr: any) {
        console.error("Erro fatal no gerador integrado:", fallbackErr);
        return res.status(400).json({ error: "Erro ao gerar o plano de reunião. Por favor, tente novamente." });
      }
    }
  });

  // Helper time functions for precise scouting schedule generation
  function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
    const parts = (timeStr || "14:00").split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const total = h * 60 + m + minutesToAdd;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  function getMinutesDiff(startStr: string, endStr: string): number {
    const p1 = (startStr || "00:00").split(':');
    const p2 = (endStr || "00:00").split(':');
    const h1 = parseInt(p1[0], 10) || 0;
    const m1 = parseInt(p1[1], 10) || 0;
    const h2 = parseInt(p2[0], 10) || 0;
    const m2 = parseInt(p2[1], 10) || 0;
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  function generateLobinhoPlan(body: any) {
    const prompt = body.prompt || "";
    const tipoDuracao = body.tipoDuracao || "normal";
    
    let theme = body.theme || "";
    if (!theme && prompt) {
      const m = prompt.match(/Conceito\/Tema da atividade:\s*([^\n]+)/);
      if (m) theme = m[1].trim();
    }
    if (!theme && body.uploadedDocText) {
      const firstLine = body.uploadedDocText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 3)[0];
      if (firstLine) theme = firstLine;
    }
    if (!theme) theme = "Aventuras na Jângal e Progressão Lobinho";
    theme = cleanExtractedHtmlText(theme);
    // Take a concise clean title if very long
    const shortTheme = theme.length > 50 ? theme.slice(0, 47) + "..." : theme;

    let caminho = body.caminho || "Todos";
    let eixo = body.eixo || "Todos";
    let bloco = body.bloco || "Todos";
    let velhoLobo = body.velhoLobo || "Akela";
    const velhosLobos = Array.isArray(body.velhosLobos) && body.velhosLobos.length ? body.velhosLobos : ["Akela", "Baloo", "Bagheera", "Kaa", "Chill", "Hathi"];
    const secondLobo = velhosLobos.find((l: string) => l !== velhoLobo) || "Bagheera";
    const thirdLobo = velhosLobos.find((l: string) => l !== velhoLobo && l !== secondLobo) || "Baloo";

    const specialActivity = body.specialActivity;

    const cicloPrograma = `Aplicação das 4 fases do Ciclo de Programa no Ramo Lobinho (UEB):
1. Diagnóstico e Proposta: Os Velhos Lobos diagnosticam o momento da Alcateia e as necessidades de progressão individual (${caminho !== 'Todos' ? caminho : 'Pata Tenra ao Cruzeiro do Sul'}), propondo uma reunião envolvente inspirada no tema '${shortTheme}'.
2. Escolha e Preparação: A Alcateia valida os jogos e histórias na Roca de Conselho. As matilhas organizam seus materiais com incentivo dos Primos.
3. Execução: Desenvolvimento dinâmico e participativo no sábado, aplicando o princípio de 'Aprender Fazendo', cooperação e desenvolvimento das habilidades práticas.
4. Avaliação: Momento reflexivo ao redor da Roca de Conselho, onde os lobinhos avaliam as atividades, reconhecem as Boas Ações e celebram as conquistas da tarde.`;

    const diferenciacaoEtaria = `Diferenciação Pedagógica por Faixa Etária na Alcateia:
- Para Lobinhos Novos (6,5 a 8 anos - Pata Tenra e Saltador): Foco na descoberta, acolhimento, regras simples, cooperação com os colegas de matilha e vivência prática da Lei do Lobinho ('O Lobinho ouve os Velhos Lobos e pensa primeiro nos outros').
- Para Lobos Velhos (9 a 10,5 anos - Rastreador, Caçador e Cruzeiro do Sul): Foco no protagonismo, autonomia e liderança como Primos e Segundos de Matilha, orientação aos mais novos, aperfeiçoamento das técnicas escoteiras e conclusão das especialidades rumo à transição para a Tropa Escoteira.`;

    const recursosMateriais = `Bandeira Nacional com mastro ou suporte móvel, Lenços escoteiros, Apito de comando para Akela, Bolas de meia e cones para demarcação de tocas, Cordas individuais para treino de nós, Folhas sulfite e lápis de cor, Garrafinhas de água individuais, Totem da Alcateia / Livro da Jângal de Rudyard Kipling, Livros e cartões de progressão e distintivos para entrega.`;

    const recursosHumanos = `Equipe de Velhos Lobos da Alcateia:
- ${velhoLobo}: Responsável pela coordenação pedagógica, dinâmica de abertura e quebra-gelo.
- Akela: Condução das cerimônias formais (Grande Uivo, IBOAGU), condução da Roca de Conselho e encerramento.
- ${secondLobo}: Condução e arbitragem dos grandes jogos ativos e garantia de segurança.
- ${thirdLobo}: Instrução das técnicas de progressão, nós e especialidades da Jângal.
- Demais Velhos Lobos: Apoio nas matilhas, hidratação, registro fotográfico e acolhimento dos pais.`;

    let atividades: any[] = [];

    if (tipoDuracao === 'normal') {
      if (specialActivity && specialActivity.startTime && specialActivity.duration) {
        const spStart = specialActivity.startTime || "15:00";
        const spDur = parseInt(String(specialActivity.duration), 10) || 20;
        const spName = specialActivity.type === 'outra' ? (specialActivity.customType || "Atividade Especial") : specialActivity.type;
        const spResp = specialActivity.responsible || velhoLobo;
        const centralDur = Math.max(15, 45 - spDur + 5);
        const centralStart = addMinutesToTime(spStart, spDur);

        atividades = [
          {
            horaInicio: "14:00",
            duracao: "15 min",
            tipo: "Cerimônia",
            nome: "Abertura da Reunião (Grande Uivo, Inspeção de Matilhas e IBOAGU)",
            responsavel: "Akela",
            material: "Bandeira Nacional com mastro, Lenço Escoteiro, Livro de Presença da Alcateia",
            areaDesenvolvimento: "Caráter, Social",
            descricao: "Recepção dos lobinhos no pátio da sede. Os Primos de Matilha reúnem seus companheiros, organizam a formação em círculo em volta da Roca de Conselho e realizam a inspeção do uniforme, lenço e mãos limpas. Ao comando de Akela, a Alcateia executa com entusiasmo o Grande Uivo ('Akela, faremos o nosso melhor!') e o hasteamento da Bandeira Nacional, seguido da oração do Lobinho (IBOAGU).",
            fundoDeCena: "Reunião de todas as matilhas na Roca de Conselho sob o chamado de Akela, honrando a Lei da Jângal.",
            planoB: "Em caso de chuva, a cerimônia ocorre no interior da sede ou salão coberto, utilizando pedestal móvel para a Bandeira."
          },
          {
            horaInicio: "14:15",
            duracao: "15 min",
            tipo: "Quebra-Gelo e Canção",
            nome: `Quebra-Gelo da Alcateia: Dança da Jângal com ${velhoLobo}`,
            responsavel: velhoLobo,
            material: "Palmas, disposição dos velhos lobos",
            areaDesenvolvimento: "Afetivo, Social",
            descricao: `O Velho Lobo ${velhoLobo} assume o centro do círculo e ensina uma canção tradicional com movimentos corporais e comandos de atenção, promovendo a integração animada entre os lobinhos novos e experientes.`,
            fundoDeCena: `${velhoLobo} ensina aos filhotes as canções de alegria da floresta para aquecer o coração e espantar a timidez.`,
            planoB: "Canção sentada em círculo com palmas e estalos de dedos no salão coberto."
          },
          {
            horaInicio: "14:30",
            duracao: "30 min",
            tipo: "Jogo Ativo",
            nome: `Grande Caçada da Alcateia: Desafio das Matilhas (${shortTheme})`,
            responsavel: secondLobo,
            material: "Bolas de meia, cones de demarcação, fitas coloridas para cada matilha",
            areaDesenvolvimento: "Físico, Caráter",
            descricao: "Jogo de velocidade, coordenação motora e trabalho em equipe. No campo aberto ou pátio, delimitam-se as tocas das matilhas. Ao sinal do apito, os lobinhos devem recolher 'recursos da floresta' evitando os guardiões, respeitando as regras e praticando o jogo limpo.",
            fundoDeCena: "Bagheera ensina aos lobos a arte do movimento ágil e silencioso entre as sombras da Jângal.",
            planoB: "Adaptação para jogo de revezamento de destreza motora e agilidade no salão coberto sem correria perigosa."
          },
          {
            horaInicio: spStart,
            duracao: `${spDur} min`,
            tipo: "Atividade Especial",
            nome: `Atividade Especial: ${spName}`,
            responsavel: spResp,
            material: "Conforme necessidade da atividade especial programada",
            areaDesenvolvimento: "Social, Caráter",
            descricao: `Realização da atividade especial programada (${spName}), conduzida sob responsabilidade de ${spResp}, integrando toda a Alcateia com segurança e metodologia escoteira.`,
            fundoDeCena: "Momento solene e dedicado da Alcateia na Jângal com a participação especial dos Velhos Lobos.",
            planoB: "Realização no salão coberto com acomodação das matilhas em círculo."
          },
          {
            horaInicio: centralStart,
            duracao: `${centralDur} min`,
            tipo: "Atividade de Progressão",
            nome: `Oficina de Progressão: ${bloco !== 'Todos' ? bloco : 'Habilidades Práticas'} (${eixo !== 'Todos' ? eixo : 'Desenvolvimento Integral'})`,
            responsavel: velhoLobo,
            material: "Cordas de nós, cartões ilustrados com desafios, folhas e fichas de progressão",
            areaDesenvolvimento: eixo !== 'Todos' ? eixo : "Intelectual, Caráter, Social",
            descricao: `Atividade prática de 'Aprender Fazendo'. Cada matilha recebe uma mesa de trabalho com missões voltadas para o avanço das progressões (${caminho !== 'Todos' ? caminho : 'Pata Tenra ao Cruzeiro do Sul'}). Os velhos lobos auxiliam e assinam os livros de progressão dos lobinhos que completarem os itens.`,
            fundoDeCena: "Kaa e Baloo abrem os pergaminhos da sabedoria ancestral da selva, capacitando os filhotes para que se tornem lobos fortes, autônomos e prestativos.",
            planoB: "Atividade desenvolvida normalmente nas mesas da sede, com cartazes explicativos afixados nas paredes."
          },
          {
            horaInicio: "15:45",
            duracao: "30 min",
            tipo: "Roca de Conselho",
            nome: "Roca de Conselho: História da Jângal e Avaliação da Alcateia",
            responsavel: "Akela",
            material: "Totem da Alcateia, Lanterna decorativa, Livro da Jângal",
            areaDesenvolvimento: "Espiritual, Caráter, Afetivo",
            descricao: "Todos os lobinhos sentam-se em círculo sereno ao redor do totem da Alcateia. Akela narra uma história inspiradora adaptada de Rudyard Kipling, destacando lições sobre a Lei da Jângal, respeito mútuo e a Boa Ação diária. Em seguida, os lobinhos avaliam as atividades da reunião.",
            fundoDeCena: "Ao cair da tarde, Akela reúne a matilha no topo da colina para transmitir a sabedoria da Alcateia sob a proteção da Lei.",
            planoB: "Roca de conselho no centro da sala principal com iluminação indireta aconchegante."
          },
          {
            horaInicio: "16:15",
            duracao: "15 min",
            tipo: "Cerimônia",
            nome: "Cerimônia de Encerramento (Arriamento, Entrega de Distintivos e Grande Uivo Final)",
            responsavel: "Akela",
            material: "Bandeira Nacional, Livro de Ouro da Alcateia, distintivos de progressão",
            areaDesenvolvimento: "Caráter, Social",
            descricao: "Formação em ferradura ao redor do mastro. Akela faz os avisos, entrega distintivos conquistados e a matilha de serviço realiza o arriamento solene da Bandeira Nacional. Todos fazem a oração final e executam com entusiasmo o Grande Uivo final.",
            fundoDeCena: "Despedida dos filhotes da Jângal, retornando às suas tocas prontos para a Boa Ação diária.",
            planoB: "Encerramento formal na varanda coberta ou no salão com as mesmas formalidades e respeito cívico."
          }
        ];
      } else {
        atividades = [
          {
            horaInicio: "14:00",
            duracao: "15 min",
            tipo: "Cerimônia",
            nome: "Abertura da Reunião (Grande Uivo, Inspeção de Matilhas e IBOAGU)",
            responsavel: "Akela",
            material: "Bandeira Nacional com mastro, Lenço Escoteiro, Livro de Presença da Alcateia",
            areaDesenvolvimento: "Caráter, Social",
            descricao: "Recepção dos lobinhos no pátio da sede. Os Primos de Matilha reúnem seus companheiros, organizam a formação em círculo em volta da Roca de Conselho e realizam a inspeção do uniforme, lenço e mãos limpas. Ao comando de Akela, a Alcateia executa com entusiasmo o Grande Uivo ('Akela, faremos o nosso melhor!') e o hasteamento da Bandeira Nacional, seguido da oração do Lobinho (IBOAGU).",
            fundoDeCena: "Reunião de todas as matilhas na Roca de Conselho sob o chamado de Akela, honrando a Lei da Jângal.",
            planoB: "Em caso de chuva, a cerimônia ocorre no interior da sede ou salão coberto, utilizando pedestal móvel para a Bandeira."
          },
          {
            horaInicio: "14:15",
            duracao: "15 min",
            tipo: "Quebra-Gelo e Canção",
            nome: `Quebra-Gelo da Alcateia: Dança da Jângal com ${velhoLobo}`,
            responsavel: velhoLobo,
            material: "Palmas, disposição dos velhos lobos",
            areaDesenvolvimento: "Afetivo, Social",
            descricao: `O Velho Lobo ${velhoLobo} assume o centro do círculo e ensina uma canção tradicional com movimentos corporais e comandos de atenção (ex: 'Dançando com Baloo', 'O Passo da Pantera', 'O Abraço da Jângal'), integrando calorosamente os lobinhos novos e experientes.`,
            fundoDeCena: `${velhoLobo} ensina aos filhotes as canções de alegria da floresta para aquecer o coração e espantar a timidez.`,
            planoB: "Canção sentada em círculo com palmas e estalos de dedos no salão coberto."
          },
          {
            horaInicio: "14:30",
            duracao: "30 min",
            tipo: "Jogo Ativo",
            nome: `Grande Caçada da Alcateia: Desafio das Matilhas (${shortTheme})`,
            responsavel: secondLobo,
            material: "Bolas de meia, cones de demarcação, fitas coloridas para cada matilha",
            areaDesenvolvimento: "Físico, Caráter",
            descricao: "Jogo de velocidade, coordenação motora e trabalho em equipe. No campo aberto ou pátio, delimitam-se as tocas das matilhas. Ao sinal do apito, os lobinhos devem recolher 'recursos da floresta' espalhados no centro evitando os guardiões, respeitando as regras e praticando o jogo limpo.",
            fundoDeCena: "Bagheera ensina aos lobos a arte do movimento ágil e silencioso entre as sombras da Jângal.",
            planoB: "Adaptação para jogo de revezamento de destreza motora e agilidade no salão coberto sem correria perigosa."
          },
          {
            horaInicio: "15:00",
            duracao: "5 min",
            tipo: "Intervalo",
            nome: "Parada no Rio Waingunga (Hidratação e Higiene)",
            responsavel: "Todos os Velhos Lobos",
            material: "Garrafinhas individuais de água, sabonete líquido e toalhas de papel",
            areaDesenvolvimento: "Físico",
            descricao: "Pausa necessária para descanso fisiológico após o jogo de alta intensidade. Os chefes orientam todos os lobinhos a beberem água, lavarem as mãos e organizarem seus pertences antes da atividade técnica de progressão.",
            fundoDeCena: "A Trégua das Águas no Rio Waingunga: momento sagrado onde todos os animais descansam e saciam sua sede.",
            planoB: "Distribuição de água no próprio espaço abrigado com supervisão dos chefes."
          },
          {
            horaInicio: "15:05",
            duracao: "40 min",
            tipo: "Atividade de Progressão",
            nome: `Instrução Prática e Desafio: ${bloco !== 'Todos' ? bloco : 'Habilidades e Especialidades'} (${eixo !== 'Todos' ? eixo : 'Desenvolvimento Integral'})`,
            responsavel: velhoLobo,
            material: "Cordas de nós, cartões ilustrados com desafios, folhas de papel sulfite, lápis de cor e fichas de progressão",
            areaDesenvolvimento: eixo !== 'Todos' ? eixo : "Intelectual, Caráter, Social",
            descricao: `Atividade central fundamentada no Método Escoteiro ('Aprender Fazendo'). Cada matilha recebe uma mesa de trabalho com desafios práticos voltados para o avanço das progressões (${caminho !== 'Todos' ? caminho : 'Pata Tenra ao Cruzeiro do Sul'}). Os lobinhos mais velhos auxiliam os mais novos. As tarefas envolvem demonstração de habilidades práticas, nós ou técnicas pioneiras simples, resolução cooperativa de enigmas e aplicação prática das especialidades do Ramo Lobinho. Os velhos lobos passam pelas bases avaliando e assinando os livros de progressão dos lobinhos que completarem os itens.`,
            fundoDeCena: "Kaa e Baloo abrem os pergaminhos da sabedoria ancestral da selva, capacitando os filhotes para que se tornem lobos fortes, autônomos e prestativos.",
            planoB: "Atividade desenvolvida normalmente nas mesas da sede, com cartazes explicativos afixados nas paredes."
          },
          {
            horaInicio: "15:45",
            duracao: "30 min",
            tipo: "Roca de Conselho",
            nome: "Roca de Conselho: A História da Jângal e Avaliação da Alcateia",
            responsavel: "Akela",
            material: "Totem da Alcateia, Lanterna decorativa, Livro da Jângal",
            areaDesenvolvimento: "Espiritual, Caráter, Afetivo",
            descricao: "Todos os lobinhos sentam-se em círculo sereno ao redor do totem da Alcateia. Akela narra uma história inspiradora adaptada de Rudyard Kipling, destacando lições sobre obediência à Lei da Jângal, respeito mútuo e a importância da Boa Ação diária. Em seguida, abre-se a palavra para os Primos e lobinhos expressarem o que mais gostaram na reunião, o que aprenderam na progressão e como podem praticar o bem em suas casas e escolas.",
            fundoDeCena: "Ao cair da tarde, Akela reúne a matilha no topo da colina para transmitir a sabedoria da Alcateia sob a proteção da Lei.",
            planoB: "Roca de conselho no centro da sala principal com iluminação indireta aconchegante."
          },
          {
            horaInicio: "16:15",
            duracao: "15 min",
            tipo: "Cerimônia",
            nome: "Cerimônia de Encerramento (Arriamento, Entrega de Distintivos e Grande Uivo Final)",
            responsavel: "Akela",
            material: "Bandeira Nacional, Livro de Ouro da Alcateia, distintivos de progressão",
            areaDesenvolvimento: "Caráter, Social",
            descricao: "Formação em ferradura ao redor do mastro. Akela faz os avisos para o próximo sábado e convida à frente os lobinhos que completaram itens de progressão para receberem seus distintivos e o caloroso aplauso da Alcateia. A matilha de serviço realiza o arriamento da Bandeira Nacional com o respeito e reverência devidos. Todos fazem a oração final (IBOAGU). Ao comando final de Akela, a Alcateia executa com toda a força e entusiasmo o Grande Uivo de encerramento ('Faremos o nosso melhor! - Melhor! Melhor! Melhor!'). Os chefes dispensam os lobinhos ordenadamente para seus pais.",
            fundoDeCena: "Despedida dos filhotes da Jângal, que retornam às suas tocas prontos para espalhar a alegria e a Boa Ação no mundo dos homens.",
            planoB: "Encerramento formal na varanda coberta ou no salão com as mesmas formalidades e respeito cívico."
          }
        ];
      }
    } else {
      // Bivaque (1 dia) ou Acampamento (2 dias)
      const generatePeriodActivities = (diaNum: number, pMap: any) => {
        const result: any[] = [];
        if (!pMap) return result;

        const order = ['cafeManha', 'manha', 'almoco', 'tarde', 'cafeTarde', 'janta', 'noite'];
        for (const pKey of order) {
          const p = pMap[pKey];
          if (!p || !p.ativo || !p.horaInicio || !p.horaFim) continue;

          const totalMinutes = getMinutesDiff(p.horaInicio, p.horaFim);
          if (totalMinutes <= 0) continue;

          const pName = pKey === 'cafeManha' ? 'Café da Manhã' :
                        pKey === 'manha' ? 'Manhã' :
                        pKey === 'almoco' ? 'Almoço' :
                        pKey === 'tarde' ? 'Tarde' :
                        pKey === 'cafeTarde' ? 'Café da Tarde' :
                        pKey === 'janta' ? 'Jantar' : 'Noite (Fogo de Conselho / Lamparina)';

          if (pKey === 'almoco' || pKey === 'janta') {
            const half1 = Math.floor(totalMinutes / 2);
            const half2 = totalMinutes - half1;
            result.push({
              horaInicio: p.horaInicio,
              duracao: `${half1} min`,
              tipo: "Refeição",
              nome: `Dia ${diaNum} - ${pName}: Refeição da Alcateia`,
              responsavel: "Equipe de Cozinha / Akela",
              material: "Pratos, talheres, copos, alimentação balanceada",
              areaDesenvolvimento: "Físico, Social",
              descricao: `Momento de refeição comunitária das matilhas. Oração de agradecimento pelo alimento e prática de etiqueta escoteira e limpeza individual do material.`,
              fundoDeCena: "O Grande Banquete da Jângal em fraternidade.",
              planoB: "Refeitório coberto com mesas organizadas por matilha."
            });
            result.push({
              horaInicio: addMinutesToTime(p.horaInicio, half1),
              duracao: `${half2} min`,
              tipo: "Jogo Calmo",
              nome: `Dia ${diaNum} - ${pName}: Higiene e Canções de Digestão`,
              responsavel: thirdLobo,
              material: "Kit de higiene bucal, cancioneiro",
              areaDesenvolvimento: "Físico, Afetivo",
              descricao: `Escovação dos dentes e higiene pessoal por matilhas, seguido de canções sentadas e jogos calmos de observação com os chefes.`,
              fundoDeCena: "Descanso dos lobos na sombra acolhedora da floresta.",
              planoB: "Atividade no alojamento ou varanda coberta."
            });
          } else if (pKey === 'cafeManha' || pKey === 'cafeTarde') {
            result.push({
              horaInicio: p.horaInicio,
              duracao: `${totalMinutes} min`,
              tipo: "Lanche",
              nome: `Dia ${diaNum} - ${pName}: Lanche e Organização das Matilhas`,
              responsavel: "Todos os Velhos Lobos",
              material: "Frutas, pães, sucos naturais e toalhas",
              areaDesenvolvimento: "Físico, Social",
              descricao: `Lanche nutritivo para reposição de energias dos lobinhos e conferência dos cantis para as próximas caçadas.`,
              fundoDeCena: "Alimento fresco para fortalecer as patas dos filhotes.",
              planoB: "Espaço coberto com mesas protegidas."
            });
          } else if (pKey === 'noite') {
            const part1 = Math.min(30, Math.floor(totalMinutes * 0.3));
            const part2 = Math.min(60, Math.floor(totalMinutes * 0.5));
            const part3 = totalMinutes - part1 - part2;
            result.push({
              horaInicio: p.horaInicio,
              duracao: `${part1} min`,
              tipo: "Preparação",
              nome: `Dia ${diaNum} - Noite: Preparação e Montagem do Fogo de Conselho`,
              responsavel: secondLobo,
              material: "Lenha, lanternas decorativas ou fogueira segura, capas",
              areaDesenvolvimento: "Social, Caráter",
              descricao: `Organização do espaço cerimonial, ensaio das esquetes e apresentação de cada matilha para a grande celebração noturna.`,
              fundoDeCena: "Reunião solene dos lobos sob o manto estrelado da floresta.",
              planoB: "Fogo de conselho simbólico no salão com lanternas e fita crepom iluminada."
            });
            result.push({
              horaInicio: addMinutesToTime(p.horaInicio, part1),
              duracao: `${part2} min`,
              tipo: "Fogo de Conselho",
              nome: `Dia ${diaNum} - Noite: Grande Lamparina / Fogo de Conselho da Alcateia`,
              responsavel: "Akela e Baloo",
              material: "Cancioneiro, adereços de teatro, totens",
              areaDesenvolvimento: "Afetivo, Espiritual",
              descricao: `Apresentações lúdicas, peças teatrais curtas pelas matilhas, canções tradicionais e reflexão conduzida por Akela sobre a Lei da Jângal.`,
              fundoDeCena: "O calor do fogo ilumina os rostos fraternos da Alcateia reunida.",
              planoB: "Apresentação no tablado interno da sede."
            });
            result.push({
              horaInicio: addMinutesToTime(p.horaInicio, part1 + part2),
              duracao: `${part3} min`,
              tipo: "Cerimônia",
              nome: `Dia ${diaNum} - Noite: Canção da Despedida e Silêncio da Alcateia`,
              responsavel: "Akela",
              material: "Lanternas, agasalhos",
              areaDesenvolvimento: "Espiritual, Caráter",
              descricao: `Canção de Boa Noite dos Lobinhos, última inspeção de segurança e recolhimento aos alojamentos/barracas em silêncio.`,
              fundoDeCena: "A Jângal dorme sob a vigilância amorosa de Raksha e Akela.",
              planoB: "Recolhimento aos dormitórios cobertos."
            });
          } else {
            const m1 = Math.floor(totalMinutes * 0.15);
            const m2 = Math.floor(totalMinutes * 0.40);
            const m3 = Math.floor(totalMinutes * 0.35);
            const m4 = totalMinutes - m1 - m2 - m3;

            let curTime = p.horaInicio;
            result.push({
              horaInicio: curTime,
              duracao: `${m1} min`,
              tipo: "Cerimônia / Abertura",
              nome: `Dia ${diaNum} - ${pName}: Abertura do Período e Grande Uivo`,
              responsavel: "Akela",
              material: "Bandeira, apito, livro de presença",
              areaDesenvolvimento: "Caráter, Social",
              descricao: `Chamada da Alcateia, inspeção matinal de uniformes e bandeira, seguida do Grande Uivo com entusiasmo.`,
              fundoDeCena: "Início vigoroso das atividades sob o chamado de Akela.",
              planoB: "Abertura no salão coberto."
            });
            curTime = addMinutesToTime(curTime, m1);

            result.push({
              horaInicio: curTime,
              duracao: `${m2} min`,
              tipo: "Grande Jogo",
              nome: `Dia ${diaNum} - ${pName}: Grande Jogo da Alcateia (${shortTheme})`,
              responsavel: secondLobo,
              material: "Cones, bolas, cordas, adereços de equipe",
              areaDesenvolvimento: "Físico, Caráter",
              descricao: `Jogo amplo de exploração e cooperação entre as matilhas, com regras claras estimulando o espírito de equipe.`,
              fundoDeCena: "A busca pelas pistas sagradas deixadas por Bagheera.",
              planoB: "Jogo adaptado para salão coberto."
            });
            curTime = addMinutesToTime(curTime, m2);

            result.push({
              horaInicio: curTime,
              duracao: `${m3} min`,
              tipo: "Atividade de Progressão",
              nome: `Dia ${diaNum} - ${pName}: Instrução de Progressão e Especialidades`,
              responsavel: velhoLobo,
              material: "Cartões de progressão, materiais didáticos, bússolas/cordas",
              areaDesenvolvimento: "Intelectual, Caráter",
              descricao: `Oficinas práticas de 'Aprender Fazendo' para avanço nos itens da progressão do Ramo Lobinho.`,
              fundoDeCena: "Kaa ensina os nós e técnicas essenciais aos filhotes.",
              planoB: "Bases montadas nas salas da sede."
            });
            curTime = addMinutesToTime(curTime, m3);

            result.push({
              horaInicio: curTime,
              duracao: `${m4} min`,
              tipo: "Avaliação / Encerramento",
              nome: `Dia ${diaNum} - ${pName}: Roca de Conselho e Avaliação do Período`,
              responsavel: "Akela",
              material: "Totem da Alcateia, cartões de pontuação",
              areaDesenvolvimento: "Espiritual, Social",
              descricao: `Reunião rápida das matilhas para avaliação das atividades, hidratação e preparação para a próxima etapa.`,
              fundoDeCena: "Descanso e reflexão na Roca de Conselho.",
              planoB: "Roca de conselho no interior da sede."
            });
          }
        }
        return result;
      };

      atividades = [
        ...generatePeriodActivities(1, body.periodosDia1),
        ...(tipoDuracao === 'acampamento' ? generatePeriodActivities(2, body.periodosDia2) : [])
      ];
    }

    return {
      cicloPrograma,
      diferenciacaoEtaria,
      recursosMateriais,
      recursosHumanos,
      atividades
    };
  }

  // Helper functions for resilient document parsing
  function isZipBuffer(buf: Buffer): boolean {
    return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  }

  function isOleDocBuffer(buf: Buffer): boolean {
    return buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  }

  function isPdfBuffer(buf: Buffer): boolean {
    return buf.slice(0, 1024).includes(Buffer.from("%PDF-"));
  }

  function isRtfBuffer(buf: Buffer): boolean {
    return buf.slice(0, 64).toString("latin1").toLowerCase().includes("{\\rtf");
  }

  async function parseDocxSafe(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || "").trim();
    } catch (err: any) {
      console.warn("[PARSE-DOC] Mammoth parsing attempt failed:", err.message);
      return "";
    }
  }

  async function parseDocSafe(buffer: Buffer): Promise<string> {
    try {
      const extractor = new WordExtractor();
      const docData = await extractor.extract(buffer);
      return (docData.getBody() || "").trim();
    } catch (err: any) {
      console.warn("[PARSE-DOC] WordExtractor parsing attempt failed:", err.message);
      return "";
    }
  }

  async function parsePdfSafe(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      try {
        const pdfData = await parser.getText();
        return ((pdfData as any).text || "").trim();
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch (err: any) {
      console.warn("[PARSE-DOC] PDFParse failed:", err.message);
      return "";
    }
  }

  function parseRtfSafe(buffer: Buffer): string {
    try {
      const raw = buffer.toString("latin1");
      let clean = raw.replace(/\{\\\*?(?:fonttbl|colortbl|stylesheet|info|generator)[^{}]*\{[^}]*\}[^}]*\}/gi, "");
      clean = clean.replace(/\{\\\*?[^{}]*\}/gi, "");
      clean = clean.replace(/\\par\b/gi, "\n");
      clean = clean.replace(/\\line\b/gi, "\n");
      clean = clean.replace(/\\tab\b/gi, "\t");
      clean = clean.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
        try {
          const code = parseInt(hex, 16);
          return code >= 32 ? String.fromCharCode(code) : "";
        } catch {
          return "";
        }
      });
      clean = clean.replace(/\\u([0-9]{1,5})\??/g, (_, val) => {
        try {
          return String.fromCharCode(parseInt(val, 10));
        } catch {
          return "";
        }
      });
      clean = clean.replace(/\\[a-zA-Z]+-?[0-9]* ?/g, "");
      clean = clean.replace(/[{}]/g, "");
      return clean.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
    } catch {
      return "";
    }
  }

  function fixMojibake(str: string): string {
    if (!str) return "";
    try {
      if (/Ã[¡-º\s]|â€|Â/g.test(str)) {
        const fixed = Buffer.from(str, "latin1").toString("utf-8");
        if (!fixed.includes("\uFFFD")) return fixed;
      }
    } catch {}
    return str;
  }

  function cleanExtractedHtmlText(raw: string): string {
    if (!raw) return "";
    let cleaned = fixMojibake(raw);
    // Strip BOM
    cleaned = cleaned.replace(/^\uFEFF/, "").replace(/^ï»¿/, "");
    
    // Always clean scripts, styles, XML blocks
    cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, " ");
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, " ");
    cleaned = cleaned.replace(/<xml[\s\S]*?<\/xml>/gi, " ");
    cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, " ");
    cleaned = cleaned.replace(/<(?:br|p|div|tr|h[1-6]|li|blockquote)[\s\/>]/gi, "\n");
    cleaned = cleaned.replace(/<[^>]+>/g, " ");

    // Remove orphaned style/attribute declarations like style="..." or class="..." >
    cleaned = cleaned.replace(/(?:style|class|id|align|color|width|height|valign|bgcolor)="[^"]*">?/gi, " ");
    cleaned = cleaned.replace(/^[a-zA-Z0-9_\-:]+="[^"]*">?/gm, " ");
    cleaned = cleaned.replace(/[a-zA-Z0-9_\-:]+="[^"]*">/g, " ");
    
    // Decode common HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ccedil;/g, "ç")
      .replace(/&atilde;/g, "ã")
      .replace(/&otilde;/g, "õ")
      .replace(/&eacute;/g, "é")
      .replace(/&aacute;/g, "á")
      .replace(/&iacute;/g, "í")
      .replace(/&oacute;/g, "ó")
      .replace(/&uacute;/g, "ú");

    cleaned = cleaned.replace(/^[>\s"']+/gm, "");

    return cleaned
      .replace(/[ \t]+/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function parsePlainTextSafe(buffer: Buffer): string {
    try {
      const utf8Text = buffer.toString("utf-8");
      const nullCount = (utf8Text.slice(0, 1000).match(/\0/g) || []).length;
      if (nullCount === 0 && utf8Text.trim().length > 10) {
        return cleanExtractedHtmlText(utf8Text);
      }
    } catch {}
    return "";
  }

  function extractPrintableStrings(buffer: Buffer): string {
    try {
      const utf16Words: string[] = [];
      let currentU16 = "";
      for (let i = 0; i < buffer.length - 1; i += 2) {
        const code = buffer.readUInt16LE(i);
        if ((code >= 32 && code <= 126) || (code >= 160 && code <= 383) || code === 10 || code === 13) {
          currentU16 += String.fromCharCode(code);
        } else {
          if (currentU16.trim().length >= 10) {
            utf16Words.push(currentU16.trim());
          }
          currentU16 = "";
        }
      }
      if (currentU16.trim().length >= 10) utf16Words.push(currentU16.trim());

      const latin1Words: string[] = [];
      let currentL1 = "";
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if ((byte >= 32 && byte <= 126) || (byte >= 160 && byte <= 255) || byte === 10 || byte === 13) {
          currentL1 += String.fromCharCode(byte);
        } else {
          if (currentL1.trim().length >= 10) {
            latin1Words.push(currentL1.trim());
          }
          currentL1 = "";
        }
      }
      if (currentL1.trim().length >= 10) latin1Words.push(currentL1.trim());

      const joinedU16 = utf16Words.join("\n");
      const joinedL1 = latin1Words.join("\n");
      return (joinedU16.length > joinedL1.length ? joinedU16 : joinedL1).trim();
    } catch {
      return "";
    }
  }

  // API Route to Parse Document (.doc, .docx, .pdf)
  app.post(["/api/parse-document", "/api/parse-document/"], (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer parse error:", err);
        return res.status(400).json({ error: "Erro no processamento do arquivo: " + err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado para leitura." });
      }

      const originalName = req.file.originalname || "documento";
      const ext = path.extname(originalName).toLowerCase();
      const mime = req.file.mimetype || "";
      const buf = req.file.buffer;
      let extractedText = "";

      const isZip = isZipBuffer(buf);
      const isOle = isOleDocBuffer(buf);
      const isPdf = isPdfBuffer(buf);
      const isRtf = isRtfBuffer(buf);

      console.log(`[PARSE-DOC] Processando: ${originalName} (ext: ${ext}, mime: ${mime}, size: ${buf.length}b, zip: ${isZip}, ole: ${isOle}, pdf: ${isPdf}, rtf: ${isRtf})`);

      // 1. Prioritize format identified by actual binary magic bytes
      if (isZip) {
        extractedText = await parseDocxSafe(buf);
      } else if (isOle) {
        extractedText = await parseDocSafe(buf);
      } else if (isPdf) {
        extractedText = await parsePdfSafe(buf);
      } else if (isRtf) {
        extractedText = parseRtfSafe(buf);
      }

      // 2. Fallback based on extension or mime type if magic bytes didn't yield text
      if (!extractedText || extractedText.length < 5) {
        if (ext === ".docx" || mime.includes("wordprocessingml")) {
          if (isZip && !extractedText) extractedText = await parseDocxSafe(buf);
          if (!extractedText && isOle) extractedText = await parseDocSafe(buf);
          if (!extractedText && isRtf) extractedText = parseRtfSafe(buf);
        } else if (ext === ".doc" || mime.includes("msword")) {
          if (!extractedText && isOle) extractedText = await parseDocSafe(buf);
          if (!extractedText && isZip) extractedText = await parseDocxSafe(buf);
          if (!extractedText) extractedText = parseRtfSafe(buf);
          if (!extractedText) extractedText = await parseDocSafe(buf);
        } else if (ext === ".pdf" || mime.includes("pdf")) {
          if (!extractedText) extractedText = await parsePdfSafe(buf);
        }
      }

      // 3. Fallback: try plain text or HTML/XML stripping
      if (!extractedText || extractedText.length < 5) {
        extractedText = parsePlainTextSafe(buf);
      }

      // 4. Fallback: binary string extraction (recovers text from old or corrupted files)
      if (!extractedText || extractedText.length < 5) {
        extractedText = extractPrintableStrings(buf);
      }

      // Limpeza de tags HTML/XML e normalização de espaçamentos
      extractedText = cleanExtractedHtmlText(extractedText || "");

      if (!extractedText || extractedText.length < 5) {
        return res.status(400).json({
          error: "Não foi possível extrair texto legível do arquivo enviado. O arquivo pode estar corrompido, protegido por senha ou conter apenas páginas digitalizadas como imagem sem OCR. Dica: abra o arquivo no Microsoft Word ou Google Docs e salve-o como .docx ou exporte-o como .pdf."
        });
      }

      console.log(`[PARSE-DOC] Leitura concluída com sucesso: ${extractedText.length} caracteres extraídos.`);

      res.json({
        success: true,
        filename: originalName,
        size: req.file.size,
        text: extractedText,
        charCount: extractedText.length
      });
    } catch (parseError: any) {
      console.error("Document parsing error:", parseError);
      let errorMsg = parseError.message || "Erro desconhecido";
      if (errorMsg.includes("central directory") || errorMsg.includes("zip file") || errorMsg.includes("jszip")) {
        errorMsg = "O arquivo enviado não possui o formato .docx compactado válido (pode ser um arquivo .doc antigo renomeado ou corrompido). Dica: abra-o no Microsoft Word ou Google Docs e salve como .docx ou exporte como .pdf.";
      }
      res.status(400).json({ 
        error: "Erro ao realizar a leitura do arquivo: " + errorMsg
      });
    }
  });

  // API Route for WordPress Upload
  app.post(["/api/wp/upload", "/api/wp/upload/"], (req, res, next) => {
    console.log(`[UPLOAD] Request received: ${req.method} ${req.url}`);
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "Erro no processamento do arquivo: " + err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      const wpUser = process.env.WP_USERNAME || "alcateia03gelb@gmail.com";
      const wpPass = process.env.WP_APP_PASSWORD; 
      const wpUrl = (process.env.WP_SITE_URL || "https://geleoesdeblumenau.com.br").replace(/\/$/, "");

      if (!wpPass) {
        return res.status(500).json({ 
          error: "Senha do WordPress não configurada. Por favor, adicione WP_APP_PASSWORD (Senha de Aplicativo) nas configurações do app." 
        });
      }

      const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
      const apiUrl = `${wpUrl}/wp-json/wp/v2/media`;

      console.log(`Tentando upload para: ${apiUrl} como ${wpUser}`);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(req.file.originalname)}"`,
          "Content-Type": req.file.mimetype,
        },
        body: req.file.buffer,
      });

      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        console.error("Erro na API do WordPress:", response.status, data);
        return res.status(response.status).json({ 
          error: data.message || `Erro do WordPress (Status ${response.status})` 
        });
      }

      res.json({ 
        success: true, 
        url: data.source_url,
        id: data.id,
        link: data.link
      });
    } catch (error: any) {
      console.error("Upload error details:", error);
      res.status(500).json({ error: "Erro interno no servidor: " + error.message });
    }
  });

  // Catch-all para rotas de API não encontradas (evita retornar HTML do SPA)
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url} não encontrada`);
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando Vite em modo desenvolvimento...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Iniciando em modo produção...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global express error:", err);
    res.status(500).json({ error: "Erro crítico no servidor: " + (err.message || "Erro desconhecido") });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
