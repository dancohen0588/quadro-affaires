import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BlocRdv } from "@/components/affaire/bloc-rdv";
import { DocumentsAttendus, Historique, Intervenants } from "@/components/affaire/blocs-lateraux";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { Reassigner } from "@/components/affaire/reassigner";
import { TimelineProcess } from "@/components/affaire/timeline-process";
import { ValiderEtape } from "@/components/affaire/valider-etape";
import { dateCourte, depuis, euros, semaineCourte } from "@/lib/format";
import { chargerFiche, type Fiche } from "@/server/fiche-affaire";
import { exigerProfil } from "@/server/garde";

export const metadata: Metadata = { title: "Fiche affaire" };

const STATUTS: Record<string, [string, "ok" | "attention" | "retard" | "neutre"]> = {
  perdue: ["Perdue", "retard"], abandonnee: ["Abandonnée", "neutre"], cloturee: ["Clôturée", "ok"],
};
const ECHEANCES: Record<string, string> = { acompte_1: "Acompte 1", acompte_2: "Livraison", solde: "Solde", autre: "Autre" };

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="min-w-0 text-encre">{children}</dd>
    </>
  );
}

/** Synthèse de l'affaire (EF-30, EF-36, EF-38) : client, montant, échéancier, RDV clés, livraison, pose. */
function Synthese({ f, annee }: { f: Fiche; annee: number }) {
  const premierRdv = (type: string) => f.rdv.filter((r) => r.type === type && r.statut !== "annule").at(type === "R3" ? -1 : 0);
  const rdvCles = ["R1", "R2", "R3"].map((t) => premierRdv(t)).map((r) => (r ? dateCourte(r.debut, annee) : "—"));
  return (
    <section aria-label="Synthèse" className="rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10">
      <div className="grid gap-x-10 gap-y-2 text-[15px] 2xl:grid-cols-2">
        <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2">
          <Ligne libelle="Client">{f.client.nom}{f.client.telephone && <span className="whitespace-nowrap"> · {f.client.telephone}</span>}</Ligne>
          <Ligne libelle="Adresse">{f.client.adresse ?? "—"}</Ligne>
          <Ligne libelle={f.vente ? "Montant BDC" : "Montant devis"}>
            {f.vente
              ? `${euros(f.vente.montantTtcCts, true)} TTC · signé le ${dateCourte(f.vente.dateSignature, annee)}`
              : f.montantDevisHtCts !== null ? `${euros(f.montantDevisHtCts, true)} HT` : "—"}
          </Ligne>
          <Ligne libelle="Échéancier">
            {f.echeances.length === 0 ? "—" : (
              <span className="flex flex-wrap gap-1.5">
                {f.echeances.map((e) => {
                  const enRetard = !e.recuLe && !!e.dateAttendue && e.dateAttendue < f.aujourdhui;
                  return (
                    <Etat key={e.type} ton={e.recuLe ? "ok" : enRetard ? "retard" : "neutre"}>
                      {ECHEANCES[e.type] ?? e.type}{e.recuLe ? ` reçu ${dateCourte(e.recuLe, annee)}` : enRetard ? " en retard" : ""}
                    </Etat>
                  );
                })}
              </span>
            )}
          </Ligne>
        </dl>
        <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2">
          <Ligne libelle="R1 / R2 / R3">{rdvCles.join(" · ")}</Ligne>
          <Ligne libelle="Livraison">
            {f.planning?.semaineLivraison ? `${semaineCourte(f.planning.semaineLivraison)} · ${f.planning.livraisonConfirmee ? "confirmée" : "souhaitée"}` : "—"}
          </Ligne>
          <Ligne libelle="Pose">
            {f.planning?.datePose ? `${dateCourte(f.planning.datePose, annee)} · ${f.planning.poseConfirmee ? (f.planning.poseur ?? "confirmée") : "souhaitée"}` : "—"}
          </Ligne>
          <Ligne libelle="Dernier mouvement">{depuis(f.derniereActivite, f.aujourdhui)}</Ligne>
        </dl>
      </div>
    </section>
  );
}

/** Fiche affaire (EF-30 à EF-41), d'après docs/maquettes/fiche-affaire.png. */
export default async function FicheAffaire({ params }: PageProps<"/affaires/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const moi = await exigerProfil();
  const f = await chargerFiche(id, moi);
  if (!f) notFound();
  const annee = Number(f.aujourdhui.slice(0, 4));
  const statut = STATUTS[f.statut];
  const blocages = Object.fromEntries(f.aValider.map((e) => [e.cle, e.blocage]));

  return (
    <div className="flex min-h-full flex-col">
      <header data-testid="entete-affaire" className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b bg-card px-8 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] leading-tight text-encre">{f.libelle}</h1>
          <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
            {f.contremarque} · {f.magasin.nom} · {f.concepteur.prenom}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {statut ? (
            <Etat ton={statut[1]}>{statut[0]}{f.motifPerte ? ` · ${f.motifPerte}` : ""}</Etat>
          ) : f.etapeCourante ? (
            <PastillePhase couleur={f.etapeCourante.couleur}>
              {f.etapeCourante.phaseNumero} {f.etapeCourante.phaseNom.split(" & ")[0]} · {f.etapeCourante.titre}
            </PastillePhase>
          ) : null}
          {f.concepteursPossibles && <Reassigner affaireId={f.id} actuel={f.concepteur.id} possibles={f.concepteursPossibles} />}
          <span
            role="link"
            aria-disabled="true"
            title="L'explorateur PCloud simulé arrive au bloc J5."
            className="inline-flex h-10 cursor-not-allowed items-center rounded-lg border px-4 text-[15px] font-semibold text-muted-foreground"
          >
            Ouvrir le dossier PCloud
          </span>
          {f.aValider.length > 0 && <ValiderEtape affaireId={f.id} etapes={f.aValider} motifs={f.motifs} aujourdhui={f.aujourdhui} />}
        </div>
      </header>

      <div className="grid flex-1 gap-5 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Synthese f={f} annee={annee} />
          <TimelineProcess
            phases={f.process.phases} nom={f.process.nom} faites={f.process.faites} total={f.process.total}
            affaireId={f.id} modifiable={f.peutModifier} blocages={blocages} annee={annee}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <DocumentsAttendus documents={f.documents} annee={annee} />
          <BlocRdv affaireId={f.id} rdv={f.rdv} aujourdhui={f.aujourdhui} modifiable={f.peutModifier} />
          <Intervenants
            intervenants={f.intervenants}
            poseur={f.planning?.poseur && f.planning.datePose ? { nom: f.planning.poseur, detail: `pose le ${dateCourte(f.planning.datePose, annee)}` } : null}
          />
          <Historique evenements={f.historique} annee={annee} />
        </div>
      </div>
    </div>
  );
}
