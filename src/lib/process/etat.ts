import { dateParis } from "../../adapters/clock";
import { lundiDeSemaine, type DateIso } from "../rules/calendrier";
import type { CodePhase } from "./schema";
import type { Branche, DatesAffaire, EtapeEtat, EtatAffaire, StatutAffaire, TypeRdv } from "./moteur";

/**
 * Passage des lignes de la base à l'état du moteur (src/lib/process/moteur.ts). Module pur : la lecture
 * elle-même (RLS de l'utilisateur) est faite par src/server/process.ts.
 */

export type LignesAffaire = {
  affaire: { statut: string; avis_google_obtenu_le: string | null };
  etapes: {
    etape_code: string;
    iteration: number;
    statut: string;
    branche: string;
    phase_code: string;
    issue_code: string | null;
    motif: string | null;
    debut_at: string | null;
    fin_at: string | null;
    valide_par: string | null;
  }[];
  /** Tâches « à faire » rattachées à une étape. */
  taches: { etape_code: string; iteration: number; titre: string; optionnelle: boolean }[];
  acompte1Recu: boolean;
  rdv: { type: string; rang: number; debut: string; statut: string }[];
  planning: {
    date_pose_confirmee: string | null;
    date_pose_souhaitee: string | null;
    semaine_livraison_confirmee: string | null;
    semaine_livraison_souhaitee: string | null;
  } | null;
};

/** Clé d'une étape ouverte, telle que la vérifie public.appliquer_effets (« R3.2 »). */
export const cleEtape = (e: { code: string; iteration: number }) => `${e.code}.${e.iteration}`;

export function construireEtat(l: LignesAffaire): EtatAffaire {
  const etapes: EtapeEtat[] = l.etapes
    .filter((e) => e.statut === "en_cours" || e.statut === "faite" || e.statut === "sautee")
    .sort((a, b) => (a.debut_at ?? "").localeCompare(b.debut_at ?? "") || a.iteration - b.iteration)
    .map((e) => ({
      code: e.etape_code,
      iteration: e.iteration,
      statut: e.statut as EtapeEtat["statut"],
      branche: e.branche as Branche,
      phase: e.phase_code as CodePhase,
      issue: e.issue_code,
      motif: e.motif,
      debut: e.debut_at ?? "",
      fin: e.fin_at,
      validePar: e.valide_par,
    }));
  return {
    statut: l.affaire.statut as StatutAffaire,
    etapes,
    tachesOuvertes: l.taches.map((t) => ({ etape: t.etape_code, iteration: t.iteration, titre: t.titre, optionnelle: t.optionnelle })),
    acompte1Recu: l.acompte1Recu,
    avisObtenu: l.affaire.avis_google_obtenu_le !== null,
  };
}

const RDV_PROCESS = new Set<string>(["R0", "R1", "R2", "R3", "R4"]);

/** Dates de référence des tâches : derniers RDV non annulés, pose, livraison, fin de chantier. */
export function datesAffaire(l: LignesAffaire): DatesAffaire {
  const rdv: Partial<Record<TypeRdv, DateIso>> = {};
  const retenus = l.rdv
    .filter((r) => r.statut !== "annule" && RDV_PROCESS.has(r.type))
    .sort((a, b) => a.rang - b.rang || a.debut.localeCompare(b.debut));
  for (const r of retenus) rdv[r.type as TypeRdv] = dateParis(new Date(r.debut));

  const semaine = l.planning?.semaine_livraison_confirmee ?? l.planning?.semaine_livraison_souhaitee ?? null;
  const finPose = l.etapes
    .filter((e) => e.fin_at && ((e.etape_code === "POSE" && e.issue_code === "ok") || (e.etape_code === "SAV" && e.issue_code === "sav_ok")))
    .map((e) => e.fin_at!)
    .sort()
    .at(-1);
  return {
    rdv,
    datePose: l.planning?.date_pose_confirmee ?? l.planning?.date_pose_souhaitee ?? null,
    dateLivraison: semaine ? lundiDeSemaine(semaine) : null,
    finChantier: finPose ? dateParis(new Date(finPose)) : null,
  };
}
