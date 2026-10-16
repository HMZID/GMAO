import { expect, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";
import { MIN_FILL_MS } from "../src/server/domain/site";

test.describe("Site commercial et demandes de démonstration", () => {
  test("l'accueil « / » présente le site aux visiteurs non connectés", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Vos engins tournent/i);
    await expect(page.getByRole("link", { name: "Essai gratuit" }).first()).toBeVisible();
    await page.goto("/tarifs");
    await expect(page.getByRole("heading", { name: "Flotte" })).toBeVisible();
    await page.goto("/infos/confidentialite");
    await expect(page.getByRole("heading", { level: 1, name: "Politique de confidentialité" })).toBeVisible();
  });

  test("demande d'essai → acceptation → première connexion avec le mot de passe provisoire", async ({ page }) => {
    const email = `prospect-${Date.now()}@exemple.test`;
    await page.context().clearCookies();
    await page.goto("/essai-gratuit?offre=Flotte");
    await page.getByLabel("Société").fill("Carrières de la Recette");
    await page.getByLabel("Nom et prénom").fill("Paula Recette");
    await page.getByLabel("Courriel professionnel").fill(email);
    await page.getByRole("checkbox").check();
    // Contrôle anti-robot : un formulaire rempli en moins de trois secondes est ignoré.
    await page.waitForTimeout(MIN_FILL_MS + 300);
    await page.getByRole("button", { name: "Demander mon espace de démonstration" }).click();
    await expect(page).toHaveURL(/\/essai-gratuit\/merci$/);
    await expect(page.getByRole("heading", { name: /Demande bien reçue/ })).toBeVisible();

    await login(page, USERS.admin, "/administration/site/demandes");
    await page.getByRole("link", { name: "Carrières de la Recette" }).first().click();
    await expect(page.getByRole("heading", { name: "Carrières de la Recette" })).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();
    await page.getByRole("button", { name: "Accepter et envoyer les accès" }).click();
    await expect(page.locator("[data-secret]")).toBeVisible({ timeout: 15_000 });
    const password = (await page.locator("[data-secret]").textContent())?.trim() ?? "";
    expect(password).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    await page.reload();
    await expect(page.getByText("Provisoire (pas encore de connexion)")).toBeVisible();

    // Première connexion du prospect : choix de son mot de passe, puis l'application.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Courriel").fill(email);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/premiere-connexion$/);
    await page.getByLabel("Nouveau mot de passe").fill(password);
    await page.getByLabel("Confirmation").fill(password);
    await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
    await expect(page.getByText(/différent du mot de passe provisoire/)).toBeVisible();
    await page.getByLabel("Nouveau mot de passe").fill("Mon-Atelier-2026");
    await page.getByLabel("Confirmation").fill("Mon-Atelier-2026");
    await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Version de démonstration")).toBeVisible();
    // Le contrôle ne revient plus : l'application est accessible.
    await page.goto("/premiere-connexion");
    await expect(page).toHaveURL(/\/$/);
  });

  test("l'administrateur modifie le contenu et le site le reflète aussitôt", async ({ page }) => {
    await login(page, USERS.admin, "/administration/site/contenu");
    const hero = page.locator("form").filter({ has: page.locator('input[name="group"][value="hero"]') });
    await hero.getByLabel("Titre", { exact: true }).fill("Titre de recette");
    await hero.getByRole("button", { name: "Enregistrer" }).click();
    await expect(statusMessage(page).first()).toContainText("visible tout de suite");

    await page.goto("/administration/site/blocs/questions");
    await page.getByText("Ajouter : question").click();
    await page.getByLabel("Question").first().fill("Question de recette ?");
    await page.getByLabel("Réponse").first().fill("Réponse de recette.");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Question de recette ?").first()).toBeVisible();

    await page.goto("/decouvrir");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Titre de recette/i);
    await expect(page.getByText("Question de recette ?")).toBeVisible();

    // Remise en état : titre par défaut (champ vidé) et question supprimée.
    await page.goto("/administration/site/contenu");
    await hero.getByLabel("Titre", { exact: true }).fill("");
    await hero.getByRole("button", { name: "Enregistrer" }).click();
    await expect(statusMessage(page).first()).toContainText("visible tout de suite");
    await page.goto("/administration/site/blocs/questions");
    const item = page.locator("li").filter({ hasText: "Question de recette ?" });
    await item.getByText("Modifier").click();
    await item.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Question de recette ?")).toHaveCount(0);
  });

  test("un utilisateur d'une organisation n'accède pas à l'administration du site", async ({ page }) => {
    await login(page, USERS.executive, "/administration/site/demandes");
    await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
  });
});
