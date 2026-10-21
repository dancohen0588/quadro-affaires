import { describe, expect, it } from "vitest";
import { cleEtape, construireEtat, datesAffaire, type LignesAffaire } from "./etat";

const etape = (code: string, statut: string, debut: string, extra: Partial<LignesAffaire["etapes"][number]> = {}) => ({
  etape_code: code, iteration: 1, statut, branche: "principale", phase_code: "cloture", issue_code: null, motif: null,
  debut_at: debut, fin_at: null, valide_par: null, ...extra,
});

const lignes: LignesAffaire = {
  affaire: { statut: "gagnee", avis_google_obtenu_le: null },
  etapes: [
    etape("SOLDE", "en_cours", "2026-10-20T10:00:00+02:00"),
    etape("POSE", "faite", "2026-10-10T10:00:00+02:00", { issue_code: "ok", fin_at: "2026-10-19T22:30:00Z", phase_code: "livraison_pose" }),
    etape("R4", "en_cours", "2026-10-20T10:00:00+02:00"),
    etape("BL", "sautee", "2026-09-01T10:00:00+02:00"),
  ],
  taches: [{ etape_code: "SOLDE", iteration: 1, titre: "Vérifier le solde", optionnelle: false }],
  acompte1Recu: true,
  rdv: [
    { type: "R3", rang: 1, debut: "2026-09-01T08:00:00Z", statut: "fait" },
    { type: "R3", rang: 2, debut: "2026-09-08T08:00:00Z", statut: "fait" },
    { type: "R4", rang: 1, debut: "2026-11-02T13:00:00Z", statut: "annule" },
    { type: "point_technique", rang: 1, debut: "2026-09-02T08:00:00Z", statut: "fait" },
  ],
  planning: { date_pose_confirmee: null, date_pose_souhaitee: "2026-10-14", semaine_livraison_confirmee: "2026-S41", semaine_livraison_souhaitee: "2026-S40" },
};

describe("état du moteur à partir de la base", () => {
  it("garde les étapes en cours et faites, dans l'ordre de leur ouverture", () => {
    const etat = construireEtat(lignes);
    expect(etat.etapes.map((e) => [e.code, e.statut])).toEqual([["POSE", "faite"], ["SOLDE", "en_cours"], ["R4", "en_cours"]]);
    expect(etat).toMatchObject({ statut: "gagnee", acompte1Recu: true, avisObtenu: false });
    expect(etat.tachesOuvertes).toEqual([{ etape: "SOLDE", iteration: 1, titre: "Vérifier le solde", optionnelle: false }]);
    expect(construireEtat({ ...lignes, affaire: { statut: "gagnee", avis_google_obtenu_le: "2026-10-01" } }).avisObtenu).toBe(true);
  });

  it("calcule les dates de référence des tâches", () => {
    expect(datesAffaire(lignes)).toEqual({
      rdv: { R3: "2026-09-08" },
      datePose: "2026-10-14",
      dateLivraison: "2026-10-05",
      finChantier: "2026-10-20", // 22 h 30 UTC = 0 h 30 à Paris
    });
    expect(datesAffaire({ ...lignes, planning: null, etapes: [] })).toEqual({ rdv: { R3: "2026-09-08" }, datePose: null, dateLivraison: null, finChantier: null });
  });

  it("nomme les étapes ouvertes comme la base", () => {
    expect(cleEtape({ code: "R3", iteration: 2 })).toBe("R3.2");
  });
});
