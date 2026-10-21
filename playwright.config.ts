import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const PORT_PRODUCTION = 3200;
export const E2E_ACCESS_CODE = "code-e2e";

export default defineConfig({
  testDir: "./e2e",
  // Les parcours modifient la base de démo partagée : un seul worker, fichiers l'un après l'autre.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-1280",
      // La répétition du scénario de démo (demo.spec.ts) a son propre projet : elle part d'un seed tout frais.
      testIgnore: /demo\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 }, // largeur de référence (ENF-02)
        // Permet d'utiliser un Chromium déjà installé sur la machine (facultatif).
        launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
    {
      // pnpm seed:demo puis pnpm e2e:demo : le scénario de la section 15.5 de bout en bout (session 5.3).
      name: "demo",
      testMatch: /demo\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: process.env.PW_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } : {},
      },
    },
  ],
  // L'application doit être construite avant (pnpm build) : on teste le rendu de production.
  // La base Supabase (locale en CI) doit être remplie par pnpm seed:demo avec le même DEMO_PERSONA_PASSWORD.
  webServer: [
    {
      command: `pnpm start --port ${PORT}`,
      url: `http://localhost:${PORT}/acces`,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, APP_MODE: "demo", DEMO_ACCESS_CODE: E2E_ACCESS_CODE } as Record<string, string>,
    },
    {
      // Même build en APP_MODE=production : vérifie que les pages propres à la démo sont introuvables.
      command: `pnpm start --port ${PORT_PRODUCTION}`,
      url: `http://localhost:${PORT_PRODUCTION}/acces`,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, APP_MODE: "production", DEMO_ACCESS_CODE: "" } as Record<string, string>,
    },
  ],
});
