import { expect, test, type Page } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Quotidien des conceptrices et des gérants (session 3.1) : Ma journée (EF-10 à EF-18), contacts et
 * affaires (EF-20 à EF-25). Scénarios 1, 2 et 7 de la section 15.5. Base tout juste remise par `pnpm seed:demo`.
 */
test.describe.configure({ mode: "serial" });

const aFaire = (page: Page) => page.getByRole("region", { name: "Tâches" });

/** Jour suivant la date minimale d'un champ date (la date du jour vient de l'horloge de l'application). */
async function dansNJours(page: Page, selecteur: string, n: number): Promise<string> {
  const min = await page.locator(selecteur).getAttribute("min");
  const d = new Date(`${min}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

test.describe("quotidien (session 3.1)", () => {
  test("la journée de Manon : tâches, relances, règles de la semaine (scénario 1)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) \d{1,2} \S+$/);
    await expect(page.getByRole("link", { name: /Ma journée/ })).toContainText(/\d+/);
    await expect(aFaire(page).getByText(/^Retard \d+ j$/).first()).toBeVisible();
    await expect(aFaire(page).getByText("Aujourd'hui").first()).toBeVisible();
    await expect(page.getByRole("region", { name: /Relances client/ })).toContainText("Rappeler");
    await expect(page.getByRole("meter", { name: "R2 aujourd'hui" })).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByRole("meter", { name: "R3 cette semaine" })).toHaveAttribute("aria-valuemax", "4");
    await expect(page.getByRole("region", { name: "Règlements à suivre" })).toBeVisible();
  });

  test("cocher une tâche se rattrape pendant 10 secondes (EF-11), une tâche se reporte (EF-12)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    const premiere = aFaire(page).locator("li[data-tache]").first();
    const titre = (await premiere.locator("p").first().textContent())!;
    await premiere.getByRole("checkbox").check();
    await premiere.getByRole("button", { name: "Annuler" }).click();
    await expect(premiere.getByRole("checkbox")).not.toBeChecked();

    await page.getByRole("button", { name: `Reporter : ${titre}` }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Nouvelle date").fill(await dansNJours(page, "input[type=date]", 3));
    await fenetre.getByLabel("Motif (facultatif)").fill("Client absent");
    await fenetre.getByRole("button", { name: "Reporter", exact: true }).click();
    await expect(fenetre).toBeHidden();
    await expect(aFaire(page).getByText(titre, { exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: /À venir/ }).click();
    await expect(aFaire(page).getByText(titre, { exact: true })).toBeVisible();
  });

  test("une tâche libre s'ajoute à la journée (EF-13)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await page.getByRole("button", { name: "Tâche" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Titre").fill("Préparer les échantillons de façades");
    await fenetre.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(fenetre).toBeHidden();
    await expect(aFaire(page).getByRole("region", { name: "Sans affaire" })).toContainText("Préparer les échantillons de façades");
  });

  test("contact CNQ au R0, puis deux affaires cuisine et dressing (scénario 2, EF-20, EF-23)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await page.getByRole("button", { name: "Nouveau contact" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Nom", { exact: true }).fill("Vallauris");
    await fenetre.getByLabel("Prénom").fill("Lina");
    await fenetre.getByLabel(/CNQ/).check();
    await expect(fenetre.getByLabel("Téléphone")).toBeDisabled();
    await fenetre.getByRole("button", { name: "Enregistrer le contact" }).click();

    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("VALLAURIS Lina");
    await expect(page.getByRole("region", { name: "Coordonnées" })).toContainText("CNQ");

    await page.getByRole("button", { name: "Créer des affaires" }).click();
    const creation = page.getByRole("dialog");
    await creation.getByLabel("Cuisine").check();
    await creation.getByLabel("Dressing").check();
    await expect(creation.getByRole("list", { name: "Affaires qui seront créées" })).toContainText("VALLAURIS Lina · Dressing");
    await creation.getByRole("button", { name: "Créer les 2 affaires" }).click();
    await expect(creation).toBeHidden();

    const affaires = page.getByRole("region", { name: "Affaires" });
    await expect(affaires.getByRole("listitem")).toHaveCount(2);
    await expect(affaires).toContainText("01 · Découverte");
    await affaires.getByRole("link", { name: "VALLAURIS Lina · Cuisine" }).click();
    await expect(page.getByTestId("entete-affaire")).toContainText("01 Accueil · Découverte");
  });

  test("un client connu d'un autre magasin est proposé à la saisie (EF-21)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await page.getByRole("button", { name: "Nouveau contact" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Téléphone").fill("06 39 98 00 01");
    const suggestions = fenetre.getByRole("region", { name: "Clients existants" });
    await expect(suggestions).toContainText("Ce client existe peut-être déjà");
    await expect(suggestions.getByRole("listitem")).toHaveCount(1);
    await expect(suggestions.getByRole("button", { name: "Créer une affaire ici" })).toBeVisible();
  });

  test("une affaire se clôt avant la vente avec un motif (EF-25)", async ({ page }) => {
    await seConnecterEn(page, "Manon");
    await page.goto("/affaires?etape=R2");
    await page.getByRole("row").nth(1).getByRole("link").click();
    await page.getByRole("button", { name: "Clore" }).click();
    const fenetre = page.getByRole("dialog");
    await fenetre.getByLabel("Abandonnée").check();
    await fenetre.getByLabel("Motif (RG-06)").selectOption("projet abandonné");
    await fenetre.getByRole("button", { name: "Clore l'affaire" }).click();
    await expect(fenetre).toBeHidden();
    await expect(page.getByTestId("entete-affaire")).toContainText("Abandonnée · projet abandonné");
  });

  test("Benjamin voit la file des BPA à donner (EF-17, scénario 7)", async ({ page }) => {
    await seConnecterEn(page, "Benjamin");
    const file = page.getByRole("region", { name: /BPA à donner/ });
    await expect(file.getByRole("listitem").first()).toBeVisible();
    await expect(page.getByRole("region", { name: /Plannings à confirmer/ })).toHaveCount(0);
  });

  test("Mes affaires filtre par étape et cherche un client (EF-24, recherche globale)", async ({ page }) => {
    await seConnecterEn(page, "Jean");
    await page.goto("/affaires");
    await page.getByLabel("Étape").selectOption("BPA");
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page).toHaveURL(/etape=BPA/);
    const lignes = page.getByRole("row");
    await expect(lignes.nth(1)).toContainText("Confirmation AGEM et BPA");
    await page.getByLabel(/Rechercher un client/).fill("VALLAURIS");
    await page.getByLabel(/Rechercher un client/).press("Enter");
    await expect(page.getByRole("region", { name: "Clients trouvés" })).toContainText("VALLAURIS Lina");
  });
});
