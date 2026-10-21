import { expect, test } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Indicateurs (session 4.1) : Pipeline (EF-80 à EF-82), Pilotage (EF-90 à EF-92), Point du mardi (EF-93).
 * Lecture seule : ces parcours ne modifient pas la base.
 */

test("Pipeline : six colonnes, filtres, vue liste et export CSV (EF-80 à EF-82)", async ({ page }) => {
  await seConnecterEn(page, "Clara");
  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible();
  for (const phase of ["01 Accueil", "02 Conception", "03 Vente", "04 Commande", "05 Livraison", "06 Clôture"]) {
    await expect(page.getByRole("region", { name: new RegExp(`^${phase}`) })).toBeVisible();
  }
  const cartes = page.getByRole("region", { name: /^01 Accueil/ }).getByRole("listitem");
  await expect(cartes.first()).toBeVisible();

  await page.getByLabel("Inactives seulement").check();
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/inactives=1/);
  await expect(page.getByText(/sans mouvement depuis plus de 10 jours/)).toBeVisible();

  await page.getByRole("link", { name: "Vue liste" }).click();
  await expect(page).toHaveURL(/vue=liste/);
  await expect(page.getByRole("columnheader", { name: "Prochain jalon" })).toBeVisible();

  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exporter en CSV" }).click()]);
  expect(telechargement.suggestedFilename()).toMatch(/^pipeline-\d{4}-\d{2}-\d{2}\.csv$/);
  const chemin = await telechargement.path();
  const contenu = (await import("node:fs")).readFileSync(chemin, "utf8");
  expect(contenu.split("\r\n")[0]).toContain("Affaire;Contremarque;Magasin;Concepteur");
});

test("Pilotage : indicateurs par période et alertes triées (EF-90 à EF-92)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/pilotage");
  await expect(page.getByRole("heading", { level: 1, name: "Pilotage" })).toBeVisible();
  for (const carte of ["Affaires en cours", "CA signé", "Transformation R3 → vente", "Affaires en retard"]) {
    await expect(page.getByRole("region", { name: new RegExp(carte) }).first()).toBeVisible();
  }
  const alertes = page.getByRole("region", { name: /^Alertes/ });
  await expect(alertes.getByText("ARC AGEM attendu depuis").first()).toBeVisible();
  await expect(alertes.getByText(/Acompte 1 non reçu/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Affaires en cours par phase" })).toContainText("04 Commande");

  await page.getByLabel("Période").selectOption("annee");
  await page.getByLabel("Magasin").selectOption({ label: "La Ciotat" });
  await page.getByRole("button", { name: "Afficher" }).click();
  await expect(page).toHaveURL(/periode=annee/);
  await expect(page.getByRole("region", { name: /CA signé · cette année/ })).toBeVisible();
  await expect(page.getByText(/^La Ciotat \d+$/)).toBeVisible();

  await alertes.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/affaires\/[0-9a-f-]{36}$/);
});

test("Point du mardi : grand format, une colonne par magasin (EF-93)", async ({ page }) => {
  await seConnecterEn(page, "Valentin");
  await page.goto("/pilotage");
  await page.getByRole("link", { name: "Point du mardi" }).click();
  await expect(page).toHaveURL(/\/point-du-mardi$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Semaine S\d{2}/ })).toBeVisible();
  for (const magasin of ["Aix La Pioline", "Marseille La Valentine", "La Ciotat"]) {
    const colonne = page.getByRole("region", { name: magasin });
    await expect(colonne).toContainText("Semaine passée");
    await expect(colonne).toContainText("R3 prévus");
    await expect(colonne).toContainText("Règlements attendus");
  }
});

test("Pilotage et Point du mardi sont réservés aux gérants", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  await expect(page.getByRole("link", { name: /^Pilotage/ })).toHaveCount(0);
  const reponse = await page.goto("/point-du-mardi");
  expect(reponse?.status()).toBe(404);
});
