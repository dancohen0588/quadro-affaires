"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, FileUp, TriangleAlert } from "lucide-react";
import { deposerDocument, validerDebit, type LectureDebit } from "@/app/(app)/affaires/documents-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DocumentVue } from "@/lib/affaire/fiche";
import { centimesDepuis, champDepuisSemaine, euros, semaineDepuisChamp } from "@/lib/format";
import { cheminLogique } from "@/lib/pcloud";
import { nomDeDepot, type ValeursGabarit } from "@/lib/rules/documents";

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";
const enEuros = (cts: number | null) => (cts === null ? "" : (cts / 100).toFixed(2).replace(".", ","));

type Etat = { vue: "choix" } | { vue: "debit"; nomFinal: string; dossier: string; debit: LectureDebit } | { vue: "fini"; nomFinal: string; dossier: string; message: string };

/**
 * Dépôt d'un document attendu (section 7.3) : choix du document, fichier, aperçu du nom et du dossier PCloud.
 * Pour le débit AGEM, les champs lus sont proposés à la validation (section 13.3) avant d'aller dans la commande.
 */
export function DeposerDocument({ affaireId, documents, valeurs, aujourdhui }: {
  affaireId: string; documents: DocumentVue[]; valeurs: ValeursGabarit; aujourdhui: string;
}) {
  const router = useRouter();
  const id = useId();
  const deposables = documents.filter((d) => d.statut !== "a_venir");
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<Etat>({ vue: "choix" });
  const [code, setCode] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  // Champs du débit (préremplis par la lecture, modifiables avant validation).
  const [debit, setDebit] = useState({ commande: "", envoyee: aujourdhui, semaine: "", lieu: "", prix: "", points: "" });

  const choisi = deposables.find((d) => d.code === code) ?? null;
  const apercu = choisi && fichier ? nomDeDepot(choisi.gabarit, valeurs, fichier.name) : null;

  const reinitialiser = () => {
    setEtat({ vue: "choix" });
    setCode(deposables.find((d) => d.statut === "attendu")?.code ?? deposables[0]?.code ?? "");
    setFichier(null);
    setErreur(null);
  };

  const envoyer = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!choisi || !fichier) return setErreur("Choisissez le document attendu et le fichier.");
    const donnees = new FormData();
    donnees.set("affaireId", affaireId);
    donnees.set("code", choisi.code);
    donnees.set("fichier", fichier);
    setErreur(null);
    demarrer(async () => {
      const r = await deposerDocument(donnees);
      if (!r.ok) return setErreur(r.message);
      router.refresh();
      if (r.debit) {
        const d = r.debit, c = d.commandeExistante;
        setDebit({
          commande: d.commande ?? c?.gesteosRef ?? "", envoyee: c?.envoyeeLe ?? aujourdhui, semaine: champDepuisSemaine(d.semaine ?? c?.semaineDemandee ?? null),
          lieu: d.lieuLivraison ?? c?.lieuLivraison ?? "", prix: enEuros(d.prixAchatCts ?? c?.prixAchatCts ?? null),
          points: d.points !== null ? String(d.points).replace(".", ",") : c?.points !== null && c?.points !== undefined ? String(c.points).replace(".", ",") : "",
        });
        setEtat({ vue: "debit", nomFinal: r.nomFinal, dossier: r.dossier, debit: d });
      } else {
        setEtat({ vue: "fini", nomFinal: r.nomFinal, dossier: r.dossier, message: "Document rangé dans le PCloud simulé." });
      }
    });
  };

  const valider = () => {
    if (etat.vue !== "debit") return;
    const prix = debit.prix ? centimesDepuis(debit.prix) : null;
    const points = debit.points ? Number(debit.points.replace(/\s/g, "").replace(",", ".")) : null;
    if (debit.prix && prix === null) return setErreur("Prix d'achat illisible.");
    if (points !== null && !Number.isFinite(points)) return setErreur("Points illisibles.");
    setErreur(null);
    demarrer(async () => {
      const r = await validerDebit({
        affaireId, gesteosRef: debit.commande, envoyeeLe: debit.envoyee, semaineDemandee: semaineDepuisChamp(debit.semaine),
        lieuLivraison: debit.lieu || null, prixAchatCts: prix, points,
      });
      if (!r.ok) return setErreur(r.message);
      router.refresh();
      setEtat({ vue: "fini", nomFinal: etat.nomFinal, dossier: etat.dossier, message: `Commande AGEM mise à jour${prix !== null ? ` : prix d'achat ${euros(prix)}` : ""}.` });
    });
  };

  if (!deposables.length) return null;
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) reinitialiser(); }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><FileUp aria-hidden /> Déposer</DialogTrigger>
      <DialogContent className="max-w-2xl">
        {etat.vue === "choix" && (
          <form onSubmit={envoyer} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Déposer un document</DialogTitle>
              <DialogDescription>Le fichier est renommé selon la règle du document et rangé dans le bon sous-dossier du PCloud (simulé).</DialogDescription>
            </DialogHeader>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Document attendu
              <select value={code} onChange={(e) => setCode(e.target.value)} className={champ}>
                {deposables.map((d) => <option key={d.code} value={d.code}>{d.libelle}{d.statut === "ok" ? " (déjà déposé)" : ""}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Fichier
              <input
                type="file" name="fichier" className={`${champ} py-1.5`}
                accept={choisi?.formats.length ? choisi.formats.flatMap((f) => (f === "jpg" ? [".jpg", ".jpeg"] : [`.${f}`])).join(",") : undefined}
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              />
              {choisi?.formats.length ? <span className="font-normal text-muted-foreground">Formats : {choisi.formats.join(", ")} · 4 Mo au plus</span> : null}
            </label>
            {choisi && (
              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-fond px-4 py-3 text-[14px]">
                <dt className="text-muted-foreground">Rangé dans</dt>
                <dd className="font-mono text-[13px]">{cheminLogique(choisi.dossier)}</dd>
                <dt className="text-muted-foreground">Sous le nom</dt>
                <dd className="font-mono text-[13px]" data-testid="apercu-nom">{apercu ?? (choisi.gabarit ? `${choisi.nom}.…` : "nom du fichier conservé")}</dd>
              </dl>
            )}
            {erreur && <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4" /> {erreur}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
              <Button type="submit" size="lg" disabled={enCours || !fichier}>{enCours ? "Dépôt…" : "Déposer"}</Button>
            </DialogFooter>
          </form>
        )}

        {etat.vue === "debit" && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Lecture du débit AGEM</DialogTitle>
              <DialogDescription>
                Débit rangé sous « {etat.nomFinal} ». Vérifiez les valeurs lues avant de les enregistrer dans la commande AGEM.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-fond px-4 py-3 text-[14px]">
              <dt className="text-muted-foreground">N° de devis</dt><dd className="font-mono text-[13px]">{etat.debit.devis ?? "—"}</dd>
              <dt className="text-muted-foreground">Contremarque</dt>
              <dd><Controle ok={etat.debit.contremarqueOk} texte={etat.debit.contremarque} attendu="différente de celle de l'affaire" /></dd>
              <dt className="text-muted-foreground">Concepteur</dt>
              <dd><Controle ok={etat.debit.concepteurOk} texte={etat.debit.concepteur} attendu="différent du concepteur de l'affaire" /></dd>
            </dl>
            {etat.debit.manquants.length > 0 && (
              <p className="flex items-start gap-2 text-[14px] text-etat-attention"><TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> Non trouvé dans le débit : {etat.debit.manquants.join(", ")}. À compléter à la main.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">N° de commande Gesteos
                <input value={debit.commande} onChange={(e) => setDebit({ ...debit, commande: e.target.value })} className={`${champ} font-mono`} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Envoyée à AGEM le
                <input type="date" value={debit.envoyee} max={aujourdhui} onChange={(e) => setDebit({ ...debit, envoyee: e.target.value })} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Semaine demandée
                <input id={`${id}-semaine`} type="week" value={debit.semaine} onChange={(e) => setDebit({ ...debit, semaine: e.target.value })} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Lieu de livraison
                <input value={debit.lieu} onChange={(e) => setDebit({ ...debit, lieu: e.target.value })} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Prix d&apos;achat HT (€)
                <input inputMode="decimal" value={debit.prix} onChange={(e) => setDebit({ ...debit, prix: e.target.value })} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Points
                <input inputMode="decimal" value={debit.points} onChange={(e) => setDebit({ ...debit, points: e.target.value })} className={champ} />
              </label>
            </div>
            {erreur && <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4" /> {erreur}</p>}
            <DialogFooter>
              <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Plus tard</Button>
              <Button size="lg" disabled={enCours} onClick={valider}>{enCours ? "Enregistrement…" : "Enregistrer dans la commande"}</Button>
            </DialogFooter>
          </div>
        )}

        {etat.vue === "fini" && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Document rangé</DialogTitle>
              <DialogDescription>{etat.message}</DialogDescription>
            </DialogHeader>
            <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-4 py-3 text-[14px]">
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-etat-ok" />
              <span><span className="font-mono text-[13px]">{etat.nomFinal}</span><br /><span className="text-muted-foreground">dans {etat.dossier}</span></span>
            </p>
            <DialogFooter><Button size="lg" onClick={() => setOuvert(false)}>Fermer</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Controle({ ok, texte, attendu }: { ok: boolean; texte: string | null; attendu: string }) {
  if (!texte) return <span className="text-muted-foreground">non lu</span>;
  return ok ? (
    <span className="inline-flex items-center gap-1.5"><CircleCheck aria-hidden className="size-4 text-etat-ok" /> {texte}</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-etat-attention"><TriangleAlert aria-hidden className="size-4" /> {texte} · {attendu}</span>
  );
}
