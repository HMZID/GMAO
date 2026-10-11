import { expect, type Page, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/** Connecteur de l'organisation (INT-01, INT-05) : clés d'API, droits limités, révocation. */

async function createKey(page: Page, name: string, access: "READ" | "IMPORT") {
  await page.goto("/administration/connecteur");
  await page.getByText("Nouvelle clé").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer la clé" }) });
  await form.getByLabel("Nom").fill(name);
  await form.getByRole("combobox", { name: "Accès" }).selectOption(access);
  await form.getByRole("button", { name: "Créer la clé" }).click();
  await expect(statusMessage(page).filter({ hasText: /Copiez-la maintenant/ })).toBeVisible();
  const key = (await page.locator("[data-secret]").textContent())?.trim() ?? "";
  expect(key).toMatch(/^gmk_[A-Za-z0-9_-]{40}$/);
  return key;
}

test("clé « lecture » : export sans session, import refusé, révocation immédiate", async ({ page, playwright, baseURL }) => {
  const name = `ETL lecture ${Date.now()}`;
  await login(page, USERS.executive);
  const key = await createKey(page, name, "READ");

  // Client sans cookie : seule la clé authentifie.
  const client = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${key}` } });
  const catalog = await client.get("/api/v1/exports");
  expect(catalog.status()).toBe(200);
  const page1 = await (await client.get("/api/v1/exports/equipment?limit=3")).json();
  expect(page1.data.items).toHaveLength(3);
  expect((await client.get("/api/v1/indicators")).status()).toBe(200);
  // Pas d'écriture ni d'administration avec une clé de lecture.
  expect((await client.get("/api/v1/imports/templates/equipment")).status()).toBe(403);
  expect((await client.post("/api/v1/indicators", { data: { name: "x", source: "equipment", aggregate: "count", chart: "number" } })).status()).toBe(
    403,
  );

  // La clé apparaît dans la liste (début seulement), utilisée, puis révoquée.
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText(key.slice(0, 12));
  await expect(row).not.toContainText(key);
  await row.getByRole("button", { name: "Révoquer" }).click();
  await expect(row.getByText("Révoquée")).toBeVisible();
  expect((await client.get("/api/v1/exports")).status()).toBe(401);

  // X-Api-Key fonctionne aussi ; une clé inconnue est refusée.
  const other = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "X-Api-Key": `gmk_${"x".repeat(40)}` } });
  expect((await other.get("/api/v1/exports")).status()).toBe(401);
  await client.dispose();
  await other.dispose();
});

test("clé « import » : modèle d'import accessible, paramétrage toujours refusé", async ({ page, playwright, baseURL }) => {
  await login(page, USERS.executive);
  const key = await createKey(page, `ETL import ${Date.now()}`, "IMPORT");
  const client = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${key}` } });
  expect((await client.get("/api/v1/imports/templates/suppliers")).status()).toBe(200);
  expect((await client.get("/api/v1/approval-workflows")).status()).toBe(403);
  await client.dispose();
});

test("le connecteur est réservé à la direction et au responsable maintenance", async ({ page }) => {
  await login(page, USERS.storekeeper);
  await page.goto("/administration/connecteur");
  await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
});
