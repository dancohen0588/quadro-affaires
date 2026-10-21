import { expect, test } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Administration légère et import de reprise (sessions 5.2 et 5.4, scénario n° 10). Joué avant zz-horloge et après
 * les autres parcours : il importe des affaires, réassigne celles d'une conceptrice et ajoute un utilisateur.
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

test("ajout d'un utilisateur : contrôles, puis connexion aussitôt comme personnage (EF-100)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Ajouter un utilisateur" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("Prénom").fill("Nina");
  await fenetre.getByLabel("Nom", { exact: true }).fill("Essai");
  await fenetre.getByLabel("Adresse").fill("nina.essai@exemple.com");
  await fenetre.getByLabel("La Ciotat").check();
  await fenetre.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(fenetre.getByText(/Adresse du domaine magasin-quadro\.fr/)).toBeVisible();

  await fenetre.getByLabel("Adresse").fill("manon@demo.quadro-affaires.test");
  await fenetre.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(fenetre.getByText("Cette adresse est déjà utilisée par un autre utilisateur.")).toBeVisible();

  await fenetre.getByLabel("Adresse").fill("nina.essai@demo.quadro-affaires.test");
  await fenetre.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(fenetre.getByText("Utilisateur ajouté : Nina apparaît maintenant dans « Choisir un personnage ».")).toBeVisible();
  await fenetre.getByRole("button", { name: "Fermer", exact: true }).click();
  const ligne = page.getByRole("row", { name: /Nina Essai/ });
  await expect(ligne).toContainText("Conceptrice");
  await expect(ligne).toContainText("CIO");
  await expect(ligne).toContainText("Actif");

  await page.context().clearCookies();
  await seConnecterEn(page, "Nina");
  await expect(page.getByText(/Nina/).first()).toBeVisible();
});

test("magasins et sociétés : consultation et modification, codes inchangés (EF-101)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/admin?onglet=magasins");
  const ligne = page.getByRole("region", { name: "Magasins", exact: true }).getByRole("row").filter({ hasText: "La Ciotat" });
  await expect(ligne).toContainText("JVB La Ciotat");

  await ligne.getByRole("button", { name: "Modifier La Ciotat" }).click();
  let fenetre = page.getByRole("dialog");
  await expect(fenetre).toContainText("il ne change pas");
  await fenetre.getByLabel("Téléphone").fill("appeler Jean");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre.getByText("Téléphone invalide.")).toBeVisible();
  await fenetre.getByLabel("Téléphone").fill("04 00 00 00 00");
  await fenetre.getByLabel("Adresse").fill("1 avenue Fictive, 13600 La Ciotat");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre).toBeHidden();
  await expect(ligne).toContainText("1 avenue Fictive, 13600 La Ciotat");
  await expect(ligne).toContainText("04 00 00 00 00");

  const societe = page.getByRole("region", { name: "Sociétés" }).getByRole("row").filter({ hasText: "JVB La Ciotat" });
  await societe.getByRole("button", { name: "Modifier JVB La Ciotat" }).click();
  fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("SIREN").fill("999 123 459");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre.getByText(/SIREN invalide/)).toBeVisible();
  await fenetre.getByLabel("SIREN").fill("999 123 458");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre).toBeHidden();
  await expect(societe).toContainText("999123458");

  // Remise en état : la base de démo est partagée.
  await ligne.getByRole("button", { name: "Modifier La Ciotat" }).click();
  fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("Téléphone").fill("");
  await fenetre.getByLabel("Adresse").fill("");
  await fenetre.getByRole("button", { name: "Enregistrer" }).click();
  await expect(fenetre).toBeHidden();
  await societe.getByRole("button", { name: "Modifier JVB La Ciotat" }).click();
  await page.getByRole("dialog").getByLabel("SIREN").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(ligne).not.toContainText("Fictive");
});

test("l'administration est réservée aux gérants", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  expect((await page.goto("/admin"))?.status()).toBe(404);
});
