import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_ACCESS_CODE = "code-e2e";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
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
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 }, // largeur de référence (ENF-02)
        // Permet d'utiliser un Chromium déjà installé sur la machine (facultatif).
        launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
  webServer: {
    // L'application doit être construite avant (pnpm build) : on teste le rendu de production.
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/acces`,
    reuseExistingServer: !process.env.CI,
    env: { APP_MODE: "demo", DEMO_ACCESS_CODE: E2E_ACCESS_CODE },
  },
});
