"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { enregistrerCommande, type EntreeCommande } from "@/app/(app)/ventes/actions";
import { Etat } from "@/components/affaire/pastille-phase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { centimesDepuis, champDepuisSemaine, dateCourte, euros, semaineCourte, semaineDepuisChamp } from "@/lib/format";

export type CommandeVue = {
  id: string; fournisseur: string; iteration: number; gesteosRef: string | null; envoyeeLe: string | null; semaineDemandee: string | null;
  lieuLivraison: string | null; prixAchatCts: number | null; points: number | null; arcRecuLe: string | null; arRecuLe: string | null;
  semaineAnnoncee: string | null; confirmationRecueLe: string | null; bpaVersion: string | null; bpaDonneLe: string | null; statut: string;
};

const STATUTS: Record<string, [string, "ok" | "attention" | "retard" | "neutre"]> = {
  a_passer: ["À passer", "neutre"], envoyee: ["Envoyée", "attention"], arc_recu: ["ARC reçu", "attention"],
  en_verification: ["BPA à donner", "attention"], bpa_donne: ["BPA donné", "ok"], livree: ["Livrée", "ok"],
};
const champ = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[14px] disabled:bg-muted";

type Formulaire = Record<string, string>;
const versFormulaire = (c: CommandeVue | null, fournisseur: string): Formulaire => ({
  fournisseur: c?.fournisseur ?? fournisseur, gesteosRef: c?.gesteosRef ?? "", envoyeeLe: c?.envoyeeLe ?? "",
  semaineDemandee: champDepuisSemaine(c?.semaineDemandee ?? null), lieuLivraison: c?.lieuLivraison ?? (fournisseur === "AGEM" ? "TRANSTOCK 66" : ""),
  prixAchat: c?.prixAchatCts != null ? (c.prixAchatCts / 100).toFixed(2).replace(".", ",") : "", points: c?.points != null ? String(c.points) : "",
  arcRecuLe: c?.arcRecuLe ?? "", arRecuLe: c?.arRecuLe ?? "", semaineAnnoncee: champDepuisSemaine(c?.semaineAnnoncee ?? null),
  confirmationRecueLe: c?.confirmationRecueLe ?? "", bpaVersion: c?.bpaVersion ?? "", bpaDonneLe: c?.bpaDonneLe ?? "",
});

/**
 * Commandes fournisseurs de l'affaire (EF-37, EF-70 à EF-72) : AGEM (envoi, ARC, confirmation, versions de
 * BPA, BPA donné par un gérant) et autres fournisseurs (envoi, AR, délai). Aucun envoi depuis l'outil.
 */
