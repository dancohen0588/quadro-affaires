import { z } from "zod";

/**
 * Format de la définition d'un process (docs/conception.md, section 7.1).
 *
 * Extensions par rapport à la 7.1, nécessaires pour exprimer les tableaux de la 7.2 :
 * - `Phase.code` est un identifiant stable (accueil … cloture), recopié dans `etape_instance.phase_code` ;
 * - `Echeance` accepte une tâche sans date (`aucune`, ex. « à réception »), un RDV précis (`rdv`),
 *   la fin de chantier, et « la première de deux dates » (DOSSIER_POSE : J+5 ou J-7 avant la pose) ;
 * - `Issue` accepte le type `fin_branche` (fin de la branche autres fournisseurs, de la facture récapitulative),
 *   des étapes ouvertes en parallèle (`ouvre`, section 7.4), une relance à J+N (`relance_jours`),
 *   une demande d'avis Google (`demande_avis_google`) et une cible si l'avis est déjà obtenu (`vers_si_avis_obtenu`).
 */

export const ROLES = ["concepteur", "gerant_bpa", "gerant_logistique", "gerant_finance", "responsable_r4"] as const;
export const roleSchema = z.enum(ROLES);

export const PHASES = ["accueil", "conception", "vente", "commande", "livraison_pose", "cloture"] as const;
export const codePhaseSchema = z.enum(PHASES);

export const TYPES_RDV = ["R0", "R1", "R2", "R3", "R4"] as const;

const codeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/, "code en MAJUSCULES_SOULIGNÉES");
const codeMinusculeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, "code en minuscules_soulignées");

const echeanceSimpleSchema = z.discriminatedUnion("depuis", [
  z.object({ depuis: z.literal("ouverture_etape"), jours: z.number().int(), ouvres: z.boolean().optional() }),
  z.object({
    depuis: z.literal("rdv"),
    /** RDV de référence ; par défaut celui de l'étape (R2 pour R2…). */
    rdv: z.enum(TYPES_RDV).optional(),
    jours: z.number().int(),
    ouvres: z.boolean().optional(),
  }),
  z.object({ depuis: z.literal("date_pose"), jours: z.number().int(), ouvres: z.boolean().optional() }),
  z.object({ depuis: z.literal("date_livraison"), jours: z.number().int(), ouvres: z.boolean().optional() }),
  z.object({ depuis: z.literal("fin_chantier"), jours: z.number().int(), ouvres: z.boolean().optional() }),
  /** Pas de date : la tâche attend un événement (« à réception ») ; les retards sont suivis par les alertes RG-2x. */
  z.object({ depuis: z.literal("aucune") }),
]);
export type EcheanceSimple = z.infer<typeof echeanceSimpleSchema>;

export const echeanceSchema = z.union([
  echeanceSimpleSchema,
  z.object({ premiere_de: z.tuple([echeanceSimpleSchema, echeanceSimpleSchema]) }),
]);
export type Echeance = z.infer<typeof echeanceSchema>;

export const tacheModeleSchema = z.object({
  code: codeMinusculeSchema,
  titre: z.string().min(3),
  assignee: roleSchema,
  echeance: echeanceSchema,
  optionnelle: z.boolean().optional(),
});
export type TacheModele = z.infer<typeof tacheModeleSchema>;

export const FORMATS = ["jpg", "heic", "pdf", "docx", "xlsx"] as const;

export const documentAttenduSchema = z.object({
  code: codeMinusculeSchema,
  libelle: z.string().min(3),
  /** Chemin dans le dossier client PCloud (section 7.3). */
  dossier: z.string().min(3),
  /** Gabarit de nom ({CONTREMARQUE}, {Projet}, {SEM}…) ; absent = nom libre. */
  gabarit_nom: z.string().min(1).optional(),
  formats: z.array(z.enum(FORMATS)).min(1),
});
export type DocumentAttendu = z.infer<typeof documentAttenduSchema>;

export const TYPES_ISSUE = ["go", "loop", "end", "alert", "wait", "fin_branche"] as const;

export const issueSchema = z.object({
  code: codeMinusculeSchema,
  libelle: z.string().min(2),
  type: z.enum(TYPES_ISSUE),
  vers: codeSchema.optional(),
  /** Étapes ouvertes en parallèle (section 7.4) ; `optionnel` : l'utilisateur décide à la validation. */
  ouvre: z
    .array(z.object({ etape: codeSchema, optionnel: z.boolean().optional(), question: z.string().optional() }))
    .optional(),
  motif_obligatoire: z.boolean().optional(),
  demande_date: z.boolean().optional(),
  relance_jours: z.number().int().positive().optional(),
  demande_avis_google: z.boolean().optional(),
  vers_si_avis_obtenu: codeSchema.optional(),
  statut_affaire: z.enum(["perdue", "abandonnee", "gagnee", "cloturee"]).optional(),
});
export type Issue = z.infer<typeof issueSchema>;

export const REGLES_BLOCAGE = ["acompte_1_non_recu"] as const;

export const etapeSchema = z.object({
  code: codeSchema,
  titre: z.string().min(2),
  branche: z.enum(["principale", "autres_fournisseurs", "sav"]).optional(),
  responsable: roleSchema,
  repetable: z.boolean().optional(),
  bloquee_si: z.array(z.enum(REGLES_BLOCAGE)).optional(),
  taches: z.array(tacheModeleSchema),
  documents: z.array(documentAttenduSchema),
  issues: z.array(issueSchema).min(1),
});
export type Etape = z.infer<typeof etapeSchema>;

export const phaseSchema = z.object({
  code: codePhaseSchema,
  numero: z.string().regex(/^0[1-9]$/),
  nom: z.string().min(2),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  etapes: z.array(etapeSchema).min(1),
});
export type Phase = z.infer<typeof phaseSchema>;

export const processDefinitionSchema = z.object({
  nom: z.string().min(2),
  /** Étape d'entrée du process. */
  depart: codeSchema,
  phases: z.array(phaseSchema).min(1),
});
export type ProcessDefinition = z.infer<typeof processDefinitionSchema>;
