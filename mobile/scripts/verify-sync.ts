/**
 * Vérification de bout en bout de la synchronisation mobile contre un serveur GMAO (MOB-07, MOB-08) :
 * client d'API et file de synchronisation de l'application, exécutés en Node, avec un réseau simulé.
 *
 *   npx tsx mobile/scripts/verify-sync.ts http://localhost:3100
 *
 * Prérequis : démonstration chargée (npm run db:reset). Compte technicien de Lyon (mot de passe de démonstration).
 * Parcours : intervention complète saisie « hors connexion », coupure du réseau pendant l'envoi, reprise,
 * renvoi en double des mêmes saisies (aucun doublon attendu), transition déjà appliquée (réponse perdue).
 */
import { createApiClient, NetworkError } from "../src/lib/api";
import { createSyncQueue, memoryStorage, type Operation } from "../src/lib/sync";

const base = process.argv[2] ?? "http://localhost:3100";
const password = process.env.DEMO_PASSWORD ?? "Demo-Gmao-2026";
let token: string | null = null;

/** Réseau simulé : coupé (`offline`), ou coupé juste après l'envoi d'une requête précise (réponse perdue). */
const network = { offline: false, cutAfterNextMatching: null as RegExp | null, calls: 0 };
/**
 * Le fetch de Node ajoute « Sec-Fetch-Mode: cors », comme un navigateur : la protection CSRF exige alors une
 * origine de confiance (BETTER_AUTH_URL du serveur, AUTH_ORIGIN ici). React Native n'envoie pas ces en-têtes.
 */
const authOrigin = process.env.AUTH_ORIGIN ?? base;
const fetchImpl: typeof fetch = async (input, init) => {
  if (network.offline) throw new TypeError("Network request failed");
  network.calls++;
  if (String(input).includes("/api/auth/")) init = { ...init, headers: { ...(init?.headers as Record<string, string>), Origin: authOrigin } };
  const response = await fetch(input, init);
  const url = String(input);
  if (network.cutAfterNextMatching && network.cutAfterNextMatching.test(url) && init?.method === "POST") {
    network.cutAfterNextMatching = null;
    throw new TypeError("Network request failed (réponse perdue)");
  }
  return response;
};

