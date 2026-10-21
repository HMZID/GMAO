import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { USERS, login } from "./helpers";

/**
 * Carburant et fluides : consommation plein à plein, anomalies à examiner, cartes, idempotence, saisie à l'écran,
 * import d'un relevé de carte carburant. Données de démonstration : dernier plein de PE-007 en surconsommation.
 */

async function equipmentId(page: Page, code: string): Promise<string> {
  const { data } = await (await page.request.get(`/api/v1/equipment?q=${code}`)).json();
  return data.items.find((e: { code: string }) => e.code === code).id;
}

async function card(page: Page, last4: string): Promise<string> {
  const { data } = await (await page.request.get("/api/v1/fuel-cards")).json();
  return data.find((c: { last4: string }) => c.last4 === last4).id;
}

test("consommation, anomalies et examen des pleins par le responsable du parc", async ({ page }) => {
  const stamp = Date.now();
  await login(page, USERS.fleetManager);

  // Consommation plein à plein : PE-007 a une référence de 15 L/h et un plein à examiner (seed).
  const consumption = (await (await page.request.get("/api/v1/fuel-consumption")).json()).data;
  const pe007 = consumption.items.find((i: { code: string }) => i.code === "PE-007");
  expect(pe007).toMatchObject({ unit: "L/h", reference: 15 });
  expect(pe007.toReview).toBeGreaterThanOrEqual(1);
  expect(pe007.rate).toBeGreaterThan(14);

  const truck = await equipmentId(page, "CA-101");
  const loader = await equipmentId(page, "CH-012");
  const agil = await card(page, "4521");

  // Plein conforme sur CA-101 avec sa carte : aucune anomalie ; renvoyé deux fois, enregistré une fois.
  const body = { equipmentId: truck, quantity: 184, unitPrice: 2.205, meterValue: 169800, fuelCardId: agil, clientId: `e2e-fuel-${stamp}` };
  const first = await page.request.post("/api/v1/fuel-entries", { data: body });
  expect(first.status(), await first.text()).toBe(201);
  const created = (await first.json()).data;
  expect(created.anomalies).toEqual([]);
  expect(created.entry).toMatchObject({ amount: 405.72, source: "API", reviewStatus: "NONE" });
  const again = (await (await page.request.post("/api/v1/fuel-entries", { data: body })).json()).data;
  expect(again).toMatchObject({ duplicate: true, entry: { id: created.entry.id } });

  // Carte du camion utilisée sur la chargeuse : signalée, puis justifiée (commentaire obligatoire).
  const misuse = (
    await (await page.request.post("/api/v1/fuel-entries", { data: { equipmentId: loader, quantity: 60, fuelCardId: agil, fullTank: false } })).json()
  ).data;
  expect(misuse.anomalies.map((a: { code: string }) => a.code)).toContain("CARD_OTHER_EQUIPMENT");
  expect(misuse.entry.reviewStatus).toBe("TO_REVIEW");
  // Commentaire absent : refus de validation de la saisie (400), avant toute règle métier.
  const noComment = await page.request.post(`/api/v1/fuel-entries/${misuse.entry.id}/review`, { data: { decision: "JUSTIFIED" } });
  expect(noComment.status()).toBe(400);
  const justified = await page.request.post(`/api/v1/fuel-entries/${misuse.entry.id}/review`, {
    data: { decision: "JUSTIFIED", comment: "Carte prêtée, camion à l'atelier" },
  });
  expect((await justified.json()).data).toMatchObject({ reviewStatus: "JUSTIFIED", status: "VALID" });

  // Quantité impossible pour le réservoir : signalée, puis le plein erroné est annulé (sort des calculs).
  const overflow = (await (await page.request.post("/api/v1/fuel-entries", { data: { equipmentId: loader, quantity: 900, fullTank: false } })).json())
    .data;
  expect(overflow.anomalies.map((a: { code: string }) => a.code)).toContain("TANK_OVERFLOW");
  const cancelled = await page.request.post(`/api/v1/fuel-entries/${overflow.entry.id}/review`, {
    data: { decision: "CANCELLED", comment: "Erreur de saisie : 90 L" },
  });
  expect((await cancelled.json()).data).toMatchObject({ status: "CANCELLED", cancelReason: "Erreur de saisie : 90 L" });

  // Écran : pleins à examiner, consommation et fiche équipement.
  await page.goto("/carburant");
  await expect(page.getByRole("heading", { name: "Carburant et fluides" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pleins à examiner" })).toBeVisible();
  await expect(page.getByText(/Surconsommation : .* L\/h pour une référence de 15 L\/h/).first()).toBeVisible();
  await page.goto(`/equipements/${await equipmentId(page, "PE-007")}`);
  await expect(page.getByRole("heading", { name: "Carburant et fluides" })).toBeVisible();
});

test("le conducteur saisit un plein mais n'examine pas les anomalies", async ({ page }) => {
  await login(page, USERS.operator);
  const truck = await equipmentId(page, "CA-101");
  const created = await page.request.post("/api/v1/fuel-entries", { data: { equipmentId: truck, quantity: 950, fullTank: false } });
  expect(created.status()).toBe(201);
  const entry = (await created.json()).data.entry;
  expect(entry.reviewStatus).toBe("TO_REVIEW");
  const review = await page.request.post(`/api/v1/fuel-entries/${entry.id}/review`, { data: { decision: "CANCELLED", comment: "Moi-même" } });
  expect(review.status()).toBe(403);

  // Saisie à l'écran depuis la page Carburant.
  await page.goto("/carburant");
  await page.getByText("Saisir un plein").click();
  await page.getByRole("combobox", { name: "Équipement" }).selectOption({ label: "CA-101 — Camion benne 8x4" });
  await page.getByLabel("Quantité (L)").fill("35");
  await page.getByRole("combobox", { name: "Plein complet" }).selectOption("false");
  await page.getByRole("button", { name: "Enregistrer le plein" }).click();
  await expect(page.getByText("Plein enregistré.").first()).toBeVisible();
});

test("import d'un relevé de carte carburant : simulation, exécution, réimportation sans doublon", async ({ page }) => {
  const stamp = Date.now();
  await login(page, USERS.fleetManager);
  const response = await page.request.get("/api/v1/imports/templates/fuel");
  expect(response.status()).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await response.body()) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map((v) => String(v).replace(" *", ""));
  // Relevé de la veille : jamais daté dans le futur, quelle que soit l'heure d'exécution.
  const yesterday = new Date(Date.now() - 86_400_000);
  const rows: Record<string, unknown>[] = [
    {
      Date: yesterday,
      Heure: "06:45",
      "Code parc": "CH-012",
      Produit: "Gasoil",
      "Quantité (L)": 120,
      "Prix au litre": 2.205,
      "Plein complet": "Non",
      Station: "Agil Mégrine",
      "Référence transaction": `TX-${stamp}-1`,
    },
    {
      Date: yesterday,
      "N° de carte": "7089 1234 5678 4521",
      "Fournisseur de la carte": "Agil",
      Produit: "AdBlue",
      "Quantité (L)": 18,
      "Référence transaction": `TX-${stamp}-2`,
    },
    { Date: yesterday, "Code parc": "XX-999", "Quantité (L)": 50, "Référence transaction": `TX-${stamp}-3` },
  ];
  rows.forEach((row, i) => headers.forEach((h, j) => (sheet.getCell(i + 2, j + 1).value = (row[h] as ExcelJS.CellValue) ?? null)));
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const file = { name: `releve-${stamp}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer };

  const simulated = (await (await page.request.post("/api/v1/imports", { multipart: { kind: "FUEL", file } })).json()).data;
  expect(simulated.summary).toMatchObject({ total: 3, ready: 2, errors: 1 });
  const executed = await page.request.post(`/api/v1/imports/${simulated.id}/execute`, { data: { mode: "VALID_ONLY" } });
  expect((await executed.json()).data.summary).toMatchObject({ imported: 2, errors: 1 });

  // La carte du camion retrouve l'équipement ; la même transaction réimportée est ignorée.
  const { data } = await (await page.request.get(`/api/v1/fuel-entries?equipmentId=${await equipmentId(page, "CA-101")}&fluid=ADBLUE`)).json();
  expect(data.items.some((e: { source: string; quantity: number }) => e.source === "CARD_IMPORT" && e.quantity === 18)).toBe(true);
  // Date et heure du relevé conservées (pas celles de l'import) : la veille à 06:45, heure de Paris.
  const loaderFills = (await (await page.request.get(`/api/v1/fuel-entries?equipmentId=${await equipmentId(page, "CH-012")}`)).json()).data.items;
  const imported = loaderFills.find((e: { source: string; quantity: number }) => e.source === "CARD_IMPORT" && e.quantity === 120);
  expect(new Date(imported.filledAt).toISOString().slice(0, 10)).toBe(yesterday.toISOString().slice(0, 10));
  expect(new Date(imported.filledAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })).toBe("06:45");
  const again = (await (await page.request.post("/api/v1/imports", { multipart: { kind: "FUEL", file } })).json()).data;
  expect(again.summary).toMatchObject({ total: 3, exists: 2, errors: 1 });
});
