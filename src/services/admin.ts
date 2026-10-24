import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GrupoEscoteiro, Secao, Perfil, UsuarioDoc } from '../types';

export const ADMIN_EMAILS = [
  'jeferson.samagaia@gmail.com', 
  'samagaiajeferson@gmail.com',
  'alcateia03gelb@gmail.com'
];
export const ADMIN_EMAIL = 'jeferson.samagaia@gmail.com';

export const DEFAULT_GRUPOS: GrupoEscoteiro[] = [
  {
    id: 'gelb_03',
    nome: '03º Grupo Escoteiro Lobo-Guará (GELB)',
    cnpj: '',
    endereco: 'Goiânia - GO',
    email: 'alcateia03gelb@gmail.com',
    telefone: '',
    logoUrl: '',
    observacoes: 'Grupo Sede',
    ativo: true
  },
  {
    id: 'grupo_geral',
    nome: 'Grupo Escoteiro Geral',
    cnpj: '',
    endereco: 'Brasil',
    email: '',
    telefone: '',
    logoUrl: '',
    observacoes: '',
    ativo: true
  }
];

export const DEFAULT_SECOES: Secao[] = [
  { id: 'alcateia_ramos', nome: 'Alcateia Mowgli', grupoId: 'gelb_03', ativo: true },
  { id: 'alcateia_seeonee', nome: 'Alcateia Seeonee', grupoId: 'gelb_03', ativo: true },
  { id: 'secao_geral', nome: 'Alcateia Geral', grupoId: 'grupo_geral', ativo: true }
];

export const DEFAULT_PERFIS: Perfil[] = [
  { id: 'admin', nome: 'Administrador', ativo: true },
  { id: 'chefe', nome: 'Chefe de Seção', ativo: true }
];

// Grupos
export async function getGrupos(): Promise<GrupoEscoteiro[]> {
  const pathDetail = 'grupos';
  try {
    const querySnapshot = await getDocs(collection(db, 'grupos'));
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GrupoEscoteiro[];
    if (list.length > 0) {
      try { localStorage.setItem('cached_grupos', JSON.stringify(list)); } catch (_) {}
      return list;
    }
    return DEFAULT_GRUPOS;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - utilizando grupos locais.");
      try {
        const cached = localStorage.getItem('cached_grupos');
        if (cached) return JSON.parse(cached);
      } catch (_) {}
      return DEFAULT_GRUPOS;
    }
    handleFirestoreError(error, OperationType.LIST, pathDetail);
  }
}

export async function getGrupo(id: string): Promise<GrupoEscoteiro | null> {
  const pathDetail = `grupos/${id}`;
  try {
    const docSnap = await getDoc(doc(db, 'grupos', id));
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as GrupoEscoteiro;
    return DEFAULT_GRUPOS.find(g => g.id === id) || null;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      return DEFAULT_GRUPOS.find(g => g.id === id) || null;
    }
    handleFirestoreError(error, OperationType.GET, pathDetail);
  }
}

export async function saveGrupo(grupo: Omit<GrupoEscoteiro, 'id' | 'createdAt'>, id?: string): Promise<string> {
  const pathDetail = id ? `grupos/${id}` : 'grupos';
  const docRef = id ? doc(db, 'grupos', id) : doc(collection(db, 'grupos'));
  const targetId = docRef.id;
  try {
    const cached = localStorage.getItem('cached_grupos');
    const list: GrupoEscoteiro[] = cached ? JSON.parse(cached) : [...DEFAULT_GRUPOS];
    const idx = list.findIndex(g => g.id === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...grupo };
    } else {
      list.push({ id: targetId, ...grupo });
    }
    localStorage.setItem('cached_grupos', JSON.stringify(list));
  } catch (_) {}

  try {
    await setDoc(docRef, {
      ...grupo,
      updatedAt: serverTimestamp(),
      ...(id ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
    return docRef.id;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - grupo salvo localmente.");
      return targetId;
    }
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.WRITE, pathDetail);
  }
}

export async function deleteGrupo(id: string): Promise<void> {
  try {
    const cached = localStorage.getItem('cached_grupos');
    if (cached) {
      const list: GrupoEscoteiro[] = JSON.parse(cached);
      localStorage.setItem('cached_grupos', JSON.stringify(list.filter(g => g.id !== id)));
    }
  } catch (_) {}

  const pathDetail = `grupos/${id}`;
  try {
    await deleteDoc(doc(db, 'grupos', id));
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, pathDetail);
  }
}

