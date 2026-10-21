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
  id: string;
  url: string | null;
}

export interface FichierDepose {
  id: string;
  cheminRelatif: string;
}

export interface FileStore {
  /** Copie le modèle « NOUVEAU CLIENT » pour une affaire (section 13.4). */
  creerDossierClient(input: { magasinCode: string; nomDossier: string }): Promise<DossierClient>;
  /** Range un fichier, déjà renommé selon le gabarit, dans un sous-dossier du dossier client. */
  deposer(input: {
    dossierId: string;
    sousDossier: string;
    nomFinal: string;
    contenu: Blob;
  }): Promise<FichierDepose>;
  /** Liste le contenu d'un sous-dossier (contrôle des documents attendus). */
  lister(input: { dossierId: string; sousDossier: string }): Promise<string[]>;
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

export interface AuthAdapter {
  /** `personnage` en démo (page « Choisir un personnage »), `microsoft` en production (B1). */
  readonly methode: "personnage" | "microsoft";
  /** Chemin de la page de connexion propre à la méthode. */
  readonly cheminConnexion: string;
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
