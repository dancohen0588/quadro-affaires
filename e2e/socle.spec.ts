import { expect, test } from "@playwright/test";
import { E2E_ACCESS_CODE } from "../playwright.config";

test.describe("socle et mode démo (session 1.1)", () => {
  test("la démo exige le code d'accès avant toute page", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/\/acces\?suite=%2Fpipeline/);
    await expect(page.getByText("Démonstration — données fictives")).toBeVisible();

    await page.getByLabel("Code d'accès").fill("mauvais-code");
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page.getByText("Code incorrect")).toBeVisible();

    await page.getByLabel("Code d'accès").fill(E2E_ACCESS_CODE);
    await page.getByRole("button", { name: "Entrer" }).click();
    // Pas encore de session : la coquille renvoie vers le choix du personnage.
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("refuse une redirection vers un autre site après le code", async ({ page }) => {
    await page.goto("/acces?suite=//exemple.com");
    await page.getByLabel("Code d'accès").fill(E2E_ACCESS_CODE);
    await page.getByRole("button", { name: "Entrer" }).click();
    await expect(page).toHaveURL(/localhost:3100\/connexion$/);
  });

  test("envoie les en-têtes de sécurité", async ({ request }) => {
    const res = await request.get("/acces");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
