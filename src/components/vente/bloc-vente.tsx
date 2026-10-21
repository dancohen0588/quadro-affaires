import { Etat } from "@/components/affaire/pastille-phase";
import { dateCourte, euros, semaineCourte } from "@/lib/format";
import { etatEcheance } from "@/lib/rules/echeancier";
import type { Fiche } from "@/server/fiche-affaire";
import { CreerVente } from "./creer-vente";
import { BoutonCommission, ModifierEcheancier, RepondrePlanning } from "./dialogues-vente";
import { LIBELLES_ECHEANCE } from "./libelles";
import { SaisirReception } from "./saisir-reception";

const ETATS = {
  recue: ["Reçu", "ok"], partielle: ["Partiellement reçu", "attention"], en_retard: ["En retard", "retard"],
  attendue: ["Attendu", "neutre"], a_planifier: ["Date à fixer", "neutre"],
} as const;
const MODES: Record<string, string> = { cheque: "chèque", cb: "CB", virement: "virement", especes: "espèces", franfinance: "Franfinance" };
const PLANNING: Record<string, [string, "ok" | "attention" | "neutre"]> = {
  demandee: ["Demandé", "attention"], confirmee: ["Confirmé", "ok"], decalee: ["Autres dates proposées", "attention"],
};

/**
 * Vente, échéancier et planning de l'affaire (EF-36, EF-38) : création de la vente (EF-50), réceptions
 * (EF-52), échéancier modifiable (EF-51), commission (RG-14), réponse du gérant au planning (EF-61).
 */
export function BlocVente({ f, annee }: { f: Fiche; annee: number }) {
  const v = f.vente;
  return (
    <section aria-labelledby="titre-vente" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id="titre-vente" className="text-[17px] text-encre">Vente et règlements</h2>
        {v && f.peutModifier && <ModifierEcheancier venteId={v.id} echeances={f.echeances} ttcCts={v.montantTtcCts} dateSignature={v.dateSignature} />}
      </header>
      {!v ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-[15px] text-muted-foreground">
            {f.vendables ? "Le BDC est signé ? Enregistrez la vente : elle valide l'étape Vente et ouvre l'acompte 1." : "Pas encore de vente."}
          </p>
          {f.vendables && <CreerVente affaireId={f.id} vendables={f.vendables} aujourdhui={f.aujourdhui} />}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 px-5 pt-4 text-[15px]">
            <dt className="text-muted-foreground">BDC</dt>
            <dd>
              {euros(v.montantTtcCts, true)} TTC · {euros(v.montantHtCts, true)} HT · signé le {dateCourte(v.dateSignature, annee)}
              {v.gesteosRef && <span className="ml-2 font-mono text-[13px] text-muted-foreground">{v.gesteosRef}</span>}
            </dd>
            {v.affaires.length > 1 && (<><dt className="text-muted-foreground">Vente commune</dt><dd>{v.affaires.join(" + ")}</dd></>)}
            {v.financement === "franfinance" && (<><dt className="text-muted-foreground">Financement</dt><dd>Franfinance</dd></>)}
            <dt className="text-muted-foreground">Commission</dt>
            <dd className="flex items-center gap-2">
              {v.commissionLe ? `saisie le ${dateCourte(v.commissionLe, annee)}` : f.echeances.some((e) => e.type === "acompte_1" && e.recuLe) ? "à saisir (RG-14)" : "après l'acompte 1"}
              {!v.commissionLe && f.peutModifier && f.echeances.some((e) => e.type === "acompte_1" && e.recuLe) && <BoutonCommission venteId={v.id} />}
            </dd>
          </dl>
          <table className="mx-5 mt-3 mb-1 w-[calc(100%-2.5rem)] text-left text-[14px]">
            <thead className="text-[12px] text-muted-foreground">
              <tr><th className="py-1.5 font-semibold">Échéance</th><th className="font-semibold">Prévu</th><th className="font-semibold">Attendu le</th><th className="font-semibold">État</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {f.echeances.map((e) => {
                const etat = etatEcheance({ ...e, montantRecuCts: e.montantRecuCts }, f.aujourdhui);
                const [libelle, ton] = ETATS[etat];
                return (
                  <tr key={e.id} data-echeance={e.type}>
                    <td className="py-2 font-semibold text-encre">
                      {LIBELLES_ECHEANCE[e.type] ?? e.type}
                      {e.commentaire && <span className="block text-[12px] font-normal text-muted-foreground">{e.commentaire}</span>}
                    </td>
                    <td>{euros(e.montantPrevuCts)}</td>
                    <td>{e.dateAttendue ? dateCourte(e.dateAttendue, annee) : "—"}</td>
                    <td>
                      <Etat ton={ton}>{libelle}</Etat>
                      {e.recuLe && (
                        <span className="block text-[12px] text-muted-foreground">
                          {euros(e.montantRecuCts ?? 0)} le {dateCourte(e.recuLe, annee)}{e.mode ? ` · ${MODES[e.mode] ?? e.mode}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {!e.recuLe && f.peutModifier && <SaisirReception echeance={e} aujourdhui={f.aujourdhui} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {f.planning && (
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t px-5 py-3 text-[15px]">
              <span className="font-semibold text-encre">Planning</span>
              <Etat ton={PLANNING[f.planning.statut]?.[1] ?? "neutre"}>{PLANNING[f.planning.statut]?.[0] ?? f.planning.statut}</Etat>
              <span className="flex-1 text-muted-foreground">
                {f.planning.proposition
                  ? `proposé : livraison ${f.planning.proposition.semaine ? semaineCourte(f.planning.proposition.semaine) : "?"}, pose ${f.planning.proposition.datePose ? dateCourte(f.planning.proposition.datePose, annee) : "?"}`
                  : `livraison ${f.planning.semaineLivraison ? semaineCourte(f.planning.semaineLivraison) : "à définir"} · pose ${f.planning.datePose ? dateCourte(f.planning.datePose, annee) : "à définir"}${f.planning.poseur && f.planning.statut === "confirmee" ? ` · ${f.planning.poseur}` : ""}`}
                {f.planning.commentaire && ` · ${f.planning.commentaire}`}
              </span>
              {f.estGerant && f.planning.statut !== "confirmee" && (
                <RepondrePlanning venteId={v.id} semaine={f.planning.semaineSouhaitee} datePose={f.planning.datePoseSouhaitee} poseur={f.planning.poseur} />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
