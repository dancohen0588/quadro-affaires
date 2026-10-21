"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, UserPlus } from "lucide-react";
import { ajouterUtilisateur, desactiverProfil, modifierProfil, reactiverProfil } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type UtilisateurVue = {
  id: string; nom: string; email: string; role: string; estAdmin: boolean; actif: boolean; magasins: string[]; rubriques: string[];
  affaires: number; taches: number; referent: string | null;
};
const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";
const RUBRIQUES = [["r4_avis", "R4 et avis Google"], ["dossiers_pose", "Dossiers de pose (lecture)"]] as const;

const VIDE = { prenom: "", nom: "", email: "", role: "conceptrice", magasins: [] as string[], rubriques: [] as string[] };

/**
 * Ajout d'un utilisateur (EF-100). Démo : la personne apparaît aussitôt dans « Choisir un personnage ».
 * B1 : elle se connecte avec son compte Microsoft 365, rattaché à ce profil par l'adresse.
 */
export function AjouterUtilisateur({ magasins, demo, domaine }: { magasins: { code: string; nom: string }[]; demo: boolean; domaine: string }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const basculer = (liste: string[], x: string, oui: boolean) => (oui ? [...liste, x] : liste.filter((y) => y !== x));
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setV(VIDE); setErreur(null); setSucces(null); } }}>
      <DialogTrigger render={<Button size="sm" />}><UserPlus aria-hidden className="size-4" /> Ajouter un utilisateur</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un utilisateur</DialogTitle>
          <DialogDescription>
            {demo
              ? "En démonstration, la personne apparaît aussitôt dans « Choisir un personnage ». Avec Microsoft 365, elle se connectera avec cette adresse."
              : "La personne se connectera avec son compte Microsoft 365, à cette adresse."}
          </DialogDescription>
        </DialogHeader>
        {succes ? (
          <>
            <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-ok"><CircleCheck aria-hidden className="size-4 shrink-0" /> {succes}</p>
            <DialogFooter><Button size="lg" onClick={() => setOuvert(false)}>Fermer</Button></DialogFooter>
          </>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            demarrer(async () => {
              const r = await ajouterUtilisateur({ ...v, rubriques: v.role === "transverse" ? v.rubriques : [] });
              if (!r.ok) return setErreur(r.message);
              setErreur(null);
              setSucces(r.message ?? "Utilisateur ajouté.");
              router.refresh();
            });
          }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Prénom
                <input required value={v.prenom} onChange={(e) => setV({ ...v, prenom: e.target.value })} className={champ} autoComplete="off" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Nom
                <input value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} className={champ} autoComplete="off" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Adresse
              <input required type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={champ}
                placeholder={`prenom.nom@${domaine}`} autoComplete="off" spellCheck={false} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Rôle
              <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} className={champ}>
                <option value="conceptrice">Conceptrice</option><option value="gerant">Gérant (administrateur)</option><option value="transverse">Transverse</option>
              </select>
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-semibold">Magasins</legend>
              {magasins.map((m) => (
                <label key={m.code} className="flex items-center gap-2 text-[15px]">
                  <input type="checkbox" name={`${id}-magasin`} checked={v.magasins.includes(m.code)} onChange={(e) => setV({ ...v, magasins: basculer(v.magasins, m.code, e.target.checked) })} className="size-4 accent-teal-700" />
                  {m.nom}
                </label>
              ))}
            </fieldset>
            {v.role === "transverse" && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm font-semibold">Rubriques</legend>
                {RUBRIQUES.map(([r, l]) => (
                  <label key={r} className="flex items-center gap-2 text-[15px]">
                    <input type="checkbox" checked={v.rubriques.includes(r)} onChange={(e) => setV({ ...v, rubriques: basculer(v.rubriques, r, e.target.checked) })} className="size-4 accent-teal-700" />
                    {l}
                  </label>
                ))}
              </fieldset>
            )}
            {erreur && <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4 shrink-0" /> {erreur}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
              <Button type="submit" size="lg" disabled={enCours}>Ajouter</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Rôle, magasins et rubriques d'un utilisateur (EF-100). */
export function ModifierUtilisateur({ u, magasins, moi }: { u: UtilisateurVue; magasins: { code: string; nom: string }[]; moi: string }) {
  const router = useRouter();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [role, setRole] = useState(u.role);
  const [choisis, setChoisis] = useState<string[]>(u.magasins);
  const [rubriques, setRubriques] = useState<string[]>(u.rubriques);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const basculer = (liste: string[], v: string, oui: boolean) => (oui ? [...liste, v] : liste.filter((x) => x !== v));
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setRole(u.role); setChoisis(u.magasins); setRubriques(u.rubriques); setErreur(null); } }}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Modifier ${u.nom}`} />}>Modifier</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{u.nom}</DialogTitle>
          <DialogDescription>{u.email}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Rôle
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={u.id === moi} className={champ}>
            <option value="gerant">Gérant</option><option value="conceptrice">Conceptrice</option><option value="transverse">Transverse</option>
          </select>
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-semibold">Magasins</legend>
          {magasins.map((m) => (
            <label key={m.code} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name={`${id}-magasin`} checked={choisis.includes(m.code)} onChange={(e) => setChoisis(basculer(choisis, m.code, e.target.checked))} className="size-4 accent-teal-700" />
              {m.nom}
            </label>
          ))}
        </fieldset>
        {role === "transverse" && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-semibold">Rubriques</legend>
            {RUBRIQUES.map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" checked={rubriques.includes(v)} onChange={(e) => setRubriques(basculer(rubriques, v, e.target.checked))} className="size-4 accent-teal-700" />
                {l}
              </label>
            ))}
          </fieldset>
        )}
        {erreur && <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4" /> {erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button size="lg" disabled={enCours} onClick={() => demarrer(async () => {
            const r = await modifierProfil({ id: u.id, role: role as "gerant", magasins: choisis, rubriques: (role === "transverse" ? rubriques : []) as "r4_avis"[] });
            if (!r.ok) return setErreur(r.message);
            setOuvert(false);
            router.refresh();
          })}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Désactivation avec réassignation des affaires en cours et des tâches ouvertes (EF-100), ou réactivation. */
export function ActiverUtilisateur({ u, repreneurs }: { u: UtilisateurVue; repreneurs: { id: string; nom: string }[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [repreneur, setRepreneur] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const aReassigner = u.affaires + u.taches > 0;
  if (!u.actif) {
    return (
      <Button variant="ghost" size="sm" disabled={enCours} onClick={() => demarrer(async () => { await reactiverProfil(u.id); router.refresh(); })}>
        Réactiver
      </Button>
    );
  }
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setRepreneur(""); setErreur(null); } }}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Désactiver ${u.nom}`} />}>Désactiver</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Désactiver {u.nom}</DialogTitle>
          <DialogDescription>
            {u.referent ? `Référent (${u.referent}) : désignez d'abord quelqu'un d'autre dans les paramètres.` :
              aReassigner ? `${u.affaires} affaire(s) en cours et ${u.taches} tâche(s) ouverte(s) passent à la personne choisie.` : "Aucune affaire ni tâche à réassigner."}
          </DialogDescription>
        </DialogHeader>
        {aReassigner && !u.referent && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Confier à
            <select value={repreneur} onChange={(e) => setRepreneur(e.target.value)} className={champ}>
              <option value="">Choisir…</option>
              {repreneurs.filter((r) => r.id !== u.id).map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </label>
        )}
        {erreur && <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4" /> {erreur}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
          <Button size="lg" variant="destructive" disabled={enCours || !!u.referent || (aReassigner && !repreneur)} onClick={() => demarrer(async () => {
            const r = await desactiverProfil(u.id, repreneur || null);
            if (!r.ok) return setErreur(r.message);
            setOuvert(false);
            router.refresh();
          })}>Désactiver</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
