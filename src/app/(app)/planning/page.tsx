import type { Metadata } from "next";
import Link from "next/link";
import { adaptateurs } from "@/adapters";
import { Etat } from "@/components/affaire/pastille-phase";
import { RepondrePlanning } from "@/components/vente/dialogues-vente";
import { dateCourte, semaineCourte } from "@/lib/format";
import { NAVIGATION } from "@/lib/navigation";
import { ajouterJours, lundiDeSemaine, semaineIso } from "@/lib/rules/calendrier";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";

const entree = NAVIGATION.find((e) => e.href === "/planning")!;
export const metadata: Metadata = { title: entree.libelle };

type Ligne = {
  statut: string; semaine_livraison_souhaitee: string | null; date_pose_souhaitee: string | null;
  semaine_livraison_confirmee: string | null; date_pose_confirmee: string | null; poseur: string | null; commentaire: string | null; created_at: string;
  vente: { id: string; magasin: { nom: string }; affaire: { id: string; libelle: string }[] };
};

/**
 * Planning (EF-62) : demandes en attente en tête (le gérant y répond, EF-61), puis livraisons et poses
 * confirmées, semaine par semaine. Remplace le groupe WhatsApp du planning (scénario n° 6).
 */
export default async function Planning() {
  const moi = await exigerProfil();
  const db = await clientUtilisateur();
  const aujourdhui = await adaptateurs().clock.today();
  const { data, error } = await db
    .from("planning")
    .select("statut, semaine_livraison_souhaitee, date_pose_souhaitee, semaine_livraison_confirmee, date_pose_confirmee, poseur, commentaire, created_at, vente:vente!inner(id, magasin:magasin(nom), affaire(id, libelle))")
    .order("created_at")
    .limit(500);
  if (error) throw new Error(`Planning : ${error.message}`);
  const lignes = ((data ?? []) as unknown as Ligne[]).filter((l) => l.vente.affaire.length > 0);
  const attente = lignes.filter((l) => l.statut !== "confirmee");
  const confirmes = lignes.filter((l) => l.statut === "confirmee");

  const premiere = lundiDeSemaine(semaineIso(ajouterJours(aujourdhui, -7)));
  const semaines = Array.from({ length: 9 }, (_, i) => semaineIso(ajouterJours(premiere, i * 7)));
  const libelle = (l: Ligne) => l.vente.affaire.map((a) => a.libelle).join(" + ");
  const lien = (l: Ligne) => `/affaires/${l.vente.affaire[0].id}`;
  const courante = semaineIso(aujourdhui);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-6 py-6">
      <div>
        <h1 className="text-3xl text-encre">{entree.libelle}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Livraisons AGEM / Transtock et poses, confirmées par le gérant logistique.</p>
      </div>

      <section aria-label="Demandes en attente" className="rounded-xl bg-card ring-1 ring-foreground/10">
        <header className="border-b px-5 py-3.5">
          <h2 className="text-[17px] text-encre">Demandes en attente <span className="text-[14px] font-semibold text-muted-foreground">({attente.length})</span></h2>
        </header>
        {attente.length === 0 ? (
          <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucune demande en attente.</p>
        ) : (
          <ul className="divide-y px-5">
            {attente.map((l) => (
              <li key={l.vente.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={lien(l)} className="font-semibold text-encre underline-offset-2 hover:underline">{libelle(l)}</Link>
                  <p className="text-[13px] text-muted-foreground">
                    {l.vente.magasin.nom} · souhaité : livraison {l.semaine_livraison_souhaitee ? semaineCourte(l.semaine_livraison_souhaitee) : "?"},
                    pose {l.date_pose_souhaitee ? dateCourte(l.date_pose_souhaitee) : "?"}
                    {l.statut === "decalee" && ` · proposé : ${l.semaine_livraison_confirmee ? semaineCourte(l.semaine_livraison_confirmee) : "?"}, pose ${l.date_pose_confirmee ? dateCourte(l.date_pose_confirmee) : "?"}`}
                  </p>
                </div>
                <Etat ton="attention">{l.statut === "decalee" ? "Dates proposées" : `Demandé le ${dateCourte(l.created_at)}`}</Etat>
                {moi.role === "gerant" && (
                  <RepondrePlanning venteId={l.vente.id} semaine={l.semaine_livraison_souhaitee} datePose={l.date_pose_souhaitee} poseur={l.poseur} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {semaines.map((s) => {
          const [lundi, dimanche] = [lundiDeSemaine(s), ajouterJours(lundiDeSemaine(s), 6)];
          const livraisons = confirmes.filter((l) => l.semaine_livraison_confirmee === s);
          const poses = confirmes.filter((l) => l.date_pose_confirmee && l.date_pose_confirmee >= lundi && l.date_pose_confirmee <= dimanche);
          return (
            <section key={s} aria-label={`Semaine ${semaineCourte(s)}`} className={`rounded-xl bg-card ring-1 ${s === courante ? "ring-teal-500" : "ring-foreground/10"}`}>
              <header className="flex items-baseline justify-between border-b px-4 py-2.5">
                <h2 className="text-[16px] text-encre">{semaineCourte(s)}{s === courante && <span className="ml-2 text-[13px] font-semibold text-teal-700">cette semaine</span>}</h2>
                <span className="text-[13px] text-muted-foreground">{dateCourte(lundi)} – {dateCourte(dimanche)}</span>
              </header>
              <div className="flex flex-col gap-2 px-4 py-3 text-[14px]">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase">Livraisons ({livraisons.length})</p>
                {livraisons.map((l) => <Link key={`l-${l.vente.id}`} href={lien(l)} className="truncate underline-offset-2 hover:underline">{libelle(l)}</Link>)}
                <p className="mt-1 text-[12px] font-semibold text-muted-foreground uppercase">Poses ({poses.length})</p>
                {poses.map((l) => (
                  <Link key={`p-${l.vente.id}`} href={lien(l)} className="truncate underline-offset-2 hover:underline">
                    {dateCourte(l.date_pose_confirmee!)} · {libelle(l)}{l.poseur ? ` · ${l.poseur}` : ""}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
