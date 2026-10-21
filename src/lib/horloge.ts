import { instantParis } from "./format";
import { ajouterJours, jourDeSemaine, joursEntre, type DateIso } from "./rules/calendrier";

/**
 * Horloge de démo (section 5.4) : calculs purs du panneau. La date simulée est l'heure réelle décalée de
 * `parametre.horloge_demo.decalage_secondes` ; chaque avance rejoue les traitements de nuit des jours franchis.
 */

export type Pas = "jour" | "semaine" | "lundi" | "reel";
export const HEURE_NUIT = "06:30"; // digest quotidien (section 11) ; le digest du lundi part avec lui

const parisJour = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const parisHeure = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** Instant simulé visé par un bouton. « Lundi 7 h » : le prochain lundi 7 h strictement après l'instant simulé. */
export function cibleHorloge(pas: Pas, simule: Date, reel: Date): Date {
  if (pas === "reel") return reel;
  if (pas === "jour" || pas === "semaine") return new Date(simule.getTime() + (pas === "jour" ? 1 : 7) * 86_400_000);
  const jour = parisJour(simule);
  const ecart = (8 - jourDeSemaine(jour)) % 7; // jours jusqu'au prochain lundi (0 si lundi)
  const lundi = ecart === 0 && parisHeure(simule) < "07:00" ? jour : ajouterJours(jour, ecart || 7);
  return new Date(instantParis(lundi, "07:00"));
}

/** Jours dont l'heure des traitements de nuit (6 h 30) est franchie en passant de `de` à `a` : ]de, a]. */
export function joursFranchis(de: Date, a: Date): DateIso[] {
  const debut = parisJour(de);
  const jours: DateIso[] = [];
  for (let i = 0; i <= joursEntre(debut, parisJour(a)); i++) {
    const jour = ajouterJours(debut, i);
    const nuit = new Date(instantParis(jour, HEURE_NUIT)).getTime();
    if (nuit > de.getTime() && nuit <= a.getTime()) jours.push(jour);
  }
  return jours;
}

/** Décalage (secondes, arrondi) qui fait afficher `cible` à l'horloge quand l'heure réelle vaut `reel`. */
export const decalagePour = (cible: Date, reel: Date) => Math.round((cible.getTime() - reel.getTime()) / 1000);

/** « +3 j 2 h », « −1 h », « aucun » : décalage lisible pour le panneau. */
export function decalageLisible(secondes: number): string {
  if (Math.abs(secondes) < 60) return "aucun";
  const signe = secondes < 0 ? "−" : "+";
  const s = Math.abs(secondes);
  const j = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${signe}${[j && `${j} j`, h && `${h} h`, !j && m && `${m} min`].filter(Boolean).join(" ")}`;
}
