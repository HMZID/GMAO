import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { USERS, login } from "./helpers";

/**
 * Imports Excel (EQP-13, INT-01, §11.2) : modèle téléchargeable, simulation avec rapport ligne par ligne,
 * exécution « lignes valides » ou « tout ou rien », réimportation sans doublon, périmètre respecté.
 */

async function template(page: Page, kind: string) {
  const response = await page.request.get(`/api/v1/imports/templates/${kind}`);
  expect(response.status()).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await response.body()) as unknown as ExcelJS.Buffer);
  return workbook;
}

async function fill(workbook: ExcelJS.Workbook, rows: (string | number | Date | null)[][]) {
  const sheet = workbook.worksheets[0];
  rows.forEach((values, i) => {
    values.forEach((v, j) => {
      sheet.getCell(i + 2, j + 1).value = v;
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function simulate(page: Page, card: string, name: string, buffer: Buffer) {
  await page.goto("/imports");
  const section = page.locator("section", { has: page.getByRole("heading", { name: card, exact: true }) });
  await section
    .getByLabel("Fichier Excel rempli")
    .setInputFiles({ name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await section.getByRole("button", { name: "Simuler l'import" }).click();
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
}

/** Tuile de synthèse (libellé en capitales au-dessus de la valeur), pas le badge de statut du tableau. */
const tile = (page: Page, label: string) => page.locator("p.uppercase", { hasText: new RegExp(`^${label}$`) }).locator("..");

test("import d'équipements : simulation, lignes valides, réimportation sans doublon", async ({ page }) => {
  const stamp = String(Date.now()).slice(-7);
  await login(page, USERS.maintenanceManager);

  const workbook = await template(page, "equipment");
  expect(workbook.worksheets.map((w) => w.name)).toEqual(["Équipements", "Aide", "Listes"]);
  expect(workbook.worksheets[0].getCell(1, 1).value).toBe("Code parc *");

  // Colonnes du modèle : code, désignation, société, site, catégorie, marque, modèle, n° de série, immat., année,
  // criticité, mode, date d'acquisition, valeur, mise en service, fin de garantie, compteur, valeur du compteur
  const commissioning = new Date(Date.UTC(2024, 2, 1));
  const buffer = await fill(workbook, [
    [
      `IMP-${stamp}-A`,
      "Chargeuse importée A",
      "SBTP",
      "LYO",
      "CHARGEUSE",
      "Volvo",
      null,
      `SN-A-${stamp}`,
      null,
      2023,
      "B",
      "Achat",
      null,
      98000,
      commissioning,
      null,
      "Heures moteur",
      120,
    ],
    [
      `imp-${stamp}-a`,
      "Doublon de la ligne 2",
      "SBTP",
      "LYO",
      "CHARGEUSE",
      "Volvo",
      null,
      `SN-X-${stamp}`,
      null,
      null,
      null,
      null,
      null,
      null,
      commissioning,
    ],
    ["PE-007", "Déjà au parc", "SBTP", "LYO", "PELLE", "Caterpillar", null, `SN-P-${stamp}`, null, null, null, null, null, null, commissioning],
    [
      `IMP-${stamp}-D`,
      "Ligne fausse",
      "SBTP",
      "NULLE-PART",
      "CHARGEUSE",
      "Volvo",
      null,
      `SN-D-${stamp}`,
      null,
      null,
      "Z",
      null,
      null,
      null,
      "31/02/2024",
    ],
    [
      `IMP-${stamp}-E`,
      "Camion importé E",
      "SBTP",
      "MRS",
      "CAMION",
      "Renault",
      null,
      `SN-E-${stamp}`,
      null,
      2021,
      null,
      "Location longue durée",
      null,
      null,
      "15/06/2021",
      null,
      "Kilométrage",
      85000,
    ],
  ]);

  await simulate(page, "Équipements", `parc-${stamp}.xlsx`, buffer);
  await expect(tile(page, "À importer")).toContainText("2");
  await expect(tile(page, "Déjà présentes")).toContainText("1");
  await expect(tile(page, "En erreur")).toContainText("2");
  await expect(page.getByText("Code parc en double dans le fichier (déjà en ligne 2).")).toBeVisible();
  await expect(page.getByText("Site « NULLE-PART » inconnu.")).toBeVisible();
  await expect(page.getByText("Date de mise en service : date attendue au format JJ/MM/AAAA (« 31/02/2024 »).")).toBeVisible();
  await expect(page.getByText(/Criticité : valeur « Z » inconnue/)).toBeVisible();

  // « Tout importer » est refusé tant qu'il reste une erreur ; « lignes valides » importe les 2 lignes prêtes
  await page.getByRole("button", { name: "Tout importer (2)" }).click();
  await expect(page.getByText(/ligne\(s\) en erreur : corriger le fichier/)).toBeVisible();
  await page.getByRole("button", { name: "Importer les lignes valides (2)" }).click();
  await expect(page.getByText("Import exécuté : 2 ligne(s) créée(s), 2 en erreur, 1 déjà présente(s).")).toBeVisible();
  await expect(tile(page, "Importées")).toContainText("2");

  // Le rapport Excel liste chaque ligne avec son statut
  const reportResponse = await page.request.get(`${page.url().replace(/\?.*$/, "")}`.replace("/imports/", "/api/v1/imports/") + "/report");
  const report = new ExcelJS.Workbook();
  await report.xlsx.load((await reportResponse.body()) as unknown as ExcelJS.Buffer);
  const statuses = report.worksheets[0].getColumn(2).values.slice(2);
  expect(statuses).toEqual(["Importé", "Erreur", "Déjà présent (ignoré)", "Erreur", "Importé"]);

  // L'équipement importé a sa fiche, avec son compteur principal
  const list = await (await page.request.get(`/api/v1/equipment?q=IMP-${stamp}-A`)).json();
  expect(list.data.items).toHaveLength(1);

  // Réimportation du même fichier : rien à créer, aucun doublon
  await simulate(page, "Équipements", `parc-${stamp}.xlsx`, buffer);
  await expect(page.getByText("Fichier déjà importé")).toBeVisible();
  await expect(tile(page, "À importer")).toContainText("0");
  await expect(tile(page, "Déjà présentes")).toContainText("3");
});

test("articles puis stocks initiaux par le magasinier, dans son périmètre", async ({ page }) => {
  const stamp = String(Date.now()).slice(-7);
  const sku = `IMP-FLT-${stamp}`;
  await login(page, USERS.storekeeper);

  const parts = await fill(await template(page, "parts"), [
    [sku, "Filtre importé", "Filtration", "u", "Hydac", `REF-${stamp}`, "Quantité", "Non", "B"],
  ]);
  await simulate(page, "Pièces détachées", `articles-${stamp}.xlsx`, parts);
  await expect(tile(page, "À importer")).toContainText("1");
  await page.getByRole("button", { name: "Tout importer (1)" }).click();
  await expect(page.getByText("Import exécuté : 1 ligne(s) créée(s).")).toBeVisible();

  // Le magasin de Grenoble (autre société) est hors du périmètre du magasinier SBTP
  const stockFile = await fill(await template(page, "initial_stock"), [
    [sku, "MAG-LYO", 12, 38.5, 2, 4, 20],
    [sku, "MAG-GRE", 3],
    ["INCONNU-999", "MAG-LYO", 1],
  ]);
  await simulate(page, "Stocks initiaux", `stock-${stamp}.xlsx`, stockFile);
  await expect(page.getByText("Magasin « MAG-GRE » hors de votre périmètre.")).toBeVisible();
  await expect(page.getByText("Article « INCONNU-999 » inconnu : importer d'abord les articles.")).toBeVisible();
  await page.getByRole("button", { name: "Importer les lignes valides (1)" }).click();
  await expect(page.getByText(/Import exécuté : 1 ligne\(s\) créée\(s\)/)).toBeVisible();

  // Stock et seuils enregistrés
  const levels = await (await page.request.get(`/api/v1/parts?q=${sku}`)).json();
  const part = levels.data.items[0];
  const detail = await (await page.request.get(`/api/v1/parts/${part.id}`)).json();
  const level = detail.data.levels.find((l: { warehouseCode?: string; onHand: number; reorderPoint: number | null }) => l.onHand === 12);
  expect(level?.reorderPoint).toBe(4);

  // Réimportation du stock initial : ignorée, le stock n'est pas doublé
  await simulate(page, "Stocks initiaux", `stock-${stamp}.xlsx`, stockFile);
  await expect(tile(page, "Déjà présentes")).toContainText("1");
  await expect(page.getByText("Stock déjà initialisé (mouvements existants) : ligne ignorée.")).toBeVisible();
});
