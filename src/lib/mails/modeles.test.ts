import { describe, expect, it } from "vitest";
import { gabarit, mailBpaADonner, mailDemandePlanning, mailFactureRecap, mailPlanningRepondu } from "./modeles";

const lien = "https://exemple.test/affaires/1";

describe("mails de notification", () => {
  it("échappe le texte et met l'action en bouton", () => {
    const html = gabarit({ titre: "A <b>", intro: "x & y", lignes: [["Clé", "\"v\""]], action: { libelle: "Ouvrir", lien } });
    expect(html).toContain("A &lt;b&gt;");
    expect(html).toContain("x &amp; y");
    expect(html).toContain("&quot;v&quot;");
    expect(html).toContain(`href="${lien}"`);
    expect(gabarit({ titre: "t", intro: "i" })).not.toContain("<table");
  });

  it("annonce la demande de planning à Valentin (EF-60)", () => {
    const m = mailDemandePlanning({ affaires: ["ROUX · Cuisine", "ROUX · Dressing"], concepteur: "Manon", semaine: "2026-S47", datePose: "2026-11-23", lien });
    expect(m.objet).toBe("Demande de planning : ROUX · Cuisine + ROUX · Dressing");
    expect(m.html).toContain("S47");
    expect(m.html).toContain("23 nov.");
    expect(mailDemandePlanning({ affaires: ["A"], concepteur: "M", semaine: null, datePose: null, lien }).html).toContain("à définir");
  });

  it("prévient le concepteur de la réponse de Valentin (EF-61)", () => {
    const confirme = mailPlanningRepondu({ affaires: ["A"], statut: "confirmee", semaine: "2026-S47", datePose: "2026-11-23", poseur: "BAJV", commentaire: null, par: "Valentin", lien });
    expect(confirme.objet).toBe("Planning confirmé : A");
    expect(confirme.html).toContain("BAJV");
    const decale = mailPlanningRepondu({ affaires: ["A"], statut: "decalee", semaine: null, datePose: null, poseur: null, commentaire: "Transtock complet", par: "Valentin", lien });
    expect(decale.objet).toBe("Nouvelles dates proposées : A");
    expect(decale.html).toContain("Transtock complet");
  });

  it("demande le BPA et la facture récapitulative (EF-73, RG-15)", () => {
    expect(mailBpaADonner({ affaire: "A", version: "v1.01", confirmationLe: "2026-10-19", lien }).html).toContain("v1.01");
    expect(mailBpaADonner({ affaire: "A", version: null, confirmationLe: "2026-10-19", lien }).html).not.toContain("Version");
    expect(mailFactureRecap({ affaires: ["A"], montantTtcCts: 1240000, lien }).html.replace(/ /g, " ")).toContain("12 400,00 €");
  });
});
