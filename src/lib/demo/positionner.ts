/**
 * FONCTION UNIQUE À REMPLACER EN J2 (session 1.4, docs/conception.md section 15.3).
 *
 * Place une affaire de démo à une étape donnée en écrivant directement ses états : étapes antérieures
 * « faite » avec l'issue qui mène à la suivante, étapes courantes « en_cours » avec leurs tâches datées.
 * Comme l'import de reprise (13.1), les étapes passées ne génèrent pas de tâches.
 * En J2, le seed rejouera le moteur de process à la place de cette fonction.
 */
import type { Database } from "../db/types";
import { tachesAGenerer, type ContexteEcheances } from "../process/echeances";
import type { ProcessDefinition, Role } from "../process/schema";
import { indexerEtapes } from "../process/valider";
import type { DateIso } from "../rules/calendrier";
import type { Alea } from "./aleatoire";

type Insert<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Insert"];

export type EtapePassee = { code: string; iteration?: number; debut: DateIso; fin: DateIso; issue: string };
export type EtapeOuverte = { code: string; iteration?: number; debut: DateIso; contexte: ContexteEcheances };

export type Positionnement = {
  affaireId: string;
  concepteurId: string;
  /** Profils des rôles transverses aux étapes (gérants référents, responsable R4). */
  referents: Record<Exclude<Role, "concepteur">, string>;
  passees: EtapePassee[];
  ouvertes: EtapeOuverte[];
  aujourdhui: DateIso;
};

export function instantParis(date: DateIso, heure = "10:00"): string {
  const midi = new Date(`${date}T12:00:00Z`);
  const decalage =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
      .formatToParts(midi)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  return `${date}T${heure}:00${decalage}`;
}

export function positionnerAffaire(
  def: ProcessDefinition,
  p: Positionnement,
  alea: Alea,
): { etapes: Insert<"etape_instance">[]; taches: Insert<"tache">[] } {
  const index = indexerEtapes(def);
  const profilDuRole = (r: Role) => (r === "concepteur" ? p.concepteurId : p.referents[r]);
  const etapes: Insert<"etape_instance">[] = [];
  const taches: Insert<"tache">[] = [];

  for (const e of p.passees) {
    const { etape, phase } = index.get(e.code)!;
    etapes.push({
      id: alea.uuid(),
      affaire_id: p.affaireId,
      etape_code: e.code,
      phase_code: phase.code,
      branche: etape.branche ?? "principale",
      iteration: e.iteration ?? 1,
      statut: "faite",
      issue_code: e.issue,
      debut_at: instantParis(e.debut, "09:00"),
      fin_at: instantParis(e.fin, "17:00"),
      valide_par: profilDuRole(etape.responsable),
      created_at: instantParis(e.debut, "09:00"),
      updated_at: instantParis(e.fin, "17:00"),
      created_by: p.concepteurId,
    });
  }

  for (const o of p.ouvertes) {
    const { etape, phase } = index.get(o.code)!;
    const etapeId = alea.uuid();
    etapes.push({
      id: etapeId,
      affaire_id: p.affaireId,
      etape_code: o.code,
      phase_code: phase.code,
      branche: etape.branche ?? "principale",
      iteration: o.iteration ?? 1,
      statut: "en_cours",
      debut_at: instantParis(o.debut, "09:00"),
      created_at: instantParis(o.debut, "09:00"),
      updated_at: instantParis(o.debut, "09:00"),
      created_by: p.concepteurId,
    });
    for (const t of tachesAGenerer(etape, o.contexte)) {
      const assignee = profilDuRole(t.assignee);
      // Une tâche déjà échue est le plus souvent faite ; les autres restent à faire (retards réalistes).
      const faite = t.echeanceDate !== null && t.echeanceDate < p.aujourdhui && alea.proba(t.optionnelle ? 0.3 : 0.7);
      const quand = t.echeanceDate && t.echeanceDate < o.debut ? o.debut : t.echeanceDate;
      taches.push({
        id: alea.uuid(),
        affaire_id: p.affaireId,
        etape_instance_id: etapeId,
        modele_code: t.code,
        titre: t.titre,
        assignee_id: assignee,
        echeance: t.echeanceDate,
        statut: faite ? "faite" : "a_faire",
        origine: "process",
        optionnelle: t.optionnelle ?? false,
        fait_le: faite ? instantParis(quand ?? o.debut, "16:00") : null,
        fait_par: faite ? assignee : null,
        created_at: instantParis(o.debut, "09:00"),
        updated_at: instantParis(faite ? (quand ?? o.debut) : o.debut, faite ? "16:00" : "09:00"),
        created_by: p.concepteurId,
      });
    }
  }
  return { etapes, taches };
}

