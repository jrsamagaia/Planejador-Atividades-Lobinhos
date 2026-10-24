// Monta as instruções para o Gemini a partir do formulário do chefe.
import { minutosEntre } from '../shared/progressao';
import type { ConteudoPlano, ParametrosPlano, TermoAjuste, TipoAtividade } from '../shared/types';

export const INSTRUCOES_SISTEMA = `Você é um Especialista Escoteiro e um Akelá muito experiente no Ramo Lobinho da UEB (União dos Escoteiros do Brasil).
Seu objetivo é ajudar Chefes a montar programações perfeitas, alinhadas ao Método Escoteiro (Aprender Fazendo; áreas de desenvolvimento Físico, Intelectual, Social, Afetivo, Espiritual e Caráter) e ao sistema de Progressão Pessoal (Caminhos, Eixos e Blocos).

TERMINOLOGIA (OBRIGATÓRIO)
- Use sempre "Roca de Conselho" (nunca "Rocha do Conselho").
- Use os termos atuais da UEB (Aprender Fazendo, Áreas de Desenvolvimento, Progressão Pessoal), mantendo o clima da Jângal.

HORÁRIOS (MATEMÁTICA DO TEMPO — SEJA RIGOROSO)
- Cada bloco/período começa exatamente na hora de início informada e termina exatamente na hora de fim.
- A soma das durações das atividades de cada bloco/período é exatamente igual aos minutos informados para ele.
- "horaInicio" no formato HH:MM, em sequência; "duracao" no formato "X min".
- Inclua pausas de hidratação (5 min) após jogos de grande movimento.

ESTRUTURA DE UMA REUNIÃO OU BLOCO ÚNICO
- Começa com a Abertura (Grande Uivo, IBOGU, inspeção, hasteamento).
- Logo depois, "Quebra-gelo e Canção" conduzido pelo Velho Lobo principal.
- Pelo menos um jogo de movimento (energia alta).
- A parte central trabalha fortemente o Caminho/Eixo/Bloco escolhido.
- Termina com o Encerramento (arriamento, IBOAGU, Grande Uivo final) nos últimos 15 minutos.

CONTEÚDO
- Atribua responsáveis usando APENAS a equipe de Velhos Lobos informada.
- O Velho Lobo principal conduz o Quebra-gelo e Canção e pelo menos mais uma atividade principal.
- "descricao": roteiro passo a passo no padrão do Caderno do Escotista (preparação prévia, como apresentar de forma lúdica, regras, condução com as matilhas, mediação e fechamento pedagógico), para que qualquer voluntário leigo consiga conduzir com segurança.
- "planoB": alternativa detalhada para chuva ou falta de espaço externo, sem perder o objetivo pedagógico.
- "fundoDeCena": como a atividade se liga à progressão escolhida e ao universo da Jângal (o que os chefes dizem às crianças).
- Se houver documentos anexados, leia-os com atenção e use as histórias, jogos, canções e técnicas deles para fundamentar a programação, citando de onde veio cada ideia quando fizer sentido.
- Escreva em português do Brasil.`;

