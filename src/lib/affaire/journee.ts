import { dateCourte, jourDe } from "../format";
import { joursEntre, jourDeSemaine, type DateIso } from "../rules/calendrier";

/**
 * Modèle de vue de Ma journée (EF-10, EF-11, EF-18) : badges d'échéance et regroupement des tâches par
 * affaire, triées par échéance. Module pur.
 */

export type AffaireTache = { id: string; libelle: string; contremarque: string; etape: string | null };

export type TacheJournee = {
  id: string;
  titre: string;
  detail: string | null;
  echeance: string | null;
  statut: string;
  faitLe: string | null;
  origine: string;
  affaire: AffaireTache | null;
  /** Étape de rattachement (titre), pour le contexte. */
  etape: string | null;
};

export type Badge = { texte: string; ton: "retard" | "attention" | "neutre" | "ok" };

export const JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const JOURS_LONGS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « Mercredi 21 octobre ». */
export function titreDuJour(jour: DateIso): string {
  const [, m, j] = jour.split("-").map(Number);
  return `${JOURS_LONGS[jourDeSemaine(jour)]} ${j} ${MOIS[m - 1]}`;
}

/** « Retard 4 j », « Aujourd'hui », « Mer. 30 sept. », « OK » pour une tâche faite (EF-10). */
export function badgeEcheance(t: Pick<TacheJournee, "echeance" | "statut">, aujourdhui: DateIso): Badge {
  if (t.statut === "faite") return { texte: "OK", ton: "ok" };
  if (!t.echeance) return { texte: "Sans date", ton: "neutre" };
  const retard = joursEntre(t.echeance, aujourdhui);
  if (retard > 0) return { texte: `Retard ${retard} j`, ton: "retard" };
  if (retard === 0) return { texte: "Aujourd'hui", ton: "attention" };
  return { texte: `${JOURS[jourDeSemaine(t.echeance)]} ${dateCourte(t.echeance)}`, ton: "neutre" };
}

/** Tâches du jour (EF-10) : à faire échues ou du jour, et celles faites aujourd'hui (annulables, EF-11). */
export function estDuJour(t: TacheJournee, aujourdhui: DateIso): boolean {
  if (t.statut === "faite") return !!t.faitLe && jourDe(t.faitLe) === aujourdhui;
  return t.statut === "a_faire" && !!t.echeance && t.echeance <= aujourdhui;
}

/** Tâches des 7 prochains jours (EF-18). */
export function estAVenir(t: TacheJournee, aujourdhui: DateIso): boolean {
  return t.statut === "a_faire" && !!t.echeance && t.echeance > aujourdhui && joursEntre(aujourdhui, t.echeance) <= 7;
}

export type Groupe = { affaire: AffaireTache | null; taches: TacheJournee[] };

/** Regroupe par affaire ; groupes et tâches triés par échéance (la plus ancienne d'abord), sans affaire en dernier. */
export function grouperParAffaire(taches: readonly TacheJournee[]): Groupe[] {
  const cle = (e: string | null) => e ?? "9999-12-31";
  const groupes = new Map<string, Groupe>();
  for (const t of [...taches].sort((a, b) => cle(a.echeance).localeCompare(cle(b.echeance)) || a.titre.localeCompare(b.titre, "fr"))) {
    const k = t.affaire?.id ?? "";
    if (!groupes.has(k)) groupes.set(k, { affaire: t.affaire, taches: [] });
    groupes.get(k)!.taches.push(t);
  }
  return [...groupes.values()].sort((a, b) => {
    if (!a.affaire !== !b.affaire) return a.affaire ? -1 : 1;
    return cle(a.taches[0].echeance).localeCompare(cle(b.taches[0].echeance));
  });
}
