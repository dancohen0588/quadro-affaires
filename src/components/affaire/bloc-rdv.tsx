"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { ajouterRdv, marquerRdvFait } from "@/app/(app)/affaires/actions";
import { Button } from "@/components/ui/button";
import { dateCourte, heure } from "@/lib/format";
import type { RdvVue } from "@/server/fiche-affaire";

const TYPES = [
  ["R1", "R1 · Découverte"], ["R2", "R2 · Approfondissement"], ["R3", "R3 · Présentation"], ["R4", "R4 · Fin de chantier"],
  ["point_technique", "Point technique"], ["point_strategique", "Point stratégique"],
] as const;
const NOMS: Record<string, string> = { point_technique: "Point technique", point_strategique: "Point stratégique" };
const champ = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[14px] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** Bloc RDV de la fiche (EF-34) : liste, ajout, marquage fait. */
export function BlocRdv({ affaireId, rdv, aujourdhui, modifiable }: { affaireId: string; rdv: RdvVue[]; aujourdhui: string; modifiable: boolean }) {
  const router = useRouter();
  const id = useId();
  const [ajout, setAjout] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const annee = Number(aujourdhui.slice(0, 4));

  const enregistrer = (form: FormData) => {
    demarrer(async () => {
      const r = await ajouterRdv({
        affaireId, type: String(form.get("type")) as "R1", date: String(form.get("date")), heure: String(form.get("heure")),
        notes: String(form.get("notes") ?? "") || undefined,
      });
      if (!r.ok) return setErreur(r.message);
      setErreur(null);
      setAjout(false);
      router.refresh();
    });
  };

  return (
    <section aria-labelledby={`${id}-titre`} className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id={`${id}-titre`} className="text-[17px] text-encre">RDV</h2>
        {modifiable && !ajout && (
          <Button variant="outline" onClick={() => setAjout(true)}><Plus aria-hidden /> Ajouter</Button>
        )}
      </header>
      {ajout && (
        <form action={enregistrer} className="grid grid-cols-2 gap-2.5 border-b bg-fond/60 px-5 py-4">
          <label className="col-span-2 flex flex-col gap-1 text-[13px] font-semibold">
            Type
            <select name="type" className={champ} defaultValue="R3">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Date
            <input name="date" type="date" required defaultValue={aujourdhui} className={champ} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Heure
            <input name="heure" type="time" required defaultValue="10:00" step={900} className={champ} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[13px] font-semibold">
            Notes
            <textarea name="notes" rows={2} className={`${champ} h-auto py-2`} />
          </label>
          {erreur && <p aria-live="polite" className="col-span-2 text-[14px] text-etat-retard">{erreur}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setAjout(false); setErreur(null); }}>Annuler</Button>
            <Button type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer le RDV"}</Button>
          </div>
        </form>
      )}
      {rdv.length === 0 ? (
        <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucun RDV.</p>
      ) : (
        <ul className="divide-y px-5">
          {rdv.map((r) => {
            const nom = NOMS[r.type] ?? (r.rang > 1 ? `${r.type}.${r.rang}` : r.type);
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                <span className="w-24 shrink-0 font-semibold text-encre">{nom}</span>
                <span className="flex-1">
                  {dateCourte(r.debut, annee)} · {heure(r.debut)}
                  {r.avec && <span className="text-muted-foreground"> · {r.avec}</span>}
                  {r.notes && <span className="block truncate text-[13px] text-muted-foreground" title={r.notes}>{r.notes}</span>}
                </span>
                {r.statut === "prevu" && modifiable ? (
                  <Button
                    variant="outline" size="sm" disabled={enCours}
                    onClick={() => demarrer(async () => { const x = await marquerRdvFait(affaireId, r.id); if (x.ok) router.refresh(); })}
                  >
                    Marquer fait
                  </Button>
                ) : (
                  <span className={`text-[13px] font-semibold ${r.statut === "fait" ? "text-etat-ok" : "text-muted-foreground"}`}>
                    {r.statut === "fait" ? "Fait" : r.statut === "annule" ? "Annulé" : "Prévu"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
