import { describe, expect, it } from "vitest";
import { extension, formatAccepte, nomAttendu, nomDeDepot, TACHE_DU_DOCUMENT } from "./documents";

const v = { contremarque: "Roux Marie", projet: "cuisine", client: "ROUX Marie", semaine: "2026-S41" };

describe("noms attendus des documents (section 7.3)", () => {
  it("remplit les gabarits du process", () => {
    expect(nomAttendu("BDC {CONTREMARQUE} - {Projet}", v)).toBe("BDC ROUX MARIE - Cuisine");
    expect(nomAttendu("AR AGEM - {CONTREMARQUE} - {Projet} - S{SEM}", v)).toBe("AR AGEM - ROUX MARIE - Cuisine - S41");
    expect(nomAttendu("{Client} - {Projet} - liste fourniture poseur", v)).toBe("ROUX Marie - Cuisine - liste fourniture poseur");
    expect(nomAttendu("S00-00-0000000-{CLIENT}-{PROJET}-RETOUR SUR V{N}", { ...v, version: 2 })).toBe(
      "S00-00-0000000-ROUX MARIE-CUISINE-RETOUR SUR V2",
    );
    expect(nomAttendu("AR {FOURNISSEUR} - {CONTREMARQUE}", { ...v, fournisseur: "Neff" })).toBe("AR NEFF - ROUX MARIE");
  });

  it("garde un nom lisible quand une donnée manque", () => {
    expect(nomAttendu("BL {CONTREMARQUE} - Livraison S{SEM}", { ...v, semaine: null })).toBe("BL ROUX MARIE - Livraison S00");
    expect(nomAttendu("AR {FOURNISSEUR} - {Inconnu}", v)).toBe("AR FOURNISSEUR - Inconnu");
    expect(nomAttendu("v{N}.01", v)).toBe("v1.01");
  });
});

describe("dépôt d'un document (section 7.3)", () => {
  const v = { contremarque: "Roux", projet: "cuisine", client: "ROUX Laurent", semaine: "2026-S44" };
  it("renomme selon le gabarit en gardant l'extension, garde le nom d'origine sans gabarit", () => {
    expect(nomDeDepot("BDC {CONTREMARQUE} - {Projet}", v, "scan 12.PDF")).toBe("BDC ROUX - Cuisine.pdf");
    expect(nomDeDepot("AR AGEM - {CONTREMARQUE} - {Projet} - S{SEM}", v, "ar")).toBe("AR AGEM - ROUX - Cuisine - S44");
    expect(nomDeDepot(null, v, "Débit C20260929#848.docx")).toBe("Débit C20260929#848.docx");
    expect(nomDeDepot(undefined, v, "a/b:c.jpg")).toBe("a-b-c.jpg");
    expect(nomDeDepot(null, v, "  ")).toBe("document");
  });
  it("contrôle le format", () => {
    expect(formatAccepte(["jpg", "pdf"], "photo.JPEG")).toBe(true);
    expect(formatAccepte(["docx"], "debit.pdf")).toBe(false);
    expect(formatAccepte(undefined, "x")).toBe(true);
    expect(extension("sans-extension")).toBe("");
  });
  it("relie les documents aux tâches qu'ils accomplissent", () => {
    expect(TACHE_DU_DOCUMENT.debit_agem).toBe("enregistrer_debit");
  });
});
