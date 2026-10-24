import React, { useState, useEffect } from 'react';
import { Download, Loader2, Map, BookOpen, Clock, Plus, Trash2, Library, Info, Upload, Settings, HeartHandshake, LogIn, LogOut, User as UserIcon, History, Edit3, ShieldAlert, Save, FileText, X, Eye, CheckCircle2, AlertCircle, Paperclip, CloudRain, Copy } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { generateActivityPlan, parseUploadedDocument } from './services/gemini';
import { exportToDocx } from './services/exportDocx';
import { ActivityPlan, SpecialActivity, AdjustmentTerm, UploadedDocument } from './types';
import { useAuth } from './components/FirebaseProvider';
import { getUserConfig, saveUserConfig, getActivitiesHistory, saveActivityToHistory, deleteActivityFromHistory, ActivityHistoryItem } from './services/persistence';
import { CompleteRegistration } from './components/CompleteRegistration';
import { AdminPanel } from './components/AdminPanel';
import { DrivePicker } from './components/DrivePicker';
import { getGrupo, getSecao, getGrupos } from './services/admin';
import { GrupoEscoteiro, Secao } from './types';

const getTableChunks = (atividades: any[]) => {
  const chunks: {act: any, originalIndex: number}[][] = [];
  let currentChunk: {act: any, originalIndex: number}[] = [];
  let currentWeight = 0;
  let capacity = 8; // Cabe perfeitamente na página 1 com cabeçalho compacto

  atividades.forEach((act, originalIndex) => {
    let weight = 1;
    if (act.material && act.material.length > 50) weight += 0.4;
    if (act.nome && act.nome.length > 50) weight += 0.4;
    
    if (currentWeight + weight > capacity && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [{act, originalIndex}];
      currentWeight = weight;
      capacity = 12; // Páginas seguintes não têm cabeçalho/metadados, cabem mais linhas
    } else {
      currentChunk.push({act, originalIndex});
      currentWeight += weight;
    }
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
};

const CAMINHOS = [
  "Todos",
  "Caminho do Integrar (Lobo Pata Tenra)",
  "Caminho do Descobrir (Lobo Saltador)",
  "Caminho do Rastrear (Lobo Rastreador)",
  "Caminho do Caçar (Lobo Caçador)",
  "Caminho das Estrelas (Cruzeiro do Sul)"
];

const EIXOS_E_BLOCOS: Record<string, string[]> = {
  "Todos": [
    "Todos"
  ],
  "Habilidades para a Vida": [
    "Todos",
    "Aprendizagem Contínua e Desenvolvimento Vocacional",
    "Autonomia e Liderança",
    "Criatividade e Inovação",
    "Inteligência Emocional"
  ],
  "Meio Ambiente": [
    "Todos",
    "Consumo Responsável",
    "Mudanças Climáticas",
    "Preservação da Biodiversidade",
    "Vida ao Ar Livre"
  ],
  "Paz e Desenvolvimento": [
    "Todos",
    "Comunidade",
    "Democracia",
    "Herança Cultural",
    "Promoção da Paz",
    "Valores"
  ],
  "Saúde e Bem-Estar": [
    "Todos",
    "Cuidado com o Corpo",
    "Espiritualidade",
    "Hábitos Saudáveis",
    "Saúde Mental",
    "Vínculos Saudáveis"
  ]
};

const VELHOS_LOBOS = [
  "Akelá",
  "Bagheera",
  "Baloo",
  "Chill",
  "Hathi",
  "Ikki",
  "Kaa"
];

export const BIBLIOTECA = [
  {
    category: "Geral",
    items: [
      { name: "Sem especificação (Geral)", url: "" }
    ],
    hidden: false
  },
  {
    category: "Cancioneiro",
    items: [
      { name: "80 Canções Escoteiras", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/80-Cancoes-Escoteiras.pdf" },
      { name: "Cancioneiro Alerta Para Cantar", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Cancioneiro-Alerta-Para-Cantar.pdf" }
    ],
    hidden: false
  },
  {
    category: "Histórias da Jângal",
    items: [
      { name: "Livro Da Jângal 1 - Os Irmãos De Mowglli", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-1-Os-Irmaos-De-Mowglli.pdf" },
      { name: "Livro Da Jângal 2 - Caçadas De Kaa", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-2-Cacadas-De-Kaa.pdf" },
      { name: "Livro Da Jângal 3 - Como Apareceu O Medo", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-3-Como-Apareceu-O-Medo.pdf" },
      { name: "Livro Da Jângal 4 - Tigre Tigre", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-4-Tigre-Tigre.pdf" },
      { name: "Livro Da Jângal 5 - Kotick a Foca Branca", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-5-Kotick-a-Foca-Branca.pdf" },
      { name: "Livro Da Jângal 6 - Avanço Da Jângal", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-6-Avanco-Da-Jangal.pdf" },
      { name: "Livro Da Jângal 7 - Embriagues Da Primavera", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-Da-Jangal-7-Embriagues-Da-Primavera.pdf" },
      { name: "O Livro da Jângal - Rudyard Kipling (1942)", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Livro-O-Livro-da-Jangal-Rudyard-Kipling-Edicao-1942.pdf" },
      { name: "História da Jângal - Clássicos Ilustrados", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Historia-da-Jangal-Classicos-Iustrados.pdf" },
      { name: "Interpretação Livro da Jângal", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Interpretacao-Livro-da-Jangal.pdf" },
      { name: "Revista do Baloo", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Revista-do-Baloo.pdf" }
    ],
    hidden: false
  },
  {
    category: "Organização da Alcateia",
    items: [
      { name: "100 ideias para reuniões de Alcateias", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/100-ideias-para-reunioes-de-Alcateias.pdf" },
      { name: "Competências e Rotas de Aprendizagem", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Competencias-e-Rotas-de-Aprendizagem-Ramo-Lobinho.pdf" },
      { name: "Organização Da Alcateia", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Organizacao-Da-Alcateia.pdf" },
      { name: "Primeiros Passos da Alcateia", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Primeiros-Passos-da-Alcateia.pdf" },
      { name: "Reuniões Especiais de Alcateias", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Reunioes-Especiais-de-Alcateias.pdf" }
    ],
    hidden: true
  },
  {
    category: "Progressão dos Lobinhos",
    items: [
      { name: "Primeiros Passos da Alcateia (Progressão)", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Primeiros-Passos-da-Alcateia.pdf" },
      { name: "A Alcateia Em Ação", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Ramo-Lobinho-A-Alcateia-Em-Acao.pdf" },
      { name: "Guia do Lobinho", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Guia-do-Lobinho.pdf" }
    ],
    hidden: true
  },
  {
    category: "Cozinha Mateira",
    items: [
      { name: "Comidas Mateiras", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Comidas-Mateiras.pdf" }
    ],
    hidden: true
  },
  {
    category: "Proposta Atividades para Lobinhos",
    items: [
      { name: "Proposta de atividade para lobinhos - Diretrizes UEB", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Proposta-de-atividade-para-lobinhos-Diretrizes-UEB.pdf" }
    ],
    hidden: true
  },
  {
    category: "Nós e Amarras",
    items: [
      { name: "O Grande Livro dos Nós", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Grande-Livro-dos-Nos.pdf" },
      { name: "Nós e Amarras - Ar Livre 01", url: "http://geleoesdeblumenau.com.br/wp-content/uploads/2026/05/Nos-e-Amarras-Ar-Livre-01.pdf" }
    ],
    hidden: false
  }
];

const DEFAULT_LOGO = "https://geleoesdeblumenau.com.br/wp-content/uploads/2023/05/logo-geleoes.png";
const DEFAULT_GROUP_NAME = "Leões de Blumenau";

const getProxiedLogoUrl = (url?: string) => {
  const target = url || DEFAULT_LOGO;
  if (target.startsWith('data:')) return target;
  try {
    const cleanUrl = target.trim();
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=160&h=160&fit=contain`;
  } catch (e) {
    return target;
  }
};

export default function App() {
  const { user, userData, isAdmin, loading: authLoading, signIn, logout, authError, clearAuthError, isSigningIn } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<"plan" | "settings" | "history" | "admin">("plan");
  
  // Dynamic Group & Section info for header branding
  const [userGrupo, setUserGrupo] = useState<GrupoEscoteiro | null>(null);
  const [userSecao, setUserSecao] = useState<Secao | null>(null);
  const [allGruposForAdmin, setAllGruposForAdmin] = useState<GrupoEscoteiro[]>([]);

  useEffect(() => {
    async function loadAllGrupos() {
      if (isAdmin && user) {
        try {
          const list = await getGrupos();
          setAllGruposForAdmin(list);
        } catch (e) {
          console.error("Error loading all groups for Admin:", e);
        }
      }
    }
    loadAllGrupos();
  }, [isAdmin, user]);

  useEffect(() => {
    async function loadGrupoAndSecao() {
      if (isAdmin) {
        setUserGrupo({
          id: 'Todos',
          nome: 'Todos',
          cnpj: '',
          endereco: '',
          email: '',
          telefone: '',
          logoUrl: 'https://www.escoteiros.org.br/wp-content/uploads/2020/07/logo-vertical-colorido.png',
          observacoes: '',
          corPrincipal: '#002F6C',
          corSecundaria: '#007A33'
        });
        setUserSecao({
          id: 'Todos',
          grupoId: 'Todos',
          nome: 'Todos'
        });
        return;
      }

      if (userData?.grupoId) {
        try {
          const g = await getGrupo(userData.grupoId);
          setUserGrupo(g);
        } catch (e) {
          console.error("Error loading user Grupo:", e);
        }
      } else {
        setUserGrupo(null);
      }

      if (userData?.secaoId) {
        try {
          const s = await getSecao(userData.secaoId);
          setUserSecao(s);
        } catch (e) {
          console.error("Error loading user Secao:", e);
        }
      } else {
        setUserSecao(null);
      }
    }
    loadGrupoAndSecao();
  }, [userData?.grupoId, userData?.secaoId, isAdmin]);
  
  const [theme, setTheme] = useState("");
  const [nomeAtividade, setNomeAtividade] = useState("");
  const [caminho, setCaminho] = useState(CAMINHOS[0]);
  const [eixo, setEixo] = useState(Object.keys(EIXOS_E_BLOCOS)[0]);
  const [bloco, setBloco] = useState(EIXOS_E_BLOCOS[Object.keys(EIXOS_E_BLOCOS)[0]][0]);
  
  // States
  const [velhosLobos, setVelhosLobos] = useState<string[]>(VELHOS_LOBOS);
  const [newVelhoLobo, setNewVelhoLobo] = useState("");
  const [velhoLobo, setVelhoLobo] = useState(VELHOS_LOBOS[0]);
  const [libraryData, setLibraryData] = useState(BIBLIOTECA);
  const [biblioteca, setBiblioteca] = useState(BIBLIOTECA[0].items[0].name);
  const [adjustmentTerms, setAdjustmentTerms] = useState<AdjustmentTerm[]>([
    { use: "Roca de Conselho", insteadOf: "Rocha do Conselho" }
  ]);

  // Category Management State
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [newTerm, setNewTerm] = useState<AdjustmentTerm>({ use: "", insteadOf: "" });

  const [hasLoadedFromFirestore, setHasLoadedFromFirestore] = useState(false);

  // Load configuration from Firestore when user logs in
  useEffect(() => {
    async function loadConfig() {
      if (user) {
        setIsInitializing(true);
        setHasLoadedFromFirestore(false);
        // Safety timeout for config load: 4 seconds
        const timeout = setTimeout(() => {
          setIsInitializing(false);
          setHasLoadedFromFirestore(true);
        }, 4000);

        try {
          const config = await getUserConfig(user.uid);
          if (config) {
            clearTimeout(timeout);
            setVelhosLobos(config.velhosLobos);
            setAdjustmentTerms(config.adjustmentTerms);
            setLibraryData(config.libraryData);
            if (config.velhosLobos.length > 0) {
              setVelhoLobo(config.velhosLobos[0]);
            }
          }
          setHasLoadedFromFirestore(true);
        } catch (e: any) {
          console.warn("Notice loading config:", e?.message || e);
        } finally {
          clearTimeout(timeout);
          setIsInitializing(false);
        }
      } else {
        setIsInitializing(false);
        setHasLoadedFromFirestore(false);
      }
    }
    loadConfig();
  }, [user]);

  // Load history
  useEffect(() => {
    async function loadHistory() {
      if (user && userData && !isInitializing) {
        setIsLoadingHistory(true);
        try {
          const items = await getActivitiesHistory(user.uid, userData.grupoId, userData.secaoId, isAdmin);
          setHistoryItems(items);
        } catch (e: any) {
          console.warn("Notice loading history:", e?.message || e);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    }
    loadHistory();
  }, [user, userData, isInitializing, isAdmin]);

  // Sync with Firestore (Debounced or on change)
  useEffect(() => {
    if (user && !isInitializing && hasLoadedFromFirestore) {
      const config = {
        velhosLobos,
        adjustmentTerms,
        libraryData
      };
      // For simplicity in this demo, we save on every change
      // In a real app, you might want to debounce this
      saveUserConfig(user.uid, config).catch(err => console.warn("Sync notice:", err?.message || err));
    }
  }, [velhosLobos, adjustmentTerms, libraryData, user, isInitializing, hasLoadedFromFirestore]);

  // Special Activity State
  const [hasSpecialActivity, setHasSpecialActivity] = useState(false);
  const [specialActivityDetails, setSpecialActivityDetails] = useState<SpecialActivity>({
    type: "hasteamento geral",
    responsible: velhosLobos[0],
    startTime: "14:30",
    duration: 15
  });

  // Library Management State
  const [newLibraryItem, setNewLibraryItem] = useState({ category: "Geral", name: "", url: "" });

  const getNextSaturday = () => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilNextSaturday = day === 6 ? 7 : 6 - day;
    d.setDate(d.getDate() + daysUntilNextSaturday);
    return d.toISOString().split('T')[0];
  };

  const [date, setDate] = useState(getNextSaturday());
  const [tipoDuracao, setTipoDuracao] = useState<'normal' | 'bivaque' | 'acampamento'>('normal');
  const [dataInicio, setDataInicio] = useState(getNextSaturday());
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(getNextSaturday());
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [periodosDia1, setPeriodosDia1] = useState({
    cafeManha: { ativo: true, horaInicio: "07:00", horaFim: "08:00" },
    manha: { ativo: true, horaInicio: "08:00", horaFim: "12:00" },
    almoco: { ativo: true, horaInicio: "12:00", horaFim: "14:00" },
    tarde: { ativo: true, horaInicio: "14:00", horaFim: "16:00" },
    cafeTarde: { ativo: true, horaInicio: "16:00", horaFim: "16:30" },
    janta: { ativo: true, horaInicio: "19:00", horaFim: "20:00" },
    noite: { ativo: true, horaInicio: "20:00", horaFim: "22:00" }
  });
  const [periodosDia2, setPeriodosDia2] = useState({
    cafeManha: { ativo: true, horaInicio: "07:00", horaFim: "08:00" },
    manha: { ativo: true, horaInicio: "08:00", horaFim: "12:00" },
    almoco: { ativo: true, horaInicio: "12:00", horaFim: "14:00" },
    tarde: { ativo: true, horaInicio: "14:00", horaFim: "16:00" },
    cafeTarde: { ativo: true, horaInicio: "16:00", horaFim: "16:30" },
    janta: { ativo: false, horaInicio: "19:00", horaFim: "20:00" },
    noite: { ativo: false, horaInicio: "20:00", horaFim: "22:00" }
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<ActivityPlan | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [error, setError] = useState("");
  const [historyItems, setHistoryItems] = useState<ActivityHistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editedTheme, setEditedTheme] = useState("");
  const [editedDate, setEditedDate] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyToDelete, setHistoryToDelete] = useState<{id: string, isGrupo: boolean} | null>(null);

  // States for Document Upload (.doc, .docx, .pdf)
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const cleanTextSnippet = (txt: string) => {
    if (!txt) return "";
    let s = txt;
    // Fix Latin1 mojibake if detected (e.g. UniÃ£o -> União)
    try {
      if (/Ã[¡-º\s]|â€|Â/g.test(s)) {
        s = decodeURIComponent(escape(s));
      }
    } catch {}

    s = s.replace(/^\uFEFF/, "").replace(/^ï»¿/, "");
    
    // Remove scripts, styles, XML and HTML tags
    s = s.replace(/<style[\s\S]*?<\/style>/gi, " ")
         .replace(/<script[\s\S]*?<\/script>/gi, " ")
         .replace(/<xml[\s\S]*?<\/xml>/gi, " ")
         .replace(/<head[\s\S]*?<\/head>/gi, " ")
         .replace(/<(?:br|p|div|tr|h[1-6]|li|blockquote)[\s\/>]/gi, "\n")
         .replace(/<[^>]+>/g, " ");

    // Remove orphaned style/attribute strings like style="..." or class="..." >
    s = s.replace(/(?:style|class|id|align|color|width|height|valign|bgcolor)="[^"]*">?/gi, " ");
    s = s.replace(/^[a-zA-Z0-9_\-:]+="[^"]*">?/gm, " ");
    s = s.replace(/[a-zA-Z0-9_\-:]+="[^"]*">/g, " ");

    // Decode HTML entities
    s = s.replace(/&nbsp;/g, " ")
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

    s = s.replace(/^[>\s"']+/gm, "");

    return s.replace(/[ \t]+/g, " ").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  const handleProcessFile = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!['.doc', '.docx', '.pdf'].includes(ext)) {
      setUploadDocError("Formato não suportado. Por favor envie arquivos nos formatos .doc, .docx ou .pdf");
      return;
    }
    setUploadDocError(null);
    setIsUploadingDoc(true);
    try {
      const parsed = await parseUploadedDocument(file);
      // Lê o conteúdo completo, limpa resquícios HTML/BOM/encoding e cola no campo Conceito/Tema Livre
      const extractedContent = cleanTextSnippet(parsed.text || "");
      setUploadedDoc({ ...parsed, text: extractedContent });
      setTheme(extractedContent);

      // Auto-preenche o nome da atividade com base no arquivo caso esteja vazio
      if (!nomeAtividade.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setNomeAtividade(cleanName);
      }
    } catch (err: any) {
      setUploadDocError(err.message || "Erro ao ler o documento");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const applyAdjustments = (text: string) => {
    let result = text;
    adjustmentTerms.forEach(term => {
      if (term.use && term.insteadOf) {
        const regex = new RegExp(term.insteadOf, 'gi');
        result = result.replace(regex, term.use);
      }
    });
    return result;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const isLong = tipoDuracao && tipoDuracao !== 'normal';
    const effectiveTheme = theme.trim() || (uploadedDoc ? uploadedDoc.text.trim() : "");
    if (!nomeAtividade || !effectiveTheme || (!isLong && !date) || (isLong && (!dataInicio || !dataFim))) {
      setError("Por favor, preencha o nome da atividade, o tema (ou anexe um documento base) e as datas necessárias.");
      return;
    }
    setError("");
    setIsLoading(true);
    setPlan(null);
    try {
      const spActivity = hasSpecialActivity ? specialActivityDetails : undefined;
      let generatedPlan = await generateActivityPlan(
        effectiveTheme, 
        caminho, 
        eixo, 
        bloco, 
        velhoLobo, 
        biblioteca, 
        libraryData, 
        velhosLobos, 
        spActivity,
        tipoDuracao,
        dataInicio,
        dataFim,
        periodosDia1,
        periodosDia2,
        uploadedDoc
      );
      
      // Apply adjustments to the generated text
      generatedPlan = {
        ...generatedPlan,
        cicloPrograma: applyAdjustments(generatedPlan.cicloPrograma),
        diferenciacaoEtaria: applyAdjustments(generatedPlan.diferenciacaoEtaria),
        recursosMateriais: applyAdjustments(generatedPlan.recursosMateriais),
        recursosHumanos: applyAdjustments(generatedPlan.recursosHumanos),
        atividades: generatedPlan.atividades.map(act => ({
          ...act,
          tipo: applyAdjustments(act.tipo),
          nome: applyAdjustments(act.nome),
          responsavel: applyAdjustments(act.responsavel),
          material: applyAdjustments(act.material),
          areaDesenvolvimento: applyAdjustments(act.areaDesenvolvimento),
          descricao: applyAdjustments(act.descricao),
          fundoDeCena: applyAdjustments(act.fundoDeCena),
          planoB: act.planoB ? applyAdjustments(act.planoB) : undefined
        }))
      };

      setPlan(generatedPlan);

      // Save to history if logged in
      if (user) {
        const item: Omit<ActivityHistoryItem, 'id' | 'createdAt'> & { tipoDuracao?: string; dataInicio?: string; dataFim?: string; periodosDia1?: any; periodosDia2?: any } = {
          theme,
          nomeAtividade,
          responsavel: velhoLobo,
          dataAplicacao: tipoDuracao === 'normal' ? date : `${dataInicio} - ${dataFim}`,
          date: new Date().toISOString(),
          plan: generatedPlan,
          grupoId: userData?.grupoId,
          secaoId: userData?.secaoId,
          tipoDuracao,
          dataInicio,
          dataFim,
          periodosDia1,
          periodosDia2
        };
        const id = await saveActivityToHistory(user.uid, item);
        setHistoryItems(prev => [{ ...item, id, createdAt: new Date() }, ...prev]);
        setCurrentHistoryId(id);
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportDocx = () => {
    if (plan) {
      if (isEditingPlan) setIsEditingPlan(false);
      const dataLabel = tipoDuracao === 'normal'
        ? parseDate(date)
        : `${parseDate(dataInicio)} a ${parseDate(dataFim)}`;
      exportToDocx(plan, dataLabel, nomeAtividade || theme, `${caminho} - ${eixo} / ${bloco}`);
    }
  };

  const [isSavingActivity, setIsSavingActivity] = useState(false);

  const handleSaveActivity = async () => {
    if (!plan) return;
    if (!user) {
      alert("Você precisa estar autenticado para salvar.");
      return;
    }
    
    if (isEditingPlan) setIsEditingPlan(false);
    
    setIsSavingActivity(true);
    setError("");
    try {
      const item: Omit<ActivityHistoryItem, 'id' | 'createdAt'> & { tipoDuracao?: string; dataInicio?: string; dataFim?: string; periodosDia1?: any; periodosDia2?: any } = {
        theme,
        nomeAtividade,
        responsavel: velhoLobo,
        dataAplicacao: tipoDuracao === 'normal' ? date : `${dataInicio} - ${dataFim}`,
        date: new Date().toISOString(),
        plan,
        grupoId: userData?.grupoId,
        secaoId: userData?.secaoId,
        tipoDuracao,
        dataInicio,
        dataFim,
        periodosDia1,
        periodosDia2
      };
      
      const id = await saveActivityToHistory(user.uid, item, currentHistoryId || undefined);
      
      setHistoryItems(prev => {
        const existingIndex = prev.findIndex(i => i.id === id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...item, id, createdAt: prev[existingIndex].createdAt || new Date() };
          return updated;
        } else {
          return [{ ...item, id, createdAt: new Date() }, ...prev];
        }
      });
      
      setCurrentHistoryId(id);
      alert("Atividade salva com sucesso!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao salvar atividade.");
    } finally {
      setIsSavingActivity(false);
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('document-to-print');
    if (!element) return;

    if (isEditingPlan) {
      setIsEditingPlan(false);
      // Wait for React to re-render in read mode
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsGeneratingPDF(true);
    try {
      const dateLabel = tipoDuracao === 'normal'
        ? parseDate(date).replace(/\//g, '-')
        : `${parseDate(dataInicio).replace(/\//g, '-')}_a_${parseDate(dataFim).replace(/\//g, '-')}`;
      const opt = {
        margin:       [12, 12, 12, 12] as [number, number, number, number],
        filename:     `Atividade_Lobinho_${dateLabel}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          allowTaint: true,
          letterRendering: true,
          logging: false,
          windowWidth: 800
        },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak:    { mode: ['css' as const, 'legacy' as const], avoid: ['tr', '.pdf-avoid-break', 'h2', 'h3'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Error:', err);
      alert('Houve um problema ao gerar o PDF. Verifique se o seu navegador permite downloads automáticos. Erro: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const parseDate = (d: string) => {
    if (!d) return "";
    if (d.includes('-') && !d.includes('T')) {
      const parts = d.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return new Date(d).toLocaleDateString('pt-BR');
  };

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#007A33] mx-auto" />
          <p className="text-neutral-600 font-medium font-sans">Carregando a Jângal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002F6C] to-[#007A33] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center space-y-8 select-none">
          <div className="flex flex-col items-center">
            <img 
              src="https://www.escoteiros.org.br/wp-content/uploads/2020/07/logo-vertical-colorido.png" 
              alt="Logo Escoteiros do Brasil" 
              className="h-32 w-auto mb-6 object-contain" 
            />
            <h1 className="text-3xl font-bold text-[#002F6C]">Planner da Jângal</h1>
            <p className="text-neutral-500 mt-2 font-medium">Gerador de Programação para o Ramo Lobinho</p>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              Para salvar suas configurações e acessá-las de qualquer dispositivo, faça login com sua conta do Google.
            </p>
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-left flex items-start gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 leading-tight">{authError}</div>
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="text-red-400 hover:text-red-700 text-xs font-bold px-1"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
            )}
            <button 
              onClick={() => signIn()}
              disabled={isSigningIn}
              className="w-full bg-[#007A33] hover:bg-[#005E27] text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Conectando com Google...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar com Google
                </>
              )}
            </button>
          </div>

          <div className="pt-4 border-t border-neutral-100 italic text-[10px] text-neutral-400">
            "O lobo caminha com todos, mas sua mente é livre."
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return <CompleteRegistration />;
  }

  if (userData.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002F6C] to-[#007A33] flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
          <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800">Aprovação Pendente</h2>
          <p className="text-neutral-600 mt-2">O seu cadastro está aguardando a aprovação de um Administrador. Volte em breve!</p>
          <button onClick={() => logout()} className="mt-8 text-sm text-neutral-500 hover:text-neutral-800 underline cursor-pointer font-medium transition-colors">Voltar para o login</button>
        </div>
      </div>
    );
  }

  if (userData.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002F6C] to-[#007A33] flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800">Acesso Negado</h2>
          <p className="text-neutral-600 mt-2">O seu acesso foi reprovado por um Administrador.</p>
          <button onClick={() => logout()} className="mt-8 text-sm text-neutral-500 hover:text-neutral-800 underline cursor-pointer font-medium transition-colors">Voltar para o login</button>
        </div>
      </div>
    );
  }

  // Dynamic colors based on the logged-in user's group logo/brand colors
  const primaryColor = userGrupo?.corPrincipal || '#013B88';
  const secondaryColor = userGrupo?.corSecundaria || '#eab308';

  // Quick light/dark color modification helper block
  const getHoverColor = (hex: string) => {
    try {
      let color = hex.replace('#', '');
      let r = parseInt(color.substring(0, 2), 16);
      let g = parseInt(color.substring(2, 4), 16);
      let b = parseInt(color.substring(4, 6), 16);
      
      r = Math.max(0, Math.floor(r * 0.85));
      g = Math.max(0, Math.floor(g * 0.85));
      b = Math.max(0, Math.floor(b * 0.85));
      
      const rs = r.toString(16).padStart(2, '0');
      const gs = g.toString(16).padStart(2, '0');
      const bs = b.toString(16).padStart(2, '0');
      return `#${rs}${gs}${bs}`;
    } catch (e) {
      return '#012d6a';
    }
  };
  const primaryHoverColor = getHoverColor(primaryColor);

  const renderPeriodosConfig = (
    label: string, 
    periodosObj: typeof periodosDia1, 
    setter: React.Dispatch<React.SetStateAction<typeof periodosDia1>>
  ) => (
    <div className="space-y-2.5 mt-4">
      <label className="block text-xs font-bold text-neutral-700">{label}</label>
      <div className="space-y-2">
        {(['cafeManha', 'manha', 'almoco', 'tarde', 'cafeTarde', 'janta', 'noite'] as const).map(pKey => {
          const pLabel = pKey === 'cafeManha' ? 'Café da Manhã' 
                       : pKey === 'manha' ? 'Manhã' 
                       : pKey === 'almoco' ? 'Almoço' 
                       : pKey === 'tarde' ? 'Tarde' 
                       : pKey === 'cafeTarde' ? 'Café da Tarde' 
                       : pKey === 'janta' ? 'Janta' 
                       : 'Noite';
          return (
            <div key={pKey} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white/80 rounded border border-neutral-200">
              <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer font-semibold select-none min-w-[70px]">
                <input 
                  type="checkbox" 
                  checked={periodosObj[pKey].ativo} 
                  onChange={(e) => setter({
                    ...periodosObj,
                    [pKey]: { ...periodosObj[pKey], ativo: e.target.checked }
                  })}
                  className="rounded text-[#013B88] focus:ring-[#013B88]"
                />
                {pLabel}
              </label>
              {periodosObj[pKey].ativo && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-1 duration-150 ml-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-semibold">Hora de Início:</span>
                    <input 
                      type="time" 
                      value={periodosObj[pKey].horaInicio} 
                      onChange={(e) => setter({
                        ...periodosObj,
                        [pKey]: { ...periodosObj[pKey], horaInicio: e.target.value }
                      })}
                      className="rounded border border-neutral-300 p-1 text-xs outline-none w-20 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-semibold">Hora de Fim:</span>
                    <input 
                      type="time" 
                      value={periodosObj[pKey].horaFim || ""} 
                      onChange={(e) => setter({
                        ...periodosObj,
                        [pKey]: { ...periodosObj[pKey], horaFim: e.target.value }
                      })}
                      className="rounded border border-neutral-300 p-1 text-xs outline-none w-20 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --theme-primary: ${primaryColor};
          --theme-primary-hover: ${primaryHoverColor};
          --theme-secondary: ${secondaryColor};
        }
        /* Dynamic style customization for registered groups */
        .bg-\\[\\#013B88\\] {
          background-color: var(--theme-primary) !important;
        }
        .text-\\[\\#013B88\\] {
          color: var(--theme-primary) !important;
        }
        .border-\\[\\#013B88\\] {
          border-color: var(--theme-primary) !important;
        }
        .focus\\:ring-\\[\\#013B88\\]:focus {
          --tw-ring-color: var(--theme-primary) !important;
          border-color: var(--theme-primary) !important;
        }
        .focus\\:border-\\[\\#013B88\\]:focus {
          border-color: var(--theme-primary) !important;
        }
        .hover\\:bg-\\[\\#013B88\\]\\/90:hover {
          background-color: var(--theme-primary-hover) !important;
        }
        .hover\\:bg-blue-800:hover {
          background-color: var(--theme-primary-hover) !important;
        }
        .text-blue-100 {
          color: #ffffff !important;
          opacity: 0.95 !important;
        }
        .text-blue-200 {
          color: var(--theme-secondary) !important;
          opacity: 0.95 !important;
        }
      ` }} />
      <header className="bg-[#013B88] text-white shadow-md shrink-0 print:hidden py-[25px]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <img 
              src={userGrupo?.logoUrl || "https://geleoesdeblumenau.com.br/wp-content/uploads/2023/05/logo-geleoes.png"} 
              alt={userGrupo?.nome || "Logo Leões de Blumenau"} 
              className="h-8 object-contain" 
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_LOGO;
              }}
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Planner da Jângal</h1>
              {userGrupo?.nome && <p className="text-[10px] text-blue-200 font-medium tracking-wider -mt-1">{userGrupo.nome}</p>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={() => setActiveTab("plan")}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all duration-150 flex items-center gap-2 border-2 ${activeTab === 'plan' ? 'bg-white text-[#013B88] border-[#013B88] font-bold shadow-sm' : 'text-white hover:bg-white/10 border-transparent hover:text-white'}`}
              >
                <Map className="w-4 h-4" /> Planejar Atividade
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all duration-150 flex items-center gap-2 border-2 ${activeTab === 'history' ? 'bg-white text-[#013B88] border-[#013B88] font-bold shadow-sm' : 'text-white hover:bg-white/10 border-transparent hover:text-white'}`}
              >
                <History className="w-4 h-4" /> <span className="hover:text-white">Histórico</span>
              </button>
              <button 
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all duration-150 flex items-center gap-2 border-2 ${activeTab === 'settings' ? 'bg-white text-[#013B88] border-[#013B88] font-bold shadow-sm' : 'text-white hover:bg-white/10 border-transparent hover:text-white'}`}
              >
                <Settings className="w-4 h-4" /> Configurações
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab("admin")}
                  className={`px-4 py-1.5 rounded-xl font-medium transition-all duration-150 flex items-center gap-2 border-2 ${activeTab === 'admin' ? 'bg-white text-[#013B88] border-[#013B88] font-bold shadow-sm' : 'text-white hover:bg-white/10 border-transparent hover:text-white'}`}
                >
                  <ShieldAlert className="w-4 h-4" /> Área do Admin
                </button>
              )}
            </div>
            
            <div className="hidden sm:flex items-center gap-3 pb-2 border-b border-white/10 sm:border-none">
              <div className="flex items-center gap-2 text-xs text-blue-100">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <span className="max-w-[100px] truncate">{user.displayName || user.email}</span>
              </div>
              <button 
                onClick={() => logout()}
                className="text-blue-200 hover:text-white transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full overflow-hidden">
        {activeTab === "plan" && (
          <>
            {/* Sidebar Form */}
            <aside className="w-full lg:w-1/3 p-6 bg-white border-r border-neutral-200 shrink-0 print:hidden overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4 text-[#013B88] flex items-center gap-2">
                <Map className="w-5 h-5" /> Planejar Atividade
              </h2>
              <form onSubmit={handleGenerate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Nome da Atividade
                  </label>
                  <input 
                    type="text"
                    value={nomeAtividade}
                    onChange={(e) => setNomeAtividade(e.target.value)}
                    placeholder="Ex: Planejamento Atividade 12/06/2026 ou Planejamento Atividade Dia do Lobinho - 03/10/2026"
                    className="w-full rounded-md border border-neutral-300 p-2 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none"
                    required
                  />
                </div>

                {tipoDuracao === 'normal' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Data da Atividade</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 p-2 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Velho Lobo Responsável</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <select 
                      value={velhoLobo}
                      onChange={(e) => setVelhoLobo(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 p-2 pl-9 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none appearance-none"
                    >
                      {velhosLobos.map(vl => <option key={vl} value={vl}>{vl}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Biblioteca</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <select 
                      value={biblioteca}
                      onChange={(e) => setBiblioteca(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 p-2 pl-9 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none appearance-none"
                    >
                      {libraryData.filter(cat => !cat.hidden).map(cat => (
                        <optgroup key={cat.category} label={cat.category}>
                          {cat.items.map(item => (
                            <option key={item.name} value={item.name}>{item.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {libraryData.flatMap(cat => cat.items).filter(i => i.name === biblioteca && i.url).map(item => (
                    <div key={item.name} className="mt-2 text-right">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 underline">
                        Abrir arquivo PDF publicamente
                      </a>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[#013B88] flex items-center gap-2">
                      <Info className="w-4 h-4" /> Atividade Especial?
                    </label>
                    <button
                      type="button"
                      onClick={() => setHasSpecialActivity(!hasSpecialActivity)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${hasSpecialActivity ? 'bg-[#013B88]' : 'bg-neutral-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasSpecialActivity ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {hasSpecialActivity && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Qual atividade?</label>
                        <div className="space-y-2">
                          <select 
                            value={specialActivityDetails.type}
                            onChange={(e) => setSpecialActivityDetails({...specialActivityDetails, type: e.target.value})}
                            className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none"
                          >
                            <option value="hasteamento geral">Hasteamento Geral</option>
                            <option value="promessa">Promessa</option>
                            <option value="aniversário">Aniversário</option>
                            <option value="entrega de distintivo">Entrega de Distintivo</option>
                            <option value="outra">Outra</option>
                          </select>
                          
                          {specialActivityDetails.type === 'outra' && (
                            <input 
                              type="text" 
                              value={specialActivityDetails.customType || ""}
                              onChange={(e) => setSpecialActivityDetails({...specialActivityDetails, customType: e.target.value})}
                              placeholder="Descreva a atividade especial"
                              className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none bg-white animate-in zoom-in-95 duration-200"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Velho Lobo Responsável</label>
                        <select 
                          value={specialActivityDetails.responsible}
                          onChange={(e) => setSpecialActivityDetails({...specialActivityDetails, responsible: e.target.value})}
                          className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none"
                        >
                          {velhosLobos.map(vl => <option key={vl} value={vl}>{vl}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Início</label>
                          <input 
                            type="time" 
                            value={specialActivityDetails.startTime}
                            onChange={(e) => setSpecialActivityDetails({...specialActivityDetails, startTime: e.target.value})}
                            className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Duração (min)</label>
                          <input 
                            type="number" 
                            value={specialActivityDetails.duration}
                            onChange={(e) => setSpecialActivityDetails({...specialActivityDetails, duration: parseInt(e.target.value) || 0})}
                            className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Radio Button para Atividade de Longa Duração */}
                <div className="bg-blue-50/30 p-4 rounded-lg border border-blue-100 space-y-4">
                  <label className="block text-sm font-semibold text-[#013B88]">Duração da Atividade</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer select-none">
                      <input 
                        type="radio" 
                        name="tipoDuracao" 
                        value="normal" 
                        checked={tipoDuracao === 'normal'} 
                        onChange={() => setTipoDuracao('normal')}
                        className="text-[#013B88] focus:ring-[#013B88]"
                      />
                      Normal (150 min)
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer select-none">
                      <input 
                        type="radio" 
                        name="tipoDuracao" 
                        value="bivaque" 
                        checked={tipoDuracao === 'bivaque'} 
                        onChange={() => setTipoDuracao('bivaque')}
                        className="text-[#013B88] focus:ring-[#013B88]"
                      />
                      Bivaque (1 dia)
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer select-none">
                      <input 
                        type="radio" 
                        name="tipoDuracao" 
                        value="acampamento" 
                        checked={tipoDuracao === 'acampamento'} 
                        onChange={() => setTipoDuracao('acampamento')}
                        className="text-[#013B88] focus:ring-[#013B88]"
                      />
                      Acampamento (2 dias)
                    </label>
                  </div>

                  {tipoDuracao !== 'normal' && (
                    <div className="space-y-4 pt-2 border-t border-blue-100/50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 mb-1">Data de Início</label>
                          <input 
                            type="date" 
                            value={dataInicio} 
                            onChange={(e) => setDataInicio(e.target.value)}
                            className="w-full rounded-md border border-neutral-300 p-2 text-xs outline-none bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-600 mb-1">Data de Fim</label>
                          <input 
                            type="date" 
                            value={dataFim} 
                            onChange={(e) => setDataFim(e.target.value)}
                            className="w-full rounded-md border border-neutral-300 p-2 text-xs outline-none bg-white"
                            required
                          />
                        </div>
                      </div>

                      {renderPeriodosConfig(tipoDuracao === 'acampamento' ? "Dia 1 - Períodos Ativos e Horários" : "Períodos Ativos e Horários", periodosDia1, setPeriodosDia1)}
                      {tipoDuracao === 'acampamento' && renderPeriodosConfig("Dia 2 - Períodos Ativos e Horários", periodosDia2, setPeriodosDia2)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Caminho / Progressão</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <select 
                      value={caminho}
                      onChange={(e) => setCaminho(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 p-2 pl-9 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none appearance-none"
                    >
                      {CAMINHOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Eixo de Desenvolvimento</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <select 
                      value={eixo}
                      onChange={(e) => {
                        const newEixo = e.target.value;
                        setEixo(newEixo);
                        setBloco(EIXOS_E_BLOCOS[newEixo][0]);
                      }}
                      className="w-full rounded-md border border-neutral-300 p-2 pl-9 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none appearance-none"
                    >
                      {Object.keys(EIXOS_E_BLOCOS).map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Bloco de Atividades</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <select 
                      value={bloco}
                      onChange={(e) => setBloco(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 p-2 pl-9 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none appearance-none"
                    >
                      {EIXOS_E_BLOCOS[eixo].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-neutral-700">Conceito/Tema Livre</label>
                    {uploadedDoc && (
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Conteúdo do arquivo colado
                      </span>
                    )}
                  </div>
                  <textarea 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    rows={uploadedDoc ? 6 : 3}
                    placeholder={uploadedDoc ? "O conteúdo lido do documento foi colado aqui. Você pode editar, detalhar tópicos ou complementar..." : "Exige um pouco mais de cuidado? Trabalho em equipe? Nós ensinando o nó direito?"}
                    className="w-full rounded-md border border-neutral-300 p-2.5 focus:ring-2 focus:ring-[#013B88] focus:border-[#013B88] outline-none resize-y text-xs sm:text-sm leading-relaxed text-neutral-800 transition-all"
                    required={!uploadedDoc}
                  />
                  {theme && (
                    <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-500">
                      <span>
                        {theme.length.toLocaleString('pt-BR')} caracteres • {theme.trim().split(/\s+/).filter(Boolean).length} palavras
                      </span>
                      <div className="flex items-center gap-2.5">
                        {uploadedDoc && theme !== uploadedDoc.text.trim() && (
                          <button
                            type="button"
                            onClick={() => setTheme(uploadedDoc.text.trim())}
                            className="text-[#013B88] hover:underline font-medium cursor-pointer"
                            title="Restaurar o texto extraído original do arquivo"
                          >
                            Restaurar texto do arquivo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTheme('')}
                          className="text-neutral-400 hover:text-red-600 cursor-pointer"
                          title="Limpar texto do tema"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload de Documento (.doc, .docx, .pdf) */}
                <div id="document-upload-section" className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#013B88]" />
                      Anexar Documento (.doc, .docx, .pdf)
                    </label>
                    {uploadedDoc && (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Lido e colado no tema
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-2.5 leading-snug">
                    O aplicativo lê todo o texto do documento e cola no campo <strong>Conceito/Tema Livre</strong> para planejar cada atividade com riqueza de detalhes (Caderno do Escotista).
                  </p>

                  <input
                    id="doc-file-upload-input"
                    type="file"
                    accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleProcessFile(file);
                      }
                      e.target.value = '';
                    }}
                  />

                  {!uploadedDoc ? (
                    <div
                      id="doc-dropzone"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleProcessFile(file);
                      }}
                      onClick={() => !isUploadingDoc && document.getElementById('doc-file-upload-input')?.click()}
                      className={`border-2 border-dashed rounded-md p-3.5 text-center cursor-pointer transition-all ${
                        isDragOver 
                          ? 'border-[#013B88] bg-blue-50/80 shadow-inner' 
                          : 'border-neutral-300 hover:border-[#013B88] hover:bg-white bg-white/90'
                      }`}
                    >
                      {isUploadingDoc ? (
                        <div className="flex flex-col items-center py-2 text-[#013B88] gap-1.5">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-xs font-semibold">Lendo e extraindo conteúdo do arquivo...</span>
                          <span className="text-[10px] text-neutral-500">O texto completo será colado no campo acima</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-0.5 gap-1.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#013B88]">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-neutral-800 hover:text-[#013B88]">
                              Subir arquivo para leitura e colagem
                            </span>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              Clique para selecionar ou arraste para cá
                            </p>
                          </div>
                          <div className="flex gap-1 mt-1">
                            <span className="text-[10px] font-mono font-medium bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">.doc</span>
                            <span className="text-[10px] font-mono font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">.docx</span>
                            <span className="text-[10px] font-mono font-medium bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">.pdf</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white border border-neutral-200 rounded-md p-2.5 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                            uploadedDoc.filename.toLowerCase().endsWith('.pdf') 
                              ? 'bg-red-50 text-red-600 border border-red-200' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-neutral-800 truncate" title={uploadedDoc.filename}>
                              {uploadedDoc.filename}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              {(uploadedDoc.size / 1024).toFixed(1)} KB • {uploadedDoc.charCount.toLocaleString('pt-BR')} caracteres lidos
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          id="remove-uploaded-doc-btn"
                          onClick={() => setUploadedDoc(null)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors"
                          title="Remover arquivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-[11px]">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            id="view-doc-content-btn"
                            onClick={() => setShowDocPreview(true)}
                            className="text-[#013B88] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver texto extraído
                          </button>
                          <button
                            type="button"
                            id="repaste-doc-content-btn"
                            onClick={() => setTheme(uploadedDoc.text.trim())}
                            className="text-emerald-700 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                            title="Colar novamente o texto completo no campo Tema"
                          >
                            <Copy className="w-3 h-3" /> Colar no Tema
                          </button>
                        </div>
                        <button
                          type="button"
                          id="change-doc-btn"
                          onClick={() => document.getElementById('doc-file-upload-input')?.click()}
                          className="text-neutral-500 hover:text-neutral-800 hover:underline cursor-pointer"
                        >
                          Trocar arquivo
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadDocError && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                      <span>{uploadDocError}</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-800 text-xs sm:text-sm rounded-lg border border-red-200 flex items-start gap-2.5 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-900 mb-0.5">Aviso ao gerar planejamento:</p>
                      <p className="leading-relaxed whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isLoading || isUploadingDoc}
                  className="w-full bg-[#013B88] hover:bg-[#013B88]/90 text-white font-medium py-2.5 px-4 rounded-md transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                  {isLoading 
                    ? "Gerando Programação..." 
                    : tipoDuracao === 'normal' 
                      ? "Gerar Programação de 150 min" 
                      : tipoDuracao === 'bivaque' 
                        ? "Gerar Programação de Bivaque (1 dia)" 
                        : "Gerar Programação de Acampamento (2 dias)"
                  }
                </button>
              </form>

              <div className="mt-8 bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-800">
                <strong>Dica de Chefe:</strong> {tipoDuracao === 'normal' 
                  ? "A programação gerada segue a estrutura de 150 minutos (2h30). Revise cada detalhe e adapte com a realidade de sua seção!"
                  : `A programação gerada segue a estrutura de ${tipoDuracao === 'bivaque' ? 'Bivaque (1 dia)' : 'Acampamento (2 dias)'} com os períodos selecionados. Revise cada atividade e faça as adaptações com sua Alcateia!`
                }
              </div>
            </aside>

            {/* Content Area */}
            <section className="flex-1 p-6 relative w-full overflow-y-auto">
              {!plan && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-neutral-400 print:hidden">
                  <Map className="w-16 h-16 mb-4 opacity-20" />
                  <p>Preencha os dados e clique em gerar para ver a programação aqui.</p>
                </div>
              )}

              {isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-[#013B88] print:hidden space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin" />
                  <p className="font-medium animate-pulse">Consultando o Livro da Jângal...</p>
                </div>
              )}

              {plan && (
                <div className="max-w-4xl mx-auto bg-white print:p-0 print:shadow-none shadow-sm border border-neutral-200 rounded-lg p-3 sm:p-8">
                  
                  <div className="flex justify-end gap-3 mb-6 print:hidden border-b border-neutral-100 pb-4">
                    <button 
                      onClick={() => setIsEditingPlan(!isEditingPlan)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm border ${isEditingPlan ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border-neutral-300'}`}
                    >
                      <Edit3 className="w-4 h-4" /> {isEditingPlan ? "Modo Leitura" : "Editar na Tela"}
                    </button>
                    <button 
                      onClick={handleSaveActivity}
                      disabled={isSavingActivity}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400 rounded-md transition-colors font-medium text-sm"
                    >
                      {isSavingActivity ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Salvar
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleExportDocx}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors font-medium text-sm"
                    >
                      <Download className="w-4 h-4" /> DOCX
                    </button>
                    <button 
                      onClick={handleDownloadPDF}
                      disabled={isGeneratingPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-[#013B88] text-white hover:bg-blue-800 rounded-md transition-colors font-medium text-sm disabled:opacity-50"
                    >
                      {isGeneratingPDF ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" /> Baixar PDF
                        </>
                      )}
                    </button>
                  </div>

                  <div 
                    id="document-to-print" 
                    className="document-body text-[#171717] leading-relaxed bg-white"
                    style={{
                      fontFamily: 'Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      color: '#171717',
                      backgroundColor: '#ffffff',
                      width: '100%',
                      maxWidth: '800px',
                      margin: '0 auto',
                      padding: '20px 24px',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Header Table (table layout avoids flexbox collapse in html2canvas) */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginBottom: '20px' }}>
                      <tbody>
                        <tr>
                          <td style={{ verticalAlign: 'top', textAlign: 'left', border: 'none', padding: 0 }}>
                            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e3a8a', margin: '0 0 4px 0', lineHeight: 1.2, fontFamily: 'Arial, sans-serif' }}>Grupo Escoteiro</h1>
                            <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#1e40af', margin: '0 0 4px 0', lineHeight: 1.2, fontFamily: 'Arial, sans-serif' }}>{userGrupo?.nome || "Leões de Blumenau"}</h2>
                            <h3 style={{ fontSize: '14px', color: '#1d4ed8', margin: 0, lineHeight: 1.2, fontFamily: 'Arial, sans-serif' }}>{userSecao?.nome || "Ramo Lobinho"}</h3>
                          </td>
                          <td style={{ verticalAlign: 'top', textAlign: 'right', width: '80px', border: 'none', padding: 0 }}>
                            <div style={{ width: '70px', height: '70px', display: 'inline-block', overflow: 'hidden' }}>
                              <img 
                                src={getProxiedLogoUrl(userGrupo?.logoUrl)} 
                                alt={userGrupo?.nome || "Logo"} 
                                width="70"
                                height="70"
                                style={{ width: '70px', height: '70px', maxWidth: '70px', maxHeight: '70px', objectFit: 'contain', display: 'block' }}
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (userGrupo?.logoUrl && target.src.includes('wsrv.nl')) {
                                    target.removeAttribute('crossorigin');
                                    target.src = userGrupo.logoUrl;
                                  } else {
                                    target.removeAttribute('crossorigin');
                                    target.onerror = null;
                                    target.src = DEFAULT_LOGO;
                                  }
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Metadata Section */}
                    <div style={{ marginBottom: '20px', fontSize: '12px', lineHeight: 1.5, color: '#171717' }}>
                      <p style={{ margin: '3px 0' }}>
                        <strong style={{ color: '#000000' }}>Data da aplicação:</strong> {tipoDuracao === 'normal' ? parseDate(date) : `${parseDate(dataInicio)} a ${parseDate(dataFim)}`} - {" "}
                        <strong style={{ color: '#000000' }}>Duração:</strong> {tipoDuracao === 'normal' ? "2h30min" : tipoDuracao === 'bivaque' ? "Bivaque (1 dia)" : "Acampamento (2 dias)"}.
                      </p>
                      <p style={{ margin: '3px 0' }}><strong style={{ color: '#000000' }}>Caminho:</strong> {caminho}</p>
                      <p style={{ margin: '3px 0' }}><strong style={{ color: '#000000' }}>Eixo:</strong> {eixo} &gt; <strong style={{ color: '#000000' }}>Bloco:</strong> {bloco}</p>
                      <p style={{ margin: '3px 0' }}><strong style={{ color: '#000000' }}>Velho Lobo Responsável:</strong> {velhoLobo} - <strong style={{ color: '#000000' }}>Biblioteca Base:</strong> {biblioteca}</p>
                      {nomeAtividade && <p style={{ margin: '3px 0' }}><strong style={{ color: '#000000' }}>Nome da Atividade:</strong> {nomeAtividade}</p>}
                      <p style={{ margin: '3px 0' }}>
                        <strong style={{ color: '#000000' }}>Tema/Conceito:</strong>{" "}
                        <span>
                          {(() => {
                            const cleaned = cleanTextSnippet(theme);
                            if (cleaned.length > 250) {
                              return (
                                <span>
                                  {cleaned.substring(0, 240)}...{" "}
                                  <span className="text-xs text-neutral-500 italic print:hidden">
                                    (conteúdo completo do documento utilizado no detalhamento abaixo)
                                  </span>
                                </span>
                              );
                            }
                            return cleaned || "Sem tema definido";
                          })()}
                        </span>
                      </p>
                      <div style={{ margin: '3px 0' }}>
                        <strong style={{ color: '#000000' }}>Recursos materiais necessários:</strong>{" "}
                        {isEditingPlan ? (
                          <textarea className="w-full mt-1 border border-neutral-300 rounded p-1.5 text-sm outline-none resize-y" rows={2} value={plan.recursosMateriais} onChange={(e) => setPlan({...plan, recursosMateriais: e.target.value})} />
                        ) : (
                          <span>{plan.recursosMateriais}</span>
                        )}
                      </div>
                      <div style={{ margin: '3px 0' }}>
                        <strong style={{ color: '#000000' }}>Recursos humanos necessários:</strong>{" "}
                        {isEditingPlan ? (
                          <textarea className="w-full mt-1 border border-neutral-300 rounded p-1.5 text-sm outline-none resize-y" rows={2} value={plan.recursosHumanos} onChange={(e) => setPlan({...plan, recursosHumanos: e.target.value})} />
                        ) : (
                          <span>{plan.recursosHumanos}</span>
                        )}
                      </div>
                    </div>

                    {/* Programação */}
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#171717', margin: '18px 0 10px 0', fontFamily: 'Arial, sans-serif', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                      Programação:
                    </h2>
                    
                    {getTableChunks(plan.atividades).map((chunk, chunkIndex) => (
                      <div key={chunkIndex} className={`print:overflow-visible ${chunkIndex > 0 ? 'mt-6' : 'mb-6'}`} style={chunkIndex > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #171717', tableLayout: 'fixed', fontSize: '11px', fontFamily: 'Arial, sans-serif' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'center' }}>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '5%', color: '#171717' }}>#</th>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '11%', color: '#171717' }}>Hora</th>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '11%', color: '#171717' }}>Duração</th>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '15%', color: '#171717' }}>Tipo</th>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '27%', textAlign: 'left', color: '#171717' }}>Atividade</th>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '15%', color: '#171717' }}>Responsável</th>
                              <th style={{ border: '1px solid #171717', padding: '6px 4px', width: '16%', textAlign: 'left', color: '#171717' }}>Material</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map(({act, originalIndex: i}) => (
                              <tr key={i} className="pdf-avoid-break" style={{ textAlign: 'center', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', fontWeight: 'bold', color: '#171717' }}>{i + 1}</td>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', color: '#171717' }}>{isEditingPlan ? <input type="text" value={act.horaInicio} onChange={e => { const newActs = [...plan.atividades]; newActs[i].horaInicio = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full bg-white border border-neutral-300 px-1 py-1 rounded outline-none text-center" /> : act.horaInicio}</td>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', color: '#171717' }}>{isEditingPlan ? <input type="text" value={act.duracao} onChange={e => { const newActs = [...plan.atividades]; newActs[i].duracao = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full bg-white border border-neutral-300 px-1 py-1 rounded outline-none text-center" /> : act.duracao}</td>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', color: '#171717' }}>{isEditingPlan ? <input type="text" value={act.tipo} onChange={e => { const newActs = [...plan.atividades]; newActs[i].tipo = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full bg-white border border-neutral-300 px-1 py-1 rounded outline-none text-center" /> : act.tipo}</td>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', textAlign: 'left', fontWeight: '500', color: '#171717' }}>{isEditingPlan ? <input type="text" value={act.nome} onChange={e => { const newActs = [...plan.atividades]; newActs[i].nome = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full bg-white border border-neutral-300 px-1 py-1 rounded outline-none text-left" /> : act.nome}</td>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', color: '#171717' }}>{isEditingPlan ? <input type="text" value={act.responsavel} onChange={e => { const newActs = [...plan.atividades]; newActs[i].responsavel = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full bg-white border border-neutral-300 px-1 py-1 rounded outline-none text-center" /> : act.responsavel}</td>
                                <td style={{ border: '1px solid #171717', padding: '6px 4px', textAlign: 'left', fontSize: '10px', color: '#171717' }}>{isEditingPlan ? <textarea value={act.material} onChange={e => { const newActs = [...plan.atividades]; newActs[i].material = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full bg-white border border-neutral-300 px-1 py-1 rounded outline-none resize-y text-left h-10" /> : act.material}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {/* Detalhamento das Atividades */}
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#171717', margin: '22px 0 12px 0', fontFamily: 'Arial, sans-serif', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                      Detalhamento das atividades:
                    </h2>
                    
                    <div style={{ marginBottom: '24px' }}>
                      {plan.atividades.map((act, i) => (
                        <div key={i} className="pdf-avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: '16px', paddingBottom: '12px', borderBottom: i < plan.atividades.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: '#013B88', margin: '0 0 6px 0', fontFamily: 'Arial, sans-serif' }}>
                            ATIVIDADE {i + 1}: {act.nome}
                          </h3>
                          <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#171717' }}>
                            <div style={{ marginBottom: '4px' }}>
                              <strong style={{ color: '#000000' }}>Área de desenvolvimento:</strong>{" "}
                              {isEditingPlan ? <input type="text" value={act.areaDesenvolvimento} onChange={e => { const newActs = [...plan.atividades]; newActs[i].areaDesenvolvimento = e.target.value; setPlan({...plan, atividades: newActs}); }} className="w-full mt-1 border border-neutral-300 rounded p-1.5 text-sm outline-none" /> : <span style={{ color: '#171717' }}>{act.areaDesenvolvimento}</span>}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              <strong style={{ color: '#000000' }}>Descrição da atividade:</strong>
                              {isEditingPlan ? <textarea value={act.descricao} onChange={e => { const newActs = [...plan.atividades]; newActs[i].descricao = e.target.value; setPlan({...plan, atividades: newActs}); }} rows={4} className="w-full mt-1 border border-neutral-300 rounded p-1.5 text-sm outline-none resize-y" /> : <p style={{ margin: '2px 0 0 0', lineHeight: 1.5, color: '#171717' }}>{act.descricao}</p>}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              <strong style={{ color: '#000000' }}>Plano B (Em caso de chuva / Local coberto):</strong>
                              {isEditingPlan ? (
                                <textarea 
                                  value={act.planoB || ""} 
                                  onChange={e => { const newActs = [...plan.atividades]; newActs[i].planoB = e.target.value; setPlan({...plan, atividades: newActs}); }} 
                                  rows={2} 
                                  placeholder="Descreva o plano alternativo para chuva ou ambiente coberto..."
                                  className="w-full mt-1 border border-neutral-300 rounded p-1.5 text-sm outline-none resize-y" 
                                />
                              ) : (
                                <div 
                                  style={{ backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: '1px', borderStyle: 'solid', color: '#082f49', padding: '8px 10px', borderRadius: '4px', marginTop: '4px', fontSize: '11px', lineHeight: 1.4 }}
                                >
                                  <div style={{ fontWeight: '600', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                    <CloudRain className="w-3.5 h-3.5 inline" style={{ color: '#0284c7' }} /> Alternativa para Chuva / Local Fechado:
                                  </div>
                                  <p style={{ color: '#171717', margin: 0 }}>{act.planoB || "Adaptar a dinâmica para espaço coberto ou salão da sede, redimensionando as áreas de jogo."}</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <strong style={{ color: '#000000' }}>Fundo de Cena:</strong>
                              {isEditingPlan ? <textarea value={act.fundoDeCena || ""} onChange={e => { const newActs = [...plan.atividades]; newActs[i].fundoDeCena = e.target.value; setPlan({...plan, atividades: newActs}); }} rows={2} className="w-full mt-1 border border-neutral-300 rounded p-1.5 text-sm outline-none resize-y" /> : <p style={{ margin: '2px 0 0 0', color: '#171717' }}>{act.fundoDeCena}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Ciclo de Programa e Diferenciação Etária (table layout ensures side-by-side without grid issues) */}
                    <table className="pdf-avoid-break" style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginTop: '20px', borderTop: '1px solid #e2e8f0', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '48%', verticalAlign: 'top', border: 'none', padding: '16px 8px 0 0' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#013B88', fontFamily: 'Arial, sans-serif' }}>O Ciclo de Programa</h2>
                            <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe', color: '#172554', fontSize: '11px', lineHeight: 1.5 }}>
                              {isEditingPlan ? <textarea value={plan.cicloPrograma} onChange={e => setPlan({...plan, cicloPrograma: e.target.value})} rows={8} className="w-full border border-blue-200 rounded p-2 text-sm outline-none resize-y bg-white/60" /> : <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{plan.cicloPrograma}</p>}
                            </div>
                          </td>
                          <td style={{ width: '4%', border: 'none' }}></td>
                          <td style={{ width: '48%', verticalAlign: 'top', border: 'none', padding: '16px 0 0 8px' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#013B88', fontFamily: 'Arial, sans-serif' }}>Diferenciação Etária (6,5 a 10,5 anos)</h2>
                            <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe', color: '#172554', fontSize: '11px', lineHeight: 1.5 }}>
                              {isEditingPlan ? <textarea value={plan.diferenciacaoEtaria} onChange={e => setPlan({...plan, diferenciacaoEtaria: e.target.value})} rows={8} className="w-full border border-blue-200 rounded p-2 text-sm outline-none resize-y bg-white/60" /> : <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{plan.diferenciacaoEtaria}</p>}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                  </div>
                  
                  {isEditingPlan && (
                    <div className="mt-8 pt-4 flex justify-end gap-3 print:hidden border-t border-neutral-200">
                      <button 
                        onClick={() => setIsEditingPlan(false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm border bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                      >
                        <Edit3 className="w-4 h-4" /> Finalizar Edição
                      </button>
                      <button 
                        onClick={handleSaveActivity}
                        disabled={isSavingActivity}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400 rounded-md transition-colors font-medium text-sm shadow-md"
                      >
                        {isSavingActivity ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                        ) : (
                          <><Save className="w-4 h-4" /> Salvar Atividade</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
        
        {activeTab === "history" && (
          <section className="flex-1 p-6 overflow-y-auto bg-neutral-50 w-full">
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold text-[#013B88] mb-6 flex items-center gap-2">
                <History className="w-6 h-6" /> Histórico de Atividades
              </h2>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-10 text-neutral-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando histórico...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-lg border border-neutral-200 shadow-sm">
                  <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">Nenhuma atividade salva ainda.</p>
                </div>
              ) : isAdmin ? (
                <div className="space-y-6">
                  {(() => {
                    const groupsMap: Record<string, typeof historyItems> = {};
                    historyItems.forEach(item => {
                      const gid = item.grupoId || 'legacy';
                      if (!groupsMap[gid]) {
                        groupsMap[gid] = [];
                      }
                      groupsMap[gid].push(item);
                    });

                    return Object.entries(groupsMap).map(([gid, items]) => {
                      const gName = gid === 'Todos'
                        ? 'Administração Geral (Todos)'
                        : gid === 'legacy'
                        ? 'Atividades Individuais (Sem Grupo)'
                        : allGruposForAdmin.find(g => g.id === gid)?.nome || `Grupo #${gid}`;

                      return (
                        <div key={gid} className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden p-4 space-y-3">
                          <h3 className="text-lg font-bold text-[#013B88] border-b border-neutral-100 pb-2 flex items-center justify-between">
                            <span>{gName}</span>
                            <span className="text-xs bg-blue-50 text-[#013B88] px-2.5 py-1 rounded-full font-semibold">
                              {items.length} {items.length === 1 ? 'atividade' : 'atividades'}
                            </span>
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-200">
                                  <th className="p-3 text-xs font-semibold text-neutral-700">Data Aplicação</th>
                                  <th className="p-3 text-xs font-semibold text-neutral-700">Nome Atividade</th>
                                  <th className="p-3 text-xs font-semibold text-neutral-700">Responsável</th>
                                  <th className="p-3 text-xs font-semibold text-neutral-700 text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map(item => (
                                  <tr 
                                    key={item.id} 
                                    className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                                    onClick={() => {
                                      setPlan(item.plan);
                                      setTheme(item.theme);
                                      setNomeAtividade(item.nomeAtividade || item.theme);
                                      
                                      const isLong = (item as any).tipoDuracao && (item as any).tipoDuracao !== 'normal';
                                      if (isLong) {
                                        setTipoDuracao((item as any).tipoDuracao);
                                        setDataInicio((item as any).dataInicio || getNextSaturday());
                                        setDataFim((item as any).dataFim || getNextSaturday());
                                        if ((item as any).periodosDia1) {
                                          setPeriodosDia1((item as any).periodosDia1);
                                        }
                                        if ((item as any).periodosDia2) {
                                          setPeriodosDia2((item as any).periodosDia2);
                                        }
                                      } else {
                                        setTipoDuracao('normal');
                                        setDate(item.dataAplicacao);
                                      }

                                      setVelhoLobo(item.responsavel);
                                      setCurrentHistoryId(item.id);
                                      setActiveTab("plan");
                                    }}
                                  >
                                    <td className="p-3 text-xs text-neutral-600 font-medium">
                                      {parseDate(item.dataAplicacao)}
                                    </td>
                                    <td className="p-3 text-xs">
                                      <span className="font-semibold text-[#013B88] block">
                                        {item.nomeAtividade || item.theme}
                                      </span>
                                    </td>
                                    <td className="p-3 text-xs text-neutral-600 truncate max-w-[125px]">
                                      {item.responsavel}
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPlan(item.plan);
                                          setTheme(item.theme);
                                          setNomeAtividade(item.nomeAtividade || item.theme);
                                          
                                          const isLong = (item as any).tipoDuracao && (item as any).tipoDuracao !== 'normal';
                                          if (isLong) {
                                            setTipoDuracao((item as any).tipoDuracao);
                                            setDataInicio((item as any).dataInicio || getNextSaturday());
                                            setDataFim((item as any).dataFim || getNextSaturday());
                                            if ((item as any).periodosDia1) {
                                              setPeriodosDia1((item as any).periodosDia1);
                                            }
                                            if ((item as any).periodosDia2) {
                                              setPeriodosDia2((item as any).periodosDia2);
                                            }
                                          } else {
                                            setTipoDuracao('normal');
                                            setDate(item.dataAplicacao);
                                          }

                                          setVelhoLobo(item.responsavel);
                                          setCurrentHistoryId(item.id);
                                          setActiveTab("plan");
                                        }}
                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-full transition-colors inline-block mr-1.5"
                                        title="Ver / Editar Atividade"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setHistoryToDelete({id: item.id, isGrupo: !!item.grupoId});
                                        }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors inline-block"
                                        title="Excluir Atividade"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="p-4 font-semibold text-neutral-700">Data Aplicação</th>
                        <th className="p-4 font-semibold text-neutral-700">Nome Atividade</th>
                        <th className="p-4 font-semibold text-neutral-700">Responsável</th>
                        <th className="p-4 font-semibold text-neutral-700 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map(item => (
                        <tr 
                          key={item.id} 
                          className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setPlan(item.plan);
                            setTheme(item.theme);
                            setNomeAtividade(item.nomeAtividade || item.theme);
                            
                            const isLong = (item as any).tipoDuracao && (item as any).tipoDuracao !== 'normal';
                            if (isLong) {
                              setTipoDuracao((item as any).tipoDuracao);
                              setDataInicio((item as any).dataInicio || getNextSaturday());
                              setDataFim((item as any).dataFim || getNextSaturday());
                              if ((item as any).periodosDia1) {
                                setPeriodosDia1((item as any).periodosDia1);
                              }
                              if ((item as any).periodosDia2) {
                                setPeriodosDia2((item as any).periodosDia2);
                              }
                            } else {
                              setTipoDuracao('normal');
                              setDate(item.dataAplicacao);
                            }

                            setVelhoLobo(item.responsavel);
                            setCurrentHistoryId(item.id);
                            setActiveTab("plan");
                          }}
                        >
                          <td className="p-4 text-sm text-neutral-600 font-medium">
                            {parseDate(item.dataAplicacao)}
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-[#013B88] block">
                              {item.nomeAtividade || item.theme}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-neutral-600 truncate max-w-[150px]">
                            {item.responsavel}
                          </td>
                          <td className="p-4 text-right">
                            <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setPlan(item.plan);
                                 setTheme(item.theme);
                                 setNomeAtividade(item.nomeAtividade || item.theme);
                                 
                                 const isLong = (item as any).tipoDuracao && (item as any).tipoDuracao !== 'normal';
                                 if (isLong) {
                                   setTipoDuracao((item as any).tipoDuracao);
                                   setDataInicio((item as any).dataInicio || getNextSaturday());
                                   setDataFim((item as any).dataFim || getNextSaturday());
                                   if ((item as any).periodosDia1) {
                                     setPeriodosDia1((item as any).periodosDia1);
                                   }
                                   if ((item as any).periodosDia2) {
                                     setPeriodosDia2((item as any).periodosDia2);
                                   }
                                 } else {
                                   setTipoDuracao('normal');
                                   setDate(item.dataAplicacao);
                                 }

                                 setVelhoLobo(item.responsavel);
                                 setCurrentHistoryId(item.id);
                                 setActiveTab("plan");
                               }}
                               className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors inline-block mr-2"
                               title="Ver / Editar Atividade"
                             >
                               <Edit3 className="w-4 h-4" />
                             </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryToDelete({id: item.id, isGrupo: !!item.grupoId});
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors inline-block"
                              title="Excluir Atividade"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="flex-1 p-6 overflow-y-auto bg-neutral-50 w-full">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-2xl font-bold text-[#013B88] mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6" /> Configurações do Aplicativo
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Velhos Lobos Management */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
                  <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-blue-600" /> Velhos Lobos Responsáveis
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newVelhoLobo}
                        onChange={(e) => setNewVelhoLobo(e.target.value)}
                        placeholder="Novo Velho Lobo..."
                        className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#013B88] outline-none"
                      />
                      <button 
                        onClick={() => {
                          if (newVelhoLobo && !velhosLobos.includes(newVelhoLobo)) {
                            setVelhosLobos([...velhosLobos, newVelhoLobo]);
                            setNewVelhoLobo("");
                          }
                        }}
                        className="bg-[#013B88] text-white p-2 rounded-md hover:bg-opacity-90"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {velhosLobos.map(vl => (
                        <div key={vl} className="flex items-center justify-between p-2 bg-neutral-50 rounded-md group">
                          <span className="text-sm font-medium">{vl}</span>
                          <button 
                            onClick={() => setVelhosLobos(velhosLobos.filter(v => v !== vl))}
                            className="text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Term Adjustments */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
                  <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-amber-500" /> Ajuste de Termos (Substituição)
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="text" 
                        value={newTerm.insteadOf}
                        onChange={(e) => setNewTerm({...newTerm, insteadOf: e.target.value})}
                        placeholder="Ao invés de..."
                        className="rounded-md border border-neutral-300 px-3 py-2 text-xs focus:ring-2 focus:ring-[#013B88] outline-none"
                      />
                      <input 
                        type="text" 
                        value={newTerm.use}
                        onChange={(e) => setNewTerm({...newTerm, use: e.target.value})}
                        placeholder="Usar..."
                        className="rounded-md border border-neutral-300 px-3 py-2 text-xs focus:ring-2 focus:ring-[#013B88] outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        if (newTerm.insteadOf && newTerm.use) {
                          setAdjustmentTerms([...adjustmentTerms, newTerm]);
                          setNewTerm({ use: "", insteadOf: "" });
                        }
                      }}
                      className="w-full bg-[#013B88] text-white py-2 rounded-md hover:bg-opacity-90 flex items-center justify-center gap-2 text-sm font-bold"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Regra
                    </button>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {adjustmentTerms.map((term, idx) => (
                        <div key={idx} className="p-2 bg-neutral-50 rounded-md border border-neutral-100 relative group">
                          <div className="text-xs space-y-1">
                            <p className="text-neutral-400 line-through">{term.insteadOf}</p>
                            <p className="text-[#013B88] font-bold">→ {term.use}</p>
                          </div>
                          <button 
                            onClick={() => setAdjustmentTerms(adjustmentTerms.filter((_, i) => i !== idx))}
                            className="absolute right-2 top-2 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Management */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <Library className="w-5 h-5 text-blue-600" /> Gerenciar Categorias da Biblioteca
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nova categoria..."
                      className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#013B88] outline-none"
                    />
                    <button 
                      onClick={() => {
                        if (newCategoryName && !libraryData.find((c: any) => c.category === newCategoryName)) {
                          setLibraryData([...libraryData, { category: newCategoryName, items: [], hidden: false }]);
                          setNewCategoryName("");
                        }
                      }}
                      className="bg-[#013B88] text-white p-2 rounded-md hover:bg-opacity-90"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {libraryData.map((cat: any) => (
                      <div key={cat.category} className="flex items-center justify-between p-2 bg-neutral-50 rounded-md group">
                        {editingCategory === cat.category ? (
                          <div className="flex-1 flex gap-1">
                            <input 
                              type="text" 
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              className="flex-1 text-sm border border-neutral-300 px-1 rounded-sm"
                              autoFocus
                            />
                            <button 
                              onClick={() => {
                                setLibraryData(libraryData.map((c: any) => 
                                  c.category === cat.category ? { ...c, category: editCategoryName } : c
                                ));
                                setEditingCategory(null);
                              }}
                              className="text-green-600 text-xs font-bold"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-medium">{cat.category}</span>
                        )}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingCategory(cat.category);
                              setEditCategoryName(cat.category);
                            }}
                            className="text-neutral-400 hover:text-blue-500"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setLibraryData(libraryData.filter((c: any) => c.category !== cat.category))}
                            className="text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Library Management (Updated with Delete item) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
                <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <Library className="w-5 h-5 text-green-600" /> Expandir Biblioteca
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Manual Entry */}
                  <div className="space-y-4 pr-0 md:pr-6 md:border-r border-neutral-100">
                    <h4 className="text-sm font-semibold text-neutral-700">Adicionar/Consultar Itens</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Categoria Target</label>
                        <select 
                          value={newLibraryItem.category}
                          onChange={(e) => setNewLibraryItem({...newLibraryItem, category: e.target.value})}
                          className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none bg-white"
                        >
                          {libraryData.map((c: any) => <option key={c.category} value={c.category}>{c.category}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Nome do arquivo/jogo</label>
                        <input 
                          type="text" 
                          value={newLibraryItem.name}
                          onChange={(e) => setNewLibraryItem({...newLibraryItem, name: e.target.value})}
                          placeholder="Ex: Jogo da Onça"
                          className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">URL / Link (opcional)</label>
                        <input 
                          type="url" 
                          value={newLibraryItem.url}
                          onChange={(e) => setNewLibraryItem({...newLibraryItem, url: e.target.value})}
                          placeholder="https://..."
                          className="w-full rounded-md border border-neutral-300 p-1.5 text-sm outline-none bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newLibraryItem.name) return;
                          setLibraryData((prev: any[]) => prev.map(cat => {
                            if (cat.category === newLibraryItem.category) {
                              return {
                                ...cat,
                                items: [...cat.items, { name: newLibraryItem.name, url: newLibraryItem.url }]
                              };
                            }
                            return cat;
                          }));
                          setNewLibraryItem({ ...newLibraryItem, name: "", url: "" });
                          alert("Item adicionado!");
                        }}
                        className="w-full py-2 bg-[#013B88] text-white rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Incluir Item
                      </button>

                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        <label className="block text-xs font-medium text-neutral-600 mb-2">Itens na Categoria Selecionada</label>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {libraryData.find((c: any) => c.category === newLibraryItem.category)?.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-neutral-50 rounded text-[10px] group">
                              <span className="truncate flex-1">{item.name}</span>
                              <button 
                                onClick={() => {
                                  setLibraryData((prev: any[]) => prev.map(c => 
                                    c.category === newLibraryItem.category 
                                      ? { ...c, items: c.items.filter((_: any, i: number) => i !== idx) }
                                      : c
                                  ));
                                }}
                                className="text-red-500 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Google Drive Integration */}
                  <DrivePicker 
                    onFilePicked={(file) => {
                      setLibraryData((prev: any[]) => {
                        const categoryName = "Arquivos Enviados";
                        const existingCat = prev.find(c => c.category === categoryName);
                        
                        if (existingCat) {
                          return prev.map(cat => 
                            cat.category === categoryName 
                              ? { ...cat, items: [...cat.items, { name: file.name, url: file.url }] }
                              : cat
                          );
                        } else {
                          return [...prev, {
                            category: categoryName,
                            items: [{ name: file.name, url: file.url }],
                            hidden: false
                          }];
                        }
                      });
                      alert(`Arquivo "${file.name}" importado do Google Drive com sucesso!`);
                    }} 
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "admin" && isAdmin && (
          <section className="flex-1 p-6 bg-neutral-50 w-full overflow-hidden flex flex-col">
            <h2 className="text-2xl font-bold text-[#013B88] mb-6 flex items-center gap-2 shrink-0">
              <ShieldAlert className="w-6 h-6" /> Área do Administrador
            </h2>
            <AdminPanel />
          </section>
        )}
      </main>

      {historyToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-lg text-neutral-800">Confirmar Exclusão</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-neutral-600">Tem certeza que deseja excluir esta atividade permanentemente? Esta ação não poderá ser desfeita.</p>
            </div>
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-3 rounded-b-lg">
              <button 
                onClick={() => setHistoryToDelete(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  try {
                    if(user) await deleteActivityFromHistory(user.uid, historyToDelete.id, historyToDelete.isGrupo);
                    setHistoryItems(prev => prev.filter(i => i.id !== historyToDelete.id));
                    setHistoryToDelete(null);
                  } catch (error) {
                    console.error(error);
                    alert("Erro ao excluir atividade.");
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização do Conteúdo Extraído do Documento */}
      {showDocPreview && uploadedDoc && (
        <div id="doc-preview-modal" className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  uploadedDoc.filename.toLowerCase().endsWith('.pdf') 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 text-sm">{uploadedDoc.filename}</h3>
                  <p className="text-xs text-neutral-500">
                    {uploadedDoc.charCount.toLocaleString('pt-BR')} caracteres lidos • Base do Planejamento
                  </p>
                </div>
              </div>
              <button
                id="close-doc-preview-modal-btn"
                onClick={() => setShowDocPreview(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-neutral-50/50">
              <div className="bg-white border border-neutral-200 rounded-lg p-3.5 font-mono text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed">
                {uploadedDoc.text}
              </div>
            </div>
            <div className="p-3.5 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 bg-neutral-50">
              <span className="text-xs text-neutral-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Texto extraído e disponível para o planejamento da atividade
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="modal-copy-to-theme-btn"
                  onClick={() => {
                    setTheme(uploadedDoc.text.trim());
                    alert("O texto do documento foi colado no campo 'Conceito/Tema Livre'!");
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Colar no Tema Livre
                </button>
                <button
                  id="confirm-doc-preview-btn"
                  onClick={() => setShowDocPreview(false)}
                  className="px-4 py-1.5 bg-[#013B88] hover:bg-[#013B88]/90 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

