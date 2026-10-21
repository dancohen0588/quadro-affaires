import { describe, expect, it } from "vitest";
import { contremarqueParDefaut, erreursAffaire, erreursVente, libelleAffaire, libelleRecalcule, nomClient } from "./affaire";

const particulier = { type: "particulier" as const, nom: "roussel", prenom: "marie-claire" };
const pro = { type: "professionnel" as const, nom: "ROUSSEL", prenom: "Julien", raison_sociale: "SAS  Atelier Fictif" };

describe("libellé et contremarque (RG-03, D2, D24)", () => {
  it("écrit NOM Prénom pour un particulier, la raison sociale pour un professionnel", () => {
    expect(nomClient(particulier)).toBe("ROUSSEL Marie-Claire");
    expect(nomClient({ type: "particulier", nom: " Le  Goff ", prenom: null })).toBe("LE GOFF");
    expect(nomClient(pro)).toBe("SAS Atelier Fictif");
    expect(nomClient({ ...pro, raison_sociale: " " })).toBe("ROUSSEL Julien");
  });

  it("compose le libellé avec le projet, capitalisé", () => {
    expect(libelleAffaire(particulier, "dressing chambre")).toBe("ROUSSEL Marie-Claire · Dressing chambre");
    expect(libelleAffaire(pro, "cuisine")).toBe("SAS Atelier Fictif · Cuisine");
  });

  it("préremplit la contremarque avec le nom du client", () => {
    expect(contremarqueParDefaut(particulier)).toBe("ROUSSEL Marie-Claire");
    expect(contremarqueParDefaut(pro)).toBe("SAS Atelier Fictif");
  });

  it("recalcule le libellé quand le client change de nom, sauf modification manuelle", () => {
    const affaire = { libelle: "ROUSSEL Marie-Claire · Cuisine", projet: "cuisine", libelle_manuel: false };
    expect(libelleRecalcule(affaire, { ...particulier, nom: "Durand" })).toBe("DURAND Marie-Claire · Cuisine");
    expect(libelleRecalcule(affaire, particulier)).toBeNull();
    expect(libelleRecalcule({ ...affaire, libelle_manuel: true }, { ...particulier, nom: "Durand" })).toBeNull();
  });
});

describe("création d'une affaire (RG-02)", () => {
  it("exige un client, un concepteur et un projet", () => {
    expect(erreursAffaire({ clientId: "c", concepteurId: "u", projet: "cuisine" })).toEqual([]);
    expect(erreursAffaire({ projet: " " })).toHaveLength(3);
  });
});

describe("vente multi-affaires (RG-08)", () => {
  const a = (libelle: string, client_id = "c1", statut = "active") => ({ libelle, client_id, statut });
  it("accepte des affaires actives du même client", () => {
    expect(erreursVente([a("A"), a("B")])).toEqual([]);
  });
  it("refuse une vente vide, des clients différents ou une affaire non active", () => {
    expect(erreursVente([])).toHaveLength(1);
    expect(erreursVente([a("A"), a("B", "c2")])).toEqual(["Les affaires d'une vente doivent appartenir au même client (RG-08)."]);
    expect(erreursVente([a("A"), a("B", "c1", "perdue")])).toEqual(["L'affaire B n'est plus active (RG-08)."]);
  });
});
