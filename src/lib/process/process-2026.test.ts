import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { atteignables, chargerProcess, indexerEtapes } from "./valider";

const def = chargerProcess(brut);
const index = indexerEtapes(def);
const etape = (code: string) => index.get(code)!.etape;

describe("process 2026 v1 (sections 7.2 et 7.3)", () => {
  it("est valide et cohérent", () => {
    expect(() => chargerProcess(brut)).not.toThrow();
    expect(def.nom).toBe("2026 v1");
    expect(def.depart).toBe("R0");
  });

  it("a les 6 phases dans l'ordre, aux couleurs de la charte", () => {
    expect(def.phases.map((p) => [p.numero, p.code, p.couleur])).toEqual([
      ["01", "accueil", "#3B6E8F"],
      ["02", "conception", "#6B5B95"],
      ["03", "vente", "#B9812E"],
      ["04", "commande", "#3A8073"],
      ["05", "livraison_pose", "#B4483F"],
      ["06", "cloture", "#5B6472"],
    ]);
  });

  it("contient les 28 étapes de la 7.2, toutes atteignables depuis R0", () => {
    const codes = def.phases.flatMap((p) => p.etapes.map((e) => e.code));
    expect(codes).toEqual([
      "R0", "R1",
      "R2", "CONCEPTION", "PREP_R3",
      "R3", "VENTE", "ACOMPTE_1",
      "PREP_COMMANDE", "COMMANDE_AGEM", "ARC", "BPA", "BL", "PLANNING_LIVRAISON", "DOSSIER_POSE",
      "AF_COMMANDE", "AF_AR", "AF_LISTE", "AF_CARTONS",
      "MAIL_AVANT_POSE", "ACOMPTE_2", "POSE", "SAV",
      "SOLDE", "FACTURE_RECAP", "R4", "RELANCE_AVIS", "ARCHIVAGE",
    ]);
    expect(atteignables(def).size).toBe(28);
  });

  it("fait pointer chaque issue vers une étape existante", () => {
    for (const { etape: e } of index.values()) {
      for (const i of e.issues) {
        for (const cible of [i.vers, i.vers_si_avis_obtenu, ...(i.ouvre ?? []).map((o) => o.etape)]) {
          if (cible) expect(index.has(cible), `${e.code} › ${i.code} → ${cible}`).toBe(true);
        }
      }
    }
  });

  it("attend les 13 documents de la 7.3, chacun à sa bonne étape", () => {
    const docs = Object.fromEntries(
      [...index.values()].flatMap(({ etape: e }) => e.documents.map((d) => [d.code, e.code])),
    );
    expect(docs).toEqual({
      entree_client: "R1", releve: "CONCEPTION", bdc: "VENTE", debit_agem: "COMMANDE_AGEM", arc_agem: "ARC",
      bpa: "BPA", retour_adv: "BPA", ar_fournisseur: "AF_AR", bl: "BL", dossier_pose: "DOSSIER_POSE",
      liste_fournitures: "AF_LISTE", photos_sav: "SAV", photos_finales: "POSE",
    });
    expect(etape("ARC").documents[0].gabarit_nom).toBe("AR AGEM - {CONTREMARQUE} - {Projet} - S{SEM}");
  });

  it("bloque la commande AGEM tant que l'acompte 1 n'est pas reçu, et nulle part ailleurs (RG-01)", () => {
    const bloquees = [...index.values()].filter(({ etape: e }) => e.bloquee_si?.length).map(({ etape: e }) => e.code);
    expect(bloquees).toEqual(["COMMANDE_AGEM"]);
    expect(etape("COMMANDE_AGEM").bloquee_si).toEqual(["acompte_1_non_recu"]);
  });

  it("reprend les décisions de conception", () => {
    // D4 : boucle R3.n et sortie perdue avec motif
    expect(etape("R3").repetable).toBe(true);
    expect(etape("R3").issues.find((i) => i.code === "r3_suivant")).toMatchObject({ type: "loop", vers: "R3", demande_date: true });
    expect(etape("R3").issues.find((i) => i.code === "perdue")).toMatchObject({ statut_affaire: "perdue", motif_obligatoire: true });
    // D6 : validation des plans par Benjamin optionnelle
    expect(etape("PREP_COMMANDE").taches.find((t) => t.code === "validation_plans")).toMatchObject({ assignee: "gerant_bpa", optionnelle: true });
    // D10 : dossier de pose réparti entre conceptrice, Benjamin et Valentin
    expect(new Set(etape("DOSSIER_POSE").taches.map((t) => t.assignee))).toEqual(new Set(["concepteur", "gerant_bpa", "gerant_logistique"]));
    // BPA donné à J+3 ouvrés (RG-21)
    expect(etape("BPA").taches.find((t) => t.code === "donner_bpa")?.echeance).toEqual({ depuis: "ouverture_etape", jours: 3, ouvres: true });
    // RG-34 : R2 sans réponse, relance à J+7
    expect(etape("R2").issues.find((i) => i.code === "sans_reponse")).toMatchObject({ type: "wait", relance_jours: 7 });
    // Branche autres fournisseurs ouverte au choix à la réception de l'acompte 1 (7.4)
    expect(etape("ACOMPTE_1").issues[0].ouvre).toEqual([
      expect.objectContaining({ etape: "AF_COMMANDE", optionnel: true }),
    ]);
    // R4 ouvert dès la fin de chantier, en parallèle du solde (7.2, 7.4)
    expect(etape("POSE").issues.find((i) => i.code === "ok")?.ouvre).toEqual([{ etape: "R4" }]);
    // D12 : cinq moments de demande d'avis Google
    const momentsAvis = [...index.values()].flatMap(({ etape: e }) =>
      [...e.issues.filter((i) => i.demande_avis_google).map(() => e.code), ...e.taches.filter((t) => /avis Google/.test(t.titre)).map(() => e.code)],
    );
    expect(new Set(momentsAvis)).toEqual(new Set(["R1", "R3", "VENTE", "R4", "FACTURE_RECAP", "RELANCE_AVIS"]));
  });

  it("toute fin sans vente mène à l'archivage, qui clôture l'affaire", () => {
    const fins = [...index.values()].flatMap(({ etape: e }) =>
      e.issues.filter((i) => i.type === "end" && i.statut_affaire !== "cloturee").map((i) => i.vers),
    );
    expect(fins.length).toBe(4); // pas_de_r1, pas_de_r2, abandon, perdue
    expect(new Set(fins)).toEqual(new Set(["ARCHIVAGE"]));
    expect(etape("ARCHIVAGE").issues).toEqual([expect.objectContaining({ type: "end", statut_affaire: "cloturee" })]);
  });
});
