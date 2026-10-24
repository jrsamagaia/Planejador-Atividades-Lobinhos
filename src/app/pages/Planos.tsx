import { CalendarDays, ChevronRight, ClipboardList, Plus, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PlanoResumo } from '../../shared/types';
import { api } from '../api';
import { Link } from '../components/Layout';
import { Cabecalho, Carregando, Selo, Vazio } from '../components/ui';
import { dataLocal, formatarPeriodo, useSessao } from '../lib/contexto';

export function Planos() {
  const { sessao, avisar } = useSessao();
  const [planos, setPlanos] = useState<PlanoResumo[] | null>(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<number | 0>(0);
  const [meus, setMeus] = useState(false);

  useEffect(() => {
    api.get<PlanoResumo[]>('/planos').then(setPlanos, (e) => avisar(e.message, 'erro'));
  }, [avisar]);

  const hoje = dataLocal(new Date());
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (planos ?? []).filter(
      (p) =>
        (!q || p.titulo.toLowerCase().includes(q) || p.autor_nome.toLowerCase().includes(q)) &&
        (!tipo || p.tipo_id === tipo) &&
        (!meus || p.autor_id === sessao.usuario.id),
    );
  }, [planos, busca, tipo, meus, sessao.usuario.id]);

  const proximos = filtrados.filter((p) => p.data_fim >= hoje).reverse();
  const anteriores = filtrados.filter((p) => p.data_fim < hoje);
  const primeiroNome = (sessao.usuario.nome || '').split(' ')[0];

  return (
    <div>
      <Cabecalho
        titulo={primeiroNome ? `Olá, ${primeiroNome}!` : 'Planos da Alcateia'}
        subtitulo="Todos os planos da seção, do próximo sábado ao histórico."
        acoes={
          <Link para="/novo" className="btn-primario hidden md:inline-flex">
            <Plus className="size-4" /> Novo plano
          </Link>
        }
      />

      {!sessao.geminiConfigurado && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          A chave do Gemini ainda não foi configurada no servidor, então a geração de planos não vai funcionar.
          {sessao.usuario.papel === 'admin' && ' Veja o passo "Segredos" no README do projeto.'}
        </div>
      )}

      {planos === null ? (
        <Carregando />
      ) : planos.length === 0 ? (
        <Vazio icone={<Sparkles className="size-7" />} titulo="Nenhum plano ainda">
          <p>Crie o primeiro plano: escolha o tipo de atividade, conte a ideia e o Gemini monta a programação completa.</p>
          <Link para="/novo" className="btn-primario mt-5">
            <Plus className="size-4" /> Criar o primeiro plano
          </Link>
        </Vazio>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className="campo pl-9" placeholder="Buscar por nome ou autor" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button className={meus ? 'chip-on' : 'chip-off'} onClick={() => setMeus(!meus)}>
                Só os meus
              </button>
              {sessao.tipos.map((t) => (
                <button key={t.id} className={tipo === t.id ? 'chip-on' : 'chip-off'} onClick={() => setTipo(tipo === t.id ? 0 : t.id)}>
                  {t.nome}
                </button>
              ))}
            </div>
          </div>

          {filtrados.length === 0 && <p className="py-10 text-center text-slate-500">Nenhum plano encontrado com esses filtros.</p>}
          {proximos.length > 0 && <Lista titulo="Próximos" planos={proximos} destaque />}
          {anteriores.length > 0 && <Lista titulo="Anteriores" planos={anteriores} />}
        </>
      )}
    </div>
  );
}

function Lista({ titulo, planos, destaque }: { titulo: string; planos: PlanoResumo[]; destaque?: boolean }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{titulo}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {planos.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <Link
              para={`/planos/${p.id}`}
              className={`cartao group flex items-center gap-4 p-4 transition hover:border-marca/40 hover:shadow-md ${destaque && i === 0 ? 'ring-2 ring-ouro' : ''}`}
            >
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-marca/10 text-marca">
                <span className="text-lg font-bold leading-none">{p.data_inicio.slice(8, 10)}</span>
                <span className="text-[10px] font-semibold uppercase">
                  {new Date(`${p.data_inicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-900">{p.titulo}</h3>
                  {destaque && i === 0 && <Selo cor="ouro">Próximo</Selo>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {p.tipo_nome && (
                    <span className="flex items-center gap-1">
                      <ClipboardList className="size-3.5" /> {p.tipo_nome}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" /> {formatarPeriodo(p.data_inicio, p.data_fim)}
                  </span>
                  <span>por {p.autor_nome}</span>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-marca" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
