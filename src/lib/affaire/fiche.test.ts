import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { chargerProcess } from "../process/valider";
import { construireDocumentsVue, construireIntervenants, construireProcessVue, titreEtape, type EtapeLigne } from "./fiche";

const def = chargerProcess(brut);
const AUJ = "2026-10-21";
const prenoms: Record<string, string> = { c: "Clara", b: "Benjamin" };
const ctx = { aujourdhui: AUJ, prenomDe: (id: string | null) => (id ? (prenoms[id] ?? null) : null) };

let n = 0;
function etape(code: string, statut: "faite" | "en_cours", extra: Partial<EtapeLigne> = {}): EtapeLigne {
  n++;
  return {
    id: `e${n}`, etape_code: code, iteration: 1, statut, branche: "principale", issue_code: null, motif: null,
    debut_at: `2026-09-${String(n).padStart(2, "0")}T10:00:00+02:00`, fin_at: statut === "faite" ? `2026-09-${String(n).padStart(2, "0")}T17:00:00+02:00` : null,
    valide_par: statut === "faite" ? "c" : null, ...extra,
  };
}
const faites = (...codes: string[]) => codes.map((c) => etape(c, "faite", { issue_code: def.phases.flatMap((p) => p.etapes).find((e) => e.code === c)!.issues[0].code }));

describe("vue du process (EF-31, EF-33)", () => {
  const avant = faites("R0", "R1", "R2", "CONCEPTION", "PREP_R3", "R3", "VENTE", "ACOMPTE_1", "PREP_COMMANDE", "COMMANDE_AGEM");
  const arc = etape("ARC", "en_cours");
  const af = etape("AF_AR", "en_cours", { branche: "autres_fournisseurs" });
  const taches = [
    { id: "t1", etape_instance_id: arc.id, titre: "Enregistrer l'ARC", statut: "a_faire", optionnelle: false, echeance: "2026-10-18", assignee_id: "c" },
    { id: "t2", etape_instance_id: arc.id, titre: "Saisir la semaine", statut: "faite", optionnelle: false, echeance: null, assignee_id: "c" },
    { id: "t3", etape_instance_id: arc.id, titre: "Annulée", statut: "annulee", optionnelle: false, echeance: null, assignee_id: "c" },
  ];
  const vue = construireProcessVue(def, [...avant, arc, af], taches, ctx);

  it("donne l'état de chaque phase", () => {
    expect(vue.phases.map((p) => [p.numero, p.etat])).toEqual([
      ["01", "terminee"], ["02", "terminee"], ["03", "terminee"], ["04", "en_cours"], ["05", "a_venir"], ["06", "a_venir"],
    ]);
    expect(vue.phases[0].termineeLe).toBe(avant[1].fin_at);
    expect(vue.phases[3].termineeLe).toBeNull();
    expect(vue).toMatchObject({ faites: 10, total: 23 });
  });

  it("détaille les étapes faites, ouvertes et à venir, avec la branche parallèle", () => {
    const commande = vue.phases[3].etapes;
    expect(commande.map((e) => [e.code, e.statut])).toEqual([
      ["PREP_COMMANDE", "faite"], ["COMMANDE_AGEM", "faite"], ["ARC", "en_cours"], ["AF_AR", "en_cours"],
      ["BPA", "a_venir"], ["BL", "a_venir"], ["PLANNING_LIVRAISON", "a_venir"], ["DOSSIER_POSE", "a_venir"],
    ]);
    expect(commande[1]).toMatchObject({ issue: "Commande envoyée", validePar: "Clara" });
    expect(commande[2]).toMatchObject({ enRetard: true, taches: [{ titre: "Enregistrer l'ARC", enRetard: true }, { titre: "Saisir la semaine", faite: true }] });
    expect(commande[3].branche).toBe("autres_fournisseurs");
    expect(commande[4].tachesModeles).toContain("Donner le BPA");
    // R4, SAV et la branche autres fournisseurs n'apparaissent pas tant qu'ils ne sont pas ouverts.
    expect(vue.phases[4].etapes.map((e) => e.code)).toEqual(["MAIL_AVANT_POSE", "ACOMPTE_2", "POSE"]);
    expect(vue.phases[5].etapes.map((e) => e.code)).toEqual(["SOLDE", "FACTURE_RECAP", "R4", "RELANCE_AVIS", "ARCHIVAGE"]);
  });

  it("n'annonce plus d'étape à venir sur une affaire perdue", () => {
    const perdue = construireProcessVue(def, [...faites("R0", "R1"), etape("R2", "faite", { issue_code: "abandon", motif: "projet abandonné" })], [], ctx);
    expect(perdue.phases.flatMap((p) => p.etapes).every((e) => e.statut === "faite")).toBe(true);
    expect(perdue.phases[1].etapes[0]).toMatchObject({ issue: "Projet abandonné", motif: "projet abandonné" });
  });

  it("nomme les itérations", () => {
    expect(titreEtape("Présentation", "R3", 2)).toBe("Présentation (R3.2)");
    expect(titreEtape("Présentation", "R3", 1)).toBe("Présentation");
  });
});

