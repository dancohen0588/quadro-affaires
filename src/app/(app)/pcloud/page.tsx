import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { z } from "zod";
import { dateCourte } from "@/lib/format";
import { compterFichiers, construireArbre, type NoeudArbre } from "@/lib/pcloud";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { chargerPcloudClient } from "@/server/pcloud";

export const metadata: Metadata = { title: "PCloud (simulé)" };

/**
 * PCloud simulé (section 13.4, J5) : l'arborescence d'un client, un dossier par affaire copié du modèle
 * « NOUVEAU CLIENT », avec les fichiers déposés depuis l'outil. En B3, le vrai PCloud remplace ce stockage.
 */
export default async function Pcloud({ searchParams }: PageProps<"/pcloud">) {
  await exigerProfil();
  const sp = await searchParams;
  let clientId = typeof sp.client === "string" && z.uuid().safeParse(sp.client).success ? sp.client : null;
  if (!clientId && typeof sp.affaire === "string" && z.uuid().safeParse(sp.affaire).success) {
    const { data } = await (await clientUtilisateur()).from("affaire").select("client_id").eq("id", sp.affaire).maybeSingle();
    clientId = data?.client_id ?? null;
  }
  if (!clientId) notFound();
  const p = await chargerPcloudClient(clientId);
  if (!p) notFound();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-6">
      <div>
        <p className="text-[13px] font-semibold tracking-[0.12em] text-teal-700 uppercase">PCloud (simulé)</p>
        <h1 className="text-3xl text-encre">{p.client.nom}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Un dossier par affaire, copié du modèle « NOUVEAU CLIENT » (liste provisoire des sous-dossiers, à confirmer). Démonstration : les fichiers restent dans un stockage de test.
        </p>
      </div>
      {p.dossiers.map((d) => {
        const arbre = construireArbre(p.modele, d.fichiers);
        return (
          <section key={d.affaireId} id={`affaire-${d.affaireId}`} aria-labelledby={`pcloud-${d.affaireId}`} className="scroll-mt-4 rounded-xl bg-card ring-1 ring-foreground/10">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3">
              <h2 id={`pcloud-${d.affaireId}`} className="flex items-center gap-2 text-[17px] text-encre">
                <FolderOpen aria-hidden className="size-5 text-teal-700" />
                <span className="font-mono text-[14px] font-semibold">{d.chemin ?? "Dossier pas encore créé"}</span>
              </h2>
              <Link href={`/affaires/${d.affaireId}`} className="text-[14px] font-semibold text-teal-700 underline-offset-2 hover:underline">{d.libelle}</Link>
            </header>
            <ul className="px-3 py-2 text-[14px]">
              {arbre.map((n) => <Noeud key={n.chemin} n={n} />)}
            </ul>
          </section>
        );
      })}
      {p.dossiers.length === 0 && <p className="text-muted-foreground">Ce client n&apos;a pas encore d&apos;affaire.</p>}
    </div>
  );
}

function Noeud({ n }: { n: NoeudArbre }) {
  const total = compterFichiers(n);
  return (
    <li>
      <details open={total > 0} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 hover:bg-fond">
          <ChevronRight aria-hidden className="size-3.5 text-muted-foreground transition group-open:rotate-90" />
          <Folder aria-hidden className={`size-4 ${total ? "text-teal-700" : "text-muted-foreground"}`} />
          <span className={total ? "font-semibold text-encre" : "text-muted-foreground"}>{n.nom}</span>
          {total > 0 && <span className="text-[12px] text-muted-foreground">({total})</span>}
        </summary>
        <ul className="ml-5 border-l pl-2">
          {n.enfants.map((e) => <Noeud key={e.chemin} n={e} />)}
          {n.fichiers.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-2 py-1">
              <FileText aria-hidden className="size-4 shrink-0 text-teal-700" />
              {f.lien ? (
                <a href={f.lien} target="_blank" rel="noreferrer" className="truncate font-mono text-[13px] text-encre underline-offset-2 hover:underline">{f.nom}</a>
              ) : (
                <span className="truncate font-mono text-[13px] text-encre">{f.nom}</span>
              )}
              <span className="shrink-0 text-[12px] text-muted-foreground">{dateCourte(f.deposeLe)}{f.parQui ? ` · ${f.parQui}` : ""}</span>
            </li>
          ))}
          {n.enfants.length === 0 && n.fichiers.length === 0 && <li className="px-2 py-1 text-[13px] text-muted-foreground">vide</li>}
        </ul>
      </details>
    </li>
  );
}
