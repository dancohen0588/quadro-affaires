import { expect, test, type Page } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * Horloge de démo, traitements de nuit et boîte d'envoi (session 4.2, scénario n° 8 de la section 15.5).
 * Dernier fichier joué (préfixe zz) : il avance l'horloge et crée tâches et mails ; il la remet à l'heure à la fin.
 */
test.describe.configure({ mode: "serial" });

async function avancer(page: Page, bouton: string) {
  await page.getByRole("button", { name: bouton, exact: true }).click();
  await expect(page.getByText(/nuits? rejouées?|Aucune nuit franchie/)).toBeVisible({ timeout: 60_000 });
}

const alertesAcompte2 = async (page: Page) => {
  await page.goto("/pilotage?periode=mois");
  return page.getByRole("region", { name: /^Alertes/ }).getByText(/Acompte 2 non reçu/).count();
};

test("+3 jours : les alertes suivent la date simulée et les digests arrivent dans la boîte d'envoi", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  const avant = await alertesAcompte2(page);

  await page.goto("/horloge");
  await expect(page.getByRole("heading", { level: 1, name: "Horloge de démo" })).toBeVisible();
  const depart = await page.getByTestId("date-simulee").textContent();
  for (let i = 0; i < 3; i++) await avancer(page, "+1 jour");
  await expect(page.getByTestId("date-simulee")).not.toHaveText(depart!);
  await expect(page.getByText("Décalage")).toBeVisible();
  await expect(page.getByTestId("bandeau-date-simulee")).toBeVisible();

  // Scénario 8 : l'acompte 2 qui passe en retard à J+3 remonte dans les alertes.
  expect(await alertesAcompte2(page)).toBeGreaterThan(avant);

  await page.goto("/boite-envoi?type=digest_quotidien");
  await expect(page.getByRole("heading", { level: 1, name: "Boîte d'envoi" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Votre journée du/ }).first()).toBeVisible();
  await expect(page.frameLocator("iframe").getByRole("link", { name: "Ouvrir Ma journée" })).toBeVisible();
});

test("Lundi 7 h : le digest du lundi est lisible ; retour à l'heure réelle", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await page.goto("/horloge");
  await avancer(page, "Lundi 7 h");
  await page.goto("/boite-envoi?type=digest_lundi");
  await page.getByRole("link", { name: /^Jean Farhat.*Semaine S\d{2}/ }).first().click();
  const apercu = page.frameLocator("iframe");
  await expect(apercu.getByRole("heading", { name: /Bonjour Jean, voici la semaine S\d{2}/ })).toBeVisible();
  await expect(apercu.getByText("La Ciotat")).toBeVisible();
  await expect(apercu.getByText(/Potentiel en conception et vente/).first()).toBeVisible();

  await page.goto("/horloge");
  await page.getByRole("button", { name: "Revenir à aujourd'hui" }).click();
  await expect(page.getByText("Aucune nuit franchie")).toBeVisible();
  await expect(page.getByTestId("bandeau-date-simulee")).toHaveCount(0);
  await expect(page.getByText("aucun", { exact: true })).toBeVisible();
});

test("l'horloge est réservée aux gérants ; une conceptrice ne lit que ses mails", async ({ page }) => {
  await seConnecterEn(page, "Manon");
  expect((await page.goto("/horloge"))?.status()).toBe(404);
  await page.goto("/boite-envoi");
  await expect(page.getByText("Les mails qui vous sont adressés")).toBeVisible();
  for (const lien of await page.getByRole("link", { name: /Votre journée|Semaine S/ }).all()) await expect(lien).toContainText("Manon");
});
