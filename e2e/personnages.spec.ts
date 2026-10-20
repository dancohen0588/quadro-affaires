import { expect, test } from "@playwright/test";
import { PORT_PRODUCTION } from "../playwright.config";
import { entrerCode, seConnecterEn } from "./aide";

const NAV = { name: "Navigation principale" } as const;

test.describe("connexion par personnage (session 1.2)", () => {
  test("liste les 11 personnages groupés par rôle", async ({ page }) => {
    await entrerCode(page, "/connexion");
    await expect(page.getByRole("heading", { level: 2, name: "Gérants" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Conceptrices" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Transverses" })).toBeVisible();
    await expect(page.locator("main form button[type=submit]")).toHaveCount(11);
  });

  test("une conceptrice ne voit pas les écrans des gérants", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await expect(page.getByRole("button", { name: "Menu de Manon" })).toContainText("Conceptrice · La Ciotat");
    const nav = page.getByRole("navigation", NAV);
    await expect(nav.getByRole("link", { name: "Ma journée" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pilotage" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Administration" })).toHaveCount(0);

    const res = await page.goto("/pilotage");
    expect(res?.status()).toBe(404);
  });

  test("un gérant accède au pilotage et à l'administration", async ({ page }) => {
    await seConnecterEn(page, "Jean");
    const nav = page.getByRole("navigation", NAV);
    await nav.getByRole("link", { name: "Pilotage" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pilotage" })).toBeVisible();
    await nav.getByRole("link", { name: "Administration" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Administration" })).toBeVisible();
  });

  test("change de personnage sans se déconnecter, puis se déconnecte", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await page.goto("/planning");
    await page.getByRole("button", { name: "Menu de Manon" }).click();
    await page.getByRole("menuitem", { name: /^Valentin Tramoni/ }).click();
    await expect(page.getByRole("button", { name: "Menu de Valentin" })).toBeVisible();
    await expect(page).toHaveURL(/\/planning$/); // reste sur l'écran en cours
    await expect(page.getByRole("navigation", NAV).getByRole("link", { name: "Pilotage" })).toBeVisible();

    await page.getByRole("button", { name: "Menu de Valentin" }).click();
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await page.goto("/ma-journee");
    await expect(page).toHaveURL(/\/connexion$/);
  });
});

test("la page des personnages est introuvable en production", async ({ request }) => {
  const res = await request.get(`http://localhost:${PORT_PRODUCTION}/connexion`);
  expect(res.status()).toBe(404);
});
