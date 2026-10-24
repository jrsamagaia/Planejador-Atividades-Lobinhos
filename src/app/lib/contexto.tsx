import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Sessao } from '../../shared/types';

// ---------- Roteamento simples (History API) ----------

export function navegar(caminho: string) {
  if (caminho === location.pathname + location.search) return;
  history.pushState(null, '', caminho);
  dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function useCaminho(): { caminho: string; busca: URLSearchParams } {
  const [estado, setEstado] = useState(() => ({ caminho: location.pathname, busca: new URLSearchParams(location.search) }));
  useEffect(() => {
    const atualizar = () => setEstado({ caminho: location.pathname, busca: new URLSearchParams(location.search) });
    addEventListener('popstate', atualizar);
    return () => removeEventListener('popstate', atualizar);
  }, []);
  return estado;
}

// ---------- Sessão e avisos ----------

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'erro';
}

interface Contexto {
  sessao: Sessao;
  recarregar: () => Promise<void>;
  avisar: (texto: string, tipo?: 'ok' | 'erro') => void;
}

const Ctx = createContext<Contexto | null>(null);

export function ProvedorSessao({ sessao, recarregar, children }: { sessao: Sessao; recarregar: () => Promise<void>; children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 7000 : 3500);
  }, []);

  return (
    <Ctx.Provider value={{ sessao, recarregar, avisar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${a.tipo === 'erro' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useSessao(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSessao fora do ProvedorSessao');
  return c;
}

// ---------- Utilidades ----------

export function formatarData(iso: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarPeriodo(inicio: string, fim: string): string {
  return inicio === fim ? formatarData(inicio) : `${formatarData(inicio)} a ${formatarData(fim)}`;
}

export function formatarTamanho(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function proximoSabado(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return dataLocal(d);
}

export function dataLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}
