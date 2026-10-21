import { Check, Lock } from "lucide-react";
import { cn } from "cn";
import type { EtapeVue, PhaseVue } from "@/lib/affaire/fiche";
import { dateCourte } from "@/lib/format";
import { CaseTache } from "./case-tache";
import { Etat, PastillePhase } from "./pastille-phase";

const PREFIXES: Record<EtapeVue["branche"], string> = { principale: "", autres_fournisseurs: "En parallèle · ", sav: "SAV · " };

function detailTache(t: EtapeVue["taches"][number], annee: number): string | null {
  const morceaux = [t.echeance ? (t.enRetard ? `en retard depuis le ${dateCourte(t.echeance, annee)}` : `pour le ${dateCourte(t.echeance, annee)}`) : null, t.assignee];
  return morceaux.filter(Boolean).join(" · ") || null;
}

/** Étape faite : issue, date et auteur (EF-31). */
function EtapeFaite({ e, annee }: { e: EtapeVue; annee: number }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold text-encre">{PREFIXES[e.branche]}{e.titre}</span>
      <span className="inline-flex h-6 items-center rounded-full bg-sage-100 px-2.5 text-[13px] font-semibold text-teal-700">
        {e.issue}{e.motif ? ` · ${e.motif}` : ""}
      </span>
      <span className="text-[13px] text-etat-ok">
        <Check aria-hidden className="mr-1 inline size-3.5" />
        {[e.validePar && `validé par ${e.validePar}`, e.fin && `le ${dateCourte(e.fin, annee)}`].filter(Boolean).join(" ")}
      </span>
    </li>
  );
}

/** Étape ouverte : tâches cochables, retard, blocage (EF-31, EF-32). */
function EtapeOuverte({ e, affaireId, modifiable, blocage, annee }: { e: EtapeVue; affaireId: string; modifiable: boolean; blocage: string | null; annee: number }) {
  return (
    <li className="rounded-xl border border-teal-500/30 bg-sage-100/70 px-4 py-3" data-etape-ouverte={e.code}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-heading text-[16px] font-bold text-encre">{PREFIXES[e.branche]}{e.titre}</span>
        <Etat ton="attention">En cours</Etat>
        {e.enRetard && <Etat ton="retard">Tâche en retard</Etat>}
      </div>
      {blocage && (
        <p className="mt-2 flex items-start gap-2 text-[15px] text-etat-retard">
          <Lock aria-hidden className="mt-1 size-4 shrink-0" /> {blocage}
        </p>
      )}
      {e.taches.length > 0 ? (
        <div className="mt-2 flex flex-col">
          {e.taches.map((t) => (
            <CaseTache
              key={t.id} affaireId={affaireId} id={t.id} titre={t.optionnelle ? `${t.titre} (facultatif)` : t.titre}
              faite={t.faite} detail={detailTache(t, annee)} enRetard={t.enRetard} modifiable={modifiable}
            />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[15px] text-muted-foreground">Aucune tâche pour cette étape.</p>
      )}
    </li>
  );
}

function EtapeAVenir({ e }: { e: EtapeVue }) {
  return (
    <li className="text-muted-foreground">
      <span className="font-semibold">{e.titre}</span>
      {e.tachesModeles.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px]">
          {e.tachesModeles.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </li>
  );
}

/**
 * Process de l'affaire en 6 phases (EF-31, EF-33) : phases terminées résumées (détail dépliable), phase en
 * cours détaillée, phases à venir annoncées. Branches parallèles et itérations sont nommées.
 */
export function TimelineProcess({
  phases, nom, faites, total, affaireId, modifiable, blocages, annee,
}: {
  phases: PhaseVue[]; nom: string; faites: number; total: number; affaireId: string; modifiable: boolean;
  blocages: Record<string, string | null>; annee: number;
}) {
  return (
    <section aria-labelledby="titre-process" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 id="titre-process" className="text-[18px] text-encre">Process</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[13px] font-semibold text-muted-foreground">Modèle {nom}</span>
        </div>
        <span className="font-mono text-[13px] text-muted-foreground">{faites} / {total} étapes</span>
      </header>
      <ol className="divide-y px-5">
        {phases.map((p) => {
          const faitesP = p.etapes.filter((e) => e.statut === "faite");
          return (
            <li key={p.code} className="grid gap-3 py-5 md:grid-cols-[180px_1fr]" data-phase={p.code}>
              <div className="flex flex-col gap-1.5">
                <PastillePhase numero={p.numero} nom={p.nom.split(" & ")[0]} couleur={p.couleur} attenuee={p.etat === "a_venir"} />
                <span className="text-[13px] text-muted-foreground">
                  {p.etat === "terminee" ? `Terminée${p.termineeLe ? ` le ${dateCourte(p.termineeLe, annee)}` : ""}` : p.etat === "en_cours" ? "En cours" : p.etapes.length ? "À venir" : "Non atteinte"}
                </span>
              </div>
              <div className="min-w-0">
                {p.etat === "terminee" ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold text-encre">{faitesP.map((e) => e.titre).join(" · ")}</span>
                      <span className="text-[13px] text-etat-ok"><Check aria-hidden className="mr-1 inline size-3.5" />{faitesP.length} étape{faitesP.length > 1 ? "s" : ""}</span>
                      <span className="text-[13px] text-teal-700 underline-offset-2 group-open:hidden hover:underline">Détail</span>
                    </summary>
                    <ul className="mt-3 flex flex-col gap-2 border-l-2 border-sage-500/50 pl-4">
                      {faitesP.map((e) => <EtapeFaite key={e.id} e={e} annee={annee} />)}
                    </ul>
                  </details>
                ) : p.etat === "en_cours" ? (
                  <ul className="flex flex-col gap-3">
                    {p.etapes.map((e) =>
                      e.statut === "faite" ? <EtapeFaite key={e.id} e={e} annee={annee} />
                      : e.statut === "en_cours" ? (
                        <EtapeOuverte key={e.id} e={e} affaireId={affaireId} modifiable={modifiable} blocage={blocages[`${e.code}.${e.iteration}`] ?? null} annee={annee} />
                      ) : <EtapeAVenir key={e.code} e={e} />,
                    )}
                  </ul>
                ) : (
                  <p className={cn("font-semibold", p.etapes.length ? "text-muted-foreground" : "text-muted-foreground/60")}>
                    {p.etapes.length ? p.etapes.map((e) => e.titre).join(" · ") : "—"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
