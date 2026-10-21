import { describe, expect, it } from "vitest";
import { cheminLogique, cleStockage, compterFichiers, construireArbre, nomDossierAffaire, nomPropre } from "./pcloud";

describe("PCloud simulé (section 13.4)", () => {
  it("normalise les chemins du process et dérive des clés ASCII", () => {
    expect(cheminLogique("06 - ARC-BPA AGEM et autres fournisseurs / ARC-BPA AGEM / AR")).toBe("06 - ARC-BPA AGEM et autres fournisseurs/ARC-BPA AGEM/AR");
    expect(cleStockage("VAL/ROUX Laurent - Cuisine (Clara)", "01 - Données d'Entrée / Relevés-Métrés", "Débit C2026#848.docx"))
      .toBe("VAL/ROUX Laurent - Cuisine (Clara)/01 - Donnees d'Entree/Releves-Metres/Debit C2026_848.docx");
    expect(cleStockage("a/  /b", "’?")).toBe("a/b/'_");
    expect(cleStockage("…")).toBe("_");
  });

  it("nomme le dossier d'une affaire", () => {
    expect(nomDossierAffaire({ magasinCode: "VAL", client: "ROUX Laurent", projet: "cuisine", concepteur: "Clara" })).toBe("VAL/ROUX Laurent - Cuisine (Clara)");
    expect(nomDossierAffaire({ magasinCode: "AIX", client: "SAS A/B", projet: "", concepteur: "Jean" })).toBe("AIX/SAS A-B - (Jean)");
    expect(nomPropre(' a  "b" ')).toBe("a -b-");
  });

  it("construit l'arborescence du modèle et range les fichiers", () => {
    const f = (id: string, nom: string, dossier: string) => ({ id, nom, dossier, deposeLe: "2026-10-21", parQui: "Manon", lien: null });
    const arbre = construireArbre(
      ["10 - SAV", "01 - Données d'Entrée", "01 - Données d'Entrée/Relevés-Métrés", "02 - À confirmer"],
      [f("1", "b.jpg", "01 - Données d'Entrée"), f("2", "a.jpg", "01 - Données d'Entrée"), f("3", "Débit.docx", "05 - Commande AGEM / Commande AGEM")],
    );
    expect(arbre.map((n) => n.nom)).toEqual(["01 - Données d'Entrée", "02 - À confirmer", "05 - Commande AGEM", "10 - SAV"]);
    expect(arbre[0].fichiers.map((x) => x.nom)).toEqual(["a.jpg", "b.jpg"]);
    expect(arbre[0].enfants[0].chemin).toBe("01 - Données d'Entrée/Relevés-Métrés");
    expect(arbre[2].enfants[0].fichiers[0].id).toBe("3");
    expect(arbre.map(compterFichiers)).toEqual([2, 0, 1, 0]);
  });
});
