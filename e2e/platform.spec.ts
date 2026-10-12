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
  await form.getByLabel("Direction du client (premier compte)").fill("Camille Client");
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

test("l'administrateur gère la plateforme, pas la maintenance ; la direction gère son organisation", async ({ page }) => {
  await login(page, USERS.admin);
  // Arrivée directe sur les organisations clientes ; aucun menu de maintenance.
  await expect(page).toHaveURL(/\/administration\/plateforme$/);
  const menu = page.getByRole("navigation", { name: "Navigation principale" }).first();
  await expect(menu.getByRole("link", { name: "Administration" })).toBeVisible();
  for (const entry of ["Tableau de bord", "Équipements", "Demandes d'intervention", "Ordres de travail"]) {
    await expect(menu.getByRole("link", { name: entry })).toHaveCount(0);
  }
  await page.goto("/demandes/nouvelle");
  await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
  expect((await page.request.get("/api/v1/equipment")).status()).toBe(403);

  // La direction a tous les accès de son organisation et ne peut pas donner le rôle d'administrateur de la plateforme.
  await login(page, USERS.executive, "/administration/utilisateurs");
  await page.getByText("Nouveau compte").click();
  const roles = await page.getByRole("combobox", { name: "Rôle" }).first().locator("option").allTextContents();
  expect(roles).toContain("Direction");
  expect(roles).not.toContain("Administrateur de la plateforme");
  await page.goto("/demandes/nouvelle");
  await expect(page.getByRole("heading", { name: "Signaler une panne" })).toBeVisible();
});

test("l'administrateur voit chaque organisation, y crée un compte et se connecte en tant qu'un utilisateur", async ({ page }) => {
  const stamp = Date.now();
  await login(page, USERS.admin, "/administration/plateforme");
  await page
    .locator("table")
    .getByRole("link", { name: /Groupe Démo BTP/ })
    .click();
  await expect(page).toHaveURL(/\/administration\/plateforme\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Sociétés et sites" })).toBeVisible();

  // Création d'un compte dans l'organisation.
  await page.getByText("Nouveau compte").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le compte" }) });
  await form.getByLabel("Nom et prénom").fill(`Compte Plateforme ${stamp}`);
  await form.getByLabel("Courriel (identifiant)").fill(`plateforme.${stamp}@demo.gmao`);
  await form.getByLabel("Mot de passe initial").fill("Plateforme-2026-ok");
  await form.getByRole("combobox", { name: "Rôle" }).selectOption("TECHNICIAN");
  await form.getByRole("button", { name: "Créer le compte" }).click();
  await expect(statusMessage(page).filter({ hasText: /Compte créé/ })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: `plateforme.${stamp}@demo.gmao` })).toBeVisible();

  // Connexion en tant que le conducteur : ses menus, ses droits, un bandeau permanent.
  await page.getByRole("row").filter({ hasText: USERS.operator }).getByRole("button", { name: "Se connecter en tant que" }).click();
  await expect(page.getByText(/Connecté en tant que Paul Girard/)).toBeVisible();
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(me.data.email).toBe(USERS.operator);
  const menu = page.getByRole("navigation", { name: "Navigation principale" }).first();
  await expect(menu.getByRole("link", { name: "Demandes d'intervention" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Administration" })).toHaveCount(0);
  await page.goto("/demandes/nouvelle");
  await expect(page.getByRole("heading", { name: "Signaler une panne" })).toBeVisible();

  // Retour au compte de l'administrateur.
  await page.getByRole("button", { name: "Revenir à mon compte" }).click();
  await expect(page).toHaveURL(/\/administration\/plateforme$/);
  expect((await (await page.request.get("/api/v1/me")).json()).data.email).toBe(USERS.admin);

  // La connexion « en tant que » est tracée au journal de l'organisation.
  await login(page, USERS.executive, "/administration/journal");
  await expect(page.getByText("via l'administrateur de la plateforme").first()).toBeVisible();
});

test("un jeton « en tant que » forgé est ignoré : le compte reste celui de l'utilisateur connecté", async ({ page, context }) => {
  await login(page, USERS.maintenanceManager);
  // Jeton forgé (mauvaise signature) : le compte reste celui de l'utilisateur connecté.
  await context.addCookies([{ name: "gmao_impersonation", value: "x.y.9999999999999.forge", url: page.url() }]);
  expect((await (await page.request.get("/api/v1/me")).json()).data.email).toBe(USERS.maintenanceManager);
});
