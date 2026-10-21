import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { calculerEcheance, tachesAGenerer } from "./echeances";
import { indexerEtapes, chargerProcess } from "./valider";

const index = indexerEtapes(chargerProcess(brut));
const etape = (code: string) => index.get(code)!.etape;
const dates = (code: string, ctx: Parameters<typeof tachesAGenerer>[1]) =>
  Object.fromEntries(tachesAGenerer(etape(code), ctx).map((t) => [t.code, t.echeanceDate]));

describe("échéances des tâches modèles (section 7.2)", () => {
  it("compte depuis l'ouverture de l'étape", () => {
    expect(dates("ACOMPTE_1", { ouverture: "2026-10-21" })).toEqual({ verifier_acompte_1: "2026-10-24" });
  });

  it("compte en jours ouvrés quand la tâche le demande (BPA à J+3 ouvrés)", () => {
    expect(dates("BPA", { ouverture: "2026-10-22" })).toMatchObject({ donner_bpa: "2026-10-27", enregistrer_confirmation: null });
  });

  it("compte depuis le RDV de l'étape ou un RDV désigné", () => {
    expect(dates("R2", { ouverture: "2026-10-15", rdv: { R2: "2026-10-21" } })).toEqual({
      preparer_materiel: "2026-10-20", preparer_releve: "2026-10-20", realiser_existant: "2026-10-22",
      verifier_existant: "2026-10-23", point_technique: "2026-10-24",
    });
    expect(dates("PREP_R3", { ouverture: "2026-10-15", rdv: { R3: "2026-10-28" } })).toEqual({ point_tech_strat: "2026-10-26" });
    expect(dates("PREP_R3", { ouverture: "2026-10-15" })).toEqual({ point_tech_strat: null }); // R3 pas encore planifié
  });

  it("compte depuis la pose, la livraison ou la fin de chantier, si elles sont connues", () => {
    expect(dates("MAIL_AVANT_POSE", { ouverture: "2026-10-21", datePose: "2026-11-12" })).toEqual({ envoyer_mail: "2026-11-02" });
    expect(dates("ACOMPTE_2", { ouverture: "2026-10-21", dateLivraison: "2026-11-09" })).toEqual({ verifier_acompte_2: "2026-11-11" });
    expect(dates("SOLDE", { ouverture: "2026-10-21", finChantier: "2026-11-13" })).toEqual({ verifier_solde: "2026-11-20" });
    expect(dates("ACOMPTE_2", { ouverture: "2026-10-21" })).toEqual({ verifier_acompte_2: null });
    expect(dates("SOLDE", { ouverture: "2026-10-21" })).toEqual({ verifier_solde: null });
    expect(dates("POSE", { ouverture: "2026-10-21" })).toEqual({ photos_menuisiers: null });
  });

  it("retient la première de deux dates (dossier de pose : J+5 ou J-7 avant la pose)", () => {
    expect(dates("DOSSIER_POSE", { ouverture: "2026-10-21", datePose: "2026-11-30" }).verifier_dossier).toBe("2026-10-26");
    expect(dates("DOSSIER_POSE", { ouverture: "2026-10-21", datePose: "2026-10-30" }).verifier_dossier).toBe("2026-10-23");
    expect(dates("DOSSIER_POSE", { ouverture: "2026-10-21" }).verifier_dossier).toBe("2026-10-26");
  });

  it("renvoie null pour une tâche « à réception » et un RDV absent d'une étape sans RDV propre", () => {
    expect(calculerEcheance({ depuis: "aucune" }, { ouverture: "2026-10-21" }, etape("ARC"))).toBeNull();
    expect(calculerEcheance({ depuis: "rdv", jours: 0 }, { ouverture: "2026-10-21", rdv: { R2: "2026-10-22" } }, etape("ARC"))).toBeNull();
    expect(calculerEcheance({ premiere_de: [{ depuis: "aucune" }, { depuis: "date_pose", jours: 1 }] }, { ouverture: "2026-10-21" }, etape("ARC"))).toBeNull();
    expect(calculerEcheance({ depuis: "date_livraison", jours: -1, ouvres: true }, { ouverture: "2026-10-21", dateLivraison: "2026-10-26" }, etape("ARC"))).toBe("2026-10-23");
  });
});
