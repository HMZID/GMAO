import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/**
 * Scénarios de recette du cahier des charges (§15.9) sur les situations préparées par scripts/seed.ts.
 * R-02 et R-05 : corrective-flow.spec.ts et modules.spec.ts ; R-07 : security.spec.ts.
 */

type Item = Record<string, unknown> & { id: string };

async function data<T = Item>(response: APIResponse): Promise<T> {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  return body.data as T;
}

async function equipmentByCode(page: Page, code: string) {
  const { items } = await data<{ items: Item[] }>(await page.request.get(`/api/v1/equipment?q=${code}`));
  return items.find((e) => e.code === code)!;
}

async function partBySku(page: Page, sku: string) {
  const { items } = await data<{ items: Item[] }>(await page.request.get(`/api/v1/parts?q=${sku}`));
  return items.find((p) => p.sku === sku)!;
}

async function warehouseByName(page: Page, name: string) {
  const list = await data<Item[]>(await page.request.get("/api/v1/warehouses"));
  return list.find((w) => w.name === name)!;
}

async function stockOf(page: Page, partId: string, warehouseId: string) {
  const part = await data<{ levels: { warehouseId: string; onHand: number; reserved: number }[] }>(await page.request.get(`/api/v1/parts/${partId}`));
  return part.levels.find((l) => l.warehouseId === warehouseId) ?? { onHand: 0, reserved: 0 };
}

/** Renseigne tous les points de la checklist de l'OT (mesures au milieu des bornes). */
async function completeTasks(page: Page, workOrderId: string) {
  const { tasks } = await data<{ tasks: Item[] }>(await page.request.get(`/api/v1/work-orders/${workOrderId}`));
  for (const task of tasks) {
    const bounds = [task.minValue, task.maxValue].filter((v) => v !== null && v !== undefined).map(Number);
    const measuredValue = task.kind === "MEASURE" ? (bounds.length ? bounds.reduce((a, b) => a + b) / bounds.length : 1) : undefined;
    await data(await page.request.patch(`/api/v1/work-orders/${workOrderId}/tasks/${task.id}`, { data: { result: "OK", measuredValue } }));
  }
}

async function transition(page: Page, id: string, body: Record<string, unknown>) {
  return page.request.post(`/api/v1/work-orders/${id}/transitions`, { data: body });
}

test("R-01 : entretien à échéance — un seul OT, exécution, coût et échéance suivante", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const loader = await equipmentByCode(page, "CH-012");
  const openPreventive = async () =>
    (await data<{ items: Item[] }>(await page.request.get(`/api/v1/work-orders?equipmentId=${loader.id}&type=PREVENTIVE&status=OPEN`))).items;
  const [workOrder] = await openPreventive();
  expect(workOrder, "OT préventif de CH-012 préparé par la démonstration").toBeTruthy();
  const detail = await data<Item & { meters: Item[]; dueItem: Item | null }>(await page.request.get(`/api/v1/work-orders/${workOrder.id}`));
  const meter = detail.meters[0];
  const dueItemId = detail.dueItem?.id;
  expect(dueItemId).toBeTruthy();

  // Étapes 1-2 : de nouveaux relevés et une nouvelle génération ne créent aucun second OT.
  await login(page, USERS.technicianLyon);
  const reading = Number(meter.lastValue) + 6;
  await data(await page.request.post(`/api/v1/meters/${meter.id}/readings`, { data: { value: reading } }));
  await login(page, USERS.maintenanceManager);
  await data(await page.request.post("/api/v1/preventive/generate"));
  expect((await openPreventive()).map((w) => w.id)).toEqual([workOrder.id]);

  // Étape 4 : le technicien exécute la gamme, consomme les pièces réservées, pointe 3 h et relève le compteur.
  await login(page, USERS.technicianLyon);
  await data(await transition(page, workOrder.id, { to: "IN_PROGRESS" }));
  const running = await data<Item & { reservations: Item[] }>(await page.request.get(`/api/v1/work-orders/${workOrder.id}`));
  await completeTasks(page, workOrder.id);
  for (const r of running.reservations.filter((r) => r.status === "ACTIVE")) {
    const quantity = Number(r.quantity) - Number(r.consumedQuantity ?? 0);
    const part = await partBySku(page, String(r.sku));
    const warehouse = await warehouseByName(page, String(r.warehouseName));
    await data(
      await page.request.post(`/api/v1/work-orders/${workOrder.id}/parts`, {
        data: { action: "issue", partId: part.id, warehouseId: warehouse.id, quantity },
      }),
    );
  }
  await data(await page.request.post(`/api/v1/work-orders/${workOrder.id}/time-entries`, { data: { action: "manual", minutes: 180 } }));
  const closingMeter = reading + 26;
  await data(
    await page.request.post(`/api/v1/meters/${meter.id}/readings`, {
      data: { value: closingMeter, workOrderId: workOrder.id, source: "WORK_ORDER" },
    }),
  );
  await data(
    await page.request.put(`/api/v1/work-orders/${workOrder.id}/report`, { data: { workSummary: "Entretien 250 h réalisé selon la gamme." } }),
  );
  await data(await transition(page, workOrder.id, { to: "WORK_DONE" }));

  // Étape 5 : clôture technique par le chef d'atelier.
  await login(page, USERS.workshopLyon);
  await data(await transition(page, workOrder.id, { to: "TECH_CLOSED", testsPassed: true }));
  const closed = await data<Item & { costs: { labor: number; parts: number; total: number } }>(
    await page.request.get(`/api/v1/work-orders/${workOrder.id}`),
  );
  expect(closed.status).toBe("TECH_CLOSED");
  // Coût de l'OT = main-d'œuvre + pièces.
  expect(closed.costs.labor).toBeGreaterThan(0);
  expect(closed.costs.total).toBeCloseTo(closed.costs.labor + closed.costs.parts, 2);

  // L'échéance est soldée et la suivante est calculée à partir de la réalisation.
  await login(page, USERS.maintenanceManager);
  const due = await data<Item[]>(await page.request.get(`/api/v1/due-items?equipmentId=${loader.id}&status=OPEN`));
  const next = due.find((d) => d.operationName === detail.title);
  expect(next, "échéance suivante de la même opération").toBeTruthy();
  expect(next!.id).not.toBe(dueItemId);
  expect(Number(next!.dueMeterValue)).toBeGreaterThan(closingMeter);
  expect(next!.workOrderId).toBeNull();
});

