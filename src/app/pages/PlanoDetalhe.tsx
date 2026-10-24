import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Copy,
  CloudRain,
  FileDown,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Atividade, ConteudoPlano, Plano } from '../../shared/types';
import { api } from '../api';
import { Link } from '../components/Layout';
import { Carregando, confirmar, Selo, Vazio } from '../components/ui';
import { formatarPeriodo, navegar, useSessao } from '../lib/contexto';

const ATIVIDADE_VAZIA: Atividade = {
  horaInicio: '',
  duracao: '15 min',
  tipo: '',
  nome: 'Nova atividade',
  responsavel: '',
  material: '',
  areaDesenvolvimento: '',
  descricao: '',
  fundoDeCena: '',
  planoB: '',
};

export function PlanoDetalhe({ id }: { id: number }) {
  const { sessao, avisar } = useSessao();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [edicao, setEdicao] = useState<{ titulo: string; conteudo: ConteudoPlano } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState<'' | 'pdf' | 'docx'>('');
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    api.get<Plano>(`/planos/${id}`).then(setPlano, (e) => (e.status === 404 ? setNaoEncontrado(true) : avisar(e.message, 'erro')));
  }, [id, avisar]);

  // Avisa antes de sair com alterações não salvas
  useEffect(() => {
    if (!edicao) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', aviso);
    return () => removeEventListener('beforeunload', aviso);
  }, [edicao]);

  if (naoEncontrado)
    return (
      <Vazio icone={<FileText className="size-7" />} titulo="Plano não encontrado">
        <Link para="/" className="btn-secundario mt-4">
          Voltar para os planos
        </Link>
      </Vazio>
    );
  if (!plano) return <Carregando />;

  const u = sessao.usuario;
  const podeEditar = u.papel !== 'assistente' || plano.autor_id === u.id;
  const conteudo = edicao?.conteudo ?? plano.conteudo;
  const p = plano.parametros;
  const tipo = sessao.tipos.find((t) => t.id === plano.tipo_id);

  async function salvar() {
    if (!edicao) return;
    setSalvando(true);
    try {
      const atualizado = await api.put<Plano>(`/planos/${id}`, edicao);
      setPlano(atualizado);
      setEdicao(null);
      avisar('Alterações salvas.');
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function exportar(formato: 'pdf' | 'docx') {
    setMenu(false);
    setExportando(formato);
    try {
      const atual = { ...plano!, titulo: edicao?.titulo ?? plano!.titulo, conteudo };
      if (formato === 'pdf') await (await import('../lib/exportar-pdf')).exportarPdf(atual, sessao);
      else await (await import('../lib/exportar-docx')).exportarDocx(atual, sessao);
    } catch (e) {
      console.error(e);
      avisar('Não foi possível gerar o arquivo. Tente de novo.', 'erro');
    } finally {
      setExportando('');
    }
  }

  async function duplicar() {
    setMenu(false);
    try {
      const novo = await api.post<Plano>(`/planos/${id}/duplicar`);
      avisar('Cópia criada.');
      navegar(`/planos/${novo.id}`);
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  async function excluir() {
    setMenu(false);
    if (!confirmar(`Excluir o plano "${plano!.titulo}"? Isso não pode ser desfeito.`)) return;
    try {
      await api.del(`/planos/${id}`);
      avisar('Plano excluído.');
      navegar('/');
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  const mudarAtividade = (i: number, m: Partial<Atividade>) =>
    setEdicao((ed) => ed && { ...ed, conteudo: { ...ed.conteudo, atividades: ed.conteudo.atividades.map((a, j) => (j === i ? { ...a, ...m } : a)) } });
  const moverAtividade = (i: number, d: -1 | 1) =>
    setEdicao((ed) => {
      if (!ed) return ed;
      const lista = [...ed.conteudo.atividades];
      const j = i + d;
      if (j < 0 || j >= lista.length) return ed;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...ed, conteudo: { ...ed.conteudo, atividades: lista } };
    });
  const removerAtividade = (i: number) =>
    confirmar('Remover esta atividade do plano?') &&
    setEdicao((ed) => ed && { ...ed, conteudo: { ...ed.conteudo, atividades: ed.conteudo.atividades.filter((_, j) => j !== i) } });
  const inserirAtividade = (i: number) =>
    setEdicao((ed) => {
      if (!ed) return ed;
      const lista = [...ed.conteudo.atividades];
      const ref = lista[i];
      lista.splice(i + 1, 0, { ...ATIVIDADE_VAZIA, dia: ref?.dia, periodo: ref?.periodo, horaInicio: ref?.horaInicio ?? '' });
      return { ...ed, conteudo: { ...ed.conteudo, atividades: lista } };
    });

  return (
    <div className="mx-auto max-w-4xl">
      <Link para="/" className="nao-imprimir mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-marca">
        <ArrowLeft className="size-4" /> Planos
      </Link>

      <header className="cartao mb-5 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-marca via-marca to-ouro" />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {plano.tipo_nome && <Selo cor="marca">{plano.tipo_nome}</Selo>}
            {p.caminho !== 'Todos' && <Selo>{p.caminho.replace(/\s*\(.*\)/, '')}</Selo>}
            {p.eixo !== 'Todos' && <Selo>{p.eixo}{p.bloco !== 'Todos' ? ` · ${p.bloco}` : ''}</Selo>}
          </div>
          {edicao ? (
            <input className="campo mt-3 text-xl font-bold" value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} aria-label="Nome do plano" />
          ) : (
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{plano.titulo}</h1>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatarPeriodo(plano.data_inicio, plano.data_fim)}
              {tipo?.modo === 'bloco' && ` · ${p.horaInicio} às ${p.horaFim}`}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="size-4" /> {plano.autor_nome} · Velho Lobo principal: {p.velhoLoboPrincipal}
            </span>
          </div>

          <div className="nao-imprimir mt-5 flex flex-wrap gap-2">
            {edicao ? (
              <>
                <button className="btn-primario" onClick={salvar} disabled={salvando}>
                  {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
                </button>
                <button className="btn-secundario" onClick={() => confirmar('Descartar as alterações?') && setEdicao(null)}>
                  <X className="size-4" /> Cancelar
                </button>
              </>
            ) : (
              <>
                <button className="btn-primario" onClick={() => exportar('pdf')} disabled={Boolean(exportando)}>
                  {exportando === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF
                </button>
                <button className="btn-secundario" onClick={() => exportar('docx')} disabled={Boolean(exportando)}>
                  {exportando === 'docx' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Word
                </button>
                {podeEditar && (
                  <button className="btn-secundario" onClick={() => setEdicao({ titulo: plano.titulo, conteudo: structuredClone(plano.conteudo) })}>
                    <Pencil className="size-4" /> Editar
                  </button>
                )}
                <div className="relative">
                  <button className="btn-fantasma" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Mais ações">
                    <MoreHorizontal className="size-5" />
                  </button>
                  {menu && (
                    <div className="absolute left-0 z-20 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-xl sm:left-auto sm:right-0">
                      <Link para={`/novo?base=${plano.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                        <RefreshCw className="size-4" /> Gerar de novo com ajustes
                      </Link>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={duplicar}>
                        <Copy className="size-4" /> Duplicar
                      </button>
                      {podeEditar && (
                        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={excluir}>
                          <Trash2 className="size-4" /> Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <Cronograma
        atividades={conteudo.atividades}
        editando={Boolean(edicao)}
        aoMudar={mudarAtividade}
        aoMover={moverAtividade}
        aoRemover={removerAtividade}
        aoInserir={inserirAtividade}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(
          [
            ['cicloPrograma', 'Ciclo de Programa'],
            ['diferenciacaoEtaria', 'Diferenciação por idade'],
            ['recursosMateriais', 'Recursos materiais'],
            ['recursosHumanos', 'Equipe e papéis'],
          ] as const
        ).map(([chave, titulo]) => (
          <section key={chave} className="cartao p-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-marca">{titulo}</h2>
            {edicao ? (
              <TextoAuto valor={conteudo[chave]} aoMudar={(v) => setEdicao({ ...edicao, conteudo: { ...edicao.conteudo, [chave]: v } })} />
            ) : (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{conteudo[chave]}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function TextoAuto({ valor, aoMudar, linhas = 3 }: { valor: string; aoMudar: (v: string) => void; linhas?: number }) {
  return <textarea className="campo text-sm leading-relaxed [field-sizing:content]" rows={linhas} value={valor} onChange={(e) => aoMudar(e.target.value)} />;
}

function Cronograma({
  atividades,
  editando,
  aoMudar,
  aoMover,
  aoRemover,
  aoInserir,
}: {
  atividades: Atividade[];
  editando: boolean;
  aoMudar: (i: number, m: Partial<Atividade>) => void;
  aoMover: (i: number, d: -1 | 1) => void;
  aoRemover: (i: number) => void;
  aoInserir: (i: number) => void;
}) {
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const grupos = useMemo(() => {
    const g: { titulo: string; itens: { a: Atividade; i: number }[] }[] = [];
    atividades.forEach((a, i) => {
      const titulo = [a.dia, a.periodo].filter(Boolean).join(' · ');
      if (!g.length || g[g.length - 1].titulo !== titulo) g.push({ titulo, itens: [] });
      g[g.length - 1].itens.push({ a, i });
    });
    return g;
  }, [atividades]);
  const todasAbertas = abertas.size === atividades.length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Cronograma · {atividades.length} atividades</h2>
        {!editando && (
          <button className="btn-fantasma text-xs" onClick={() => setAbertas(todasAbertas ? new Set() : new Set(atividades.map((_, i) => i)))}>
            {todasAbertas ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        )}
      </div>
      <div className="space-y-6">
        {grupos.map((g, gi) => (
          <div key={gi}>
            {g.titulo && <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">{g.titulo}</h3>}
            <ol className="relative space-y-3 border-l-2 border-marca/15 pl-5">
              {g.itens.map(({ a, i }) => {
                const aberta = editando || abertas.has(i);
                return (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-5 size-3 rounded-full border-2 border-white bg-marca shadow" />
                    <article className="cartao overflow-hidden">
                      {editando ? (
                        <EditorAtividade
                          a={a}
                          aoMudar={(m) => aoMudar(i, m)}
                          aoMover={(d) => aoMover(i, d)}
                          aoRemover={() => aoRemover(i)}
                          aoInserir={() => aoInserir(i)}
                          primeira={i === 0}
                          ultima={i === atividades.length - 1}
                        />
                      ) : (
                        <>
                          <button
                            className="flex w-full items-start gap-4 p-4 text-left"
                            aria-expanded={aberta}
                            onClick={() => setAbertas((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set(s).add(i)))}
                          >
                            <div className="w-14 shrink-0 text-center">
                              <div className="font-bold tabular-nums text-marca">{a.horaInicio}</div>
                              <div className="text-xs text-slate-500">{a.duracao}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-slate-900">{a.nome}</h4>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                {a.tipo && <span>{a.tipo}</span>}
                                {a.responsavel && <span className="font-medium text-slate-700">{a.responsavel}</span>}
                              </div>
                            </div>
                            <ChevronDown className={`mt-1 size-5 shrink-0 text-slate-400 transition ${aberta ? 'rotate-180' : ''}`} />
                          </button>
                          {aberta && <DetalheAtividade a={a} />}
                        </>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetalheAtividade({ a }: { a: Atividade }) {
  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4 text-sm leading-relaxed md:pl-[88px]">
      <p className="whitespace-pre-line text-slate-700">{a.descricao}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {a.material && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Material</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-700">{a.material}</dd>
          </div>
        )}
        {a.areaDesenvolvimento && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Áreas de desenvolvimento</dt>
            <dd className="mt-0.5 text-slate-700">{a.areaDesenvolvimento}</dd>
          </div>
        )}
      </dl>
      {a.fundoDeCena && (
        <div className="rounded-xl bg-marca/5 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-marca">Fundo de cena</div>
          <p className="mt-1 whitespace-pre-line text-slate-700">{a.fundoDeCena}</p>
        </div>
      )}
      {a.planoB && (
        <div className="rounded-xl bg-sky-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-800">
            <CloudRain className="size-3.5" /> Plano B (chuva)
          </div>
          <p className="mt-1 whitespace-pre-line text-slate-700">{a.planoB}</p>
        </div>
      )}
    </div>
  );
}

function EditorAtividade({
  a,
  aoMudar,
  aoMover,
  aoRemover,
  aoInserir,
  primeira,
  ultima,
}: {
  a: Atividade;
  aoMudar: (m: Partial<Atividade>) => void;
  aoMover: (d: -1 | 1) => void;
  aoRemover: () => void;
  aoInserir: () => void;
  primeira: boolean;
  ultima: boolean;
}) {
  const campo = (k: keyof Atividade, rotulo: string, grande = false) => (
    <div className={grande ? 'sm:col-span-4' : ''}>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{rotulo}</label>
      {grande ? (
        <TextoAuto valor={a[k] ?? ''} aoMudar={(v) => aoMudar({ [k]: v })} linhas={k === 'descricao' ? 5 : 2} />
      ) : (
        <input className="campo py-2 text-sm" value={a[k] ?? ''} onChange={(e) => aoMudar({ [k]: e.target.value })} />
      )}
    </div>
  );
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-1">
        <span className="text-sm font-semibold text-slate-500">Atividade</span>
        <div className="ml-auto flex gap-1">
          <button className="btn-fantasma p-2" onClick={() => aoMover(-1)} disabled={primeira} aria-label="Mover para cima">
            <ArrowUp className="size-4" />
          </button>
          <button className="btn-fantasma p-2" onClick={() => aoMover(1)} disabled={ultima} aria-label="Mover para baixo">
            <ArrowDown className="size-4" />
          </button>
          <button className="btn-fantasma p-2" onClick={aoInserir} aria-label="Inserir atividade abaixo">
            <Plus className="size-4" />
          </button>
          <button className="btn-perigo p-2" onClick={aoRemover} aria-label="Remover atividade">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {campo('horaInicio', 'Início')}
        {campo('duracao', 'Duração')}
        {campo('tipo', 'Tipo')}
        {campo('responsavel', 'Responsável')}
        <div className="sm:col-span-4">{campo('nome', 'Nome')}</div>
        {campo('descricao', 'Passo a passo', true)}
        {campo('material', 'Material', true)}
        {campo('areaDesenvolvimento', 'Áreas de desenvolvimento', true)}
        {campo('fundoDeCena', 'Fundo de cena', true)}
        {campo('planoB', 'Plano B (chuva)', true)}
      </div>
    </div>
  );
}
