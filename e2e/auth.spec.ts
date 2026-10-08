import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

test.describe("Authentification et habilitations (HAB-01, HAB-02)", () => {
  test("refuse des identifiants invalides", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Courriel").fill(USERS.admin);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Identifiants invalides ou compte désactivé.")).toBeVisible();
  });

  test("renvoie vers la connexion puis vers la page demandée", async ({ page }) => {
    await page.goto("/equipements?status=IMMOBILIZED");
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("Courriel").fill(USERS.maintenanceManager);
    await page.getByLabel("Mot de passe").fill("Demo-Gmao-2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/equipements\?status=IMMOBILIZED/);
    await expect(page.getByRole("heading", { name: "Équipements" })).toBeVisible();
  });

  test("le conducteur ne voit que son site et n'accède pas à l'administration", async ({ page }) => {
    await login(page, USERS.operator);
    await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
    await page.goto("/equipements");
    await expect(page.getByRole("link", { name: "CH-012" })).toBeVisible();
    // TP-004 est à Grenoble : hors périmètre du conducteur de Lyon
    await expect(page.getByRole("link", { name: "TP-004" })).toHaveCount(0);
    await page.goto("/administration");
    await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
  });
});
