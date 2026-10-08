import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

test("R-05 : le remplacement d'horamètre conserve l'usage cumulé (PE-002)", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  await page.goto("/equipements?q=PE-002");
  await page.getByRole("link", { name: "PE-002" }).click();
  await expect(page.getByRole("heading", { name: /PE-002/ })).toBeVisible();
  // Valeur lue 120 h, cumulée 6 970 h (6 850 h de l'ancien compteur + 120 h)
  await expect(page.getByText(/6\s970 h/).first()).toBeVisible();
});

test("préventif : échéance en retard et plan d'entretien", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  await page.goto("/preventif/echeances?status=OVERDUE");
  await expect(page.getByRole("link", { name: "PE-007" })).toBeVisible();
  await page.goto("/preventif");
  await page.getByRole("link", { name: "Chargeuse sur pneus — entretien périodique" }).click();
  await expect(page.getByRole("heading", { name: /Entretien 250 h ou 3 mois/ })).toBeVisible();
  await expect(page.getByText(/250 h ou 3 mois — au premier seuil atteint/)).toBeVisible();
});

test("stock : le magasinier enregistre une réception", async ({ page }) => {
  await login(page, USERS.storekeeper);
  await page.goto("/stock/mouvements");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Enregistrer le mouvement" }) });
  await form.getByLabel("Type de mouvement").selectOption("RECEIPT");
  await form.getByLabel("Article").selectOption({ label: "POMPE-HYD-TOY — Pompe hydraulique chariot 8FBE (u)" });
  await form.getByRole("combobox", { name: "Magasin", exact: true }).selectOption({ label: "Magasin Lyon — Dépôt Lyon" });
  await form.getByLabel("Quantité").fill("1");
  await form.getByLabel("Coût unitaire HT (€)").fill("1420");
  await form.getByRole("button", { name: "Enregistrer le mouvement" }).click();
  await expect(page.getByText(/Réception enregistrée/)).toBeVisible();
  // Le mouvement apparaît dans le journal
  await expect(page.getByRole("cell", { name: /POMPE-HYD-TOY/ }).first()).toBeVisible();
});

test("planning, indicateurs et tableau de bord s'affichent", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  await expect(page.getByText("Immobilisés")).toBeVisible();
  await page.goto("/planning");
  await expect(page.getByRole("heading", { name: "Planning de la semaine" })).toBeVisible();
  await expect(page.getByText("Julien Moreau").first()).toBeVisible();
  await page.goto("/indicateurs");
  await expect(page.getByText("Disponibilité", { exact: true })).toBeVisible();
  await expect(page.getByText("Équipements les plus coûteux")).toBeVisible();
});

test("API v1 : catalogue public, données protégées", async ({ page, request }) => {
  const catalog = await request.get("/api/v1");
  expect(catalog.ok()).toBeTruthy();
  expect((await catalog.json()).endpoints.length).toBeGreaterThan(30);
  const anonymous = await request.get("/api/v1/me");
  expect(anonymous.status()).toBe(401);

  await login(page, USERS.workshopLyon);
  const me = await page.request.get("/api/v1/me");
  expect(me.ok()).toBeTruthy();
  const { data } = await me.json();
  expect(data.roles).toContain("WORKSHOP_MANAGER");
});

test("achats : nombre d'OT par prestataire (sous-requête corrélée)", async ({ page }) => {
  await login(page, "achats@demo.gmao");
  await page.goto("/achats");
  const row = page.getByRole("row", { name: /Engins Services Rhône/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell").last()).toHaveText("3");
});
