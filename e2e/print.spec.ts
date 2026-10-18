import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

test("fiche d'intervention à signer : identification, signatures, coûts à la demande", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const list = await (await page.request.get("/api/v1/work-orders?status=CLOSED&pageSize=50")).json();
  const external = list.data.items.find((w: { isExternal: boolean }) => w.isExternal);
  expect(external, "une intervention clôturée confiée à un prestataire").toBeTruthy();

  await page.goto(`/ordres-de-travail/${external.id}`);
  await page.getByRole("link", { name: "Fiche à signer" }).click();
  await expect(page).toHaveURL(new RegExp(`/impression/ordre-de-travail/${external.id}$`));
  await expect(page.getByRole("heading", { name: "Fiche d'intervention" })).toBeVisible();
  await expect(page.getByText(external.number).first()).toBeVisible();
  for (const title of ["Intervenant", "Prestataire", "Responsable (réception des travaux)"]) {
    await expect(page.locator("article").getByText(title, { exact: true }).last()).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Coûts" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeVisible();

  await page.getByRole("link", { name: "Afficher les coûts" }).click();
  await expect(page.getByRole("heading", { name: "Coûts" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Main-d.œuvre Pièces Prestataire Autres Total/ })).toBeVisible();
});

test("fiche d'intervention : hors périmètre, l'intervention est introuvable", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const list = await (await page.request.get("/api/v1/work-orders?pageSize=50")).json();
  // Ordre de travail d'un site hors du périmètre du technicien de Lyon.
  const lyon = list.data.items.find((w: { siteName?: string }) => w.siteName && !w.siteName.includes("Lyon"));
  test.skip(!lyon, "aucune intervention hors de Lyon dans la démonstration");
  await login(page, USERS.technicianLyon);
  // Page rendue en flux (chargement) : la page « introuvable » est affichée, sans révéler l'ordre de travail.
  await page.goto(`/impression/ordre-de-travail/${lyon.id}`);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText(lyon.number)).toHaveCount(0);
});
