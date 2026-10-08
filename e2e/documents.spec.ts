import { expect, test, type Page } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Documents joints (EQP-07) : ajout depuis la fiche, consultation selon les droits (factures réservées
 * aux profils achats et maintenance), retrait par l'auteur d'une photo d'OT, contrôle du format réel.
 */

/** PDF minimal ; le marqueur rend chaque fichier unique (le même fichier ne peut pas être joint deux fois). */
function pdf(marker: string) {
  return Buffer.from(`%PDF-1.4\n% ${marker}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
}

const PNG = (marker: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`fake-png-${marker}`)]);

async function equipmentUrl(page: Page, code: string) {
  const response = await page.request.get(`/api/v1/equipment?q=${code}`);
  const { data } = await response.json();
  return `/equipements/${data.items[0].id}`;
}

async function addDocument(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, kind: string, title: string) {
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
  // Le panneau reste ouvert après un premier ajout : ne pas le refermer.
  if (!(await card.getByLabel("Type").isVisible())) await card.getByText("Ajouter un document").click();
  await card.getByLabel("Fichier").setInputFiles(file);
  await card.getByLabel("Type").selectOption({ label: kind });
  await card.getByLabel("Titre").fill(title);
  await card.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(card.getByText("Document ajouté.")).toBeVisible();
  // Le message peut venir d'un ajout précédent : attendre la ligne du nouveau document.
  await expect(card.getByRole("link", { name: title })).toBeVisible();
  return card;
}

test("documents d'un équipement : ajout, consultation selon le profil, facture protégée", async ({ page }) => {
  const stamp = String(Date.now());

  await login(page, USERS.maintenanceManager);
  const url = await equipmentUrl(page, "CA-101");
  await page.goto(url);

  const card = await addDocument(
    page,
    { name: "certificat.pdf", mimeType: "application/pdf", buffer: pdf(`cert-${stamp}`) },
    "Certificat",
    `Contrôle technique ${stamp}`,
  );
  await expect(card.getByRole("link", { name: `Contrôle technique ${stamp}` })).toBeVisible();
  await addDocument(page, { name: "facture.pdf", mimeType: "application/pdf", buffer: pdf(`inv-${stamp}`) }, "Facture", `Facture garage ${stamp}`);

  // Un exécutable renommé en .pdf est refusé, le motif est affiché
  await card.getByLabel("Fichier").setInputFiles({ name: "piege.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ executable") });
  await card.getByLabel("Type").selectOption({ label: "Rapport" });
  await card.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(card.getByText("Le contenu du fichier ne correspond pas à son extension .pdf.")).toBeVisible();

  // Le contenu est servi par l'API après contrôle des droits
  const listed = await (await page.request.get(`/api/v1/documents?entityType=EQUIPMENT&entityId=${url.split("/").pop()}`)).json();
  const invoice = listed.data.items.find((d: { title: string }) => d.title === `Facture garage ${stamp}`);
  const content = await page.request.get(invoice.url);
  expect(content.status()).toBe(200);
  expect(content.headers()["content-type"]).toBe("application/pdf");
  expect(content.headers()["x-content-type-options"]).toBe("nosniff");

  // Le conducteur voit le certificat mais pas la facture, et ne peut rien ajouter
  await login(page, USERS.operator, url);
  const operatorCard = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
  await expect(operatorCard.getByRole("link", { name: `Contrôle technique ${stamp}` })).toBeVisible();
  await expect(operatorCard.getByText(`Facture garage ${stamp}`)).toHaveCount(0);
  await expect(operatorCard.getByText("Ajouter un document")).toHaveCount(0);
  expect((await page.request.get(invoice.url)).status()).toBe(404);
});

test("photo d'intervention : ajoutée puis retirée par le technicien", async ({ page }) => {
  const stamp = String(Date.now());
  await login(page, USERS.technicianLyon);
  const { data } = await (await page.request.get("/api/v1/work-orders?mine=true&pageSize=50")).json();
  const workOrder = data.items.find((w: { status: string }) => ["PLANNED", "IN_PROGRESS", "ON_HOLD", "CREATED"].includes(w.status));
  expect(workOrder, "un OT ouvert affecté au technicien de Lyon").toBeTruthy();
  await page.goto(`/ordres-de-travail/${workOrder.id}`);

  const card = await addDocument(page, { name: "fuite.png", mimeType: "image/png", buffer: PNG(stamp) }, "Photo", `Fuite raccord ${stamp}`);
  const row = card.getByRole("row", { name: new RegExp(`Fuite raccord ${stamp}`) });
  await expect(row).toBeVisible();

  await row.getByText("Retirer", { exact: true }).click();
  await row.getByLabel("Motif").fill("Photo floue");
  await row.getByRole("button", { name: "Retirer le document" }).click();
  await expect(card.getByText("Document retiré.")).toBeVisible();
  await expect(card.getByRole("row", { name: new RegExp(`Fuite raccord ${stamp}`) })).toHaveCount(0);
});
