import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

const PAGES = [
  "/",
  "/equipements",
  "/equipements/nouveau",
  "/demandes",
  "/demandes/nouvelle",
  "/ordres-de-travail",
  "/ordres-de-travail/nouveau",
  "/preventif",
  "/preventif/echeances",
  "/preventif/plans/nouveau",
  "/planning",
  "/stock",
  "/stock/articles/nouveau",
  "/stock/mouvements",
  "/achats",
  "/indicateurs",
  "/administration",
  "/administration/organisation",
  "/administration/utilisateurs",
  "/administration/techniciens",
  "/administration/referentiel",
  "/administration/journal",
  "/notifications",
];

test("toutes les pages s'affichent sans erreur pour l'administrateur", async ({ page }) => {
  await login(page, USERS.admin);
  for (const path of PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBeLessThan(500);
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
    await expect(page.getByText("Une erreur est survenue"), path).toHaveCount(0);
  }
});

test("l'administrateur crée un équipement : les plans de la catégorie s'appliquent", async ({ page }) => {
  const code = `GE-${String(Date.now()).slice(-5)}`;
  await login(page, USERS.admin);
  await page.goto("/equipements/nouveau");
  await page.getByLabel("Code parc").fill(code);
  await page.getByLabel("Désignation").fill("Groupe électrogène 60 kVA");
  await page.getByLabel("Catégorie").selectOption({ label: "Groupe électrogène" });
  await page.getByLabel("Marque").fill("SDMO");
  await page.getByLabel("Numéro de série").fill(`SN-${code}`);
  await page.getByLabel("Société propriétaire").selectOption({ label: "LocaEngins Alpes" });
  await page.getByLabel("Site de rattachement").selectOption({ label: "Dépôt Grenoble (LocaEngins Alpes)" });
  await page.getByLabel("Mise en service").fill("2026-01-15");
  await page.getByLabel("Valeur actuelle").fill("120");
  await page.getByRole("button", { name: "Créer l'équipement" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(code) })).toBeVisible();
  // Plan « Groupe électrogène — entretien » appliqué automatiquement à la création
  await expect(page.getByText("Entretien 500 h ou 1 an")).toBeVisible();
});

test("l'administrateur crée un compte, doublon refusé", async ({ page }) => {
  const email = `test.${Date.now()}@demo.gmao`;
  await login(page, USERS.admin);
  await page.goto("/administration/utilisateurs");
  await page.getByText("Nouveau compte").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le compte" }) });
  const fill = async () => {
    await form.getByLabel("Nom et prénom").fill("Compte Test");
    await form.getByLabel("Courriel (identifiant)").fill(email);
    await form.getByLabel("Mot de passe initial").fill("Mot-de-passe-2026");
    await form.getByRole("combobox", { name: "Rôle" }).selectOption("TECHNICIAN");
    await form.getByRole("combobox", { name: "Périmètre" }).selectOption({ label: "Site — Dépôt Lyon" });
    await form.getByRole("button", { name: "Créer le compte" }).click();
  };
  await fill();
  await expect(page.getByText(/Compte créé/)).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(email.replace(/[.]/g, "\\.")) })).toBeVisible();

  await fill();
  await expect(page.getByText("Un compte existe déjà avec ce courriel.")).toBeVisible();
});

test("le responsable maintenance crée un plan d'entretien", async ({ page }) => {
  const name = `Plan test ${Date.now()}`;
  await login(page, USERS.maintenanceManager);
  await page.goto("/preventif/plans/nouveau");
  await page.getByLabel("Nom du plan").fill(name);
  await page.getByLabel("Code").fill("TST-100");
  await page.getByLabel("Libellé").fill("Contrôle 100 h ou 1 mois");
  await page.getByLabel("Intervalle calendaire").fill("1");
  await page.getByLabel("Intervalle compteur").fill("100");
  await page.getByLabel("Checklist").fill("Contrôle visuel\nNiveaux");
  await page.getByRole("button", { name: "Créer le plan" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByText(/Tous les 1 mois ou 100 h/)).toBeVisible();
});
