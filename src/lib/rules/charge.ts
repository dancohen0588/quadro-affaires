import { jourDe } from "../format";
import { ajouterJours, lundiDeSemaine, semaineIso, type DateIso } from "./calendrier";

/**
 * Règles de charge des concepteurs (section 8.5) :
 * RG-30 au plus N R2 par jour, RG-31 au plus N R3 par semaine (lundi-dimanche), avertissements et non
 * blocages ; RG-32 rappel des notes après un RDV fait. Seuils dans parametre.seuils.
 */

export type RdvCharge = { type: string; debut: string; statut: string; notes?: string | null };
export type SeuilsCharge = { max_r2_par_jour: number; max_r3_par_semaine: number };

const actif = (r: RdvCharge) => r.statut !== "annule";

function semaineDe(jour: DateIso): [DateIso, DateIso] {
  const lundi = lundiDeSemaine(semaineIso(jour));
  return [lundi, ajouterJours(lundi, 6)];
}

export function r2DuJour(rdv: readonly RdvCharge[], jour: DateIso): number {
  return rdv.filter((r) => actif(r) && r.type === "R2" && jourDe(r.debut) === jour).length;
}

export function r3DeLaSemaine(rdv: readonly RdvCharge[], jour: DateIso): number {
  const [lundi, dimanche] = semaineDe(jour);
  return rdv.filter((r) => actif(r) && r.type === "R3" && jourDe(r.debut) >= lundi && jourDe(r.debut) <= dimanche).length;
}

export type Jauges = {
  r2: { nombre: number; max: number };
  r3: { nombre: number; max: number };
  /** RG-32 : RDV faits ces 7 derniers jours, et combien ont des notes. */
  notes: { avecNotes: number; faits: number };
};

/** Encadré « Règles de la semaine » de Ma journée (EF-14). */
export function jaugesSemaine(rdv: readonly RdvCharge[], aujourdhui: DateIso, seuils: SeuilsCharge): Jauges {
  const debut = ajouterJours(aujourdhui, -6);
  const faits = rdv.filter(
    (r) => r.statut === "fait" && /^R[1-4]$/.test(r.type) && jourDe(r.debut) >= debut && jourDe(r.debut) <= aujourdhui,
  );
  return {
    r2: { nombre: r2DuJour(rdv, aujourdhui), max: seuils.max_r2_par_jour },
    r3: { nombre: r3DeLaSemaine(rdv, aujourdhui), max: seuils.max_r3_par_semaine },
    notes: { avecNotes: faits.filter((r) => !!r.notes?.trim()).length, faits: faits.length },
  };
}

/**
 * Avertissements à la saisie d'un RDV (RG-30, RG-31) : le RDV est enregistré, la personne est prévenue.
 * `existants` : RDV de la même personne, sans le nouveau.
 */
export function avertissementsCharge(
  nouveau: { type: string; jour: DateIso },
  existants: readonly RdvCharge[],
  seuils: SeuilsCharge,
  qui: string,
): string[] {
  if (nouveau.type === "R2") {
    const n = r2DuJour(existants, nouveau.jour) + 1;
    if (n > seuils.max_r2_par_jour) return [`${qui} a ${n} R2 ce jour-là, pour ${seuils.max_r2_par_jour} au plus (RG-30).`];
  }
  if (nouveau.type === "R3") {
    const n = r3DeLaSemaine(existants, nouveau.jour) + 1;
    if (n > seuils.max_r3_par_semaine) return [`${qui} a ${n} R3 cette semaine-là, pour ${seuils.max_r3_par_semaine} au plus (RG-31).`];
  }
  return [];
}