// Secoes
export async function getSecoes(grupoId?: string): Promise<Secao[]> {
  const pathDetail = 'secoes';
  try {
    const querySnapshot = await getDocs(collection(db, 'secoes'));
    let secoes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Secao[];
    if (secoes.length === 0) secoes = DEFAULT_SECOES;
    try { localStorage.setItem('cached_secoes', JSON.stringify(secoes)); } catch (_) {}
    if (grupoId) {
      let matchingGrp: GrupoEscoteiro | undefined;
      try {
        const cachedG = localStorage.getItem('cached_grupos');
        const gruposList: GrupoEscoteiro[] = cachedG ? JSON.parse(cachedG) : DEFAULT_GRUPOS;
        matchingGrp = gruposList.find(g => 
          g.id === grupoId || 
          g.nome === grupoId || 
          g.nome?.toLowerCase().trim() === grupoId?.toLowerCase().trim()
        );
      } catch (_) {}

      secoes = secoes.filter(s => 
        s.grupoId === grupoId || 
        (matchingGrp && (
          s.grupoId === matchingGrp.id || 
          s.grupoId === matchingGrp.nome ||
          s.grupoId?.toLowerCase().trim() === matchingGrp.nome?.toLowerCase().trim() ||
          s.grupoId?.toLowerCase().trim() === matchingGrp.id?.toLowerCase().trim()
        ))
      );
    }
    return secoes;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - utilizando seções locais.");
      let list = DEFAULT_SECOES;
      try {
        const cached = localStorage.getItem('cached_secoes');
        if (cached) list = JSON.parse(cached);
      } catch (_) {}
      if (grupoId) {
        let matchingGrp: GrupoEscoteiro | undefined;
        try {
          const cachedG = localStorage.getItem('cached_grupos');
          const gruposList: GrupoEscoteiro[] = cachedG ? JSON.parse(cachedG) : DEFAULT_GRUPOS;
          matchingGrp = gruposList.find(g => 
            g.id === grupoId || 
            g.nome === grupoId || 
            g.nome?.toLowerCase().trim() === grupoId?.toLowerCase().trim()
          );
        } catch (_) {}

        list = list.filter(s => 
          s.grupoId === grupoId || 
          (matchingGrp && (
            s.grupoId === matchingGrp.id || 
            s.grupoId === matchingGrp.nome ||
            s.grupoId?.toLowerCase().trim() === matchingGrp.nome?.toLowerCase().trim() ||
            s.grupoId?.toLowerCase().trim() === matchingGrp.id?.toLowerCase().trim()
          ))
        );
      }
      return list;
    }
    handleFirestoreError(error, OperationType.LIST, pathDetail);
  }
}

export async function getSecao(id: string): Promise<Secao | null> {
  const pathDetail = `secoes/${id}`;
  try {
    const docSnap = await getDoc(doc(db, 'secoes', id));
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Secao;
    return DEFAULT_SECOES.find(s => s.id === id) || null;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      return DEFAULT_SECOES.find(s => s.id === id) || null;
    }
    handleFirestoreError(error, OperationType.GET, pathDetail);
  }
}

export async function saveSecao(secao: Omit<Secao, 'id' | 'createdAt'>, id?: string): Promise<string> {
  const pathDetail = id ? `secoes/${id}` : 'secoes';
  const docRef = id ? doc(db, 'secoes', id) : doc(collection(db, 'secoes'));
  const targetId = docRef.id;
  try {
    const cached = localStorage.getItem('cached_secoes');
    const list: Secao[] = cached ? JSON.parse(cached) : [...DEFAULT_SECOES];
    const idx = list.findIndex(s => s.id === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...secao };
    } else {
      list.push({ id: targetId, ...secao });
    }
    localStorage.setItem('cached_secoes', JSON.stringify(list));
  } catch (_) {}

  try {
    await setDoc(docRef, {
      ...secao,
      updatedAt: serverTimestamp(),
      ...(id ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
    return docRef.id;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - seção salva localmente.");
      return targetId;
    }
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.WRITE, pathDetail);
  }
}