export function BlocCommandes({
  affaireId, commandes, estGerant, modifiable, annee,
}: { affaireId: string; commandes: CommandeVue[]; estGerant: boolean; modifiable: boolean; annee: number }) {
  const router = useRouter();
  const [edition, setEdition] = useState<{ commande: CommandeVue | null; f: Formulaire } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const agem = edition?.f.fournisseur.toUpperCase() === "AGEM";
  const maj = (k: string, v: string) => setEdition((e) => (e ? { ...e, f: { ...e.f, [k]: v } } : e));
  const ouvrir = (commande: CommandeVue | null, fournisseur: string) => { setErreur(null); setEdition({ commande, f: versFormulaire(commande, fournisseur) }); };

  const enregistrer = () => {
    if (!edition) return;
    const f = edition.f;
    const prix = f.prixAchat ? centimesDepuis(f.prixAchat) : null;
    if (f.prixAchat && prix === null) return setErreur("Prix d'achat illisible.");
    const donnees: EntreeCommande = {
      id: edition.commande?.id, affaireId, fournisseur: f.fournisseur, gesteosRef: f.gesteosRef || null, envoyeeLe: f.envoyeeLe || null,
      semaineDemandee: semaineDepuisChamp(f.semaineDemandee), lieuLivraison: f.lieuLivraison || null, prixAchatCts: prix,
      points: f.points ? Number(f.points.replace(",", ".")) : null, arcRecuLe: f.arcRecuLe || null, arRecuLe: f.arRecuLe || null,
      semaineAnnoncee: semaineDepuisChamp(f.semaineAnnoncee), confirmationRecueLe: f.confirmationRecueLe || null,
      bpaVersion: f.bpaVersion || null, bpaDonneLe: f.bpaDonneLe || null,
    };
    demarrer(async () => {
      const r = await enregistrerCommande(donnees);
      if (!r.ok) return setErreur(r.message);
      setEdition(null);
      router.refresh();
    });
  };

  // Fonction de rendu (et non composant) : l'input garde le focus pendant la saisie.
  const saisie = (nom: string, libelle: string, type = "text", desactive = false) => (
    <label key={nom} className="flex flex-col gap-1 text-[13px] font-semibold">
      {libelle}
      <input type={type} value={edition?.f[nom] ?? ""} disabled={desactive} onChange={(e) => maj(nom, e.target.value)} className={champ} />
    </label>
  );

  return (
    <section aria-labelledby="titre-commandes" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id="titre-commandes" className="text-[17px] text-encre">Commandes</h2>
        {modifiable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => ouvrir(null, "AGEM")}><Plus aria-hidden /> Commande AGEM</Button>
            <Button variant="ghost" onClick={() => ouvrir(null, "")}><Plus aria-hidden /> Autre fournisseur</Button>
          </div>
        )}
      </header>
      {commandes.length === 0 ? (
        <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucune commande pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y px-5">
          {commandes.map((c) => {
            const [statut, ton] = STATUTS[c.statut] ?? [c.statut, "neutre"];
            const agemC = c.fournisseur.toUpperCase() === "AGEM";
            const faits = [
              c.envoyeeLe && `envoyée le ${dateCourte(c.envoyeeLe, annee)}`,
              c.semaineDemandee && `demandée ${semaineCourte(c.semaineDemandee)}`,
              (c.arcRecuLe || c.arRecuLe) && `${agemC ? "ARC" : "AR"} le ${dateCourte((c.arcRecuLe ?? c.arRecuLe)!, annee)}`,
              c.semaineAnnoncee && `annoncée ${semaineCourte(c.semaineAnnoncee)}`,
              c.confirmationRecueLe && `confirmation le ${dateCourte(c.confirmationRecueLe, annee)}`,
              c.bpaVersion && `BPA ${c.bpaVersion}`,
              c.bpaDonneLe && `donné le ${dateCourte(c.bpaDonneLe, annee)}`,
            ].filter(Boolean);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3" data-commande={c.fournisseur}>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-encre">
                    {c.fournisseur}{c.iteration > 1 ? ` (recommande ${c.iteration})` : ""}
                    {c.gesteosRef && <span className="ml-2 font-mono text-[12px] text-muted-foreground">{c.gesteosRef}</span>}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {faits.join(" · ") || "À passer"}
                    {c.prixAchatCts != null && ` · achat ${euros(c.prixAchatCts, true)}`}{c.points != null && ` · ${c.points} points`}
                  </p>
                </div>
                <Etat ton={ton}>{statut}</Etat>
                {modifiable && <Button variant="outline" size="sm" onClick={() => ouvrir(c, c.fournisseur)}>Compléter</Button>}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!edition} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edition?.commande ? "Compléter la commande" : agem ? "Nouvelle commande AGEM" : "Commande autre fournisseur"}</DialogTitle>
            <DialogDescription>La commande part par Gesteos ; l&apos;outil en garde la trace (EF-70 à EF-72).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            {!agem && saisie("fournisseur", "Fournisseur")}
            {saisie("gesteosRef", "Référence de commande")}
            {saisie("envoyeeLe", "Envoyée le", "date")}
            {agem ? (
              <>
                {saisie("semaineDemandee", "Semaine demandée", "week")}
                {saisie("lieuLivraison", "Lieu de livraison")}
                {saisie("prixAchat", "Prix d'achat (€)")}
                {saisie("points", "Points")}
                {saisie("arcRecuLe", "ARC reçu le", "date")}
                {saisie("semaineAnnoncee", "Semaine annoncée", "week")}
                {saisie("confirmationRecueLe", "Confirmation reçue le", "date")}
                {saisie("bpaVersion", "Version du BPA")}
                {saisie("bpaDonneLe", estGerant ? "BPA donné le" : "BPA donné le (gérant)", "date", !estGerant)}
              </>
            ) : (
              <>
                {saisie("arRecuLe", "AR reçu le", "date")}
                {saisie("semaineAnnoncee", "Délai annoncé (semaine)", "week")}
                {saisie("prixAchat", "Prix d'achat (€)")}
              </>
            )}
          </div>
          {erreur && <p aria-live="polite" className="text-[15px] text-etat-retard">{erreur}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEdition(null)}>Annuler</Button>
            <Button size="lg" disabled={enCours} onClick={enregistrer}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
