import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Le paquet server-only refuse d'être importé hors du rendu serveur React : neutralisé pour les tests.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      include: ["src/lib/process/**", "src/lib/rules/**", "src/lib/affaire/**", "src/lib/format.ts", "src/lib/mails/**"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }, // ENF-10
    },
  },
});
