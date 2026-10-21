/**
 * Interfaces des outils externes (section 5.4).
 * Le code métier ne connaît que ces interfaces ; `APP_MODE` choisit l'implémentation (./index.ts).
 */

// ── Clock ────────────────────────────────────────────────────────────────────────────────────────

/** Date métier au format ISO `AAAA-MM-JJ`, toujours exprimée en Europe/Paris. */
export type DateMetier = string;

export interface Clock {
  /** Instant courant (simulé en démo). */
  now(): Promise<Date>;
  /** Date du jour en Europe/Paris (simulée en démo). */
  today(): Promise<DateMetier>;
}

// ── Mailer ───────────────────────────────────────────────────────────────────────────────────────

export type TypeMail = "digest_quotidien" | "digest_lundi" | "planning" | "bpa" | "facture_recap" | "autre";

export interface MailSortant {
  destinataireId: string | null;
  destinataireEmail: string;
  type: TypeMail;
  objet: string;
  html: string;
  /** Clé d'idempotence (traitements de nuit) : un même mail n'est jamais enregistré deux fois. */
  cle?: string;
}

export interface Mailer {
  /** Démo : enregistré dans la boîte d'envoi (`mail_sortant`). Production : envoyé par Resend (B2) et journalisé. */
  envoyer(mail: MailSortant): Promise<{ id: string }>;
}

// ── FileStore ────────────────────────────────────────────────────────────────────────────────────

export interface DossierClient {
  /** Identifiant du dossier (chemin logique en démo, identifiant PCloud en B3). */
  id: string;
  url: string | null;
}

export interface FichierDepose {
  /** Identifiant du fichier (clé de stockage en démo, identifiant PCloud en B3). */
  id: string;
  /** Nom réellement donné (suffixé « (2) » si le nom existait déjà : rien n'est jamais écrasé). */
  nomFinal: string;
  cheminRelatif: string;
}

export interface FileStore {
  /** Copie le modèle « NOUVEAU CLIENT » (liste des sous-dossiers) pour une affaire (section 13.4). */
  creerDossierClient(input: { chemin: string; sousDossiers: readonly string[] }): Promise<DossierClient>;
  /** Range un fichier, déjà renommé selon le gabarit, dans un sous-dossier du dossier client. */
  deposer(input: {
    dossierId: string;
    sousDossier: string;
    nomFinal: string;
    contenu: Blob;
  }): Promise<FichierDepose>;
  /** Liste le contenu d'un sous-dossier (contrôle des documents attendus). */
  lister(input: { dossierId: string; sousDossier: string }): Promise<string[]>;
  /** Lien de consultation d'un fichier déposé (lien signé de courte durée en démo). */
  lien(input: { fichierId: string }): Promise<string | null>;
}

// ── CalendarSource ───────────────────────────────────────────────────────────────────────────────

export type TypeRdv = "R0" | "R1" | "R2" | "R3" | "R4" | "point_technique" | "point_strategique";

export interface RdvAgenda {
  id: string;
  type: TypeRdv;
  rang: number;
  debut: Date;
  profilId: string;
  affaireId: string | null;
}

export interface CalendarSource {
  /** RDV d'un concepteur sur une période (règles RG-30, RG-31). */
  rdvDe(input: { profilId: string; du: DateMetier; au: DateMetier }): Promise<RdvAgenda[]>;
}

// ── AuthAdapter ──────────────────────────────────────────────────────────────────────────────────

export interface NouveauCompte {
  email: string;
  prenom: string;
  nom: string;
}

export interface AuthAdapter {
  /** `personnage` en démo (page « Choisir un personnage »), `microsoft` en production (B1). */
  readonly methode: "personnage" | "microsoft";
  /** Chemin de la page de connexion propre à la méthode. */
  readonly cheminConnexion: string;
  /**
   * Prépare le compte de connexion d'un nouvel utilisateur (EF-100) et renvoie son identifiant, qui sera celui du profil.
   * Démo : compte au mot de passe commun des personnages, utilisable aussitôt depuis « Choisir un personnage ».
   * B1 : compte sans mot de passe, rattaché à la première connexion Microsoft 365 par l'adresse.
   * Lève CompteExistantError si l'adresse a déjà un compte.
   */
  creerCompte(compte: NouveauCompte): Promise<{ id: string }>;
  /** Annule un compte tout juste créé dont le profil a été refusé (tout ou rien). On ne retire jamais un utilisateur : on le désactive. */
  annulerCompte(id: string): Promise<void>;
}

/** L'adresse a déjà un compte de connexion. */
export class CompteExistantError extends Error {
  constructor(email: string) {
    super(`Un compte existe déjà pour ${email}.`);
    this.name = "CompteExistantError";
  }
}

export interface Adaptateurs {
  auth: AuthAdapter;
  mailer: Mailer;
  fileStore: FileStore;
  calendar: CalendarSource;
  clock: Clock;
}

/** Fonctionnalité prévue mais pas encore livrée : l'erreur dit quand elle arrive. */
export class NonDisponibleError extends Error {
  constructor(fonction: string, bloc: string) {
    super(`${fonction} : disponible au bloc ${bloc} (section 15 de docs/conception.md).`);
    this.name = "NonDisponibleError";
  }
}
