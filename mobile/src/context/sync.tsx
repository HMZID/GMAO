import NetInfo from "@react-native-community/netinfo";
import { randomUUID } from "expo-crypto";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { queueStorage } from "../lib/storage";
import { createSyncQueue, type Operation, type OperationPayload, type SyncResult } from "../lib/sync";
import { useSession } from "./session";

/**
 * État de synchronisation affiché en permanence (§10.3) : connexion, dernière synchronisation, saisies en attente.
 * La synchronisation part au retour du réseau, après chaque saisie si le réseau est là, et à la demande.
 */
type SyncValue = {
  online: boolean;
  syncing: boolean;
  lastSyncAt: Date | null;
  lastResult: SyncResult | null;
  operations: Operation[];
  enqueue: (payload: OperationPayload) => Promise<void>;
  syncNow: () => Promise<void>;
  discard: (clientId: string) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
};

const SyncContext = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { api, state } = useSession();
  const queue = useMemo(() => createSyncQueue({ storage: queueStorage, newId: randomUUID }), []);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const signedIn = state.status === "signedIn";
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const refresh = useCallback(async () => setOperations(await queue.list()), [queue]);

  const syncNow = useCallback(async () => {
    if (!signedIn) return;
    setSyncing(true);
    try {
      const result = await queue.flush(api);
      setLastResult(result);
      if (!result.offline) setLastSyncAt(new Date());
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [api, queue, refresh, signedIn]);

  useEffect(() => {
    refresh();
    const unsubscribe = NetInfo.addEventListener((s) => {
      const isOnline = !!s.isConnected && s.isInternetReachable !== false;
      const wasOffline = !onlineRef.current;
      setOnline(isOnline);
      if (isOnline && wasOffline) void syncNow();
    });
    return unsubscribe;
  }, [refresh, syncNow]);

  useEffect(() => {
    if (signedIn) void syncNow();
  }, [signedIn, syncNow]);

  const value = useMemo<SyncValue>(
    () => ({
      online,
      syncing,
      lastSyncAt,
      lastResult,
      operations,
      async enqueue(payload) {
        await queue.enqueue(payload);
        await refresh();
        if (onlineRef.current) void syncNow();
      },
      syncNow,
      async discard(clientId) {
        await queue.discard(clientId);
        await refresh();
      },
      async retry(clientId) {
        await queue.retry(clientId);
        await refresh();
        void syncNow();
      },
    }),
    [online, syncing, lastSyncAt, lastResult, operations, queue, refresh, syncNow],
  );

  return <SyncContext value={value}>{children}</SyncContext>;
}

export function useSync() {
  const value = use(SyncContext);
  if (!value) throw new Error("useSync doit être utilisé dans SyncProvider.");
  return value;
}
