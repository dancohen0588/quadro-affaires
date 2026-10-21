import type { Metadata } from "next";
import Link from "next/link";
import { adaptateurs } from "@/adapters";
import { PastillePhase } from "@/components/affaire/pastille-phase";
import { depuis } from "@/lib/format";
import { NAVIGATION } from "@/lib/navigation";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";

const entree = NAVIGATION.find((e) => e.href === "/affaires")!;
export const metadata: Metadata = { title: entree.libelle };

/**
 * Liste des affaires en cours visibles par l'utilisateur, pour ouvrir une fiche (EF-30). Version
 * simple de la session 2.2 : la liste complète « Mes affaires » (filtres, échéances, états) arrive en session 3.1.
 */
export default async function Page({ searchParams }: PageProps<"/affaires">) {
  const moi = await exigerProfil();
  const { q, toutes } = await searchParams;
  const recherche = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const db = await clientUtilisateur();
  let requete = db
    .from("affaire")
    .select("id, libelle, contremarque, etape_courante_code, statut, derniere_activite_at, magasin:magasin(nom), concepteur:profil!affaire_concepteur_id_fkey(id, prenom), process_version_id")
    .in("statut", ["active", "gagnee"])
    .order("derniere_activite_at", { ascending: false })
    .limit(200);
  const miennes = moi.role !== "gerant" && toutes === undefined && !recherche;
  if (miennes && moi.role === "conceptrice") requete = requete.eq("concepteur_id", moi.id);
  if (recherche) {
    const motif = `%${recherche.replace(/[%_,()]/g, " ")}%`;
    requete = requete.or(`libelle.ilike.${motif},contremarque.ilike.${motif}`);
  }
  const { data, error } = await requete;
  if (error) throw new Error(`Lecture des affaires : ${error.message}`);
  const aujourdhui = await adaptateurs().clock.today();
  // Une définition par version de process (RG-04), pour nommer les étapes.
  const versions = [...new Set((data ?? []).map((l) => l.process_version_id))];
  const { data: defs } = versions.length
    ? await db.from("process_version").select("id, definition").in("id", versions)
    : { data: [] };
  type Definition = { phases: { numero: string; nom: string; couleur: string; etapes: { code: string; titre: string }[] }[] };
  const definitions = new Map((defs ?? []).map((d) => [d.id, d.definition as unknown as Definition]));

  type Ligne = {
    id: string; libelle: string; contremarque: string; etape_courante_code: string | null; derniere_activite_at: string;
    magasin: { nom: string }; concepteur: { prenom: string }; process_version_id: string;
  };
  const lignes = (data ?? []) as unknown as Ligne[];
  const etapeDe = (l: Ligne) => {
    for (const p of definitions.get(l.process_version_id)?.phases ?? []) {
      const e = p.etapes.find((x) => x.code === l.etape_courante_code);
      if (e) return { phase: p, titre: e.titre };
    }
    return null;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-encre">{recherche ? `Recherche « ${recherche} »` : miennes ? entree.libelle : "Affaires en cours"}</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {lignes.length} affaire{lignes.length > 1 ? "s" : ""} en cours, de la plus récemment active à la plus ancienne.
          </p>
        </div>
        {moi.role !== "gerant" && !recherche && (
          <Link href={miennes ? "/affaires?toutes" : "/affaires"} className="text-[15px] font-semibold text-teal-700 underline-offset-2 hover:underline">
            {miennes ? "Voir toutes les affaires du magasin" : "Voir seulement mes affaires"}
          </Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b text-[13px] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Affaire</th>
              <th className="px-4 py-3 font-semibold">Étape</th>
              <th className="px-4 py-3 font-semibold">Magasin</th>
              <th className="px-4 py-3 font-semibold">Concepteur</th>
              <th className="px-4 py-3 font-semibold">Dernier mouvement</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignes.map((l) => {
              const e = etapeDe(l);
              return (
                <tr key={l.id} className="hover:bg-fond">
                  <td className="px-4 py-2.5">
                    <Link href={`/affaires/${l.id}`} className="font-semibold text-encre underline-offset-2 hover:underline">{l.libelle}</Link>
                    <span className="block font-mono text-[12px] text-muted-foreground">{l.contremarque}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {e ? <PastillePhase couleur={e.phase.couleur}>{e.phase.numero} · {e.titre}</PastillePhase> : "—"}
                  </td>
                  <td className="px-4 py-2.5">{l.magasin.nom}</td>
                  <td className="px-4 py-2.5">{l.concepteur.prenom}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{depuis(l.derniere_activite_at, aujourdhui)}</td>
                </tr>
              );
            })}
            {lignes.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune affaire en cours.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
