import { describe, expect, it } from "vitest";
import { ApiError, NetworkError, type ApiClient } from "../api";
import { createSyncQueue, memoryStorage, sendOrder, type Operation } from "../sync";

/** API simulée : enregistre les appels, peut échouer à la demande. */
function fakeApi(behaviour: (method: string, path: string, body: unknown) => unknown = () => ({ ok: true })) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const call = async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    const r = behaviour(method, path, body);
    if (r instanceof Error) throw r;
    return r;
  };
  const api = {
    get: (p: string) => call("GET", p),
    post: (p: string, b?: unknown) => call("POST", p, b),
    put: (p: string, b?: unknown) => call("PUT", p, b),
    patch: (p: string, b?: unknown) => call("PATCH", p, b),
    upload: (p: string, fields: unknown) => call("UPLOAD", p, fields),
  } as unknown as ApiClient;
  return { api, calls };
}

let n = 0;
const queue = () => {
  const storage = memoryStorage();
  return { storage, q: createSyncQueue({ storage, newId: () => `id-${++n}-xxxxxxxx` }) };
};

describe("Synchronisation hors connexion (MOB-07, MOB-08)", () => {
  it("donne un identifiant unique à chaque saisie et l'envoie avec", async () => {
    const { q } = queue();
    const op = await q.enqueue({ kind: "time", workOrderId: "wo1", minutes: 45 });
    expect(op.clientId).toMatch(/^m-id-/);
    const { api, calls } = fakeApi();
    const result = await q.flush(api);
    expect(result).toMatchObject({ sent: 1, remaining: 0 });
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/work-orders/wo1/time-entries",
      body: { action: "manual", minutes: 45, clientId: op.clientId },
    });
  });

  it("garde toutes les saisies hors réseau et reprend là où elle s'est arrêtée", async () => {
    const { q, storage } = queue();
    await q.enqueue({ kind: "time", workOrderId: "wo1", minutes: 10 });
    await q.enqueue({ kind: "report", workOrderId: "wo1", workSummary: "Joint changé" });
    let online = false;
    let sentOnce = 0;
    const { api, calls } = fakeApi(() => {
      if (!online && sentOnce++ >= 1) return new NetworkError();
      return { ok: true };
    });
    const first = await q.flush(api);
    expect(first).toMatchObject({ sent: 1, offline: true, remaining: 1 });
    expect(storage.snapshot()[0]).toMatchObject({ kind: "report", status: "pending", attempts: 1 });
    online = true;
    const second = await q.flush(api);
    expect(second).toMatchObject({ sent: 1, remaining: 0 });
    // Le temps n'a été envoyé qu'une fois : aucune saisie dupliquée
    expect(calls.filter((c) => c.path.endsWith("/time-entries"))).toHaveLength(1);
  });

  it("envoie les photos après les données", () => {
    const ops = [
      { kind: "photo", clientId: "a" },
      { kind: "time", clientId: "b" },
      { kind: "transition", clientId: "c" },
    ] as Operation[];
    expect(sendOrder(ops).map((o) => o.clientId)).toEqual(["b", "c", "a"]);
  });

  it("met « à revoir » une saisie refusée par le serveur, sans la perdre, et continue avec les suivantes", async () => {
    const { q, storage } = queue();
    await q.enqueue({ kind: "part", workOrderId: "wo1", partId: "p", warehouseId: "w", quantity: 3, label: "Filtre" });
    await q.enqueue({ kind: "time", workOrderId: "wo1", minutes: 20 });
    const { api } = fakeApi((_m, path) =>
      path.endsWith("/parts")
        ? new ApiError(422, "business_rule", "Refus", { errors: ["Seulement 1 disponible(s) dans Magasin Lyon."] })
        : { ok: true },
    );
    const result = await q.flush(api);
    expect(result).toMatchObject({ sent: 1, rejected: 1, remaining: 1 });
    expect(storage.snapshot()[0]).toMatchObject({ kind: "part", status: "rejected", errors: ["Seulement 1 disponible(s) dans Magasin Lyon."] });

    // Rien ne repart tant que l'utilisateur n'a pas choisi : relancer ou abandonner
    expect((await q.flush(api)).sent).toBe(0);
    await q.discard(storage.snapshot()[0].clientId);
    expect(storage.snapshot()).toHaveLength(0);
  });

  it("considère une transition déjà appliquée comme réussie (envoi précédent interrompu)", async () => {
    const { q } = queue();
    await q.enqueue({ kind: "transition", workOrderId: "wo1", to: "WORK_DONE" });
    const { api } = fakeApi((method) =>
      method === "POST"
        ? new ApiError(422, "business_rule", "Transition interdite", { errors: ["Transition interdite : WORK_DONE → WORK_DONE."] })
        : { status: "WORK_DONE" },
    );
    expect(await q.flush(api)).toMatchObject({ sent: 1, rejected: 0, remaining: 0 });
  });

  it("réessaie plus tard sur une erreur du serveur (5xx)", async () => {
    const { q, storage } = queue();
    await q.enqueue({ kind: "time", workOrderId: "wo1", minutes: 5 });
    const { api } = fakeApi(() => new ApiError(503, "unavailable", "Indisponible"));
    expect(await q.flush(api)).toMatchObject({ sent: 0, rejected: 0, remaining: 1 });
    expect(storage.snapshot()[0].status).toBe("pending");
  });

  it("ne lance qu'une synchronisation à la fois", async () => {
    const { q } = queue();
    await q.enqueue({ kind: "time", workOrderId: "wo1", minutes: 5 });
    const { api, calls } = fakeApi();
    await Promise.all([q.flush(api), q.flush(api)]);
    expect(calls).toHaveLength(1);
  });
});
