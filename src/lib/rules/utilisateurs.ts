import { z } from "zod";

/**
 * Ajout d'un utilisateur (EF-100, section 6.2) : adresse du domaine du groupe, rôle, magasins, rubriques.
 * Les droits (administrateurs seulement) et l'unicité de l'adresse sont gardés en base (public.creer_profil).
 */

/** Domaine des adresses de l'équipe (section 6.2, profil.email). */
export const DOMAINE_QUADRO = "magasin-quadro.fr";

export const ROLES = ["gerant", "conceptrice", "transverse"] as const;
export const RUBRIQUES = ["r4_avis", "dossiers_pose"] as const;

/** Domaine d'une adresse, en minuscules (chaîne vide si l'adresse n'en a pas). */
export function domaineDe(email: string): string {
  const i = email.lastIndexOf("@");
  return i < 0 ? "" : email.slice(i + 1).trim().toLowerCase();
}

/**
 * Initiales des pastilles : prénom et nom, sinon les deux parties d'un prénom composé, sinon les deux premières
 * lettres du prénom (comme les personnages : « JF », « LM », « CL »).
 */
export function initialesDe(prenom: string, nom: string): string {
  const lettres = (s: string) => [...s.normalize("NFC").trim()].filter((c) => /\p{L}/u.test(c));
  const parties = prenom.trim().split(/[\s-]+/).filter(Boolean);
  const n = lettres(nom);
  let resultat: string[];
  if (parties.length && n.length) resultat = [lettres(parties[0])[0], n[0]];
  else if (parties.length >= 2) resultat = [lettres(parties[0])[0], lettres(parties[1])[0]];
  else resultat = lettres(prenom).slice(0, 2);
  return resultat.filter(Boolean).join("").toLocaleUpperCase("fr-FR").slice(0, 3) || "?";
}

/**
 * Schéma du formulaire « Ajouter un utilisateur ». `domaines` : domaines acceptés (le domaine du groupe, plus le
 * domaine fictif des personnages en démo).
 */
export function nouvelUtilisateurSchema(domaines: readonly string[]) {
  return z
    .object({
      prenom: z.string().trim().min(1, "Indiquez le prénom.").max(60, "Prénom trop long (60 caractères au plus)."),
      nom: z.string().trim().max(60, "Nom trop long (60 caractères au plus).").default(""),
      email: z.string().trim().toLowerCase().pipe(z.email("Adresse invalide.")),
      role: z.enum(ROLES, "Choisissez un rôle."),
      magasins: z.array(z.string()).min(1, "Rattachez l'utilisateur à au moins un magasin."),
      rubriques: z.array(z.enum(RUBRIQUES)).default([]),
    })
    .superRefine((v, ctx) => {
      if (!domaines.includes(domaineDe(v.email))) {
        ctx.addIssue({ code: "custom", path: ["email"], message: `Adresse du domaine ${domaines.join(" ou ")} attendue.` });
      }
      if (v.role === "transverse" && v.rubriques.length === 0) {
        ctx.addIssue({ code: "custom", path: ["rubriques"], message: "Choisissez au moins une rubrique pour un profil transverse." });
      }
    })
    .transform((v) => ({ ...v, rubriques: v.role === "transverse" ? v.rubriques : [], initiales: initialesDe(v.prenom, v.nom) }));
}

export type NouvelUtilisateur = z.output<ReturnType<typeof nouvelUtilisateurSchema>>;
