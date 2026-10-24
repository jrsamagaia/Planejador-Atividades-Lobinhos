import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, Clock, FileText, Loader2, Paperclip, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMINHOS, EIXOS_E_BLOCOS, PERIODOS_PADRAO, minutosEntre } from '../../shared/progressao';
import type { EventoGeracao, ItemBiblioteca, ParametrosPlano, Periodo, Plano, TipoAtividade } from '../../shared/types';
import { api, postStream } from '../api';
import { Cabecalho, Secao } from '../components/ui';
import { formatarData, navegar, proximoSabado, somarDias, useCaminho, useSessao } from '../lib/contexto';

const RASCUNHO = 'planejador:rascunho';
const MAX_BIBLIOTECA = 5;

function periodosDoDia(indice: number, total: number): Periodo[] {
  const ultimo = total > 1 && indice === total - 1;
  return PERIODOS_PADRAO.map((p) => ({ ...p, ativo: !(ultimo && (p.chave === 'janta' || p.chave === 'noite')) }));
}

function diasEntre(inicio: string, fim: string) {
  return Math.max(1, Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1);
}

function parametrosIniciais(tipo: TipoAtividade, velhosLobos: string[]): ParametrosPlano {
  const inicio = proximoSabado();
  const fim = somarDias(inicio, tipo.modo === 'periodos' ? tipo.dias - 1 : 0);
  return {
    titulo: '',
    tema: '',
    tipoId: tipo.id,
    dataInicio: inicio,
    dataFim: fim,
    horaInicio: tipo.hora_inicio,
    horaFim: tipo.hora_fim,
    periodosPorDia: tipo.modo === 'periodos' ? Array.from({ length: tipo.dias }, (_, i) => periodosDoDia(i, tipo.dias)) : [],
    caminho: 'Todos',
    eixo: 'Todos',
    bloco: 'Todos',
    velhoLoboPrincipal: velhosLobos[0] ?? '',
    equipe: [...velhosLobos],
    bibliotecaIds: [],
    atividadeEspecial: null,
    observacoes: '',
    documento: null,
  };
}

function lerRascunho(): ParametrosPlano | null {
  try {
    const r = localStorage.getItem(RASCUNHO);
    return r ? (JSON.parse(r) as ParametrosPlano) : null;
  } catch {
    return null;
  }
}

