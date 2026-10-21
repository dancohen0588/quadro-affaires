import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { chargerProcess, indexerEtapes } from "../process/valider";
import { joursEntre, joursOuvresEcoules } from "../rules/calendrier";
import { erreursEcheancier, type LigneEcheancier } from "../rules/echeancier";
import { CAS_DEMO, genererJeuDemo } from "./generer";
import { PERSONNAGES } from "./personnages";

const definition = chargerProcess(brut);
const index = indexerEtapes(definition);
const AUJOURDHUI = "2026-10-21"; // un mercredi
const profils = Object.fromEntries(PERSONNAGES.map((p, i) => [p.cle, `00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`]));
const magasins = { AIX: "m-aix", VAL: "m-val", CIO: "m-cio" } as const;
const entree = { aujourdhui: AUJOURDHUI, definition, processVersionId: "pv", profils, magasins };
const jeu = genererJeuDemo(entree);

const actives = jeu.affaires.filter((x) => x.statut === "active" || x.statut === "gagnee");
const phaseDe = (code: string) => index.get(code === "SAV" ? "SAV" : code)!.phase.code;
const affaire = (id: string) => jeu.affaires.find((x) => x.id === id)!;
const ouvertes = (id: string) => jeu.etapes.filter((e) => e.affaire_id === id && e.statut === "en_cours");

