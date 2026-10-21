import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { chargerProcess } from "../process/valider";
import { construireHistorique, decrire, type JournalLigne } from "./historique";

const ctx = { definition: chargerProcess(brut), prenomDe: (id: string | null) => ({ c: "Clara", b: "Benjamin", v: "Valentin", j: "Jean" })[id ?? ""] ?? null };
let n = 0;
const ligne = (table_nom: string, action: string, avant: object | null, apres: object | null, at = "2026-09-15T10:00:00+02:00"): JournalLigne => ({
  id: `j${++n}`, table_nom, action, avant, apres, auteur_id: "c", at,
});
const texte = (j: JournalLigne) => decrire(j, ctx)?.texte ?? null;
const nb = (s: string | null) => s?.replace(/ /g, " ") ?? null;

describe("historique lisible (EF-40)", () => {
  it("raconte les validations d'étape avec l'issue, le motif, l'auteur et la date", () => {
    const e = decrire(ligne("etape_instance", "update", { statut: "en_cours" }, {
      statut: "faite", etape_code: "R3", iteration: 2, issue_code: "perdue", motif: "prix", fin_at: "2026-09-11T17:00:00+02:00", valide_par: "c",
    }), ctx);
    expect(e).toEqual({ id: expect.any(String), jour: "2026-09-11", texte: "Présentation (R3.2) : Affaire perdue (prix)", auteur: "Clara" });
    expect(texte(ligne("etape_instance", "insert", null, { statut: "faite", etape_code: "ARC", iteration: 1, issue_code: "recu" }))).toBe("Réception ARC : ARC reçu");
    expect(texte(ligne("etape_instance", "insert", null, { statut: "en_cours", etape_code: "ARC" }))).toBeNull();
    expect(texte(ligne("etape_instance", "update", { statut: "faite" }, { statut: "faite", etape_code: "ARC" }))).toBeNull();
  });

  it("raconte les règlements, la vente, les commandes et le planning", () => {
    expect(nb(texte(ligne("echeance", "update", { recu_le: null }, { type: "acompte_1", recu_le: "2026-09-15", montant_recu_cts: 372000, saisi_par: "c" })))).toBe("Acompte 1 reçu (3 720,00 €)");
    expect(texte(ligne("echeance", "update", { recu_le: null }, { type: "solde", recu_le: null }))).toBeNull();
    expect(nb(texte(ligne("vente", "insert", null, { montant_ttc_cts: 1240000, date_signature: "2026-09-12" })))).toBe("Vente signée (12 400,00 € TTC)");
    expect(texte(ligne("vente", "update", {}, { montant_ttc_cts: 1 }))).toBeNull();
    expect(texte(ligne("commande_fournisseur", "insert", null, { fournisseur: "AGEM", envoyee_le: "2026-09-19" }))).toBe("Commande AGEM envoyée");
    expect(texte(ligne("commande_fournisseur", "update", { arc_recu_le: null }, { fournisseur: "AGEM", envoyee_le: "2026-09-19", arc_recu_le: "2026-09-24" }))).toBe("ARC AGEM reçu");
    expect(texte(ligne("commande_fournisseur", "update", { bpa_donne_le: null }, { fournisseur: "AGEM", bpa_donne_le: "2026-09-26", bpa_version: "v1.01" }))).toBe("BPA donné (v1.01)");
    expect(texte(ligne("commande_fournisseur", "update", { statut: "a" }, { fournisseur: "AGEM", statut: "b" }))).toBeNull();
    expect(texte(ligne("planning", "insert", null, { statut: "demandee", semaine_livraison_souhaitee: "2026-S41" }))).toBe("Planning demandé : livraison S41");
    expect(texte(ligne("planning", "update", { statut: "demandee" }, { statut: "confirmee", semaine_livraison_confirmee: "2026-S41", date_pose_confirmee: "2026-10-14" })))
      .toBe("Planning confirmé : livraison S41, pose le 14 oct.");
    expect(texte(ligne("planning", "update", { statut: "confirmee" }, { statut: "confirmee", poseur: "X" }))).toBeNull();
  });

  it("raconte les RDV, les tâches et la vie de l'affaire", () => {
    expect(texte(ligne("rdv", "insert", null, { type: "R3", rang: 2, debut: "2026-11-04T09:00:00Z" }))).toBe("RDV R3.2 planifié le 4 nov.");
    expect(texte(ligne("rdv", "update", { statut: "prevu" }, { type: "R2", rang: 1, statut: "fait", debut: "2026-09-01T09:00:00Z" }))).toBe("RDV R2 fait");
    expect(texte(ligne("rdv", "update", { statut: "prevu" }, { type: "point_technique", statut: "annule", debut: "x" }))).toBe("RDV point technique annulé");
    expect(texte(ligne("rdv", "update", { statut: "prevu", debut: "2026-09-01T09:00:00Z" }, { type: "R1", statut: "prevu", debut: "2026-09-03T09:00:00Z" }))).toBe("RDV R1 déplacé au 3 sept.");
    expect(texte(ligne("rdv", "update", { notes: "a" }, { type: "R1", statut: "prevu", notes: "b" }))).toBeNull();
    expect(texte(ligne("tache", "update", { statut: "a_faire" }, { statut: "faite", titre: "Vérifier le chiffrage" }))).toBe("Tâche faite : Vérifier le chiffrage");
    expect(texte(ligne("tache", "insert", null, { statut: "a_faire", origine: "relance", titre: "Relancer le client", echeance: "2026-10-28" }))).toBe("Relance prévue le 28 oct. : Relancer le client");
    expect(texte(ligne("tache", "insert", null, { statut: "a_faire", origine: "process", titre: "x" }))).toBeNull();
    expect(texte(ligne("tache", "update", { statut: "a_faire", echeance: "2026-10-20" }, { statut: "a_faire", echeance: "2026-10-24", titre: "Relancer AGEM" }))).toBe("Tâche reportée au 24 oct. : Relancer AGEM");
    expect(texte(ligne("tache", "update", { statut: "a_faire", echeance: null }, { statut: "a_faire", echeance: "2026-10-24", titre: "x" }))).toBeNull();
    expect(texte(ligne("affaire", "insert", null, { statut: "active" }))).toBe("Affaire créée");
    expect(texte(ligne("affaire", "update", { statut: "active" }, { statut: "perdue", motif_perte: "prix" }))).toBe("Affaire perdue (prix)");
    expect(texte(ligne("affaire", "update", { statut: "active" }, { statut: "gagnee" }))).toBe("Affaire gagnée");
    expect(texte(ligne("affaire", "update", { concepteur_id: "c" }, { concepteur_id: "j" }))).toBe("Affaire réassignée à Jean");
    expect(texte(ligne("affaire", "update", { magasin_id: "a" }, { magasin_id: "b" }))).toBe("Affaire transférée dans un autre magasin");
    expect(texte(ligne("affaire", "update", { avis_google_obtenu_le: null }, { avis_google_obtenu_le: "2026-10-01" }))).toBe("Avis Google obtenu");
    expect(texte(ligne("affaire", "update", { projet: "a" }, { projet: "b" }))).toBeNull();
    expect(texte(ligne("document", "insert", null, { nom_final: "BDC ROUX - Cuisine.pdf" }))).toBe("Document déposé : BDC ROUX - Cuisine.pdf");
    expect(texte(ligne("affaire", "delete", { statut: "active" }, null))).toBeNull();
    expect(texte(ligne("profil", "update", {}, {}))).toBeNull();
  });

  it("trie du plus récent au plus ancien et limite la liste", () => {
    const lignes = [
      ligne("affaire", "insert", null, {}, "2026-09-01T10:00:00+02:00"),
      ligne("tache", "update", { statut: "a_faire" }, { statut: "faite", titre: "B", fait_le: "2026-09-20T10:00:00+02:00" }),
      ligne("tache", "insert", null, { origine: "process" }),
    ];
    expect(construireHistorique(lignes, ctx).map((e) => [e.jour, e.texte])).toEqual([
      ["2026-09-20", "Tâche faite : B"], ["2026-09-01", "Affaire créée"],
    ]);
    expect(construireHistorique(lignes, ctx, 1)).toHaveLength(1);
  });
});