test("R-03 : rupture de pièce — réservation impossible, stock d'un autre site, transfert puis réservation", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const { items } = await data<{ items: Item[] }>(await page.request.get("/api/v1/work-orders?q=CE-031&pageSize=10"));
  const workOrder = items.find((w) => String(w.title).startsWith("Pompe hydraulique défaillante"))!;
  expect(workOrder.status).toBe("ON_HOLD");
  const pump = await partBySku(page, "POMPE-HYD-TOY");
  const lyon = await warehouseByName(page, "Magasin Lyon");
  const marseille = await warehouseByName(page, "Magasin Marseille");
  const lyonBefore = await stockOf(page, pump.id, lyon.id);
  const needed = lyonBefore.onHand - lyonBefore.reserved + 1;

  // 1. Réservation impossible à Lyon ; le stock de Marseille est visible.
  const refused = await page.request.post(`/api/v1/work-orders/${workOrder.id}/parts`, {
    data: { action: "reserve", partId: pump.id, warehouseId: lyon.id, quantity: needed },
  });
  expect(refused.status()).toBe(422);
  expect(JSON.stringify(await refused.json())).toContain("disponible");
  const marseilleBefore = await stockOf(page, pump.id, marseille.id);
  expect(marseilleBefore.onHand).toBeGreaterThanOrEqual(1);
  expect((await equipmentByCode(page, "CE-031")).status).toBe("IMMOBILIZED");

  // 2-3. Transfert depuis Marseille par le magasinier, puis réservation possible à Lyon.
  await login(page, USERS.storekeeper);
  await data(
    await page.request.post("/api/v1/stock-movements", {
      data: { type: "TRANSFER", partId: pump.id, warehouseId: marseille.id, targetWarehouseId: lyon.id, quantity: 1 },
    }),
  );
  await login(page, USERS.maintenanceManager);
  await data(
    await page.request.post(`/api/v1/work-orders/${workOrder.id}/parts`, {
      data: { action: "reserve", partId: pump.id, warehouseId: lyon.id, quantity: needed },
    }),
  );
  const lyonAfter = await stockOf(page, pump.id, lyon.id);
  expect(lyonAfter.onHand).toBe(lyonBefore.onHand + 1);
  expect(lyonAfter.reserved).toBe(lyonBefore.reserved + needed);
  expect((await stockOf(page, pump.id, marseille.id)).onHand).toBe(marseilleBefore.onHand - 1);

  // 4. Reprise de l'OT ; l'équipement reste immobilisé jusqu'à la remise en service.
  await data(await transition(page, workOrder.id, { to: "IN_PROGRESS" }));
  expect((await equipmentByCode(page, "CE-031")).status).toBe("IMMOBILIZED");
});

