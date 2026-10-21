import "server-only";
import { cache } from "react";
import { clientUtilisateur } from "@/lib/supabase/server";

export type ProfilCourant = {
  id: string;
  prenom: string;
  nom: string;
  initiales: string;
  role: "gerant" | "conceptrice" | "transverse";
  estAdmin: boolean;
  rubriques: string[];
  magasins: { code: string; nom: string }[];
};

export type EtatSession =
  | { etat: "anonyme" }
  | { etat: "sans_profil"; userId: string } // compte connecté sans profil actif (EF-02)
  | { etat: "connecte"; profil: ProfilCourant };

/** Session et profil de l'utilisateur, lus une fois par requête. La RLS ne renvoie que des profils actifs. */
export const lireSession = cache(async (): Promise<EtatSession> => {
  const supabase = await clientUtilisateur();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { etat: "anonyme" };

  const { data } = await supabase
    .from("profil")
    .select("id, prenom, nom, initiales, role, est_admin, rubriques, actif, profil_magasin!profil_magasin_profil_id_fkey(magasin(code, nom))")
    .eq("id", userId)
    .eq("actif", true)
    .maybeSingle();
  if (!data) return { etat: "sans_profil", userId };

  type Rattachement = { magasin: { code: string; nom: string } | null };
  const magasins = ((data.profil_magasin ?? []) as unknown as Rattachement[])
    .map((r) => r.magasin)
    .filter((m): m is { code: string; nom: string } => !!m)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return {
    etat: "connecte",
    profil: {
      id: data.id,
      prenom: data.prenom,
      nom: data.nom,
      initiales: data.initiales,
      role: data.role as ProfilCourant["role"],
      estAdmin: data.est_admin,
      rubriques: data.rubriques ?? [],
      magasins,
    },
  };
});
