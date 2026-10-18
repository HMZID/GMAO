import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, statusMessage } from "./helpers";

/** Double authentification (TEC-04) : activation, connexion avec un code, code faux refusé, code de secours. */

const EMAIL = "tech2.lyon@demo.gmao";
const STEP = 30;

/** Code TOTP (RFC 6238 : HMAC-SHA1, pas de 30 s, 6 chiffres) à partir du secret base32. */
function totp(secret: string, time = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / STEP)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Attend le pas de temps suivant : un même code n'est pas présenté deux fois. */
async function nextStep(page: Page) {
  const ms = STEP * 1000 - (Date.now() % (STEP * 1000)) + 1000;
  await page.waitForTimeout(ms);
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("double authentification : activation, connexion par code, code faux refusé, code de secours", async ({ page }) => {
  test.setTimeout(150_000);
  // Activation depuis la page Sécurité du compte.
  await signIn(page);
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/compte/securite");
  await page.getByLabel("Mot de passe actuel").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Configurer l'application d'authentification" }).click();
  const secret = (await page.locator("[data-totp-secret]").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  const backupCodes = (await page.getByRole("list", { name: "Codes de secours" }).getByRole("listitem").allTextContents()).map((c) => c.trim());
  expect(backupCodes.length).toBeGreaterThanOrEqual(5);
  await page.getByLabel("Code de vérification").fill(totp(secret));
  await page.getByRole("button", { name: "Activer la double authentification" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Double authentification activée." })).toBeVisible();
  await expect(page).toHaveURL(/\/compte\/securite\?active=1/);

  // Connexion : le mot de passe ne suffit plus ; un code faux est refusé, le bon ouvre la session.
  await nextStep(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/connexion\/verification/);
  expect((await (await page.request.get("/api/v1/me")).json()).error?.code).toBe("unauthorized");
  await page.getByLabel("Code de vérification").fill(totp(secret) === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Vérifier et continuer" }).click();
  await expect(statusMessage(page).filter({ hasText: /Code incorrect/ })).toBeVisible();
  await page.getByLabel("Code de vérification").fill(totp(secret));
  await page.getByRole("button", { name: "Vérifier et continuer" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
  expect((await (await page.request.get("/api/v1/me")).json()).data.email).toBe(EMAIL);

  // Téléphone indisponible : un code de secours, à usage unique.
  await signIn(page);
  await expect(page).toHaveURL(/\/connexion\/verification/);
  await page.getByRole("button", { name: "Utiliser un code de secours" }).click();
  await page.getByLabel("Code de secours").fill(backupCodes[0]);
  await page.getByRole("button", { name: "Vérifier et continuer" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
  expect((await (await page.request.get("/api/v1/me")).json()).data.email).toBe(EMAIL);
});
