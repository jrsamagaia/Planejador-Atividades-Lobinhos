import React, { useState, useEffect } from 'react';
import { getGrupos, getSecoes, getPerfis, getUsuarios, saveGrupo, saveSecao, savePerfil, updateUsuarioStatus, saveUsuario, deleteUsuario } from '../services/admin';
import { GrupoEscoteiro, Secao, Perfil, UsuarioDoc } from '../types';
import { Loader2, Settings, Users, Shield, Map, Plus, Edit2, Check, X, ToggleLeft, ToggleRight, Save, Trash2, ToggleLeft as ToggleLeftIcon } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'grupos' | 'secoes' | 'perfis' | 'usuarios'>('usuarios');
  const [loading, setLoading] = useState(true);

  // Data
  const [grupos, setGrupos] = useState<GrupoEscoteiro[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioDoc[]>([]);

  // Form State for Grupo
  const [editingGrupo, setEditingGrupo] = useState<GrupoEscoteiro | null>(null);
  const [grupoForm, setGrupoForm] = useState({
    nome: '',
    cnpj: '',
    endereco: '',
    email: '',
    telefone: '',
    logoUrl: '',
    observacoes: '',
    corPrincipal: '',
    corSecundaria: ''
  });
  const [isGrupoFormOpen, setIsGrupoFormOpen] = useState(false);

  // Form State for Secao
  const [editingSecao, setEditingSecao] = useState<Secao | null>(null);
  const [secaoForm, setSecaoForm] = useState({
    nome: '',
    grupoId: ''
  });
  const [isSecaoFormOpen, setIsSecaoFormOpen] = useState(false);

  // Form State for Perfil
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
  const [perfilForm, setPerfilForm] = useState({
    nome: ''
  });
  const [isPerfilFormOpen, setIsPerfilFormOpen] = useState(false);
  
  // User to Delete state
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [g, s, p, u] = await Promise.all([getGrupos(), getSecoes(), getPerfis(), getUsuarios()]);
      setGrupos(g || []);
      setSecoes(s || []);
      setPerfis(p || []);
      setUsuarios(u || []);
    } catch (e) {
      console.error("Error loading admin data: ", e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uid: string) => {
    await updateUsuarioStatus(uid, 'approved');
    setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, status: 'approved' } : u));
  };

  const handleReject = async (uid: string) => {
    await updateUsuarioStatus(uid, 'rejected');
    setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, status: 'rejected' } : u));
  };

  const handleDeleteUsuario = (uid: string) => {
    setUserToDelete(uid);
  };

  const confirmDeleteUsuario = async () => {
    if (!userToDelete) return;
    try {
      await deleteUsuario(userToDelete);
      setUsuarios(prev => prev.filter(u => u.uid !== userToDelete));
      setUserToDelete(null);
    } catch (e) {
      console.error("Erro ao excluir usuário:", e);
      alert("Ocorreu um erro ao excluir o usuário.");
    }
  };

  // Grupo actions
  const handleSaveGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoForm.nome.trim()) return;

    try {
      const gData: Omit<GrupoEscoteiro, 'id' | 'createdAt'> = {
        nome: grupoForm.nome.trim(),
        cnpj: grupoForm.cnpj.trim(),
        endereco: grupoForm.endereco.trim(),
        email: grupoForm.email.trim(),
        telefone: grupoForm.telefone.trim(),
        logoUrl: grupoForm.logoUrl.trim(),
        observacoes: grupoForm.observacoes.trim(),
        corPrincipal: grupoForm.corPrincipal.trim(),
        corSecundaria: grupoForm.corSecundaria.trim(),
        ativo: editingGrupo ? (editingGrupo.ativo !== false) : true
      };

      await saveGrupo(gData, editingGrupo?.id);
      await loadAll();

      setGrupoForm({ nome: '', cnpj: '', endereco: '', email: '', telefone: '', logoUrl: '', observacoes: '', corPrincipal: '', corSecundaria: '' });
      setEditingGrupo(null);
      setIsGrupoFormOpen(false);
    } catch (e) {
      console.error("Error saving Grupo:", e);
    }
  };

  const handleToggleGrupoActive = async (grupo: GrupoEscoteiro) => {
    try {
      const nextAtivo = !(grupo.ativo !== false);
      const gData: Omit<GrupoEscoteiro, 'id' | 'createdAt'> = {
        nome: grupo.nome,
        cnpj: grupo.cnpj || '',
        endereco: grupo.endereco || '',
        email: grupo.email || '',
        telefone: grupo.telefone || '',
        logoUrl: grupo.logoUrl || '',
        observacoes: grupo.observacoes || '',
        corPrincipal: grupo.corPrincipal || '',
        corSecundaria: grupo.corSecundaria || '',
        ativo: nextAtivo
      };
      await saveGrupo(gData, grupo.id);
      await loadAll();
    } catch (e) {
      console.error("Error toggling Grupo status:", e);
    }
  };

  const handleStartEditGrupo = (grupo: GrupoEscoteiro) => {
    setEditingGrupo(grupo);
    setGrupoForm({
      nome: grupo.nome || '',
      cnpj: grupo.cnpj || '',
      endereco: grupo.endereco || '',
      email: grupo.email || '',
      telefone: grupo.telefone || '',
      logoUrl: grupo.logoUrl || '',
      observacoes: grupo.observacoes || '',
      corPrincipal: grupo.corPrincipal || '',
      corSecundaria: grupo.corSecundaria || ''
    });
    setIsGrupoFormOpen(true);
  };

  // Secao actions
  const handleSaveSecao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secaoForm.nome.trim() || !secaoForm.grupoId) return;

    try {
      const sData: Omit<Secao, 'id' | 'createdAt'> = {
        nome: secaoForm.nome.trim(),
        grupoId: secaoForm.grupoId,
        ativo: editingSecao ? (editingSecao.ativo !== false) : true
      };

      await saveSecao(sData, editingSecao?.id);
      await loadAll();

      setSecaoForm({ nome: '', grupoId: '' });
      setEditingSecao(null);
      setIsSecaoFormOpen(false);
    } catch (e) {
      console.error("Error saving Seção:", e);
    }
  };

  const handleToggleSecaoActive = async (secao: Secao) => {
    try {
      const nextAtivo = !(secao.ativo !== false);
      const sData: Omit<Secao, 'id' | 'createdAt'> = {
        nome: secao.nome,
        grupoId: secao.grupoId,
        ativo: nextAtivo
      };
      await saveSecao(sData, secao.id);
      await loadAll();
    } catch (e) {
      console.error("Error toggling Seção status:", e);
    }
  };

  const handleStartEditSecao = (secao: Secao) => {
    const matchingGrupo = grupos.find(g => 
      g.id === secao.grupoId || 
      g.nome === secao.grupoId || 
      g.nome?.toLowerCase().trim() === secao.grupoId?.toLowerCase().trim() ||
      g.id?.toLowerCase().trim() === secao.grupoId?.toLowerCase().trim()
    );
    setEditingSecao(secao);
    setSecaoForm({
      nome: secao.nome || '',
      grupoId: matchingGrupo ? matchingGrupo.id : (secao.grupoId || '')
    });
    setIsSecaoFormOpen(true);
  };

  // Perfil actions
  const handleSavePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfilForm.nome.trim()) return;

    try {
      const pData: Omit<Perfil, 'id' | 'createdAt'> = {
        nome: perfilForm.nome.trim(),
        ativo: editingPerfil ? (editingPerfil.ativo !== false) : true
      };

      await savePerfil(pData, editingPerfil?.id);
      await loadAll();

      setPerfilForm({ nome: '' });
      setEditingPerfil(null);
      setIsPerfilFormOpen(false);
    } catch (e) {
      console.error("Error saving Perfil:", e);
    }
  };

  const handleTogglePerfilActive = async (perfil: Perfil) => {
    try {
      const nextAtivo = !(perfil.ativo !== false);
      const pData: Omit<Perfil, 'id' | 'createdAt'> = {
        nome: perfil.nome,
        ativo: nextAtivo
      };
      await savePerfil(pData, perfil.id);
      await loadAll();
    } catch (e) {
      console.error("Error toggling Perfil status:", e);
    }
  };

  const handleStartEditPerfil = (perfil: Perfil) => {
    setEditingPerfil(perfil);
    setPerfilForm({
      nome: perfil.nome || ''
    });
    setIsPerfilFormOpen(true);
  };

  // Form State for Usuario
  const [editingUsuario, setEditingUsuario] = useState<UsuarioDoc | null>(null);
  const [usuarioForm, setUsuarioForm] = useState({
    nome: '',
    email: '',
    perfilId: '',
    grupoId: '',
    secaoId: '',
    status: 'pending' as 'pending' | 'approved' | 'rejected'
  });
  const [isUsuarioFormOpen, setIsUsuarioFormOpen] = useState(false);

  const getSectionsForGroup = (grupoIdOrName: string) => {
    if (!grupoIdOrName) return [];
    const grp = grupos.find(g => 
      g.id === grupoIdOrName || 
      g.nome === grupoIdOrName || 
      g.nome?.toLowerCase().trim() === grupoIdOrName?.toLowerCase().trim() ||
      g.id?.toLowerCase().trim() === grupoIdOrName?.toLowerCase().trim()
    );

    return secoes.filter(s => {
      if (!s.grupoId) return false;
      if (s.grupoId === grupoIdOrName) return true;
      if (grp) {
        if (s.grupoId === grp.id || s.grupoId === grp.nome) return true;
        if (s.grupoId.toLowerCase().trim() === grp.nome?.toLowerCase().trim()) return true;
        if (s.grupoId.toLowerCase().trim() === grp.id?.toLowerCase().trim()) return true;
      }
      return false;
    });
  };

  const handleStartEditUsuario = (usuario: UsuarioDoc) => {
    const matchingGrupo = grupos.find(g => 
      g.id === usuario.grupoId || 
      g.nome === usuario.grupoId || 
      g.nome?.toLowerCase().trim() === usuario.grupoId?.toLowerCase().trim() ||
      g.id?.toLowerCase().trim() === usuario.grupoId?.toLowerCase().trim()
    );
    const resolvedGrupoId = matchingGrupo ? matchingGrupo.id : (usuario.grupoId || '');

    const matchingSecao = secoes.find(s => 
      s.id === usuario.secaoId || 
      s.nome === usuario.secaoId || 
      s.nome?.toLowerCase().trim() === usuario.secaoId?.toLowerCase().trim() ||
      s.id?.toLowerCase().trim() === usuario.secaoId?.toLowerCase().trim()
    );
    const resolvedSecaoId = matchingSecao ? matchingSecao.id : (usuario.secaoId || '');

    setEditingUsuario(usuario);
    setUsuarioForm({
      nome: usuario.nome || '',
      email: usuario.email || '',
      perfilId: usuario.perfilId || '',
      grupoId: resolvedGrupoId,
      secaoId: resolvedSecaoId,
      status: usuario.status || 'pending'
    });
    setIsUsuarioFormOpen(true);
  };

  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUsuario) return;
    if (!usuarioForm.nome.trim() || !usuarioForm.email.trim()) return;

    try {
      const selectedPerfil = perfis.find(p => p.id === usuarioForm.perfilId);
      const perfilNome = selectedPerfil ? selectedPerfil.nome : '';

      const uData: Omit<UsuarioDoc, 'uid'> = {
        nome: usuarioForm.nome.trim(),
        email: usuarioForm.email.trim().toLowerCase(),
        grupoId: usuarioForm.grupoId,
        secaoId: usuarioForm.secaoId,
        perfilId: usuarioForm.perfilId,
        perfilNome,
        status: usuarioForm.status
      };

      await saveUsuario(editingUsuario.uid, uData);
      
      setUsuarios(prev => prev.map(u => u.uid === editingUsuario.uid ? { ...u, ...uData } : u));
      setIsUsuarioFormOpen(false);
      setEditingUsuario(null);
    } catch (e) {
      console.error("Error saving Usuario:", e);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-800" /></div>;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm">
      <div className="flex border-b border-neutral-200 bg-neutral-50 overflow-x-auto">
        <button onClick={() => setActiveTab('usuarios')} className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'usuarios' ? 'bg-white text-[#013B88] border-b-2 border-[#013B88]' : 'text-neutral-500 hover:text-neutral-700'}`}>
          <Users className="w-4 h-4" /> Moderação de Usuários
        </button>
        <button onClick={() => setActiveTab('grupos')} className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'grupos' ? 'bg-white text-[#013B88] border-b-2 border-[#013B88]' : 'text-neutral-500 hover:text-neutral-700'}`}>
          <Map className="w-4 h-4" /> Grupos Escoteiros
        </button>
        <button onClick={() => setActiveTab('secoes')} className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'secoes' ? 'bg-white text-[#013B88] border-b-2 border-[#013B88]' : 'text-neutral-500 hover:text-neutral-700'}`}>
          <Settings className="w-4 h-4" /> Seções
        </button>
        <button onClick={() => setActiveTab('perfis')} className={`px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'perfis' ? 'bg-white text-[#013B88] border-b-2 border-[#013B88]' : 'text-neutral-500 hover:text-neutral-700'}`}>
          <Shield className="w-4 h-4" /> Perfis
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* TAB: USUARIOS */}
        {activeTab === 'usuarios' && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4 text-[#013B88]">Aprovar / Reprovar Cadastro</h3>

            {/* Form de Edição de Usuário */}
            {isUsuarioFormOpen && (
              <form onSubmit={handleSaveUsuario} className="p-5 border border-blue-100 bg-blue-50/50 rounded-xl space-y-4 mb-6">
                <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                  <h4 className="font-bold text-[#013B88] text-sm flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Editar Cadastro de Usuário
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUsuarioFormOpen(false);
                      setEditingUsuario(null);
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-neutral-500 hover:text-neutral-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={usuarioForm.nome}
                      onChange={e => setUsuarioForm({ ...usuarioForm, nome: e.target.value })}
                      placeholder="Ex: Jeferson Samagaia"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">E-mail *</label>
                    <input
                      type="email"
                      required
                      value={usuarioForm.email}
                      onChange={e => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                      placeholder="exemplo@email.com"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Grupo Escoteiro *</label>
                    <select
                      required
                      value={usuarioForm.grupoId}
                      onChange={e => {
                        const newGrp = e.target.value;
                        const sectionsForGrp = getSectionsForGroup(newGrp);
                        const hasMatchingSec = sectionsForGrp.some(s => s.id === usuarioForm.secaoId);
                        setUsuarioForm({
                          ...usuarioForm,
                          grupoId: newGrp,
                          secaoId: hasMatchingSec ? usuarioForm.secaoId : (sectionsForGrp[0]?.id || '')
                        });
                      }}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    >
                      <option value="" disabled>Selecione um Grupo</option>
                      {grupos.map(g => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Seção *</label>
                    <select
                      required
                      value={usuarioForm.secaoId}
                      onChange={e => setUsuarioForm({ ...usuarioForm, secaoId: e.target.value })}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    >
                      <option value="" disabled>
                        {getSectionsForGroup(usuarioForm.grupoId).length === 0 
                          ? (usuarioForm.grupoId ? "Nenhuma seção cadastrada para este grupo" : "Selecione primeiro um Grupo") 
                          : "Selecione uma Seção"}
                      </option>
                      {getSectionsForGroup(usuarioForm.grupoId).map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Perfil de Acesso *</label>
                    <select
                      required
                      value={usuarioForm.perfilId}
                      onChange={e => setUsuarioForm({ ...usuarioForm, perfilId: e.target.value })}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    >
                      <option value="" disabled>Selecione um Perfil</option>
                      {perfis.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Status de Cadastro *</label>
                    <select
                      required
                      value={usuarioForm.status}
                      onChange={e => setUsuarioForm({ ...usuarioForm, status: e.target.value as any })}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    >
                      <option value="pending">Pendente</option>
                      <option value="approved">Aprovado</option>
                      <option value="rejected">Reprovado</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUsuarioFormOpen(false);
                      setEditingUsuario(null);
                    }}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#013B88] hover:bg-[#012d6a] text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Usuário
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-200">
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Nome / E-mail</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Grupo / Seção</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Perfil</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-center">Status</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-neutral-500">Nenhum usuário cadastrado.</td></tr>}
                  {usuarios.map(u => (
                    <tr key={u.uid} className="border-b hover:bg-neutral-50 transition-colors">
                      <td className="p-3">
                        <div className="font-medium text-neutral-900">{u.nome}</div>
                        <div className="text-xs text-neutral-500">{u.email}</div>
                      </td>
                      <td className="p-3 text-sm text-neutral-600">
                        <div>
                          {grupos.find(g => 
                            g.id === u.grupoId || 
                            g.nome === u.grupoId || 
                            g.nome?.toLowerCase().trim() === u.grupoId?.toLowerCase().trim()
                          )?.nome || u.grupoId || '-'}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {secoes.find(s => 
                            s.id === u.secaoId || 
                            s.nome === u.secaoId || 
                            s.nome?.toLowerCase().trim() === u.secaoId?.toLowerCase().trim()
                          )?.nome || u.secaoId || '-'}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-neutral-600">{u.perfilNome || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${u.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' : u.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-yellow-105 bg-yellow-105 text-yellow-700 border border-yellow-250'}`}>
                          {u.status === 'approved' ? 'Aprovado' : u.status === 'rejected' ? 'Reprovado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button 
                          onClick={() => handleStartEditUsuario(u)} 
                          className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 font-medium transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button onClick={() => handleApprove(u.uid)} disabled={u.status === 'approved'} className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100 font-medium disabled:opacity-50 transition-colors">Aprovar</button>
                        <button onClick={() => handleReject(u.uid)} disabled={u.status === 'rejected'} className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 font-medium disabled:opacity-50 transition-colors">Reprovar</button>
                        <button onClick={() => handleDeleteUsuario(u.uid)} className="px-2 py-1 bg-neutral-100 text-red-600 hover:bg-red-600 hover:text-white rounded text-xs font-medium transition-colors cursor-pointer" title="Excluir Usuário">
                          <Trash2 className="w-3.5 h-3.5 inline-block" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: GRUPOS ESCOTEIROS */}
        {activeTab === 'grupos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-neutral-100">
              <div>
                <h3 className="font-bold text-lg text-[#013B88]">Grupos Escoteiros ({grupos.length})</h3>
                <p className="text-xs text-neutral-500 mt-1">Gerencie os Grupos cadastrados no sistema.</p>
              </div>
              {!isGrupoFormOpen && (
                <button
                  onClick={() => {
                    setEditingGrupo(null);
                    setGrupoForm({ nome: '', cnpj: '', endereco: '', email: '', telefone: '', logoUrl: '', observacoes: '', corPrincipal: '', corSecundaria: '' });
                    setIsGrupoFormOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Novo Grupo
                </button>
              )}
            </div>

            {/* Grupo Form */}
            {isGrupoFormOpen && (
              <form onSubmit={handleSaveGrupo} className="p-5 border border-blue-100 bg-blue-50/50 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                  <h4 className="font-bold text-[#013B88] text-sm flex items-center gap-2">
                    {editingGrupo ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingGrupo ? 'Editar Grupo Escoteiro' : 'Cadastrar Novo Grupo Escoteiro'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGrupoFormOpen(false);
                      setEditingGrupo(null);
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-neutral-500 hover:text-neutral-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Nome do Grupo *</label>
                    <input
                      type="text"
                      required
                      value={grupoForm.nome}
                      onChange={e => setGrupoForm({ ...grupoForm, nome: e.target.value })}
                      placeholder="Ex: Grupo Escoteiro Blumenau 15"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">CNPJ</label>
                    <input
                      type="text"
                      value={grupoForm.cnpj}
                      onChange={e => setGrupoForm({ ...grupoForm, cnpj: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={grupoForm.email}
                      onChange={e => setGrupoForm({ ...grupoForm, email: e.target.value })}
                      placeholder="contato@grupo.org.br"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={grupoForm.telefone}
                      onChange={e => setGrupoForm({ ...grupoForm, telefone: e.target.value })}
                      placeholder="(47) 99999-9999"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={grupoForm.endereco}
                      onChange={e => setGrupoForm({ ...grupoForm, endereco: e.target.value })}
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">URL da Logo (Imagem)</label>
                    <input
                      type="url"
                      value={grupoForm.logoUrl}
                      onChange={e => setGrupoForm({ ...grupoForm, logoUrl: e.target.value })}
                      placeholder="https://exemplo.com/logo.png"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Cor Principal (Identidade)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={grupoForm.corPrincipal || '#013B88'}
                        onChange={e => setGrupoForm({ ...grupoForm, corPrincipal: e.target.value })}
                        className="w-10 h-10 p-0 border border-neutral-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={grupoForm.corPrincipal}
                        onChange={e => setGrupoForm({ ...grupoForm, corPrincipal: e.target.value })}
                        placeholder="#013B88"
                        className="flex-1 border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none uppercase font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Cor Secundária (Contraste)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={grupoForm.corSecundaria || '#eab308'}
                        onChange={e => setGrupoForm({ ...grupoForm, corSecundaria: e.target.value })}
                        className="w-10 h-10 p-0 border border-neutral-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={grupoForm.corSecundaria}
                        onChange={e => setGrupoForm({ ...grupoForm, corSecundaria: e.target.value })}
                        placeholder="#eab308"
                        className="flex-1 border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none uppercase font-mono"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Observações / Notas</label>
                    <textarea
                      rows={2}
                      value={grupoForm.observacoes}
                      onChange={e => setGrupoForm({ ...grupoForm, observacoes: e.target.value })}
                      placeholder="Qualquer informação adicional..."
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGrupoFormOpen(false);
                      setEditingGrupo(null);
                    }}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#013B88] hover:bg-[#012d6a] text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Grupo
                  </button>
                </div>
              </form>
            )}

            {/* List Grupos */}
            <div className="overflow-x-auto select-none">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Logo</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Nome / Características</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Contato</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-center">Inativar/Ativar</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-neutral-500 text-sm">Nenhum grupo cadastrado ou carregado.</td>
                    </tr>
                  )}
                  {grupos.map(g => {
                    const isAtivoStatus = g.ativo !== false;
                    return (
                      <tr key={g.id} className={`border-b hover:bg-neutral-50/50 transition-colors ${!isAtivoStatus ? 'opacity-65 bg-neutral-50/50' : ''}`}>
                        <td className="p-3 w-16">
                          {g.logoUrl ? (
                            <img src={g.logoUrl} alt={g.nome} className="w-10 h-10 object-contain rounded border border-neutral-200 p-0.5 bg-white" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded border border-neutral-200 bg-neutral-100 flex items-center justify-center font-bold text-neutral-400 text-xs">GE</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                            {g.nome}
                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-semibold border ${isAtivoStatus ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {isAtivoStatus ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">CNPJ: {g.cnpj || '-'}</div>
                          {g.endereco && <div className="text-xs text-neutral-400 truncate max-w-sm">{g.endereco}</div>}
                        </td>
                        <td className="p-3 text-xs text-neutral-600">
                          <div>{g.email || '-'}</div>
                          <div className="text-neutral-500">{g.telefone || '-'}</div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleGrupoActive(g)}
                            className="inline-flex items-center gap-1 cursor-pointer transition-all"
                            title={isAtivoStatus ? "Desativar este Grupo" : "Ativar este Grupo"}
                          >
                            {isAtivoStatus ? (
                              <div className="w-12 h-6 flex items-center bg-green-500 rounded-full p-0.5 cursor-pointer">
                                <div className="bg-white w-5 h-5 rounded-full shadow-md transform translate-x-6 duration-300" />
                              </div>
                            ) : (
                              <div className="w-12 h-6 flex items-center bg-neutral-300 rounded-full p-0.5 cursor-pointer">
                                <div className="bg-white w-5 h-5 rounded-full shadow-md transform translate-x-0 duration-300" />
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleStartEditGrupo(g)}
                            className="p-1 px-2.5 bg-neutral-100 hover:bg-[#013B88] hover:text-white rounded text-xs font-semibold text-neutral-700 flex items-center gap-1.5 ml-auto transition-colors cursor-pointer border border-neutral-200 hover:border-transparent"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: SECOES */}
        {activeTab === 'secoes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-neutral-100">
              <div>
                <h3 className="font-bold text-lg text-[#013B88]">Seções ({secoes.length})</h3>
                <p className="text-xs text-neutral-500 mt-1">Gerencie as unidades / seções (ex: Ramo Lobinho) associadas aos Grupos.</p>
              </div>
              {!isSecaoFormOpen && (
                <button
                  onClick={() => {
                    setEditingSecao(null);
                    setSecaoForm({ nome: '', grupoId: grupos.length > 0 ? grupos[0].id || '' : '' });
                    setIsSecaoFormOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Nova Seção
                </button>
              )}
            </div>

            {/* Secao Form */}
            {isSecaoFormOpen && (
              <form onSubmit={handleSaveSecao} className="p-5 border border-blue-100 bg-blue-50/50 rounded-xl space-y-4 max-w-2xl">
                <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                  <h4 className="font-bold text-[#013B88] text-sm flex items-center gap-2">
                    {editingSecao ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingSecao ? 'Editar Seção' : 'Cadastrar Nova Seção'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSecaoFormOpen(false);
                      setEditingSecao(null);
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-neutral-500 hover:text-neutral-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Nome da Seção *</label>
                    <input
                      type="text"
                      required
                      value={secaoForm.nome}
                      onChange={e => setSecaoForm({ ...secaoForm, nome: e.target.value })}
                      placeholder="Ex: Alcateia Lobo do Mar"
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Grupo Escoteiro *</label>
                    <select
                      required
                      value={secaoForm.grupoId}
                      onChange={e => setSecaoForm({ ...secaoForm, grupoId: e.target.value })}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                    >
                      <option value="" disabled>Selecione um Grupo</option>
                      {grupos.map(g => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSecaoFormOpen(false);
                      setEditingSecao(null);
                    }}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#013B88] hover:bg-[#012d6a] text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Seção
                  </button>
                </div>
              </form>
            )}

            {/* List Secoes */}
            <div className="overflow-x-auto select-none">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Seção</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Grupo Associado</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-center">Inativar/Ativar</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {secoes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-neutral-500 text-sm">Nenhuma seção cadastrada.</td>
                    </tr>
                  )}
                  {secoes.map(s => {
                    const isAtivoStatus = s.ativo !== false;
                    const grupoNome = grupos.find(g => 
                      g.id === s.grupoId || 
                      g.nome === s.grupoId || 
                      g.nome?.toLowerCase().trim() === s.grupoId?.toLowerCase().trim() ||
                      g.id?.toLowerCase().trim() === s.grupoId?.toLowerCase().trim()
                    )?.nome || s.grupoId || 'Grupo Não Encontrado';
                    return (
                      <tr key={s.id} className={`border-b hover:bg-neutral-50/50 transition-colors ${!isAtivoStatus ? 'opacity-65 bg-neutral-50/50' : ''}`}>
                        <td className="p-3 font-medium text-neutral-900 text-sm">
                          <div className="flex items-center gap-2">
                            {s.nome}
                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-semibold border ${isAtivoStatus ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {isAtivoStatus ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-neutral-600">{grupoNome}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleSecaoActive(s)}
                            className="inline-flex items-center gap-1 cursor-pointer transition-all"
                            title={isAtivoStatus ? "Desativar esta Seção" : "Ativar esta Seção"}
                          >
                            {isAtivoStatus ? (
                              <div className="w-12 h-6 flex items-center bg-green-500 rounded-full p-0.5 cursor-pointer">
                                <div className="bg-white w-5 h-5 rounded-full shadow-md transform translate-x-6 duration-300" />
                              </div>
                            ) : (
                              <div className="w-12 h-6 flex items-center bg-neutral-300 rounded-full p-0.5 cursor-pointer">
                                <div className="bg-white w-5 h-5 rounded-full shadow-md transform translate-x-0 duration-300" />
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleStartEditSecao(s)}
                            className="p-1 px-2.5 bg-neutral-100 hover:bg-[#013B88] hover:text-white rounded text-xs font-semibold text-neutral-700 flex items-center gap-1.5 ml-auto transition-colors cursor-pointer border border-neutral-200 hover:border-transparent"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PERFIS */}
        {activeTab === 'perfis' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-neutral-100">
              <div>
                <h3 className="font-bold text-lg text-[#013B88]">Perfis de Usuário ({perfis.length})</h3>
                <p className="text-xs text-neutral-500 mt-1">Gerencie os perfis de acesso e autoridade para membros do sistema.</p>
              </div>
              {!isPerfilFormOpen && (
                <button
                  onClick={() => {
                    setEditingPerfil(null);
                    setPerfilForm({ nome: '' });
                    setIsPerfilFormOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Novo Perfil
                </button>
              )}
            </div>

            {/* Perfil Form */}
            {isPerfilFormOpen && (
              <form onSubmit={handleSavePerfil} className="p-5 border border-blue-100 bg-blue-50/50 rounded-xl space-y-4 max-w-lg">
                <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-2">
                  <h4 className="font-bold text-[#013B88] text-sm flex items-center gap-2">
                    {editingPerfil ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingPerfil ? 'Editar Perfil' : 'Cadastrar Novo Perfil'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPerfilFormOpen(false);
                      setEditingPerfil(null);
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-neutral-500 hover:text-neutral-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nome do Perfil *</label>
                  <input
                    type="text"
                    required
                    value={perfilForm.nome}
                    onChange={e => setPerfilForm({ nome: e.target.value })}
                    placeholder="Ex: Chefe de Seção"
                    className="w-full border border-neutral-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#013B88] focus:border-transparent outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPerfilFormOpen(false);
                      setEditingPerfil(null);
                    }}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#013B88] hover:bg-[#012d6a] text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Perfil
                  </button>
                </div>
              </form>
            )}

            {/* List Perfis */}
            <div className="overflow-x-auto select-none">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="p-3 font-semibold text-neutral-700 text-sm">Perfil</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-center">Inativar/Ativar</th>
                    <th className="p-3 font-semibold text-neutral-700 text-sm text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {perfis.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-neutral-500 text-sm">Nenhum perfil cadastrado.</td>
                    </tr>
                  )}
                  {perfis.map(p => {
                    const isAtivoStatus = p.ativo !== false;
                    return (
                      <tr key={p.id} className={`border-b hover:bg-neutral-50/50 transition-colors ${!isAtivoStatus ? 'opacity-65 bg-neutral-50/50' : ''}`}>
                        <td className="p-3 font-medium text-neutral-900 text-sm">
                          <div className="flex items-center gap-2">
                            {p.nome}
                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-semibold border ${isAtivoStatus ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {isAtivoStatus ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleTogglePerfilActive(p)}
                            className="inline-flex items-center gap-1 cursor-pointer transition-all"
                            title={isAtivoStatus ? "Desativar este Perfil" : "Ativar este Perfil"}
                          >
                            {isAtivoStatus ? (
                              <div className="w-12 h-6 flex items-center bg-green-500 rounded-full p-0.5 cursor-pointer">
                                <div className="bg-white w-5 h-5 rounded-full shadow-md transform translate-x-6 duration-300" />
                              </div>
                            ) : (
                              <div className="w-12 h-6 flex items-center bg-neutral-300 rounded-full p-0.5 cursor-pointer">
                                <div className="bg-white w-5 h-5 rounded-full shadow-md transform translate-x-0 duration-300" />
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleStartEditPerfil(p)}
                            className="p-1 px-2.5 bg-neutral-100 hover:bg-[#013B88] hover:text-white rounded text-xs font-semibold text-neutral-700 flex items-center gap-1.5 ml-auto transition-colors cursor-pointer border border-neutral-200 hover:border-transparent"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-lg text-neutral-800">Confirmar Exclusão</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-neutral-600">Tem certeza que deseja excluir este usuário permanentemente? Esta ação não poderá ser desfeita.</p>
            </div>
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-3 rounded-b-lg">
              <button 
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-medium rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteUsuario}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
