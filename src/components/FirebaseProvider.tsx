import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UsuarioDoc } from '../types';
import { ADMIN_EMAILS } from '../services/admin';

interface AuthContextType {
  user: User | null;
  userData: UsuarioDoc | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  isSigningIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UsuarioDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const clearAuthError = () => setAuthError(null);

  const fetchUserData = async (uid: string, retries = 1, delay = 500): Promise<void> => {
    const currentUser = auth.currentUser;
    const isCurrentUserAdmin = Boolean(
      currentUser?.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase())
    );

    // 1. If user is an Admin, assign approved admin profile immediately to avoid any UI block or wait
    if (isCurrentUserAdmin && currentUser?.email) {
      const adminData: UsuarioDoc = {
        uid,
        email: currentUser.email,
        nome: currentUser.displayName || 'Administrador',
        perfilId: 'admin',
        perfilNome: 'Administrador',
        grupoId: 'Todos',
        secaoId: 'Todos',
        status: 'approved'
      };
      setUserData(adminData);
      try {
        localStorage.setItem(`usuario_doc_${uid}`, JSON.stringify(adminData));
      } catch (_) {}
    } else {
      // Check local cache for previously loaded profile
      try {
        const cached = localStorage.getItem(`usuario_doc_${uid}`);
        if (cached) {
          setUserData(JSON.parse(cached));
        }
      } catch (_) {}
    }

    // 2. Fetch fresh document from Firestore with a resilient timeout
    try {
      const fetchPromise = getDoc(doc(db, 'usuarios', uid));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('client is offline (timeout)')), 2500)
      );

      const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
      if (docSnap.exists()) {
        const remoteData = docSnap.data() as UsuarioDoc;
        setUserData(remoteData);
        try {
          localStorage.setItem(`usuario_doc_${uid}`, JSON.stringify(remoteData));
        } catch (_) {}
      } else if (isCurrentUserAdmin && currentUser?.email) {
        // Save admin record in the background without blocking
        setDoc(doc(db, 'usuarios', uid), {
          uid,
          email: currentUser.email,
          nome: currentUser.displayName || 'Administrador',
          perfilId: 'admin',
          perfilNome: 'Administrador',
          grupoId: 'Todos',
          secaoId: 'Todos',
          status: 'approved',
          createdAt: serverTimestamp()
        }).catch(err => console.warn("Auto-creation of admin record in background deferred:", err?.message || err));
      } else {
        setUserData(null);
      }
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      const isOfflineOrUnavailable = 
        errMsg.includes('client is offline') || 
        errMsg.includes('offline') || 
        errMsg.includes('timeout') ||
        e?.code === 'unavailable';

      if (isOfflineOrUnavailable) {
        console.warn("Firestore em modo offline/indisponível ao carregar dados do usuário. Utilizando cache local.");
        return;
      }

      console.warn("Aviso ao buscar dados do usuário no Firestore:", errMsg);
      if (!isCurrentUserAdmin) {
        try {
          const cached = localStorage.getItem(`usuario_doc_${uid}`);
          if (cached) {
            setUserData(JSON.parse(cached));
          }
        } catch (_) {}
      }
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      setUser(user);
      if (user) {
        setAuthError(null);
        await fetchUserData(user.uid);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async () => {
    if (isSigningIn) return;
    setAuthError(null);
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        console.info("Login com Google cancelado pelo usuário.");
      } else if (code === 'auth/popup-blocked') {
        const msg = "A janela de login foi bloqueada pelo navegador. Permita pop-ups para esta página ou abra o aplicativo em uma nova aba.";
        console.warn("Pop-up bloqueado:", msg);
        setAuthError(msg);
      } else if (code === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
        const msg = `O domínio "${domain}" precisa ser autorizado nas configurações de autenticação do Firebase.`;
        console.warn("Domínio não autorizado:", msg);
        setAuthError(msg);
      } else {
        console.error("Auth Error:", error);
        setAuthError(error?.message || "Erro ao fazer login com o Google. Tente novamente.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setAuthError(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const isAdmin = (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) || userData?.perfilNome === 'Administrador';

  return (
    <AuthContext.Provider value={{ user, userData, loading, isAdmin, signIn, logout, refreshUserData, authError, clearAuthError, isSigningIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context;
};

