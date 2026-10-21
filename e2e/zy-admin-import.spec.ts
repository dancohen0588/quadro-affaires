import { expect, test } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Administration légère et import de reprise (session 5.2, scénario n° 10). Joué avant zz-horloge et après
 * les autres parcours : il importe des affaires et réassigne celles d'une conceptrice.
 */
test.describe.configure({ mode: "serial" });

test("paramètres : un seuil modifié est enregistré (EF-102)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/admin?onglet=parametres");
  const seuil = page.getByLabel("RG-27 Inactivité");
  await expect(seuil).toHaveValue("10");
  await seuil.fill("12");
  await page.getByRole("button", { name: "Enregistrer les seuils" }).click();
  await expect(page.getByText(/Seuils enregistrés/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("RG-27 Inactivité")).toHaveValue("12");
  await page.getByLabel("RG-27 Inactivité").fill("10");
  await page.getByRole("button", { name: "Enregistrer les seuils" }).click();
  await expect(page.getByText(/Seuils enregistrés/)).toBeVisible();

  await page.getByRole("link", { name: "Modèle de process" }).click();
  await expect(page.getByText("2026 v1").first()).toBeVisible();
  await expect(page.getByText("Passage de commande AGEM")).toBeVisible();
});

test("import de reprise : essai, import, réimport refusé (section 13.1)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/admin?onglet=import");
  await page.getByLabel(/Fichier CSV/).setInputFiles("docs/import/affaires-exemple.csv");
  await page.getByRole("button", { name: "Lancer l'essai" }).click();
  await expect(page.getByRole("heading", { name: "Essai : 8 lignes prêtes sur 8" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Importer" }).click();
  await expect(page.getByRole("heading", { name: "Import : 8 lignes importées sur 8" })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel(/Fichier CSV/).setInputFiles("docs/import/affaires-exemple.csv");
  await page.getByRole("button", { name: "Lancer l'essai" }).click();
  await expect(page.getByRole("heading", { name: "Essai : 0 ligne prête sur 8, 8 rejetées" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Déjà présente : FABRE CUISINE · cuisine dans AIX/)).toBeVisible();

  await page.goto("/affaires?q=FABRE CUISINE");
  await page.getByRole("link", { name: "FABRE Luc · Cuisine" }).click();
  await expect(page.getByTestId("entete-affaire")).toContainText("Passage de commande AGEM");
  await expect(page.getByTestId("marge-estimee")).toBeVisible();
});

test("utilisateurs : désactivation avec réassignation, puis réactivation (EF-100)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Désactiver Lisa-Marie" }).click();
  const fenetre = page.getByRole("dialog");
  await expect(fenetre).toContainText("affaire(s) en cours");
  await fenetre.getByLabel("Confier à").selectOption({ label: "Alexia" });
  await fenetre.getByRole("button", { name: "Désactiver", exact: true }).click();
  await expect(fenetre).toBeHidden();
  const ligne = page.getByRole("row", { name: /Lisa-Marie/ });
  await expect(ligne).toContainText("Désactivé");
  await expect(ligne.getByRole("cell").nth(3)).toHaveText("0");
  await ligne.getByRole("button", { name: "Réactiver" }).click();
  await expect(ligne).toContainText("Actif");
});

test("l'administration est réservée aux gérants", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  expect((await page.goto("/admin"))?.status()).toBe(404);
});
