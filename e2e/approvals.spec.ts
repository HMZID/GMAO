import { expect, test, type Page } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Circuits de validation (CDC §2.4, HAB-04, ACH-02) avec les circuits par défaut de la démonstration :
 * demande d'achat (responsable achats, puis direction au-delà de 5 000 €), dépense de maintenance
 * (responsable maintenance au-delà de 1 000 €), DI P1 (chef d'atelier du site).
 */

/** Bloc « À valider » de la page Validations pour une demande donnée. */
function pendingItem(page: Page, label: string | RegExp) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name: label }) });
}

test("demande d'achat au-delà du seuil : achats puis direction, le demandeur ne valide pas", async ({ page }) => {
  const stamp = String(Date.now()).slice(-6);
  const description = `Vérins de godet ${stamp}`;

  // Le magasinier crée la demande (2 × 3 000 € = 6 000 € : deux étapes)
  await login(page, USERS.storekeeper, "/demandes-achat/nouvelle");
  await page.getByLabel("Objet de la demande").fill(description);
  await page.getByLabel("Quantité").fill("2");
  await page.getByLabel("Prix unitaire estimé (€)").fill("3000");
  await page.getByLabel("Équipement").selectOption({ label: "CH-012 — Chargeuse sur pneus 950M" });
  await page.getByRole("button", { name: "Soumettre la demande" }).click();
  await expect(page).toHaveURL(/\/demandes-achat\/[0-9a-f-]{36}$/);
  const requestUrl = page.url();
  await expect(page.getByText("À valider", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Responsable achats").first()).toBeVisible();
  await expect(page.getByText("Direction").first()).toBeVisible();
  // Le demandeur n'a pas de formulaire de décision
  await expect(page.getByRole("button", { name: "Valider" })).toHaveCount(0);

  // Le responsable achats valide la première étape
  await login(page, USERS.purchasing, "/validations");
  const item = pendingItem(page, new RegExp(description));
  await expect(item).toBeVisible();
  await item.getByLabel("Commentaire").fill("Besoin confirmé, deux devis reçus.");
  await item.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Validation enregistrée.")).toBeVisible();
  await expect(pendingItem(page, new RegExp(description))).toHaveCount(0);

  // La direction tranche la seconde étape ; un refus sans commentaire est refusé
  await login(page, USERS.executive, requestUrl);
  await page.getByRole("button", { name: "Refuser" }).click();
  await expect(page.getByText("Le commentaire est obligatoire en cas de refus.")).toBeVisible();
  // Champ ciblé par son nom : après un envoi sans JavaScript, le libellé peut ne plus être relié au champ.
  await page.locator("textarea[name=comment]").fill("Accord, à commander chez le fournisseur habituel.");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Validation enregistrée.")).toBeVisible();
  await expect(page.getByText("Validée", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("« Besoin confirmé, deux devis reçus. »")).toBeVisible();
  await expect(page.getByText(/Validée par Hélène Garnier/)).toBeVisible();

  // Une décision rejouée par l'API sur une demande tranchée est refusée (transition non autorisée)
  const id = requestUrl.split("/").pop();
  const detail = await (await page.request.get(`/api/v1/purchase-requests/${id}`)).json();
  const again = await page.request.post(`/api/v1/approvals/${detail.data.approvals[0].id}/decision`, {
    data: { decision: "REJECTED", comment: "trop tard" },
  });
  expect(again.status()).toBe(422);
});

test("refus d'une demande d'achat : commentaire obligatoire, demande refusée", async ({ page }) => {
  await login(page, USERS.purchasing, "/validations");
  const item = pendingItem(page, /Pompe hydraulique 67110-26600-71/);
  await item.getByRole("button", { name: "Refuser" }).click();
  await expect(page.getByText("Le commentaire est obligatoire en cas de refus.")).toBeVisible();
  await item.getByLabel("Commentaire").fill("Pompe disponible à Marseille : transfert entre magasins.");
  await item.getByRole("button", { name: "Refuser" }).click();
  await expect(page.getByText("Refus enregistré.")).toBeVisible();

  const list = await (await page.request.get("/api/v1/purchase-requests?pageSize=50")).json();
  const pump = list.data.items.find((p: { description: string }) => p.description.startsWith("Pompe hydraulique 67110-26600-71"));
  expect(pump.status).toBe("REJECTED");
});

test("dépense de maintenance : à valider, puis comptée dans les coûts de l'OT", async ({ page }) => {
  await login(page, USERS.maintenanceManager);
  const { data } = await (await page.request.get("/api/v1/work-orders?q=CE-031&pageSize=10")).json();
  const workOrder = data.items.find((w: { title: string }) => w.title.startsWith("Pompe hydraulique défaillante"));
  await page.goto(`/ordres-de-travail/${workOrder.id}`);

  const card = page.locator("section", { has: page.getByRole("heading", { name: "Validation des dépenses" }) });
  await expect(card.getByText("Location d'un chariot de remplacement (2 semaines)")).toBeVisible();
  await expect(page.getByText("À valider", { exact: true }).first()).toBeVisible();
  const before = (await (await page.request.get(`/api/v1/work-orders/${workOrder.id}`)).json()).data.costs.other;

  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByText("Validation enregistrée.")).toBeVisible();
  const after = (await (await page.request.get(`/api/v1/work-orders/${workOrder.id}`)).json()).data.costs.other;
  expect(after - before).toBe(1450);
});

test("DI P1 : transformation en OT bloquée tant que le chef d'atelier n'a pas validé", async ({ page }) => {
  await login(page, USERS.workshopLyon);
  const { data } = await (await page.request.get("/api/v1/work-requests?q=Frein de service inefficace&pageSize=10")).json();
  const request = data.items[0];
  await page.goto(`/demandes/${request.id}`);

  await page.getByRole("button", { name: "Qualifier" }).click();
  await expect(page.getByText("DI qualifiée.")).toBeVisible();
  await page.getByRole("button", { name: "Transformer en OT" }).click();
  await expect(page.getByText(/La DI est en attente de validation \(Chef d'atelier du site\)/)).toBeVisible();

  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Validation enregistrée.")).toBeVisible();
  await page.getByRole("button", { name: "Transformer en OT" }).click();
  await expect(page).toHaveURL(/\/ordres-de-travail\/[0-9a-f-]{36}$/);
});
