import "server-only";
import { clientAdmin } from "@/lib/supabase/server";

export type PersonnageListe = {
  id: string;
  prenom: string;
  nom: string;
  initiales: string;
  role: "gerant" | "conceptrice" | "transverse";
  magasins: string[];
};

const ORDRE_ROLE = { gerant: 0, conceptrice: 1, transverse: 2 } as const;

/** Personnages de démo actifs, dans l'ordre d'affichage (gérants, conceptrices par magasin, transverses). */
export async function listerPersonnages(): Promise<PersonnageListe[]> {
  const { data, error } = await clientAdmin()
    .from("profil")
    .select("id, prenom, nom, initiales, role, profil_magasin!profil_magasin_profil_id_fkey(magasin(nom))")
    .eq("actif", true);
  if (error) throw new Error(`Lecture des personnages : ${error.message}`);

  type Ligne = { id: string; prenom: string; nom: string; initiales: string; role: string; profil_magasin: { magasin: { nom: string } | null }[] };
  return (data as unknown as Ligne[])
    .map((p) => ({
      id: p.id,
      prenom: p.prenom,
      nom: p.nom,
      initiales: p.initiales,
      role: p.role as PersonnageListe["role"],
      magasins: p.profil_magasin.map((r) => r.magasin?.nom).filter((n): n is string => !!n).sort((a, b) => a.localeCompare(b, "fr")),
    }))
    .sort(
      (a, b) =>
        ORDRE_ROLE[a.role] - ORDRE_ROLE[b.role] ||
        (a.role === "conceptrice" ? (a.magasins[0] ?? "").localeCompare(b.magasins[0] ?? "", "fr") : 0) ||
        a.prenom.localeCompare(b.prenom, "fr"),
    );
}
