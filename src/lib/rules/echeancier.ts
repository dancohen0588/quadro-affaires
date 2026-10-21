import { ajouterJours, type DateIso } from "./calendrier";

/** Échéancier de règlement d'une vente (RG-10 à RG-13). Montants en centimes. */

export type TypeEcheance = "acompte_1" | "acompte_2" | "solde" | "autre";
export type ModeReglement = "cheque" | "cb" | "virement" | "especes" | "franfinance";

export type LigneStandard = { type: TypeEcheance; pourcentage: number };
export const ECHEANCIER_STANDARD: readonly LigneStandard[] = [
  { type: "acompte_1", pourcentage: 40 },
  { type: "acompte_2", pourcentage: 50 },
  { type: "solde", pourcentage: 10 },
];

export type LigneEcheancier = {
  type: TypeEcheance;
  ordre: number;
  pourcentage: number;
  montantPrevuCts: number;
  dateAttendue: DateIso | null;
  mode?: ModeReglement | null;
};

/**
 * RG-10 et RG-11 : lignes calculées sur le TTC, arrondies au centime, l'écart d'arrondi porté sur la dernière
 * ligne (le solde). RG-12 : l'acompte 1 est attendu à la signature, les autres dates viennent du planning.
 */
export function genererEcheancier(input: {
  montantTtcCts: number;
  dateSignature: DateIso;
  standard?: readonly LigneStandard[];
}): LigneEcheancier[] {
  const standard = input.standard ?? ECHEANCIER_STANDARD;
  if (!Number.isInteger(input.montantTtcCts) || input.montantTtcCts < 0) {
    throw new Error("Le montant TTC est un nombre entier de centimes, positif.");
  }
  const total = standard.reduce((s, l) => s + l.pourcentage, 0);
  if (Math.abs(total - 100) > 1e-9) throw new Error(`L'échéancier standard totalise ${total} %, et non 100 %.`);

  let reparti = 0;
  return standard.map((l, i) => {
    const derniere = i === standard.length - 1;
    const montant = derniere ? input.montantTtcCts - reparti : Math.round((input.montantTtcCts * l.pourcentage) / 100);
    reparti += montant;
    return {
      type: l.type,
      ordre: i + 1,
      pourcentage: l.pourcentage,
      montantPrevuCts: montant,
      dateAttendue: l.type === "acompte_1" ? input.dateSignature : null,
    };
  });
}

/** RG-12 : dates attendues de l'acompte 2 (livraison confirmée) et du solde (pose confirmée + durée de chantier). */
export function datesAttendues(input: {
  dateLivraison: DateIso | null;
  datePose: DateIso | null;
  dureeChantierJours?: number;
}): { acompte_2: DateIso | null; solde: DateIso | null } {
  return {
    acompte_2: input.dateLivraison,
    solde: input.datePose ? ajouterJours(input.datePose, input.dureeChantierJours ?? 0) : null,
  };
}

/** Contrôles avant enregistrement (RG-11, RG-13). Renvoie la liste des problèmes, vide si l'échéancier est valable. */
export function erreursEcheancier(lignes: readonly LigneEcheancier[], montantTtcCts: number): string[] {
  const erreurs: string[] = [];
  const somme = lignes.reduce((s, l) => s + l.montantPrevuCts, 0);
  if (somme !== montantTtcCts) {
    erreurs.push(`La somme des échéances (${somme} cts) diffère du montant TTC de la vente (${montantTtcCts} cts).`);
  }
  for (const l of lignes) {
    if (!Number.isInteger(l.montantPrevuCts) || l.montantPrevuCts < 0) erreurs.push(`Échéance ${l.ordre} : montant invalide.`);
    if (l.type === "acompte_1" && l.mode === "franfinance") erreurs.push("Franfinance n'est pas accepté sur l'acompte 1 (RG-13).");
  }
  return erreurs;
}

export type EtatEcheance = "recue" | "partielle" | "en_retard" | "attendue" | "a_planifier";

/**
 * État d'une échéance (EF-52, EF-53) : reçue, partiellement reçue (montant inférieur au prévu),
 * en retard (date attendue passée), attendue, ou à planifier (date encore inconnue, RG-12).
 */
export function etatEcheance(
  e: { montantPrevuCts: number; montantRecuCts: number | null; recuLe: DateIso | null; dateAttendue: DateIso | null },
  aujourdhui: DateIso,
): EtatEcheance {
  if (e.recuLe) return (e.montantRecuCts ?? 0) < e.montantPrevuCts ? "partielle" : "recue";
  if (!e.dateAttendue) return "a_planifier";
  return e.dateAttendue < aujourdhui ? "en_retard" : "attendue";
}

/** RG-15 : toutes les échéances d'une vente sont reçues (au moins partiellement). */
export function toutesRecues(lignes: readonly { recuLe: DateIso | null }[]): boolean {
  return lignes.length > 0 && lignes.every((l) => !!l.recuLe);
}
