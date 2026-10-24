import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ActivityPlan } from '../types';

export interface UserConfig {
  velhosLobos: string[];
  adjustmentTerms: any[];
  libraryData: any[];
  updatedAt: any;
}

export interface ActivityHistoryItem {
  id: string;
  theme: string;
  nomeAtividade?: string;
  responsavel: string;
  dataAplicacao: string;
  date: string; // generation date
  plan: ActivityPlan;
  createdAt: any;
  grupoId?: string;
  secaoId?: string;
}

export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  const pathDetail = `users/${userId}/config/main`;
  try {
    const docRef = doc(db, 'users', userId, 'config', 'main');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as UserConfig;
      try {
        localStorage.setItem(`user_config_${userId}`, JSON.stringify(data));
      } catch (_) {}
      return data;
    }
    // Fallback to local storage if available
    try {
      const local = localStorage.getItem(`user_config_${userId}`);
      if (local) return JSON.parse(local);
    } catch (_) {}
    return null;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - recuperando configuração do armazenamento local.");
      try {
        const local = localStorage.getItem(`user_config_${userId}`);
        if (local) return JSON.parse(local);
      } catch (_) {}
      return null;
    }
    handleFirestoreError(error, OperationType.GET, pathDetail);
  }
}

export async function saveUserConfig(userId: string, config: Omit<UserConfig, 'updatedAt'>) {
  // Always persist locally first
  try {
    localStorage.setItem(`user_config_${userId}`, JSON.stringify(config));
  } catch (_) {}

  const pathDetail = `users/${userId}/config/main`;
  try {
    const docRef = doc(db, 'users', userId, 'config', 'main');
    await setDoc(docRef, {
      ...config,
      updatedAt: serverTimestamp()
    });
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - configuração salva no armazenamento local.");
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, pathDetail);
  }
}

export async function getActivitiesHistory(userId: string, grupoId?: string, secaoId?: string, isAdmin?: boolean): Promise<ActivityHistoryItem[]> {
  let pathDetail = `users/${userId}/activities`;
  try {
    if (isAdmin) {
      pathDetail = 'activities';
      const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityHistoryItem[];
      try {
        localStorage.setItem(`activities_history_${userId}`, JSON.stringify(items));
      } catch (_) {}
      return items;
    }

    // If no grupoId, fallback to old user activities
    if (!grupoId || !secaoId) {
      const q = query(collection(db, 'users', userId, 'activities'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityHistoryItem[];
      try {
        localStorage.setItem(`activities_history_${userId}`, JSON.stringify(items));
      } catch (_) {}
      return items;
    }
    
    // Otherwise use global activities
    pathDetail = 'activities';
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).filter((d: any) => d.grupoId === grupoId && d.secaoId === secaoId) as ActivityHistoryItem[];
    try {
      localStorage.setItem(`activities_history_${userId}`, JSON.stringify(items));
    } catch (_) {}
    return items;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - buscando histórico do armazenamento local.");
      try {
        const local = localStorage.getItem(`activities_history_${userId}`);
        if (local) return JSON.parse(local);
      } catch (_) {}
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, pathDetail);
  }
}

export async function saveActivityToHistory(userId: string, item: Omit<ActivityHistoryItem, 'id' | 'createdAt'>, id?: string): Promise<string> {
  const localId = id || 'act_' + Date.now();
  // Persist locally
  try {
    const local = localStorage.getItem(`activities_history_${userId}`);
    const items: ActivityHistoryItem[] = local ? JSON.parse(local) : [];
    const newItem: ActivityHistoryItem = {
      ...item,
      id: localId,
      createdAt: new Date().toISOString()
    };
    const idx = items.findIndex(i => i.id === localId);
    if (idx >= 0) {
      items[idx] = newItem;
    } else {
      items.unshift(newItem);
    }
    localStorage.setItem(`activities_history_${userId}`, JSON.stringify(items));
  } catch (_) {}

  let pathDetail = `users/${userId}/activities`;
  try {
    if (!item.grupoId || !item.secaoId) {
      const docRef = id 
        ? doc(db, 'users', userId, 'activities', id) 
        : doc(collection(db, 'users', userId, 'activities'));
      await setDoc(docRef, {
        ...item,
        createdAt: serverTimestamp()
      }, { merge: true });
      return docRef.id;
    }

    pathDetail = 'activities';
    const docRef = id 
      ? doc(db, 'activities', id) 
      : doc(collection(db, 'activities'));
    await setDoc(docRef, {
      ...item,
      userId,
      createdAt: serverTimestamp()
    }, { merge: true });
    return docRef.id;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - atividade gravada no histórico local.");
      return localId;
    }
    handleFirestoreError(error, OperationType.WRITE, pathDetail);
  }
}

export async function deleteActivityFromHistory(userId: string, activityId: string, isGlobal: boolean = false): Promise<void> {
  // Delete locally
  try {
    const local = localStorage.getItem(`activities_history_${userId}`);
    if (local) {
      const items: ActivityHistoryItem[] = JSON.parse(local);
      const filtered = items.filter(i => i.id !== activityId);
      localStorage.setItem(`activities_history_${userId}`, JSON.stringify(filtered));
    }
  } catch (_) {}

  const pathDetail = isGlobal ? `activities/${activityId}` : `users/${userId}/activities/${activityId}`;
  try {
    if (isGlobal) {
      await deleteDoc(doc(db, 'activities', activityId));
    } else {
      await deleteDoc(doc(db, 'users', userId, 'activities', activityId));
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('unavailable') || error?.code === 'unavailable') {
      console.warn("Firestore offline - atividade removida do histórico local.");
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, pathDetail);
  }
}
