"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { CircleAlert, Plus, UserRound } from "lucide-react";
import { creerContact, rechercherClients, type ClientTrouve } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Referentiel } from "@/server/referentiel";
import { champ, CreerAffaires } from "./creer-affaires";

type Formulaire = {
  type: "particulier" | "professionnel"; nom: string; prenom: string; raisonSociale: string; telephone: string; email: string;
  ville: string; cnq: boolean; source: string; rappelLe: string;
};
const VIDE: Formulaire = { type: "particulier", nom: "", prenom: "", raisonSociale: "", telephone: "", email: "", ville: "", cnq: false, source: "", rappelLe: "" };

/**
 * Contact rapide au R0 (EF-20) avec détection des clients existants (EF-21) : pendant la saisie du nom ou
 * du téléphone, les clients connus de tous les magasins sont proposés ; un client d'un autre magasin peut
 * recevoir une affaire ici sans être ressaisi.
 */
export function NouveauContact({
  referentiel, moi, aujourdhui, libelle = "Nouveau contact",
}: { referentiel: Referentiel; moi: { id: string; estGerant: boolean }; aujourdhui: string; libelle?: string }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState<Formulaire>(VIDE);
  const [magasin, setMagasin] = useState(referentiel.magasins[0]?.code ?? "");
  const [suggestions, setSuggestions] = useState<ClientTrouve[]>([]);
  const [pourAffaire, setPourAffaire] = useState<ClientTrouve | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const maj = <K extends keyof Formulaire>(k: K, v: Formulaire[K]) => { setErreur(null); setF((x) => ({ ...x, [k]: v })); };

  // Recherche des clients existants pendant la saisie (EF-21), avec un léger délai.
  const requete = f.telephone.replace(/\D/g, "").length >= 4 ? f.telephone : `${f.nom} ${f.prenom}`.trim();
  useEffect(() => {
    if (!ouvert || requete.length < 2) return;
    let annule = false;
    const minuteur = setTimeout(async () => {
      const r = await rechercherClients(requete);
      if (!annule) setSuggestions(r);
    }, 250);
    return () => { annule = true; clearTimeout(minuteur); };
  }, [requete, ouvert]);
  const affichees = requete.length < 2 ? [] : suggestions;

  const soumettre = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!f.nom.trim()) return setErreur("Le nom est obligatoire.");
    demarrer(async () => {
      const r = await creerContact({ ...f, magasinCode: magasin });
      if (!r.ok) return setErreur(r.message);
      setOuvert(false);
      router.push(`/clients/${r.clientId}`);
    });
  };

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setF(VIDE); setSuggestions([]); setPourAffaire(null); setErreur(null); } }}>
      <DialogTrigger render={<Button size="lg" className="h-10 px-4 text-[15px]" />}><Plus aria-hidden /> {libelle}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        {pourAffaire ? (
          <>
            <DialogHeader>
              <DialogTitle>Nouvelle affaire pour {pourAffaire.nom}</DialogTitle>
              <DialogDescription>Client connu au magasin {pourAffaire.magasin} : ses coordonnées sont reprises telles quelles.</DialogDescription>
            </DialogHeader>
            <CreerAffaires
              client={pourAffaire} referentiel={referentiel} moi={moi}
              onAnnuler={() => setPourAffaire(null)}
              onCree={(ids) => { setOuvert(false); router.push(`/affaires/${ids[0]}`); }}
            />
          </>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Nouveau contact</DialogTitle>
              <DialogDescription>Seul le nom est obligatoire. Les affaires se créent ensuite depuis la fiche client.</DialogDescription>
            </DialogHeader>

            <div className="flex gap-4 text-[15px]">
              {(["particulier", "professionnel"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name={`${id}-type`} checked={f.type === t} onChange={() => maj("type", t)} className="accent-teal-700" />
                  {t === "particulier" ? "Particulier" : "Professionnel"}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {f.type === "professionnel" && (
                <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
                  Raison sociale
                  <input value={f.raisonSociale} onChange={(e) => maj("raisonSociale", e.target.value)} className={champ} />
                </label>
              )}
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Nom
                <input value={f.nom} onChange={(e) => maj("nom", e.target.value)} className={champ} autoComplete="off" autoFocus />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Prénom
                <input value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} className={champ} autoComplete="off" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Téléphone
                <input type="tel" value={f.telephone} disabled={f.cnq} onChange={(e) => maj("telephone", e.target.value)} className={champ} autoComplete="off" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                E-mail
                <input type="email" value={f.email} disabled={f.cnq} onChange={(e) => maj("email", e.target.value)} className={champ} autoComplete="off" />
              </label>
            </div>

            {affichees.length > 0 && (
              <section aria-label="Clients existants" className="rounded-lg border border-etat-attention/40 bg-etat-attention/8 p-3">
                <p className="mb-2 text-[14px] font-semibold text-etat-attention">Ce client existe peut-être déjà :</p>
                <ul className="flex flex-col gap-1.5">
                  {affichees.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-[15px]">
                      <UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-encre">{c.nom}</span>
                        <span className="text-muted-foreground">
                          {" · "}{[c.telephone, c.ville, c.magasin, `${c.affaires} affaire${c.affaires > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {c.visible ? (
                        <Link href={`/clients/${c.id}`} onClick={() => setOuvert(false)} className="shrink-0 text-[14px] font-semibold text-teal-700 underline-offset-2 hover:underline">
                          Ouvrir la fiche
                        </Link>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setPourAffaire(c)}>Créer une affaire ici</Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
              <input type="checkbox" checked={f.cnq} onChange={(e) => setF((x) => ({ ...x, cnq: e.target.checked, telephone: "", email: "" }))} className="size-4 accent-teal-700" />
              CNQ : le client ne laisse pas ses coordonnées
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Ville
                <input value={f.ville} onChange={(e) => maj("ville", e.target.value)} className={champ} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Source
                <select value={f.source} onChange={(e) => maj("source", e.target.value)} className={champ}>
                  <option value="">—</option>
                  {referentiel.sources.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Rappel convenu le
                <input type="date" min={aujourdhui} value={f.rappelLe} onChange={(e) => maj("rappelLe", e.target.value)} className={champ} />
              </label>
              {referentiel.magasins.length > 1 && (
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Magasin
                  <select value={magasin} onChange={(e) => setMagasin(e.target.value)} className={champ}>
                    {referentiel.magasins.map((m) => <option key={m.code} value={m.code}>{m.nom}</option>)}
                  </select>
                </label>
              )}
            </div>
            {erreur && (
              <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard">
                <CircleAlert aria-hidden className="size-4 shrink-0" /> {erreur}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
              <Button type="submit" size="lg" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer le contact"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
