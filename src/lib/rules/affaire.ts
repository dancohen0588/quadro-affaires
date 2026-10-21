/**
 * Règles de l'affaire (docs/conception.md, section 8.1) : RG-02, RG-03 et RG-08.
 * RG-04 (version de process figée) et RG-09 (dernière activité) sont garanties par la base.
 */

export type ClientIdentite = {
  type: "particulier" | "professionnel";
  nom: string;
  prenom?: string | null;
  raison_sociale?: string | null;
};

const espaces = (s: string) => s.trim().replace(/\s+/g, " ");

/** « Marie-claire » → « Marie-Claire » ; « JEAN » → « Jean ». */
function prenomPropre(prenom: string): string {
  return espaces(prenom)
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}

/** Nom affiché du client : `NOM Prénom`, ou la raison sociale d'un professionnel (D2, D24). */
export function nomClient(c: ClientIdentite): string {
  if (c.type === "professionnel" && c.raison_sociale?.trim()) return espaces(c.raison_sociale);
  const prenom = c.prenom?.trim() ? ` ${prenomPropre(c.prenom)}` : "";
  return `${espaces(c.nom).toUpperCase()}${prenom}`;
}

/** RG-03 : libellé `NOM Prénom · Projet` ou `Raison sociale · Projet`. */
export function libelleAffaire(c: ClientIdentite, projet: string): string {
  const p = espaces(projet);
  return `${nomClient(c)} · ${p.charAt(0).toUpperCase()}${p.slice(1)}`;
}

/** Contremarque AGEM préremplie avec le nom du client ; modifiable ensuite (section 6.2). */
export function contremarqueParDefaut(c: ClientIdentite): string {
  return nomClient(c);
}

/**
 * RG-03 : nouveau libellé d'une affaire après un changement du client, ou null s'il ne change pas
 * (libellé modifié à la main, ou identique).
 */
export function libelleRecalcule(
  affaire: { libelle: string; projet: string; libelle_manuel: boolean },
  client: ClientIdentite,
): string | null {
  if (affaire.libelle_manuel) return null;
  const libelle = libelleAffaire(client, affaire.projet);
  return libelle === affaire.libelle ? null : libelle;
}

/** RG-02 : une affaire exige un client et un concepteur (un contact R0 peut exister sans affaire). */
export function erreursAffaire(a: { clientId?: string | null; concepteurId?: string | null; projet?: string | null }): string[] {
  const erreurs: string[] = [];
  if (!a.clientId) erreurs.push("Une affaire exige un client (RG-02).");
  if (!a.concepteurId) erreurs.push("Une affaire exige un concepteur (RG-02).");
  if (!a.projet?.trim()) erreurs.push("Indiquez le projet de l'affaire.");
  return erreurs;
}

/** RG-08 : une vente regroupe des affaires du même client, toutes au statut `active`. */
export function erreursVente(affaires: readonly { libelle: string; client_id: string; statut: string }[]): string[] {
  if (affaires.length === 0) return ["Une vente regroupe au moins une affaire (RG-08)."];
  const erreurs: string[] = [];
  if (new Set(affaires.map((a) => a.client_id)).size > 1) erreurs.push("Les affaires d'une vente doivent appartenir au même client (RG-08).");
  for (const a of affaires.filter((x) => x.statut !== "active")) {
    erreurs.push(`L'affaire ${a.libelle} n'est plus active (RG-08).`);
  }
  return erreurs;
}
