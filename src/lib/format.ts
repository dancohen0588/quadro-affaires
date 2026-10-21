import { joursEntre, type DateIso } from "./rules/calendrier";

/**
 * Formats d'affichage en français (section 2 : montants en centimes, dates en Europe/Paris).
 * Les espaces insécables de Intl sont remplacés par des espaces insécables simples pour un rendu stable.
 */

const FUSEAU = "Europe/Paris";
const insecables = (s: string) => s.replace(/[  ]/g, " ");

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const EUROS_RONDS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** 372000 → « 3 720,00 € » ; `ronds` : « 3 720 € ». */
export function euros(centimes: number, ronds = false): string {
  return insecables((ronds ? EUROS_RONDS : EUROS).format(centimes / 100));
}

/** Jour `AAAA-MM-JJ` d'un horodatage, à Paris. Une date simple est renvoyée telle quelle. */
export function jourDe(valeur: string): DateIso {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return valeur;
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(valeur));
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 15 sept. » ; avec l'année si elle diffère de `annee` (« 15 sept. 2025 »). */
export function dateCourte(valeur: string, annee?: number): string {
  const [a, m, j] = jourDe(valeur).split("-").map(Number);
  return `${j} ${MOIS_COURTS[m - 1]}${annee !== undefined && a !== annee ? ` ${a}` : ""}`;
}

/** « 14 h 30 », heure de Paris. */
export function heure(valeur: string): string {
  const [h, min] = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" })
    .format(new Date(valeur))
    .split(":");
  return `${Number(h)} h ${min}`;
}

/** « aujourd'hui », « hier », « il y a 4 jours », « dans 2 jours ». */
export function depuis(valeur: string, aujourdhui: DateIso): string {
  const n = joursEntre(jourDe(valeur), aujourdhui);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "hier";
  if (n === -1) return "demain";
  return n > 0 ? `il y a ${n} jours` : `dans ${-n} jours`;
}

/** « S41 » pour « 2026-S41 ». */
export function semaineCourte(semaine: string): string {
  return semaine.replace(/^\d{4}-/, "");
}

/** Horodatage ISO d'un jour à une heure de Paris, heure d'été ou d'hiver : (« 2026-10-21 », « 14:30 ») → « 2026-10-21T14:30:00+02:00 ». */
export function instantParis(date: DateIso, heureLocale = "10:00"): string {
  const midi = new Date(`${date}T12:00:00Z`);
  const decalage =
    new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, timeZoneName: "longOffset" })
      .formatToParts(midi)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  return `${date}T${heureLocale}:00${decalage}`;
}

/**
 * Montant saisi en euros → centimes : « 12 400,50 », « 12400.5 », « 12 400 € ». null si illisible.
 * Les montants restent des entiers de centimes (section 2).
 */
export function centimesDepuis(texte: string): number | null {
  const net = texte.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(net)) return null;
  const [entier, decimales = ""] = net.split(".");
  return Number(entier) * 100 + Number(decimales.padEnd(2, "0"));
}

/** Champ HTML de type « week » (« 2026-W47 ») ↔ semaine de la base (« 2026-S47 »). */
export function semaineDepuisChamp(valeur: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(valeur);
  return m ? `${m[1]}-S${m[2]}` : null;
}
export function champDepuisSemaine(semaine: string | null): string {
  return semaine ? semaine.replace("-S", "-W") : "";
}

/** Nom court d'un magasin pour les tableaux serrés : « Marseille La Valentine » → « La Valentine », « Aix La Pioline » → « Aix ». */
export function nomCourtMagasin(nom: string): string {
  return nom.replace(/^Marseille /, "").replace(/ La Pioline$/, "");
}
