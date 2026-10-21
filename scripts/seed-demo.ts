/**
 * pnpm seed:demo — remet la base de démo dans l'état de départ du scénario (docs/conception.md, section 15.5).
 *
 *   1. vide les données métier (affaires, ventes, clients, tâches…) et le journal ;
 *   2. recrée le référentiel, les 11 personnages, le process 2026 v1 et les gérants référents ;
 *   3. remet l'horloge de démo à l'heure réelle ;
 *   4. charge le jeu de démo déterministe (src/lib/demo/generer.ts), daté par rapport à aujourd'hui.
 *
 * Sécurités : refuse de tourner si APP_MODE n'est pas « demo » ; ne supprime que les comptes du domaine
 * de démo ; travaille avec la clé secrète (contourne la RLS), jamais exposée au navigateur.
 * Ne jamais le lancer pendant une présentation (CLAUDE.md).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dateParis } from "../src/adapters/clock";
import type { Database } from "../src/lib/db/types";
import { genererJeuDemo } from "../src/lib/demo/generer";
import { DOMAINE_DEMO, MAGASINS, PERSONNAGES, SOCIETES, emailPersonnage } from "../src/lib/demo/personnages";
import { chargerProcess } from "../src/lib/process/valider";

// Les variables déjà présentes dans l'environnement priment (CI, base locale de test) :
// .env.local n'est lu que si aucune URL Supabase n'est fournie.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Pas de .env.local : les variables manquantes seront signalées plus bas.
  }
}

function exiger(nom: string): string {
  const v = process.env[nom]?.trim();
  if (!v) throw new Error(`Variable ${nom} manquante (voir .env.example).`);
  return v;
}

type Tables = Database["public"]["Tables"];
type NomTable = keyof Tables;

async function main() {
  const debut = Date.now();
  if (process.env.APP_MODE !== "demo") {
    throw new Error("seed:demo refuse de tourner hors mode démo (APP_MODE doit valoir « demo »).");
  }
  const url = exiger("NEXT_PUBLIC_SUPABASE_URL");
  const motDePasse = exiger("DEMO_PERSONA_PASSWORD");
  if (motDePasse.length < 16) throw new Error("DEMO_PERSONA_PASSWORD doit faire au moins 16 caractères.");
  const db = createClient<Database>(url, exiger("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  type Reponse = { data: unknown; error: { message: string } | null };
  /** Vérifie qu'une écriture a réussi. */
  const ok = (r: Reponse, etape: string): void => {
    if (r.error) throw new Error(`${etape} : ${r.error.message}`);
  };
  /** Vérifie une lecture et renvoie ses données. */
  const lire = <T>(r: Reponse, etape: string): T => {
    ok(r, etape);
    if (r.data === null || r.data === undefined) throw new Error(`${etape} : réponse vide`);
    return r.data as T;
  };
  const idDe = (index: Map<string, string>, code: string, quoi: string): string => {
    const id = index.get(code);
    if (!id) throw new Error(`${quoi} introuvable : ${code}`);
    return id;
  };
  /** Supprime toutes les lignes d'une table (le filtre est exigé par l'API). */
  const vider = async (table: NomTable) => ok(await db.from(table).delete().not("id", "is", null), `Vidage de ${table}`);
  /** Insère par lots de 500 lignes. */
  const inserer = async <N extends NomTable>(table: N, lignes: Tables[N]["Insert"][]) => {
    for (let i = 0; i < lignes.length; i += 500) {
      // Le typage générique de supabase-js ne suit pas une table passée en paramètre.
      // defaultToNull: false — une colonne absente d'une ligne du lot prend sa valeur par défaut, pas NULL.
      ok(await db.from(table).insert(lignes.slice(i, i + 500) as never, { defaultToNull: false }), `Insertion dans ${table}`);
    }
  };

  // 1. Données métier, de la plus dépendante à la moins dépendante, puis le journal.
  for (const table of [
    "tache", "document", "commande_fournisseur", "planning", "echeance", "rdv", "etape_instance", "mail_sortant",
    "affaire", "vente", "client",
  ] as const) {
    await vider(table);
  }

  // PCloud simulé : bucket créé s'il manque, fichiers des démonstrations précédentes effacés.
  const BUCKET = "pcloud-demo";
  if (!(await db.storage.getBucket(BUCKET)).data) ok(await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "4MB" }), "Bucket PCloud simulé");
  const fichiersPcloud = async (prefixe: string): Promise<string[]> => {
    const { data } = await db.storage.from(BUCKET).list(prefixe, { limit: 1000 });
    const sous = await Promise.all((data ?? []).map((o) => (o.id === null ? fichiersPcloud(prefixe ? `${prefixe}/${o.name}` : o.name) : [prefixe ? `${prefixe}/${o.name}` : o.name])));
    return sous.flat();
  };
  const anciens = await fichiersPcloud("");
  for (let i = 0; i < anciens.length; i += 500) ok(await db.storage.from(BUCKET).remove(anciens.slice(i, i + 500)), "Nettoyage du PCloud simulé");

  // 2a. Comptes de démo existants (les profils et rattachements suivent en cascade).
  let supprimes = 0;
  for (let page = 1; ; page++) {
    const { users } = lire<{ users: { id: string; email?: string }[] }>(await db.auth.admin.listUsers({ page, perPage: 200 }), "Liste des comptes");
    const demo = users.filter((u) => u.email?.endsWith(`@${DOMAINE_DEMO}`));
    for (const u of demo) {
      ok(await db.auth.admin.deleteUser(u.id), `Suppression de ${u.email}`);
      supprimes++;
    }
    if (users.length < 200) break;
  }
  await vider("journal");

  // 2b. Référentiel : sociétés et magasins (mis à jour s'ils existent).
  ok(await db.from("societe").upsert(SOCIETES.map((s) => ({ code: s.code, nom: s.nom })), { onConflict: "code" }), "Sociétés");
  const societes = lire<{ id: string; code: string }[]>(await db.from("societe").select("id, code"), "Lecture des sociétés");
  const idSociete = new Map(societes.map((s) => [s.code, s.id]));
  ok(
    await db.from("magasin").upsert(
      MAGASINS.map((m) => ({ code: m.code, nom: m.nom, societe_id: idDe(idSociete, m.societe, "Société") })),
      { onConflict: "code" },
    ),
    "Magasins",
  );
  const magasins = lire<{ id: string; code: string }[]>(await db.from("magasin").select("id, code"), "Lecture des magasins");
  const idMagasin = new Map(magasins.map((m) => [m.code, m.id]));

  // 2c. Comptes, profils et rattachements des personnages.
  const idProfil = new Map<string, string>();
  for (const p of PERSONNAGES) {
    const { user } = lire<{ user: { id: string } | null }>(
      await db.auth.admin.createUser({
        email: emailPersonnage(p),
        password: motDePasse,
        email_confirm: true,
        user_metadata: { prenom: p.prenom, personnage: p.cle },
      }),
      `Compte de ${p.prenom}`,
    );
    if (!user) throw new Error(`Compte de ${p.prenom} : non créé`);
    idProfil.set(p.cle, user.id);
    ok(
      await db.from("profil").insert({
        id: user.id, prenom: p.prenom, nom: p.nom, email: emailPersonnage(p), role: p.role,
        est_admin: p.estAdmin, rubriques: p.rubriques, initiales: p.initiales,
      }),
      `Profil de ${p.prenom}`,
    );
    ok(
      await db.from("profil_magasin").insert(p.magasins.map((code) => ({ profil_id: user.id, magasin_id: idDe(idMagasin, code, "Magasin") }))),
      `Magasins de ${p.prenom}`,
    );
  }

  // 2d. Process 2026 v1 (section 7), validé avant publication ; seule version active.
  const definition = chargerProcess(JSON.parse(readFileSync("process/2026-v1.json", "utf8")));
  ok(await db.from("process_version").update({ active: false }).neq("nom", definition.nom), "Désactivation des autres versions");
  ok(
    await db.from("process_version").upsert(
      { nom: definition.nom, definition, active: true, publiee_le: new Date().toISOString(), publiee_par: idProfil.get("jean") },
      { onConflict: "nom" },
    ),
    "Process 2026 v1",
  );
  const [{ id: processVersionId }] = lire<{ id: string }[]>(
    await db.from("process_version").select("id").eq("nom", definition.nom),
    "Lecture du process",
  );

  // 2e. Gérants référents ; 3. horloge remise à l'heure réelle.
  for (const p of PERSONNAGES.filter((x) => x.referent)) {
    ok(await db.from("parametre").update({ valeur: idProfil.get(p.cle) }).eq("cle", p.referent!), `Référent ${p.referent}`);
  }
  ok(await db.from("parametre").update({ valeur: null }).eq("cle", "horloge_demo"), "Horloge de démo");

  // 4. Jeu de démo, daté par rapport à aujourd'hui (Europe/Paris).
  const aujourdhui = dateParis(new Date());
  const jeu = genererJeuDemo({
    aujourdhui,
    definition,
    processVersionId,
    profils: Object.fromEntries(idProfil),
    magasins: {
      AIX: idDe(idMagasin, "AIX", "Magasin"),
      VAL: idDe(idMagasin, "VAL", "Magasin"),
      CIO: idDe(idMagasin, "CIO", "Magasin"),
    },
  });
  await inserer("client", jeu.clients);
  await inserer("vente", jeu.ventes);
  await inserer("affaire", jeu.affaires);
  await inserer("echeance", jeu.echeances);
  await inserer("planning", jeu.plannings);
  await inserer("rdv", jeu.rdv);
  await inserer("etape_instance", jeu.etapes);
  await inserer("tache", jeu.taches);
  await inserer("commande_fournisseur", jeu.commandes);

  const actives = jeu.affaires.filter((x) => x.statut === "active" || x.statut === "gagnee").length;
  console.log(
    `Seed de démo terminé en ${Math.round((Date.now() - debut) / 1000)} s (jour de référence : ${aujourdhui}).\n` +
      `  ${supprimes} ancien(s) compte(s) remplacé(s) ; ${PERSONNAGES.length} personnages ; process « ${definition.nom} » actif.\n` +
      `  ${jeu.clients.length} clients, ${jeu.affaires.length} affaires dont ${actives} actives, ${jeu.ventes.length} ventes, ` +
      `${jeu.rdv.length} RDV, ${jeu.taches.length} tâches, ${jeu.commandes.length} commandes.`,
  );
}

main().catch((e) => {
  console.error(`Échec du seed de démo : ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
