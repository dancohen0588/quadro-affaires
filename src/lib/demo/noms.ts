/**
 * Données fictives de la démo : prénoms et noms courants, rues génériques, communes proches de chaque
 * showroom, numéros de la tranche réservée par l'ARCEP aux œuvres de fiction (06 39 98 xx xx), adresses
 * électroniques en .test (domaine réservé). Aucune donnée réelle de client (CLAUDE.md).
 */
import type { CodeMagasin } from "./personnages";

export const PRENOMS = [
  "Julien", "Sophie", "Thomas", "Camille", "Nicolas", "Julie", "Antoine", "Marie", "Pierre", "Laura",
  "Mathieu", "Émilie", "Sébastien", "Céline", "Guillaume", "Aurélie", "Romain", "Sandrine", "Olivier", "Nathalie",
  "Laurent", "Isabelle", "Frédéric", "Caroline", "Vincent", "Hélène", "Damien", "Audrey", "Cédric", "Elodie",
  "Benoît", "Stéphanie", "Arnaud", "Virginie", "Fabien", "Anne", "Xavier", "Pauline", "Yannick", "Chloé",
] as const;

export const NOMS = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
  "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
  "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand",
  "Garnier", "Faure", "Rousseau", "Blanc", "Guérin", "Muller", "Henry", "Roussel", "Nicolas", "Perrin",
  "Mathieu", "Clément", "Gauthier", "Dumont", "Lopez", "Fontaine", "Chevalier", "Robin", "Masson", "Sanchez",
  "Gérard", "Nguyen", "Boyer", "Denis", "Lemaire", "Duval", "Joly", "Gautier", "Roger", "Roche",
  "Roy", "Noël", "Meyer", "Lucas", "Meunier", "Jean", "Perez", "Marchand", "Dufour", "Blanchard",
  "Barbier", "Brun", "Dumas", "Brunet", "Schmitt", "Leroux", "Colin", "Fernandez", "Renard", "Arnaud",
  "Vidal", "Aubert", "Benali", "Ferrer", "Rossi", "Kaci", "Silva", "Lopes", "Pereira", "Giraud",
] as const;

export const RUES = [
  "rue des Lilas", "chemin des Oliviers", "avenue des Pins", "rue de la Fontaine", "boulevard des Platanes",
  "impasse des Cigales", "chemin de la Colline", "rue du Moulin", "avenue de la Mer", "allée des Mimosas",
  "rue des Écoles", "chemin des Vignes", "rue Pasteur", "avenue Victor Hugo", "rue de la République",
] as const;

export const COMMUNES: Record<CodeMagasin, readonly (readonly [string, string])[]> = {
  AIX: [["Aix-en-Provence", "13090"], ["Aix-en-Provence", "13100"], ["Venelles", "13770"], ["Éguilles", "13510"], ["Gardanne", "13120"], ["Bouc-Bel-Air", "13320"]],
  VAL: [["Marseille", "13011"], ["Marseille", "13012"], ["Marseille", "13013"], ["Allauch", "13190"], ["Plan-de-Cuques", "13380"], ["Aubagne", "13400"]],
  CIO: [["La Ciotat", "13600"], ["Ceyreste", "13600"], ["Cassis", "13260"], ["Saint-Cyr-sur-Mer", "83270"], ["Roquefort-la-Bédoule", "13830"]],
};

/** Sociétés clientes fictives (clients professionnels, D24). */
export const RAISONS_SOCIALES = [
  "SAS Atelier Morel", "SARL Cabinet Roussel", "SAS Optique du Cap", "SCI Les Restanques", "SARL Agence Horizon",
] as const;

export function telephoneFictif(n: number): string {
  const v = String(n % 10_000).padStart(4, "0");
  return `06 39 98 ${v.slice(0, 2)} ${v.slice(2)}`;
}

export function emailFictif(prenom: string, nom: string, n: number): string {
  const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return `${sansAccent(prenom)}.${sansAccent(nom)}${n}@exemple.test`;
}
