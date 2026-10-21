"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { reassignerAffaire } from "@/app/(app)/affaires/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Réassigner l'affaire à un autre concepteur (EF-41, gérants). */
export function Reassigner({ affaireId, actuel, possibles }: { affaireId: string; actuel: string; possibles: { id: string; nom: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState(actuel);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); setChoix(actuel); setErreur(null); }}>
      <DialogTrigger render={<Button variant="ghost" className="h-10 px-3 text-[15px]" />}>Réassigner</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réassigner l&apos;affaire</DialogTitle>
          <DialogDescription>Le nouveau concepteur reçoit les tâches à venir de l&apos;affaire.</DialogDescription>
        </DialogHeader>
        <label htmlFor={`${id}-c`} className="text-sm font-semibold">Concepteur</label>
        <select
          id={`${id}-c`} value={choix} onChange={(e) => setChoix(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]"
        >
          {possibles.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button
            size="lg" disabled={choix === actuel || enCours}
            onClick={() => demarrer(async () => {
              const r = await reassignerAffaire(affaireId, choix);
              if (!r.ok) return setErreur(r.message);
              setOuvert(false);
              router.refresh();
            })}
          >
            Réassigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
