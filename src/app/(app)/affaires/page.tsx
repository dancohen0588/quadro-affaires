import type { Metadata } from "next";
import Link from "next/link";
import { adaptateurs } from "@/adapters";
import { Etat, PastillePhase } from "@/components/affaire/pastille-phase";
import { NouveauContact } from "@/components/clients/nouveau-contact";
import { badgeEcheance } from "@/lib/affaire/journee";
import { depuis, instantParis, jourDe } from "@/lib/format";
import { NAVIGATION } from "@/lib/navigation";
import { ajouterJours, joursEntre } from "@/lib/rules/calendrier";
import { nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { chargerReferentiel } from "@/server/referentiel";

const entree = NAVIGATION.find((e) => e.href === "/affaires")!;
export const metadata: Metadata = { title: entree.libelle };

type Definition = { phases: { code: string; numero: string; nom: string; couleur: string; etapes: { code: string; titre: string }[] }[] };
const STATUTS = [["en_cours", "En cours"], ["perdue", "Perdues"], ["abandonnee", "Abandonnées"], ["cloturee", "Clôturées"], ["toutes", "Toutes"]] as const;
const LIBELLES_STATUT: Record<string, string> = { perdue: "Perdue", abandonnee: "Abandonnée", cloturee: "Clôturée" };
const champ = "h-9 rounded-lg border border-input bg-card px-2.5 text-[14px]";

const texte = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 80) : "");
const motifRecherche = (q: string) => `%${q.replace(/[%_,()*]/g, " ")}%`;

/**
 * Mes affaires (EF-24) : filtres phase, étape, statut, inactivité, concepteur et magasin (gérants), tri par
 * prochaine échéance. Sert aussi la recherche globale de la barre du haut : clients (nom, téléphone,
 * référence Gesteos), affaires et contremarques.
 */
