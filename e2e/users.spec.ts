import { expect, type Page, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("cycle d'un compte : création, modification, nouveau mot de passe, désactivation puis réactivation", async ({ page }) => {
  const stamp = Date.now();
  const email = `cycle.${stamp}@demo.gmao`;
  const renamed = `cycle.renomme.${stamp}@demo.gmao`;
  const name = `Compte Cycle ${stamp}`;

  await login(page, USERS.admin, "/administration/utilisateurs");
  await page.getByText("Nouveau compte").click();
  const create = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le compte" }) });
  await create.getByLabel("Nom et prénom").fill(name);
  await create.getByLabel("Courriel (identifiant)").fill(email);
  await create.getByLabel("Mot de passe initial").fill("Initial-Cycle-2026");
  await create.getByRole("combobox", { name: "Rôle" }).selectOption("TECHNICIAN");
  await create.getByRole("combobox", { name: "Périmètre" }).selectOption({ label: "Site — Dépôt Lyon" });
  await create.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(/Compte créé/)).toBeVisible();

  // Modification du nom et du courriel.
  const row = () => page.getByRole("row").filter({ hasText: String(stamp) });
  await row().getByText("Modifier le compte").click();
  await row().getByLabel("Nom et prénom").fill(`${name} renommé`);
  await row().getByLabel("Courriel (identifiant)").fill(renamed);
  await row().getByRole("button", { name: "Enregistrer" }).click();
  await expect(statusMessage(page).filter({ hasText: "Compte modifié." })).toBeVisible();
  await expect(row()).toContainText(renamed);

  // Nouveau mot de passe.
  await row().getByLabel("Nouveau mot de passe").fill("Nouveau-Cycle-2026");
  await row().getByRole("button", { name: "Remplacer le mot de passe" }).click();
  await expect(statusMessage(page).filter({ hasText: /Mot de passe remplacé/ })).toBeVisible();

  // Désactivé : la connexion est refusée.
  await row().getByRole("button", { name: "Désactiver" }).click();
  await expect(row().getByText("Désactivé", { exact: true })).toBeVisible();
  await signIn(page, renamed, "Nouveau-Cycle-2026");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/^Identifiants invalides, compte désactivé/)).toBeVisible();

  // Réactivé : connexion avec le nouveau courriel et le nouveau mot de passe.
  await login(page, USERS.admin, "/administration/utilisateurs");
  await row().getByRole("button", { name: "Réactiver" }).click();
  await expect(row().getByText("Actif", { exact: true })).toBeVisible();
  await signIn(page, renamed, "Nouveau-Cycle-2026");
  await expect(page).not.toHaveURL(/\/login/);
});

test("un courriel déjà utilisé est refusé à la modification", async ({ page }) => {
  await login(page, USERS.admin, "/administration/utilisateurs");
  const row = page.getByRole("row").filter({ hasText: USERS.operator });
  await row.getByText("Modifier le compte").click();
  await row.getByLabel("Courriel (identifiant)").fill(USERS.storekeeper);
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(statusMessage(page).filter({ hasText: "Un compte existe déjà avec ce courriel." })).toBeVisible();
});
