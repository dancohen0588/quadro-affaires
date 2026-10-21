/**
 * pnpm seed:demo — remet la base de démo dans l'état de départ (docs/conception.md, section 15.5).
 *
 * Session 1.2 : référentiel (sociétés, magasins), comptes des 11 personnages, profils, rattachements,
 * gérants référents, horloge remise à l'heure réelle. Les affaires fictives arrivent en session 1.4.
 *
 * Sécurités : refuse de tourner si APP_MODE n'est pas « demo » ; ne supprime que les comptes du domaine
 * de démo ; travaille avec la clé secrète (contourne la RLS), jamais exposée au navigateur.
 */
import { createClient } from "@supabase/supabase-js";
import {
  DOMAINE_DEMO,
  MAGASINS,
  PERSONNAGES,
  SOCIETES,
  emailPersonnage,
} from "../src/lib/demo/personnages";

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

async function main() {
  if (process.env.APP_MODE !== "demo") {
    throw new Error("seed:demo refuse de tourner hors mode démo (APP_MODE doit valoir « demo »).");
  }
  const url = exiger("NEXT_PUBLIC_SUPABASE_URL");
  const motDePasse = exiger("DEMO_PERSONA_PASSWORD");
  if (motDePasse.length < 16) throw new Error("DEMO_PERSONA_PASSWORD doit faire au moins 16 caractères.");
  const db = createClient(url, exiger("SUPABASE_SECRET_KEY"), {
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

  // 1. Supprimer les comptes de démo existants (les profils et rattachements suivent en cascade).
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

  // 2. Référentiel : sociétés et magasins (mis à jour s'ils existent).
  ok(
    await db.from("societe").upsert(SOCIETES.map((s) => ({ code: s.code, nom: s.nom })), { onConflict: "code" }),
    "Sociétés",
  );
  const societes = lire<{ id: string; code: string }[]>(await db.from("societe").select("id, code"), "Lecture des sociétés");
  const idSociete = new Map(societes.map((s) => [s.code, s.id]));
  ok(
    await db.from("magasin").upsert(
      MAGASINS.map((m) => ({ code: m.code, nom: m.nom, societe_id: idSociete.get(m.societe) })),
      { onConflict: "code" },
    ),
    "Magasins",
  );
  const magasins = lire<{ id: string; code: string }[]>(await db.from("magasin").select("id, code"), "Lecture des magasins");
  const idMagasin = new Map(magasins.map((m) => [m.code, m.id]));

  // 3. Comptes, profils et rattachements des personnages.
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
        id: user.id,
        prenom: p.prenom,
        nom: p.nom,
        email: emailPersonnage(p),
        role: p.role,
        est_admin: p.estAdmin,
        rubriques: p.rubriques,
        initiales: p.initiales,
      }),
      `Profil de ${p.prenom}`,
    );
    ok(
      await db.from("profil_magasin").insert(p.magasins.map((code) => ({ profil_id: user.id, magasin_id: idMagasin.get(code) }))),
      `Magasins de ${p.prenom}`,
    );
  }

  // 4. Gérants référents et horloge remise à l'heure réelle.
  for (const p of PERSONNAGES.filter((x) => x.referent)) {
    ok(
      await db.from("parametre").update({ valeur: idProfil.get(p.cle) }).eq("cle", p.referent!),
      `Référent ${p.referent}`,
    );
  }
  ok(await db.from("parametre").update({ valeur: null }).eq("cle", "horloge_demo"), "Horloge de démo");

  console.log(
    `Seed de démo terminé : ${supprimes} ancien(s) compte(s) supprimé(s), ${SOCIETES.length} sociétés, ` +
      `${MAGASINS.length} magasins, ${PERSONNAGES.length} personnages.`,
  );
}

main().catch((e) => {
  console.error(`Échec du seed de démo : ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
