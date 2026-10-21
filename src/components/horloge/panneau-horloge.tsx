"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, CircleAlert, RotateCcw } from "lucide-react";
import { avancerHorloge, type ResultatHorloge } from "@/app/(app)/horloge/actions";
import { Button } from "@/components/ui/button";
import { dateCourte } from "@/lib/format";
import type { Pas } from "@/lib/horloge";

const BOUTONS: [Pas, string][] = [["jour", "+1 jour"], ["semaine", "+1 semaine"], ["lundi", "Lundi 7 h"]];

/** Boutons de l'horloge de démo et bilan des traitements de nuit rejoués (session 4.2). */
export function PanneauHorloge() {
  const router = useRouter();
  const [resultat, setResultat] = useState<ResultatHorloge | null>(null);
  const [enCours, demarrer] = useTransition();
  const lancer = (pas: Pas) => demarrer(async () => {
    setResultat(null);
    const r = await avancerHorloge(pas);
    setResultat(r);
    router.refresh();
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {BOUTONS.map(([pas, libelle], i) => (
          <Button key={pas} size="lg" variant={i === 0 ? "default" : "outline"} disabled={enCours} onClick={() => lancer(pas)}>
            {i === 0 && <CalendarClock aria-hidden />} {libelle}
          </Button>
        ))}
        <Button size="lg" variant="ghost" disabled={enCours} onClick={() => lancer("reel")}>
          <RotateCcw aria-hidden /> Revenir à aujourd&apos;hui
        </Button>
      </div>
      <div aria-live="polite" className="text-[15px]">
        {enCours && <p className="text-muted-foreground">Traitements de nuit en cours…</p>}
        {resultat && !resultat.ok && (
          <p className="flex items-center gap-2 text-etat-retard"><CircleAlert aria-hidden className="size-4" /> {resultat.message}</p>
        )}
        {resultat?.ok && (
          resultat.bilans.length === 0 ? (
            <p className="text-muted-foreground">Horloge réglée. Aucune nuit franchie : rien n&apos;a été rejoué.</p>
          ) : (
            <div className="rounded-xl bg-card ring-1 ring-foreground/10">
              <p className="border-b px-4 py-2.5 font-semibold text-encre">
                {resultat.bilans.length} nuit{resultat.bilans.length > 1 ? "s" : ""} rejouée{resultat.bilans.length > 1 ? "s" : ""}
              </p>
              <ul className="divide-y px-4">
                {resultat.bilans.map((b) => (
                  <li key={b.jour} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                    <span className="w-24 font-semibold">{dateCourte(b.jour)}</span>
                    <span>{b.taches} tâche{b.taches > 1 ? "s" : ""} créée{b.taches > 1 ? "s" : ""}</span>
                    <span>{b.digestsQuotidiens} digest{b.digestsQuotidiens > 1 ? "s" : ""} quotidien{b.digestsQuotidiens > 1 ? "s" : ""}</span>
                    {b.digestsLundi > 0 && <span>{b.digestsLundi} digest{b.digestsLundi > 1 ? "s" : ""} du lundi</span>}
                    {b.erreurs.length > 0 && <span className="text-etat-retard">{b.erreurs.length} erreur{b.erreurs.length > 1 ? "s" : ""} : {b.erreurs[0]}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
    </div>
  );
}
