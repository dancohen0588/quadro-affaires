import type { Metadata } from "next";
import Link from "next/link";
import { adaptateurs } from "@/adapters";
import { Etat } from "@/components/affaire/pastille-phase";
import { LIBELLES_ECHEANCE } from "@/components/vente/libelles";
import { SaisirReception } from "@/components/vente/saisir-reception";
import { dateCourte, euros } from "@/lib/format";
import { lundiDeSemaine, semaineIso } from "@/lib/rules/calendrier";
import { etatEcheance } from "@/lib/rules/echeancier";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { chargerReferentiel } from "@/server/referentiel";

export const metadata: Metadata = { title: "Règlements" };

type Ligne = {
  id: string; type: string; montant_prevu_cts: number; montant_recu_cts: number | null; recu_le: string | null; date_attendue: string | null;
  mode: string | null; vente: { id: string; magasin: { code: string; nom: string }; affaire: { id: string; libelle: string; concepteur_id: string }[] };
};
const champ = "h-9 rounded-lg border border-input bg-card px-2.5 text-[14px]";
const texte = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 40) : "");

/**
 * Règlements (EF-53) : en retard, attendus, reçus cette semaine, avec totaux ; filtres magasin et
 * concepteur pour les gérants. Une conceptrice n'y voit que ses affaires (section 12). Aucune opération
 * bancaire : on constate une réception, rien de plus.
 */
export default async function Reglements({ searchParams }: PageProps<"/reglements">) {
  const moi = await exigerProfil();
  const sp = await searchParams;
  const gerant = moi.role === "gerant";
  const magasin = gerant ? texte(sp.magasin) : "";
  const concepteur = gerant ? texte(sp.concepteur) : moi.id;
  const db = await clientUtilisateur();
  const [aujourdhui, referentiel] = await Promise.all([adaptateurs().clock.today(), chargerReferentiel(moi)]);
  const lundi = lundiDeSemaine(semaineIso(aujourdhui));

  const { data, error } = await db
    .from("echeance")
    .select("id, type, montant_prevu_cts, montant_recu_cts, recu_le, date_attendue, mode, vente:vente!inner(id, magasin:magasin(code, nom), affaire(id, libelle, concepteur_id))")
    .or(`recu_le.is.null,recu_le.gte.${lundi}`)
    .order("date_attendue", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(`Règlements : ${error.message}`);
  const lignes = ((data ?? []) as unknown as Ligne[]).filter(
    (l) => l.vente.affaire.length > 0
      && (!magasin || l.vente.magasin.code === magasin)
      && (!concepteur || l.vente.affaire.some((a) => a.concepteur_id === concepteur)),
  );
  const nomConcepteur = new Map(referentiel.concepteurs.map((c) => [c.id, c.nom.split(" ")[0]]));
  const sections = [
    { titre: "En retard", lignes: lignes.filter((l) => etatEcheance(vue(l), aujourdhui) === "en_retard") },
    { titre: "Attendus", lignes: lignes.filter((l) => etatEcheance(vue(l), aujourdhui) === "attendue") },
    { titre: "Reçus cette semaine", lignes: lignes.filter((l) => !!l.recu_le) },
  ];
  const aPlanifier = lignes.filter((l) => etatEcheance(vue(l), aujourdhui) === "a_planifier").length;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="text-3xl text-encre">Règlements</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {gerant ? "Tous les magasins" : "Vos affaires"} · {aPlanifier} échéance{aPlanifier > 1 ? "s" : ""} dont la date dépend encore du planning.
        </p>
      </div>
      {gerant && (
        <form className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10" aria-label="Filtres">
          <select name="magasin" defaultValue={magasin} className={champ} aria-label="Magasin">
            <option value="">Tous les magasins</option>
            {referentiel.magasins.map((m) => <option key={m.code} value={m.code}>{m.nom}</option>)}
          </select>
          <select name="concepteur" defaultValue={concepteur} className={champ} aria-label="Concepteur">
            <option value="">Tous les concepteurs</option>
            {referentiel.concepteurs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button type="submit" className="h-9 rounded-lg bg-teal-900 px-3 text-[14px] font-semibold text-white">Filtrer</button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((s) => {
          const total = s.lignes.reduce((t, l) => t + (l.recu_le ? (l.montant_recu_cts ?? 0) : l.montant_prevu_cts), 0);
          return (
            <section key={s.titre} aria-label={s.titre} className="rounded-xl bg-card ring-1 ring-foreground/10">
              <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
                <h2 className="text-[17px] text-encre">{s.titre} <span className="text-[14px] font-semibold text-muted-foreground">({s.lignes.length})</span></h2>
                <span className="font-semibold text-encre">{euros(total, true)}</span>
              </header>
              {s.lignes.length === 0 ? (
                <p className="px-4 py-4 text-[15px] text-muted-foreground">Rien ici.</p>
              ) : (
                <ul className="divide-y px-4">
                  {s.lignes.slice(0, 60).map((l) => {
                    const a = l.vente.affaire;
                    const qui = nomConcepteur.get(a[0].concepteur_id);
                    return (
                      <li key={l.id} className="flex items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <Link href={`/affaires/${a[0].id}`} className="block truncate text-[15px] font-semibold text-encre underline-offset-2 hover:underline">
                            {a.map((x) => x.libelle).join(" + ")}
                          </Link>
                          <p className="truncate text-[13px] text-muted-foreground">
                            {LIBELLES_ECHEANCE[l.type] ?? l.type} · {euros(l.recu_le ? (l.montant_recu_cts ?? 0) : l.montant_prevu_cts)}
                            {gerant && qui ? ` · ${qui} · ${l.vente.magasin.nom.replace("Marseille ", "")}` : ""}
                          </p>
                        </div>
                        {l.recu_le ? (
                          <Etat ton={(l.montant_recu_cts ?? 0) < l.montant_prevu_cts ? "attention" : "ok"}>reçu {dateCourte(l.recu_le)}</Etat>
                        ) : (
                          <>
                            <Etat ton={s.titre === "En retard" ? "retard" : "neutre"}>{dateCourte(l.date_attendue!)}</Etat>
                            <SaisirReception
                              echeance={{ id: l.id, type: l.type, montantPrevuCts: l.montant_prevu_cts, mode: l.mode }}
                              aujourdhui={aujourdhui} libelle={a.map((x) => x.libelle).join(" + ")}
                            />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function vue(l: Ligne) {
  return { montantPrevuCts: l.montant_prevu_cts, montantRecuCts: l.montant_recu_cts, recuLe: l.recu_le, dateAttendue: l.date_attendue };
}
