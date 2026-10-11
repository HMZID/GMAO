import { expect, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/** PNG de 1 × 1 pixel. */
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("identité de l'organisation : nom affiché et logo sous « GMAO », puis retour à l'état initial", async ({ page }) => {
  await login(page, USERS.executive, "/administration/organisation");
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

test("organisation en arbre : chaque société a ses sites, chaque site ses ateliers et magasins", async ({ page }) => {
  const stamp = String(Date.now()).slice(-6);
  await login(page, USERS.executive, "/administration/organisation");
  await expect(page.locator("section[aria-label^='Société']").first()).toBeVisible();

  // Nouveau site dans la première société, puis un atelier et un magasin dans ce site.
  const firstCompany = page.locator("section[aria-label^='Société']").first();
  await firstCompany.getByText("Ajouter un site").click();
  const siteForm = firstCompany.locator("form").filter({ has: page.getByRole("button", { name: "Créer le site" }) });
  await siteForm.getByLabel("Code").fill(`S${stamp}`);
  await siteForm.getByLabel("Nom").fill(`Site essai ${stamp}`);
  await siteForm.getByRole("button", { name: "Créer le site" }).click();
  const site = page.locator(`section[aria-label="Site Site essai ${stamp}"]`);
  await expect(site).toBeVisible();
  await expect(site.getByText("Aucun")).toHaveCount(2);

  await site.getByText("Ajouter un atelier").click();
  const workshopForm = site.locator("form").filter({ has: page.getByRole("button", { name: "Créer l'atelier" }) });
  await workshopForm.getByLabel("Code").fill(`A${stamp}`);
  await workshopForm.getByLabel("Nom").fill(`Atelier essai ${stamp}`);
  await workshopForm.getByRole("button", { name: "Créer l'atelier" }).click();
  await expect(site.getByText(`Atelier essai ${stamp}`)).toBeVisible();

  await site.getByText("Ajouter un magasin").click();
  const warehouseForm = site.locator("form").filter({ has: page.getByRole("button", { name: "Créer le magasin" }) });
  await warehouseForm.getByLabel("Code").fill(`M${stamp}`);
  await warehouseForm.getByLabel("Nom").fill(`Magasin essai ${stamp}`);
  await warehouseForm.getByRole("button", { name: "Créer le magasin" }).click();
  await expect(site.getByText(`Magasin essai ${stamp}`)).toBeVisible();
});
