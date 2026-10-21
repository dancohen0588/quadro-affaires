"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { modifierMagasin, modifierSociete } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type MagasinVue = { id: string; code: string; nom: string; societeId: string; adresse: string | null; telephone: string | null };
export type SocieteVue = { id: string; code: string; nom: string; siren: string | null };

const champ = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[15px]";

function Erreur({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return <p aria-live="polite" className="flex items-center gap-2 text-[15px] text-etat-retard"><CircleAlert aria-hidden className="size-4 shrink-0" /> {texte}</p>;
}

/** Nom, société, adresse et téléphone d'un magasin (EF-101). Le code ne change pas : il nomme les dossiers PCloud. */
export function ModifierMagasin({ m, societes }: { m: MagasinVue; societes: SocieteVue[] }) {
  const router = useRouter();
  const initial = { nom: m.nom, societeId: m.societeId, adresse: m.adresse ?? "", telephone: m.telephone ?? "" };
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setV(initial); setErreur(null); } }}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Modifier ${m.nom}`} />}>Modifier</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.nom}</DialogTitle>
          <DialogDescription>Code <span className="font-mono">{m.code}</span> : il nomme les dossiers PCloud et sert à l&apos;import, il ne change pas.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          demarrer(async () => {
            const r = await modifierMagasin({ id: m.id, ...v });
            if (!r.ok) return setErreur(r.message);
            setOuvert(false);
            router.refresh();
          });
        }}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Nom
            <input required value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Société
            <select value={v.societeId} onChange={(e) => setV({ ...v, societeId: e.target.value })} className={champ}>
              {societes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Adresse
            <input value={v.adresse} onChange={(e) => setV({ ...v, adresse: e.target.value })} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Téléphone
            <input type="tel" value={v.telephone} onChange={(e) => setV({ ...v, telephone: e.target.value })} className={champ} />
          </label>
          <Erreur texte={erreur} />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button type="submit" size="lg" disabled={enCours}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Nom et SIREN d'une société (EF-101). */
export function ModifierSociete({ s }: { s: SocieteVue }) {
  const router = useRouter();
  const initial = { nom: s.nom, siren: s.siren ?? "" };
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <Dialog open={ouvert} onOpenChange={(o) => { setOuvert(o); if (o) { setV(initial); setErreur(null); } }}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Modifier ${s.nom}`} />}>Modifier</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{s.nom}</DialogTitle>
          <DialogDescription>Code <span className="font-mono">{s.code}</span>, inchangé.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          demarrer(async () => {
            const r = await modifierSociete({ id: s.id, ...v });
            if (!r.ok) return setErreur(r.message);
            setOuvert(false);
            router.refresh();
          });
        }}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Nom
            <input required value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">SIREN
            <input inputMode="numeric" value={v.siren} onChange={(e) => setV({ ...v, siren: e.target.value })} className={`${champ} font-mono`} placeholder="9 chiffres" />
          </label>
          <Erreur texte={erreur} />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(false)}>Annuler</Button>
            <Button type="submit" size="lg" disabled={enCours}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
