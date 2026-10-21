import { expect, test, type Locator, type Page } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Fiche affaire et moteur de process (session 2.2, EF-30 à EF-41, RG-01, RG-06).
 * Les parcours modifient le jeu de démo : ils supposent une base tout juste remise par `pnpm seed:demo`.
 */

const entete = (page: Page) => page.getByTestId("entete-affaire");

/** Ouvre la fiche d'une affaire du magasin à l'étape donnée (pastille « 01 · Découverte »). */
async function ouvrirAffaireA(page: Page, etape: string) {
  await page.goto("/affaires?toutes");
  const ligne = page.getByRole("row").filter({ hasText: etape }).first();
  await ligne.getByRole("link").click();
  await expect(page).toHaveURL(/\/affaires\/[0-9a-f-]{36}$/);
}

/**
 * Valide l'étape ouverte avec l'issue donnée, ferme le récapitulatif des tâches annulées s'il s'affiche,
 * puis attend que l'en-tête affiche l'étape suivante.
 */
async function valider(page: Page, issue: string, suivante: string, completer?: (fenetre: Locator) => Promise<void>) {
  await page.getByRole("button", { name: "Valider l'étape" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByRole("radio", { name: new RegExp(`^${issue}`) }).check();
  await completer?.(fenetre);
  await envoyer(fenetre);
  await expect(entete(page)).toContainText(suivante);
}

/** Envoie la validation et ferme le récapitulatif des tâches annulées (RG-05) s'il s'affiche. */
async function envoyer(fenetre: Locator) {
  await fenetre.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(fenetre.getByRole("heading", { name: "Valider l'étape" })).toBeHidden();
  if (await fenetre.getByRole("heading", { name: "Étape validée" }).isVisible()) {
    await fenetre.getByRole("button", { name: "Fermer", exact: true }).click();
  }
  await expect(fenetre).toBeHidden();
}


test.describe.configure({ mode: "serial" });

test.describe("fiche affaire (session 2.2)", () => {
  test("Manon mène une affaire du R1 à la vente", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await ouvrirAffaireA(page, "01 · Découverte");
    await expect(entete(page)).toContainText("01 Accueil · Découverte");
    await expect(page.getByRole("heading", { name: "Process" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents attendus" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Intervenants" })).toBeVisible();

    await valider(page, "R2 pris", "02 Conception · Approfondissement à domicile");
    await valider(page, "Passer en conception", "02 Conception · Conception");
    await valider(page, "Prêt pour la présentation", "02 Conception · Préparation de la présentation");
    await valider(page, "Présentation prête", "03 Vente · Présentation");
    await valider(page, "Vente", "03 Vente · Vente");

    const historique = page.getByRole("region", { name: "Historique" });
    await expect(historique).toContainText("Présentation : Vente · Manon");
    await expect(historique).toContainText("Découverte : R2 pris · Manon");
    await expect(page.locator("[data-etape-ouverte=VENTE]")).toContainText("BDC");
  });

  test("une perte exige un motif de la liste (RG-06)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await ouvrirAffaireA(page, "03 · Présentation");
    await page.getByRole("button", { name: "Valider l'étape" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByRole("radio", { name: /^Affaire perdue/ }).check();
    await fenetre.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(fenetre).toContainText("Choisissez un motif.");
    await fenetre.getByLabel("Motif (RG-06)").selectOption("prix");
    await envoyer(fenetre);
    await expect(entete(page)).toContainText("Perdue · prix");
  });

  test("la commande AGEM reste bloquée tant que l'acompte 1 n'est pas reçu (RG-01)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await ouvrirAffaireA(page, "03 · Règlement acompte 1");
    await valider(page, "Acompte 1 reçu", "04 Commande · Préparation au passage de commande");
    await valider(page, "Prêt à commander", "04 Commande · Passage de commande AGEM");
    await expect(page.locator("[data-etape-ouverte=COMMANDE_AGEM]")).toContainText("attend l'acompte 1");

    await page.getByRole("button", { name: "Valider l'étape" }).click();
    const fenetre = page.getByRole("dialog");
    await expect(fenetre).toContainText("Étape bloquée.");
    await expect(fenetre.getByRole("button", { name: "Valider", exact: true })).toBeDisabled();
  });

  test("ajoute un RDV à l'affaire puis le marque fait (EF-34)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await ouvrirAffaireA(page, "02 · Approfondissement à domicile");
    const rdv = page.getByRole("region", { name: "RDV" });
    await rdv.getByRole("button", { name: "Ajouter" }).click();
    await rdv.getByLabel("Type").selectOption("point_technique");
    await rdv.getByLabel("Heure").fill("16:30");
    await rdv.getByLabel("Notes").fill("Point avec Benjamin sur le relevé");
    await rdv.getByRole("button", { name: "Enregistrer le RDV" }).click();
    const ligne = rdv.getByRole("listitem").filter({ hasText: "Point technique" });
    await expect(ligne).toContainText("16 h 30");
    await ligne.getByRole("button", { name: "Marquer fait" }).click();
    await expect(ligne).toContainText("Fait");
    await expect(page.getByRole("region", { name: "Historique" })).toContainText("RDV point technique fait");
  });
});
