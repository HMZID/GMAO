import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Notifications par courriel (NOT-01, NOT-03, §11.1) : préférences par utilisateur (alertes obligatoires
 * non désactivables) et traitement de la file d'envoi suivi par l'administrateur.
 */

test("préférences de courriel : une alerte facultative se désactive, une alerte obligatoire non", async ({ page }) => {
  await login(page, USERS.technicianLyon, "/notifications");
  const assignment = page.getByLabel("Affectation à un OT");
  const mandatory = page.getByLabel("Validation en attente (obligatoire)");
  await expect(mandatory).toBeChecked();
  await expect(mandatory).toBeDisabled();

  await assignment.uncheck();
  await page.getByRole("button", { name: "Enregistrer les préférences" }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

  const prefs = (await (await page.request.get("/api/v1/notifications/preferences")).json()).data as { event: string; enabled: boolean }[];
  expect(prefs.find((p) => p.event === "ASSIGNMENT")?.enabled).toBe(false);
  expect(prefs.find((p) => p.event === "APPROVAL_PENDING")?.enabled).toBe(true);

  // L'API ne permet pas non plus de désactiver une alerte obligatoire
  const put = await page.request.put("/api/v1/notifications/preferences", { data: { enabled: ["ASSIGNMENT"] } });
  const after = (await put.json()).data as { event: string; enabled: boolean }[];
  expect(after.find((p) => p.event === "APPROVAL_PENDING")?.enabled).toBe(true);
  expect(after.find((p) => p.event === "DUE_DIGEST")?.enabled).toBe(false);
  expect(after.find((p) => p.event === "ASSIGNMENT")?.enabled).toBe(true);
});

test("l'administrateur suit la file d'envoi et la traite", async ({ page }) => {
  await login(page, USERS.admin, "/administration/courriels");
  // Les validations et affectations de la démonstration ont mis des courriels en file
  await expect(page.getByText(/À valider : DA-/).first()).toBeVisible();
  await page.getByRole("button", { name: "Traiter la file maintenant" }).click();
  await expect(page.getByText(/Traitement effectué : \d+ alerte\(s\) mise\(s\) en file, \d+ envoyé\(s\)/)).toBeVisible();
  await expect(page.getByText("Envoyé", { exact: true }).first()).toBeVisible();

  // Un second traitement n'envoie rien de plus : chaque événement n'a qu'un courriel par destinataire
  await page.getByRole("button", { name: "Traiter la file maintenant" }).click();
  await expect(page.getByText(/Traitement effectué : 0 alerte\(s\) mise\(s\) en file, 0 envoyé\(s\)/)).toBeVisible();
});

test("l'accès au suivi des courriels est réservé à l'administrateur", async ({ page }) => {
  await login(page, USERS.technicianLyon, "/administration/courriels");
  await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
});
