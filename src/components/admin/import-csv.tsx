"use client";

import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Upload } from "lucide-react";
import { importerAffaires, type RapportImport } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-[15px]";

/** Import CSV de reprise (section 13.1) : essai sans écriture d'abord, puis import réel, rapport des rejets. */
export function ImportCsv() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [essai, setEssai] = useState(true);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const lancer = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!fichier) return setErreur("Choisissez un fichier CSV.");
    const d = new FormData();
    d.set("fichier", fichier);
    d.set("essai", essai ? "1" : "0");
    setErreur(null);
    setRapport(null);
    demarrer(async () => {
      const r = await importerAffaires(d);
      if (!r.ok) return setErreur(r.message);
      setRapport(r.rapport);
      // Après un essai sans rejet, l'import réel est proposé ; après un import, on revient à l'essai (pas de double import par mégarde).
      setEssai(!(r.rapport.essai && r.rapport.rejets.length === 0));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={lancer} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-72 flex-1 flex-col gap-1.5 text-sm font-semibold">Fichier CSV (UTF-8, séparateur « ; »)
          <input type="file" accept=".csv,text/csv" className={champ} onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setRapport(null); setEssai(true); }} />
        </label>
        <label className="flex h-10 items-center gap-2 text-[15px]">
          <input type="checkbox" checked={essai} onChange={(e) => setEssai(e.target.checked)} className="size-4 accent-teal-700" />
          Essai sans écriture
        </label>
        <Button type="submit" size="lg" disabled={enCours || !fichier}>
          <Upload aria-hidden /> {enCours ? "Lecture…" : essai ? "Lancer l'essai" : "Importer"}
        </Button>
      </form>
      {erreur && <p aria-live="polite" className="flex items-start gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {erreur}</p>}
      {rapport && (
        <section aria-labelledby="rapport-import" aria-live="polite" className="rounded-xl bg-fond px-4 py-3">
          <h3 id="rapport-import" className="text-[16px] text-encre">
            {rapport.essai ? "Essai" : "Import"} : {rapport.acceptees.length} ligne{rapport.acceptees.length > 1 ? "s" : ""} {rapport.essai ? "prête" : "importée"}{rapport.acceptees.length > 1 ? "s" : ""} sur {rapport.total}
            {rapport.rejets.length > 0 && `, ${rapport.rejets.length} rejetée${rapport.rejets.length > 1 ? "s" : ""}`}
          </h3>
          {rapport.essai && rapport.rejets.length === 0 && <p className="mt-1 text-[14px] text-muted-foreground">Aucun rejet : l&apos;essai est décoché, cliquez sur « Importer » pour écrire les affaires.</p>}
          {rapport.rejets.length > 0 && (
            <table className="mt-2 w-full text-left text-[14px]">
              <thead className="text-[12px] text-muted-foreground"><tr><th className="w-20 py-1 font-semibold">Ligne</th><th className="font-semibold">Motif du rejet</th></tr></thead>
              <tbody className="divide-y">
                {rapport.rejets.map((r) => (
                  <tr key={r.numero}><td className="py-1.5 align-top font-mono">{r.numero}</td><td className="py-1.5 text-etat-retard">{r.motifs.join(" · ")}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {rapport.acceptees.length > 0 && (
            <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-[14px] sm:grid-cols-2">
              {rapport.acceptees.map((a) => (
                <li key={a.numero} className="flex items-center gap-2"><CircleCheck aria-hidden className="size-4 shrink-0 text-etat-ok" /> {a.libelle} <span className="text-muted-foreground">· {a.etape}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
