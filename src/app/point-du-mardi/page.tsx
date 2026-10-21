import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "cn";
import { ListeAlertes } from "@/components/pilotage/blocs";
import { dateCourte, euros, heure, jourDe, nomCourtMagasin } from "@/lib/format";
import { taux } from "@/lib/indicateurs/agregats";
import { JOURS } from "@/lib/affaire/journee";
import { jourDeSemaine, semaineIso } from "@/lib/rules/calendrier";
import { exigerGerant } from "@/server/garde";
import { chargerPointDuMardi, type ElementSemaine } from "@/server/indicateurs";

export const metadata: Metadata = { title: "Point du mardi" };

/**
 * Point du mardi (EF-93) : page grand format pour le partage d'écran Teams, une colonne par magasin.
 * Semaine passée (ventes, CA, RDV, transformation), semaine à venir (R3 prévus, livraisons, poses,
 * règlements attendus) et alertes. Hors de la coquille de l'application pour gagner toute la largeur.
 */
export default async function PointDuMardi() {
  await exigerGerant();
  const { aujourdhui, fin, semainePassee, colonnes } = await chargerPointDuMardi();
  const semaine = semaineIso(aujourdhui).slice(5);
  const passee = semainePassee.debut ? semaineIso(semainePassee.debut).slice(5) : "";
  const total = colonnes.reduce((s, c) => ({
    ventes: s.ventes + c.passee.ventes, ca: s.ca + c.passee.caHtCts, r3: s.r3 + c.passee.r3, vendues: s.vendues + c.passee.vendues,
    alertes: s.alertes + c.alertes.filter((a) => a.gravite === 1).length,
  }), { ventes: 0, ca: 0, r3: 0, vendues: 0, alertes: 0 });

  return (
    <div className="min-h-dvh bg-fond text-[18px] text-encre">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-teal-900 px-8 py-5 text-white">
        <div>
          <p className="text-[14px] font-semibold tracking-[0.14em] text-sage-500 uppercase">Quadro Affaires · Point du mardi</p>
          <h1 className="mt-1 text-[34px] leading-tight text-white">Semaine {semaine} · {JOURS[jourDeSemaine(aujourdhui)]} {dateCourte(aujourdhui)}</h1>
        </div>
        <dl className="flex flex-wrap gap-8">
          <Chiffre libelle={`Ventes ${passee}`} valeur={String(total.ventes)} />
          <Chiffre libelle={`CA signé ${passee}`} valeur={euros(total.ca, true)} />
          <Chiffre libelle="Transformation" valeur={`${taux(total.vendues, total.r3) ?? "—"}${total.r3 ? " %" : ""}`} />
          <Chiffre libelle="Alertes urgentes" valeur={String(total.alertes)} rouge={total.alertes > 0} />
        </dl>
        <Link href="/pilotage" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-semibold text-sage-100 ring-1 ring-white/30 hover:bg-white/10">
          <ArrowLeft aria-hidden className="size-4" /> Pilotage
        </Link>
      </header>

      <main className="grid gap-5 p-6 xl:grid-cols-3">
        {colonnes.map((c) => {
          const id = `magasin-${c.magasin.code}`;
          const tx = taux(c.passee.vendues, c.passee.r3);
          return (
            <section key={c.magasin.code} aria-labelledby={id} className="flex flex-col gap-4">
              <h2 id={id} className="text-[28px] text-teal-900">{c.magasin.nom}</h2>

              <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h3 className="text-[15px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Semaine passée · {passee}</h3>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Mesure libelle="Ventes" valeur={String(c.passee.ventes)} />
                  <Mesure libelle="CA signé HT" valeur={euros(c.passee.caHtCts, true)} />
                  <Mesure libelle="RDV R1 · R2 · R3" valeur={`${c.passee.rdv.R1} · ${c.passee.rdv.R2} · ${c.passee.rdv.R3}`} />
                  <Mesure libelle="Transformation" valeur={tx === null ? "—" : `${tx} %`} detail={c.passee.r3 ? `${c.passee.vendues} / ${c.passee.r3} R3` : undefined} />
                </div>
              </article>

              <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <h3 className="text-[15px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  À venir · {dateCourte(aujourdhui)} → {dateCourte(fin)}
                </h3>
                <Liste titre="R3 prévus" elements={c.aVenir.r3} quand={(q) => `${JOURS[jourDeSemaine(jourDe(q))]} ${heure(q)}`} />
                <Liste titre="Livraisons" elements={c.aVenir.livraisons} quand={(q) => q.slice(5)} />
                <Liste titre="Poses" elements={c.aVenir.poses} quand={(q) => `${JOURS[jourDeSemaine(q)]} ${dateCourte(q)}`} />
                <p className="mt-4 flex items-baseline justify-between border-t pt-3">
                  <span className="font-semibold">Règlements attendus</span>
                  <span className="font-heading text-[22px] font-bold text-teal-900">
                    {euros(c.aVenir.reglementsCts, true)} <span className="font-sans text-[15px] font-normal text-muted-foreground">({c.aVenir.nbReglements})</span>
                  </span>
                </p>
              </article>

              <article className="rounded-xl bg-card ring-1 ring-foreground/10">
                <h3 className="px-5 pt-4 pb-2 text-[15px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Alertes · {nomCourtMagasin(c.magasin.nom)}
                </h3>
                <ListeAlertes alertes={c.alertes} max={6} avecMagasin={false} />
              </article>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function Chiffre({ libelle, valeur, rouge = false }: { libelle: string; valeur: string; rouge?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] text-sage-100/80">{libelle}</dt>
      <dd className={cn("font-heading text-[28px] font-bold", rouge ? "text-[#F2A59E]" : "text-white")}>{valeur}</dd>
    </div>
  );
}

function Mesure({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <div>
      <p className="text-[15px] text-muted-foreground">{libelle}</p>
      <p className="font-heading text-[30px] leading-tight font-bold text-teal-900">{valeur}</p>
      {detail && <p className="text-[14px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Liste({ titre, elements, quand }: { titre: string; elements: ElementSemaine[]; quand: (q: string) => string }) {
  return (
    <div className="mt-3">
      <p className="flex items-baseline justify-between font-semibold">
        {titre} <span className="text-[15px] font-normal text-muted-foreground">{elements.length}</span>
      </p>
      {elements.length === 0 ? (
        <p className="text-[16px] text-muted-foreground">Aucun.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1 text-[16px]">
          {elements.slice(0, 6).map((e, i) => (
            <li key={`${e.affaireId}-${i}`} className="flex items-baseline justify-between gap-3">
              <Link href={`/affaires/${e.affaireId}`} className="truncate underline-offset-2 hover:underline">{e.libelle}</Link>
              <span className="shrink-0 text-muted-foreground">{quand(e.quand)}</span>
            </li>
          ))}
          {elements.length > 6 && <li className="text-muted-foreground">et {elements.length - 6} de plus…</li>}
        </ul>
      )}
    </div>
  );
}
