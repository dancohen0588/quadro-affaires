import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { Bloc } from "@/components/affaire/blocs-lateraux";
import { Etat } from "@/components/affaire/pastille-phase";
import { NouveauContact } from "@/components/clients/nouveau-contact";
import { ListeTaches } from "@/components/journee/liste-taches";
import { TacheLibre } from "@/components/journee/tache-libre";
import { badgeEcheance, titreDuJour } from "@/lib/affaire/journee";
import { dateCourte, euros } from "@/lib/format";
import { exigerProfil } from "@/server/garde";
import { chargerJournee } from "@/server/journee";

export const metadata: Metadata = { title: "Ma journée" };

const ECHEANCES: Record<string, string> = { acompte_1: "Acompte 1", acompte_2: "Acompte 2", solde: "Solde", autre: "Règlement" };

function Jauge({ libelle, valeur, max, aide }: { libelle: string; valeur: number; max: number; aide?: string }) {
  const ratio = max > 0 ? Math.min(1, valeur / max) : 0;
  const couleur = valeur > max ? "bg-etat-retard" : valeur === max ? "bg-etat-attention" : "bg-teal-500";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[15px]">
        <span>{libelle}</span>
        <span className="font-semibold text-encre">{valeur} / {max}{aide ? ` ${aide}` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-muted" role="meter" aria-label={libelle} aria-valuenow={valeur} aria-valuemin={0} aria-valuemax={max}>
        <div className={cn("h-2 rounded-full", couleur)} style={{ width: `${Math.max(ratio, valeur ? 0.04 : 0) * 100}%` }} />
      </div>
    </div>
  );
}

