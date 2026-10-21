import "server-only";
import { clientUtilisateur } from "@/lib/supabase/server";
import type { ProfilCourant } from "./session";

/** Listes utiles aux formulaires (paramètres, magasins, concepteurs), lues avec les droits de l'utilisateur. */
export type Referentiel = {
  magasins: { code: string; nom: string }[];
  sources: string[];
  projets: string[];
  motifs: string[];
  /** Concepteurs possibles d'une affaire (gérants et conceptrices actifs), avec leurs magasins. */
  concepteurs: { id: string; nom: string; magasins: string[] }[];
  /** Personnes à qui confier une tâche libre (EF-13). */
  personnes: { id: string; nom: string }[];
  seuils: { max_r2_par_jour: number; max_r3_par_semaine: number; inactivite_jours: number };
};

export async function chargerReferentiel(moi: ProfilCourant): Promise<Referentiel> {
  const db = await clientUtilisateur();
  const [parametres, magasins, profils] = await Promise.all([
    db.from("parametre").select("cle, valeur").in("cle", ["sources_contact", "types_projet", "motifs_non_vente", "seuils"]),
    db.from("magasin").select("code, nom").order("nom"),
    db.from("profil").select("id, prenom, nom, role, actif, profil_magasin!profil_magasin_profil_id_fkey(magasin(code))").eq("actif", true),
  ]);
  const p = new Map((parametres.data ?? []).map((x) => [x.cle, x.valeur]));
  const seuils = (p.get("seuils") ?? {}) as Partial<Referentiel["seuils"]>;
  type ProfilLu = { id: string; prenom: string; nom: string; role: string; profil_magasin: { magasin: { code: string } | null }[] };
  const lus = (profils.data ?? []) as unknown as ProfilLu[];
  const nom = (x: ProfilLu) => `${x.prenom} ${x.nom}`.trim();
  return {
    magasins: moi.role === "gerant" ? (magasins.data ?? []) : moi.magasins,
    sources: (p.get("sources_contact") ?? []) as string[],
    projets: (p.get("types_projet") ?? []) as string[],
    motifs: (p.get("motifs_non_vente") ?? []) as string[],
    concepteurs: lus
      .filter((x) => x.role === "gerant" || x.role === "conceptrice")
      .map((x) => ({ id: x.id, nom: nom(x), magasins: x.profil_magasin.map((r) => r.magasin?.code).filter((c): c is string => !!c) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    personnes: lus.map((x) => ({ id: x.id, nom: nom(x) })).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    seuils: {
      max_r2_par_jour: seuils.max_r2_par_jour ?? 1,
      max_r3_par_semaine: seuils.max_r3_par_semaine ?? 4,
      inactivite_jours: seuils.inactivite_jours ?? 10,
    },
  };
}
