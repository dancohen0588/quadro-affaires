import { z } from "zod";

/**
 * Magasins et sociétés (EF-101, section 6.2) : champs modifiables depuis l'administration.
 * Les codes (AIX, VAL, CIO…) et le dossier racine PCloud (B3) ne se modifient pas depuis l'écran ;
 * la base le garantit aussi (droits par colonne).
 */

const texteFacultatif = (max: number, libelle: string) =>
  z.string().trim().max(max, `${libelle} trop long (${max} caractères au plus).`).transform((s) => (s === "" ? null : s));

/** SIREN : 9 chiffres et clé de Luhn (contrôle de l'INSEE). Les espaces sont retirés. */
export function sirenValide(siren: string): boolean {
  if (!/^[0-9]{9}$/.test(siren)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let c = Number(siren[8 - i]);
    if (i % 2 === 1) c = c * 2 > 9 ? c * 2 - 9 : c * 2;
    somme += c;
  }
  return somme % 10 === 0;
}

export const magasinSchema = z.object({
  id: z.uuid(),
  nom: z.string().trim().min(1, "Indiquez le nom du magasin.").max(80, "Nom trop long (80 caractères au plus)."),
  societeId: z.uuid("Choisissez la société."),
  adresse: texteFacultatif(200, "Adresse"),
  telephone: z
    .string()
    .trim()
    .refine((t) => t === "" || /^\+?[0-9 .()-]{6,25}$/.test(t), "Téléphone invalide.")
    .transform((t) => (t === "" ? null : t)),
});

export const societeSchema = z.object({
  id: z.uuid(),
  nom: z.string().trim().min(1, "Indiquez le nom de la société.").max(80, "Nom trop long (80 caractères au plus)."),
  siren: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .refine((s) => s === "" || sirenValide(s), "SIREN invalide (9 chiffres, clé de contrôle incorrecte).")
    .transform((s) => (s === "" ? null : s)),
});

export type MagasinSaisi = z.output<typeof magasinSchema>;
export type SocieteSaisie = z.output<typeof societeSchema>;
