import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, createApiClient, type ApiClient } from "../lib/api";
import { API_URL } from "../lib/config";
import { cacheStore, queueStorage, tokenStore } from "../lib/storage";

/** Profil renvoyé par GET /api/v1/me : rôles et droits effectifs, les mêmes que sur le web (MOB-01). */
export type Me = {
  userId: string;
  name: string;
  email: string;
  technicianId: string | null;
  roles: string[];
  permissions: { permission: string; scope: unknown }[];
};

type SessionState =
  | { status: "loading" }
  | { status: "signedOut"; message?: string }
  | { status: "signedIn"; me: Me; /** Profil lu dans le cache : démarrage hors connexion. */ offline: boolean };

type SessionValue = {
  state: SessionState;
  api: ApiClient;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const api = useMemo(() => createApiClient({ baseUrl: API_URL, getToken: () => tokenStore.get() }), []);

  const loadProfile = useCallback(async () => {
    try {
      const me = await api.get<Me>("/api/v1/me");
      await cacheStore.set("me", me);
      setState({ status: "signedIn", me, offline: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await tokenStore.clear();
        setState({ status: "signedOut", message: "Session expirée : se reconnecter." });
        return;
      }
      // Hors connexion : on reprend le dernier profil connu pour travailler sur les données embarquées.
      const cached = await cacheStore.get<Me>("me");
      setState(cached ? { status: "signedIn", me: cached.data, offline: true } : { status: "signedOut", message: "Serveur injoignable." });
    }
  }, [api]);

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) setState({ status: "signedOut" });
      else await loadProfile();
    })();
  }, [loadProfile]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      api,
      async signIn(email, password) {
        const token = await api.signIn(email.trim(), password);
        await tokenStore.set(token);
        await loadProfile();
      },
      async signOut() {
        await api.signOut();
        await tokenStore.clear();
        // Les saisies non envoyées sont conservées : elles partiront à la prochaine connexion du même appareil.
        await cacheStore.clear();
        setState({ status: "signedOut" });
      },
      can(permission) {
        return state.status === "signedIn" && state.me.permissions.some((p) => p.permission === permission);
      },
    }),
    [state, api, loadProfile],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession doit être utilisé dans SessionProvider.");
  return value;
}

/** File des saisies non envoyées (pour l'avertissement de déconnexion). */
export async function pendingCount() {
  return (await queueStorage.load()).length;
}
