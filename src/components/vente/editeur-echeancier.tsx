"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { centimesDepuis, euros } from "@/lib/format";
import { genererEcheancier } from "@/lib/rules/echeancier";
import { LIBELLES_ECHEANCE, MODES } from "./libelles";

export type LigneSaisie = {
  id?: string;
  type: "acompte_1" | "acompte_2" | "solde" | "autre";
  montant: string;
  dateAttendue: string;
  mode: string;
  commentaire: string;
  recue?: boolean;
};


const champ = "h-9 w-full rounded-lg border border-input bg-background px-2 text-[14px] disabled:bg-muted disabled:text-muted-foreground";
const versEuros = (cts: number) => (cts / 100).toFixed(2).replace(".", ",");

/** Lignes standard 40 / 50 / 10 sur le TTC (RG-10, RG-11), en saisie. */
export function lignesStandard(ttcCts: number, dateSignature: string): LigneSaisie[] {
  return genererEcheancier({ montantTtcCts: ttcCts, dateSignature }).map((l) => ({
    type: l.type, montant: versEuros(l.montantPrevuCts), dateAttendue: l.dateAttendue ?? "", mode: "", commentaire: "",
  }));
}

export function totalSaisi(lignes: LigneSaisie[]): number | null {
  let total = 0;
  for (const l of lignes) {
    const c = centimesDepuis(l.montant);
    if (c === null) return null;
    total += c;
  }
  return total;
}

/**
 * Échéancier modifiable (EF-51, RG-13) : montants, dates, modes ; ajout de lignes pour des chèques
 * échelonnés ; Franfinance seulement sur l'acompte 2 et le solde. La somme doit égaler le TTC (RG-11).
 */
export function EditeurEcheancier({
  lignes, onChange, ttcCts, dateSignature,
}: { lignes: LigneSaisie[]; onChange: (l: LigneSaisie[]) => void; ttcCts: number | null; dateSignature: string }) {
  const maj = (i: number, champs: Partial<LigneSaisie>) => onChange(lignes.map((l, j) => (j === i ? { ...l, ...champs } : l)));
  const total = totalSaisi(lignes);
  const ecart = total !== null && ttcCts !== null ? ttcCts - total : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[9rem_7rem_9rem_8rem_1fr] gap-2 text-[12px] font-semibold text-muted-foreground">
        <span>Échéance</span><span>Montant (€)</span><span>Attendue le</span><span>Mode</span><span>Commentaire</span>
      </div>
      {lignes.map((l, i) => (
        <div key={l.id ?? i} className="grid grid-cols-[9rem_7rem_9rem_8rem_1fr] items-center gap-2">
          <span className="text-[14px] font-semibold text-encre">{LIBELLES_ECHEANCE[l.type]}{l.recue ? " · reçu" : ""}</span>
          <input aria-label={`Montant ${i + 1}`} inputMode="decimal" value={l.montant} disabled={l.recue} onChange={(e) => maj(i, { montant: e.target.value })} className={champ} />
          <input aria-label={`Date attendue ${i + 1}`} type="date" value={l.dateAttendue} disabled={l.recue || l.type === "acompte_1"} onChange={(e) => maj(i, { dateAttendue: e.target.value })} className={champ} />
          <select aria-label={`Mode ${i + 1}`} value={l.mode} disabled={l.recue} onChange={(e) => maj(i, { mode: e.target.value })} className={champ}>
            {MODES.filter(([v]) => !(v === "franfinance" && l.type === "acompte_1")).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <input aria-label={`Commentaire ${i + 1}`} value={l.commentaire} disabled={l.recue} onChange={(e) => maj(i, { commentaire: e.target.value })} className={champ} placeholder="ex. chèque à encaisser le 15/11" />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lignes, { type: "autre", montant: "0,00", dateAttendue: "", mode: "", commentaire: "" }])}>
            <Plus aria-hidden /> Ligne
          </Button>
          {ttcCts !== null && !lignes.some((l) => l.recue) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(lignesStandard(ttcCts, dateSignature))}>40 / 50 / 10</Button>
          )}
        </div>
        <p className={`text-[14px] ${ecart === 0 ? "text-etat-ok" : "text-etat-retard"}`} aria-live="polite">
          {total === null ? "Montant illisible" : `Total ${euros(total)}${ttcCts !== null ? (ecart === 0 ? " = TTC" : ` · écart ${euros(Math.abs(ecart!))} avec le TTC`) : ""}`}
        </p>
      </div>
    </div>
  );
}
