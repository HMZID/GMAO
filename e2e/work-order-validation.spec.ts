import { expect, test, type APIRequestContext, type PlaywrightWorkerArgs } from "@playwright/test";
import { DEMO_PASSWORD, USERS } from "./helpers";

/**
 * Validation des interventions (HAB-04) : le responsable maintenance valide les interventions dont le coût estimé est
 * sous le seuil fixé par la direction ; au-dessus, seule la direction valide. La direction crée sans validation et peut
 * tout valider. Le seuil ne se règle que par la direction. Scénario par l'API (mêmes services que les écrans).
 */

async function apiAs(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string, email: string): Promise<APIRequestContext> {
  const api = await playwright.request.newContext({ baseURL });
  const response = await api.post("/api/auth/sign-in/email", { data: { email, password: DEMO_PASSWORD }, headers: { Origin: baseURL } });
  expect(response.ok(), `connexion de ${email} : ${response.status()} ${await response.text()}`).toBeTruthy();
  return api;
}

async function createWorkOrder(api: APIRequestContext, equipmentId: string, title: string, estimatedCost: number) {
  const response = await api.post("/api/v1/work-orders", { data: { equipmentId, title, type: "CORRECTIVE", priority: "P3", estimatedCost } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string; validationStatus: string };
}

async function workOrder(api: APIRequestContext, id: string) {
  return (await (await api.get(`/api/v1/work-orders/${id}`)).json()).data as { validationStatus: string; status: string };
}

async function pendingFor(api: APIRequestContext, workOrderId: string) {
  const list = (await (await api.get("/api/v1/approvals")).json()).data as { id: string; objectId: string }[];
  return list.find((a) => a.objectId === workOrderId);
}

test("validation des interventions : responsable maintenance sous le seuil, direction au-dessus, création libre pour la direction", async ({
  playwright,
  baseURL,
}) => {
  const stamp = Date.now();
  const direction = await apiAs(playwright, baseURL!, USERS.executive);
  const manager = await apiAs(playwright, baseURL!, USERS.maintenanceManager);
  const technician = await apiAs(playwright, baseURL!, USERS.technicianLyon);

  try {
    // Seul la direction fixe le seuil ; le responsable maintenance le lit mais ne le modifie pas.
    const denied = await manager.put("/api/v1/work-order-validation", { data: { enabled: true, threshold: 100000 } });
    expect(denied.status()).toBe(403);
    const set = await direction.put("/api/v1/work-order-validation", { data: { enabled: true, threshold: 3000 } });
    expect(set.ok(), await set.text()).toBeTruthy();
    expect((await (await manager.get("/api/v1/work-order-validation")).json()).data).toEqual({ enabled: true, threshold: 3000 });
    // Le paramétrage général des circuits ne contourne pas ce droit : le responsable maintenance n'ajoute pas d'étape.
    const workflows = (await (await manager.get("/api/v1/approval-workflows")).json()).data as { id: string; objectType: string }[];
    expect(workflows.some((w) => w.objectType === "WORK_ORDER")).toBe(true);

    const { items } = (await (await technician.get("/api/v1/equipment?q=CA-101")).json()).data as { items: { id: string; code: string }[] };
    const equipmentId = items.find((e) => e.code === "CA-101")!.id;

    // Sous le seuil : en attente, ni planifiable ni démarrable, puis validée par le responsable maintenance.
    const small = await createWorkOrder(technician, equipmentId, `Petit montant ${stamp}`, 1200);
    expect(small.validationStatus).toBe("PENDING");
    const blocked = await technician.post(`/api/v1/work-orders/${small.id}/transitions`, { data: { to: "PLANNED" } });
    expect(blocked.status()).toBe(422);
    expect(await blocked.text()).toContain("en attente de validation");
    const smallRequest = await pendingFor(manager, small.id);
    expect(smallRequest, "le responsable maintenance voit la demande sous le seuil").toBeTruthy();
    const approved = await manager.post(`/api/v1/approvals/${smallRequest!.id}/decision`, { data: { decision: "APPROVED" } });
    expect(approved.ok(), await approved.text()).toBeTruthy();
    expect((await workOrder(manager, small.id)).validationStatus).toBe("APPROVED");

    // Au seuil et au-dessus : le responsable maintenance ne voit rien, la direction valide.
    const large = await createWorkOrder(technician, equipmentId, `Gros montant ${stamp}`, 8000);
    expect(large.validationStatus).toBe("PENDING");
    expect(await pendingFor(manager, large.id)).toBeUndefined();
    const largeRequest = await pendingFor(direction, large.id);
    expect(largeRequest, "la direction voit la demande au-dessus du seuil").toBeTruthy();
    const refusedByManager = await manager.post(`/api/v1/approvals/${largeRequest!.id}/decision`, { data: { decision: "APPROVED" } });
    expect(refusedByManager.status()).toBe(404);
    expect((await direction.post(`/api/v1/approvals/${largeRequest!.id}/decision`, { data: { decision: "APPROVED" } })).ok()).toBeTruthy();
    expect((await workOrder(direction, large.id)).validationStatus).toBe("APPROVED");

    // La direction valide aussi sous le seuil (elle a les droits du responsable maintenance).
    const another = await createWorkOrder(technician, equipmentId, `Validé par la direction ${stamp}`, 800);
    const anotherRequest = await pendingFor(direction, another.id);
    expect(anotherRequest).toBeTruthy();
    expect((await direction.post(`/api/v1/approvals/${anotherRequest!.id}/decision`, { data: { decision: "APPROVED" } })).ok()).toBeTruthy();

    // La direction crée directement, sans validation, quel que soit le montant.
    expect((await createWorkOrder(direction, equipmentId, `Direction ${stamp}`, 90_000)).validationStatus).toBe("APPROVED");
    // Le responsable maintenance crée sans validation sous le seuil, avec la direction au-delà.
    expect((await createWorkOrder(manager, equipmentId, `Responsable ${stamp}`, 500)).validationStatus).toBe("APPROVED");
    const managerLarge = await createWorkOrder(manager, equipmentId, `Responsable gros ${stamp}`, 9000);
    expect(managerLarge.validationStatus).toBe("PENDING");
    expect(await pendingFor(direction, managerLarge.id)).toBeTruthy();

    // Refus : commentaire obligatoire, l'intervention est annulée.
    const refused = await createWorkOrder(technician, equipmentId, `À refuser ${stamp}`, 100);
    const refusedRequest = await pendingFor(manager, refused.id);
    const noComment = await manager.post(`/api/v1/approvals/${refusedRequest!.id}/decision`, { data: { decision: "REJECTED" } });
    expect(noComment.status()).toBe(422);
    expect(
      (await manager.post(`/api/v1/approvals/${refusedRequest!.id}/decision`, { data: { decision: "REJECTED", comment: "Pas prioritaire" } })).ok(),
    ).toBeTruthy();
    const after = await workOrder(manager, refused.id);
    expect(after).toMatchObject({ validationStatus: "REJECTED", status: "CANCELLED" });

    // Désactivée, la validation garde son seuil : la direction le retrouve en la réactivant.
    await direction.put("/api/v1/work-order-validation", { data: { enabled: false, threshold: 3000 } });
    expect((await (await manager.get("/api/v1/work-order-validation")).json()).data).toEqual({ enabled: false, threshold: 3000 });
  } finally {
    // La démonstration reste dans son état d'origine : validation des interventions désactivée.
    await direction.put("/api/v1/work-order-validation", { data: { enabled: false, threshold: 3000 } });
  }
});
