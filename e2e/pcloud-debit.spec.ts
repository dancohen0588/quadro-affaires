import { expect, test, type Page } from "@playwright/test";
import { seConnecterEn } from "./aide";

/**
 * PCloud simulé et débit AGEM (session 5.1, scénario n° 5) : dépôt du débit d'exemple anonymisé sur l'affaire
 * préparée par le seed (SAS VISIOLAB, Jean, La Valentine), lecture des champs, validation, marge estimée,
 * fichier rangé dans le PCloud simulé. Base tout juste remise par `pnpm seed:demo`.
 */
test.describe.configure({ mode: "serial" });

const DEBIT = "docs/sources/debit-agem-exemple-anonymise.docx";

async function ouvrirAffaire(page: Page) {
  await page.goto("/affaires?q=VISIOLAB");
  await page.getByRole("link", { name: "SAS VISIOLAB · Bureau" }).click();
  await expect(page.getByTestId("entete-affaire")).toContainText("Passage de commande AGEM");
}

test("un format refusé ne range rien", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await ouvrirAffaire(page);
  await page.getByRole("button", { name: "Déposer" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("Document attendu").selectOption({ label: "Débit de commande AGEM" });
  await fenetre.getByLabel("Fichier").setInputFiles({ name: "debit.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await fenetre.getByRole("button", { name: "Déposer", exact: true }).click();
  await expect(fenetre.getByText("Format refusé : docx attendu.")).toBeVisible();
});

test("dépôt du débit AGEM : champs lus, validés, marge estimée, fichier rangé (scénario 5)", async ({ page }) => {
  await seConnecterEn(page, "Jean");
  await ouvrirAffaire(page);
  await expect(page.getByTestId("marge-estimee")).toContainText("au dépôt du débit AGEM");

  await page.getByRole("button", { name: "Déposer" }).click();
  const fenetre = page.getByRole("dialog");
  await fenetre.getByLabel("Document attendu").selectOption({ label: "Débit de commande AGEM" });
  await fenetre.getByLabel("Fichier").setInputFiles(DEBIT);
  await expect(fenetre.getByTestId("apercu-nom")).toHaveText("debit-agem-exemple-anonymise.docx");
  await expect(fenetre).toContainText("05 - Commande AGEM et autres fournisseurs/Commande AGEM");
  await fenetre.getByRole("button", { name: "Déposer", exact: true }).click();

  await expect(fenetre.getByRole("heading", { name: "Lecture du débit AGEM" })).toBeVisible({ timeout: 15_000 });
  await expect(fenetre).toContainText("D20260928#4538");
  await expect(fenetre).toContainText("SAS VISIOLAB Julien ROUSSEL");
  await expect(fenetre).not.toContainText("différente de celle de l'affaire");
  await expect(fenetre.getByLabel("N° de commande Gesteos")).toHaveValue("C20260929#848");
  await expect(fenetre.getByLabel("Semaine demandée")).toHaveValue("2026-W44");
  await expect(fenetre.getByLabel("Lieu de livraison")).toHaveValue("TRANSTOCK 66, Marseille 11");
  await expect(fenetre.getByLabel("Prix d'achat HT (€)")).toHaveValue("3102,72");
  await expect(fenetre.getByLabel("Points")).toHaveValue("4162,57");
  await fenetre.getByRole("button", { name: "Enregistrer dans la commande" }).click();
  await expect(fenetre.getByRole("heading", { name: "Document rangé" })).toBeVisible();
  await fenetre.getByRole("button", { name: "Fermer", exact: true }).click();

  // KPI-11 : 7 450 € HT − 3 102,72 € d'achats.
  await expect(page.getByTestId("marge-estimee")).toContainText(/4\s347\s€ HT · 58,4 %/);
  await expect(page.getByRole("region", { name: "Documents attendus" })).toContainText("debit-agem-exemple-anonymise.docx");

  await page.getByRole("link", { name: "PCloud (simulé)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /SAS VISIOLAB/ })).toBeVisible();
  const dossier = page.getByRole("region", { name: "VAL/SAS VISIOLAB - Bureau (Jean)" });
  await expect(dossier.getByText("Commande AGEM", { exact: true })).toBeVisible();
  await expect(dossier.getByRole("link", { name: "debit-agem-exemple-anonymise.docx" })).toBeVisible();
  await expect(dossier.getByText("12 - Photos Finales")).toBeVisible();
});