/** Ma journée (EF-10 à EF-18), d'après docs/maquettes/ma-journee.png. Écran par défaut. */
export default async function MaJournee({ searchParams }: PageProps<"/ma-journee">) {
  const moi = await exigerProfil();
  const { onglet } = await searchParams;
  const aVenir = onglet === "a-venir";
  const j = await chargerJournee(moi);
  const annee = Number(j.aujourdhui.slice(0, 4));
  const enRetard = j.aFaire.filter((t) => t.statut === "a_faire" && t.echeance! < j.aujourdhui).length;
  const aFaireRestant = j.aFaire.filter((t) => t.statut === "a_faire").length;
  const { r2, r3, notes } = j.jauges;
  // Jauges et compteurs pour qui porte des affaires (conceptrices, gérant concepteur comme Jean).
  const concepteur = moi.role === "conceptrice" || j.mesAffaires.enCours > 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-card px-8 py-4">
        <div>
          <h1 className="text-[26px] leading-tight text-encre">{titreDuJour(j.aujourdhui)}</h1>
          <p className="mt-0.5 text-[15px] text-muted-foreground">
            {aFaireRestant} tâche{aFaireRestant > 1 ? "s" : ""}{enRetard ? ` dont ${enRetard} en retard` : ""} · {j.rdvDuJour} RDV aujourd&apos;hui
            {j.relances.length > 0 && ` · ${j.relances.length} relance${j.relances.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {moi.role !== "transverse" && (
          <NouveauContact referentiel={j.referentiel} moi={{ id: moi.id, estGerant: moi.role === "gerant" }} aujourdhui={j.aujourdhui} />
        )}
      </header>

      <div className="grid flex-1 gap-5 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="titre-taches" className="rounded-xl bg-card ring-1 ring-foreground/10">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
              <div className="flex items-center gap-1" role="tablist" aria-label="Tâches">
                <h2 id="titre-taches" className="sr-only">Tâches</h2>
                <Link
                  href="/ma-journee" role="tab" aria-selected={!aVenir}
                  className={cn("rounded-lg px-3 py-1.5 font-heading text-[17px] font-bold", !aVenir ? "bg-sage-100 text-encre" : "text-muted-foreground hover:text-encre")}
                >
                  À faire
                </Link>
                <Link
                  href="/ma-journee?onglet=a-venir" role="tab" aria-selected={aVenir}
                  className={cn("rounded-lg px-3 py-1.5 font-heading text-[17px] font-bold", aVenir ? "bg-sage-100 text-encre" : "text-muted-foreground hover:text-encre")}
                >
                  À venir <span className="text-[14px] font-semibold text-muted-foreground">{j.aVenir.length}</span>
                </Link>
                {!aVenir && enRetard > 0 && <Etat ton="retard" className="ml-2">{enRetard} en retard</Etat>}
              </div>
              <TacheLibre moi={moi.id} aujourdhui={j.aujourdhui} personnes={j.referentiel.personnes} affaires={j.affairesPourTache} />
            </header>
            <ListeTaches
              taches={aVenir ? j.aVenir : j.aFaire} aujourdhui={j.aujourdhui} etapes={j.etapes}
              vide={aVenir ? "Rien de prévu dans les 7 prochains jours." : "Rien à faire aujourd'hui. Belle journée !"}
            />
          </section>

          {j.files.map((f, i) => (
            <Bloc key={f.titre} titre={`${f.titre} (${f.elements.length})`} id={`titre-file-${i}`}>
              {f.elements.length === 0 ? (
                <p className="px-5 py-4 text-[15px] text-muted-foreground">{f.vide}</p>
              ) : (
                <ul className="divide-y px-5">
                  {f.elements.map((e) => (
                    <li key={`${e.affaireId}-${e.depuis}`} className="flex flex-wrap items-center gap-3 py-2.5 text-[15px]">
                      <Link href={`/affaires/${e.affaireId}`} className="min-w-0 flex-1 font-semibold text-encre underline-offset-2 hover:underline">{e.libelle}</Link>
                      {e.detail && <span className="text-[14px] text-muted-foreground">{e.detail}</span>}
                      <Etat ton={e.enRetard ? "retard" : "neutre"}>{e.enRetard ? "En retard · " : ""}depuis le {dateCourte(e.depuis, annee)}</Etat>
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {concepteur && (
            <Bloc titre="Règles de la semaine" id="titre-regles">
              <div className="flex flex-col gap-4 px-5 py-4">
                <Jauge libelle="R2 aujourd'hui" valeur={r2.nombre} max={r2.max} aide="max" />
                <Jauge libelle="R3 cette semaine" valeur={r3.nombre} max={r3.max} aide="max" />
                {notes.faits > 0 && <Jauge libelle="Notes après RDV (7 jours)" valeur={notes.avecNotes} max={notes.faits} />}
                <p className="text-[13px] text-muted-foreground">
                  Au-delà de {r2.max} R2 par jour ou {r3.max} R3 par semaine, l&apos;outil avertit sans bloquer (RG-30, RG-31).
                </p>
              </div>
            </Bloc>
          )}

          <Bloc titre={`Relances client${j.relances.length ? ` (${j.relances.length})` : ""}`} id="titre-relances">
            {j.relances.length === 0 ? (
              <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucune relance due.</p>
            ) : (
              <ul className="divide-y px-5">
                {j.relances.map((r) => {
                  const badge = badgeEcheance({ echeance: r.echeance, statut: "a_faire" }, j.aujourdhui);
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      <span aria-hidden className={cn("w-1 self-stretch rounded-full", badge.ton === "retard" ? "bg-etat-retard" : "bg-etat-attention")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-encre">{r.libelle}</p>
                        <p className="truncate text-[13px] text-muted-foreground">{r.titre} · {badge.texte.toLowerCase()}</p>
                      </div>
                      <Link href={r.lien} className="rounded-lg border px-3 py-1.5 text-[14px] font-semibold text-encre hover:bg-muted">Relancer</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloc>

          <Bloc titre="Règlements à suivre" id="titre-reglements">
            {j.reglements.length === 0 ? (
              <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucun règlement attendu cette semaine.</p>
            ) : (
              <ul className="divide-y px-5">
                {j.reglements.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/affaires/${r.affaireId}`} className="block truncate text-[15px] font-semibold text-encre underline-offset-2 hover:underline">{r.libelle}</Link>
                      <p className="text-[13px] text-muted-foreground">{ECHEANCES[r.type] ?? r.type} · {euros(r.montantCts)}</p>
                    </div>
                    <Etat ton={r.enRetard ? "retard" : "neutre"}>{r.enRetard ? "En retard" : "Attendu"} · {dateCourte(r.dateAttendue, annee)}</Etat>
                  </li>
                ))}
              </ul>
            )}
          </Bloc>

          {concepteur && (
            <Bloc titre="Mes affaires" id="titre-mes-affaires">
              <dl className="grid grid-cols-[1fr_auto] gap-y-2.5 px-5 py-4 text-[15px]">
                <dt>En cours</dt><dd className="text-right font-semibold"><Link href="/affaires" className="underline-offset-2 hover:underline">{j.mesAffaires.enCours}</Link></dd>
                <dt>Sans mouvement &gt; {j.referentiel.seuils.inactivite_jours} j</dt>
                <dd className={cn("text-right font-semibold", j.mesAffaires.sansMouvement > 0 && "text-etat-retard")}>
                  <Link href="/affaires?inactives=1" className="underline-offset-2 hover:underline">{j.mesAffaires.sansMouvement}</Link>
                </dd>
                <dt>Signées ce mois</dt>
                <dd className="text-right font-semibold">{j.mesAffaires.signees}{j.mesAffaires.signees > 0 && ` · ${euros(j.mesAffaires.signeesTtcCts, true)}`}</dd>
              </dl>
            </Bloc>
          )}
        </div>
      </div>
    </div>
  );
}