describe("documents attendus (EF-35)", () => {
  const valeurs = { contremarque: "ROUX Marie", projet: "cuisine", client: "ROUX Marie", semaine: "2026-S41" };
  it("liste les documents des étapes atteintes, puis les prochains", () => {
    const etapes = [...faites("R0", "R1", "R2", "CONCEPTION", "PREP_R3", "R3", "VENTE", "ACOMPTE_1", "PREP_COMMANDE"), etape("COMMANDE_AGEM", "en_cours")];
    const docs = construireDocumentsVue(def, etapes, [{ type_doc: "bdc", nom_final: "BDC ROUX MARIE - Cuisine.pdf", created_at: "2026-09-12T10:00:00Z" }], valeurs);
    expect(docs.map((d) => [d.code, d.statut])).toEqual([
      ["entree_client", "attendu"], ["releve", "attendu"], ["bdc", "ok"], ["debit_agem", "attendu"], ["arc_agem", "a_venir"], ["bpa", "a_venir"],
    ]);
    expect(docs[2]).toMatchObject({ nom: "BDC ROUX MARIE - Cuisine.pdf", deposeLe: "2026-09-12" });
    expect(docs[4].nom).toBe("AR AGEM - ROUX MARIE - Cuisine - S41");
  });
});

describe("intervenants (EF-39)", () => {
  const referents = {
    gerant_bpa: { prenom: "Benjamin", initiales: "BT" },
    gerant_logistique: { prenom: "Valentin", initiales: "VT" },
    gerant_finance: { prenom: "Jean", initiales: "JF" },
    responsable_r4: { prenom: "Elsie", initiales: "EL" },
  };
  it("donne la mission et l'avancement de chacun", () => {
    const etapes = [...faites("BPA"), etape("PLANNING_LIVRAISON", "en_cours")];
    const vue = construireIntervenants(def, etapes, { concepteur: { prenom: "Clara", initiales: "CL", role: "conceptrice", magasin: "La Valentine" }, referents, close: false });
    expect(vue.map((x) => [x.prenom, x.mission, x.statut])).toEqual([
      ["Clara", "conceptrice", null], ["Benjamin", "plans, BPA", "Validé"], ["Valentin", "livraison et pose", "En cours"],
      ["Jean", "facture récapitulative", "À venir"], ["Elsie", "R4 et avis Google", "À venir"],
    ]);
  });
  it("regroupe les missions d'un gérant concepteur, et ne montre que les intervenants passés d'une affaire close", () => {
    const vue = construireIntervenants(def, faites("BPA"), { concepteur: { prenom: "Jean", initiales: "JF", role: "gerant", magasin: "La Valentine" }, referents, close: true });
    expect(vue.map((x) => [x.prenom, x.mission])).toEqual([["Jean", "concepteur"], ["Benjamin", "plans, BPA"]]);
    const actif = construireIntervenants(def, [], { concepteur: { prenom: "Jean", initiales: "JF", role: "gerant", magasin: "La Valentine" }, referents: { gerant_finance: referents.gerant_finance }, close: false });
    expect(actif.map((x) => x.mission)).toEqual(["concepteur, facture récapitulative"]);
  });
});
