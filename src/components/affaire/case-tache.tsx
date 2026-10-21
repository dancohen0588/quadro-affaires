"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { cn } from "cn";
import { cocherTache } from "@/app/(app)/affaires/actions";

/** Tâche cochable de la fiche affaire (EF-31). */
export function CaseTache({
  affaireId, id, titre, faite, detail, enRetard, modifiable,
}: { affaireId: string; id: string; titre: string; faite: boolean; detail: string | null; enRetard: boolean; modifiable: boolean }) {
  const router = useRouter();
  const [coche, setCoche] = useOptimistic(faite);
  const [, demarrer] = useTransition();
  return (
    <label className={cn("flex items-start gap-2.5 py-0.5 text-[15px]", modifiable && "cursor-pointer")}>
      <input
        type="checkbox"
        checked={coche}
        disabled={!modifiable}
        className="mt-1 size-4 shrink-0 accent-teal-700"
        onChange={(e) => {
          const valeur = e.target.checked;
          demarrer(async () => {
            setCoche(valeur);
            const r = await cocherTache(affaireId, id, valeur);
            if (r.ok) router.refresh();
          });
        }}
      />
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn(coche && "text-muted-foreground line-through")}>{titre}</span>
        {detail && <span className={cn("text-[13px]", enRetard && !coche ? "font-semibold text-etat-retard" : "text-muted-foreground")}>{detail}</span>}
      </span>
    </label>
  );
}
