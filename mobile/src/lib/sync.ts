/**
 * Saisies hors connexion et synchronisation contrôlée (MOB-07, MOB-08, MOB-09, CDC §10.3 et §10.4).
 * Module sans dépendance React Native : le stockage et l'API sont injectés (testé en Node).
 *
 * - Chaque saisie reçoit un identifiant unique (`clientId`) à sa création : le serveur ignore un envoi
 *   déjà reçu, une synchronisation coupée puis relancée ne crée aucun doublon.
 * - Envoi dans l'ordre de création ; les photos partent après les données.
 * - Réseau absent ou serveur indisponible : la synchronisation s'arrête, rien n'est perdu, elle reprendra.
 * - Refus du serveur (droits, règle métier) : la saisie est mise « à revoir » avec le motif ; elle n'est
 *   jamais supprimée sans l'accord de l'utilisateur.
 */
import { ApiError, NetworkError, type ApiClient, type FileField } from "./api";

export type OperationPayload =
  | { kind: "time"; workOrderId: string; minutes: number; comment?: string; startedAt?: string }
  | { kind: "part"; workOrderId: string; partId: string; warehouseId: string; quantity: number; label: string }
  | { kind: "task"; workOrderId: string; taskId: string; result?: "OK" | "NOK" | "NA"; measuredValue?: number; comment?: string }
  | { kind: "report"; workOrderId: string; workSummary?: string; symptomCode?: string; causeCode?: string; remedyCode?: string }
  | { kind: "transition"; workOrderId: string; to: "IN_PROGRESS" | "WORK_DONE" | "ON_HOLD"; reason?: string; holdReason?: string }
  | { kind: "photo"; entityType: "WORK_ORDER" | "EQUIPMENT"; entityId: string; uri: string; fileName: string; title?: string }
  | { kind: "reading"; meterId: string; value: number; workOrderId?: string }
  | { kind: "request"; equipmentId: string; symptom: string; description?: string; isStopped: boolean; isSafetyRisk: boolean };

export type Operation = OperationPayload & {
  clientId: string;
  /** Heure du terminal à la saisie (DON-16 : conservée avec l'heure serveur). */
  createdAt: string;
  status: "pending" | "rejected";
  attempts: number;
  /** Motifs du refus du serveur, affichés à l'utilisateur. */
  errors?: string[];
};

export interface QueueStorage {
  load(): Promise<Operation[]>;
  save(operations: Operation[]): Promise<void>;
}

export type SyncResult = { sent: number; rejected: number; remaining: number; offline: boolean; error?: string };

export const OPERATION_LABEL: Record<OperationPayload["kind"], string> = {
  time: "Temps passé",
  part: "Pièce consommée",
  task: "Point de checklist",
  report: "Compte rendu",
  transition: "Changement de statut",
  photo: "Photo",
  reading: "Relevé de compteur",
  request: "Demande d'intervention",
};

/** Libellé d'une saisie dans la file d'attente. */
export function describeOperation(op: OperationPayload) {
  switch (op.kind) {
    case "time":
      return `${OPERATION_LABEL.time} : ${op.minutes} min`;
    case "part":
      return `${OPERATION_LABEL.part} : ${op.quantity} × ${op.label}`;
    case "transition":
      return `${OPERATION_LABEL.transition} : ${op.to === "IN_PROGRESS" ? "démarrage" : op.to === "WORK_DONE" ? "travaux terminés" : "mise en attente"}`;
    case "reading":
      return `${OPERATION_LABEL.reading} : ${op.value}`;
    case "request":
      return `${OPERATION_LABEL.request} : ${op.symptom}`;
    default:
      return OPERATION_LABEL[op.kind];
  }
}

/** Ordre d'envoi : données d'abord, dans l'ordre de saisie ; photos ensuite (§10.4). */
export function sendOrder(operations: Operation[]) {
  const data = operations.filter((o) => o.kind !== "photo");
  const photos = operations.filter((o) => o.kind === "photo");
  return [...data, ...photos];
}