describe("jeu de démo (session 1.4)", () => {
  it("est déterministe : même graine, même jeu", () => {
    const encore = genererJeuDemo(entree);
    expect(encore.affaires.map((x) => [x.id, x.libelle, x.etape_courante_code])).toEqual(
      jeu.affaires.map((x) => [x.id, x.libelle, x.etape_courante_code]),
    );
    expect(encore.taches.length).toBe(jeu.taches.length);
  });

  it("contient environ 75 affaires actives réparties sur les 6 phases", () => {
    expect(actives.length).toBe(76); // 75 situations, dont une vente qui regroupe deux affaires
    const parPhase: Record<string, number> = {};
    for (const x of actives) parPhase[phaseDe(x.etape_courante_code!)] = (parPhase[phaseDe(x.etape_courante_code!)] ?? 0) + 1;
    expect(parPhase).toEqual({ accueil: 14, conception: 14, vente: 11, commande: 25, livraison_pose: 8, cloture: 4 });
  });

  it("contient environ 6 mois d'historique et environ 270 ventes", () => {
    expect(jeu.ventes.length).toBeGreaterThanOrEqual(250);
    expect(jeu.ventes.length).toBeLessThanOrEqual(290);
    const plusAncienne = jeu.ventes.map((v) => v.date_signature).sort()[0];
    expect(joursEntre(plusAncienne, AUJOURDHUI)).toBeLessThanOrEqual(186);
    expect(joursEntre(plusAncienne, AUJOURDHUI)).toBeGreaterThanOrEqual(150);
    expect(jeu.affaires.filter((x) => x.statut === "perdue" || x.statut === "abandonnee").length).toBeGreaterThan(150);
    expect(jeu.clients.filter((c) => c.cnq).length).toBe(54);
  });

  it("couvre chaque cas imposé par la section 15.3", () => {
    const attendus: Record<string, number> = {
      r3n_en_cours: 3, arc_en_retard: 2, bpa_en_retard: 1, acompte_1_non_recu: 2, acompte_2_en_retard: 1,
      acompte_2_apres_3_jours: 1, retard_commerce: 2, sav_ouvert: 1, client_professionnel: 1, client_qui_revient: 1,
      jean_concepteur: 1, branche_autres_fournisseurs: 1, vente_multi_affaires: 2, manon_r2_aujourdhui: 3,
    };
    for (const cas of CAS_DEMO) expect(jeu.cas[cas].length, cas).toBe(attendus[cas]);
  });

  it("met les cas imposés dans l'état attendu", () => {
    for (const id of jeu.cas.r3n_en_cours) {
      const r3 = ouvertes(id).find((e) => e.etape_code === "R3")!;
      expect(r3.iteration).toBeGreaterThanOrEqual(2);
      expect(jeu.etapes.filter((e) => e.affaire_id === id && e.etape_code === "R3" && e.issue_code === "r3_suivant").length).toBe(r3.iteration! - 1);
    }
    for (const id of jeu.cas.arc_en_retard) {
      const commande = jeu.commandes.find((c) => c.affaire_id === id)!;
      expect(commande.arc_recu_le).toBeNull();
      expect(joursOuvresEcoules(commande.envoyee_le!, AUJOURDHUI)).toBeGreaterThan(5); // RG-22
    }
    const bpa = jeu.commandes.find((c) => c.affaire_id === jeu.cas.bpa_en_retard[0])!;
    expect(bpa.bpa_donne_le).toBeNull();
    expect(joursOuvresEcoules(bpa.confirmation_recue_le!, AUJOURDHUI)).toBeGreaterThan(3); // RG-21

    const echeanceDe = (id: string, type: string) => jeu.echeances.find((e) => e.vente_id === affaire(id).vente_id && e.type === type)!;
    for (const id of jeu.cas.acompte_1_non_recu) {
      const e = echeanceDe(id, "acompte_1");
      expect(e.recu_le).toBeNull();
      expect(joursEntre(e.date_attendue!, AUJOURDHUI)).toBeGreaterThan(3); // RG-24
    }
    const a2 = echeanceDe(jeu.cas.acompte_2_en_retard[0], "acompte_2");
    expect(a2.recu_le).toBeNull();
    expect(joursEntre(a2.date_attendue!, AUJOURDHUI)).toBeGreaterThan(2); // RG-25
    const bientot = echeanceDe(jeu.cas.acompte_2_apres_3_jours[0], "acompte_2");
    expect(joursEntre(bientot.date_attendue!, AUJOURDHUI)).toBeLessThanOrEqual(2); // pas encore en retard…
    expect(joursEntre(bientot.date_attendue!, AUJOURDHUI) + 3).toBeGreaterThan(2); // … mais en retard après +3 jours

    for (const id of jeu.cas.retard_commerce) {
      const r1 = jeu.rdv.find((r) => r.affaire_id === id && r.type === "R1")!;
      expect(r1.statut).toBe("fait");
      expect(joursEntre(r1.debut.slice(0, 10), AUJOURDHUI)).toBeGreaterThan(14); // RG-20
      expect(affaire(id).vente_id).toBeUndefined();
    }
    expect(ouvertes(jeu.cas.sav_ouvert[0]).map((e) => e.etape_code)).toEqual(["SAV"]);
    const pro = jeu.clients.find((c) => c.id === affaire(jeu.cas.client_professionnel[0]).client_id)!;
    expect(pro).toMatchObject({ type: "professionnel" });
    expect(affaire(jeu.cas.client_professionnel[0]).contremarque).toBe(pro.raison_sociale);
    const revient = affaire(jeu.cas.client_qui_revient[0]);
    expect(jeu.affaires.filter((x) => x.client_id === revient.client_id && x.statut === "cloturee").length).toBeGreaterThan(0);
    expect(affaire(jeu.cas.jean_concepteur[0]).concepteur_id).toBe(profils.jean);
    expect(ouvertes(jeu.cas.branche_autres_fournisseurs[0]).map((e) => e.branche).sort()).toEqual(["autres_fournisseurs", "principale"]);
    const [cuisine, dressing] = jeu.cas.vente_multi_affaires.map(affaire);
    expect(cuisine.vente_id).toBe(dressing.vente_id);
    expect([cuisine.projet, dressing.projet]).toEqual(["cuisine", "dressing"]);
  });

  it("prépare la journée de Manon (scénario n° 1)", () => {
    const manon = profils.manon;
    const sesTaches = jeu.taches.filter((t) => t.assignee_id === manon && t.statut === "a_faire");
    expect(sesTaches.some((t) => t.echeance === AUJOURDHUI)).toBe(true);
    expect(sesTaches.some((t) => t.echeance && t.echeance < AUJOURDHUI)).toBe(true);
    expect(sesTaches.some((t) => t.origine === "relance" && t.echeance === AUJOURDHUI)).toBe(true);
    const sesRdv = jeu.rdv.filter((r) => r.profil_id === manon && r.statut === "prevu");
    expect(sesRdv.filter((r) => r.type === "R2" && r.debut.startsWith(AUJOURDHUI)).length).toBe(1);
    expect(sesRdv.filter((r) => r.type === "R3" && joursEntre(AUJOURDHUI, r.debut.slice(0, 10)) <= 4).length).toBeGreaterThanOrEqual(2);
  });

  it("respecte les règles de gestion et le modèle de données", () => {
    for (const v of jeu.ventes) {
      const lignes = jeu.echeances.filter((e) => e.vente_id === v.id).map((e) => ({
        type: e.type, ordre: e.ordre, pourcentage: Number(e.pourcentage), montantPrevuCts: e.montant_prevu_cts,
        dateAttendue: e.date_attendue ?? null, mode: e.mode ?? null,
      }) as LigneEcheancier);
      expect(erreursEcheancier(lignes, v.montant_ttc_cts), v.id).toEqual([]); // RG-11, RG-13
      const affairesDeLaVente = jeu.affaires.filter((x) => x.vente_id === v.id);
      expect(new Set(affairesDeLaVente.map((x) => x.client_id)).size).toBe(1); // RG-08
    }
    for (const x of jeu.affaires) {
      if (x.statut === "perdue" || x.statut === "abandonnee") expect(x.motif_perte, x.id).toBeTruthy(); // RG-06
      expect(Number.isInteger(x.montant_devis_ht_cts)).toBe(true);
    }
    for (const e of jeu.etapes) expect(index.has(e.etape_code), e.etape_code).toBe(true);
    for (const e of jeu.etapes) expect(e.phase_code).toBe(index.get(e.etape_code)!.phase.code);
    const ids = new Set(jeu.etapes.map((e) => e.id));
    for (const t of jeu.taches) if (t.etape_instance_id) expect(ids.has(t.etape_instance_id)).toBe(true);
    // Aucune écriture datée dans le futur : le journal et la dernière activité restent cohérents.
    const demain = "2026-10-22";
    for (const lignes of [jeu.clients, jeu.affaires, jeu.ventes, jeu.echeances, jeu.rdv, jeu.etapes, jeu.taches, jeu.commandes, jeu.plannings]) {
      for (const l of lignes as { created_at?: string }[]) expect(l.created_at! < demain, l.created_at).toBe(true);
    }
    for (const c of jeu.clients) {
      expect(c.email ?? "x@exemple.test").toMatch(/@exemple\.test$/);
      expect(c.telephone ?? "06 39 98 00 00").toMatch(/^06 39 98 \d\d \d\d$/);
    }
    // Les affaires actives hors cas imposés ne sont pas en retard commerce.
    const retards = new Set(jeu.cas.retard_commerce);
    for (const x of actives) {
      if (retards.has(x.id!) || x.vente_id) continue;
      const r1 = jeu.rdv.find((r) => r.affaire_id === x.id && r.type === "R1" && r.statut === "fait");
      if (r1) expect(joursEntre(r1.debut.slice(0, 10), AUJOURDHUI), x.libelle!).toBeLessThanOrEqual(14);
    }
  });
});
