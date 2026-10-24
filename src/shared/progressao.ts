// Sistema de Progressão Pessoal do Ramo Lobinho (UEB): Caminhos, Eixos e Blocos.

export const CAMINHOS = [
  'Todos',
  'Caminho do Integrar (Lobo Pata Tenra)',
  'Caminho do Descobrir (Lobo Saltador)',
  'Caminho do Rastrear (Lobo Rastreador)',
  'Caminho do Caçar (Lobo Caçador)',
  'Caminho das Estrelas (Cruzeiro do Sul)',
];

export const EIXOS_E_BLOCOS: Record<string, string[]> = {
  Todos: ['Todos'],
  'Habilidades para a Vida': [
    'Todos',
    'Aprendizagem Contínua e Desenvolvimento Vocacional',
    'Autonomia e Liderança',
    'Criatividade e Inovação',
    'Inteligência Emocional',
  ],
  'Meio Ambiente': ['Todos', 'Consumo Responsável', 'Mudanças Climáticas', 'Preservação da Biodiversidade', 'Vida ao Ar Livre'],
  'Paz e Desenvolvimento': ['Todos', 'Comunidade', 'Democracia', 'Herança Cultural', 'Promoção da Paz', 'Valores'],
  'Saúde e Bem-Estar': ['Todos', 'Cuidado com o Corpo', 'Espiritualidade', 'Hábitos Saudáveis', 'Saúde Mental', 'Vínculos Saudáveis'],
};

export const VELHOS_LOBOS_PADRAO = ['Akelá', 'Bagheera', 'Baloo', 'Chill', 'Hathi', 'Ikki', 'Kaa'];

export const PERIODOS_PADRAO = [
  { chave: 'cafeManha', rotulo: 'Café da manhã', inicio: '07:00', fim: '08:00' },
  { chave: 'manha', rotulo: 'Manhã', inicio: '08:00', fim: '12:00' },
  { chave: 'almoco', rotulo: 'Almoço', inicio: '12:00', fim: '14:00' },
  { chave: 'tarde', rotulo: 'Tarde', inicio: '14:00', fim: '16:00' },
  { chave: 'cafeTarde', rotulo: 'Café da tarde', inicio: '16:00', fim: '16:30' },
  { chave: 'janta', rotulo: 'Janta', inicio: '19:00', fim: '20:00' },
  { chave: 'noite', rotulo: 'Noite', inicio: '20:00', fim: '22:00' },
];

export function minutosEntre(inicio: string, fim: string): number {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return diff;
}
