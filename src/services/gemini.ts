import { ActivityPlan, SpecialActivity, UploadedDocument } from '../types';

async function parseServerResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();

  // Verifica se o servidor ou proxy retornou HTML (ex: 502/503/404 da infraestrutura)
  if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<!doctype html>')) {
    if (!response.ok) {
      throw new Error(`Servidor temporariamente indisponível (Status ${response.status}). Se o sistema estiver inicializando, aguarde alguns segundos e tente novamente.`);
    }
    throw new Error("O servidor retornou uma página HTML em vez de dados JSON. Por favor, recarregue a página ou tente novamente.");
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch (err) {
    if (!response.ok) {
      throw new Error(`Erro na comunicação com o servidor (Status ${response.status}).`);
    }
    throw new Error("Formato de resposta inesperado do servidor. Por favor, tente novamente.");
  }

  if (!response.ok) {
    let msg = data?.error || `Erro no servidor (Status ${response.status})`;
    if (typeof msg === 'string' && (msg.includes("PERMISSION_DENIED") || msg.includes("denied access") || msg.includes("403"))) {
      msg = "Acesso Negado ao Google Gemini (403 - PERMISSION_DENIED): O projeto vinculado precisa ser configurado com uma chave de API válida no Google AI Studio (Settings > Secrets).";
    }
    throw new Error(msg);
  }

  return data as T;
}

export async function parseUploadedDocument(file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/parse-document', {
    method: 'POST',
    body: formData,
  });

  const result = await parseServerResponse<{
    filename: string;
    size: number;
    text: string;
    charCount: number;
  }>(response);

  return {
    filename: result.filename,
    size: result.size,
    text: result.text,
    charCount: result.charCount,
  };
}

