import { useCallback, useEffect, useState } from "react";
import { useSession } from "../context/session";
import { ApiError, NetworkError } from "./api";
import { cacheStore } from "./storage";

/**
 * Lecture d'une ressource de l'API avec repli sur la dernière copie embarquée (§10.3 : consultation hors
 * connexion des OT affectés, des équipements du périmètre, des échéances). `stale` : données du cache.
 */
export function useApiData<T>(path: string | null) {
  const { api } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const fresh = await api.get<T>(path);
      setData(fresh);
      setStale(null);
      await cacheStore.set(path, fresh);
    } catch (e) {
      const cached = await cacheStore.get<T>(path);
      if (cached && e instanceof NetworkError) {
        setData(cached.data);
        setStale(cached.savedAt);
      } else if (e instanceof ApiError) {
        setError(e.status === 404 ? "Introuvable ou hors de votre périmètre." : e.messages.join(" "));
      } else {
        setError("Hors connexion : ces données n'ont pas encore été consultées sur cet appareil.");
      }
    } finally {
      setLoading(false);
    }
  }, [api, path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, stale, reload: load };
}
