/**
 * Référentiel et personnages de la démonstration (sections 3 et 6.2).
 * Comptes fictifs : adresses en .test (domaine réservé, jamais distribué), aucun mail réel.
 */

export const DOMAINE_DEMO = "demo.quadro-affaires.test";

export type CodeMagasin = "AIX" | "VAL" | "CIO";

export const SOCIETES = [
  { code: "VAL", nom: "JVB La Valentine" },
  { code: "AIX", nom: "JVB Aix" },
  { code: "CIO", nom: "JVB La Ciotat" },
  { code: "BAJV", nom: "BAJV Agencements" },
  { code: "HOLD", nom: "JVB Holding" },
] as const;

export const MAGASINS: readonly { code: CodeMagasin; nom: string; societe: string }[] = [
  { code: "AIX", nom: "Aix La Pioline", societe: "AIX" },
  { code: "VAL", nom: "Marseille La Valentine", societe: "VAL" },
  { code: "CIO", nom: "La Ciotat", societe: "CIO" },
];

export type Personnage = {
  cle: string;
  prenom: string;
  nom: string;
  initiales: string;
  role: "gerant" | "conceptrice" | "transverse";
  estAdmin: boolean;
  rubriques: ("r4_avis" | "dossiers_pose")[];
  magasins: CodeMagasin[];
  usage: string;
  /** Rôle de référence dans le paramétrage (section 6.2). */
  referent?: "gerant_logistique" | "gerant_bpa" | "gerant_finance" | "responsable_r4";
};

const TOUS: CodeMagasin[] = ["AIX", "VAL", "CIO"];

export const PERSONNAGES: readonly Personnage[] = [
  { cle: "jean", prenom: "Jean", nom: "Farhat", initiales: "JF", role: "gerant", estAdmin: true, rubriques: [], magasins: ["VAL", "CIO"], usage: "Règlements, factures récapitulatives, pilotage, réunion du mardi. Vend aussi.", referent: "gerant_finance" },
  { cle: "valentin", prenom: "Valentin", nom: "Tramoni", initiales: "VT", role: "gerant", estAdmin: true, rubriques: [], magasins: ["AIX", "CIO"], usage: "Planning de livraison et de pose, vérification des dossiers de pose.", referent: "gerant_logistique" },
  { cle: "benjamin", prenom: "Benjamin", nom: "Tramoni", initiales: "BT", role: "gerant", estAdmin: true, rubriques: [], magasins: TOUS, usage: "BPA AGEM, plans AGEM des dossiers de pose, appui technique.", referent: "gerant_bpa" },
  { cle: "clara", prenom: "Clara", nom: "", initiales: "CL", role: "conceptrice", estAdmin: false, rubriques: [], magasins: ["VAL"], usage: "Ses affaires du R0 à la clôture." },
  { cle: "lea", prenom: "Léa", nom: "", initiales: "LÉ", role: "conceptrice", estAdmin: false, rubriques: [], magasins: ["VAL"], usage: "Ses affaires du R0 à la clôture." },
  { cle: "alexia", prenom: "Alexia", nom: "", initiales: "AL", role: "conceptrice", estAdmin: false, rubriques: [], magasins: ["AIX"], usage: "Ses affaires du R0 à la clôture." },
  { cle: "lisa-marie", prenom: "Lisa-Marie", nom: "", initiales: "LM", role: "conceptrice", estAdmin: false, rubriques: [], magasins: ["AIX"], usage: "Ses affaires du R0 à la clôture." },
  { cle: "manon", prenom: "Manon", nom: "", initiales: "MA", role: "conceptrice", estAdmin: false, rubriques: [], magasins: ["CIO"], usage: "Ses affaires du R0 à la clôture (magasin pilote)." },
  { cle: "eva", prenom: "Eva", nom: "", initiales: "EV", role: "conceptrice", estAdmin: false, rubriques: [], magasins: ["CIO"], usage: "Ses affaires du R0 à la clôture (magasin pilote)." },
  { cle: "elsie", prenom: "Elsie", nom: "", initiales: "EL", role: "transverse", estAdmin: false, rubriques: ["r4_avis"], magasins: TOUS, usage: "R4 de fin de chantier, demandes d'avis Google.", referent: "responsable_r4" },
  { cle: "adrian", prenom: "Adrian", nom: "", initiales: "AD", role: "transverse", estAdmin: false, rubriques: ["dossiers_pose"], magasins: TOUS, usage: "Consultation des dossiers de pose (BAJV Agencements)." },
];

export function emailPersonnage(p: Pick<Personnage, "cle">): string {
  return `${p.cle}@${DOMAINE_DEMO}`;
}

export const LIBELLES_ROLE: Record<Personnage["role"], string> = {
  gerant: "Gérant",
  conceptrice: "Conceptrice",
  transverse: "Transverse",
};
