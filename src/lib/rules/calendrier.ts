/**
 * Calendrier métier (section 8.7) : jours ouvrés du lundi au vendredi, hors jours fériés français.
 * Les dates métier sont des chaînes « AAAA-MM-JJ » (Europe/Paris), manipulées sans fuseau.
 */

export type DateIso = string;

const UN_JOUR = 86_400_000;

function versUtc(d: DateIso): number {
  const [a, m, j] = d.split("-").map(Number);
  return Date.UTC(a, m - 1, j);
}

function depuisUtc(ms: number): DateIso {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ajouterJours(d: DateIso, n: number): DateIso {
  return depuisUtc(versUtc(d) + n * UN_JOUR);
}

/** Écart en jours calendaires (b − a). */
export function joursEntre(a: DateIso, b: DateIso): number {
  return Math.round((versUtc(b) - versUtc(a)) / UN_JOUR);
}

/** Dimanche de Pâques (algorithme de Meeus, calendrier grégorien). */
export function paques(annee: number): DateIso {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Les 11 jours fériés de France métropolitaine pour une année. */
export function joursFeries(annee: number): DateIso[] {
  const p = paques(annee);
  return [
    `${annee}-01-01`,
    ajouterJours(p, 1), // lundi de Pâques
    `${annee}-05-01`,
    `${annee}-05-08`,
    ajouterJours(p, 39), // Ascension
    ajouterJours(p, 50), // lundi de Pentecôte
    `${annee}-07-14`,
    `${annee}-08-15`,
    `${annee}-11-01`,
    `${annee}-11-11`,
    `${annee}-12-25`,
  ].sort();
}

const cacheFeries = new Map<number, Set<DateIso>>();
function estFerie(d: DateIso): boolean {
  const annee = Number(d.slice(0, 4));
  if (!cacheFeries.has(annee)) cacheFeries.set(annee, new Set(joursFeries(annee)));
  return cacheFeries.get(annee)!.has(d);
}

/** 0 = dimanche … 6 = samedi. */
export function jourDeSemaine(d: DateIso): number {
  return new Date(versUtc(d)).getUTCDay();
}

export function estJourOuvre(d: DateIso): boolean {
  const j = jourDeSemaine(d);
  return j !== 0 && j !== 6 && !estFerie(d);
}

/** Avance (ou recule si n < 0) de n jours ouvrés ; n = 0 renvoie la date telle quelle. */
export function ajouterJoursOuvres(d: DateIso, n: number): DateIso {
  const pas = n < 0 ? -1 : 1;
  let reste = Math.abs(n);
  let courant = d;
  while (reste > 0) {
    courant = ajouterJours(courant, pas);
    if (estJourOuvre(courant)) reste--;
  }
  return courant;
}

/** Nombre de jours ouvrés écoulés après a, jusqu'à b inclus (0 si b ≤ a). Sert aux retards RG-21 à RG-23. */
export function joursOuvresEcoules(a: DateIso, b: DateIso): number {
  let n = 0;
  for (let c = ajouterJours(a, 1); joursEntre(c, b) >= 0; c = ajouterJours(c, 1)) if (estJourOuvre(c)) n++;
  return n;
}

/** Semaine ISO 8601 au format de la spec : « 2026-S44 ». */
export function semaineIso(d: DateIso): string {
  const jour = (jourDeSemaine(d) + 6) % 7; // lundi = 0
  const jeudi = ajouterJours(d, 3 - jour);
  const annee = Number(jeudi.slice(0, 4));
  const semaine = Math.floor(joursEntre(`${annee}-01-01`, jeudi) / 7) + 1;
  return `${annee}-S${String(semaine).padStart(2, "0")}`;
}

/** Lundi d'une semaine « 2026-S44 ». */
export function lundiDeSemaine(semaine: string): DateIso {
  const [annee, s] = semaine.split("-S").map(Number);
  const quatreJanvier = `${annee}-01-04`;
  const lundiS1 = ajouterJours(quatreJanvier, -((jourDeSemaine(quatreJanvier) + 6) % 7));
  return ajouterJours(lundiS1, (s - 1) * 7);
}
