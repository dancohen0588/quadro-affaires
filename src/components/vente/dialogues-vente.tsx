"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { marquerCommission, modifierEcheancier, repondrePlanning } from "@/app/(app)/ventes/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { centimesDepuis, champDepuisSemaine, semaineDepuisChamp } from "@/lib/format";
import { EditeurEcheancier, type LigneSaisie } from "./editeur-echeancier";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";

export type EcheanceVue = {
  id: string; type: string; ordre: number; montantPrevuCts: number; montantRecuCts: number | null; recuLe: string | null;
  dateAttendue: string | null; mode: string | null; commentaire: string | null;
};

/** Modifier l'échéancier d'une vente (EF-51, RG-13). */
export function ModifierEcheancier({ venteId, echeances, ttcCts, dateSignature }: { venteId: string; echeances: EcheanceVue[]; ttcCts: number; dateSignature: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (o) {
          setErreur(null);
          setLignes(echeances.map((e) => ({
            id: e.id, type: e.type as LigneSaisie["type"], montant: (e.montantPrevuCts / 100).toFixed(2).replace(".", ","),
            dateAttendue: e.dateAttendue ?? "", mode: e.mode ?? "", commentaire: e.commentaire ?? "", recue: !!e.recuLe,
          })));
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Modifier l&apos;échéancier</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;échéancier</DialogTitle>
          <DialogDescription>Chèques échelonnés : ajoutez des lignes ; une ligne inutile passe à 0. Les règlements reçus ne changent pas.</DialogDescription>
        </DialogHeader>
        <EditeurEcheancier lignes={lignes} onChange={setLignes} ttcCts={ttcCts} dateSignature={dateSignature} />
        {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button
            size="lg" disabled={enCours}
            onClick={() => demarrer(async () => {
              const r = await modifierEcheancier({
                venteId,
                lignes: lignes.map((l) => ({
                  id: l.id, type: l.type, montantCts: centimesDepuis(l.montant) ?? -1, dateAttendue: l.dateAttendue || null,
                  mode: (l.mode || null) as never, commentaire: l.commentaire || null,
                })),
              });
              if (!r.ok) return setErreur(r.message);
              setOuvert(false);
              router.refresh();
            })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** RG-14 : la vente est reportée au tableau de commission. */
export function BoutonCommission({ venteId }: { venteId: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={enCours} onClick={() => demarrer(async () => { await marquerCommission(venteId); router.refresh(); })}>
      Commission saisie
    </Button>
  );
}

/** Réponse du gérant à une demande de planning (EF-61) : confirmer, ou proposer d'autres dates. */
export function RepondrePlanning({
  venteId, semaine, datePose, poseur,
}: { venteId: string; semaine: string | null; datePose: string | null; poseur: string | null }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [statut, setStatut] = useState<"confirmee" | "decalee">("confirmee");
  const [champSemaine, setChampSemaine] = useState("");
  const [pose, setPose] = useState("");
  const [nomPoseur, setNomPoseur] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (o) { setStatut("confirmee"); setChampSemaine(champDepuisSemaine(semaine)); setPose(datePose ?? ""); setNomPoseur(poseur ?? "BAJV Agencements"); setCommentaire(""); setErreur(null); }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>Répondre</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planning de livraison et de pose</DialogTitle>
          <DialogDescription>Le concepteur est prévenu de votre réponse (EF-61).</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4 text-[15px]">
          {([["confirmee", "Confirmer"], ["decalee", "Proposer d'autres dates"]] as const).map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name={`${id}-statut`} checked={statut === v} onChange={() => setStatut(v)} className="accent-teal-700" /> {l}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Semaine de livraison
            <input type="week" value={champSemaine} onChange={(e) => setChampSemaine(e.target.value)} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Date de pose
            <input type="date" value={pose} onChange={(e) => setPose(e.target.value)} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Poseur
            <input value={nomPoseur} onChange={(e) => setNomPoseur(e.target.value)} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Commentaire
            <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className={champ} />
          </label>
        </div>
        {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button
            size="lg" disabled={enCours}
            onClick={() => {
              const s = semaineDepuisChamp(champSemaine);
              if (!s || !pose) return setErreur("Indiquez la semaine de livraison et la date de pose.");
              demarrer(async () => {
                const r = await repondrePlanning({ venteId, statut, semaine: s, datePose: pose, poseur: nomPoseur || undefined, commentaire: commentaire || undefined });
                if (!r.ok) return setErreur(r.message);
                setOuvert(false);
                router.refresh();
              });
            }}
          >
            {statut === "confirmee" ? "Confirmer" : "Proposer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
