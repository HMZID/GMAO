import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { USERS, login } from "./helpers";

/** Export des données de l'organisation (INT-01) : écran, classeur complet, CSV, JSON paginé et incrémental, droits. */

test("l'administrateur exporte les données : classeur complet, CSV et JSON paginé", async ({ page }) => {
  await login(page, USERS.admin, "/administration/export");
  await expect(page.getByRole("heading", { name: "Export des données" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Équipements : télécharger en Excel" })).toBeVisible();

  // Classeur complet : un onglet d'informations puis un onglet par jeu de données.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tout exporter (Excel)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^gmao-donnees-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await file.path());
  expect(workbook.worksheets.map((w) => w.name)).toEqual([
    "Informations",
    "Équipements",
    "Ordres de travail",
    "Demandes",
    "Relevés",
    "Fournisseurs",
    "Ouvriers",
    "Articles",
    "Stocks",
    "Mouvements",
  ]);
  const equipmentSheet = workbook.getWorksheet("Équipements")!;
  expect(equipmentSheet.getCell(1, 2).value).toBe("Code parc");
  const codes = equipmentSheet.getColumn(2).values.slice(2);
  expect(codes).toContain("PE-007");

  // CSV : en-têtes = clés stables, codes conservés.
  const csv = await (await page.request.get("/api/v1/exports/equipment?format=csv")).text();
  const [header] = csv.replace(/^﻿/, "").split("\r\n");
  expect(header.split(",").slice(0, 3)).toEqual(["id", "code", "name"]);
  expect(csv).toContain(",PE-007,");

  // JSON paginé, puis incrémental.
  const first = await (await page.request.get("/api/v1/exports/work-orders?limit=5")).json();
  expect(first.data.items).toHaveLength(5);
  expect(first.data.page.next).toBe(5);
  const second = await (await page.request.get("/api/v1/exports/work-orders?limit=5&offset=5")).json();
  expect(second.data.items[0].id).not.toBe(first.data.items[0].id);
  const none = await (await page.request.get("/api/v1/exports/work-orders?updatedSince=2099-01-01T00:00:00Z")).json();
  expect(none.data.items).toHaveLength(0);
  expect(none.data.page.next).toBeNull();
});

test("l'export est réservé : technicien refusé, jeu de données inconnu refusé", async ({ page }) => {
  await login(page, USERS.technicianLyon);
  expect((await page.request.get("/api/v1/exports")).status()).toBe(403);
  expect((await page.request.get("/api/v1/exports/equipment?format=csv")).status()).toBe(403);
  await page.goto("/administration/export");
  await expect(page.getByText(/Accès refusé|n'avez pas accès|droit/i).first()).toBeVisible();

  await login(page, USERS.admin);
  const unknown = await page.request.get("/api/v1/exports/salaires");
  expect(unknown.status()).toBe(400);
});
