import { expect, test } from "@playwright/test";
import { E2E_ACCESS_CODE } from "../playwright.config";

test.describe("socle et mode démo (session 1.1)", () => {
  test("la démo exige le code d'accès puis ouvre Ma journée", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/\/acces\?suite=%2Fpipeline/);
    await expect(page.getByText("Démonstration — données fictives")).toBeVisible();

    await page.getByLabel("Code d'accès").fill("mauvais-code");
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page.getByText("Code incorrect")).toBeVisible();

    await page.getByLabel("Code d'accès").fill(E2E_ACCESS_CODE);
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page).toHaveURL(/\/pipeline$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const libelle of ["Ma journée", "Mes affaires", "Pipeline", "Planning", "Règlements", "Pilotage", "Administration"]) {
      await expect(nav.getByRole("link", { name: libelle })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");

    await page.goto("/");
    await expect(page).toHaveURL(/\/ma-journee$/);
    await expect(page.getByText("Démonstration — données fictives")).toBeVisible();
  });

  test("refuse une redirection vers un autre site après le code", async ({ page }) => {
    await page.goto("/acces?suite=//exemple.com");
    await page.getByLabel("Code d'accès").fill(E2E_ACCESS_CODE);
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page).toHaveURL(/localhost:3100\/ma-journee$/);
  });

  test("envoie les en-têtes de sécurité", async ({ request }) => {
    const res = await request.get("/acces");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
