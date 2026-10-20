import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Contrôles de saisie (DON-11) : un champ obligatoire est marqué, refusé par le navigateur puis par le serveur,
 * et l'erreur est indiquée sous le champ et rappelée en tête du formulaire, en français.
 */

test("champ obligatoire vide : erreur sous le champ, rappel en tête, focus sur le premier champ à corriger", async ({ page }) => {
  await login(page, USERS.executive);
  await page.goto("/equipements/nouveau");
  const code = page.getByLabel("Code parc");
  await expect(code).toHaveAttribute("required", "");
  // Contrôle du navigateur contourné : le serveur refuse à son tour, champ par champ.
  await page
    .locator("form")
    .filter({ has: code })
    .evaluate((form) => form.setAttribute("novalidate", ""));
  await page.getByLabel("Désignation").fill("Groupe électrogène");
  await page.getByRole("button", { name: "Créer l'équipement" }).click();
  const summary = page.getByRole("alert").filter({ hasText: "Champs à corriger" });
  await expect(summary).toContainText("Code parc");
  await expect(summary).not.toContainText("Désignation");
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(code).toBeFocused();
  await expect(page.getByText("Champ obligatoire").first()).toBeVisible();
  await expect(page.getByText(/Invalid input|expected/)).toHaveCount(0);
});

test("API : erreurs de validation en français, champ par champ, sans caractère invisible", async ({ page }) => {
  await login(page, USERS.executive);
  const response = await page.request.post("/api/v1/work-requests", { data: { symptom: "ab".repeat(150), equipmentId: "pas-un-id" } });
  expect(response.status()).toBe(400);
  const body = await response.json();
  const fieldErrors = body.error.details.fieldErrors as Record<string, string[]>;
  expect(fieldErrors.equipmentId).toEqual(["Équipement obligatoire"]);
  expect(fieldErrors.symptom).toEqual(["200 caractères au maximum"]);
  expect(JSON.stringify(body)).not.toMatch(/[⁠-⁤]|Invalid|expected/);
});

test("en anglais et en arabe : bulle du navigateur, erreur du champ et rappel dans la langue choisie", async ({ page }) => {
  await login(page, USERS.executive);
  for (const [locale, required, toFix] of [
    ["en", "Required field", "Fields to correct:"],
    ["ar", "حقل إلزامي", "حقول يجب تصحيحها:"],
  ] as const) {
    await page.context().addCookies([{ name: "gmao-locale", value: locale, domain: new URL(page.url()).hostname, path: "/" }]);
    await page.goto("/equipements/nouveau");
    const code = page.locator("input[name=code]");
    const form = page.locator("form").filter({ has: code });
    // Envoi vide : le navigateur bloque, avec le message de la langue de l'application.
    await form.locator("button[type=submit]").click();
    await expect.poll(() => code.evaluate((el: HTMLInputElement) => el.validationMessage)).toBe(required);
    // Contrôle du navigateur contourné : le serveur répond, dans la même langue.
    await form.evaluate((element) => element.setAttribute("novalidate", ""));
    await form.locator("button[type=submit]").click();
    await expect(page.getByRole("alert").filter({ hasText: toFix })).toBeVisible();
    await expect(page.getByText(required).first()).toBeVisible();
    await expect(page.getByText("Champ obligatoire")).toHaveCount(0);
  }
});
