import { expect, type Page, test } from "@playwright/test";
import { DEMO_PASSWORD, USERS, login, statusMessage } from "./helpers";

/** Contrôles de sécurité transverses : périmètre des clés d'API, cloisonnement entre sociétés du groupe (HAB-02, R-07). */

async function createKey(page: Page, name: string, access: "READ" | "IMPORT") {
  await page.goto("/administration/connecteur");
  await page.getByText("Nouvelle clé").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer la clé" }) });
  await form.getByLabel("Nom").fill(name);
  await form.getByRole("combobox", { name: "Accès" }).selectOption(access);
  await form.getByRole("button", { name: "Créer la clé" }).click();
  await expect(statusMessage(page).filter({ hasText: /Copiez-la maintenant/ })).toBeVisible();
  return (await page.locator("[data-secret]").textContent())?.trim() ?? "";
}

async function equipmentId(page: Page, code: string): Promise<string> {
  const { data } = await (await page.request.get(`/api/v1/equipment?q=${code}`)).json();
  return data.items.find((e: { code: string }) => e.code === code).id;
}

test("une clé d'API ne voit jamais plus que son créateur : direction limitée à une société", async ({ page, playwright, baseURL }) => {
  const stamp = Date.now();
  const email = `direction.loca.${stamp}@demo.gmao`;
  await login(page, USERS.executive, "/administration/utilisateurs");
  const sbtpTruck = await equipmentId(page, "CA-101");

  // Une direction dont le périmètre est la seule société LocaEngins Alpes.
  await page.getByText("Nouveau compte").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le compte" }) });
  await form.getByLabel("Nom et prénom").fill(`Direction Loca ${stamp}`);
  await form.getByLabel("Courriel (identifiant)").fill(email);
  await form.getByLabel("Mot de passe initial").fill(DEMO_PASSWORD);
  await form.getByRole("combobox", { name: "Rôle" }).selectOption("EXECUTIVE");
  await form.getByRole("combobox", { name: "Périmètre" }).selectOption({ label: "Société — LocaEngins Alpes" });
  await form.getByRole("button", { name: "Créer le compte" }).click();
  await expect(statusMessage(page).filter({ hasText: /Compte créé/ })).toBeVisible();

  await login(page, email);
  const key = await createKey(page, `ETL Loca ${stamp}`, "READ");
  const client = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${key}` } });
  // Ses engins de Grenoble, oui ; le camion de SBTP, ni en liste, ni en fiche, ni à l'export.
  expect((await (await client.get("/api/v1/equipment?q=TP-004")).json()).data.items).toHaveLength(1);
  expect((await (await client.get("/api/v1/equipment?q=CA-101")).json()).data.items).toHaveLength(0);
  expect((await client.get(`/api/v1/equipment/${sbtpTruck}`)).status()).toBe(404);
  const exported = (await (await client.get("/api/v1/exports/equipment?limit=500")).json()).data.items as { id: string }[];
  expect(exported.length).toBeGreaterThan(0);
  expect(exported.map((e) => e.id)).not.toContain(sbtpTruck);
  await client.dispose();
});

test("une clé « import » n'enregistre aucun mouvement de stock en direct", async ({ page, playwright, baseURL }) => {
  await login(page, USERS.executive);
  const key = await createKey(page, `ETL stock ${Date.now()}`, "IMPORT");
  const client = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${key}` } });
  const refused = await client.post("/api/v1/stock-movements", { data: { type: "SCRAP", quantity: 1 } });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error.message).toContain("import des stocks initiaux");
  // La lecture du stock reste ouverte.
  expect((await client.get("/api/v1/stock-movements")).status()).toBe(200);
  await client.dispose();
});

test("R-07 : un chef d'atelier d'une société ne voit rien d'une autre société du groupe", async ({ page }) => {
  await login(page, USERS.executive);
  const sbtpTruck = await equipmentId(page, "CA-101");
  const sbtpOrders = (await (await page.request.get("/api/v1/work-orders?pageSize=200")).json()).data.items as { id: string; number: string }[];
  const sbtpOrder = sbtpOrders.find((o) => o.number.includes("-SBTP-"));
  expect(sbtpOrder).toBeTruthy();

  await login(page, USERS.workshopGrenoble);
  expect((await (await page.request.get("/api/v1/equipment?q=TP-004")).json()).data.items).toHaveLength(1);
  expect((await (await page.request.get("/api/v1/equipment?q=CA-101")).json()).data.items).toHaveLength(0);
  expect((await page.request.get(`/api/v1/equipment/${sbtpTruck}`)).status()).toBe(404);
  expect((await page.request.get(`/api/v1/work-orders/${sbtpOrder!.id}`)).status()).toBe(404);
  // L'adresse directe de la fiche ne révèle rien non plus.
  await page.goto(`/equipements/${sbtpTruck}`);
  await expect(page.getByText("Camion benne 8x4")).toHaveCount(0);
});

test("connexion : tentatives limitées (page et adresse HTTP), sans révéler si le compte existe", async ({ page, playwright, baseURL }) => {
  const email = `inconnu.${Date.now()}@demo.gmao`;
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Courriel").fill(email);
    await page.getByLabel("Mot de passe").fill(`mauvais-${i}-0123456789`);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(statusMessage(page).filter({ hasText: /Identifiants invalides/ })).toBeVisible();
  }
  // 6e essai : bloqué pendant 15 minutes, par l'écran comme par l'adresse utilisée par le mobile.
  await page.getByLabel("Mot de passe").fill("encore-un-essai-0123456789");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(statusMessage(page).filter({ hasText: /Trop de tentatives/ })).toBeVisible();
  const api = await playwright.request.newContext({ baseURL });
  const blocked = await api.post("/api/auth/sign-in/email", { data: { email, password: "x-0123456789" }, headers: { Origin: baseURL! } });
  expect(blocked.status()).toBe(429);
  await api.dispose();
});

test("connexion : le retour après connexion reste dans l'application ; en-têtes de sécurité", async ({ page }) => {
  const response = await page.goto(`/login?next=${encodeURIComponent("/\pirate.example")}`);
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await page.getByLabel("Courriel").fill(USERS.maintenanceManager);
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  expect(new URL(page.url()).host).toBe(new URL(response!.url()).host);
});
