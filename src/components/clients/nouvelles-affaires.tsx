"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Referentiel } from "@/server/referentiel";
import { CreerAffaires } from "./creer-affaires";

/** Bouton « Créer des affaires » de la fiche client (EF-23). */
export function NouvellesAffaires({
  client, referentiel, moi,
}: { client: { id: string; nom: string }; referentiel: Referentiel; moi: { id: string; estGerant: boolean } }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={<Button size="lg" className="h-10 px-4 text-[15px]" />}><Plus aria-hidden /> Créer des affaires</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelles affaires pour {client.nom}</DialogTitle>
          <DialogDescription>Une affaire par projet ; elles pourront être vendues ensemble (RG-08).</DialogDescription>
        </DialogHeader>
        <CreerAffaires
          client={client} referentiel={referentiel} moi={moi} onAnnuler={() => setOuvert(false)}
          onCree={(ids) => { setOuvert(false); router.push(ids.length === 1 ? `/affaires/${ids[0]}` : `/clients/${client.id}`); router.refresh(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
