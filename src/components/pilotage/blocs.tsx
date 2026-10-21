import Link from "next/link";
import { cn } from "cn";
import { PastillePhase } from "@/components/affaire/pastille-phase";
import { LIBELLES_REGLES } from "@/lib/indicateurs/agregats";
import type { AlerteVue } from "@/server/indicateurs";

/** Carte d'indicateur (maquette pilotage.png) : libellé, grand chiffre, unité, détail. */
export function CarteKpi({ libelle, valeur, unite, detail, ton = "normal", id }: {
  libelle: string; valeur: string; unite?: string; detail: React.ReactNode; ton?: "normal" | "retard"; id: string;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10">
      <h2 id={id} className="font-sans text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{libelle}</h2>
      <p className={cn("mt-1 font-heading text-[40px] leading-tight font-bold", ton === "retard" ? "text-etat-retard" : "text-teal-900")}>
        {valeur}{unite && <span className="ml-1.5 text-[18px] font-semibold text-muted-foreground">{unite}</span>}
      </p>
      <p className="mt-1 text-[14px] text-muted-foreground">{detail}</p>
    </section>
  );
}

/** Bloc titré à fond blanc. */
export function Bloc({ titre, id, compteur, action, children, className }: {
  titre: string; id: string; compteur?: { n: number; ton: "retard" | "attention" }; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id={id} className="flex items-center gap-2 text-[18px] text-encre">
          {titre}
          {compteur && (
            <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-sans text-[13px] font-semibold",
              compteur.ton === "retard" ? "bg-etat-retard/12 text-etat-retard" : "bg-etat-attention/14 text-etat-attention")}>{compteur.n}</span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Barres horizontales (répartitions par phase, par type de RDV, par motif). */
export function Barres({ lignes, vide = "Aucune donnée sur la période." }: {
  lignes: { libelle: string; valeur: number; couleur?: string }[]; vide?: string;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  if (lignes.every((l) => l.valeur === 0)) return <p className="px-5 py-4 text-[15px] text-muted-foreground">{vide}</p>;
  return (
    <ul className="flex flex-col gap-2.5 px-5 py-4">
      {lignes.map((l) => (
        <li key={l.libelle} className="grid grid-cols-[minmax(0,9.5rem)_1fr_2.5rem] items-center gap-3 text-[15px]">
          <span className="truncate text-encre">{l.libelle}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-foreground/[0.06]" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${(100 * l.valeur) / max}%`, backgroundColor: l.couleur ?? "var(--teal-700)" }} />
          </span>
          <span className="text-right font-semibold text-encre tabular-nums">{l.valeur}</span>
        </li>
      ))}
    </ul>
  );
}

/** Liste des alertes triées par gravité (EF-91), chacune liée à son affaire. */
export function ListeAlertes({ alertes, max, avecMagasin = true }: { alertes: AlerteVue[]; max?: number; avecMagasin?: boolean }) {
  const affichees = max ? alertes.slice(0, max) : alertes;
  if (!alertes.length) return <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucune alerte : tout est dans les délais.</p>;
  return (
    <ul className="divide-y px-5">
      {affichees.map((a) => (
        <li key={`${a.regle}-${a.affaire_id}-${a.echeance_id ?? ""}`} className="flex items-center gap-3 py-2.5">
          <span aria-hidden className={cn("w-1 self-stretch rounded-full", a.gravite === 1 ? "bg-etat-retard" : "bg-etat-attention")} />
          <div className="min-w-0 flex-1">
            <Link href={`/affaires/${a.affaire_id}`} className="block truncate text-[15px] font-semibold text-encre underline-offset-2 hover:underline">
              {a.libelle}{avecMagasin && a.magasin ? ` · ${a.magasin}` : ""}
            </Link>
            <p className="truncate text-[14px] text-muted-foreground">
              <span className="sr-only">{a.gravite === 1 ? "Urgent : " : "À surveiller : "}</span>
              {a.detail}
            </p>
          </div>
          <span className="hidden shrink-0 font-mono text-[12px] text-muted-foreground sm:inline" title={LIBELLES_REGLES[a.regle]}>{a.regle}</span>
          {a.phase && <PastillePhase couleur={a.phase.couleur} className="shrink-0">{a.phase.nom}</PastillePhase>}
        </li>
      ))}
      {max && alertes.length > max && (
        <li className="py-2.5 text-[14px] text-muted-foreground">et {alertes.length - max} autre{alertes.length - max > 1 ? "s" : ""}…</li>
      )}
    </ul>
  );
}
