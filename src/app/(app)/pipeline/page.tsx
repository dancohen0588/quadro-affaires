import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "cn";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { CarteAffaire, Initiales, PointEtat } from "@/components/pipeline/carte-affaire";
import { badgeEcheance } from "@/lib/affaire/journee";
import { euros } from "@/lib/format";
import { libelleEtat, totauxPipeline } from "@/lib/indicateurs/pipeline";
import { NAVIGATION } from "@/lib/navigation";
import { exigerProfil } from "@/server/garde";
import { chargerPipeline, type FiltresPipeline } from "@/server/indicateurs";
import { lireFiltresPipeline } from "./filtres";

const entree = NAVIGATION.find((e) => e.href === "/pipeline")!;
export const metadata: Metadata = { title: entree.libelle };

const champ = "h-9 rounded-lg border border-input bg-card px-2.5 text-[14px]";

function requete(f: FiltresPipeline, vue?: string): string {
  const p = new URLSearchParams();
  if (f.magasin) p.set("magasin", f.magasin);
  if (f.concepteur) p.set("concepteur", f.concepteur);
  if (f.inactives) p.set("inactives", "1");
  if (vue) p.set("vue", vue);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Pipeline (EF-80 à EF-82) : les affaires en cours en six colonnes, une par phase, d'après leur étape courante ;
 * filtres magasin, concepteur et « inactives seulement » ; vue liste équivalente exportable en CSV.
 */
export default async function Page({ searchParams }: PageProps<"/pipeline">) {
  const moi = await exigerProfil();
  const sp = await searchParams;
  const filtres = lireFiltresPipeline(sp);
  const liste = sp.vue === "liste";
  const { colonnes, referentiel, aujourdhui, magasin } = await chargerPipeline(moi, filtres);
  const totaux = totauxPipeline(colonnes);
  const plusieursMagasins = referentiel.magasins.length > 1;
  const avecMagasin = plusieursMagasins && !magasin;
  const seuil = referentiel.seuils.inactivite_jours;
  const cartes = colonnes.flatMap((c) => c.cartes);

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-encre">Pipeline</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {magasin?.nom ?? (plusieursMagasins ? "Tous les magasins" : referentiel.magasins[0]?.nom)}
            {" · "}{totaux.affaires} affaire{totaux.affaires > 1 ? "s" : ""} {filtres.inactives ? `sans mouvement depuis plus de ${seuil} jours` : "en cours"}
            {" · "}{euros(totaux.signesCts, true)} signés en attente de pose
          </p>
        </div>
        <nav aria-label="Affichage" className="flex rounded-lg bg-card p-0.5 ring-1 ring-foreground/10">
          {([["", "Colonnes"], ["liste", "Vue liste"]] as const).map(([v, l]) => {
            const actif = (v === "liste") === liste;
            return (
              <Link key={l} href={`/pipeline${requete(filtres, v || undefined)}`} aria-current={actif ? "page" : undefined}
                className={cn("rounded-md px-3 py-1.5 text-[14px] font-semibold", actif ? "bg-teal-900 text-white" : "text-teal-700 hover:bg-fond")}>
                {l}
              </Link>
            );
          })}
        </nav>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10" aria-label="Filtres">
        {liste && <input type="hidden" name="vue" value="liste" />}
        {plusieursMagasins && (
          <select name="magasin" defaultValue={filtres.magasin} className={champ} aria-label="Magasin">
            <option value="">Tous les magasins</option>
            {referentiel.magasins.map((m) => <option key={m.code} value={m.code}>{m.nom}</option>)}
          </select>
        )}
        <select name="concepteur" defaultValue={filtres.concepteur} className={champ} aria-label="Concepteur">
          <option value="">Tous les concepteurs</option>
          {referentiel.concepteurs
            .filter((c) => !magasin || c.magasins.includes(magasin.code))
            .map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <label className="flex items-center gap-2 px-1 text-[14px]">
          <input type="checkbox" name="inactives" value="1" defaultChecked={filtres.inactives} className="size-4 accent-teal-700" />
          Inactives seulement (&gt; {seuil} j)
        </label>
        <button type="submit" className="h-9 rounded-lg bg-teal-900 px-3 text-[14px] font-semibold text-white">Filtrer</button>
        <Link href={liste ? "/pipeline?vue=liste" : "/pipeline"} className="px-1 text-[14px] text-teal-700 underline-offset-2 hover:underline">Réinitialiser</Link>
        <a href={`/pipeline/export${requete(filtres)}`} className="ml-auto inline-flex items-center gap-1.5 px-1 text-[14px] font-semibold text-teal-700 underline-offset-2 hover:underline">
          <Download aria-hidden className="size-4" /> Exporter en CSV
        </a>
      </form>

      {liste ? (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[960px] text-left text-[14px]">
            <thead className="border-b text-[13px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Affaire</th>
                <th className="px-3 py-2.5 font-semibold">Étape</th>
                <th className="px-3 py-2.5 font-semibold">Concepteur</th>
                <th className="px-3 py-2.5 font-semibold">Prochain jalon</th>
                <th className="px-3 py-2.5 text-right font-semibold">Devis HT</th>
                <th className="px-3 py-2.5 font-semibold">Mouvement</th>
                <th className="px-3 py-2.5 font-semibold">État</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cartes.map((c) => {
                const jalon = c.jalon ? badgeEcheance({ echeance: c.jalon.echeance, statut: "a_faire" }, aujourdhui) : null;
                return (
                  <tr key={c.id} className="hover:bg-fond">
                    <td className="px-3 py-2">
                      <Link href={`/affaires/${c.id}`} className="font-semibold text-encre underline-offset-2 hover:underline">{c.libelle}</Link>
                      {avecMagasin && <span className="text-muted-foreground"> · {c.magasin.nom.replace("Marseille ", "")}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <PastillePhase couleur={c.phase.couleur}>{c.phase.numero} · {c.etape?.titre ?? c.phase.nom}</PastillePhase>
                    </td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><Initiales initiales={c.concepteur.initiales} nom={c.concepteur.prenom} />{c.concepteur.prenom}</span></td>
                    <td className="max-w-72 px-3 py-2">
                      {c.jalon ? (
                        <span className="flex items-center gap-2"><span className="truncate">{c.jalon.titre}</span>{jalon && <Etat ton={jalon.ton} className="shrink-0">{jalon.texte}</Etat>}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{c.montantCts ? euros(c.montantCts, true) : "—"}</td>
                    <td className={cn("px-3 py-2 whitespace-nowrap", c.inactive ? "font-semibold text-etat-retard" : "text-muted-foreground")}>
                      {c.joursSansMouvement === 0 ? "aujourd'hui" : `${c.joursSansMouvement} j`}
                    </td>
                    <td className="px-3 py-2" title={c.alertes.join("\n") || undefined}>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap"><PointEtat etat={c.etat} /> {libelleEtat(c.etat)}</span>
                    </td>
                  </tr>
                );
              })}
              {cartes.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucune affaire ne correspond.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid auto-cols-[minmax(205px,1fr)] grid-flow-col gap-2.5 overflow-x-auto pb-2">
          {colonnes.map((c) => {
            const id = `phase-${c.phase.code}`;
            return (
              <section key={c.phase.code} aria-labelledby={id} className="flex flex-col rounded-xl border-t-4 bg-foreground/[0.035] p-2.5" style={{ borderTopColor: c.phase.couleur }}>
                <h2 id={id} className="flex items-baseline justify-between gap-2 px-1 pt-1 pb-2.5 text-[15px] text-encre">
                  <span>{c.phase.numero} {c.phase.nom}</span>
                  <span className="text-[13px] font-semibold text-muted-foreground">{c.cartes.length}</span>
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {c.cartes.map((carte) => <CarteAffaire key={carte.id} carte={carte} aujourdhui={aujourdhui} avecMagasin={avecMagasin} />)}
                </ul>
                {c.cartes.length === 0 && <p className="px-1 py-2 text-[14px] text-muted-foreground">Aucune affaire.</p>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
