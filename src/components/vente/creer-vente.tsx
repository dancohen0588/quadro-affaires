"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { creerVente } from "@/app/(app)/ventes/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { centimesDepuis, euros, semaineDepuisChamp } from "@/lib/format";
import { EditeurEcheancier, lignesStandard, totalSaisi, type LigneSaisie } from "./editeur-echeancier";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";

export type AffaireVendable = { id: string; libelle: string; montantDevisHtCts: number | null };

/**
 * Création de la vente (EF-50) : affaires du même client à vendre ensemble, signature, montants, financement,
 * référence Gesteos, échéancier 40 / 50 / 10 modifiable (EF-51), dates souhaitées de livraison et de pose (EF-60).
 */
export function CreerVente({ affaireId, vendables, aujourdhui }: { affaireId: string; vendables: AffaireVendable[]; aujourdhui: string }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [choisies, setChoisies] = useState<string[]>([affaireId]);
  const [signature, setSignature] = useState(aujourdhui);
  const [ht, setHt] = useState("");
  const [ttc, setTtc] = useState("");
  const [financement, setFinancement] = useState<"aucun" | "franfinance">("aucun");
  const [gesteos, setGesteos] = useState("");
  const [semaine, setSemaine] = useState("");
  const [pose, setPose] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissements, setAvertissements] = useState<string[] | null>(null);
  const [enCours, demarrer] = useTransition();
  const ttcCts = centimesDepuis(ttc);

  const initialiser = () => {
    const devis = vendables.filter((a) => a.id === affaireId).reduce((s, a) => s + (a.montantDevisHtCts ?? 0), 0);
    setChoisies([affaireId]);
    setSignature(aujourdhui);
    setHt(devis ? (devis / 100).toFixed(2).replace(".", ",") : "");
    const ttcDevis = devis ? Math.round(devis * 1.2) : null;
    setTtc(ttcDevis ? (ttcDevis / 100).toFixed(2).replace(".", ",") : "");
    setLignes(ttcDevis ? lignesStandard(ttcDevis, aujourdhui) : []);
    setFinancement("aucun");
    setGesteos("");
    setSemaine("");
    setPose("");
    setErreur(null);
    setAvertissements(null);
  };

  const changerTtc = (valeur: string) => {
    setTtc(valeur);
    const c = centimesDepuis(valeur);
    if (c !== null) setLignes(lignesStandard(c, signature));
  };

  const soumettre = (ev: React.FormEvent) => {
    ev.preventDefault();
    const htCts = centimesDepuis(ht);
    if (htCts === null || ttcCts === null) return setErreur("Saisissez les montants HT et TTC du BDC.");
    if (totalSaisi(lignes) !== ttcCts) return setErreur("La somme des échéances doit égaler le montant TTC (RG-11).");
    demarrer(async () => {
      const r = await creerVente({
        affaireIds: choisies, dateSignature: signature, montantHtCts: htCts, montantTtcCts: ttcCts, financement,
        gesteosRef: gesteos || undefined,
        lignes: lignes.map((l) => ({
          type: l.type, montantCts: centimesDepuis(l.montant) ?? 0, dateAttendue: l.dateAttendue || null,
          mode: (l.mode || null) as never, commentaire: l.commentaire || null,
        })),
        semaineLivraison: semaineDepuisChamp(semaine), datePose: pose || null,
      });
      if (!r.ok) return setErreur(r.message);
      router.refresh();
      if (r.avertissements.length) setAvertissements(r.avertissements);
      else setOuvert(false);
    });
  };

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) initialiser(); }}>
      <DialogTrigger render={<Button size="lg" />}>Créer la vente</DialogTrigger>
      <DialogContent className="max-w-3xl">
        {avertissements ? (
          <>
            <DialogHeader>
              <DialogTitle>Vente enregistrée</DialogTitle>
              <DialogDescription>Les affaires passent à l&apos;acompte 1 ; ces tâches de l&apos;étape Vente restaient à faire et ont été annulées (RG-05) :</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-[15px]">{avertissements.map((a) => <li key={a}>{a.replace("Tâche non faite, annulée : ", "")}</li>)}</ul>
            <DialogFooter><Button size="lg" onClick={() => setOuvert(false)}>Fermer</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Créer la vente</DialogTitle>
              <DialogDescription>La vente valide l&apos;étape Vente, ouvre l&apos;acompte 1 et envoie la demande de planning (RG-08, EF-60).</DialogDescription>
            </DialogHeader>
            {vendables.length > 1 && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm font-semibold">Affaires vendues ensemble (même client)</legend>
                {vendables.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2.5 text-[15px]">
                    <input
                      type="checkbox" className="size-4 accent-teal-700" checked={choisies.includes(a.id)} disabled={a.id === affaireId}
                      onChange={(e) => setChoisies((l) => (e.target.checked ? [...l, a.id] : l.filter((x) => x !== a.id)))}
                    />
                    {a.libelle}{a.montantDevisHtCts ? <span className="text-muted-foreground"> · devis {euros(a.montantDevisHtCts, true)} HT</span> : null}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Signature du BDC
                <input type="date" value={signature} max={aujourdhui} onChange={(e) => setSignature(e.target.value)} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Montant HT (€)
                <input inputMode="decimal" value={ht} onChange={(e) => setHt(e.target.value)} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Montant TTC (€)
                <input inputMode="decimal" value={ttc} onChange={(e) => changerTtc(e.target.value)} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Financement
                <select value={financement} onChange={(e) => setFinancement(e.target.value as "aucun")} className={champ}>
                  <option value="aucun">Aucun</option><option value="franfinance">Franfinance</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">Référence du devis Gesteos
                <input value={gesteos} onChange={(e) => setGesteos(e.target.value)} placeholder="D20261021#4600" className={`${champ} font-mono`} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Livraison souhaitée
                <input id={`${id}-semaine`} type="week" value={semaine} onChange={(e) => setSemaine(e.target.value)} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Pose souhaitée
                <input type="date" value={pose} min={aujourdhui} onChange={(e) => setPose(e.target.value)} className={champ} />
              </label>
            </div>
            <fieldset className="rounded-lg bg-fond p-3">
              <legend className="px-1 text-sm font-semibold">Échéancier (RG-10 à RG-13)</legend>
              {lignes.length ? (
                <EditeurEcheancier lignes={lignes} onChange={setLignes} ttcCts={ttcCts} dateSignature={signature} />
              ) : (
                <p className="text-[14px] text-muted-foreground">Saisissez le montant TTC : l&apos;échéancier 40 / 50 / 10 se calcule.</p>
              )}
            </fieldset>
            {erreur && <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4" /> {erreur}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
              <Button type="submit" size="lg" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer la vente"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
