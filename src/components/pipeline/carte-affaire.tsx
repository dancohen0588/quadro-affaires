import Link from "next/link";
import { cn } from "cn";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { badgeEcheance } from "@/lib/affaire/journee";
import { euros } from "@/lib/format";
import { libelleEtat, type Carte } from "@/lib/indicateurs/pipeline";
import type { DateIso } from "@/lib/rules/calendrier";

export const COULEUR_ETAT = { ok: "bg-etat-ok", attention: "bg-etat-attention", retard: "bg-etat-retard" } as const;

/** Point d'état (EF-80) : actif, en attente, en retard ; le libellé reste lisible par les lecteurs d'écran. */
export function PointEtat({ etat, className }: { etat: Carte["etat"]; className?: string }) {
  return (
    <span className={cn("inline-block size-2.5 shrink-0 rounded-full", COULEUR_ETAT[etat], className)} title={libelleEtat(etat)}>
      <span className="sr-only">{libelleEtat(etat)}</span>
    </span>
  );
}

export function Initiales({ initiales, nom }: { initiales: string; nom: string }) {
  return (
    <span title={nom} className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-500/45 text-[11px] font-bold text-teal-900">
      {initiales}
    </span>
  );
}

/** Carte d'une affaire dans le kanban (maquette pipeline.png). */
export function CarteAffaire({ carte, aujourdhui, avecMagasin }: { carte: Carte; aujourdhui: DateIso; avecMagasin: boolean }) {
  const jalon = carte.jalon ? badgeEcheance({ echeance: carte.jalon.echeance, statut: "a_faire" }, aujourdhui) : null;
  return (
    <li>
      <Link
        href={`/affaires/${carte.id}`}
        className="flex flex-col gap-2 rounded-xl bg-card px-3.5 py-3 shadow-[0_1px_2px_rgb(14_59_69/0.08)] ring-1 ring-foreground/8 transition hover:ring-teal-500/50"
        title={carte.alertes.join("\n") || undefined}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-[15px] leading-snug font-semibold text-encre">{carte.libelle}</span>
          <PointEtat etat={carte.etat} className="mt-1.5" />
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {carte.etape && <PastillePhase couleur={carte.phase.couleur} className="min-w-0 truncate">{carte.etape.titre}</PastillePhase>}
          <Initiales initiales={carte.concepteur.initiales} nom={carte.concepteur.prenom} />
          {avecMagasin && <span className="truncate text-[12px] text-muted-foreground">{carte.magasin.code}</span>}
        </span>
        <span className="flex items-center justify-between gap-2 text-[13px]">
          <span className="min-w-0 truncate text-muted-foreground">
            {carte.alertes[0] ?? (carte.jalon ? carte.jalon.titre : "Aucune tâche planifiée")}
          </span>
          {carte.inactive ? (
            <Etat ton="retard" className="h-5 px-2 text-[12px]">{carte.joursSansMouvement} j</Etat>
          ) : jalon && jalon.ton !== "neutre" ? (
            <Etat ton={jalon.ton} className="h-5 px-2 text-[12px]">{jalon.texte}</Etat>
          ) : carte.montantCts ? (
            <span className="font-semibold whitespace-nowrap text-encre">{euros(carte.montantCts, true)}</span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
