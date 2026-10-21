"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { COLONNES, colonnesManquantes, affaireExistante, cleClient, planifierLigne, type ContexteImport, type PlanImport } from "@/lib/import/affaires";
import { lireCsv } from "@/lib/import/csv";
import type { Role } from "@/lib/process/schema";
import type { LigneStandard } from "@/lib/rules/echeancier";
import { LISTES, lireListe, seuilsSchema, type CleListe } from "@/lib/rules/parametres";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerGerant } from "@/server/garde";
import { moteurActif } from "@/server/process";

type Resultat = { ok: true; message?: string } | { ok: false; message: string };
const MESSAGES_SQL = ["42501", "22023", "P0002", "23505"];
const message = (e: { code?: string; message: string } | null, defaut: string) => (e && MESSAGES_SQL.includes(e.code ?? "") ? e.message : defaut);

async function exigerAdmin() {
  const moi = await exigerGerant();
  if (!moi.estAdmin) throw new Error("Réservé aux administrateurs.");
  return moi;
}

// ── Import de reprise (section 13.1) ────────────────────────────────────────────────────────────

export type RapportImport = {
  essai: boolean;
  total: number;
  acceptees: { numero: number; libelle: string; etape: string }[];
  rejets: { numero: number; motifs: string[] }[];
};

/**
 * Import CSV des affaires actives : chaque ligne est validée et positionnée par le moteur ; en mode essai,
 * rien n'est écrit. Sinon chaque ligne valide est écrite tout ou rien (public.importer_affaire) ; une ligne
 * refusée par la base rejoint le rapport des rejets avec son motif.
 */
export async function importerAffaires(donnees: FormData): Promise<{ ok: true; rapport: RapportImport } | { ok: false; message: string }> {
  await exigerGerant();
  const fichier = donnees.get("fichier");
  const essai = donnees.get("essai") === "1";
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Choisissez un fichier CSV." };
  if (fichier.size > 2 * 1024 * 1024) return { ok: false, message: "Fichier trop lourd (2 Mo au plus)." };
  const csv = lireCsv(await fichier.text());
  const manquantes = colonnesManquantes(csv.entetes);
  if (manquantes.length) return { ok: false, message: `Colonnes manquantes : ${manquantes.join(", ")}. Attendu : ${COLONNES.join(";")}.` };
  if (!csv.lignes.length) return { ok: false, message: "Le fichier ne contient aucune ligne." };
  if (csv.lignes.length > 2000) return { ok: false, message: "2 000 lignes au plus par import." };

  const db = await clientUtilisateur();
  const [aujourdhui, { moteur, versionId }, magasins, profils, parametres, affaires, clients] = await Promise.all([
    adaptateurs().clock.today(),
    moteurActif(db),
    db.from("magasin").select("id, code"),
    db.from("profil").select("id, prenom, email, role, actif, profil_magasin!profil_magasin_profil_id_fkey(magasin(code))").eq("actif", true),
    db.from("parametre").select("cle, valeur").in("cle", ["types_projet", "echeancier_standard", "gerant_bpa", "gerant_logistique", "gerant_finance", "responsable_r4"]),
    db.from("affaire").select("magasin_id, contremarque, projet").limit(20000),
    db.from("client").select("id, magasin_id, nom, telephone").not("telephone", "is", null).limit(20000),
  ]);
  const p = new Map((parametres.data ?? []).map((x) => [x.cle, x.valeur]));
  type ProfilLu = { id: string; prenom: string; email: string; role: string; profil_magasin: { magasin: { code: string } | null }[] };
  const ctx: ContexteImport = {
    aujourdhui, moteur, processVersionId: versionId,
    magasins: Object.fromEntries((magasins.data ?? []).map((m) => [m.code, m])),
    concepteurs: Object.fromEntries(((profils.data ?? []) as unknown as ProfilLu[])
      .filter((x) => x.role === "gerant" || x.role === "conceptrice")
      .map((x) => [x.email.toLowerCase(), { id: x.id, prenom: x.prenom, role: x.role, magasins: x.profil_magasin.map((r) => r.magasin?.code ?? "").filter(Boolean) }])),
    referents: Object.fromEntries((["gerant_bpa", "gerant_logistique", "gerant_finance", "responsable_r4"] as const)
      .map((r) => [r, typeof p.get(r) === "string" ? (p.get(r) as string) : undefined])) as Partial<Record<Exclude<Role, "concepteur">, string>>,
    projets: (p.get("types_projet") ?? []) as string[],
    standard: (p.get("echeancier_standard") ?? undefined) as LigneStandard[] | undefined,
    affairesExistantes: new Set((affaires.data ?? []).map((a) => affaireExistante(a.magasin_id, a.contremarque, a.projet))),
    clientsExistants: new Map((clients.data ?? []).map((c) => [cleClient(c.magasin_id, c.nom, c.telephone!), c.id])),
    uuid: randomUUID,
  };

  const rapport: RapportImport = { essai, total: csv.lignes.length, acceptees: [], rejets: [] };
  for (const l of csv.lignes) {
    const r = planifierLigne(l.numero, l.valeurs, ctx);
    if (!r.ok) { rapport.rejets.push({ numero: r.numero, motifs: r.motifs }); continue; }
    if (!essai) {
      const { client, vente, echeances, planning, affaire, rdv, etapes, taches }: PlanImport = r.plan;
      const { error } = await db.rpc("importer_affaire", { p: { client, vente, echeances, planning, affaire, rdv, etapes, taches } as never });
      if (error) { rapport.rejets.push({ numero: l.numero, motifs: [message(error, "Écriture refusée par la base.")] }); continue; }
    }
    rapport.acceptees.push({ numero: l.numero, libelle: r.plan.libelle, etape: r.plan.etape });
  }
  if (!essai && rapport.acceptees.length) {
    revalidatePath("/", "layout");
  }
  return { ok: true, rapport };
}

