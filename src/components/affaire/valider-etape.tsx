"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CircleAlert, Lock } from "lucide-react";
import { validerEtape } from "@/app/(app)/affaires/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { EtapeAValider, IssueOption } from "@/server/fiche-affaire";

const AIDE: Record<string, string> = {
  wait: "L'étape reste ouverte ; une relance est créée.",
  loop: "Une nouvelle itération de l'étape est ouverte.",
  end: "L'affaire est close.",
  fin_branche: "Cette branche est terminée.",
};

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Validation d'étape (EF-32) : choix de l'étape quand plusieurs sont ouvertes (section 7.4), de l'issue,
 * du motif (RG-06) ou de la date (RG-07) ; le blocage RG-01 est expliqué et empêche la validation.
 */
export function ValiderEtape({
  affaireId, etapes, motifs, aujourdhui,
}: { affaireId: string; etapes: EtapeAValider[]; motifs: string[]; aujourdhui: string }) {
  const router = useRouter();
  const id = useId();
  const autorisees = etapes.filter((e) => e.autorisee);
  const premiere = autorisees.find((e) => !e.blocage) ?? autorisees[0];
  const [ouvert, setOuvert] = useState(false);
  const [cle, setCle] = useState(premiere?.cle ?? "");
  const [issue, setIssue] = useState("");
  const [motif, setMotif] = useState("");
  const [date, setDate] = useState("");
  const [ouvrir, setOuvrir] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissements, setAvertissements] = useState<string[] | null>(null);
  const [enCours, demarrer] = useTransition();

  const etape = autorisees.find((e) => e.cle === cle);
  const choisie: IssueOption | undefined = etape?.issues.find((i) => i.code === issue);

  const reinitialiser = (nouvelleCle = premiere?.cle ?? "") => {
    setCle(nouvelleCle);
    setIssue("");
    setMotif("");
    setDate("");
    setOuvrir([]);
    setErreur(null);
  };

  const soumettre = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!etape || !choisie) return setErreur("Choisissez une issue.");
    if (choisie.motifObligatoire && !motif) return setErreur("Choisissez un motif.");
    if (choisie.demandeDate && !date) return setErreur("Indiquez une date.");
    demarrer(async () => {
      const r = await validerEtape({
        affaireId, etape: etape.code, iteration: etape.iteration, issue: choisie.code,
        motif: choisie.motifObligatoire ? motif : undefined, date: choisie.demandeDate ? date : undefined,
        ouvrir: ouvrir.length ? ouvrir : undefined,
      });
      if (!r.ok) return setErreur(r.message);
      router.refresh();
      if (r.avertissements.length) setAvertissements(r.avertissements);
      else setOuvert(false);
    });
  };

  if (autorisees.length === 0) {
    return (
      <Button size="lg" className="h-10 px-4 text-[15px]" disabled title="Aucune étape que vous pouvez valider sur cette affaire.">
        Valider l&apos;étape
      </Button>
    );
  }

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (o) {
          reinitialiser();
          setAvertissements(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="lg" className="h-10 px-4 text-[15px]" />}>Valider l&apos;étape</DialogTrigger>
      <DialogContent>
        {avertissements ? (
          <>
            <DialogHeader>
              <DialogTitle>Étape validée</DialogTitle>
              <DialogDescription>Les tâches restées à faire ont été annulées (RG-05) :</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-[15px]">
              {avertissements.map((a) => (
                <li key={a}>{a.replace(/^Tâche non faite, annulée : /, "")}</li>
              ))}
            </ul>
            <DialogFooter>
              <Button size="lg" onClick={() => setOuvert(false)}>Fermer</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Valider l&apos;étape</DialogTitle>
              <DialogDescription>Choisissez l&apos;issue : le process ouvre la suite et crée les tâches.</DialogDescription>
            </DialogHeader>

            {autorisees.length > 1 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Étape ouverte</legend>
                {autorisees.map((e) => (
                  <label key={e.cle} className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[15px] has-checked:border-teal-500 has-checked:bg-sage-100">
                    <input type="radio" name={`${id}-etape`} value={e.cle} checked={cle === e.cle} onChange={() => reinitialiser(e.cle)} className="accent-teal-700" />
                    <span>
                      {e.branche === "autres_fournisseurs" ? "En parallèle · " : e.branche === "sav" ? "SAV · " : ""}
                      {e.titre}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {etape?.blocage ? (
              <div aria-live="polite" className="flex gap-3 rounded-lg bg-etat-retard/10 p-3 text-[15px] text-etat-retard">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">Étape bloquée. </span>
                  {etape.blocage}
                </p>
              </div>
            ) : (
              etape && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-semibold">Issue : {etape.titre}</legend>
                  {etape.issues.map((i) => (
                    <label key={i.code} className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 has-checked:border-teal-500 has-checked:bg-sage-100">
                      <input
                        type="radio" name={`${id}-issue`} value={i.code} checked={issue === i.code}
                        onChange={() => { setIssue(i.code); setErreur(null); setOuvrir([]); }}
                        className="mt-1 accent-teal-700"
                      />
                      <span className="flex flex-col">
                        <span className="text-[15px] font-medium">{i.libelle}</span>
                        {AIDE[i.type] && <span className="text-[13px] text-muted-foreground">{AIDE[i.type]}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )
            )}

            {choisie?.motifObligatoire && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-motif`} className="text-sm font-semibold">Motif (RG-06)</label>
                <select id={`${id}-motif`} value={motif} onChange={(e) => setMotif(e.target.value)} className={champ}>
                  <option value="">Choisir un motif…</option>
                  {motifs.map((m) => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            {choisie?.demandeDate && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-date`} className="text-sm font-semibold">
                  {choisie.type === "loop" ? "Date de la nouvelle présentation" : "Date de la relance"}
                </label>
                <input id={`${id}-date`} type="date" min={aujourdhui} value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
              </div>
            )}

            {choisie?.options.map((o) => (
              <label key={o.etape} className="flex cursor-pointer items-center gap-2.5 text-[15px]">
                <input
                  type="checkbox" checked={ouvrir.includes(o.etape)} className="size-4 accent-teal-700"
                  onChange={(e) => setOuvrir((l) => (e.target.checked ? [...l, o.etape] : l.filter((x) => x !== o.etape)))}
                />
                {o.question}
              </label>
            ))}

            {erreur && (
              <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard">
                <CircleAlert aria-hidden className="size-4 shrink-0" /> {erreur}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
              <Button type="submit" size="lg" disabled={!etape || !!etape.blocage || !choisie || enCours}>
                {enCours ? "Validation…" : "Valider"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
