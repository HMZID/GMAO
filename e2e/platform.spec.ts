import { expect, type Page, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/** Plateforme : démonstration à durée limitée pour un client, suspension, abonnement. */

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("démonstration client : ouverture, bandeau, suspension, rétablissement, abonnement", async ({ page }) => {
  const stamp = Date.now();
  const organization = `Client Démo ${stamp}`;
  const email = `client.${stamp}@exemple.test`;
  const password = "Client-Demo-2026";

  await login(page, USERS.admin, "/administration/plateforme");
  await page.getByText("Nouvelle démonstration").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ouvrir la démonstration" }) });
  await form.getByLabel("Organisation (client)").fill(organization);
  await form.getByRole("combobox", { name: "Durée" }).selectOption("7");
  await form.getByLabel("Administrateur du client").fill("Camille Client");
  await form.getByLabel("Courriel (identifiant)").fill(email);
  await form.getByLabel("Mot de passe initial").fill(password);
  await form.getByRole("button", { name: "Ouvrir la démonstration" }).click();
  await expect(statusMessage(page).filter({ hasText: `Démonstration « ${organization} » ouverte` })).toBeVisible();
  const row = () => page.getByRole("row").filter({ hasText: organization });
  await expect(row()).toContainText("(7 j)");

  // Le client se connecte : sa propre organisation, vide, avec le bandeau de démonstration.
  await signIn(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/Version de démonstration/)).toBeVisible();
  await expect(page.getByText("il reste 7 jours", { exact: false })).toBeVisible();
  await expect(page.locator("aside").getByRole("link").first()).toContainText(organization);
  const equipment = await (await page.request.get("/api/v1/equipment")).json();
  expect(equipment.data.items).toHaveLength(0);
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "Équipements" })).toBeVisible();

  // Suspension : le client n'a plus accès, même avec sa session ouverte.
  const clientCookies = await page.context().cookies();
  await login(page, USERS.admin, "/administration/plateforme");
  await row().getByRole("button", { name: "Suspendre" }).click();
  await expect(row().getByText("Suspendue")).toBeVisible();
  await page.context().clearCookies();
  await page.context().addCookies(clientCookies);
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  await signIn(page, email, password);
  await expect(page.getByText(/accès de l'organisation terminé/)).toBeVisible();

  // Rétablissement (retour en démonstration), puis abonnement : plus de bandeau.
  await login(page, USERS.admin, "/administration/plateforme");
  await row().getByRole("button", { name: "Rétablir l'accès" }).click();
  await expect(row().getByText("Démonstration", { exact: true })).toBeVisible();
  await row().getByRole("button", { name: "Passer en abonnement" }).click();
  await expect(row().getByText("Active", { exact: true })).toBeVisible();
  await signIn(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/Version de démonstration/)).toHaveCount(0);
});

test("l'administration de la plateforme est réservée", async ({ page }) => {
  // Administrateur d'une organisation, mais pas de la plateforme : le responsable maintenance.
  await login(page, USERS.maintenanceManager);
  await page.goto("/administration/plateforme");
  await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
});