/** Esquema de resposta: o Gemini devolve exatamente este JSON. */
export const ESQUEMA_RESPOSTA = {
  type: 'OBJECT',
  properties: {
    cicloPrograma: { type: 'STRING', description: 'Como as fases do Ciclo de Programa e a Roca de Conselho se aplicam a esta atividade.' },
    diferenciacaoEtaria: { type: 'STRING', description: 'Como adaptar para lobinhos de 6,5 anos (experimentação) e de 10,5 anos (liderança, autonomia, serviço).' },
    recursosMateriais: { type: 'STRING', description: 'Resumo de todo o material necessário.' },
    recursosHumanos: { type: 'STRING', description: 'Velhos Lobos necessários e o papel de cada um.' },
    atividades: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dia: { type: 'STRING', description: 'Ex.: "Dia 1 (sáb, 12/10)". Vazio em atividades de um só bloco.' },
          periodo: { type: 'STRING', description: 'Ex.: "Manhã". Vazio em atividades de um só bloco.' },
          horaInicio: { type: 'STRING' },
          duracao: { type: 'STRING' },
          tipo: { type: 'STRING', description: 'Cerimônia, Quebra-gelo, Jogo ativo, História, Jogo calmo, Atividade de progressão, Refeição, etc.' },
          nome: { type: 'STRING' },
          responsavel: { type: 'STRING' },
          material: { type: 'STRING' },
          areaDesenvolvimento: { type: 'STRING' },
          descricao: { type: 'STRING' },
          fundoDeCena: { type: 'STRING' },
          planoB: { type: 'STRING' },
        },
        required: ['horaInicio', 'duracao', 'tipo', 'nome', 'responsavel', 'material', 'areaDesenvolvimento', 'descricao', 'fundoDeCena', 'planoB'],
        propertyOrdering: ['dia', 'periodo', 'horaInicio', 'duracao', 'tipo', 'nome', 'responsavel', 'material', 'areaDesenvolvimento', 'descricao', 'fundoDeCena', 'planoB'],
      },
    },
  },
  required: ['cicloPrograma', 'diferenciacaoEtaria', 'recursosMateriais', 'recursosHumanos', 'atividades'],
  propertyOrdering: ['cicloPrograma', 'diferenciacaoEtaria', 'recursosMateriais', 'recursosHumanos', 'atividades'],
};

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function rotuloData(iso: string, somarDias = 0): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + somarDias);
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function montarPrompt(p: ParametrosPlano, tipo: TipoAtividade, documentos: string[], outrosTitulos: string[]): string {
  const linhas: string[] = [];
  linhas.push(`TIPO DE ATIVIDADE: ${tipo.nome}${tipo.descricao ? ` — ${tipo.descricao}` : ''}`);
  linhas.push(`NOME DA ATIVIDADE: ${p.titulo}`);
  linhas.push(`TEMA / IDEIA DO CHEFE:\n${p.tema}`);
  linhas.push('');
  linhas.push(`PROGRESSÃO — Caminho: ${p.caminho} · Eixo: ${p.eixo} · Bloco: ${p.bloco}`);
  linhas.push('O foco principal é avançar a progressão pessoal dos lobinhos nesse Caminho/Eixo/Bloco (ou de forma ampla, se "Todos").');
  linhas.push('');
  linhas.push(`VELHO LOBO PRINCIPAL: ${p.velhoLoboPrincipal}`);
  linhas.push(`EQUIPE DISPONÍVEL (use apenas estes): ${p.equipe.join(', ')}`);
  linhas.push('');

  if (tipo.modo === 'bloco') {
    const total = minutosEntre(p.horaInicio, p.horaFim);
    linhas.push(`DATA E HORÁRIO: ${rotuloData(p.dataInicio)}, das ${p.horaInicio} às ${p.horaFim} — EXATAMENTE ${total} minutos.`);
    linhas.push(`A primeira atividade começa às ${p.horaInicio} e o encerramento termina às ${p.horaFim}. Deixe "dia" e "periodo" vazios.`);
  } else {
    linhas.push(`DATAS: de ${rotuloData(p.dataInicio)} a ${rotuloData(p.dataFim)}.`);
    linhas.push('Programe cada período ativo abaixo. Preencha "dia" e "periodo" em todas as atividades. A abertura acontece no primeiro período do Dia 1 e o encerramento no último período do último dia.');
    p.periodosPorDia.forEach((periodos, i) => {
      const ativos = periodos.filter((x) => x.ativo);
      if (!ativos.length) return;
      linhas.push(`Dia ${i + 1} (${rotuloData(p.dataInicio, i)}):`);
      for (const per of ativos) {
        linhas.push(`  - ${per.rotulo}: ${per.inicio} às ${per.fim} — EXATAMENTE ${minutosEntre(per.inicio, per.fim)} minutos`);
      }
    });
  }

  if (p.atividadeEspecial?.descricao) {
    const a = p.atividadeEspecial;
    linhas.push('');
    linhas.push('ATIVIDADE ESPECIAL OBRIGATÓRIA (inclua exatamente assim, ajustando o restante em volta):');
    linhas.push(`  - ${a.descricao} · responsável: ${a.responsavel} · início: ${a.inicio} · duração: ${a.duracao} min`);
  }

  if (p.documento) {
    linhas.push('');
    linhas.push(`DOCUMENTO DO CHEFE "${p.documento.nome}" (use como base fundamental do planejamento):\n"""\n${p.documento.texto}\n"""`);
  }
  if (documentos.length) {
    linhas.push('');
    linhas.push(`DOCUMENTOS ANEXADOS (leia e use como base): ${documentos.join('; ')}`);
  }
  if (outrosTitulos.length) {
    linhas.push('');
    linhas.push(`Outros materiais que a Alcateia tem na biblioteca (pode sugerir consulta): ${outrosTitulos.join('; ')}`);
  }
  if (p.observacoes.trim()) {
    linhas.push('');
    linhas.push(`OBSERVAÇÕES DO CHEFE: ${p.observacoes.trim()}`);
  }
  linhas.push('');
  linhas.push('Monte o plano completo no formato JSON pedido.');
  return linhas.join('\n');
}

function escaparRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Aplica os termos de ajuste da seção (ex.: "Roca de Conselho" em vez de "Rocha do Conselho"). */
export function aplicarTermos(conteudo: ConteudoPlano, termos: TermoAjuste[]): ConteudoPlano {
  const validos = termos.filter((t) => t.usar.trim() && t.emVezDe.trim());
  if (!validos.length) return conteudo;
  const troca = (txt: string | undefined) =>
    validos.reduce((acc, t) => acc.replace(new RegExp(escaparRegex(t.emVezDe.trim()), 'gi'), t.usar.trim()), txt ?? '');
  return {
    cicloPrograma: troca(conteudo.cicloPrograma),
    diferenciacaoEtaria: troca(conteudo.diferenciacaoEtaria),
    recursosMateriais: troca(conteudo.recursosMateriais),
    recursosHumanos: troca(conteudo.recursosHumanos),
    atividades: conteudo.atividades.map((a) => ({
      ...a,
      tipo: troca(a.tipo),
      nome: troca(a.nome),
      responsavel: troca(a.responsavel),
      material: troca(a.material),
      areaDesenvolvimento: troca(a.areaDesenvolvimento),
      descricao: troca(a.descricao),
      fundoDeCena: troca(a.fundoDeCena),
      planoB: troca(a.planoB),
    })),
  };
}

/** Converte "15 min", "1h", "1h30", "90" em minutos. */
export function duracaoEmMinutos(d: string): number {
  const s = (d || '').toLowerCase().replace(/\s/g, '');
  const h = s.match(/(\d+)h(\d+)?/);
  if (h) return Number(h[1]) * 60 + Number(h[2] || 0);
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const t = (h * 60 + m + minutos) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Em atividades de bloco único, recalcula os horários a partir das durações (a IA às vezes erra a conta). */
export function normalizarHorarios(conteudo: ConteudoPlano, p: ParametrosPlano, tipo: TipoAtividade): ConteudoPlano {
  if (tipo.modo !== 'bloco') return conteudo;
  let hora = p.horaInicio;
  const atividades = conteudo.atividades.map((a) => {
    const atual = { ...a, horaInicio: hora, dia: '', periodo: '' };
    hora = somarMinutos(hora, duracaoEmMinutos(a.duracao));
    return atual;
  });
  return { ...conteudo, atividades };
}
