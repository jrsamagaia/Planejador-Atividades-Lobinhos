import { Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="size-5 animate-spin" /> {texto}
    </div>
  );
}

export function Vazio({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="cartao flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-marca/10 p-4 text-marca">{icone}</div>
      <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Modal({ titulo, aberto, aoFechar, children, rodape }: { titulo: string; aberto: boolean; aoFechar: () => void; children: ReactNode; rodape?: ReactNode }) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button className="btn-fantasma -mr-2 p-2" onClick={aoFechar} aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

export function Secao({ numero, titulo, children, extra }: { numero?: number; titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="cartao p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-base font-bold text-slate-900">
          {numero !== undefined && (
            <span className="flex size-7 items-center justify-center rounded-full bg-marca text-sm text-white">{numero}</span>
          )}
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Selo({ children, cor = 'slate' }: { children: ReactNode; cor?: 'slate' | 'marca' | 'ouro' | 'verde' | 'vermelho' }) {
  const cores = {
    slate: 'bg-slate-100 text-slate-700',
    marca: 'bg-marca/10 text-marca',
    ouro: 'bg-ouro/30 text-amber-900',
    verde: 'bg-emerald-100 text-emerald-800',
    vermelho: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cores[cor]}`}>{children}</span>;
}

export function confirmar(texto: string): boolean {
  return window.confirm(texto);
}