export async function generateActivityPlan(
  theme: string, 
  caminho: string, 
  eixo: string, 
  bloco: string, 
  velhoLobo: string, 
  biblioteca: string, 
  fullLibrary: any[],
  velhosLobos: string[],
  specialActivity?: SpecialActivity,
  tipoDuracao?: 'normal' | 'bivaque' | 'acampamento',
  dataInicio?: string,
  dataFim?: string,
  periodosDia1?: any,
  periodosDia2?: any,
  uploadedDocument?: UploadedDocument | null
) {
  const linksExtras = fullLibrary.flatMap(c => c.items).map(i => `- ${i.name}: ${i.url}`).join('\n  ');
  const listaVelhosLobos = velhosLobos.join(', ');

  const specialActivityPrompt = specialActivity ? `
  ATENÇÃO: Inclua OBRIGATORIAMENTE esta atividade especial no planejamento:
  - Atividade: ${specialActivity.type === 'outra' ? specialActivity.customType : specialActivity.type}
  - Responsável: ${specialActivity.responsible}
  - Início: ${specialActivity.startTime}
  - Duração: ${specialActivity.duration} minutos
  ` : "";

  let longDurationDetails = "";
  if (tipoDuracao && tipoDuracao !== 'normal') {
    const duracaoNome = tipoDuracao === 'bivaque' ? 'Bivaque (1 dia)' : 'Acampamento (2 dias)';
    
    const getAtivos = (p: any) => Object.entries(p || {})
      .filter(([_, v]: any) => v.ativo)
      .map(([k, v]: any) => {
        const label = k === 'cafeManha' ? 'Café da Manhã' :
                      k === 'manha' ? 'Manhã' :
                      k === 'almoco' ? 'Almoço' :
                      k === 'tarde' ? 'Tarde' :
                      k === 'cafeTarde' ? 'Café da Tarde' :
                      k === 'janta' ? 'Janta' : 'Noite';
        
        // Calcular minutos do período
        const hIn = parseInt(v.horaInicio.split(':')[0]);
        const mIn = parseInt(v.horaInicio.split(':')[1]);
        const hFim = parseInt(v.horaFim.split(':')[0]);
        const mFim = parseInt(v.horaFim.split(':')[1]);
        let totalMinutos = (hFim * 60 + mFim) - (hIn * 60 + mIn);
        if (totalMinutos < 0) totalMinutos += 24 * 60;

        return `${label} (${v.horaInicio} às ${v.horaFim} - EXATAMENTE ${totalMinutos} minutos)`;
      })
      .join(', ');

    const dia1Str = periodosDia1 ? `Dia 1: ${getAtivos(periodosDia1)}` : '';
    const dia2Str = tipoDuracao === 'acampamento' && periodosDia2 ? `\n  Dia 2: ${getAtivos(periodosDia2)}` : '';

    longDurationDetails = `
  === ATIVIDADE DE LONGA DURAÇÃO ===
  Esta atividade NÃO é uma reunião de 150 minutos convencional. Ela é um ${duracaoNome}.
  - Data de Início: ${dataInicio}
  - Data de Fim: ${dataFim}
  - Períodos Ativos selecionados para incluir programação:
  ${dia1Str}${dia2Str}

  IMPORTANTE ESTRATÉGICO PARA HORÁRIOS (MATEMÁTICA DO TEMPO):
  Você é EXTREMAMENTE RIGOROSO com o tempo. Ignore a restrição de 150 minutos.
  Para CADA um dos períodos ativos listados acima, você DEVE gerar atividades que comecem EXATAMENTE na hora de Início e o bloco todo termine EXATAMENTE na hora de Fim daquele período.
  - A soma em minutos da "duracao" de TODAS as atividades de um período DEVE ser exatamente igual aos "MINUTOS" indicados para aquele período.
  - Ex: Se o "Almoço" exige 120 MINUTOS, indique uma ou mais atividades (ex: "Almoço" - 60 min, "Tempo Livre" - 60 min).
  - A primeira atividade do período SEGUINTE (ex: "Tarde") DEVE iniciar exatamente na "horaInicio" configurada para ela. Ela NÃO PODE iniciar antes.
  Organize as atividades de forma perfeitamente matemática.
  `;
  } else {
    longDurationDetails = `
  Ajuste o cronograma de 150 minutos para acomodar esta atividade.
  `;
  }

  let documentPrompt = "";
  if (uploadedDocument && uploadedDocument.text) {
    documentPrompt = `
  === DOCUMENTO ANEXADO PELO CHEFE (.doc / .docx / .pdf) ===
  Nome do Arquivo: "${uploadedDocument.filename}" (${(uploadedDocument.size / 1024).toFixed(1)} KB)
  
  CONTEÚDO COMPLETO EXTRAÍDO DO DOCUMENTO:
  """
  ${uploadedDocument.text}
  """

  DIRETRIZ OBRIGATÓRIA DE PLANEJAMENTO BASEADA NO DOCUMENTO:
  O chefe anexou este documento como base fundamental para o planejamento da atividade. Você DEVE fazer a leitura minuciosa de todo o conteúdo extraído acima.
  Estruture a temática da reunião, as dinâmicas práticas, jogos, histórias e momentos de instrução prioritariamente inspirados e fundamentados no material desse arquivo, integrando-o de forma harmoniosa com os objetivos de progressão do Lobinho (${caminho}, ${eixo}, ${bloco}) e a ambientação da Jângal.
  `;
  }

  const prompt = `
  Conceito/Tema da atividade: ${theme}
  Etapa de Progressão (Caminho): ${caminho}
  Eixo de Desenvolvimento: ${eixo}
  Bloco de Atividades: ${bloco}
  Velho Lobo Responsável Principal: ${velhoLobo}
  Lista de Velhos Lobos disponíveis na Alcateia (use APENAS estes): ${listaVelhosLobos}
  Biblioteca/Literatura base selecionada: ${biblioteca}
  
  Materiais de apoio da biblioteca completa:
  ${linksExtras}

  ${documentPrompt}
  ${specialActivityPrompt}
  ${longDurationDetails}

  O objetivo da atividade é focar no sistema de progressão pessoal dos lobinhos para ajudá-los a conquistar seus emblemas e distintivos dentro deste Eixo e Bloco (ou envolvendo todas as áreas, caso 'Todos' tenha sido selecionado). 
  
  Você pode ou não incluir discretamente elementos gerais da Jângal (já que estão na Alcateia), mas o foco principal DEVE estar em cumprir os objetivos da progressão correspondente ao Caminho, Eixo e Bloco selecionados, também utilizando o conteúdo da Biblioteca sugerida (${biblioteca}) onde for possível.
  
  REGRAS ESPECÍFICAS:
  1. O velho lobo principal escolhido (${velhoLobo}) DEVE ser responsável pelo "Quebra Gelo e Canção", que deve ser a atividade realizada logo após a cerimônia de IBOGU da abertura (se for atividade normal de 150 min, ou no início do primeiro dia se for Bivaque/Acampamento).
  2. Este mesmo velho lobo (${velhoLobo}) TAMBÉM DEVE ser responsável por pelo menos mais uma atividade principal no decorrer do planejamento, podendo realizá-la sozinho ou de forma compartilhada com outro velho lobo.
  3. Explore o fato de estarmos usando a literatura: ${biblioteca}.
  4. DETALHAMENTO COMPLETO E DIDÁTICO PARA LEIGOS (ESTILO CADERNO DO ESCOTISTA):
     A descrição de CADA atividade deve ser um roteiro autossuficiente e minucioso passo a passo (preparação prévia, como explicar de forma lúdica às crianças, regras do jogo ou dinâmica, condução e finalização pedagógica), de modo que QUALQUER LEIGO ou voluntário consiga aplicar a atividade sem nenhuma dificuldade.
  5. PLANO B OBRIGATÓRIO (EM CASO DE CHUVA / ESPAÇO COBERTO):
     No campo 'planoB' de cada atividade, detalhe um plano alternativo para caso de chuva ou intempérie, indicando como realizar a atividade em ambiente coberto ou fechado com os devidos cuidados.
  6. CONTEXTO DO DOCUMENTO E TEMA LIVRE:
     Se houver texto no tema livre ou documento anexado, absorva minuciosamente todo o seu conteúdo, incluindo histórias, ensinamentos, termos, técnicas e detalhes nas atividades.

  Crie o plano de atividades detalhado em JSON, mantendo a estrutura exigida.`;

  try {
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        theme,
        caminho,
        eixo,
        bloco,
        velhoLobo,
        biblioteca,
        velhosLobos,
        specialActivity,
        tipoDuracao,
        dataInicio,
        dataFim,
        periodosDia1,
        periodosDia2,
        uploadedDocText: uploadedDocument?.text || ""
      })
    });

    const data = await parseServerResponse<ActivityPlan>(response);
    return data;
  } catch (error: any) {
    console.error("Erro ao gerar plano:", error);
    throw error;
  }
}
