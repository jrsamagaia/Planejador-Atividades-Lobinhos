import { Clock, Eye, EyeOff, Loader2, Pencil, Plus, Save, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Configuracoes, HorarioRapido, Papel, TermoAjuste, TipoAtividade, Usuario } from '../../shared/types';
import { api } from '../api';
import { Link } from '../components/Layout';
import { Cabecalho, Carregando, confirmar, Modal, Secao, Selo } from '../components/ui';
import { useCaminho, useSessao } from '../lib/contexto';

const ABAS = [
  { id: 'usuarios', rotulo: 'Pessoas' },
  { id: 'tipos', rotulo: 'Tipos de atividade' },
  { id: 'equipe', rotulo: 'Equipe e textos' },
  { id: 'grupo', rotulo: 'Grupo' },
];

export function Admin() {
  const { sessao } = useSessao();
  const { caminho } = useCaminho();
  if (sessao.usuario.papel !== 'admin') return <p className="py-10 text-center text-slate-500">Apenas o administrador acessa esta área.</p>;
  const aba = caminho.split('/')[2] || 'usuarios';

  return (
    <div>
      <Cabecalho titulo="Administração" subtitulo={`${sessao.secao.nome} · ${sessao.grupo.nome}`} />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            para={`/admin/${a.id}`}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${aba === a.id ? 'border-marca text-marca' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
      {aba === 'usuarios' && <Usuarios />}
      {aba === 'tipos' && <Tipos />}
      {aba === 'equipe' && <Equipe />}
      {aba === 'grupo' && <Grupo />}
    </div>
  );
}

// ---------- Pessoas ----------

const PAPEIS: { id: Papel; rotulo: string; descricao: string }[] = [
  { id: 'chefe', rotulo: 'Chefe', descricao: 'Cria planos e edita qualquer plano da seção.' },
  { id: 'assistente', rotulo: 'Assistente', descricao: 'Cria planos e edita só os próprios.' },
  { id: 'admin', rotulo: 'Administrador', descricao: 'Gerencia tudo: pessoas, biblioteca, tipos e configurações.' },
];

function Usuarios() {
  const { sessao, avisar } = useSessao();
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [modal, setModal] = useState<Usuario | 'novo' | null>(null);

  useEffect(() => {
    api.get<Usuario[]>('/admin/usuarios').then(setLista, (e) => avisar(e.message, 'erro'));
  }, [avisar]);

  async function alternarAtivo(u: Usuario) {
    try {
      const at = await api.patch<Usuario>(`/admin/usuarios/${u.id}`, { ativo: !u.ativo });
      setLista((l) => l!.map((x) => (x.id === at.id ? at : x)));
      avisar(at.ativo ? 'Acesso reativado.' : 'Acesso desativado.');
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  async function excluir(u: Usuario) {
    if (!confirmar(`Excluir ${u.email}?`)) return;
    try {
      await api.del(`/admin/usuarios/${u.id}`);
      setLista((l) => l!.filter((x) => x.id !== u.id));
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  if (!lista) return <Carregando />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-500">
          Cadastre o e-mail de cada pessoa. Ela entra no planejador digitando esse e-mail e recebendo um código, sem senha.
        </p>
        <button className="btn-primario" onClick={() => setModal('novo')}>
          <UserPlus className="size-4" /> Adicionar pessoa
        </button>
      </div>
      <ul className="cartao divide-y divide-slate-100">
        {lista.map((u) => (
          <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${u.ativo ? '' : 'opacity-60'}`}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-marca/10 font-bold text-marca">
              {(u.nome || u.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{u.nome || u.email}</span>
                <Selo cor={u.papel === 'admin' ? 'marca' : 'slate'}>{PAPEIS.find((p) => p.id === u.papel)?.rotulo}</Selo>
                {!u.ativo && <Selo cor="vermelho">sem acesso</Selo>}
                {u.id === sessao.usuario.id && <Selo cor="ouro">você</Selo>}
              </div>
              <div className="text-xs text-slate-500">
                {u.nome && `${u.email} · `}
                {u.ultimo_acesso ? `último acesso ${new Date(`${u.ultimo_acesso}Z`).toLocaleDateString('pt-BR')}` : 'ainda não entrou'}
              </div>
            </div>
            <div className="flex items-center">
              <button className="btn-fantasma p-2" onClick={() => setModal(u)} aria-label="Editar">
                <Pencil className="size-4" />
              </button>
              {u.id !== sessao.usuario.id && (
                <>
                  <button className="btn-fantasma p-2" onClick={() => alternarAtivo(u)} aria-label={u.ativo ? 'Desativar acesso' : 'Reativar acesso'} title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}>
                    {u.ativo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <button className="btn-perigo p-2" onClick={() => excluir(u)} aria-label="Excluir">
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {modal && (
        <ModalUsuario
          usuario={modal === 'novo' ? null : modal}
          aoFechar={() => setModal(null)}
          aoSalvar={(u) => setLista((l) => (l!.some((x) => x.id === u.id) ? l!.map((x) => (x.id === u.id ? u : x)) : [...l!, u]))}
        />
      )}
    </div>
  );
}

function ModalUsuario({ usuario, aoFechar, aoSalvar }: { usuario: Usuario | null; aoFechar: () => void; aoSalvar: (u: Usuario) => void }) {
  const { sessao, avisar } = useSessao();
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [papel, setPapel] = useState<Papel>(usuario?.papel ?? 'chefe');
  const [salvando, setSalvando] = useState(false);
  const eu = usuario?.id === sessao.usuario.id;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const u = usuario ? await api.patch<Usuario>(`/admin/usuarios/${usuario.id}`, { nome, papel }) : await api.post<Usuario>('/admin/usuarios', { email, nome, papel });
      aoSalvar(u);
      avisar(usuario ? 'Dados atualizados.' : `${u.email} já pode entrar no planejador.`);
      aoFechar();
    } catch (err) {
      avisar((err as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={usuario ? 'Editar pessoa' : 'Adicionar pessoa'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="u-e">
            E-mail
          </label>
          <input id="u-e" type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(usuario)} required autoFocus={!usuario} />
        </div>
        <div>
          <label className="rotulo" htmlFor="u-n">
            Nome (como aparece nos planos)
          </label>
          <input id="u-n" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Chefe Ana (Akelá)" />
        </div>
        <fieldset>
          <legend className="rotulo">Papel</legend>
          <div className="space-y-2">
            {PAPEIS.map((p) => (
              <label key={p.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${papel === p.id ? 'border-marca bg-marca/5' : 'border-slate-200'} ${eu && p.id !== 'admin' ? 'opacity-50' : ''}`}>
                <input type="radio" name="papel" className="mt-1 accent-marca" checked={papel === p.id} onChange={() => setPapel(p.id)} disabled={eu && p.id !== 'admin'} />
                <span>
                  <span className="block font-semibold">{p.rotulo}</span>
                  <span className="text-sm text-slate-500">{p.descricao}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="btn-primario" disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Tipos de atividade ----------

function Tipos() {
  const { avisar, recarregar } = useSessao();
  const [tipos, setTipos] = useState<TipoAtividade[] | null>(null);
  const [modal, setModal] = useState<TipoAtividade | 'novo' | null>(null);

  useEffect(() => {
    api.get<TipoAtividade[]>('/admin/tipos').then(setTipos, (e) => avisar(e.message, 'erro'));
  }, [avisar]);

  async function atualizar(id: number, m: Partial<TipoAtividade>) {
    try {
      setTipos(await api.patch<TipoAtividade[]>(`/admin/tipos/${id}`, m));
      recarregar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  if (!tipos) return <Carregando />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-500">
          Os tipos aparecem como opções no "Novo plano". A descrição é enviada ao Gemini e ajuda a planejar do jeito certo.
        </p>
        <button className="btn-primario" onClick={() => setModal('novo')}>
          <Plus className="size-4" /> Novo tipo
        </button>
      </div>
      <ul className="cartao divide-y divide-slate-100">
        {tipos.map((t, i) => (
          <li key={t.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${t.ativo ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{t.nome}</span>
                <Selo>{t.modo === 'bloco' ? `${t.hora_inicio}–${t.hora_fim}` : `${t.dias} dia${t.dias > 1 ? 's' : ''} · por períodos`}</Selo>
                {!t.ativo && <Selo cor="vermelho">oculto</Selo>}
              </div>
              {t.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.descricao}</p>}
            </div>
            <div className="flex items-center">
              <button className="btn-fantasma px-2 text-xs" disabled={i === 0} onClick={() => atualizar(t.id, { ordem: tipos[i - 1].ordem - 1 })} aria-label="Subir">
                ↑
              </button>
              <button className="btn-fantasma p-2" onClick={() => setModal(t)} aria-label="Editar">
                <Pencil className="size-4" />
              </button>
              <button className="btn-fantasma p-2" onClick={() => atualizar(t.id, { ativo: !t.ativo })} aria-label={t.ativo ? 'Ocultar' : 'Mostrar'} title={t.ativo ? 'Ocultar' : 'Mostrar'}>
                {t.ativo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {modal && (
        <ModalTipo
          tipo={modal === 'novo' ? null : modal}
          aoFechar={() => setModal(null)}
          aoSalvar={(lista) => {
            setTipos(lista);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function ModalTipo({ tipo, aoFechar, aoSalvar }: { tipo: TipoAtividade | null; aoFechar: () => void; aoSalvar: (l: TipoAtividade[]) => void }) {
  const { avisar } = useSessao();
  type Campos = Pick<TipoAtividade, 'nome' | 'descricao' | 'modo' | 'dias' | 'hora_inicio' | 'hora_fim'>;
  const [t, setT] = useState<Campos>(() =>
    tipo ? { nome: tipo.nome, descricao: tipo.descricao, modo: tipo.modo, dias: tipo.dias, hora_inicio: tipo.hora_inicio, hora_fim: tipo.hora_fim } : { nome: '', descricao: '', modo: 'bloco', dias: 1, hora_inicio: '14:00', hora_fim: '16:30' },
  );
  const set = (m: Partial<Campos>) => setT((a) => ({ ...a, ...m }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      aoSalvar(tipo ? await api.patch<TipoAtividade[]>(`/admin/tipos/${tipo.id}`, t) : await api.post<TipoAtividade[]>('/admin/tipos', t));
      aoFechar();
    } catch (err) {
      avisar((err as Error).message, 'erro');
    }
  }

  return (
    <Modal titulo={tipo ? 'Editar tipo de atividade' : 'Novo tipo de atividade'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="t-n">
            Nome
          </label>
          <input id="t-n" className="campo" value={t.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Jornada, Ação comunitária" required />
        </div>
        <div>
          <label className="rotulo" htmlFor="t-d">
            Descrição para o Gemini
          </label>
          <textarea id="t-d" className="campo" rows={3} value={t.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="O que caracteriza esta atividade, cuidados e o que não pode faltar." />
        </div>
        <fieldset>
          <legend className="rotulo">Formato</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['bloco', 'Um bloco de horário', 'Reunião, saída de algumas horas'],
                ['periodos', 'Dias com períodos', 'Bivaque, acampamento, acantonamento'],
              ] as const
            ).map(([id, r, d]) => (
              <label key={id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${t.modo === id ? 'border-marca bg-marca/5' : 'border-slate-200'}`}>
                <input type="radio" name="modo" className="mt-1 accent-marca" checked={t.modo === id} onChange={() => set({ modo: id })} />
                <span>
                  <span className="block text-sm font-semibold">{r}</span>
                  <span className="text-xs text-slate-500">{d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {t.modo === 'bloco' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="t-hi">
                Início padrão
              </label>
              <input id="t-hi" type="time" className="campo" value={t.hora_inicio} onChange={(e) => set({ hora_inicio: e.target.value })} />
            </div>
            <div>
              <label className="rotulo" htmlFor="t-hf">
                Fim padrão
              </label>
              <input id="t-hf" type="time" className="campo" value={t.hora_fim} onChange={(e) => set({ hora_fim: e.target.value })} />
            </div>
          </div>
        ) : (
          <div>
            <label className="rotulo" htmlFor="t-dias">
              Dias (padrão)
            </label>
            <input id="t-dias" type="number" min={1} max={7} className="campo w-28" value={t.dias} onChange={(e) => set({ dias: Number(e.target.value) })} />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="btn-primario">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Equipe, termos e horários ----------

function Equipe() {
  const { sessao, avisar, recarregar } = useSessao();
  const [c, setC] = useState<Configuracoes>(() => structuredClone(sessao.config));
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const mudou = JSON.stringify(c) !== JSON.stringify(sessao.config);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/admin/config', c);
      await recarregar();
      avisar('Configurações salvas.');
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const termo = (i: number, m: Partial<TermoAjuste>) => setC({ ...c, termosAjuste: c.termosAjuste.map((t, j) => (j === i ? { ...t, ...m } : t)) });
  const horario = (i: number, m: Partial<HorarioRapido>) => setC({ ...c, horariosRapidos: c.horariosRapidos.map((t, j) => (j === i ? { ...t, ...m } : t)) });

  return (
    <div className="space-y-5">
      <Secao titulo="Velhos Lobos da Alcateia">
        <p className="ajuda -mt-2 mb-3">Nomes de Jângal usados nos planos para distribuir as responsabilidades.</p>
        <div className="flex flex-wrap gap-2">
          {c.velhosLobos.map((v) => (
            <span key={v} className="chip-off pr-1.5">
              {v}
              <button className="rounded-full p-0.5 hover:bg-slate-100" onClick={() => setC({ ...c, velhosLobos: c.velhosLobos.filter((x) => x !== v) })} aria-label={`Remover ${v}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-3 flex max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = novo.trim();
            if (n && !c.velhosLobos.includes(n)) setC({ ...c, velhosLobos: [...c.velhosLobos, n] });
            setNovo('');
          }}
        >
          <input className="campo" placeholder="Ex.: Raksha, Mang, Tha" value={novo} onChange={(e) => setNovo(e.target.value)} />
          <button className="btn-secundario shrink-0">
            <Plus className="size-4" /> Adicionar
          </button>
        </form>
      </Secao>

      <Secao titulo="Horários rápidos de reunião">
        <p className="ajuda -mt-2 mb-3">Atalhos que aparecem no "Quando?" de atividades de um bloco.</p>
        <div className="space-y-2">
          {c.horariosRapidos.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Clock className="size-4 text-slate-400" />
              <input className="campo w-56 flex-1 py-2" value={h.rotulo} onChange={(e) => horario(i, { rotulo: e.target.value })} aria-label="Nome do horário" />
              <input type="time" className="campo w-28 py-2" value={h.inicio} onChange={(e) => horario(i, { inicio: e.target.value })} aria-label="Início" />
              <input type="time" className="campo w-28 py-2" value={h.fim} onChange={(e) => horario(i, { fim: e.target.value })} aria-label="Fim" />
              <button className="btn-perigo p-2" onClick={() => setC({ ...c, horariosRapidos: c.horariosRapidos.filter((_, j) => j !== i) })} aria-label="Remover">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button className="btn-fantasma mt-2" onClick={() => setC({ ...c, horariosRapidos: [...c.horariosRapidos, { rotulo: 'Novo horário', inicio: '14:00', fim: '16:30' }] })}>
          <Plus className="size-4" /> Adicionar horário
        </button>
      </Secao>

      <Secao titulo="Termos de ajuste">
        <p className="ajuda -mt-2 mb-3">Depois que o Gemini escreve o plano, estes termos são trocados automaticamente.</p>
        <div className="space-y-2">
          {c.termosAjuste.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Usar</span>
              <input className="campo w-48 flex-1 py-2" value={t.usar} onChange={(e) => termo(i, { usar: e.target.value })} aria-label="Usar" />
              <span className="text-slate-500">em vez de</span>
              <input className="campo w-48 flex-1 py-2" value={t.emVezDe} onChange={(e) => termo(i, { emVezDe: e.target.value })} aria-label="Em vez de" />
              <button className="btn-perigo p-2" onClick={() => setC({ ...c, termosAjuste: c.termosAjuste.filter((_, j) => j !== i) })} aria-label="Remover">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button className="btn-fantasma mt-2" onClick={() => setC({ ...c, termosAjuste: [...c.termosAjuste, { usar: '', emVezDe: '' }] })}>
          <Plus className="size-4" /> Adicionar termo
        </button>
      </Secao>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex justify-end md:bottom-4">
        <button className="btn-primario shadow-xl" onClick={salvar} disabled={!mudou || salvando}>
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar alterações
        </button>
      </div>
    </div>
  );
}

// ---------- Grupo ----------

function Grupo() {
  const { sessao, avisar, recarregar } = useSessao();
  const [g, setG] = useState({
    nome: sessao.grupo.nome,
    numeral: sessao.grupo.numeral ?? '',
    cor_primaria: sessao.grupo.cor_primaria,
    cor_secundaria: sessao.grupo.cor_secundaria,
    secao_nome: sessao.secao.nome,
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.patch('/admin/grupo', g);
      await recarregar();
      avisar('Dados do grupo salvos.');
    } catch (err) {
      avisar((err as Error).message, 'erro');
    }
  }

  return (
    <form onSubmit={salvar} className="max-w-xl space-y-5">
      <Secao titulo="Identificação">
        <div className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="g-n">
              Nome do grupo
            </label>
            <input id="g-n" className="campo" value={g.nome} onChange={(e) => setG({ ...g, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="g-num">
                Numeral / região
              </label>
              <input id="g-num" className="campo" value={g.numeral} onChange={(e) => setG({ ...g, numeral: e.target.value })} placeholder="32/SC" />
            </div>
            <div>
              <label className="rotulo" htmlFor="g-s">
                Nome da seção
              </label>
              <input id="g-s" className="campo" value={g.secao_nome} onChange={(e) => setG({ ...g, secao_nome: e.target.value })} />
            </div>
          </div>
        </div>
      </Secao>
      <Secao titulo="Cores">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['cor_primaria', 'Principal'],
              ['cor_secundaria', 'Destaque'],
            ] as const
          ).map(([k, r]) => (
            <label key={k} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input type="color" className="size-10 cursor-pointer rounded border-0 bg-transparent" value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} />
              <span>
                <span className="block text-sm font-semibold">{r}</span>
                <span className="font-mono text-xs uppercase text-slate-500">{g[k]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="ajuda mt-3">As cores são usadas no planejador e nos PDFs e documentos do Word.</p>
      </Secao>
      <div className="flex justify-end">
        <button className="btn-primario">
          <Save className="size-4" /> Salvar
        </button>
      </div>
    </form>
  );
}