// ── Utilisateurs (EF-100) ───────────────────────────────────────────────────────────────────────

const entreeProfil = z.object({
  id: z.uuid(),
  role: z.enum(["gerant", "conceptrice", "transverse"]),
  magasins: z.array(z.string()).min(1, "Rattachez l'utilisateur à au moins un magasin."),
  rubriques: z.array(z.enum(["r4_avis", "dossiers_pose"])),
});

export async function modifierProfil(brut: z.input<typeof entreeProfil>): Promise<Resultat> {
  await exigerAdmin();
  const lu = entreeProfil.safeParse(brut);
  if (!lu.success) return { ok: false, message: lu.error.issues[0]?.message ?? "Valeurs invalides." };
  const db = await clientUtilisateur();
  const { data: magasins } = await db.from("magasin").select("id, code").in("code", lu.data.magasins);
  const { error } = await db.rpc("modifier_profil", {
    p_profil: lu.data.id, p_role: lu.data.role, p_magasins: (magasins ?? []).map((m) => m.id), p_rubriques: lu.data.rubriques,
  });
  if (error) return { ok: false, message: message(error, "L'utilisateur n'a pas pu être modifié.") };
  revalidatePath("/admin");
  return { ok: true };
}

export async function desactiverProfil(id: string, repreneur: string | null): Promise<Resultat> {
  await exigerAdmin();
  if (!z.uuid().safeParse(id).success || (repreneur !== null && !z.uuid().safeParse(repreneur).success)) return { ok: false, message: "Choix invalide." };
  const db = await clientUtilisateur();
  const { data, error } = await db.rpc("desactiver_profil", { p_profil: id, p_repreneur: repreneur as string });
  if (error) return { ok: false, message: message(error, "L'utilisateur n'a pas pu être désactivé.") };
  const n = data as { affaires: number; taches: number };
  revalidatePath("/", "layout");
  return { ok: true, message: `Désactivé. ${n.affaires} affaire(s) et ${n.taches} tâche(s) réassignée(s).` };
}

export async function reactiverProfil(id: string): Promise<Resultat> {
  await exigerAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Choix invalide." };
  const db = await clientUtilisateur();
  const { error } = await db.from("profil").update({ actif: true }).eq("id", id);
  if (error) return { ok: false, message: "L'utilisateur n'a pas pu être réactivé." };
  revalidatePath("/admin");
  return { ok: true };
}

// ── Paramètres (EF-102) ─────────────────────────────────────────────────────────────────────────

export async function enregistrerSeuils(brut: Record<string, number>): Promise<Resultat> {
  await exigerAdmin();
  const lu = seuilsSchema.safeParse(brut);
  if (!lu.success) return { ok: false, message: lu.error.issues[0]?.message ?? "Seuils invalides." };
  const db = await clientUtilisateur();
  const { data: actuel } = await db.from("parametre").select("valeur").eq("cle", "seuils").maybeSingle();
  // Les clés inconnues de l'écran (ajoutées plus tard) sont gardées.
  const { error } = await db.from("parametre").update({ valeur: { ...((actuel?.valeur ?? {}) as object), ...lu.data } }).eq("cle", "seuils");
  if (error) return { ok: false, message: "Les seuils n'ont pas pu être enregistrés." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Seuils enregistrés : les alertes et indicateurs les appliquent tout de suite." };
}

export async function enregistrerListe(cle: CleListe, texte: string): Promise<Resultat> {
  await exigerAdmin();
  const def = LISTES.find(([c]) => c === cle);
  if (!def) return { ok: false, message: "Liste inconnue." };
  const lu = lireListe(texte, def[1]);
  if (!lu.ok) return lu;
  const db = await clientUtilisateur();
  const { error } = await db.from("parametre").update({ valeur: lu.valeurs }).eq("cle", cle);
  if (error) return { ok: false, message: "La liste n'a pas pu être enregistrée." };
  revalidatePath("/admin");
  return { ok: true, message: `${def[1]} : ${lu.valeurs.length} valeur(s) enregistrée(s).` };
}

const REFERENTS = ["gerant_bpa", "gerant_logistique", "gerant_finance", "responsable_r4"] as const;
export async function enregistrerReferents(brut: Record<string, string>): Promise<Resultat> {
  await exigerAdmin();
  const db = await clientUtilisateur();
  for (const r of REFERENTS) {
    const id = brut[r];
    if (!id || !z.uuid().safeParse(id).success) return { ok: false, message: "Désignez chaque référent." };
    const { error } = await db.from("parametre").update({ valeur: id }).eq("cle", r);
    if (error) return { ok: false, message: "Les référents n'ont pas pu être enregistrés." };
  }
  revalidatePath("/admin");
  return { ok: true, message: "Référents enregistrés." };
}
