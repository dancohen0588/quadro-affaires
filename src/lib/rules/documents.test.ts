import { describe, expect, it } from "vitest";
import { nomAttendu } from "./documents";

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
