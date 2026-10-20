import { expect, type Page } from "@playwright/test";
import { E2E_ACCESS_CODE } from "../playwright.config";

/** Saisit le code d'accès de la démo depuis n'importe quelle page. */
export async function entrerCode(page: Page, chemin = "/") {
  await page.goto(chemin);
  await page.getByLabel("Code d'accès").fill(E2E_ACCESS_CODE);
  await page.getByRole("button", { name: "Entrer" }).click();
}

/** Code d'accès puis connexion sous un personnage. */
export async function seConnecterEn(page: Page, prenom: string) {
  await entrerCode(page);
  await expect(page.getByRole("heading", { level: 1, name: "Choisir un personnage" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${prenom}\\b`) }).click();
  await expect(page).toHaveURL(/\/ma-journee$/);
}