/** Envoi d'une saisie par l'API v1 ; chaque création porte son `clientId` (idempotence). */
async function send(api: ApiClient, op: Operation, readFile: (uri: string, name: string) => FileField) {
  const wo = (id: string) => `/api/v1/work-orders/${id}`;
  switch (op.kind) {
    case "time":
      return api.post(`${wo(op.workOrderId)}/time-entries`, {
        action: "manual",
        minutes: op.minutes,
        comment: op.comment,
        startedAt: op.startedAt,
        clientId: op.clientId,
      });
    case "part":
      return api.post(`${wo(op.workOrderId)}/parts`, {
        action: "issue",
        partId: op.partId,
        warehouseId: op.warehouseId,
        quantity: op.quantity,
        clientId: op.clientId,
      });
    case "task":
      return api.patch(`${wo(op.workOrderId)}/tasks/${op.taskId}`, { result: op.result, measuredValue: op.measuredValue, comment: op.comment });
    case "report":
      return api.put(`${wo(op.workOrderId)}/report`, {
        workSummary: op.workSummary,
        symptomCode: op.symptomCode,
        causeCode: op.causeCode,
        remedyCode: op.remedyCode,
      });
    case "transition":
      try {
        return await api.post(`${wo(op.workOrderId)}/transitions`, { to: op.to, reason: op.reason, holdReason: op.holdReason });
      } catch (error) {
        // Transition déjà appliquée (envoi précédent interrompu après traitement) : rien à refaire.
        if (error instanceof ApiError && error.status === 422) {
          const current = await api.get<{ status: string }>(wo(op.workOrderId));
          if (current?.status === op.to) return current;
        }
        throw error;
      }
    case "photo":
      return api.upload(
        "/api/v1/documents",
        { entityType: op.entityType, entityId: op.entityId, kind: "PHOTO", title: op.title, clientId: op.clientId },
        readFile(op.uri, op.fileName),
        op.fileName,
      );
    case "reading":
      return api.post(`/api/v1/meters/${op.meterId}/readings`, {
        value: op.value,
        workOrderId: op.workOrderId,
        source: op.workOrderId ? "WORK_ORDER" : "MANUAL",
        readAt: op.createdAt,
        clientId: op.clientId,
      });
    case "request":
      return api.post("/api/v1/work-requests", {
        equipmentId: op.equipmentId,
        symptom: op.symptom,
        description: op.description,
        isStopped: op.isStopped,
        isSafetyRisk: op.isSafetyRisk,
        reportedAt: op.createdAt,
        clientId: op.clientId,
      });
  }
}

export function createSyncQueue(deps: {
  storage: QueueStorage;
  newId: () => string;
  now?: () => Date;
  /** Fichier à envoyer pour une photo (React Native : { uri, name, type }). */
  readFile?: (uri: string, name: string) => FileField;
}) {
  const now = deps.now ?? (() => new Date());
  const readFile = deps.readFile ?? ((uri: string, name: string) => ({ uri, name, type: "image/jpeg" }));
  let flushing: Promise<SyncResult> | null = null;

  return {
    async list() {
      return deps.storage.load();
    },

    /** Enregistre une saisie localement ; elle partira à la prochaine synchronisation. */
    async enqueue(payload: OperationPayload) {
      const operations = await deps.storage.load();
      const op: Operation = { ...payload, clientId: `m-${deps.newId()}`, createdAt: now().toISOString(), status: "pending", attempts: 0 };
      await deps.storage.save([...operations, op]);
      return op;
    },

    /** Abandon d'une saisie refusée, sur décision de l'utilisateur. */
    async discard(clientId: string) {
      const operations = await deps.storage.load();
      await deps.storage.save(operations.filter((o) => o.clientId !== clientId));
    },

    /** Nouvelle tentative d'une saisie refusée (après correction côté serveur, par exemple). */
    async retry(clientId: string) {
      const operations = await deps.storage.load();
      await deps.storage.save(operations.map((o) => (o.clientId === clientId ? { ...o, status: "pending" as const, errors: undefined } : o)));
    },

    /**
     * Envoie les saisies en attente. Une seule synchronisation à la fois ; chaque succès est retiré de la file
     * aussitôt (une coupure en cours de route ne fait rien perdre ni renvoyer en double).
     */
    flush(api: ApiClient): Promise<SyncResult> {
      flushing ??= (async () => {
        const result: SyncResult = { sent: 0, rejected: 0, remaining: 0, offline: false };
        try {
          for (const op of sendOrder(await deps.storage.load())) {
            if (op.status !== "pending") continue;
            try {
              await send(api, op, readFile);
              const current = await deps.storage.load();
              await deps.storage.save(current.filter((o) => o.clientId !== op.clientId));
              result.sent++;
            } catch (error) {
              const current = await deps.storage.load();
              if (error instanceof NetworkError || (error instanceof ApiError && error.isServerError)) {
                await deps.storage.save(current.map((o) => (o.clientId === op.clientId ? { ...o, attempts: o.attempts + 1 } : o)));
                result.offline = error instanceof NetworkError;
                result.error = error.message;
                break;
              }
              const errors = error instanceof ApiError ? error.messages : [String(error)];
              await deps.storage.save(
                current.map((o) => (o.clientId === op.clientId ? { ...o, status: "rejected" as const, attempts: o.attempts + 1, errors } : o)),
              );
              result.rejected++;
            }
          }
          result.remaining = (await deps.storage.load()).length;
          return result;
        } finally {
          flushing = null;
        }
      })();
      return flushing;
    },
  };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;

/** Stockage en mémoire (tests et vérifications). */
export function memoryStorage(initial: Operation[] = []): QueueStorage & { snapshot(): Operation[] } {
  let ops = [...initial];
  return {
    async load() {
      return [...ops];
    },
    async save(next) {
      ops = [...next];
    },
    snapshot: () => [...ops],
  };
}
