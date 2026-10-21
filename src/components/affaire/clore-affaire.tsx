"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { cloreAffaire } from "@/app/(app)/affaires/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Clore une affaire avant la vente, perdue ou abandonnée, avec un motif (EF-25, RG-06). */
export function CloreAffaire({ affaireId, motifs }: { affaireId: string; motifs: string[] }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [statut, setStatut] = useState<"perdue" | "abandonnee">("perdue");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); setMotif(""); setErreur(null); }}>
      <DialogTrigger render={<Button variant="ghost" className="h-10 px-3 text-[15px]" />}>Clore</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clore l&apos;affaire</DialogTitle>
          <DialogDescription>Les étapes ouvertes sont fermées, leurs tâches annulées ; l&apos;affaire passe à l&apos;archivage.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4 text-[15px]">
          {([["perdue", "Perdue"], ["abandonnee", "Abandonnée"]] as const).map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name={`${id}-statut`} checked={statut === v} onChange={() => setStatut(v)} className="accent-teal-700" />
              {l}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Motif (RG-06)
          <select value={motif} onChange={(e) => { setMotif(e.target.value); setErreur(null); }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]">
            <option value="">Choisir un motif…</option>
            {motifs.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </label>
        {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button
            size="lg" disabled={enCours}
            onClick={() => {
              if (!motif) return setErreur("Choisissez un motif.");
              demarrer(async () => {
                const r = await cloreAffaire({ affaireId, statut, motif });
                if (!r.ok) return setErreur(r.message);
                setOuvert(false);
                router.refresh();
              });
            }}
          >
            Clore l&apos;affaire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
