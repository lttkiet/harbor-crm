import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { api, setApiToken } from './api';
import type { Session } from './types';

type AuthValue = {
  user: Session['user'] | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);
const mode = import.meta.env.VITE_AUTH_MODE ?? 'dev';
const firebaseMode = mode === 'firebase';
const localPasswordMode = mode === 'local';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

async function getFirebaseAuth() {
  if (!Object.values(firebaseConfig).every(Boolean)) throw new Error('Firebase is not configured. Set the VITE_FIREBASE_* values.');
  const [appSdk, authSdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = appSdk.getApps()[0] ?? appSdk.initializeApp(firebaseConfig);
  return { auth: authSdk.getAuth(app), sdk: authSdk };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthValue['user']>(mode === 'dev' ? { id: 'local-admin', email: 'admin@example.com', role: 'admin', teamId: null, isTeamLead: false } : null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(firebaseMode || localPasswordMode);

  async function exchange(firebaseUser: User) {
    const idToken = await firebaseUser.getIdToken();
    const session = await api.firebaseSession(idToken);
    setApiToken(session.accessToken);
    setToken(session.accessToken);
    setUser(session.user);
  }

  useEffect(() => {
    if (localPasswordMode) {
      const saved = sessionStorage.getItem('harbor-session');
      if (!saved) {
        setLoading(false);
        return;
      }
      setApiToken(saved);
      setToken(saved);
      api
        .currentSession()
        .then(({ user: currentUser }) => setUser(currentUser))
        .catch(() => {
          sessionStorage.removeItem('harbor-session');
          setApiToken(null);
          setToken(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    if (!firebaseMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void getFirebaseAuth()
      .then(({ auth, sdk }) => {
        if (cancelled) return;
        unsubscribe = sdk.onIdTokenChanged(auth, async (firebaseUser) => {
          try {
            if (firebaseUser) await exchange(firebaseUser);
            else {
              setApiToken(null);
              setToken(null);
              setUser(null);
            }
          } catch {
            setApiToken(null);
            setToken(null);
            setUser(null);
          } finally {
            setLoading(false);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function signIn(email: string, password: string) {
    if (mode === 'dev') {
      setApiToken(null);
      setToken(null);
      setUser({ id: 'local-admin', email: 'admin@example.com', role: 'admin', teamId: null, isTeamLead: false });
      return;
    }
    if (localPasswordMode) {
      const session = await api.localSession(email, password);
      sessionStorage.setItem('harbor-session', session.accessToken);
      setApiToken(session.accessToken);
      setToken(session.accessToken);
      setUser(session.user);
      return;
    }
    const { auth, sdk } = await getFirebaseAuth();
    const credential = await sdk.signInWithEmailAndPassword(auth, email, password);
    try {
      await exchange(credential.user);
    } catch (error) {
      await sdk.signOut(auth);
      throw error;
    }
  }

  async function signOutUser() {
    if (localPasswordMode) sessionStorage.removeItem('harbor-session');
    if (firebaseMode) {
      const { auth, sdk } = await getFirebaseAuth();
      await sdk.signOut(auth);
    }
    setApiToken(null);
    setToken(null);
    setUser(null);
  }
  async function changePassword(currentPassword: string, newPassword: string) {
    const session = await api.changePassword(currentPassword, newPassword);
    if (localPasswordMode) sessionStorage.setItem('harbor-session', session.accessToken);
    setApiToken(session.accessToken);
    setToken(session.accessToken);
    setUser(session.user);
  }
  const value = useMemo(() => ({ user, token, loading, signIn, signOutUser, changePassword }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
