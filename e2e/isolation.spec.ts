import { expect, type Page, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/**
 * Isolement des organisations : une organisation ne voit ni ne relie jamais les données d'une autre,
 * même en fournissant directement leurs identifiants à l'API.
 */

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("une organisation ne peut ni lire ni relier les données d'une autre", async ({ page }) => {
  const stamp = Date.now();
  const email = `isolation.${stamp}@exemple.test`;
  const password = "Isolation-2026-ok";

  // 1. Une seconde organisation (client B), avec ses propres fournisseur, article et magasin.
  await login(page, USERS.admin, "/administration/plateforme");
  await page.getByText("Nouvelle démonstration").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ouvrir la démonstration" }) });
  await form.getByLabel("Organisation (client)").fill(`Client B ${stamp}`);
  await form.getByLabel("Direction du client (premier compte)").fill("Admin B");
  await form.getByLabel("Courriel (identifiant)").fill(email);
  await form.getByLabel("Mot de passe initial").fill(password);
  await form.getByRole("button", { name: "Ouvrir la démonstration" }).click();
  await expect(statusMessage(page).filter({ hasText: /Démonstration/ })).toBeVisible();

  await signIn(page, email, password);
  const supplierB = (await (await page.request.post("/api/v1/suppliers", { data: { name: `Fournisseur B ${stamp}` } })).json()).data;
  const partB = (await (await page.request.post("/api/v1/parts", { data: { sku: `B-${stamp}`, name: "Article B" } })).json()).data;
  const warehouseB = (await (await page.request.get("/api/v1/warehouses")).json()).data[0];
  expect(supplierB.id && partB.id && warehouseB.id).toBeTruthy();
  // Le client B ne voit rien de l'organisation de démonstration.
  expect((await (await page.request.get("/api/v1/equipment")).json()).data.items).toHaveLength(0);
  expect((await (await page.request.get("/api/v1/exports/suppliers")).json()).data.items.map((s: { id: string }) => s.id)).toEqual([supplierB.id]);

  // 2. L'organisation de démonstration (A) tente d'utiliser les identifiants de B.
  await login(page, USERS.maintenanceManager);
  const equipmentA = (await (await page.request.get("/api/v1/equipment?q=PE-007")).json()).data.items[0];
  const foreignSupplier = await page.request.post("/api/v1/work-orders", {
    data: { equipmentId: equipmentA.id, title: "Essai d'isolement", isExternal: true, supplierId: supplierB.id },
  });
  expect(foreignSupplier.status()).toBe(404);
  expect((await foreignSupplier.json()).error.message).toContain("Prestataire");

  // Un OT de A, puis une réservation avec l'article de B : refusée, rien n'est créé chez B.
  const created = await page.request.post("/api/v1/work-orders", { data: { equipmentId: equipmentA.id, title: `Isolement ${stamp}` } });
  expect(created.status()).toBe(201);
  const woA = (await created.json()).data;
  const warehousesA = (await (await page.request.get("/api/v1/warehouses")).json()).data;
  const foreignPart = await page.request.post(`/api/v1/work-orders/${woA.id}/parts`, {
    data: { action: "reserve", partId: partB.id, warehouseId: warehousesA[0].id, quantity: 1 },
  });
  expect(foreignPart.status()).toBe(404);
  const foreignWarehouse = await page.request.post(`/api/v1/work-orders/${woA.id}/parts`, {
    data: { action: "reserve", partId: partB.id, warehouseId: warehouseB.id, quantity: 1 },
  });
  expect(foreignWarehouse.status()).toBe(404);

  // Ni ses magasins dans les listes de A, ni la société de B dans un export (administrateur, qui a le droit d'exporter).
  expect(warehousesA.map((w: { id: string }) => w.id)).not.toContain(warehouseB.id);
  await login(page, USERS.executive);
  expect((await page.request.get(`/api/v1/exports?companyId=${warehouseB.companyId}`)).status()).toBe(404);

  // 3. Retour chez B : son article n'a ni stock ni réservation venant de A.
  await signIn(page, email, password);
  const levels = (await (await page.request.get("/api/v1/exports/stock-levels")).json()).data.items;
  expect(levels).toHaveLength(0);
});
