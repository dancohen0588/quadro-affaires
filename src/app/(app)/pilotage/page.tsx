import type { Metadata } from "next";
import Link from "next/link";
import { Presentation } from "lucide-react";
import { Etat } from "@/components/affaire/pastille-phase";
import { Barres, Bloc, CarteKpi, ListeAlertes } from "@/components/pilotage/blocs";
import { LIBELLES_ECHEANCE } from "@/components/vente/libelles";
import { dateCourte, euros, nomCourtMagasin } from "@/lib/format";
import {
  PERIODES, affairesEnRetard, estPeriode, eurosCompacts, filtrer, moyenne, repartition, somme, taux,
} from "@/lib/indicateurs/agregats";
import { NAVIGATION } from "@/lib/navigation";
import { joursEntre, semaineIso } from "@/lib/rules/calendrier";
import { exigerGerant } from "@/server/garde";
import { chargerPilotage } from "@/server/indicateurs";

const entree = NAVIGATION.find((e) => e.href === "/pilotage")!;
export const metadata: Metadata = { title: entree.libelle };

const champ = "h-9 rounded-lg border border-input bg-card px-2.5 text-[14px]";
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Pilotage (EF-90 à EF-92, gérants) : indicateurs de la section 10 filtrables par période et par magasin,
 * alertes triées par gravité, affaires par phase, RDV par type, règlements à vérifier. Lecture seule.
 */
