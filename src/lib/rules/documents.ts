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
