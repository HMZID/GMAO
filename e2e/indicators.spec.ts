import { expect, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/** Indicateurs personnalisés (KPI-11) : composition à l'écran, calcul dans le périmètre, droits. */

test("le responsable maintenance compose un indicateur et le retrouve calculé", async ({ page }) => {
  const name = `Heures par site ${Date.now()}`;
  await login(page, USERS.maintenanceManager, "/indicateurs");
  await page.getByRole("link", { name: "Indicateurs personnalisés" }).click();
  await expect(page.getByRole("heading", { name: "Indicateurs personnalisés", level: 1 })).toBeVisible();
  // Exemples de la démonstration
  await expect(page.getByRole("heading", { name: "Ordres de travail par statut" })).toBeVisible();

  await page.getByText("Nouvel indicateur").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ajouter l'indicateur" }) });
  await form.getByLabel("Nom de l'indicateur").fill(name);
  await form.getByRole("combobox", { name: "Données" }).selectOption({ label: "Temps passés (main-d'œuvre)" });
  await form.getByRole("combobox", { name: "Mesure" }).selectOption("sum");
  await form.getByRole("combobox", { name: "Champ" }).selectOption({ label: "Heures (h)" });
  await form.getByRole("combobox", { name: "Présentation" }).selectOption("table");
  await form.getByRole("combobox", { name: "Regroupé par" }).selectOption({ label: "Site" });
  await form.getByRole("button", { name: "Ajouter l'indicateur" }).click();
  await expect(statusMessage(page).filter({ hasText: "Indicateur ajouté." })).toBeVisible();

  const card = page.locator("section", { has: page.getByRole("heading", { name }) });
  await expect(card.getByText("Total : heures par site")).toBeVisible();
  await expect(card.getByText("Ensemble")).toBeVisible();
  await expect(card.getByText(/\d h$/).first()).toBeVisible();

  await card.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
});

test("une définition incohérente est refusée ; le conducteur n'a pas accès", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const refused = await page.request.post("/api/v1/indicators", {
    data: { name: "Incohérent", source: "equipment", aggregate: "sum", field: "hours", chart: "number" },
  });
  expect(refused.status()).toBe(422);
  expect((await refused.json()).error.details.errors).toContain("Champ « hours » indisponible pour équipements.");

  await login(page, USERS.operator);
  expect((await page.request.get("/api/v1/indicators")).status()).toBe(403);
});
