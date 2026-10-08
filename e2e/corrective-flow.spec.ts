import { expect, test, type Page } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Scénario de recette R-02 (CDC §15) : panne signalée par le conducteur, qualifiée et transformée en OT
 * par le chef d'atelier, réalisée par le technicien, puis remise en service validée.
 */
test("cycle complet d'une panne : DI → OT → réalisation → remise en service", async ({ page }) => {
  const symptom = `Fuite d'air sur le circuit de freinage ${Date.now()}`;

  // 1. Le conducteur signale la panne sur CA-101
  await login(page, USERS.operator);
  await page.goto("/demandes/nouvelle");
  await page.getByLabel("Équipement").selectOption({ label: "CA-101 — Camion benne 8x4" });
  await page.getByLabel("Symptôme").fill(symptom);
  await page.getByLabel("La machine est arrêtée").check();
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Signalement enregistré")).toBeVisible();
  const requestUrl = page.url().replace(/\?.*$/, "");

  // 2. Le chef d'atelier qualifie (immobilisation) et transforme en OT
  await login(page, USERS.workshopLyon, requestUrl);
  await page.getByLabel("Priorité").selectOption("P2");
  await page.getByLabel("Immobiliser l'équipement").check();
  await page.getByRole("button", { name: "Qualifier" }).click();
  await expect(page.getByText("DI qualifiée.")).toBeVisible();
  await expect(page.getByText("Immobilisé").first()).toBeVisible();
  await page.getByRole("button", { name: "Transformer en OT" }).click();
  await expect(page).toHaveURL(/\/ordres-de-travail\/[0-9a-f-]{36}$/);
  const workOrderUrl = page.url();

  // 3. Planification : date, durée, intervenant, puis statut « Planifié »
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Début prévu").fill(`${tomorrow}T08:00`);
  await page.getByLabel("Durée estimée (minutes)").fill("90");
  await page.getByLabel("Julien Moreau").check();
  await page.getByRole("button", { name: "Enregistrer la planification" }).click();
  await expect(page.getByText("Planification enregistrée.")).toBeVisible();
  await page.getByRole("button", { name: "Planifier" }).click();
  await expect(page.getByText("Planifier : effectué.")).toBeVisible();

  // 4. Le technicien réalise l'intervention
  await login(page, USERS.technicianLyon, workOrderUrl);
  await page.getByRole("button", { name: "Démarrer / reprendre" }).click();
  await expect(page.getByText("Démarrer / reprendre : effectué.")).toBeVisible();

  // Conditions de fin de travaux manquantes, toutes listées (DON-11)
  await expect(page.getByText("Le relevé du compteur est obligatoire.")).toBeVisible();
  await expect(page.getByText("Le temps passé doit être saisi.")).toBeVisible();

  await page.getByLabel("Travaux réalisés").fill("Raccord de flexible de frein remplacé, essai d'étanchéité conforme.");
  await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
  await expect(page.getByText("Compte rendu enregistré.")).toBeVisible();

  const reading = await currentMeterValue(page, workOrderUrl);
  await page.getByLabel("Relevé (km)").fill(String(reading + 3));
  await page.getByRole("button", { name: "Enregistrer le relevé" }).click();
  await expect(page.getByText("Relevé enregistré.")).toBeVisible();

  await page.getByText("Saisir une durée").click();
  await page.getByLabel("Durée (minutes)").fill("75");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Temps enregistré.")).toBeVisible();

  await page.getByRole("button", { name: "Terminer les travaux" }).click();
  await expect(page.getByText("Terminer les travaux : effectué.")).toBeVisible();

  // 5. Le chef d'atelier valide la remise en service : l'équipement redevient exploitable
  await login(page, USERS.workshopLyon, workOrderUrl);
  await page.getByLabel("Essais de remise en service conformes").check();
  await page.getByRole("button", { name: "Valider la remise en service" }).click();
  await expect(page.getByText("Valider la remise en service : effectué.")).toBeVisible();
  await expect(page.getByText("Clôturé techniquement le")).toBeVisible();
  await expect(page.getByText("En service").first()).toBeVisible();
});

/** Dernière valeur du compteur principal de l'équipement de l'OT, lue par l'API v1 (cookie de session). */
async function currentMeterValue(page: Page, workOrderUrl: string) {
  const id = workOrderUrl.split("/").pop();
  const response = await page.request.get(`/api/v1/work-orders/${id}`);
  expect(response.ok()).toBeTruthy();
  const { data } = await response.json();
  return Number(data.meters[0].lastValue);
}
