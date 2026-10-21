import { expect, test, type Locator, type Page } from "@playwright/test";
import { ajouterJours, semaineIso } from "../src/lib/rules/calendrier";
import { seConnecterEn } from "./aide";

/**
 * Répétition du scénario de démonstration (section 15.5, session 5.3), de bout en bout et dans l'ordre :
 * Manon (1 à 4), Jean et le débit AGEM (5), Valentin (6), Benjamin (7), Jean (8 à 10), puis l'affichage
 * des écrans principaux à 1280 et 1024 px. À lancer après `pnpm seed:demo` (projet Playwright « demo »,
 * `pnpm e2e:demo`) ; les dates sont calculées depuis le jour du lancement, comme le jeu de démo.
 */
test.describe.configure({ mode: "serial" });

const CLIENT = "VALBONNE Ambre";
const jour = (n = 0) => ajouterJours(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()), n);
const champSemaine = (d: string) => semaineIso(d).replace("-S", "-W");
const entete = (page: Page) => page.getByTestId("entete-affaire");
const blocVente = (page: Page): Locator => page.getByRole("region", { name: "Vente et règlements" });

async function valider(page: Page, issue: string, suivante: string, date?: string) {
  await page.getByRole("button", { name: "Valider l'étape" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByRole("radio", { name: new RegExp(`^${issue.replace(/[()]/g, "\\$&")}`) }).check();
  if (date) await fenetre.getByLabel(/Date de la nouvelle présentation|Date de la relance/).fill(date);
  await fenetre.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(fenetre.getByRole("heading", { name: "Valider l'étape" })).toBeHidden();
  if (await fenetre.getByRole("heading", { name: "Étape validée" }).isVisible()) await fenetre.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(fenetre).toBeHidden();
  await expect(entete(page)).toContainText(suivante);
}

async function ouvrirFiche(page: Page, libelle: string) {
  await page.goto(`/affaires?q=${encodeURIComponent(libelle.split(" ")[0])}`);
  await page.getByRole("link", { name: libelle }).click();
  await expect(entete(page)).toContainText(libelle);
}

async function changerDePersonnage(page: Page, de: string, vers: string) {
  await page.getByRole("button", { name: new RegExp(`Menu de ${de}`) }).click();
  await page.getByRole("menuitem", { name: new RegExp(vers) }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Menu de ${vers}`) })).toBeVisible();
}

test("1. Manon : sa journée, ses relances, ses jauges R2 et R3", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) \d{1,2} \S+$/);
  const taches = page.getByRole("region", { name: "Tâches" });
  await expect(taches.getByText("Aujourd'hui").first()).toBeVisible();
  await expect(taches.getByText(/^Retard \d+ j$/).first()).toBeVisible();
  await expect(page.getByRole("region", { name: /Relances client/ })).toContainText("Rappeler");
  await expect(page.getByRole("meter", { name: "R2 aujourd'hui" })).toBeVisible();
  await expect(page.getByRole("meter", { name: "R3 cette semaine" })).toHaveAttribute("aria-valuemax", "4");
});

test("2. Manon : contact CNQ au R0, puis deux affaires cuisine et dressing", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  const contact = page.getByRole("dialog");
  await contact.getByLabel("Nom", { exact: true }).fill("Valbonne");
  await contact.getByLabel("Prénom").fill("Ambre");
  await contact.getByLabel(/CNQ/).check();
  await contact.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(CLIENT);
  await expect(page.getByRole("region", { name: "Coordonnées" })).toContainText("CNQ");

  await page.getByRole("button", { name: "Créer des affaires" }).click();
  const creation = page.getByRole("dialog");
  await creation.getByLabel("Cuisine").check();
  await creation.getByLabel("Dressing").check();
  await creation.getByRole("button", { name: "Créer les 2 affaires" }).click();
  await expect(creation).toBeHidden();
  await expect(page.getByRole("region", { name: "Affaires" }).getByRole("listitem")).toHaveCount(2);
});

test("3. Manon : R3 sans vente puis R3.2, et vente des deux affaires en une seule (40 / 50 / 10)", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  for (const projet of ["Dressing", "Cuisine"]) {
    await ouvrirFiche(page, `${CLIENT} · ${projet}`);
    await valider(page, "R2 pris", "Approfondissement à domicile");
    await valider(page, "Passer en conception", "02 Conception · Conception");
    await valider(page, "Prêt pour la présentation", "Préparation de la présentation");
    await valider(page, "Présentation prête", "03 Vente · Présentation");
  }
  // Pas de vente à la première présentation : nouvelle présentation dans quatre jours (R3.2).
  await valider(page, "Nouvelle présentation (R3.n)", "Présentation", jour(4));
  await expect(page.getByText("R3.2").first()).toBeVisible();

  await blocVente(page).getByRole("button", { name: "Créer la vente" }).click();
  const vente = page.getByRole("dialog");
  await vente.getByLabel(`${CLIENT} · Dressing`).check();
  await vente.getByLabel("Montant HT (€)").fill("14 500");
  await vente.getByLabel("Montant TTC (€)").fill("17 400");
  await expect(vente.getByLabel("Montant 1")).toHaveValue("6960,00");
  await expect(vente.getByLabel("Montant 2")).toHaveValue("8700,00");
  await expect(vente.getByLabel("Montant 3")).toHaveValue("1740,00");
  await vente.getByLabel("Référence du devis Gesteos").fill("D20261021#4800");
  await vente.getByLabel("Livraison souhaitée").fill(champSemaine(jour(35)));
  await vente.getByRole("button", { name: "Enregistrer la vente" }).click();
  await expect(vente.getByRole("heading", { name: "Créer la vente" })).toBeHidden();
  if (await vente.getByRole("heading", { name: "Vente enregistrée" }).isVisible()) await vente.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(entete(page)).toContainText("03 Vente · Règlement acompte 1");
  await expect(blocVente(page)).toContainText(`${CLIENT} · Cuisine + ${CLIENT} · Dressing`);
  await expect(blocVente(page).locator("tr[data-echeance]")).toHaveCount(3);
});

test("4. Manon : commande AGEM refusée sans acompte 1, puis débloquée", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  await ouvrirFiche(page, `${CLIENT} · Cuisine`);
  await valider(page, "Acompte 1 reçu", "Préparation au passage de commande");
  await valider(page, "Prêt à commander", "Passage de commande AGEM");
  await page.getByRole("button", { name: "Valider l'étape" }).click();
  await expect(page.getByRole("dialog")).toContainText("Étape bloquée.");
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();

  await blocVente(page).locator("tr[data-echeance=acompte_1]").getByRole("button", { name: /Saisir/ }).click();
  const reception = page.getByRole("dialog");
  await reception.getByLabel("Mode").selectOption("cheque");
  await reception.getByRole("button", { name: "Enregistrer" }).click();
  await expect(reception).toBeHidden();
  await expect(blocVente(page).locator("tr[data-echeance=acompte_1]")).toContainText("Reçu");
  await expect(page.locator("[data-etape-ouverte=COMMANDE_AGEM]")).not.toContainText("attend l'acompte 1");
});

test("5. Jean : dépôt du débit AGEM, champs lus, fichier rangé, marge estimée", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await ouvrirFiche(page, "SAS VISIOLAB · Bureau");
  await page.getByRole("button", { name: "Déposer" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("Document attendu").selectOption({ label: "Débit de commande AGEM" });
  await fenetre.getByLabel("Fichier").setInputFiles("docs/sources/debit-agem-exemple-anonymise.docx");
  await fenetre.getByRole("button", { name: "Déposer", exact: true }).click();
  await expect(fenetre.getByRole("heading", { name: "Lecture du débit AGEM" })).toBeVisible({ timeout: 15_000 });
  await expect(fenetre.getByLabel("Prix d'achat HT (€)")).toHaveValue("3102,72");
  await fenetre.getByRole("button", { name: "Enregistrer dans la commande" }).click();
  await fenetre.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.getByTestId("marge-estimee")).toContainText("58,4 %");
  await page.getByRole("link", { name: "Ouvrir le dossier PCloud" }).click();
  await expect(page.getByRole("link", { name: "debit-agem-exemple-anonymise.docx" })).toBeVisible();
});

test("6. Valentin : la demande de planning arrive, il confirme ; Manon le voit sur la fiche", async ({ page }) => {
  await seConnecterEn(page, "Valentin");
  await page.goto("/planning");
  const demande = page.getByRole("region", { name: "Demandes en attente" }).getByRole("listitem").filter({ hasText: CLIENT });
  await demande.getByRole("button", { name: "Répondre" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("Date de pose").fill(jour(38));
  await fenetre.getByRole("button", { name: "Confirmer" }).click();
  await expect(fenetre).toBeHidden();
  await expect(page.getByRole("region", { name: "Demandes en attente" })).not.toContainText(CLIENT);

  await changerDePersonnage(page, "Valentin", "Manon");
  await ouvrirFiche(page, `${CLIENT} · Cuisine`);
  await expect(blocVente(page)).toContainText("Confirmé");
});

test("7. Benjamin : la file des BPA à donner, avec un BPA en retard", async ({ page }) => {
  await seConnecterEn(page, "Benjamin");
  const file = page.getByRole("region", { name: /BPA à donner/ });
  await expect(file.getByRole("listitem").first()).toBeVisible();
  await expect(file.getByText(/^En retard · depuis le/).first()).toBeVisible();
});

test("8. Jean : horloge +3 jours, l'acompte 2 non reçu remonte, le digest est dans la boîte d'envoi", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  const acomptes2 = async () => {
    await page.goto("/pilotage");
    return page.getByRole("region", { name: /^Alertes/ }).getByText(/Acompte 2 non reçu/).count();
  };
  const avant = await acomptes2();
  await page.goto("/horloge");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "+1 jour", exact: true }).click();
    await expect(page.getByText(/nuits? rejouées?|Aucune nuit franchie/)).toBeVisible({ timeout: 60_000 });
  }
  expect(await acomptes2()).toBeGreaterThan(avant);
  await page.goto("/boite-envoi?type=digest_quotidien");
  await expect(page.getByRole("link", { name: /Votre journée du/ }).first()).toBeVisible();
});

test("9. Jean : Pilotage et Point du mardi", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/pilotage");
  for (const carte of ["Affaires en cours", "CA signé", "Transformation R3 → vente", "Affaires en retard", "Flux entrant", "Potentiel en conception et vente"]) {
    await expect(page.getByRole("region", { name: new RegExp(carte) }).first()).toBeVisible();
  }
  await page.getByRole("link", { name: "Point du mardi" }).click();
  for (const magasin of ["Aix La Pioline", "Marseille La Valentine", "La Ciotat"]) {
    await expect(page.getByRole("region", { name: magasin })).toContainText("Semaine passée");
  }
});

test("10. Jean : seuils, utilisateurs, version de process ; puis retour à l'heure réelle", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/admin?onglet=parametres");
  await expect(page.getByLabel("RG-27 Inactivité")).toHaveValue("10");
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await expect(page.getByRole("row", { name: /Manon/ })).toContainText("Conceptrice");
  await page.getByRole("link", { name: "Modèle de process" }).click();
  await expect(page.getByText("2026 v1").first()).toBeVisible();

  await page.goto("/horloge");
  await page.getByRole("button", { name: "Revenir à aujourd'hui" }).click();
  await expect(page.getByText("Aucune nuit franchie")).toBeVisible();
});

test("affichage à 1280 et 1024 px : aucun défilement horizontal de la page", async ({ page }) => {
  const ecrans: [string, string][] = [
    ["Manon", "/ma-journee"], ["Manon", "/affaires"], ["Manon", "/pipeline"], ["Valentin", "/planning"], ["Jean", "/reglements"],
    ["Jean", "/pilotage"], ["Jean", "/boite-envoi"], ["Jean", "/admin"], ["Jean", "/admin?onglet=parametres"],
  ];
  let connecte = "";
  for (const [qui, chemin] of ecrans) {
    if (qui !== connecte) { await page.context().clearCookies(); await page.setViewportSize({ width: 1280, height: 800 }); await seConnecterEn(page, qui); connecte = qui; }
    for (const largeur of [1280, 1024]) {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.goto(chemin);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      const debord = await page.evaluate(() => {
        const main = document.getElementById("contenu");
        return Math.max(document.documentElement.scrollWidth - window.innerWidth, main ? main.scrollWidth - main.clientWidth : 0);
      });
      expect(debord, `${chemin} à ${largeur} px`).toBeLessThanOrEqual(0);
    }
  }
  // Fiche affaire, la plus dense.
  await page.setViewportSize({ width: 1024, height: 800 });
  await ouvrirFiche(page, "SAS VISIOLAB · Bureau");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
