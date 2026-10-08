import { expect, type Page } from "@playwright/test";

/** Mot de passe commun des comptes de démonstration (scripts/seed.ts). */
export const DEMO_PASSWORD = "Demo-Gmao-2026";

export const USERS = {
  admin: "admin@demo.gmao",
  maintenanceManager: "resp.maintenance@demo.gmao",
  workshopLyon: "chef.lyon@demo.gmao",
  technicianLyon: "tech.lyon@demo.gmao",
  operator: "conducteur@demo.gmao",
  storekeeper: "magasin@demo.gmao",
} as const;

/** Connexion par l'écran de login ; attend l'arrivée sur la page demandée (ou le tableau de bord). */
export async function login(page: Page, email: string, next = "/") {
  const target = next.startsWith("http") ? new URL(next).pathname + new URL(next).search : next;
  await page.context().clearCookies();
  await page.goto(target === "/" ? "/login" : `/login?next=${encodeURIComponent(target)}`);
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  if (target !== "/") await expect(page).toHaveURL(new RegExp(`${target.replace(/[?]/g, "\\?")}$`));
}

/** Message de succès ou d'erreur affiché par un formulaire d'action. */
export function statusMessage(page: Page) {
  return page.getByRole("status").or(page.getByRole("alert"));
}
