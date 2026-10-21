import { describe, expect, it } from "vitest";
import { digestUtile, limiter, mailDigestLundi, mailDigestQuotidien } from "./digests";
import { gabarit } from "./modeles";

const lien = "https://exemple.test/ma-journee";

describe("digests (section 11)", () => {
  it("rend des sections avec puces colorées et texte vide", () => {
    const html = gabarit({ titre: "t", intro: "i", sections: [{ titre: "A <x>", elements: [{ texte: "un", detail: "d", ton: "retard" }] }, { titre: "B", elements: [], vide: "Rien ici." }] });
    expect(html).toContain("A &lt;x&gt;");
    expect(html).toContain("#b4483f");
    expect(html).toContain("Rien ici.");
    expect(gabarit({ titre: "t", intro: "i", sections: [{ titre: "C", elements: [] }] })).toContain("Rien.");
  });

  it("digest quotidien : tâches du jour, en retard, relances, règlements, alertes", () => {
    const t = (titre: string, echeance = "2026-10-22", contexte: string | null = "ROUX · Cuisine") => ({ titre, contexte, echeance });
    const m = mailDigestQuotidien({
      prenom: "Manon", jour: "2026-10-22", lien,
      aFaire: [t("Préparer le relevé")], enRetard: [t("Relancer AGEM", "2026-10-19")], relances: [t("Relancer le client", "2026-10-22", null)],
      reglements: [{ libelle: "PETIT · Placard", detail: "Acompte 1 non reçu", gravite: 1 }], alertes: [{ libelle: "ROUX · Cuisine", detail: "Sans mouvement", gravite: 2 }],
    });
    expect(m.objet).toBe("Votre journée du 22 oct. : 3 tâches, dont 1 en retard");
    expect(m.html).toContain("Préparer le relevé · ROUX · Cuisine");
    expect(m.html).toContain("prévue le 19 oct.");
    expect(m.html).toContain("Acompte 1 non reçu");
    expect(m.html).toContain("Sans mouvement");
    expect(m.html).toContain(`href="${lien}"`);
    const vide = mailDigestQuotidien({ prenom: "Léa", jour: "2026-10-22", lien, aFaire: [t("A")], enRetard: [], relances: [], reglements: [], alertes: [] });
    expect(vide.objet).toBe("Votre journée du 22 oct. : 1 tâche");
    expect(vide.html).not.toContain(">Alertes <");
    expect(digestUtile({ aFaire: [], enRetard: [], relances: [], alertes: [] })).toBe(false);
    const long = mailDigestQuotidien({ prenom: "Léa", jour: "2026-10-22", lien, aFaire: [], enRetard: Array.from({ length: 11 }, (_, i) => t(`T${i}`, "2026-10-20")), relances: [], reglements: [], alertes: [] });
    expect(long.html).toContain("(11)");
    expect(long.html).toContain("et 3 de plus dans l'outil");
    expect(long.html).not.toContain("T10");
    expect(limiter([{ texte: "a" }], 1)).toEqual([{ texte: "a" }]);
    expect(digestUtile({ aFaire: [], enRetard: [], relances: [], alertes: [1] })).toBe(true);
  });

  it("digest du lundi : par magasin, potentiel, enjeux, alertes", () => {
    const alerte = (i: number) => ({ libelle: `A${i}`, detail: `d${i}`, gravite: i === 0 ? 1 : 2 });
    const m = mailDigestLundi({
      prenom: "Jean", semaine: "S44", lien,
      magasins: [
        { nom: "Aix La Pioline", potentielCts: 4_500_000, nbPotentiel: 6, r3: 3, livraisons: 1, poses: 2, reglementsCts: 418_200, nbReglements: 2, alertes: [0, 1, 2, 3, 4, 5, 6].map(alerte) },
        { nom: "La Ciotat", potentielCts: 0, nbPotentiel: 1, r3: 1, livraisons: 0, poses: 0, reglementsCts: 0, nbReglements: 1, alertes: [alerte(1)] },
      ],
    });
    expect(m.objet).toBe("Semaine S44 : les enjeux des trois showrooms (8 alertes)");
    expect(m.html.replace(/[\u202f\u00a0]/g, " ")).toContain("Potentiel en conception et vente : 45 000 € HT");
    expect(m.html).toContain("Cette semaine : 3 R3, 1 livraison, 2 poses");
    expect(m.html).toContain("et 2 autres alertes");
    expect(m.html).toContain("Cette semaine : 1 R3, 0 livraison, 0 pose");
    expect(m.html).not.toContain("A6");
  });
});
