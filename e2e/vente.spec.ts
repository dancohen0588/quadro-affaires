import { expect, test, type Locator, type Page } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Vente, règlements, planning et commandes (session 3.2) : le parcours Manon → Valentin → Benjamin → Jean
 * sur une même vente de deux affaires (scénarios 3, 4, 6 et 7 de la section 15.5).
 * Base tout juste remise par `pnpm seed:demo`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT = "BRIANCON Odile";
const entete = (page: Page) => page.getByTestId("entete-affaire");

async function valider(page: Page, issue: string, suivante: string) {
  await page.getByRole("button", { name: "Valider l'étape" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByRole("radio", { name: new RegExp(`^${issue}`) }).check();
  await fenetre.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(fenetre.getByRole("heading", { name: "Valider l'étape" })).toBeHidden();
  if (await fenetre.getByRole("heading", { name: "Étape validée" }).isVisible()) await fenetre.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(fenetre).toBeHidden();
  await expect(entete(page)).toContainText(suivante);
}

async function jusquauR3(page: Page) {
  await valider(page, "R2 pris", "Approfondissement à domicile");
  await valider(page, "Passer en conception", "02 Conception · Conception");
  await valider(page, "Prêt pour la présentation", "Préparation de la présentation");
  await valider(page, "Présentation prête", "03 Vente · Présentation");
}

async function ouvrirFiche(page: Page, libelle: string) {
  await page.goto(`/affaires?q=${encodeURIComponent(CLIENT.split(" ")[0])}`);
  await page.getByRole("link", { name: libelle }).click();
  await expect(entete(page)).toContainText(libelle);
}

const blocVente = (page: Page): Locator => page.getByRole("region", { name: "Vente et règlements" });

test.describe("vente, règlements, planning, commandes (session 3.2)", () => {
  test("Manon vend deux affaires en une vente, échéancier 40 / 50 / 10 (scénario 3, EF-50, EF-51)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    // Un client, deux affaires en découverte, menées jusqu'à la présentation.
    await page.getByRole("button", { name: "Nouveau contact" }).click();
    const contact = page.getByRole("dialog");
    await contact.getByLabel("Nom", { exact: true }).fill("Briancon");
    await contact.getByLabel("Prénom").fill("Odile");
    await contact.getByLabel("Téléphone").fill("06 39 98 99 01");
    await contact.getByRole("button", { name: "Enregistrer le contact" }).click();
    await page.getByRole("button", { name: "Créer des affaires" }).click();
    const creation = page.getByRole("dialog");
    await creation.getByLabel("Cuisine").check();
    await creation.getByLabel("Dressing").check();
    await creation.getByRole("button", { name: "Créer les 2 affaires" }).click();
    await expect(page.getByRole("region", { name: "Affaires" }).getByRole("listitem")).toHaveCount(2);

    await ouvrirFiche(page, `${CLIENT} · Dressing`);
    await jusquauR3(page);
    await ouvrirFiche(page, `${CLIENT} · Cuisine`);
    await jusquauR3(page);

    // L'étape Vente ne se valide pas seule (RG-08).
    await blocVente(page).getByRole("button", { name: "Créer la vente" }).click();
    const vente = page.getByRole("dialog");
    await vente.getByLabel(`${CLIENT} · Dressing`).check();
    await vente.getByLabel("Montant HT (€)").fill("10 000");
    await vente.getByLabel("Montant TTC (€)").fill("12 000");
    await expect(vente.getByLabel("Montant 1")).toHaveValue("4800,00");
    await expect(vente.getByLabel("Montant 2")).toHaveValue("6000,00");
    await expect(vente.getByLabel("Montant 3")).toHaveValue("1200,00");
    await expect(vente.getByText("= TTC")).toBeVisible();
    await vente.getByLabel("Référence du devis Gesteos").fill("D20261021#4700");
    await vente.getByLabel("Livraison souhaitée").fill("2026-W50");
    await vente.getByRole("button", { name: "Enregistrer la vente" }).click();
    await expect(vente.getByRole("heading", { name: "Créer la vente" })).toBeHidden();
    if (await vente.getByRole("heading", { name: "Vente enregistrée" }).isVisible()) await vente.getByRole("button", { name: "Fermer", exact: true }).click();

    await expect(entete(page)).toContainText("03 Vente · Règlement acompte 1");
    await expect(blocVente(page)).toContainText(`${CLIENT} · Cuisine + ${CLIENT} · Dressing`);
    await expect(blocVente(page).locator("tr[data-echeance]")).toHaveCount(3);
    await expect(blocVente(page)).toContainText("Demandé");
  });

  test("la commande AGEM se débloque en saisissant l'acompte 1 (scénario 4, RG-01, EF-52)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await ouvrirFiche(page, `${CLIENT} · Cuisine`);
    await valider(page, "Acompte 1 reçu", "Préparation au passage de commande");
    await valider(page, "Prêt à commander", "Passage de commande AGEM");
    await page.getByRole("button", { name: "Valider l'étape" }).click();
    await expect(page.getByRole("dialog")).toContainText("Étape bloquée.");
    await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();

    await blocVente(page).locator("tr[data-echeance=acompte_1]").getByRole("button", { name: /Saisir/ }).click();
    const reception = page.getByRole("dialog");
    await reception.getByLabel("Mode").selectOption("cb");
    await reception.getByRole("button", { name: "Enregistrer" }).click();
    await expect(reception).toBeHidden();
    await expect(blocVente(page).locator("tr[data-echeance=acompte_1]")).toContainText("Reçu");
    await expect(page.locator("[data-etape-ouverte=COMMANDE_AGEM]")).not.toContainText("attend l'acompte 1");
    await valider(page, "Commande envoyée", "Réception ARC");
  });

  test("Valentin confirme le planning ; Manon le voit sur la fiche (scénario 6, EF-61, EF-62, RG-12)", async ({ page }) => {
    await seConnecterEn(page, "Valentin");
    await expect(page.getByRole("link", { name: /Planning/ })).toContainText(/\d/);
    await page.goto("/planning");
    const demande = page.getByRole("region", { name: "Demandes en attente" }).getByRole("listitem").filter({ hasText: CLIENT });
    await demande.getByRole("button", { name: "Répondre" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Date de pose").fill("2026-12-10");
    await fenetre.getByRole("button", { name: "Confirmer" }).click();
    await expect(fenetre).toBeHidden();
    await expect(page.getByRole("region", { name: "Demandes en attente" })).not.toContainText(CLIENT);
    await expect(page.getByRole("region", { name: "Semaine S50" })).toContainText(CLIENT);

    await page.getByRole("button", { name: /Menu de Valentin/ }).click();
    await page.getByRole("menuitem", { name: /Manon/ }).click();
    await expect(page.getByRole("button", { name: /Menu de Manon/ })).toBeVisible();
    await ouvrirFiche(page, `${CLIENT} · Cuisine`);
    await expect(blocVente(page)).toContainText("Confirmé");
    await expect(blocVente(page).locator("tr[data-echeance=acompte_2]")).toContainText("7 déc.");
    await expect(blocVente(page).locator("tr[data-echeance=solde]")).toContainText("10 déc.");
  });

  test("Manon saisit la confirmation AGEM ; Benjamin donne le BPA depuis sa file (scénario 7, EF-71, EF-73)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await ouvrirFiche(page, `${CLIENT} · Cuisine`);
    const commandes = page.getByRole("region", { name: "Commandes" });
    await commandes.getByRole("button", { name: "Commande AGEM" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Référence de commande").fill("C20261021#801");
    await fenetre.getByLabel("Envoyée le").fill("2026-10-21");
    await fenetre.getByLabel("ARC reçu le").fill("2026-10-21");
    await fenetre.getByLabel("Confirmation reçue le").fill("2026-10-21");
    await fenetre.getByLabel("Version du BPA").fill("v1.01");
    await expect(fenetre.getByLabel("BPA donné le (gérant)")).toBeDisabled();
    await fenetre.getByRole("button", { name: "Enregistrer" }).click();
    await expect(fenetre).toBeHidden();
    await expect(commandes.locator("li[data-commande=AGEM]")).toContainText("BPA à donner");

    await page.getByRole("button", { name: /Menu de Manon/ }).click();
    await page.getByRole("menuitem", { name: /Benjamin/ }).click();
    await expect(page.getByRole("button", { name: /Menu de Benjamin/ })).toBeVisible();
    await page.goto("/ma-journee");
    const file = page.getByRole("region", { name: /BPA à donner/ });
    await file.getByRole("link", { name: `${CLIENT} · Cuisine` }).click();
    await page.getByRole("region", { name: "Commandes" }).getByRole("button", { name: "Compléter" }).click();
    await page.getByRole("dialog").getByLabel("BPA donné le").fill("2026-10-21");
    await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("region", { name: "Commandes" }).locator("li[data-commande=AGEM]")).toContainText("BPA donné");
  });

  test("Jean suit les règlements et saisit une réception (EF-53)", async ({ page }) => {
    await seConnecterEn(page, "Jean");
    await page.goto("/reglements");
    const retard = page.getByRole("region", { name: "En retard" });
    await expect(retard.getByRole("listitem").first()).toBeVisible();
    const avant = await page.getByRole("region", { name: "Reçus cette semaine" }).getByRole("listitem").count();
    await retard.getByRole("listitem").first().getByRole("button", { name: /Saisir/ }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Mode").selectOption("virement");
    await fenetre.getByRole("button", { name: "Enregistrer" }).click();
    await expect(fenetre).toBeHidden();
    await expect(page.getByRole("region", { name: "Reçus cette semaine" }).getByRole("listitem")).toHaveCount(avant + 1);
  });
});