export function Planejar() {
  const { sessao, avisar } = useSessao();
  const { busca } = useCaminho();
  const tipos = sessao.tipos;
  const baseId = busca.get('base');

  const [p, setP] = useState<ParametrosPlano>(() => {
    const r = baseId ? null : lerRascunho();
    if (r && tipos.some((t) => t.id === r.tipoId)) return { ...parametrosIniciais(tipos[0], sessao.config.velhosLobos), ...r };
    return parametrosIniciais(tipos[0], sessao.config.velhosLobos);
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [biblioteca, setBiblioteca] = useState<ItemBiblioteca[]>([]);
  const [geracao, setGeracao] = useState<{ etapa: string; caracteres: number; erro?: string } | null>(null);
  const [maisOpcoes, setMaisOpcoes] = useState(Boolean(p.atividadeEspecial || p.observacoes));

  const tipo = tipos.find((t) => t.id === p.tipoId) ?? tipos[0];
  const set = <K extends keyof ParametrosPlano>(k: K, v: ParametrosPlano[K]) => setP((a) => ({ ...a, [k]: v }));

  // "Usar como base": carrega os parâmetros de um plano existente
  useEffect(() => {
    if (!baseId) return;
    api.get<Plano>(`/planos/${baseId}`).then(
      (plano) => {
        const dias = plano.parametros.periodosPorDia.length;
        const inicio = proximoSabado();
        setP({ ...plano.parametros, titulo: `${plano.parametros.titulo}`, dataInicio: inicio, dataFim: somarDias(inicio, Math.max(0, dias - 1)) });
        avisar('Formulário preenchido com base no plano escolhido. Ajuste o que quiser e gere de novo.');
      },
      (e) => avisar(e.message, 'erro'),
    );
  }, [baseId, avisar]);

  useEffect(() => {
    api.get<{ itens: ItemBiblioteca[] }>('/biblioteca').then((b) => setBiblioteca(b.itens.filter((i) => i.disponivel)), () => {});
  }, []);

  // Rascunho automático (só neste navegador)
  useEffect(() => {
    if (baseId) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(RASCUNHO, JSON.stringify(p));
      } catch {
        /* navegador sem armazenamento */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [p, baseId]);

  function escolherTipo(t: TipoAtividade) {
    setP((a) => {
      const fim = t.modo === 'periodos' ? somarDias(a.dataInicio, t.dias - 1) : a.dataInicio;
      return {
        ...a,
        tipoId: t.id,
        horaInicio: t.hora_inicio,
        horaFim: t.hora_fim,
        dataFim: fim,
        periodosPorDia: t.modo === 'periodos' ? ajustarDias(a.periodosPorDia, diasEntre(a.dataInicio, fim)) : [],
      };
    });
  }

  function ajustarDias(atual: Periodo[][], dias: number): Periodo[][] {
    return Array.from({ length: dias }, (_, i) => (i < atual.length && i < dias - 1 ? atual[i] : periodosDoDia(i, dias)));
  }

  function mudarDatas(inicio: string, fim: string) {
    if (fim < inicio) fim = inicio;
    if (diasEntre(inicio, fim) > 7) fim = somarDias(inicio, 6);
    setP((a) => ({ ...a, dataInicio: inicio, dataFim: fim, periodosPorDia: ajustarDias(a.periodosPorDia, diasEntre(inicio, fim)) }));
  }

  async function anexar(f: File | undefined) {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'txt' || ext === 'md') {
      try {
        let texto: string;
        if (ext === 'docx') {
          const mammoth = await import('mammoth');
          texto = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value;
        } else texto = await f.text();
        texto = texto.replace(/\n{3,}/g, '\n\n').trim();
        if (texto.length > 60000) {
          texto = texto.slice(0, 60000);
          avisar('O documento é muito longo; usamos as primeiras ~25 páginas.', 'erro');
        }
        set('documento', { nome: f.name, texto });
        setArquivo(null);
        if (!p.titulo) set('titulo', f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
      } catch {
        avisar('Não foi possível ler este documento.', 'erro');
      }
    } else if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) {
      if (f.size > 50 * 1024 * 1024) return avisar('O arquivo passa de 50 MB.', 'erro');
      setArquivo(f);
      set('documento', null);
      if (!p.titulo) set('titulo', f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    } else if (ext === 'doc') {
      avisar('Arquivos .doc antigos não são lidos. Abra no Word e salve como .docx ou PDF.', 'erro');
    } else {
      avisar('Formato não aceito. Use PDF, Word (.docx), imagem ou texto.', 'erro');
    }
  }

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    if (!p.titulo.trim()) return avisar('Dê um nome para a atividade.', 'erro');
    if (!p.tema.trim() && !p.documento && !arquivo) return avisar('Conte a ideia da atividade ou anexe um documento.', 'erro');
    if (!p.equipe.length) return avisar('Selecione pelo menos um Velho Lobo.', 'erro');

    const params = { ...p, tema: p.tema.trim() || `Atividade baseada no documento anexado (${p.documento?.nome ?? arquivo?.name}).` };
    const form = new FormData();
    form.append('parametros', JSON.stringify(params));
    if (arquivo) form.append('arquivo', arquivo);

    setGeracao({ etapa: 'Enviando…', caracteres: 0 });
    try {
      await postStream<EventoGeracao>('/planos/gerar', form, (ev) => {
        if (ev.tipo === 'etapa') setGeracao((g) => ({ ...g!, etapa: ev.mensagem }));
        else if (ev.tipo === 'progresso') setGeracao((g) => ({ ...g!, caracteres: ev.caracteres }));
        else if (ev.tipo === 'erro') setGeracao((g) => ({ ...g!, erro: ev.mensagem }));
        else if (ev.tipo === 'concluido') {
          try {
            localStorage.removeItem(RASCUNHO);
          } catch {
            /* ignore */
          }
          setGeracao(null);
          avisar('Plano pronto e salvo!');
          navegar(`/planos/${ev.plano.id}`);
        }
      });
    } catch (err) {
      setGeracao((g) => ({ ...(g ?? { etapa: '', caracteres: 0 }), erro: (err as Error).message }));
    }
  }

  function limpar() {
    setP(parametrosIniciais(tipo, sessao.config.velhosLobos));
    setArquivo(null);
  }

  return (
    <form onSubmit={gerar} className="mx-auto max-w-3xl">
      <Cabecalho
        titulo="Novo plano"
        subtitulo="Preencha o essencial. O Gemini monta a programação completa, minuto a minuto."
        acoes={
          <button type="button" className="btn-fantasma" onClick={limpar}>
            <Trash2 className="size-4" /> Limpar
          </button>
        }
      />

      <div className="space-y-5">
        <Secao numero={1} titulo="Que atividade é?">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de atividade">
            {tipos.map((t) => (
              <button type="button" role="radio" aria-checked={t.id === tipo.id} key={t.id} className={t.id === tipo.id ? 'chip-on' : 'chip-off'} onClick={() => escolherTipo(t)}>
                {t.nome}
              </button>
            ))}
          </div>
          {tipo.descricao && <p className="ajuda mt-3">{tipo.descricao}</p>}

          <div className="mt-5 space-y-4">
            <div>
              <label className="rotulo" htmlFor="titulo">
                Nome da atividade
              </label>
              <input id="titulo" className="campo" placeholder="Ex.: A caçada de Kaa" value={p.titulo} onChange={(e) => set('titulo', e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="rotulo" htmlFor="tema">
                Tema ou ideia
              </label>
              <textarea
                id="tema"
                className="campo min-h-28"
                placeholder="Ex.: Trabalhar cuidado com a natureza a partir da história de Kaa, com um jogo de rastreio no pátio."
                value={p.tema}
                onChange={(e) => set('tema', e.target.value)}
              />
              <Anexo arquivo={arquivo} documento={p.documento} aoAnexar={anexar} aoRemover={() => (setArquivo(null), set('documento', null))} />
            </div>
          </div>
        </Secao>

        <Secao numero={2} titulo="Quando?">
          {tipo.modo === 'bloco' ? (
            <HorarioBloco p={p} set={set} />
          ) : (
            <HorarioPeriodos p={p} mudarDatas={mudarDatas} setPeriodos={(v) => set('periodosPorDia', v)} />
          )}
        </Secao>

        <Secao numero={3} titulo="Progressão">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="caminho">
                Caminho
              </label>
              <select id="caminho" className="campo" value={p.caminho} onChange={(e) => set('caminho', e.target.value)}>
                {CAMINHOS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="eixo">
                Eixo
              </label>
              <select id="eixo" className="campo" value={p.eixo} onChange={(e) => setP((a) => ({ ...a, eixo: e.target.value, bloco: 'Todos' }))}>
                {Object.keys(EIXOS_E_BLOCOS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="bloco">
                Bloco
              </label>
              <select id="bloco" className="campo" value={p.bloco} onChange={(e) => set('bloco', e.target.value)}>
                {EIXOS_E_BLOCOS[p.eixo].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </Secao>

        <Secao numero={4} titulo="Equipe">
          <p className="ajuda -mt-2 mb-3">Toque para marcar quem estará presente. A estrela indica o Velho Lobo principal.</p>
          <div className="flex flex-wrap gap-2">
            {sessao.config.velhosLobos.map((v) => {
              const on = p.equipe.includes(v);
              const principal = p.velhoLoboPrincipal === v;
              return (
                <span key={v} className={`${on ? 'chip-on' : 'chip-off'} pr-1.5`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setP((a) => {
                        const equipe = on ? a.equipe.filter((x) => x !== v) : [...a.equipe, v];
                        return { ...a, equipe, velhoLoboPrincipal: equipe.includes(a.velhoLoboPrincipal) ? a.velhoLoboPrincipal : (equipe[0] ?? '') };
                      })
                    }
                  >
                    {v}
                  </button>
                  {on && (
                    <button type="button" title="Velho Lobo principal" aria-label={`Tornar ${v} o principal`} onClick={() => set('velhoLoboPrincipal', v)} className="rounded-full p-0.5">
                      <Star className={`size-4 ${principal ? 'fill-ouro text-ouro' : 'text-white/50'}`} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </Secao>

        <Secao numero={5} titulo="Materiais da biblioteca" extra={<span className="text-xs text-slate-500">{p.bibliotecaIds.length}/{MAX_BIBLIOTECA}</span>}>
          <EscolhaBiblioteca itens={biblioteca} escolhidos={p.bibliotecaIds} aoMudar={(ids) => set('bibliotecaIds', ids)} />
        </Secao>

        <section className="cartao">
          <button type="button" className="flex w-full items-center justify-between p-5 text-left font-bold md:px-6" onClick={() => setMaisOpcoes(!maisOpcoes)} aria-expanded={maisOpcoes}>
            Mais opções <span className="text-sm font-normal text-slate-500">atividade especial obrigatória e observações</span>
            <ChevronDown className={`size-5 transition ${maisOpcoes ? 'rotate-180' : ''}`} />
          </button>
          {maisOpcoes && (
            <div className="space-y-5 border-t border-slate-100 p-5 md:px-6">
              <AtividadeEspecialCampos p={p} set={set} />
              <div>
                <label className="rotulo" htmlFor="obs">
                  Observações para o Gemini
                </label>
                <textarea
                  id="obs"
                  className="campo min-h-20"
                  placeholder="Ex.: teremos 18 lobinhos, 3 novos; o pátio estará ocupado das 15h às 15h30."
                  value={p.observacoes}
                  onChange={(e) => set('observacoes', e.target.value)}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-6 md:bottom-4">
        <button type="submit" className="btn-primario w-full py-4 text-base shadow-xl" disabled={Boolean(geracao) || !sessao.geminiConfigurado}>
          <Sparkles className="size-5" /> Gerar plano
        </button>
      </div>

      {geracao && <Progresso g={geracao} aoFechar={() => setGeracao(null)} />}
    </form>
  );
}

function Anexo({
  arquivo,
  documento,
  aoAnexar,
  aoRemover,
}: {
  arquivo: File | null;
  documento: ParametrosPlano['documento'];
  aoAnexar: (f: File | undefined) => void;
  aoRemover: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const nome = arquivo?.name ?? documento?.nome;
  if (nome)
    return (
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <FileText className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          <strong>{nome}</strong> será usado como base
          {documento && <span className="text-emerald-700"> · {Math.round(documento.texto.length / 1000)} mil caracteres lidos</span>}
        </span>
        <button type="button" className="rounded p-1 hover:bg-emerald-100" onClick={aoRemover} aria-label="Remover anexo">
          <X className="size-4" />
        </button>
      </div>
    );
  return (
    <div
      onDragOver={(e) => (e.preventDefault(), setArrastando(true))}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        aoAnexar(e.dataTransfer.files[0]);
      }}
      className={`mt-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm transition ${arrastando ? 'border-marca bg-marca/5' : 'border-slate-300 text-slate-500'}`}
    >
      <Paperclip className="size-4" />
      <span className="flex-1">
        Tem um roteiro pronto?{' '}
        <button type="button" className="font-semibold text-marca underline-offset-2 hover:underline" onClick={() => input.current?.click()}>
          Anexe
        </button>{' '}
        (PDF, Word, imagem ou texto) ou arraste aqui.
      </span>
      <input ref={input} type="file" hidden accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={(e) => (aoAnexar(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}

function HorarioBloco({ p, set }: { p: ParametrosPlano; set: <K extends keyof ParametrosPlano>(k: K, v: ParametrosPlano[K]) => void }) {
  const { sessao } = useSessao();
  const minutos = minutosEntre(p.horaInicio, p.horaFim);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="rotulo" htmlFor="data">
            Data
          </label>
          <input id="data" type="date" className="campo" value={p.dataInicio} onChange={(e) => (set('dataInicio', e.target.value), set('dataFim', e.target.value))} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="hi">
            Início
          </label>
          <input id="hi" type="time" className="campo" value={p.horaInicio} onChange={(e) => set('horaInicio', e.target.value)} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="hf">
            Fim
          </label>
          <input id="hf" type="time" className="campo" value={p.horaFim} onChange={(e) => set('horaFim', e.target.value)} required />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sessao.config.horariosRapidos.map((h) => {
          const on = h.inicio === p.horaInicio && h.fim === p.horaFim;
          return (
            <button type="button" key={h.rotulo} className={on ? 'chip-on' : 'chip-off'} onClick={() => (set('horaInicio', h.inicio), set('horaFim', h.fim))}>
              <Clock className="size-3.5" /> {h.rotulo} · {h.inicio}–{h.fim}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-500">
          Duração: <strong className="text-slate-800">{Math.floor(minutos / 60)}h{String(minutos % 60).padStart(2, '0')}</strong> ({minutos} min)
        </span>
      </div>
    </div>
  );
}

function HorarioPeriodos({ p, mudarDatas, setPeriodos }: { p: ParametrosPlano; mudarDatas: (i: string, f: string) => void; setPeriodos: (v: Periodo[][]) => void }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const alterar = (dia: number, chave: string, mudanca: Partial<Periodo>) =>
    setPeriodos(p.periodosPorDia.map((d, i) => (i !== dia ? d : d.map((x) => (x.chave === chave ? { ...x, ...mudanca } : x)))));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="di">
            Início
          </label>
          <input id="di" type="date" className="campo" value={p.dataInicio} onChange={(e) => mudarDatas(e.target.value, somarDias(e.target.value, p.periodosPorDia.length - 1))} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="df">
            Fim
          </label>
          <input id="df" type="date" className="campo" min={p.dataInicio} value={p.dataFim} onChange={(e) => mudarDatas(p.dataInicio, e.target.value)} required />
        </div>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {p.periodosPorDia.map((periodos, i) => {
          const ativos = periodos.filter((x) => x.ativo);
          return (
            <div key={i}>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}>
                <span className="font-semibold">Dia {i + 1}</span>
                <span className="text-sm text-slate-500">{formatarData(somarDias(p.dataInicio, i))}</span>
                <span className="ml-auto truncate text-xs text-slate-500">{ativos.length ? ativos.map((x) => x.rotulo).join(' · ') : 'nenhum período'}</span>
                <ChevronDown className={`size-4 shrink-0 transition ${aberto === i ? 'rotate-180' : ''}`} />
              </button>
              {aberto === i && (
                <div className="space-y-2 bg-slate-50 px-4 py-3">
                  {periodos.map((per) => (
                    <div key={per.chave} className="flex flex-wrap items-center gap-3">
                      <label className="flex min-w-36 items-center gap-2 text-sm font-medium">
                        <input type="checkbox" className="size-4 accent-marca" checked={per.ativo} onChange={(e) => alterar(i, per.chave, { ativo: e.target.checked })} />
                        {per.rotulo}
                      </label>
                      {per.ativo && (
                        <span className="flex items-center gap-2 text-sm">
                          <input type="time" aria-label={`Início ${per.rotulo}`} className="campo w-28 py-1.5" value={per.inicio} onChange={(e) => alterar(i, per.chave, { inicio: e.target.value })} />
                          até
                          <input type="time" aria-label={`Fim ${per.rotulo}`} className="campo w-28 py-1.5" value={per.fim} onChange={(e) => alterar(i, per.chave, { fim: e.target.value })} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EscolhaBiblioteca({ itens, escolhidos, aoMudar }: { itens: ItemBiblioteca[]; escolhidos: number[]; aoMudar: (ids: number[]) => void }) {
  const [q, setQ] = useState('');
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return itens.filter((i) => !t || i.titulo.toLowerCase().includes(t));
  }, [itens, q]);
  if (!itens.length)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <BookOpen className="size-4" /> A biblioteca ainda não tem arquivos disponíveis.
      </p>
    );
  return (
    <div>
      <p className="ajuda -mt-2 mb-3">O Gemini lê os materiais escolhidos (até {MAX_BIBLIOTECA}) e usa histórias, jogos e canções deles no plano.</p>
      {itens.length > 6 && (
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="campo pl-9" placeholder="Buscar material" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
        {filtrados.map((i) => {
          const on = escolhidos.includes(i.id);
          const cheio = !on && escolhidos.length >= MAX_BIBLIOTECA;
          return (
            <label
              key={i.id}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${on ? 'border-marca bg-marca/5' : 'border-slate-200 hover:border-slate-300'} ${cheio ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input type="checkbox" className="size-4 accent-marca" checked={on} disabled={cheio} onChange={() => aoMudar(on ? escolhidos.filter((x) => x !== i.id) : [...escolhidos, i.id])} />
              <span className="min-w-0 flex-1 truncate">{i.titulo}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AtividadeEspecialCampos({ p, set }: { p: ParametrosPlano; set: <K extends keyof ParametrosPlano>(k: K, v: ParametrosPlano[K]) => void }) {
  const { sessao } = useSessao();
  const a = p.atividadeEspecial;
  const mudar = (m: Partial<NonNullable<ParametrosPlano['atividadeEspecial']>>) => set('atividadeEspecial', { ...a!, ...m });
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4 accent-marca"
          checked={Boolean(a)}
          onChange={(e) =>
            set('atividadeEspecial', e.target.checked ? { descricao: 'Hasteamento geral', responsavel: p.velhoLoboPrincipal, inicio: p.horaInicio, duracao: 15 } : null)
          }
        />
        Incluir uma atividade especial em horário fixo
      </label>
      <p className="ajuda ml-6">Ex.: hasteamento geral do Grupo, visita, cerimônia de promessa.</p>
      {a && (
        <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <label className="rotulo" htmlFor="esp-d">
              O que é
            </label>
            <input id="esp-d" className="campo" value={a.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="esp-r">
              Responsável
            </label>
            <select id="esp-r" className="campo" value={a.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })}>
              {[...new Set([...sessao.config.velhosLobos, 'Chefia do Grupo'])].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="esp-i">
              Início
            </label>
            <input id="esp-i" type="time" className="campo" value={a.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
          </div>
          <div>
            <label className="rotulo" htmlFor="esp-m">
              Minutos
            </label>
            <input id="esp-m" type="number" min={5} max={600} step={5} className="campo" value={a.duracao} onChange={(e) => mudar({ duracao: Number(e.target.value) })} />
          </div>
        </div>
      )}
    </div>
  );
}

const DICAS = [
  'O Gemini está conferindo se a soma dos minutos fecha certinho.',
  'Cada atividade vem com passo a passo e plano B para chuva.',
  'Planos de acampamento levam mais tempo: são muitos períodos.',
  'Depois de pronto, você pode editar qualquer texto antes de exportar.',
];

function Progresso({ g, aoFechar }: { g: { etapa: string; caracteres: number; erro?: string }; aoFechar: () => void }) {
  const [dica, setDica] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDica((d) => (d + 1) % DICAS.length), 6000);
    return () => clearInterval(t);
  }, []);
  // Um plano de reunião costuma ter ~15 a 25 mil caracteres
  const pct = Math.min(95, Math.round((g.caracteres / 20000) * 100));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marca/90 p-4 backdrop-blur" role="alertdialog" aria-live="assertive">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        {g.erro ? (
          <>
            <AlertTriangle className="mx-auto mb-3 size-10 text-amber-500" />
            <h2 className="text-lg font-bold">Não deu certo desta vez</h2>
            <p className="mt-2 text-sm text-slate-600">{g.erro}</p>
            <button type="button" className="btn-primario mt-6" onClick={aoFechar}>
              Voltar ao formulário
            </button>
          </>
        ) : (
          <>
            <img src="/img/logo-gelb-256.webp" alt="" className="mx-auto mb-4 size-20 animate-[pulse_2s_ease-in-out_infinite]" />
            <h2 className="flex items-center justify-center gap-2 text-lg font-bold">
              <Loader2 className="size-5 animate-spin text-marca" /> {g.etapa}
            </h2>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-ouro transition-all duration-700" style={{ width: `${g.caracteres ? pct : 5}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{g.caracteres ? `${Math.round(g.caracteres / 1000)} mil caracteres escritos` : 'Isso costuma levar de 30 segundos a 2 minutos.'}</p>
            <p className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-left text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {DICAS[dica]}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