test("R-06 : contrôle réglementaire échu — immobilisé, affectation refusée, clôture exigeant le rapport", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const truck = await equipmentByCode(page, "CE-020");
  expect(truck.status).toBe("IMMOBILIZED");

  // Affectation à un chantier refusée.
  await page.goto(`/equipements/${truck.id}`);
  await page.getByText("Nouvelle affectation").click();
  const assign = page.locator("form").filter({ has: page.getByRole("button", { name: "Affecter" }) });
  await assign.getByRole("combobox", { name: "Chantier" }).selectOption({ index: 1 });
  await assign.getByRole("button", { name: "Affecter" }).click();
  await expect(statusMessage(page).filter({ hasText: "Un équipement immobilisé ou réformé ne peut pas être affecté." })).toBeVisible();

  // Le contrôle est réalisé par l'organisme : pas de clôture sans rapport joint (PRV-12).
  const { items } = await data<{ items: Item[] }>(await page.request.get(`/api/v1/work-orders?equipmentId=${truck.id}&type=REGULATORY&status=OPEN`));
  const control = items[0];
  expect(control, "OT de contrôle réglementaire de CE-020").toBeTruthy();
  await data(await transition(page, control.id, { to: "IN_PROGRESS" }));
  await completeTasks(page, control.id);
  const detail = await data<Item & { meters: Item[] }>(await page.request.get(`/api/v1/work-orders/${control.id}`));
  if (detail.meters[0]) {
    await data(
      await page.request.post(`/api/v1/meters/${detail.meters[0].id}/readings`, {
        data: { value: Number(detail.meters[0].lastValue) + 1, workOrderId: control.id, source: "WORK_ORDER" },
      }),
    );
  }
  await data(
    await page.request.put(`/api/v1/work-orders/${control.id}/report`, { data: { workSummary: "Vérification générale périodique réalisée." } }),
  );
  await data(await transition(page, control.id, { to: "WORK_DONE" }));

  const withoutReport = await transition(page, control.id, { to: "TECH_CLOSED", testsPassed: true });
  expect(withoutReport.status()).toBe(422);
  expect(JSON.stringify(await withoutReport.json())).toContain("rapport du contrôle réglementaire");
  expect((await equipmentByCode(page, "CE-020")).status).toBe("IMMOBILIZED");

  await data(
    await page.request.post("/api/v1/documents", {
      multipart: {
        entityType: "WORK_ORDER",
        entityId: control.id,
        kind: "REPORT",
        title: "Rapport VGP — conforme avec réserves",
        file: { name: "rapport-vgp.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% R-06 ${Date.now()}\n%%EOF\n`) },
      },
    }),
  );
  await data(await transition(page, control.id, { to: "TECH_CLOSED", testsPassed: true }));
  expect((await equipmentByCode(page, "CE-020")).status).toBe("AVAILABLE");
});

test("R-08 : inventaire avec écart — « à valider », sortie pendant l'inventaire à part, puis ajustement", async ({ page }) => {
  await login(page, USERS.storekeeper);
  const filter = await partBySku(page, "FLT-AIR-01");
  const lyon = await warehouseByName(page, "Magasin Lyon");
  const before = await stockOf(page, filter.id, lyon.id);
  expect(before.onHand, JSON.stringify({ filter: filter?.id, lyon: lyon?.id, before })).toBeGreaterThanOrEqual(4);

  // 1. Comptage de 3 de moins que le stock théorique : écart au-delà du seuil, stock inchangé.
  await page.goto("/stock/inventaire");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Enregistrer le comptage" }) });
  await form.getByRole("combobox", { name: "Magasin" }).selectOption({ label: "Magasin Lyon — Dépôt Lyon" });
  await form.getByRole("combobox", { name: "Article" }).selectOption({ label: "FLT-AIR-01 — Filtre à air primaire (u)" });
  await form.getByLabel("Quantité comptée").fill(String(before.onHand - 3));
  await form.getByRole("button", { name: "Enregistrer le comptage" }).click();
  await expect(statusMessage(page).filter({ hasText: /écart de -3 : au-delà du seuil/ })).toBeVisible();
  expect((await stockOf(page, filter.id, lyon.id)).onHand).toBe(before.onHand);

  // 2. Une sortie pendant l'inventaire est enregistrée à part.
  await data(
    await page.request.post("/api/v1/stock-movements", {
      data: { type: "SCRAP", partId: filter.id, warehouseId: lyon.id, quantity: 1, reason: "Filtre abîmé au déballage" },
    }),
  );
  expect((await stockOf(page, filter.id, lyon.id)).onHand).toBe(before.onHand - 1);
  // Le magasinier ne valide pas son propre écart.
  const [pending] = await data<Item[]>(await page.request.get("/api/v1/inventory-counts?status=PENDING"));
  expect(pending.sku).toBe("FLT-AIR-01");
  expect((await page.request.post(`/api/v1/inventory-counts/${pending.id}/decision`, { data: { decision: "APPROVE" } })).status()).toBe(403);

  // 3. Le responsable maintenance valide : stock = théorique − sortie − écart, ajustement tracé au coût moyen.
  await login(page, USERS.maintenanceManager, "/validations");
  await expect(page.getByText(/écart\(s\) d'inventaire à valider/)).toBeVisible();
  await page.goto("/stock/inventaire");
  const row = page.locator("li").filter({ hasText: "FLT-AIR-01" });
  await row.getByRole("button", { name: "Valider l'écart" }).click();
  await expect(statusMessage(page).filter({ hasText: "Écart validé : stock ajusté." })).toBeVisible();
  expect((await stockOf(page, filter.id, lyon.id)).onHand).toBe(before.onHand - 4);
  const movements = await data<Item[]>(await page.request.get(`/api/v1/stock-movements?partId=${filter.id}&warehouseId=${lyon.id}`));
  const adjustment = movements.find((m) => m.type === "ADJUSTMENT");
  expect(Number(adjustment?.quantity)).toBe(-3);
  expect(Number(adjustment?.unitCost)).toBeGreaterThan(0);
});
