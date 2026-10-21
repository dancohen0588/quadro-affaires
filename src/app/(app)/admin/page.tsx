import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "cn";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { Bloc } from "@/components/pilotage/blocs";
import { ImportCsv } from "@/components/admin/import-csv";
import { FormListe, FormReferents, FormSeuils } from "@/components/admin/parametres";
import { ActiverUtilisateur, ModifierUtilisateur, type UtilisateurVue } from "@/components/admin/utilisateurs";
import { dateCourte } from "@/lib/format";
import { COLONNES } from "@/lib/import/affaires";
import { NAVIGATION } from "@/lib/navigation";
import { LIBELLES_ROLES, decrireEcheance } from "@/lib/process/lecture";
import { chargerProcess } from "@/lib/process/valider";
import { LISTES } from "@/lib/rules/parametres";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerGerant } from "@/server/garde";

const entree = NAVIGATION.find((e) => e.href === "/admin")!;
export const metadata: Metadata = { title: entree.libelle };

const ONGLETS = [["utilisateurs", "Utilisateurs"], ["parametres", "Paramètres"], ["process", "Modèle de process"], ["import", "Import de reprise"]] as const;
type Onglet = (typeof ONGLETS)[number][0];
const ROLES: Record<string, string> = { gerant: "Gérant", conceptrice: "Conceptrice", transverse: "Transverse" };
const REFERENTS: Record<string, string> = { gerant_bpa: "BPA", gerant_logistique: "logistique", gerant_finance: "finance", responsable_r4: "R4" };

/**
 * Administration légère (session 5.2, gérants) : utilisateurs (EF-100, rôle, magasins, désactivation avec
 * réassignation), paramètres (EF-102, seuils, listes, référents), version de process en lecture seule
 * (l'éditeur complet EF-103 attend le bloc B6), import CSV de reprise (section 13.1).
 */
export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const moi = await exigerGerant();
  const sp = await searchParams;
  const onglet: Onglet = ONGLETS.some(([o]) => o === sp.onglet) ? (sp.onglet as Onglet) : "utilisateurs";
  const modifiable = moi.estAdmin;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="text-3xl text-encre">Administration</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {modifiable ? "Réservé aux gérants administrateurs." : "Lecture seule : seuls les administrateurs modifient."}
        </p>
      </div>
      <nav aria-label="Rubriques de l'administration" className="flex flex-wrap gap-1 border-b">
        {ONGLETS.map(([o, l]) => (
          <Link key={o} href={`/admin?onglet=${o}`} aria-current={o === onglet ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-[15px] font-semibold", o === onglet ? "border-teal-700 text-teal-900" : "border-transparent text-muted-foreground hover:text-encre")}>
            {l}
          </Link>
        ))}
      </nav>
      {onglet === "utilisateurs" && <Utilisateurs moi={moi.id} modifiable={modifiable} />}
      {onglet === "parametres" && <Parametres modifiable={modifiable} />}
      {onglet === "process" && <Process />}
      {onglet === "import" && (
        <Bloc id="bloc-import" titre="Import de reprise des affaires actives"
          action={<a href="/admin/exemple.csv" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal-700 underline-offset-2 hover:underline"><Download aria-hidden className="size-4" /> Fichier d&apos;exemple</a>}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <p className="text-[15px] text-muted-foreground">
              Une ligne par affaire active. L&apos;affaire est placée à son étape (<span className="font-mono text-[13px]">etape_code</span>), les étapes antérieures sont
              marquées faites sans créer leurs tâches ; une date de signature crée la vente et son échéancier 40 / 50 / 10. Commencez par un essai : rien n&apos;est écrit,
              le rapport liste les lignes rejetées et leur motif. Une affaire déjà présente n&apos;est jamais créée deux fois.
            </p>
            <details className="text-[14px]">
              <summary className="cursor-pointer font-semibold text-teal-700">Colonnes attendues ({COLONNES.length})</summary>
              <p className="mt-2 font-mono text-[12px] break-all text-muted-foreground">{COLONNES.join(";")}</p>
            </details>
            <ImportCsv />
          </div>
        </Bloc>
      )}
    </div>
  );
}