export async function deleteSecao(id: string): Promise<void> {
  try {
    const cached = localStorage.getItem('cached_secoes');
    if (cached) {
      const list: Secao[] = JSON.parse(cached);
      localStorage.setItem('cached_secoes', JSON.stringify(list.filter(s => s.id !== id)));
    }
  } catch (_) {}

  const pathDetail = `secoes/${id}`;
  try {
    await deleteDoc(doc(db, 'secoes', id));
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, pathDetail);
  }
}

// Perfis
export async function getPerfis(): Promise<Perfil[]> {
  const pathDetail = 'perfis';
  try {
    const querySnapshot = await getDocs(collection(db, 'perfis'));
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Perfil[];
    if (list.length > 0) {
      try { localStorage.setItem('cached_perfis', JSON.stringify(list)); } catch (_) {}
      return list;
    }
    return DEFAULT_PERFIS;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - utilizando perfis padrão.");
      try {
        const cached = localStorage.getItem('cached_perfis');
        if (cached) return JSON.parse(cached);
      } catch (_) {}
      return DEFAULT_PERFIS;
    }
    handleFirestoreError(error, OperationType.LIST, pathDetail);
  }
}

export async function savePerfil(perfil: Omit<Perfil, 'id' | 'createdAt'>, id?: string): Promise<string> {
  const pathDetail = id ? `perfis/${id}` : 'perfis';
  const targetId = id || 'perfil_' + Date.now();
  try {
    const cached = localStorage.getItem('cached_perfis');
    const list: Perfil[] = cached ? JSON.parse(cached) : [...DEFAULT_PERFIS];
    const idx = list.findIndex(p => p.id === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...perfil };
    } else {
      list.push({ id: targetId, ...perfil });
    }
    localStorage.setItem('cached_perfis', JSON.stringify(list));
  } catch (_) {}

  try {
    const docRef = id ? doc(db, 'perfis', id) : doc(collection(db, 'perfis'));
    await setDoc(docRef, {
      ...perfil,
      updatedAt: serverTimestamp(),
      ...(id ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
    return docRef.id;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - perfil salvo localmente.");
      return targetId;
    }
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.WRITE, pathDetail);
  }
}

// Usuarios
export async function getUsuarios(): Promise<UsuarioDoc[]> {
  const pathDetail = 'usuarios';
  try {
    const querySnapshot = await getDocs(collection(db, 'usuarios'));
    const list = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UsuarioDoc[];
    try { localStorage.setItem('cached_usuarios', JSON.stringify(list)); } catch (_) {}
    return list;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - buscando usuários locais.");
      try {
        const cached = localStorage.getItem('cached_usuarios');
        if (cached) return JSON.parse(cached);
      } catch (_) {}
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, pathDetail);
  }
}

export async function getUsuario(uid: string): Promise<UsuarioDoc | null> {
  const pathDetail = `usuarios/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, 'usuarios', uid));
    if (docSnap.exists()) return docSnap.data() as UsuarioDoc;
    try {
      const cached = localStorage.getItem(`usuario_doc_${uid}`);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      try {
        const cached = localStorage.getItem(`usuario_doc_${uid}`);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
      return null;
    }
    handleFirestoreError(error, OperationType.GET, pathDetail);
  }
}

export async function saveUsuario(uid: string, data: Omit<UsuarioDoc, 'uid'>): Promise<void> {
  try {
    localStorage.setItem(`usuario_doc_${uid}`, JSON.stringify({ ...data, uid }));
  } catch (_) {}

  const pathDetail = `usuarios/${uid}`;
  try {
    await setDoc(doc(db, 'usuarios', uid), { ...data, uid }, { merge: true });
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - dados de usuário salvos localmente.");
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, pathDetail);
  }
}

export async function updateUsuarioStatus(uid: string, status: 'approved' | 'rejected'): Promise<void> {
  try {
    const cached = localStorage.getItem(`usuario_doc_${uid}`);
    if (cached) {
      const u = JSON.parse(cached);
      u.status = status;
      localStorage.setItem(`usuario_doc_${uid}`, JSON.stringify(u));
    }
  } catch (_) {}

  const pathDetail = `usuarios/${uid}`;
  try {
    await setDoc(doc(db, 'usuarios', uid), { status, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, pathDetail);
  }
}

export async function deleteUsuario(uid: string): Promise<void> {
  try {
    localStorage.removeItem(`usuario_doc_${uid}`);
  } catch (_) {}

  const pathDetail = `usuarios/${uid}`;
  try {
    await deleteDoc(doc(db, 'usuarios', uid));
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, pathDetail);
  }
}
