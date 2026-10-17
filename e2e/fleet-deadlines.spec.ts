import { expect, test, type Page } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Échéances administratives du parc : assurance, visite technique, vignette. Alerte du tableau de bord,
 * liste du parc, renouvellement, ajout et annulation depuis la fiche, lecture seule pour un technicien, API.
 */

async function equipmentUrl(page: Page, code: string) {
  const { data } = await (await page.request.get(`/api/v1/equipment?q=${code}`)).json();
  return `/equipements/${data.items[0].id}`;
}

/** Date du calendrier dans n jours, au format d'un champ date. */
function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

test("échéances du parc : alerte, liste, renouvellement, ajout et annulation", async ({ page }) => {
  await login(page, USERS.fleetManager);
  // Tableau de bord : vignette de CA-101 échue, assurance et visite technique à renouveler.
  const banner = page.getByRole("alert").filter({ hasText: "Assurances, visites techniques et vignettes" });
  await expect(banner).toContainText(/échéance\(s\) dépassée\(s\)/);
  await banner.getByRole("link", { name: "Voir les échéances du parc" }).click();
  await expect(page).toHaveURL(/\/equipements\/echeances\?horizon=30/);
  const vignette = page.getByRole("row").filter({ hasText: "Vignette 2026" }).filter({ hasText: "CA-101" });
  await expect(vignette).toContainText("En retard");
  await expect(page.getByRole("row").filter({ hasText: "POL-2025-0412" })).toContainText("À renouveler");

  // Fiche CA-101 : renouvellement de l'assurance, l'ancienne passe dans l'historique.
  await page.goto(await equipmentUrl(page, "CA-101"));
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Échéances administratives" }) });
  const insurance = card.getByRole("row").filter({ hasText: "POL-2025-0412" });
  await insurance.getByText("Renouveler", { exact: true }).click();
  await insurance.getByLabel("Nouvelle échéance").fill(inDays(377));
  await insurance.getByLabel("Nouvelle référence").fill("POL-2026-0412");
  await insurance.getByRole("button", { name: "Enregistrer le renouvellement" }).click();
  await expect(card.getByText("Échéance renouvelée : la suivante est suivie.")).toBeVisible();
  await expect(card.getByRole("row").filter({ hasText: "POL-2026-0412" })).toContainText("À jour");
  await expect(card.getByRole("row").filter({ hasText: "POL-2025-0412" })).toContainText("Renouvelée");

  // Ajout d'une échéance, refus d'un renouvellement antérieur, puis annulation motivée.
  await card.getByText("Ajouter une échéance").click();
  await card.getByLabel("Type").selectOption({ label: "Autre échéance" });
  await card.getByLabel("Date d'échéance").fill(inDays(20));
  await card.getByLabel("Libellé").fill("Contrôle du chronotachygraphe");
  await card.getByRole("button", { name: "Enregistrer l'échéance" }).click();
  await expect(card.getByText(/Échéance enregistrée/)).toBeVisible();
  const other = card.getByRole("row").filter({ hasText: "Contrôle du chronotachygraphe" });
  await expect(other).toContainText("À renouveler");
  await other.getByText("Renouveler", { exact: true }).click();
  await other.getByLabel("Nouvelle échéance").fill(inDays(10));
  await other.getByRole("button", { name: "Enregistrer le renouvellement" }).click();
  await expect(card.getByText("La nouvelle échéance doit être postérieure à l'échéance renouvelée.")).toBeVisible();
  await other.getByText("Annuler", { exact: true }).click();
  await other.getByLabel("Motif").fill("Véhicule non équipé");
  await other.getByRole("button", { name: "Annuler l'échéance" }).click();
  await expect(card.getByText("Échéance annulée.")).toBeVisible();
  await expect(card.getByRole("row").filter({ hasText: "Contrôle du chronotachygraphe" })).toContainText("Annulée");

  // API : mêmes services ; la vignette échue figure parmi les retards.
  const { data } = await (await page.request.get("/api/v1/equipment-deadlines?horizon=overdue")).json();
  expect(data.map((d: { equipmentCode: string; label: string | null }) => `${d.equipmentCode} ${d.label}`)).toContain("CA-101 Vignette 2026");
});

test("échéances du parc : un technicien consulte sans pouvoir renouveler", async ({ page }) => {
  await login(page, USERS.technicianLyon);
  await page.goto(await equipmentUrl(page, "CA-101"));
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Échéances administratives" }) });
  await expect(card.getByRole("row").filter({ hasText: "Vignette 2026" })).toBeVisible();
  await expect(card.getByText("Renouveler", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Ajouter une échéance")).toHaveCount(0);
  const response = await page.request.post("/api/v1/equipment-deadlines", {
    data: { equipmentId: (await equipmentUrl(page, "CA-101")).split("/").pop(), kind: "INSURANCE", dueDate: inDays(30) },
  });
  expect(response.status()).toBe(403);
});