const api = createApiClient({ baseUrl: base, getToken: () => token, fetchImpl });
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "✔" : "✘"} ${label}`);
  if (!ok) process.exitCode = 1;
};

type Wo = {
  id: string;
  number: string;
  status: string;
  tasks: { id: string; kind: string; required: boolean }[];
  timeEntries: { minutes: number | null }[];
  meters: { id: string; isPrimary: boolean; lastValue: number | null }[];
  workSummary: string | null;
};

async function main() {
  token = await api.signIn("tech.lyon@demo.gmao", password);
  const me = await api.get<{ name: string; technicianId: string }>("/api/v1/me");
  check(!!me.technicianId, `connexion du technicien ${me.name} (jeton Bearer, canal mobile)`);

  const list = await api.get<{ items: { id: string; status: string; number: string }[] }>("/api/v1/work-orders?mine=true&status=PLANNED&pageSize=50");
  const target = list.items[0];
  if (!target) throw new Error("Aucun OT planifié pour le technicien : recharger la démonstration (npm run db:reset).");
  let wo = await api.get<Wo>(`/api/v1/work-orders/${target.id}`);
  const meter = wo.meters.find((m) => m.isPrimary) ?? wo.meters[0];
  console.log(`OT ${wo.number} (${wo.status}), ${wo.tasks.length} point(s) de checklist`);

  const storage = memoryStorage();
  let n = 0;
  const queue = createSyncQueue({
    storage,
    newId: () => `${Date.now().toString(36)}-${++n}-verify`,
    readFile: () =>
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new TextEncoder().encode(`photo-${Date.now()}`)])], {
        type: "image/png",
      }),
  });

  // 1. Saisies sur le terrain, sans réseau
  network.offline = true;
  await queue.enqueue({ kind: "transition", workOrderId: wo.id, to: "IN_PROGRESS" });
  for (const t of wo.tasks.filter((t) => t.kind !== "MEASURE")) await queue.enqueue({ kind: "task", workOrderId: wo.id, taskId: t.id, result: "OK" });
  for (const t of wo.tasks.filter((t) => t.kind === "MEASURE"))
    await queue.enqueue({ kind: "task", workOrderId: wo.id, taskId: t.id, result: "OK", measuredValue: 1 });
  await queue.enqueue({ kind: "time", workOrderId: wo.id, minutes: 50, comment: "Saisi hors connexion" });
  await queue.enqueue({
    kind: "report",
    workOrderId: wo.id,
    symptomCode: "FUITE",
    causeCode: "JOINT",
    remedyCode: "REMPLACEMENT",
    workSummary: "Joint remplacé, essai conforme (mobile).",
  });
  if (meter) await queue.enqueue({ kind: "reading", meterId: meter.id, value: (meter.lastValue ?? 0) + 4, workOrderId: wo.id });
  await queue.enqueue({
    kind: "photo",
    entityType: "WORK_ORDER",
    entityId: wo.id,
    uri: "file:///photo.png",
    fileName: "photo.png",
    title: "Photo mobile",
  });
  await queue.enqueue({ kind: "transition", workOrderId: wo.id, to: "WORK_DONE" });
  const total = storage.snapshot().length;
  const offline = await queue.flush(api);
  check(offline.offline && offline.sent === 0 && offline.remaining === total, `hors connexion : ${total} saisie(s) conservée(s), rien de perdu`);

  // 2. Retour du réseau, mais la réponse du démarrage est perdue (le serveur l'a pourtant traité)
  network.offline = false;
  network.cutAfterNextMatching = /\/transitions$/;
  const cut = await queue.flush(api);
  check(cut.offline && cut.remaining === total, "coupure pendant l'envoi : la saisie reste en file");
  wo = await api.get<Wo>(`/api/v1/work-orders/${target.id}`);
  check(wo.status === "IN_PROGRESS", "le serveur avait bien appliqué le démarrage");

  // 3. Reprise : la transition déjà appliquée est reconnue, le reste part dans l'ordre (photos en dernier)
  const sent: Operation[] = storage.snapshot();
  const resumed = await queue.flush(api);
  check(resumed.remaining === 0 && resumed.rejected === 0, `reprise : ${resumed.sent} saisie(s) envoyée(s), aucune refusée`);
  for (const op of storage.snapshot()) console.log(`  à revoir : ${op.kind} — ${(op.errors ?? []).join(" ; ")}`);
  wo = await api.get<Wo>(`/api/v1/work-orders/${target.id}`);
  check(wo.status === "WORK_DONE", "OT passé à « Travaux terminés » (contrôles du serveur satisfaits)");
  const minutes = wo.timeEntries.reduce((s, e) => s + (e.minutes ?? 0), 0);

  // 4. Renvoi en double des mêmes saisies (même clientId) : le serveur n'en crée aucune deuxième fois
  for (const op of sent.filter((o) => ["time", "reading", "photo"].includes(o.kind)))
    await storage.save([...storage.snapshot(), { ...op, status: "pending", attempts: 0 }]);
  await storage.save(storage.snapshot().filter((o) => o.status === "pending"));
  const again = await queue.flush(api);
  for (const op of storage.snapshot()) console.log(`  renvoi refusé : ${op.kind} — ${(op.errors ?? []).join(" ; ")}`);
  const after = await api.get<Wo>(`/api/v1/work-orders/${target.id}`);
  const docs = await api.get<{ items: unknown[] }>(`/api/v1/documents?entityType=WORK_ORDER&entityId=${target.id}`);
  check(again.rejected === 0 && after.timeEntries.reduce((s, e) => s + (e.minutes ?? 0), 0) === minutes, "renvoi du temps : aucun doublon");
  check(docs.items.length === 1, "renvoi de la photo : une seule photo jointe");

  // 5. Erreur réseau typée côté client
  network.offline = true;
  try {
    await api.get("/api/v1/me");
    check(false, "réseau coupé détecté");
  } catch (e) {
    check(e instanceof NetworkError, "réseau coupé : erreur réseau distincte d'un refus du serveur");
  }
  console.log(`${network.calls} requête(s) au serveur.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
