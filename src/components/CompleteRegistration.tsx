import React, { useState, useEffect } from 'react';
import { getGrupos, getSecoes, saveGrupo, saveSecao, saveUsuario, getPerfis, savePerfil, ADMIN_EMAILS } from '../services/admin';
import { GrupoEscoteiro, Secao, Perfil } from '../types';
import { useAuth } from './FirebaseProvider';
import { Loader2, Plus } from 'lucide-react';

export const CompleteRegistration: React.FC = () => {
  const { user, refreshUserData } = useAuth();
  const [grupos, setGrupos] = useState<GrupoEscoteiro[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [selectedGrupo, setSelectedGrupo] = useState<string>('');
  const [selectedSecao, setSelectedSecao] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // For adding new group
  const [isAddingGrupo, setIsAddingGrupo] = useState(false);
  const [newGrupo, setNewGrupo] = useState({
    nome: '',
    cnpj: '',
    endereco: '',
    email: '',
    telefone: '',
    logoUrl: '',
    observacoes: '',
    corPrincipal: '#013B88',
    corSecundaria: '#eab308'
  });

  // For adding new secao
  const [isAddingSecao, setIsAddingSecao] = useState(false);
  const [newSecao, setNewSecao] = useState({ nome: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const g = await getGrupos();
      setGrupos(g || []);
    } catch (e) {
      console.error(e);
      setGrupos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGrupoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'NEW') {
      setIsAddingGrupo(true);
      setSelectedGrupo('');
    } else {
      setIsAddingGrupo(false);
      setSelectedGrupo(val);
      if (val) {
        try {
          const s = await getSecoes(val);
          setSecoes(s || []);
        } catch (e) {
          console.error(e);
          setSecoes([]);
        }
      } else {
        setSecoes([]);
      }
      setSelectedSecao('');
    }
  };

  const handleSecaoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'NEW') {
      setIsAddingSecao(true);
      setSelectedSecao('');
    } else {
      setIsAddingSecao(false);
      setSelectedSecao(val);
    }
  };

  const createGrupo = async () => {
    if (!newGrupo.nome.trim()) return;
    setSubmitting(true);
    try {
      const gid = await saveGrupo({ ...newGrupo, nome: newGrupo.nome.trim(), ativo: true });
      const created = { ...newGrupo, id: gid, nome: newGrupo.nome.trim(), ativo: true };
      setGrupos(prev => [...prev, created]);
      setSelectedGrupo(gid);
      setIsAddingGrupo(false);
      setSecoes([]);
    } catch (e) {
      console.error("Erro ao salvar grupo:", e);
      alert("Não foi possível salvar o grupo. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const createSecao = async () => {
    if (!newSecao.nome.trim() || !selectedGrupo) return;
    setSubmitting(true);
    try {
      const sid = await saveSecao({ ...newSecao, nome: newSecao.nome.trim(), grupoId: selectedGrupo, ativo: true });
      const created = { ...newSecao, id: sid, nome: newSecao.nome.trim(), grupoId: selectedGrupo, ativo: true };
      setSecoes(prev => [...prev, created]);
      setSelectedSecao(sid);
      setIsAddingSecao(false);
      setNewSecao({ nome: '' });
    } catch (e) {
      console.error("Erro ao salvar seção:", e);
      alert("Não foi possível salvar a seção. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const completeSetup = async () => {
    if (!user) return;
    const isAdmin = !!(user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
    if (!isAdmin && (!selectedGrupo || !selectedSecao)) {
      alert("Por favor, selecione seu grupo e seção.");
      return;
    }
    setSubmitting(true);
    try {
      // Create initial profiles if none exist
      let perfis = await getPerfis();
      if (perfis.length === 0) {
        await savePerfil({ nome: 'Administrador', ativo: true });
        await savePerfil({ nome: 'Chefe de Seção', ativo: true });
        perfis = await getPerfis();
      }

      const adminPerfil = perfis.find(p => p.nome === 'Administrador');
      const chefePerfil = perfis.find(p => p.nome === 'Chefe de Seção') || perfis[0];

      const perfilId = isAdmin && adminPerfil ? adminPerfil.id! : chefePerfil.id!;
      const perfilNome = isAdmin && adminPerfil ? adminPerfil.nome : chefePerfil.nome;

      await saveUsuario(user.uid, {
        email: user.email || '',
        nome: user.displayName || '',
        perfilId,
        perfilNome,
        grupoId: isAdmin ? 'Todos' : selectedGrupo,
        secaoId: isAdmin ? 'Todos' : selectedSecao,
        status: isAdmin ? 'approved' : 'pending'
      });
      await refreshUserData();
    } catch (e) {
      console.error(e);
      alert("Erro ao concluir cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#002F6C] to-[#007A33] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#002F6C]">Conclua seu Cadastro</h1>
          <p className="text-sm text-neutral-500 mt-2">
            {isAdmin 
              ? "Perguntas de cadastro simplificado para privilégios de Administrador."
              : "Para acessar as funcionalidades, selecione seu Grupo Escoteiro e Seção."}
          </p>
        </div>

        {isAdmin ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 space-y-2">
              <h3 className="font-bold text-sm">Perfil Administrador Detectado</h3>
              <p className="text-xs leading-relaxed">
                Como Administrador do Planner da Jângal, você terá acesso irrestrito para visualizar as atividades de todos os grupos escoteiros e seções cadastradas. Seu grupo e seção padrão serão definidos como <strong className="font-semibold">Todos</strong>.
              </p>
            </div>
            
            <button
              onClick={completeSetup}
              disabled={submitting}
              className="w-full py-3 bg-[#007A33] hover:bg-[#005E27] text-white rounded-lg font-medium disabled:opacity-50 transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Cadastro de Administrador'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Grupo Escoteiro</label>
              <select
                value={isAddingGrupo ? "NEW" : selectedGrupo}
                onChange={handleGrupoChange}
                className="w-full p-2 border border-neutral-300 rounded-md bg-neutral-50 text-neutral-900 focus:outline-[#007A33]"
              >
                <option value="">-- Selecione o Grupo --</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
                <option value="NEW">+ Adicionar Novo Grupo Escoteiro</option>
              </select>
            </div>

            {isAddingGrupo && (
              <div className="p-4 bg-neutral-100 rounded-md space-y-3">
                <h3 className="font-semibold text-sm">Novo Grupo</h3>
                <input type="text" placeholder="Nome *" value={newGrupo.nome} onChange={e => setNewGrupo({...newGrupo, nome: e.target.value})} className="w-full p-2 text-sm border rounded bg-white" />
                <input type="text" placeholder="CNPJ" value={newGrupo.cnpj} onChange={e => setNewGrupo({...newGrupo, cnpj: e.target.value})} className="w-full p-2 text-sm border rounded bg-white" />
                <input type="url" placeholder="URL da Logo (Imagem)" value={newGrupo.logoUrl} onChange={e => setNewGrupo({...newGrupo, logoUrl: e.target.value})} className="w-full p-2 text-sm border rounded bg-white" />
                
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Cor Principal</label>
                    <div className="flex gap-1.5">
                      <input type="color" value={newGrupo.corPrincipal} onChange={e => setNewGrupo({...newGrupo, corPrincipal: e.target.value})} className="w-8 h-8 p-0 cursor-pointer border rounded" />
                      <input type="text" value={newGrupo.corPrincipal} onChange={e => setNewGrupo({...newGrupo, corPrincipal: e.target.value})} className="w-full p-1 text-xs border rounded bg-white uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Cor Secundária</label>
                    <div className="flex gap-1.5">
                      <input type="color" value={newGrupo.corSecundaria} onChange={e => setNewGrupo({...newGrupo, corSecundaria: e.target.value})} className="w-8 h-8 p-0 cursor-pointer border rounded" />
                      <input type="text" value={newGrupo.corSecundaria} onChange={e => setNewGrupo({...newGrupo, corSecundaria: e.target.value})} className="w-full p-1 text-xs border rounded bg-white uppercase font-mono" />
                    </div>
                  </div>
                </div>

                <button onClick={createGrupo} disabled={!newGrupo.nome} className="w-full py-2 bg-[#007A33] hover:bg-[#005E27] text-white rounded text-sm disabled:opacity-50 cursor-pointer font-medium transition-colors">Salvar Grupo</button>
              </div>
            )}

            {!isAddingGrupo && selectedGrupo && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Seção do Grupo</label>
                <select
                  value={isAddingSecao ? "NEW" : selectedSecao}
                  onChange={handleSecaoChange}
                  className="w-full p-2 border border-neutral-300 rounded-md bg-neutral-50 text-neutral-900 focus:outline-[#007A33]"
                >
                  <option value="">-- Selecione a Seção --</option>
                  {secoes.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                  <option value="NEW">+ Adicionar Nova Seção</option>
                </select>
              </div>
            )}

            {isAddingSecao && selectedGrupo && (
              <div className="p-4 bg-neutral-100 rounded-md space-y-3">
                <h3 className="font-semibold text-sm">Nova Seção</h3>
                <input type="text" placeholder="Nome da Seção (ex: Ramo Lobinho)" value={newSecao.nome} onChange={e => setNewSecao({...newSecao, nome: e.target.value})} className="w-full p-2 text-sm border rounded bg-white" />
                <button onClick={createSecao} disabled={!newSecao.nome} className="w-full py-2 bg-[#007A33] hover:bg-[#005E27] text-white rounded text-sm disabled:opacity-50 cursor-pointer font-medium transition-colors">Salvar Seção</button>
              </div>
            )}

            <button
              onClick={completeSetup}
              disabled={submitting || !selectedGrupo || !selectedSecao || isAddingGrupo || isAddingSecao}
              className="w-full py-3 bg-[#007A33] hover:bg-[#005E27] text-white rounded-lg font-medium disabled:opacity-50 transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Cadastro'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
