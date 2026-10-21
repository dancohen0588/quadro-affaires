import { ajouterJours, ajouterJoursOuvres, type DateIso } from "../rules/calendrier";
import type { Echeance, EcheanceSimple, Etape, TacheModele } from "./schema";

/** Dates de référence d'une étape ouverte, pour calculer l'échéance de ses tâches (section 7.2). */
export type ContexteEcheances = {
  ouverture: DateIso;
  rdv?: Partial<Record<"R0" | "R1" | "R2" | "R3" | "R4", DateIso>>;
  datePose?: DateIso | null;
  dateLivraison?: DateIso | null;
  finChantier?: DateIso | null;
};

const RDV_DE_L_ETAPE = ["R0", "R1", "R2", "R3", "R4"] as const;

function decaler(base: DateIso, jours: number, ouvres?: boolean): DateIso {
  return ouvres ? ajouterJoursOuvres(base, jours) : ajouterJours(base, jours);
}

function simple(e: EcheanceSimple, ctx: ContexteEcheances, etape: Etape): DateIso | null {
  switch (e.depuis) {
    case "aucune":
      return null;
    case "ouverture_etape":
      return decaler(ctx.ouverture, e.jours, e.ouvres);
    case "rdv": {
      const type = e.rdv ?? RDV_DE_L_ETAPE.find((r) => r === etape.code);
      const base = type ? ctx.rdv?.[type] : undefined;
      return base ? decaler(base, e.jours, e.ouvres) : null;
    }
    case "date_pose":
      return ctx.datePose ? decaler(ctx.datePose, e.jours, e.ouvres) : null;
    case "date_livraison":
      return ctx.dateLivraison ? decaler(ctx.dateLivraison, e.jours, e.ouvres) : null;
    case "fin_chantier":
      return ctx.finChantier ? decaler(ctx.finChantier, e.jours, e.ouvres) : null;
  }
}

/**
 * Échéance d'une tâche modèle. Renvoie null si la tâche n'a pas de date (« à réception ») ou si la date
 * de référence n'est pas encore connue (RDV non planifié, pose non confirmée).
 */
export function calculerEcheance(e: Echeance, ctx: ContexteEcheances, etape: Etape): DateIso | null {
  if ("premiere_de" in e) {
    const dates = e.premiere_de.map((x) => simple(x, ctx, etape)).filter((d): d is DateIso => d !== null);
    return dates.length ? dates.sort()[0] : null;
  }
  return simple(e, ctx, etape);
}

export type TacheAGenerer = TacheModele & { echeanceDate: DateIso | null };

/** Tâches d'une étape à son ouverture, avec leur date. */
export function tachesAGenerer(etape: Etape, ctx: ContexteEcheances): TacheAGenerer[] {
  return etape.taches.map((t) => ({ ...t, echeanceDate: calculerEcheance(t.echeance, ctx, etape) }));
}
