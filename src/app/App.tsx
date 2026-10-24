import { Loader2, LockKeyhole, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Sessao } from '../shared/types';
import { api, ErroApi } from './api';
import { Layout } from './components/Layout';
import { ProvedorSessao, useCaminho } from './lib/contexto';
import { Admin } from './pages/Admin';
import { Biblioteca } from './pages/Biblioteca';
import { Planejar } from './pages/Planejar';
import { PlanoDetalhe } from './pages/PlanoDetalhe';
import { Planos } from './pages/Planos';

export function App() {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);

  const carregar = useCallback(async () => {
    try {
      const s = await api.get<Sessao>('/sessao');
      setSessao(s);
      setErro(null);
      document.documentElement.style.setProperty('--color-marca', s.grupo.cor_primaria);
      document.documentElement.style.setProperty('--color-ouro', s.grupo.cor_secundaria);
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi(String(e), 0));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (erro) return <TelaErro erro={erro} />;
  if (!sessao)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500">
        <img src="/img/logo-gelb-256.webp" alt="" className="size-20 animate-pulse" />
        <Loader2 className="size-5 animate-spin" />
      </div>
    );

  return (
    <ProvedorSessao sessao={sessao} recarregar={carregar}>
      <Layout>
        <Rotas />
      </Layout>
    </ProvedorSessao>
  );
}

function Rotas() {
  const { caminho } = useCaminho();
  const plano = caminho.match(/^\/planos\/(\d+)$/);
  if (plano) return <PlanoDetalhe key={plano[1]} id={Number(plano[1])} />;
  if (caminho === '/novo') return <Planejar />;
  if (caminho === '/biblioteca') return <Biblioteca />;
  if (caminho.startsWith('/admin')) return <Admin />;
  return <Planos />;
}

function TelaErro({ erro }: { erro: ErroApi }) {
  const semAcesso = erro.codigo === 'sem_acesso';
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-marca to-marca-escura p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <img src="/img/logo-gelb-256.webp" alt="Grupo Escoteiro Leões de Blumenau" className="mx-auto mb-5 size-24" />
        {semAcesso ? (
          <>
            <LockKeyhole className="mx-auto mb-3 size-8 text-amber-500" />
            <h1 className="text-xl font-bold">Acesso ainda não liberado</h1>
            <p className="mt-2 text-sm text-slate-600">
              Você entrou como <strong>{erro.email}</strong>, mas este e-mail ainda não foi cadastrado. Peça ao administrador da Alcateia
              para liberar o seu acesso.
            </p>
            <a href="/cdn-cgi/access/logout" className="btn-secundario mt-6">
              Entrar com outro e-mail
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Não foi possível abrir o planejador</h1>
            <p className="mt-2 text-sm text-slate-600">{erro.message}</p>
            <button className="btn-primario mt-6" onClick={() => location.reload()}>
              <RefreshCw className="size-4" /> Tentar de novo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
