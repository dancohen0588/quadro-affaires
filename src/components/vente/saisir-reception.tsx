"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saisirReception } from "@/app/(app)/ventes/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { centimesDepuis, euros } from "@/lib/format";
import { LIBELLES_ECHEANCE, MODES } from "./libelles";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";

/** Saisie d'un règlement reçu (EF-52) : date, montant (partiel possible), mode. */
export function SaisirReception({
  echeance, aujourdhui, libelle,
}: { echeance: { id: string; type: string; montantPrevuCts: number; mode: string | null }; aujourdhui: string; libelle?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState(aujourdhui);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const titre = LIBELLES_ECHEANCE[echeance.type] ?? echeance.type;
  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (o) { setDate(aujourdhui); setMontant((echeance.montantPrevuCts / 100).toFixed(2).replace(".", ",")); setMode(echeance.mode ?? ""); setErreur(null); }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Saisir la réception : ${titre}${libelle ? ` · ${libelle}` : ""}`} />}>Saisir</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre} reçu</DialogTitle>
          <DialogDescription>{libelle ? `${libelle} · ` : ""}prévu {euros(echeance.montantPrevuCts)}. Un montant inférieur laisse la ligne partiellement reçue.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Reçu le
            <input type="date" max={aujourdhui} value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Montant (€)
            <input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={champ}>
              {MODES.filter(([v]) => !(v === "franfinance" && echeance.type === "acompte_1")).map(([v, t]) => <option key={v} value={v}>{v ? t : "Choisir…"}</option>)}
            </select>
          </label>
        </div>
        {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button
            size="lg" disabled={enCours}
            onClick={() => {
              const cts = centimesDepuis(montant);
              if (!cts) return setErreur("Saisissez le montant reçu.");
              if (!mode) return setErreur("Choisissez le mode de règlement.");
              demarrer(async () => {
                const r = await saisirReception({ echeanceId: echeance.id, recuLe: date, montantCts: cts, mode: mode as "cheque" });
                if (!r.ok) return setErreur(r.message);
                setOuvert(false);
                router.refresh();
              });
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