export default async function Page({ searchParams }: PageProps<"/pilotage">) {
  await exigerGerant();
  const sp = await searchParams;
  const periode = estPeriode(sp.periode) ? sp.periode : "mois";
  const code = typeof sp.magasin === "string" ? sp.magasin.slice(0, 10) : "";
  const d = await chargerPilotage(periode, code);
  const p = d.periodes.find((x) => x.code === periode);
  const libellePeriode = (p?.libelle ?? "").toLowerCase();

  const enCours = filtrer(d.enCours, { magasinId: d.magasin?.id });
  const nbEnCours = somme(enCours, (l) => l.nb_affaires);
  const parMagasin = d.magasins
    .filter((m) => !d.magasin || m.id === d.magasin.id)
    .map((m) => `${nomCourtMagasin(m.nom)} ${somme(filtrer(d.enCours, { magasinId: m.id }), (l) => l.nb_affaires)}`);
  const ca = somme(d.ventes, (l) => l.ca_ht_cts);
  const nbVentes = somme(d.ventes, (l) => l.nb_ventes);
  const caCompact = eurosCompacts(ca);
  const panier = moyenne(ca, nbVentes);
  const r3 = somme(d.transformation, (l) => l.nb_r3);
  const vendues = somme(d.transformation, (l) => l.nb_vendues);
  const tx = taux(vendues, r3);
  const retard = affairesEnRetard(d.alertes);
  const urgentes = d.alertes.filter((a) => a.gravite === 1).length;

  const rdv = (["R0", "R1", "R2", "R3"] as const).map((t) => ({
    libelle: t, valeur: somme(d.rdv.filter((r) => r.type === t), (r) => r.nb),
  }));
  const flux = somme(d.flux, (l) => l.nb_clients);
  const cnq = somme(d.flux, (l) => l.nb_cnq);
  const potentiel = somme(d.potentiel, (l) => l.potentiel_ht_cts);
  const nbPotentiel = somme(d.potentiel, (l) => l.nb_affaires);
  const delai = moyenne(somme(d.delai, (l) => l.total_jours), somme(d.delai, (l) => l.nb_ventes));
  const attendu = somme(d.reglements, (l) => l.attendu_30j_cts);
  const enRetardCts = somme(d.reglements, (l) => l.retard_cts);
  const nbRetard = somme(d.reglements, (l) => l.nb_retard);
  const motifs = repartition(d.motifs, (l) => l.motif, (l) => l.nb ?? 0);
  const goulot = [...d.parPhase].sort((a, b) => b.nombre - a.nombre)[0];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-encre">Pilotage</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Semaine {semaineIso(d.aujourdhui).slice(6)} · {d.magasin ? d.magasin.nom : "les trois showrooms"}
            {p?.debut && p.fin && ` · ${p.libelle} : du ${dateCourte(p.debut)} au ${dateCourte(p.fin)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex flex-wrap items-center gap-2" aria-label="Filtres">
            <select name="periode" defaultValue={periode} className={champ} aria-label="Période">
              {PERIODES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
            <select name="magasin" defaultValue={d.magasin?.code ?? ""} className={champ} aria-label="Magasin">
              <option value="">Tous les magasins</option>
              {d.magasins.map((m) => <option key={m.code} value={m.code}>{m.nom}</option>)}
            </select>
            <button type="submit" className="h-9 rounded-lg border border-input bg-card px-3 text-[14px] font-semibold text-teal-900">Afficher</button>
          </form>
          <Link href="/point-du-mardi" className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-900 px-3.5 text-[14px] font-semibold text-white">
            <Presentation aria-hidden className="size-4" /> Point du mardi
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CarteKpi id="kpi-en-cours" libelle="Affaires en cours" valeur={String(nbEnCours)} detail={parMagasin.join(" · ")} />
        <CarteKpi id="kpi-ca" libelle={`CA signé · ${libellePeriode}`} valeur={caCompact.valeur} unite={`${caCompact.unite} HT`}
          detail={`${nbVentes} BDC${panier ? ` · panier moyen ${euros(panier, true)}` : ""}`} />
        <CarteKpi id="kpi-transformation" libelle="Transformation R3 → vente" valeur={tx === null ? "—" : String(tx)} unite={tx === null ? undefined : "%"}
          detail={`${r3} premier${r3 > 1 ? "s" : ""} R3 · ${pluriel(vendues, "vendue")} à ce jour`} />
        <CarteKpi id="kpi-retard" libelle="Affaires en retard" valeur={String(retard.total)} ton={retard.total ? "retard" : "normal"}
          detail={`${retard.commerce} commerce · ${retard.apresVente} après-vente · ${retard.sansMouvement} sans mouvement`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Bloc id="bloc-alertes" titre="Alertes" compteur={d.alertes.length ? { n: d.alertes.length, ton: urgentes ? "retard" : "attention" } : undefined}
          action={<span className="text-[13px] text-muted-foreground">Tri : gravité, puis ancienneté</span>}>
          <ListeAlertes alertes={d.alertes} max={14} avecMagasin={!d.magasin} />
        </Bloc>
        <div className="flex flex-col gap-4">
          <Bloc id="bloc-phases" titre="Affaires en cours par phase">
            <Barres lignes={d.parPhase.map((x) => ({ libelle: `${x.numero} ${x.nom}`, valeur: x.nombre, couleur: x.couleur }))} />
            {goulot && goulot.nombre > 0 && (
              <p className="border-t px-5 py-3 text-[13px] text-muted-foreground">Phase la plus chargée : {goulot.numero} {goulot.nom} ({pluriel(goulot.nombre, "affaire")}).</p>
            )}
          </Bloc>
          <Bloc id="bloc-rdv" titre={`RDV faits · ${libellePeriode}`}>
            <Barres lignes={[...rdv, { libelle: "Ventes", valeur: nbVentes, couleur: "var(--phase-03)" }]} />
          </Bloc>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CarteKpi id="kpi-flux" libelle={`Flux entrant · ${libellePeriode}`} valeur={String(flux)} unite="contacts" detail={`dont ${cnq} CNQ`} />
        <CarteKpi id="kpi-potentiel" libelle="Potentiel en conception et vente" valeur={eurosCompacts(potentiel).valeur} unite={`${eurosCompacts(potentiel).unite} HT`}
          detail={`${pluriel(nbPotentiel, "affaire")}, devis non pondérés`} />
        <CarteKpi id="kpi-delai" libelle="Délai moyen R1 → vente" valeur={delai === null ? "—" : String(delai)} unite={delai === null ? undefined : "jours"}
          detail={`sur ${pluriel(somme(d.delai, (l) => l.nb_ventes), "vente")} de la période`} />
        <CarteKpi id="kpi-reglements" libelle="Règlements attendus à 30 j" valeur={eurosCompacts(attendu).valeur} unite={eurosCompacts(attendu).unite}
          detail={nbRetard ? `${euros(enRetardCts, true)} en retard (${pluriel(nbRetard, "échéance")})` : "aucune échéance en retard"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Bloc id="bloc-reglements" titre="Règlements à vérifier" compteur={d.aVerifier.length ? { n: d.aVerifier.length, ton: "attention" } : undefined}
          action={<span className="font-mono text-[12px] text-muted-foreground">Lecture seule · aucune action bancaire dans l&apos;outil</span>}>
          {d.aVerifier.length === 0 ? (
            <p className="px-5 py-4 text-[15px] text-muted-foreground">Aucune échéance attendue dans les 7 jours.</p>
          ) : (
            <div className="overflow-x-auto px-5 pb-2">
              <table className="w-full min-w-[640px] text-left text-[14px]">
                <thead className="text-[12px] tracking-[0.06em] text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2.5 pr-3 font-semibold">Affaire</th>
                    <th className="py-2.5 pr-3 font-semibold">Magasin</th>
                    <th className="py-2.5 pr-3 font-semibold">Jalon</th>
                    <th className="py-2.5 pr-3 text-right font-semibold">Montant</th>
                    <th className="py-2.5 pr-3 font-semibold">Attendu</th>
                    <th className="py-2.5 font-semibold">Relance</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t">
                  {d.aVerifier.slice(0, 15).map((r) => {
                    const ecart = joursEntre(r.dateAttendue, d.aujourdhui);
                    return (
                      <tr key={r.id}>
                        <td className="max-w-64 truncate py-2.5 pr-3">
                          <Link href={`/affaires/${r.affaireId}`} className="font-semibold text-encre underline-offset-2 hover:underline">{r.libelle}</Link>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">{nomCourtMagasin(r.magasin)}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">{LIBELLES_ECHEANCE[r.type] ?? r.type}</td>
                        <td className="py-2.5 pr-3 text-right whitespace-nowrap tabular-nums">{euros(r.montantCts, true)}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          {ecart > 0 ? `depuis ${ecart} j` : ecart === 0 ? "aujourd'hui" : `le ${dateCourte(r.dateAttendue)}`}
                        </td>
                        <td className="py-2.5"><Etat ton={r.aRelancer ? "retard" : "neutre"}>{r.aRelancer ? "À relancer" : "Dans les délais"}</Etat></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Bloc>
        <Bloc id="bloc-motifs" titre={`Motifs de non-vente · ${libellePeriode}`}>
          <Barres lignes={motifs.map((m) => ({ libelle: m.cle, valeur: m.total, couleur: "var(--sage-500)" }))} vide="Aucune affaire perdue sur la période." />
        </Bloc>
      </div>
    </div>
  );
}
