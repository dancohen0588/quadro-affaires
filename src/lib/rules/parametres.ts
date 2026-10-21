import { z } from "zod";

/**
 * Paramètres modifiables par les gérants (EF-102, section 6.2) : seuils des règles et listes de choix.
 * Toute valeur passe par ces schémas avant d'être écrite dans la table parametre.
 */

/** Seuils de parametre.seuils, avec leur règle et leur unité, dans l'ordre d'affichage. */
export const SEUILS = [
  ["retard_commerce_jours", "RG-20 Retard commerce", "jours"],
  ["retard_bpa_jours_ouvres", "RG-21 Retard BPA", "jours ouvrés"],
  ["arc_non_recu_jours_ouvres", "RG-22 ARC non reçu", "jours ouvrés"],
  ["ar_non_recu_jours_ouvres", "RG-23 AR non reçu", "jours ouvrés"],
  ["acompte_1_non_recu_jours", "RG-24 Acompte 1 non reçu", "jours"],
  ["acompte_2_non_recu_jours", "RG-25 Acompte 2 non reçu", "jours"],
  ["solde_non_recu_jours", "RG-26 Solde non reçu", "jours"],
  ["inactivite_jours", "RG-27 Inactivité", "jours"],
  ["dossier_pose_incomplet_jours", "RG-28 Dossier de pose incomplet", "jours"],
  ["max_r2_par_jour", "RG-30 R2 par jour et par concepteur", "au plus"],
  ["max_r3_par_semaine", "RG-31 R3 par semaine et par concepteur", "au plus"],
  ["relance_r2_sans_reponse_jours", "RG-34 Relance après un R2 sans réponse", "jours"],
] as const;
export type CleSeuil = (typeof SEUILS)[number][0];

export const seuilsSchema = z.object(
  Object.fromEntries(SEUILS.map(([cle, libelle]) => [cle, z.number({ error: `${libelle} : nombre attendu.` }).int(`${libelle} : nombre entier attendu.`).min(0, `${libelle} : 0 au moins.`).max(365, `${libelle} : 365 au plus.`)])) as Record<CleSeuil, z.ZodNumber>,
);

/** Listes de choix des formulaires. */
export const LISTES = [
  ["types_projet", "Types de projet"],
  ["sources_contact", "Sources du contact"],
  ["motifs_non_vente", "Motifs de non-vente"],
] as const;
export type CleListe = (typeof LISTES)[number][0];

/** Une valeur par ligne : espaces superflus retirés, lignes vides ignorées, doublons refusés. */
export function lireListe(texte: string, libelle: string): { ok: true; valeurs: string[] } | { ok: false; message: string } {
  const valeurs = texte.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!valeurs.length) return { ok: false, message: `${libelle} : au moins une valeur.` };
  if (valeurs.length > 30) return { ok: false, message: `${libelle} : 30 valeurs au plus.` };
  const longue = valeurs.find((v) => v.length > 40);
  if (longue) return { ok: false, message: `${libelle} : « ${longue.slice(0, 20)}… » dépasse 40 caractères.` };
  const vues = new Set<string>();
  for (const v of valeurs) {
    const k = v.toLocaleLowerCase("fr");
    if (vues.has(k)) return { ok: false, message: `${libelle} : « ${v} » en double.` };
    vues.add(k);
  }
  return { ok: true, valeurs };
}
