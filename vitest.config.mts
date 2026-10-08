import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "mobile/src/**/*.test.ts"],
    // Fuseau horaire fixe : les calculs d'échéances sont en UTC, les tests ne dépendent pas du poste.
    env: { TZ: "UTC" },
  },
});
