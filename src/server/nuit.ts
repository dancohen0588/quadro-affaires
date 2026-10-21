import "server-only";
import { adaptateurs } from "@/adapters";
import { instantParis, jourDe } from "@/lib/format";
import { REGLES_REGLEMENT } from "@/lib/indicateurs/agregats";
import { digestUtile, mailDigestLundi, mailDigestQuotidien, type AlerteDigest, type TacheDigest } from "@/lib/mails/digests";
import { nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import { destinatairesAlerte, rappelsNotes, tachesDAlertes, type Referents } from "@/lib/rules/alertes";
import { ajouterJours, estJourOuvre, jourDeSemaine, semaineIso, type DateIso } from "@/lib/rules/calendrier";
import { clientAdmin } from "@/lib/supabase/server";
import { chargerAlertes, chargerPointDuMardi } from "./indicateurs";

/**
 * Traitements de nuit (section 11, session 4.2) pour un jour donné, à l'heure de la nuit (6 h 30) :
 *   1. tâches d'alerte (RG-20, RG-22, RG-23) et rappels de notes (RG-32) ;
 *   2. digest quotidien, les jours ouvrés, pour chaque personne qui a des tâches ou des alertes ;
 *   3. digest du lundi pour les gérants.
 * Les alertes viennent de la vue `alertes`, calculée à la date de l'horloge (app_today). Idempotent : chaque
 * tâche et chaque mail porte une clé unique ; rejouer un jour ne crée rien de plus. Appelé par le cron en
 * production et par l'horloge de démo pour chaque jour franchi. Une erreur d'envoi n'arrête pas le reste.
 */

export type BilanNuit = { jour: DateIso; taches: number; digestsQuotidiens: number; digestsLundi: number; erreurs: string[] };

function lire<T>(r: { data: T | null; error: { message: string } | null }, quoi: string): T {
  if (r.error) throw new Error(`Traitements de nuit, ${quoi} : ${r.error.message}`);
  return r.data as T;
}

export async function traitementsDeNuit(jour: DateIso, base: string): Promise<BilanNuit> {
  const db = clientAdmin();
  const bilan: BilanNuit = { jour, taches: 0, digestsQuotidiens: 0, digestsLundi: 0, erreurs: [] };

  const [alertes, parametres, profils, rdv] = await Promise.all([
    chargerAlertes(db),
    db.from("parametre").select("cle, valeur").in("cle", ["gerant_bpa", "gerant_logistique", "gerant_finance"]),
    db.from("profil").select("id, prenom, email, role").eq("actif", true),
    db.from("rdv").select("id, type, debut, profil_id, affaire_id, client_id, notes").eq("statut", "fait")
      .gte("debut", instantParis(ajouterJours(jour, -7), "00:00")).lt("debut", instantParis(jour, "00:00")),
  ]);
  const p = new Map(lire(parametres, "paramètres").map((x) => [x.cle, typeof x.valeur === "string" ? x.valeur : null]));
  const lesProfils = lire(profils, "profils");
  const referents: Referents = {
    gerants: lesProfils.filter((x) => x.role === "gerant").map((x) => x.id),
    gerantBpa: p.get("gerant_bpa") ?? null, gerantLogistique: p.get("gerant_logistique") ?? null, gerantFinance: p.get("gerant_finance") ?? null,
  };

  // ── 1. Tâches ────────────────────────────────────────────────────────────────────────────────
  const sansNotes = lire(rdv, "RDV").filter((r) => !r.notes?.trim())
    .map((r) => ({ id: r.id, type: r.type, jour: jourDe(r.debut), profil_id: r.profil_id, affaire_id: r.affaire_id, client_id: r.client_id }));
  const nouvelles = [...tachesDAlertes(alertes, jour), ...rappelsNotes(sansNotes, jour)];
  if (nouvelles.length) {
    const { data, error } = await db.from("tache")
      .upsert(nouvelles.map((t) => ({ ...t, client_id: t.client_id ?? null })), { onConflict: "cle", ignoreDuplicates: true, defaultToNull: false })
      .select("id");
    if (error) bilan.erreurs.push(`Tâches : ${error.message}`);
    else bilan.taches = data?.length ?? 0;
  }

  // Libellés des affaires en alerte, pour les digests.
  const ids = [...new Set(alertes.map((a) => a.affaire_id))];
  const { data: affaires } = ids.length ? await db.from("affaire").select("id, libelle").in("id", ids) : { data: [] };
  const libelle = new Map((affaires ?? []).map((a) => [a.id, a.libelle]));
  const versDigest = (a: (typeof alertes)[number]): AlerteDigest => ({ libelle: libelle.get(a.affaire_id) ?? "Affaire", detail: a.detail, gravite: a.gravite });

  const { data: dejaEnvoyes } = await db.from("mail_sortant").select("cle").like("cle", `%:${jour}:%`);
  const deja = new Set((dejaEnvoyes ?? []).map((m) => m.cle));
  const envoyer = async (cle: string, destinataire: { id: string; email: string }, type: "digest_quotidien" | "digest_lundi", mail: { objet: string; html: string }) => {
    if (deja.has(cle)) return false;
    try {
      await adaptateurs().mailer.envoyer({ destinataireId: destinataire.id, destinataireEmail: destinataire.email, type, objet: mail.objet, html: mail.html, cle });
      return true;
    } catch (e) {
      bilan.erreurs.push(`${cle} : ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  // ── 2. Digest quotidien (jours ouvrés) ──────────────────────────────────────────────────────
  if (estJourOuvre(jour)) {
    const taches = lire(await db.from("tache")
      .select("assignee_id, titre, echeance, origine, affaire:affaire(libelle), client:client(type, nom, prenom, raison_sociale)")
      .eq("statut", "a_faire").eq("optionnelle", false).not("echeance", "is", null).lte("echeance", jour).limit(5000), "tâches");
    type TacheLue = { assignee_id: string; titre: string; echeance: string; origine: string; affaire: { libelle: string } | null; client: ClientIdentite | null };
    const lues = taches as unknown as TacheLue[];
    const vue = (t: TacheLue): TacheDigest => ({
      titre: t.titre, echeance: t.echeance, contexte: t.affaire?.libelle ?? (t.client ? nomClient(t.client) : null),
    });
    for (const qui of lesProfils) {
      const siennes = lues.filter((t) => t.assignee_id === qui.id);
      const concernees = alertes.filter((a) => destinatairesAlerte(a, referents).includes(qui.id));
      const d = {
        aFaire: siennes.filter((t) => t.origine !== "relance" && t.echeance === jour).map(vue),
        enRetard: siennes.filter((t) => t.origine !== "relance" && t.echeance < jour).map(vue),
        relances: siennes.filter((t) => t.origine === "relance").map(vue),
        reglements: concernees.filter((a) => (REGLES_REGLEMENT as readonly string[]).includes(a.regle)).map(versDigest),
        alertes: concernees.filter((a) => !(REGLES_REGLEMENT as readonly string[]).includes(a.regle)).map(versDigest),
      };
      if (!digestUtile({ ...d, alertes: [...d.alertes, ...d.reglements] })) continue;
      const mail = mailDigestQuotidien({ prenom: qui.prenom, jour, lien: `${base}/ma-journee`, ...d });
      if (await envoyer(`digest_quotidien:${jour}:${qui.id}`, qui, "digest_quotidien", mail)) bilan.digestsQuotidiens++;
    }
  }

  // ── 3. Digest du lundi (gérants) ─────────────────────────────────────────────────────────────
  if (jourDeSemaine(jour) === 1) {
    const point = await chargerPointDuMardi(db);
    const magasins = point.colonnes.map((c) => ({
      nom: c.magasin.nom,
      potentielCts: c.potentiel.cts, nbPotentiel: c.potentiel.affaires,
      r3: c.aVenir.r3.length, livraisons: c.aVenir.livraisons.length, poses: c.aVenir.poses.length,
      reglementsCts: c.aVenir.reglementsCts, nbReglements: c.aVenir.nbReglements,
      alertes: c.alertes.map((a) => ({ libelle: a.libelle, detail: a.detail, gravite: a.gravite })),
    }));
    for (const qui of lesProfils.filter((x) => x.role === "gerant")) {
      const mail = mailDigestLundi({ prenom: qui.prenom, semaine: semaineIso(jour).slice(5), magasins, lien: `${base}/point-du-mardi` });
      if (await envoyer(`digest_lundi:${jour}:${qui.id}`, qui, "digest_lundi", mail)) bilan.digestsLundi++;
    }
  }
  return bilan;
}
