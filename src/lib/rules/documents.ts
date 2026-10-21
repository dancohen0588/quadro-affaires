/**
 * Noms attendus des documents (section 7.3) : gabarits du process (« BDC {CONTREMARQUE} - {Projet} »)
 * remplis avec les données de l'affaire. Servira aussi au renommage au dépôt (J5).
 */

export type ValeursGabarit = {
  contremarque: string;
  projet: string;
  /** Nom affiché du client (NOM Prénom ou raison sociale). */
  client: string;
  /** Semaine ISO « 2026-S41 », si connue. */
  semaine?: string | null;
  fournisseur?: string | null;
  /** Numéro de version (BPA v1.01, v2.01…). */
  version?: number;
};

const capitale = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Remplit un gabarit ; une valeur inconnue reste lisible (« S00 », « {FOURNISSEUR} » devient « FOURNISSEUR »). */
export function nomAttendu(gabarit: string, v: ValeursGabarit): string {
  const champs: Record<string, string> = {
    CONTREMARQUE: v.contremarque.toUpperCase(),
    Projet: capitale(v.projet),
    PROJET: v.projet.toUpperCase(),
    Client: v.client,
    CLIENT: v.client.toUpperCase(),
    SEM: v.semaine?.match(/S(\d{2})$/)?.[1] ?? "00",
    FOURNISSEUR: v.fournisseur?.toUpperCase() ?? "FOURNISSEUR",
    N: String(v.version ?? 1),
  };
  return gabarit.replace(/\{([A-Za-z]+)\}/g, (tout, cle: string) => champs[cle] ?? cle);
}

// ── Dépôt d'un document (section 7.3, J5) ────────────────────────────────────────────────────────

/** Extension en minuscules (« Plan.PDF » → « pdf »), vide s'il n'y en a pas. */
export const extension = (nom: string) => /\.([a-z0-9]{1,6})$/i.exec(nom)?.[1].toLowerCase() ?? "";

/** Le format est-il accepté pour ce document (jpeg compté comme jpg) ? Sans liste, tout est accepté. */
export function formatAccepte(formats: readonly string[] | undefined, nom: string): boolean {
  if (!formats?.length) return true;
  const ext = extension(nom).replace(/^jpeg$/, "jpg");
  return formats.includes(ext);
}

/**
 * Nom du fichier rangé : le gabarit rempli (« BDC ROUX - Cuisine.pdf ») ; sans gabarit (« libre », débit
 * AGEM au « nom Gesteos conservé »), le nom d'origine. L'extension d'origine est toujours gardée.
 */
export function nomDeDepot(gabarit: string | null | undefined, v: ValeursGabarit, nomOriginal: string): string {
  const original = nomOriginal.replace(/[\\/:*?"<>|]/g, "-").trim() || "document";
  if (!gabarit) return original;
  const ext = extension(original);
  return `${nomAttendu(gabarit, v).replace(/[\\/:*?"<>|]/g, "-")}${ext ? `.${ext}` : ""}`;
}

/** Tâche du process accomplie par le dépôt du document (« Enregistrer le débit Word dans PCloud 05 »…). */
export const TACHE_DU_DOCUMENT: Record<string, string> = {
  entree_client: "enregistrer_entree",
  releve: "photos_releve",
  debit_agem: "enregistrer_debit",
  arc_agem: "enregistrer_arc",
  bpa: "enregistrer_confirmation",
  retour_adv: "enregistrer_retours_adv",
  ar_fournisseur: "enregistrer_ar",
  photos_sav: "photos_sav",
  photos_finales: "photos_menuisiers",
};
