import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { Bloc } from "@/components/affaire/blocs-lateraux";
import { NouvellesAffaires } from "@/components/clients/nouvelles-affaires";
import { dateCourte, euros, heure } from "@/lib/format";
import { nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { chargerReferentiel } from "@/server/referentiel";

export const metadata: Metadata = { title: "Fiche client" };

const STATUTS: Record<string, [string, "ok" | "attention" | "retard" | "neutre"]> = {
  active: ["En cours", "attention"], gagnee: ["Vendue", "ok"], perdue: ["Perdue", "retard"], abandonnee: ["Abandonnée", "neutre"], cloturee: ["Clôturée", "ok"],
};
const RDV: Record<string, string> = { point_technique: "Point technique", point_strategique: "Point stratégique" };

type Definition = { phases: { numero: string; couleur: string; etapes: { code: string; titre: string }[] }[] };

/** Fiche client (EF-22) : coordonnées, affaires passées et en cours, ventes, RDV. */
export default async function FicheClient({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const moi = await exigerProfil();
  const db = await clientUtilisateur();
  const { data: c } = await db
    .from("client")
    .select("id, type, nom, prenom, raison_sociale, telephone, email, adresse, code_postal, ville, cnq, source, rappel_convenu_le, gesteos_ref, created_at, magasin:magasin(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [affaires, ventes, rdv, referentiel, aujourdhui] = await Promise.all([
    db.from("affaire")
      .select("id, libelle, projet, statut, motif_perte, etape_courante_code, montant_devis_ht_cts, created_at, process_version_id, magasin:magasin(nom), concepteur:profil!affaire_concepteur_id_fkey(prenom)")
      .eq("client_id", id).order("created_at", { ascending: false }),
    db.from("vente").select("id, date_signature, montant_ttc_cts").eq("client_id", id).order("date_signature", { ascending: false }),
    db.from("rdv").select("id, type, rang, debut, statut, notes, affaire_id").eq("client_id", id).order("debut", { ascending: false }).limit(20),
    chargerReferentiel(moi),
    adaptateurs().clock.today(),
  ]);
  const versions = [...new Set((affaires.data ?? []).map((a) => a.process_version_id))];
  const { data: defs } = versions.length ? await db.from("process_version").select("id, definition").in("id", versions) : { data: [] };
  const definitions = new Map((defs ?? []).map((d) => [d.id, d.definition as unknown as Definition]));
  const etapeDe = (versionId: string, code: string | null) => {
    for (const p of definitions.get(versionId)?.phases ?? []) {
      const e = p.etapes.find((x) => x.code === code);
      if (e) return { ...e, phase: p };
    }
    return null;
  };
  const nom = nomClient(c as ClientIdentite);
  const annee = Number(aujourdhui.slice(0, 4));
  const libelleAffaire = new Map((affaires.data ?? []).map((a) => [a.id, a.libelle]));
  type AffaireLue = NonNullable<typeof affaires.data>[number] & { magasin: { nom: string }; concepteur: { prenom: string } };
  const peutCreer = moi.role !== "transverse";

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-card px-8 py-4">
        <div>
          <h1 className="text-[26px] leading-tight text-encre">{nom}</h1>
          <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
            {[c.type === "professionnel" ? "Professionnel" : "Particulier", (c.magasin as unknown as { nom: string }).nom, c.gesteos_ref].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/pcloud?client=${c.id}`} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal-700 underline-offset-2 hover:underline">
            <FolderOpen aria-hidden className="size-4" /> PCloud (simulé)
          </Link>
          {peutCreer && <NouvellesAffaires client={{ id: c.id, nom }} referentiel={referentiel} moi={{ id: moi.id, estGerant: moi.role === "gerant" }} />}
        </div>
      </header>

      <div className="grid gap-5 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Bloc titre="Affaires" id="titre-affaires">
            {(affaires.data ?? []).length === 0 ? (
              <p className="px-5 py-4 text-[15px] text-muted-foreground">Pas encore d&apos;affaire : le contact est au R0.</p>
            ) : (
              <ul className="divide-y px-5">
                {((affaires.data ?? []) as AffaireLue[]).map((a) => {
                  const e = etapeDe(a.process_version_id, a.etape_courante_code);
                  const [statut, ton] = STATUTS[a.statut] ?? [a.statut, "neutre"];
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
                      <Link href={`/affaires/${a.id}`} className="min-w-48 flex-1 font-semibold text-encre underline-offset-2 hover:underline">{a.libelle}</Link>
                      {a.statut === "active" || a.statut === "gagnee" ? (
                        e ? <PastillePhase couleur={e.phase.couleur}>{e.phase.numero} · {e.titre}</PastillePhase> : null
                      ) : null}
                      <Etat ton={ton}>{statut}{a.motif_perte ? ` · ${a.motif_perte}` : ""}</Etat>
                      <span className="w-40 text-right text-[14px] text-muted-foreground">{a.concepteur.prenom} · {a.magasin.nom.replace("Marseille ", "")}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloc>

          <Bloc titre="Ventes" id="titre-ventes">
            {(ventes.data ?? []).length === 0 ? (
              <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucune vente.</p>
            ) : (
              <ul className="divide-y px-5">
                {(ventes.data ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-3 text-[15px]">
                    <span>Signée le {dateCourte(v.date_signature, annee)}</span>
                    <span className="font-semibold text-encre">{euros(v.montant_ttc_cts, true)} TTC</span>
                  </li>
                ))}
              </ul>
            )}
          </Bloc>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Bloc titre="Coordonnées" id="titre-coordonnees">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 px-5 py-4 text-[15px]">
              <dt className="text-muted-foreground">Téléphone</dt><dd>{c.cnq ? <Etat ton="neutre">CNQ</Etat> : (c.telephone ?? "—")}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{c.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Adresse</dt>
              <dd>{[c.adresse, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</dd>
              <dt className="text-muted-foreground">Source</dt><dd>{c.source ?? "—"}</dd>
              <dt className="text-muted-foreground">Rappel</dt>
              <dd>{c.rappel_convenu_le ? `convenu le ${dateCourte(c.rappel_convenu_le, annee)}` : "—"}</dd>
              <dt className="text-muted-foreground">Connu depuis</dt><dd>{dateCourte(c.created_at, annee)}</dd>
            </dl>
          </Bloc>
          <Bloc titre="RDV" id="titre-rdv-client">
            {(rdv.data ?? []).length === 0 ? (
              <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucun RDV.</p>
            ) : (
              <ul className="divide-y px-5">
                {(rdv.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                    <span className="w-24 shrink-0 font-semibold text-encre">{RDV[r.type] ?? (r.rang > 1 ? `${r.type}.${r.rang}` : r.type)}</span>
                    <span className="flex-1">
                      {dateCourte(r.debut, annee)} · {heure(r.debut)}
                      {r.affaire_id && <span className="block truncate text-[13px] text-muted-foreground">{libelleAffaire.get(r.affaire_id)}</span>}
                    </span>
                    <span className={`text-[13px] font-semibold ${r.statut === "fait" ? "text-etat-ok" : "text-muted-foreground"}`}>
                      {r.statut === "fait" ? "Fait" : r.statut === "annule" ? "Annulé" : "Prévu"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloc>
        </div>
      </div>
    </div>
  );
}
