import Link from "next/link";
import { FileText, FolderOpen } from "lucide-react";
import type { DocumentVue, IntervenantVue } from "@/lib/affaire/fiche";
import type { EvenementVue } from "@/lib/affaire/historique";
import { dateCourte } from "@/lib/format";
import { Etat } from "./pastille-phase";

export function Bloc({ titre, id, action, children }: { titre: string; id: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id={id} className="text-[17px] text-encre">{titre}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const ETAT_DOC = { ok: ["ok", "OK"], attendu: ["attention", "Attendu"], a_venir: ["neutre", "À venir"] } as const;

/** Documents attendus, liste de contrôle par étape (EF-35) ; dépôt et rangement dans le PCloud simulé (J5). */
export function DocumentsAttendus({ documents, annee, deposer, lienPcloud }: { documents: DocumentVue[]; annee: number; deposer?: React.ReactNode; lienPcloud: string }) {
  return (
    <Bloc titre="Documents attendus" id="titre-documents" action={deposer}>
      {documents.length === 0 ? (
        <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucun document attendu à ce stade.</p>
      ) : (
        <ul className="divide-y px-5">
          {documents.map((d) => {
            const [ton, libelle] = ETAT_DOC[d.statut];
            return (
              <li key={d.code} className="flex items-center gap-3 py-3">
                <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-md ${d.statut === "ok" ? "bg-sage-100 text-teal-700" : "border border-dashed text-muted-foreground"}`}>
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-encre" title={d.libelle}>{d.libelle}</p>
                  {d.nom !== d.libelle && (
                    <p className="truncate font-mono text-[12px] text-encre/80" title={d.nom}>
                      {d.nom}{d.deposeLe ? ` · ${dateCourte(d.deposeLe, annee)}` : ""}
                    </p>
                  )}
                  <p className="truncate font-mono text-[12px] text-muted-foreground" title={d.dossier}>{d.dossier}</p>
                </div>
                <Etat ton={ton}>{libelle}</Etat>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[13px] text-muted-foreground">
        Déposé ici, un fichier est renommé et rangé dans PCloud au bon endroit.
        <Link href={lienPcloud} className="inline-flex items-center gap-1 font-semibold text-teal-700 underline-offset-2 hover:underline">
          <FolderOpen aria-hidden className="size-3.5" /> PCloud (simulé)
        </Link>
      </p>
    </Bloc>
  );
}

const TON_STATUT: Record<string, "ok" | "attention" | "neutre"> = { "Validé": "ok", "En cours": "attention", "À venir": "neutre", "Planifié": "neutre" };

/** Intervenants de l'affaire selon les étapes (EF-39). */
export function Intervenants({ intervenants, poseur }: { intervenants: IntervenantVue[]; poseur: { nom: string; detail: string } | null }) {
  return (
    <Bloc titre="Intervenants" id="titre-intervenants">
      <ul className="flex flex-col gap-2.5 px-5 py-4">
        {intervenants.map((i) => (
          <li key={i.prenom} className="flex items-center gap-2.5">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-500 text-[11px] font-bold text-teal-900">{i.initiales}</span>
            <span className="flex-1 text-[15px]">{i.prenom} · <span className="text-muted-foreground">{i.mission}</span></span>
            {i.detail && <span className="font-mono text-[12px] text-muted-foreground">{i.detail}</span>}
            {i.statut && <Etat ton={TON_STATUT[i.statut] ?? "neutre"}>{i.statut}</Etat>}
          </li>
        ))}
        {poseur && (
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">PO</span>
            <span className="flex-1 text-[15px]">{poseur.nom} · <span className="text-muted-foreground">{poseur.detail}</span></span>
            <Etat ton="neutre">Planifié</Etat>
          </li>
        )}
      </ul>
    </Bloc>
  );
}

/** Historique lisible (EF-40). */
export function Historique({ evenements, annee }: { evenements: EvenementVue[]; annee: number }) {
  return (
    <Bloc titre="Historique" id="titre-historique">
      {evenements.length === 0 ? (
        <p className="px-5 py-4 text-[15px] text-muted-foreground">Rien pour l&apos;instant.</p>
      ) : (
        <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto px-5 py-4">
          {evenements.map((e) => (
            <li key={e.id} className="grid grid-cols-[4.5rem_1fr] gap-3 text-[15px]">
              <span className="font-mono text-[12px] leading-6 text-muted-foreground">{dateCourte(e.jour, annee)}</span>
              <span>{e.texte}{e.auteur && <span className="text-muted-foreground"> · {e.auteur}</span>}</span>
            </li>
          ))}
        </ol>
      )}
    </Bloc>
  );
}
