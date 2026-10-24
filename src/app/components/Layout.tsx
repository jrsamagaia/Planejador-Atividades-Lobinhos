import { ClipboardList, Library, LogOut, Plus, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { navegar, useCaminho, useSessao } from '../lib/contexto';

const PAPEL: Record<string, string> = { admin: 'Administrador', chefe: 'Chefe', assistente: 'Assistente' };

export function Link({ para, className, children, ...resto }: { para: string; className?: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={para}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navegar(para);
      }}
      {...resto}
    >
      {children}
    </a>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  const { caminho } = useCaminho();
  const admin = sessao.usuario.papel === 'admin';

  const itens = [
    { para: '/', rotulo: 'Planos', icone: ClipboardList, ativo: caminho === '/' || caminho.startsWith('/planos') },
    { para: '/novo', rotulo: 'Novo plano', icone: Plus, ativo: caminho === '/novo', destaque: true },
    { para: '/biblioteca', rotulo: 'Biblioteca', icone: Library, ativo: caminho === '/biblioteca' },
    ...(admin ? [{ para: '/admin', rotulo: 'Admin', icone: Settings, ativo: caminho.startsWith('/admin') }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="nao-imprimir sticky top-0 z-30 border-b border-white/10 bg-marca text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link para="/" className="flex min-w-0 items-center gap-3">
            <img src={sessao.grupo.logo_url || '/img/logo-gelb-256.webp'} alt="" className="size-10 shrink-0 rounded-full bg-white" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold">Planejador da Alcateia</div>
              <div className="truncate text-xs text-white/70">
                {sessao.secao.nome} · {sessao.grupo.nome.replace('Grupo Escoteiro ', 'GE ')}
              </div>
            </div>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {itens.map((i) =>
              i.destaque ? (
                <Link key={i.para} para={i.para} className="btn ml-2 bg-ouro text-marca-escura hover:brightness-95">
                  <i.icone className="size-4" /> {i.rotulo}
                </Link>
              ) : (
                <Link
                  key={i.para}
                  para={i.para}
                  className={`btn ${i.ativo ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                >
                  <i.icone className="size-4" /> {i.rotulo}
                </Link>
              ),
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-2">
            <div className="hidden text-right text-xs leading-tight lg:block">
              <div className="font-semibold">{sessao.usuario.nome || sessao.usuario.email}</div>
              <div className="text-white/70">{PAPEL[sessao.usuario.papel]}</div>
            </div>
            {sessao.logoutUrl && (
              <a href={sessao.logoutUrl} className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white" title="Sair" aria-label="Sair">
                <LogOut className="size-5" />
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:pb-12 md:pt-8">{children}</main>

      <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {itens.map((i) => (
            <Link
              key={i.para}
              para={i.para}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${i.ativo ? 'text-marca' : 'text-slate-500'}`}
            >
              {i.destaque ? (
                <span className="-mt-5 mb-0.5 flex size-12 items-center justify-center rounded-full bg-ouro text-marca-escura shadow-lg ring-4 ring-white">
                  <i.icone className="size-6" />
                </span>
              ) : (
                <i.icone className="size-5" />
              )}
              {i.rotulo}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
