import { expect, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/** PNG de 1 × 1 pixel. */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("identité de l'organisation : nom affiché et logo sous « GMAO », puis retour à l'état initial", async ({ page }) => {
  await login(page, USERS.admin, "/administration/organisation");
  const brand = page.locator("aside").getByRole("link").first();
  await expect(brand).toContainText("Groupe Démo BTP");

  const card = page.locator("section", { has: page.getByRole("heading", { name: "Identité de l'organisation" }) });
  await card.getByLabel("Nom affiché").fill("SBTP Maintenance");
  await card.getByRole("button", { name: "Enregistrer le nom" }).click();
  await expect(statusMessage(page).filter({ hasText: "Nom affiché enregistré." })).toBeVisible();
  await expect(brand).toContainText("SBTP Maintenance");

  // Un fichier qui n'est pas une image est refusé, avec le motif.
  await card.getByLabel("Logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("pas une image") });
  await card.getByRole("button", { name: "Ajouter le logo" }).click();
  await expect(statusMessage(page).filter({ hasText: "ne correspond pas à son extension" })).toBeVisible();

  await card.getByLabel("Logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1PX });
  await card.getByRole("button", { name: "Ajouter le logo" }).click();
  await expect(statusMessage(page).filter({ hasText: "Logo enregistré." })).toBeVisible();
  const logo = brand.locator("img");
  await expect(logo).toHaveAttribute("src", /\/api\/v1\/organization\/logo\?v=\d+/);
  const response = await page.request.get((await logo.getAttribute("src")) ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");

  // Retour à l'état initial pour les autres scénarios.
  // Le bouton « Retirer le logo » disparaît avec le logo : on vérifie l'en-tête.
  await card.getByRole("button", { name: "Retirer le logo" }).click();
  await expect(brand.locator("img")).toHaveCount(0);
  await card.getByLabel("Nom affiché").fill("");
  await card.getByRole("button", { name: "Enregistrer le nom" }).click();
  await expect(brand).toContainText("Groupe Démo BTP");
});

test("le logo n'est servi qu'à un utilisateur connecté", async ({ request }) => {
  const response = await request.get("/api/v1/organization/logo");
  expect(response.status()).toBe(401);
});
