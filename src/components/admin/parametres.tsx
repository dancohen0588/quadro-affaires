"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { enregistrerListe, enregistrerReferents, enregistrerSeuils } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { LISTES, SEUILS, type CleListe } from "@/lib/rules/parametres";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";
type Retour = { ok: boolean; message?: string } | null;

function Message({ r }: { r: Retour }) {
  if (!r?.message) return null;
  return (
    <p aria-live="polite" className={`flex items-center gap-2 text-[14px] ${r.ok ? "text-etat-ok" : "text-etat-retard"}`}>
      {r.ok ? <CircleCheck aria-hidden className="size-4" /> : <CircleAlert aria-hidden className="size-4" />} {r.message}
    </p>
  );
}

/** Seuils des règles RG-20 à RG-34 (EF-102). */
export function FormSeuils({ seuils, modifiable }: { seuils: Record<string, number>; modifiable: boolean }) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState(() => Object.fromEntries(SEUILS.map(([c]) => [c, String(seuils[c] ?? "")])));
  const [retour, setRetour] = useState<Retour>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        demarrer(async () => {
          const r = await enregistrerSeuils(Object.fromEntries(Object.entries(valeurs).map(([c, v]) => [c, v.trim() === "" ? Number.NaN : Number(v)])));
          setRetour(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
        {SEUILS.map(([cle, libelle, unite]) => (
          <label key={cle} className="grid grid-cols-[1fr_5.5rem_6.5rem] items-center gap-2 text-[14px]">
            <span>{libelle}</span>
            <input type="number" min={0} max={365} step={1} value={valeurs[cle]} disabled={!modifiable}
              onChange={(e) => setValeurs({ ...valeurs, [cle]: e.target.value })} className={`${champ} h-9 text-right`} aria-label={libelle} />
            <span className="text-muted-foreground">{unite}</span>
          </label>
        ))}
      </div>
      <Message r={retour} />
      {modifiable && <div><Button type="submit" size="lg" disabled={enCours}>Enregistrer les seuils</Button></div>}
    </form>
  );
}

/** Listes de choix (types de projet, sources, motifs), une valeur par ligne. */
export function FormListe({ cle, valeurs, modifiable }: { cle: CleListe; valeurs: string[]; modifiable: boolean }) {
  const router = useRouter();
  const libelle = LISTES.find(([c]) => c === cle)![1];
  const [texte, setTexte] = useState(valeurs.join("\n"));
  const [retour, setRetour] = useState<Retour>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">{libelle}
        <textarea rows={8} value={texte} disabled={!modifiable} onChange={(e) => setTexte(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[15px] font-normal" />
      </label>
      <Message r={retour} />
      {modifiable && (
        <div>
          <Button variant="outline" size="sm" disabled={enCours} onClick={() => demarrer(async () => {
            const r = await enregistrerListe(cle, texte);
            setRetour(r);
            if (r.ok) router.refresh();
          })}>Enregistrer</Button>
        </div>
      )}
    </div>
  );
}

const ROLES_REFERENTS = [
  ["gerant_bpa", "Plans et BPA"], ["gerant_logistique", "Livraison et pose"], ["gerant_finance", "Facture récapitulative"], ["responsable_r4", "R4 et avis Google"],
] as const;

/** Gérants référents des étapes (section 7.2). */
export function FormReferents({ referents, personnes, modifiable }: {
  referents: Record<string, string | null>; personnes: { id: string; nom: string }[]; modifiable: boolean;
}) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => Object.fromEntries(ROLES_REFERENTS.map(([r]) => [r, referents[r] ?? ""])));
  const [retour, setRetour] = useState<Retour>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES_REFERENTS.map(([r, l]) => (
          <label key={r} className="flex flex-col gap-1.5 text-sm font-semibold">{l}
            <select value={valeurs[r]} disabled={!modifiable} onChange={(e) => setValeurs({ ...valeurs, [r]: e.target.value })} className={champ}>
              <option value="">Choisir…</option>
              {personnes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </label>
        ))}
      </div>
      <Message r={retour} />
      {modifiable && (
        <div>
          <Button variant="outline" size="sm" disabled={enCours} onClick={() => demarrer(async () => {
            const r = await enregistrerReferents(valeurs);
            setRetour(r);
            if (r.ok) router.refresh();
          })}>Enregistrer les référents</Button>
        </div>
      )}
    </div>
  );
}
