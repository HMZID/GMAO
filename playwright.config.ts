import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout (scénarios de recette du CDC §15) sur l'application construite.
 * Prérequis : base migrée et données de démonstration chargées (`npm run db:reset`), puis `npm run build`.
 * Lancement : `npm run test:e2e` (démarre `next start` sur le port E2E_PORT, 3100 par défaut).
 */
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