async function Utilisateurs({ moi, modifiable }: { moi: string; modifiable: boolean }) {
  const db = await clientUtilisateur();
  const [{ data: profils }, { data: magasins }, { data: affaires }, { data: taches }, { data: referents }] = await Promise.all([
    db.from("profil").select("id, prenom, nom, email, role, est_admin, actif, rubriques, profil_magasin!profil_magasin_profil_id_fkey(magasin(code))").order("prenom"),
    db.from("magasin").select("code, nom").order("nom"),
    db.from("affaire").select("concepteur_id").in("statut", ["active", "gagnee"]).limit(20000),
    db.from("tache").select("assignee_id").eq("statut", "a_faire").limit(20000),
    db.from("parametre").select("cle, valeur").in("cle", Object.keys(REFERENTS)),
  ]);
  const compte = (ids: string[]) => ids.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>());
  const nbAffaires = compte((affaires ?? []).map((a) => a.concepteur_id));
  const nbTaches = compte((taches ?? []).map((t) => t.assignee_id));
  type Lu = { id: string; prenom: string; nom: string; email: string; role: string; est_admin: boolean; actif: boolean; rubriques: string[]; profil_magasin: { magasin: { code: string } | null }[] };
  const vues: UtilisateurVue[] = ((profils ?? []) as unknown as Lu[]).map((p) => ({
    id: p.id, nom: `${p.prenom} ${p.nom}`.trim(), email: p.email, role: p.role, estAdmin: p.est_admin, actif: p.actif, rubriques: p.rubriques,
    magasins: p.profil_magasin.map((r) => r.magasin?.code ?? "").filter(Boolean).sort(),
    affaires: nbAffaires.get(p.id) ?? 0, taches: nbTaches.get(p.id) ?? 0,
    referent: (referents ?? []).filter((r) => r.valeur === p.id).map((r) => REFERENTS[r.cle]).join(", ") || null,
  }));
  const repreneurs = vues.filter((v) => v.actif && (v.role === "gerant" || v.role === "conceptrice")).map((v) => ({ id: v.id, nom: v.nom }));
  return (
    <Bloc id="bloc-utilisateurs" titre="Utilisateurs" action={<span className="text-[13px] text-muted-foreground">{vues.filter((v) => v.actif).length} actifs</span>}>
      <div className="overflow-x-auto px-5 pb-2">
        <table className="w-full min-w-[900px] text-left text-[14px]">
          <thead className="text-[12px] tracking-[0.06em] text-muted-foreground uppercase">
            <tr>
              <th className="py-2.5 pr-3 font-semibold">Nom</th><th className="pr-3 font-semibold">Rôle</th><th className="pr-3 font-semibold">Magasins</th>
              <th className="pr-3 text-right font-semibold">Affaires</th><th className="pr-3 text-right font-semibold">Tâches</th><th className="pr-3 font-semibold">État</th><th />
            </tr>
          </thead>
          <tbody className="divide-y border-t">
            {vues.map((u) => (
              <tr key={u.id} className={u.actif ? "" : "text-muted-foreground"}>
                <td className="py-2 pr-3">
                  <span className="font-semibold text-encre">{u.nom}</span>
                  <span className="block font-mono text-[12px] text-muted-foreground">{u.email}</span>
                </td>
                <td className="pr-3">
                  {ROLES[u.role] ?? u.role}{u.estAdmin && " · admin"}
                  {u.rubriques.length > 0 && <span className="block text-[12px] text-muted-foreground">{u.rubriques.join(", ")}</span>}
                  {u.referent && <span className="block text-[12px] text-muted-foreground">référent {u.referent}</span>}
                </td>
                <td className="pr-3 font-mono text-[13px]">{u.magasins.join(" · ")}</td>
                <td className="pr-3 text-right tabular-nums">{u.affaires}</td>
                <td className="pr-3 text-right tabular-nums">{u.taches}</td>
                <td className="pr-3"><Etat ton={u.actif ? "ok" : "neutre"}>{u.actif ? "Actif" : "Désactivé"}</Etat></td>
                <td className="text-right whitespace-nowrap">
                  {modifiable && u.id !== moi && (
                    <>
                      {u.actif && <ModifierUtilisateur u={u} magasins={magasins ?? []} moi={moi} />}
                      <ActiverUtilisateur u={u} repreneurs={repreneurs} />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-5 py-3 text-[13px] text-muted-foreground">
        Les comptes se créent avec la connexion Microsoft 365 (bloc B1) ; en démo, les personnages sont créés par le jeu de démo.
      </p>
    </Bloc>
  );
}

async function Parametres({ modifiable }: { modifiable: boolean }) {
  const db = await clientUtilisateur();
  const [{ data: parametres }, { data: profils }] = await Promise.all([
    db.from("parametre").select("cle, valeur"),
    db.from("profil").select("id, prenom, nom").eq("actif", true).order("prenom"),
  ]);
  const p = new Map((parametres ?? []).map((x) => [x.cle, x.valeur]));
  return (
    <div className="flex flex-col gap-4">
      <Bloc id="bloc-seuils" titre="Seuils des alertes et des règles">
        <div className="px-5 py-4"><FormSeuils seuils={(p.get("seuils") ?? {}) as Record<string, number>} modifiable={modifiable} /></div>
      </Bloc>
      <Bloc id="bloc-listes" titre="Listes de choix">
        <div className="grid gap-5 px-5 py-4 md:grid-cols-3">
          {LISTES.map(([cle]) => <FormListe key={cle} cle={cle} valeurs={(p.get(cle) ?? []) as string[]} modifiable={modifiable} />)}
        </div>
      </Bloc>
      <Bloc id="bloc-referents" titre="Gérants référents">
        <div className="px-5 py-4">
          <FormReferents modifiable={modifiable}
            referents={Object.fromEntries(Object.keys(REFERENTS).map((r) => [r, typeof p.get(r) === "string" ? (p.get(r) as string) : null]))}
            personnes={(profils ?? []).map((x) => ({ id: x.id, nom: `${x.prenom} ${x.nom}`.trim() }))} />
        </div>
      </Bloc>
    </div>
  );
}

async function Process() {
  const db = await clientUtilisateur();
  const { data: versions } = await db.from("process_version").select("id, nom, active, publiee_le, definition").order("created_at", { ascending: false });
  const active = (versions ?? []).find((v) => v.active);
  const def = active ? chargerProcess(active.definition) : null;
  return (
    <div className="flex flex-col gap-4">
      <Bloc id="bloc-versions" titre="Versions du modèle">
        <ul className="divide-y px-5">
          {(versions ?? []).map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2.5 text-[15px]">
              <span className="font-semibold text-encre">{v.nom}</span>
              {v.active && <Etat ton="ok">Active</Etat>}
              <span className="text-muted-foreground">{v.publiee_le ? `publiée le ${dateCourte(v.publiee_le, 0)}` : "brouillon"}</span>
            </li>
          ))}
        </ul>
        <p className="border-t px-5 py-3 text-[13px] text-muted-foreground">Lecture seule. L&apos;éditeur de process (EF-103 : duplication, édition par étape, publication) arrive avec le bloc B6 ; seules les nouvelles affaires prendront une nouvelle version.</p>
      </Bloc>
      {def?.phases.map((ph) => (
        <Bloc key={ph.code} id={`phase-${ph.code}`} titre={`${ph.numero} ${ph.nom}`}>
          <ul className="divide-y px-5">
            {ph.etapes.map((e) => (
              <li key={e.code} className="py-3">
                <p className="flex flex-wrap items-center gap-2">
                  <PastillePhase couleur={ph.couleur}>{e.code}</PastillePhase>
                  <span className="text-[15px] font-semibold text-encre">{e.titre}</span>
                  <span className="text-[13px] text-muted-foreground">· {LIBELLES_ROLES[e.responsable]}{e.branche ? ` · branche ${e.branche.replace("_", " ")}` : ""}{e.repetable ? " · répétable" : ""}</span>
                </p>
                <ul className="mt-1.5 ml-1 flex flex-col gap-0.5 text-[14px]">
                  {e.taches.map((t) => (
                    <li key={t.code}>
                      {t.titre}{t.optionnelle && <span className="text-muted-foreground"> (optionnelle)</span>}
                      <span className="text-muted-foreground"> — {LIBELLES_ROLES[t.assignee]}, {decrireEcheance(t.echeance)}</span>
                    </li>
                  ))}
                </ul>
                {e.documents.length > 0 && <p className="mt-1 text-[13px] text-muted-foreground">Documents : {e.documents.map((d) => d.libelle).join(" · ")}</p>}
                <p className="mt-1 text-[13px] text-muted-foreground">Issues : {e.issues.map((i) => i.libelle).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Bloc>
      ))}
    </div>
  );
}
