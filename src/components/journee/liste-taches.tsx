"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "cn";
import { cocherMaTache, reporterTache } from "@/app/(app)/ma-journee/actions";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { badgeEcheance, grouperParAffaire, type TacheJournee } from "@/lib/affaire/journee";
import type { EtapeAffichee } from "@/server/journee";

const ANNULATION_MS = 10_000;
const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";

/**
 * Tâches de Ma journée groupées par affaire (EF-10) : cocher (annulable 10 secondes, EF-11) et reporter
 * (EF-12). Une tâche cochée reste affichée, barrée, jusqu'au lendemain.
 */
export function ListeTaches({
  taches, aujourdhui, etapes, vide,
}: { taches: TacheJournee[]; aujourdhui: string; etapes: Record<string, EtapeAffichee>; vide: string }) {
  const router = useRouter();
  const id = useId();
  const [etat, setEtat] = useState<Record<string, boolean>>({});
  const [annulables, setAnnulables] = useState<Record<string, number>>({});
  const [aReporter, setAReporter] = useState<TacheJournee | null>(null);
  const [date, setDate] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [, rafraichir] = useState(0);

  // Fait disparaître le bouton « Annuler » au bout de 10 secondes.
  useEffect(() => {
    const ids = Object.keys(annulables);
    if (!ids.length) return;
    const t = setTimeout(() => {
      const maintenant = Date.now();
      setAnnulables((a) => Object.fromEntries(Object.entries(a).filter(([, fin]) => fin > maintenant)));
      rafraichir((n) => n + 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [annulables]);

  const cocher = (t: TacheJournee, faite: boolean) => {
    setEtat((e) => ({ ...e, [t.id]: faite }));
    setAnnulables((a) => (faite ? { ...a, [t.id]: Date.now() + ANNULATION_MS } : Object.fromEntries(Object.entries(a).filter(([k]) => k !== t.id))));
    demarrer(async () => {
      const r = await cocherMaTache(t.id, faite);
      if (!r.ok) setEtat((e) => ({ ...e, [t.id]: !faite }));
      router.refresh();
    });
  };

  const groupes = grouperParAffaire(taches);
  if (groupes.length === 0) return <p className="px-5 py-6 text-[15px] text-muted-foreground">{vide}</p>;

  return (
    <>
      <div className="divide-y px-5">
        {groupes.map((g) => {
          const e = g.affaire?.etape ? etapes[g.affaire.etape] : undefined;
          return (
            <section key={g.affaire?.id ?? "sans-affaire"} className="py-3" aria-label={g.affaire?.libelle ?? "Sans affaire"}>
              <header className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {g.affaire ? (
                  <>
                    <Link href={`/affaires/${g.affaire.id}`} className="font-semibold text-encre underline-offset-2 hover:underline">{g.affaire.libelle}</Link>
                    {e && <PastillePhase couleur={e.couleur}>{e.titre}</PastillePhase>}
                  </>
                ) : (
                  <span className="font-semibold text-muted-foreground">Sans affaire</span>
                )}
              </header>
              <ul className="flex flex-col">
                {g.taches.map((t) => {
                  const faite = etat[t.id] ?? t.statut === "faite";
                  const badge = badgeEcheance({ echeance: t.echeance, statut: faite ? "faite" : "a_faire" }, aujourdhui);
                  const annulable = (annulables[t.id] ?? 0) > Date.now();
                  return (
                    <li key={t.id} className="flex items-start gap-3 rounded-lg py-2" data-tache={t.id}>
                      <input
                        type="checkbox" checked={faite} aria-label={`Fait : ${t.titre}`}
                        onChange={(ev) => cocher(t, ev.target.checked)} className="mt-1 size-[18px] shrink-0 accent-teal-700"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[15px] font-semibold text-encre", faite && "font-normal text-muted-foreground line-through")}>{t.titre}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {faite ? "Fait aujourd'hui" : [t.etape !== e?.titre ? t.etape : null, t.detail, t.origine === "libre" ? "Tâche libre" : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {annulable ? (
                        <Button variant="outline" size="sm" onClick={() => cocher(t, false)}>Annuler</Button>
                      ) : (
                        !faite && (
                          <Button
                            variant="ghost" size="icon-sm" aria-label={`Reporter : ${t.titre}`} title="Reporter"
                            onClick={() => { setAReporter(t); setDate(""); setMotif(""); setErreur(null); }}
                          >
                            <CalendarClock aria-hidden />
                          </Button>
                        )
                      )}
                      <Etat ton={badge.ton}>{badge.texte}</Etat>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Dialog open={!!aReporter} onOpenChange={(o) => !o && setAReporter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reporter la tâche</DialogTitle>
            <DialogDescription>{aReporter?.titre}</DialogDescription>
          </DialogHeader>
          <label htmlFor={`${id}-date`} className="text-sm font-semibold">Nouvelle date</label>
          <input id={`${id}-date`} type="date" min={aujourdhui} value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          <label htmlFor={`${id}-motif`} className="text-sm font-semibold">Motif (facultatif)</label>
          <input id={`${id}-motif`} value={motif} onChange={(e) => setMotif(e.target.value)} className={champ} />
          {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setAReporter(null)}>Annuler</Button>
            <Button
              size="lg" disabled={enCours}
              onClick={() => {
                if (!date || !aReporter) return setErreur("Choisissez une date.");
                demarrer(async () => {
                  const r = await reporterTache({ tacheId: aReporter.id, date, motif: motif || undefined });
                  if (!r.ok) return setErreur(r.message);
                  setAReporter(null);
                  router.refresh();
                });
              }}
            >
              Reporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
