"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { creerTacheLibre } from "@/app/(app)/ma-journee/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";

/** Tâche libre (EF-13) : titre, échéance, assigné (soi par défaut ou un collègue), affaire facultative. */
export function TacheLibre({
  moi, aujourdhui, personnes, affaires,
}: { moi: string; aujourdhui: string; personnes: { id: string; nom: string }[]; affaires: { id: string; libelle: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState("");
  const [echeance, setEcheance] = useState(aujourdhui);
  const [assignee, setAssignee] = useState(moi);
  const [affaire, setAffaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setTitre(""); setEcheance(aujourdhui); setAssignee(moi); setAffaire(""); setErreur(null); } }}>
      <DialogTrigger render={<Button variant="outline" />}><Plus aria-hidden /> Tâche</DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            demarrer(async () => {
              const r = await creerTacheLibre({ titre, echeance, assigneeId: assignee, affaireId: affaire });
              if (!r.ok) return setErreur(r.message);
              setOuvert(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
            <DialogDescription>Pour vous ou pour un collègue, liée ou non à une affaire.</DialogDescription>
          </DialogHeader>
          <label htmlFor={`${id}-titre`} className="text-sm font-semibold">Titre</label>
          <input id={`${id}-titre`} value={titre} onChange={(e) => setTitre(e.target.value)} className={champ} autoFocus />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Échéance
              <input type="date" min={aujourdhui} value={echeance} onChange={(e) => setEcheance(e.target.value)} className={champ} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Pour
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={champ}>
                {personnes.map((p) => <option key={p.id} value={p.id}>{p.nom}{p.id === moi ? " (moi)" : ""}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Affaire (facultatif)
            <select value={affaire} onChange={(e) => setAffaire(e.target.value)} className={champ}>
              <option value="">Aucune</option>
              {affaires.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
          </label>
          {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button type="submit" size="lg" disabled={enCours}>Créer la tâche</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
