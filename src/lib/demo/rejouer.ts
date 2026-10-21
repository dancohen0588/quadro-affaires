/**
 * Rejeu du moteur de process pour le jeu de démo (session 2.1, remplace positionner.ts).
 *
 * Une affaire de démo est menée à son étape par les mêmes validations qu'un utilisateur, datées dans le
 * passé : le moteur ouvre et ferme les étapes (branches parallèles, R3.n, SAV) et crée les tâches. Les
 * lignes produites sont celles que public.appliquer_effets écrirait. Comme l'import de reprise (13.1),
 * seules les tâches des étapes encore ouvertes sont gardées ; les RDV sont créés par le générateur.
 */
import type { Database } from "../db/types";
import type { DatesAffaire, EtatAffaire, Moteur, Resultat, StatutAffaire } from "../process/moteur";
import type { Role } from "../process/schema";
import type { DateIso } from "../rules/calendrier";
import type { Alea } from "./aleatoire";

type Insert<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Insert"];

/** Une validation datée ; l'issue `recommande_sav` repasse une commande AGEM depuis le SAV ouvert. */
export type Pas = {
  jour: DateIso;
  etape: string;
  issue: string;
  motif?: string;
  date?: DateIso;
  ouvrir?: string[];
};

export type Rejeu = {
  affaireId: string;
  concepteurId: string;
  /** Profils des rôles transverses aux étapes (gérants référents, responsable R4). */
  referents: Record<Exclude<Role, "concepteur">, string>;
  /** Jour de création de l'affaire (ouverture du R0). */
  debut: DateIso;
  pas: Pas[];
  aujourdhui: DateIso;
  /** Dates connues de l'affaire (RDV, pose, livraison, fin de chantier), pour dater les tâches. */
  dates: DatesAffaire;
  /** Signature de la vente : l'affaire passe « gagnee » (RG-08). */
  vendueLe?: DateIso | null;
  /** Réception de l'acompte 1 (RG-01). */
  acompte1Le?: DateIso | null;
  /** Heure locale (« +02:00 ») d'un jour donné, pour horodater. */
  instant: (jour: DateIso, heure: string) => string;
};

export type ResultatRejeu = {
  etapes: Insert<"etape_instance">[];
  taches: Insert<"tache">[];
  statut: StatutAffaire;
  etapeCourante: string | null;
};

export function rejouerAffaire(moteur: Moteur, r: Rejeu, alea: Alea): ResultatRejeu {
  const index = new Map(moteur.definition.phases.flatMap((ph) => ph.etapes.map((e) => [e.code, e] as const)));
  const profilDuRole = (role: Role) => (role === "concepteur" ? r.concepteurId : r.referents[role]);
  const etapes = new Map<string, Insert<"etape_instance">>();
  const taches: (Insert<"tache"> & { cle: string })[] = [];
  const cle = (code: string, iteration: number) => `${code}.${iteration}`;
  /** Une tâche naît avec son étape. */
  const dateEtape = (code: string, iteration: number) => etapes.get(cle(code, iteration))!.created_at!;

  const appliquer = (resultat: Resultat, jour: DateIso): EtatAffaire => {
    if (!resultat.ok) throw new Error(`Rejeu de l'affaire ${r.affaireId} au ${jour} : ${resultat.message}`);
    for (const e of resultat.effets) {
      switch (e.type) {
        case "ouvrir_etape":
          etapes.set(cle(e.etape, e.iteration), {
            id: alea.uuid(), affaire_id: r.affaireId, etape_code: e.etape, phase_code: e.phase, branche: e.branche,
            iteration: e.iteration, statut: "en_cours", debut_at: e.quand, created_at: e.quand, updated_at: e.quand,
            created_by: r.concepteurId,
          });
          break;
        case "fermer_etape":
          Object.assign(etapes.get(cle(e.etape, e.iteration))!, {
            statut: "faite", issue_code: e.issue, motif: e.motif, fin_at: e.quand, valide_par: e.par, updated_at: e.quand,
          });
          break;
        case "creer_tache":
          taches.push({
            cle: cle(e.etape, e.iteration), id: alea.uuid(), affaire_id: r.affaireId,
            etape_instance_id: etapes.get(cle(e.etape, e.iteration))!.id, modele_code: e.code, titre: e.titre,
            assignee_id: profilDuRole(e.role), echeance: e.echeance, statut: "a_faire", origine: e.origine,
            optionnelle: e.optionnelle, created_at: dateEtape(e.etape, e.iteration), updated_at: dateEtape(e.etape, e.iteration),
            created_by: r.concepteurId,
          });
          break;
        // annuler_taches : les tâches des étapes fermées ne sont pas gardées (voir plus bas).
        // creer_rdv : les RDV de démo sont créés par le générateur. statut_affaire, etape_courante : lus sur l'état final.
      }
    }
    return resultat.etat;
  };

  const moment = (jour: DateIso, par: string) => ({ quand: r.instant(jour, "17:00"), aujourdhui: jour, par, dates: r.dates });
  let etat = appliquer(moteur.demarrer({ ...moment(r.debut, r.concepteurId), quand: r.instant(r.debut, "09:00") }), r.debut);

  // Ordre chronologique ; à jour égal, l'ordre donné (chemin principal, puis branches).
  const pas = r.pas.map((p, i) => ({ p, i })).sort((a, b) => a.p.jour.localeCompare(b.p.jour) || a.i - b.i).map((x) => x.p);
  for (const p of pas) {
    if (p.jour > r.aujourdhui) throw new Error(`Rejeu de l'affaire ${r.affaireId} : validation future (${p.jour}).`);
    etat = {
      ...etat,
      statut: r.vendueLe && p.jour >= r.vendueLe && etat.statut === "active" ? "gagnee" : etat.statut,
      acompte1Recu: !!r.acompte1Le && p.jour >= r.acompte1Le,
    };
    const par = profilDuRole(index.get(p.etape)!.responsable);
    const resultat =
      p.issue === "recommande_sav"
        ? moteur.repasserCommandeSav(etat, moment(p.jour, par))
        : moteur.valider(etat, { ...moment(p.jour, par), etape: p.etape, issue: p.issue, motif: p.motif, date: p.date, ouvrir: p.ouvrir });
    etat = appliquer(resultat, p.jour);
  }

  // Tâches des étapes ouvertes : une tâche déjà échue est le plus souvent faite (retards réalistes sinon).
  const ouvertes = new Set([...etapes.entries()].filter(([, e]) => e.statut === "en_cours").map(([k]) => k));
  const gardees = taches
    .filter((t) => ouvertes.has(t.cle))
    .map(({ cle: k, ...t }) => {
      const debut = etapes.get(k)!.debut_at!.slice(0, 10);
      const faite = !!t.echeance && t.echeance < r.aujourdhui && alea.proba(t.optionnelle ? 0.3 : 0.7);
      if (!faite) return t;
      const jour = t.echeance! < debut ? debut : t.echeance!;
      return { ...t, statut: "faite", fait_le: r.instant(jour, "16:00"), fait_par: t.assignee_id, updated_at: r.instant(jour, "16:00") };
    });
  return { etapes: [...etapes.values()], taches: gardees, statut: etat.statut, etapeCourante: moteur.etapeCourante(etat.etapes) };
}