export default async function Page({ searchParams }: PageProps<"/affaires">) {
  const moi = await exigerProfil();
  const sp = await searchParams;
  const gerant = moi.role === "gerant";
  const q = texte(sp.q);
  const statut = STATUTS.some(([v]) => v === sp.statut) ? (sp.statut as string) : "en_cours";
  const phase = texte(sp.phase);
  const etape = texte(sp.etape);
  const inactives = sp.inactives === "1";
  const portee = gerant || q ? "toutes" : sp.portee === "magasin" ? "magasin" : "miennes";
  const concepteurFiltre = gerant ? texte(sp.concepteur) : "";
  const magasinFiltre = gerant ? texte(sp.magasin) : "";

  const db = await clientUtilisateur();
  const [aujourdhui, referentiel, { data: version }] = await Promise.all([
    adaptateurs().clock.today(),
    chargerReferentiel(moi),
    db.from("process_version").select("id, definition").eq("active", true).maybeSingle(),
  ]);
  const actif = version?.definition as unknown as Definition | undefined;
  const seuilInactivite = referentiel.seuils.inactivite_jours;

  let requete = db
    .from("affaire")
    .select("id, libelle, contremarque, etape_courante_code, statut, motif_perte, derniere_activite_at, process_version_id, magasin:magasin!inner(code, nom), concepteur:profil!affaire_concepteur_id_fkey(id, prenom)")
    .order("derniere_activite_at", { ascending: false })
    .limit(300);
  requete = statut === "en_cours" ? requete.in("statut", ["active", "gagnee"]) : statut === "toutes" ? requete : requete.eq("statut", statut);
  if (portee === "miennes") requete = requete.eq("concepteur_id", moi.id);
  if (concepteurFiltre) requete = requete.eq("concepteur_id", concepteurFiltre);
  if (magasinFiltre) requete = requete.eq("magasin.code", magasinFiltre);
  if (etape) requete = requete.eq("etape_courante_code", etape);
  else if (phase && actif) requete = requete.in("etape_courante_code", actif.phases.find((p) => p.code === phase)?.etapes.map((e) => e.code) ?? []);
  if (inactives) requete = requete.lt("derniere_activite_at", instantParis(ajouterJours(aujourdhui, -seuilInactivite), "00:00"));
  if (q) requete = requete.or(`libelle.ilike.${motifRecherche(q)},contremarque.ilike.${motifRecherche(q)}`);

  const [{ data, error }, { data: taches }, clients] = await Promise.all([
    requete,
    db.from("tache").select("affaire_id, echeance").eq("statut", "a_faire").not("affaire_id", "is", null).not("echeance", "is", null).limit(5000),
    q
      ? db.from("client").select("id, type, nom, prenom, raison_sociale, ville, telephone")
          .or(["nom", "raison_sociale", "telephone", "gesteos_ref"].map((c) => `${c}.ilike.${motifRecherche(q)}`).join(","))
          .order("nom")
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(`Lecture des affaires : ${error.message}`);

  // Prochaine échéance de chaque affaire : la plus proche de ses tâches à faire.
  const prochaine = new Map<string, string>();
  for (const t of taches ?? []) {
    const d = prochaine.get(t.affaire_id!);
    if (!d || t.echeance! < d) prochaine.set(t.affaire_id!, t.echeance!);
  }
  type Ligne = {
    id: string; libelle: string; contremarque: string; etape_courante_code: string | null; statut: string; motif_perte: string | null;
    derniere_activite_at: string; process_version_id: string; magasin: { code: string; nom: string }; concepteur: { id: string; prenom: string };
  };
  const lignes = ((data ?? []) as unknown as Ligne[]).sort((a, b) => {
    const x = prochaine.get(a.id) ?? "9999", y = prochaine.get(b.id) ?? "9999";
    return x.localeCompare(y) || b.derniere_activite_at.localeCompare(a.derniere_activite_at);
  });

  const autres = [...new Set(lignes.map((l) => l.process_version_id))].filter((v) => v !== version?.id);
  const { data: defs } = autres.length ? await db.from("process_version").select("id, definition").in("id", autres) : { data: [] };
  const definitions = new Map<string, Definition>((defs ?? []).map((d) => [d.id, d.definition as unknown as Definition] as const));
  if (version && actif) definitions.set(version.id, actif);
  const etapeDe = (l: Ligne) => {
    for (const p of definitions.get(l.process_version_id)?.phases ?? []) {
      const e = p.etapes.find((x) => x.code === l.etape_courante_code);
      if (e) return { phase: p, titre: e.titre };
    }
    return null;
  };

  const titre = q ? `Recherche « ${q} »` : portee === "miennes" ? entree.libelle : gerant ? "Affaires" : "Affaires du magasin";
  const colonneConcepteur = portee !== "miennes";
  const etapesListe = (actif?.phases ?? []).filter((p) => !phase || p.code === phase).flatMap((p) => p.etapes.map((e) => ({ ...e, numero: p.numero })));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-encre">{titre}</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {lignes.length} affaire{lignes.length > 1 ? "s" : ""}, triées par prochaine échéance.
          </p>
        </div>
        {moi.role !== "transverse" && (
          <NouveauContact referentiel={referentiel} moi={{ id: moi.id, estGerant: gerant }} aujourdhui={aujourdhui} />
        )}
      </div>

      {(clients.data ?? []).length > 0 && (
        <section aria-label="Clients trouvés" className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <h2 className="mb-1.5 text-[15px] text-encre">Clients</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-[15px]">
            {(clients.data ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="font-semibold text-teal-700 underline-offset-2 hover:underline">{nomClient(c as ClientIdentite)}</Link>
                <span className="text-muted-foreground"> · {[c.ville, c.telephone].filter(Boolean).join(" · ") || "CNQ"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10" aria-label="Filtres">
        {q && <input type="hidden" name="q" value={q} />}
        {!gerant && !q && (
          <select name="portee" defaultValue={portee} className={champ} aria-label="Portée">
            <option value="miennes">Mes affaires</option>
            <option value="magasin">Tout le magasin</option>
          </select>
        )}
        <select name="statut" defaultValue={statut} className={champ} aria-label="Statut">
          {STATUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="phase" defaultValue={phase} className={champ} aria-label="Phase">
          <option value="">Toutes les phases</option>
          {(actif?.phases ?? []).map((p) => <option key={p.code} value={p.code}>{p.numero} {p.nom}</option>)}
        </select>
        <select name="etape" defaultValue={etape} className={`${champ} max-w-56`} aria-label="Étape">
          <option value="">Toutes les étapes</option>
          {etapesListe.map((e) => <option key={e.code} value={e.code}>{e.numero} · {e.titre}</option>)}
        </select>
        {gerant && (
          <>
            <select name="concepteur" defaultValue={concepteurFiltre} className={champ} aria-label="Concepteur">
              <option value="">Tous les concepteurs</option>
              {referentiel.concepteurs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select name="magasin" defaultValue={magasinFiltre} className={champ} aria-label="Magasin">
              <option value="">Tous les magasins</option>
              {referentiel.magasins.map((m) => <option key={m.code} value={m.code}>{m.nom}</option>)}
            </select>
          </>
        )}
        <label className="flex items-center gap-2 px-1 text-[14px]">
          <input type="checkbox" name="inactives" value="1" defaultChecked={inactives} className="size-4 accent-teal-700" />
          Sans mouvement &gt; {seuilInactivite} j
        </label>
        <button type="submit" className="h-9 rounded-lg bg-teal-900 px-3 text-[14px] font-semibold text-white">Filtrer</button>
        <Link href="/affaires" className="px-1 text-[14px] text-teal-700 underline-offset-2 hover:underline">Réinitialiser</Link>
      </form>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full table-fixed text-left text-[14px]">
          <thead className="border-b text-[13px] text-muted-foreground">
            <tr>
              <th className="w-[36%] px-3 py-2.5 font-semibold">Affaire</th>
              <th className="w-[25%] px-3 py-2.5 font-semibold">Étape</th>
              <th className="w-[14%] px-3 py-2.5 font-semibold">Prochaine échéance</th>
              {colonneConcepteur && <th className="px-3 py-2.5 font-semibold">Concepteur</th>}
              <th className="w-[12%] px-3 py-2.5 font-semibold">Mouvement</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignes.map((l) => {
              const e = etapeDe(l);
              const echeance = prochaine.get(l.id) ?? null;
              const badge = echeance ? badgeEcheance({ echeance, statut: "a_faire" }, aujourdhui) : null;
              const enCours = l.statut === "active" || l.statut === "gagnee";
              const inactive = enCours && joursEntre(jourDe(l.derniere_activite_at), aujourdhui) > seuilInactivite;
              return (
                <tr key={l.id} className="hover:bg-fond">
                  <td className="truncate px-3 py-1.5">
                    <Link href={`/affaires/${l.id}`} className="font-semibold text-encre underline-offset-2 hover:underline" title={`${l.libelle} — ${l.contremarque}`}>
                      {l.libelle}
                    </Link>
                  </td>
                  <td className="truncate px-3 py-1.5">
                    {enCours ? (
                      e ? <PastillePhase couleur={e.phase.couleur} className="max-w-full truncate">{e.phase.numero} · {e.titre}</PastillePhase> : "—"
                    ) : (
                      <Etat ton={l.statut === "cloturee" ? "ok" : "neutre"}>{LIBELLES_STATUT[l.statut] ?? l.statut}{l.motif_perte ? ` · ${l.motif_perte}` : ""}</Etat>
                    )}
                  </td>
                  <td className="px-3 py-1.5">{badge ? <Etat ton={badge.ton}>{badge.texte}</Etat> : <span className="text-muted-foreground">—</span>}</td>
                  {colonneConcepteur && (
                    <td className="truncate px-3 py-1.5">{l.concepteur.prenom}{gerant && <span className="text-muted-foreground"> · {l.magasin.nom.replace("Marseille ", "")}</span>}</td>
                  )}
                  <td className={`truncate px-3 py-1.5 ${inactive ? "font-semibold text-etat-retard" : "text-muted-foreground"}`}>{depuis(l.derniere_activite_at, aujourdhui)}</td>
                </tr>
              );
            })}
            {lignes.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune affaire ne correspond.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
