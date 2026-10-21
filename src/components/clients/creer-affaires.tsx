"use client";

import { useId, useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { creerAffaires } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import type { Referentiel } from "@/server/referentiel";

export const champ =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Création d'une ou plusieurs affaires pour un client (EF-23) : projets, concepteur, magasin, étape de
 * départ (R0 à rappeler ou R1 découverte) ; libellés et contremarque préremplis (RG-03).
 */
export function CreerAffaires({
  client, referentiel, moi, onCree, onAnnuler,
}: {
  client: { id: string; nom: string };
  referentiel: Pick<Referentiel, "projets" | "concepteurs" | "magasins">;
  moi: { id: string; estGerant: boolean };
  onCree: (ids: string[]) => void;
  onAnnuler?: () => void;
}) {
  const id = useId();
  const [projets, setProjets] = useState<string[]>([]);
  const [magasin, setMagasin] = useState(referentiel.magasins[0]?.code ?? "");
  const [concepteur, setConcepteur] = useState(moi.id);
  const [contremarque, setContremarque] = useState(client.nom);
  const [depart, setDepart] = useState<"R0" | "R1">("R1");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const concepteurs = referentiel.concepteurs.filter((c) => c.id === moi.id || c.magasins.includes(magasin));

  const soumettre = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (projets.length === 0) return setErreur("Choisissez au moins un projet.");
    demarrer(async () => {
      const r = await creerAffaires({
        clientId: client.id, projets, contremarque: contremarque.trim() || undefined,
        concepteurId: concepteur, magasinCode: magasin, depart,
      });
      if (!r.ok) return setErreur(r.message);
      onCree(r.affaires);
    });
  };

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Projets (une affaire par projet)</legend>
        <div className="flex flex-wrap gap-2">
          {referentiel.projets.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[15px] has-checked:border-teal-500 has-checked:bg-sage-100">
              <input
                type="checkbox" className="size-4 accent-teal-700" checked={projets.includes(p)}
                onChange={(e) => { setErreur(null); setProjets((l) => (e.target.checked ? [...l, p] : l.filter((x) => x !== p))); }}
              />
              {capitale(p)}
            </label>
          ))}
        </div>
      </fieldset>
      {projets.length > 0 && (
        <ul className="rounded-lg bg-fond px-3 py-2 text-[14px]" aria-label="Affaires qui seront créées">
          {projets.map((p) => <li key={p} className="font-semibold text-encre">{client.nom} · {capitale(p)}</li>)}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {referentiel.magasins.length > 1 && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Magasin
            <select value={magasin} onChange={(e) => setMagasin(e.target.value)} className={champ}>
              {referentiel.magasins.map((m) => <option key={m.code} value={m.code}>{m.nom}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Concepteur
          <select value={concepteur} onChange={(e) => setConcepteur(e.target.value)} className={champ}>
            {concepteurs.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.id === moi.id ? " (moi)" : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Contremarque
          <input value={contremarque} onChange={(e) => setContremarque(e.target.value)} className={champ} />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Où en est le client ?</legend>
        {([["R1", "Découverte faite ou en cours (R1)"], ["R0", "Premier contact, à rappeler (R0)"]] as const).map(([v, l]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2.5 text-[15px]">
            <input type="radio" name={`${id}-depart`} checked={depart === v} onChange={() => setDepart(v)} className="accent-teal-700" />
            {l}
          </label>
        ))}
      </fieldset>
      {erreur && (
        <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard">
          <CircleAlert aria-hidden className="size-4 shrink-0" /> {erreur}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onAnnuler && <Button type="button" variant="outline" size="lg" onClick={onAnnuler}>Annuler</Button>}
        <Button type="submit" size="lg" disabled={enCours}>
          {enCours ? "Création…" : projets.length > 1 ? `Créer les ${projets.length} affaires` : "Créer l'affaire"}
        </Button>
      </div>
    </form>
  );
}
