"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { instantParis } from "@/lib/format";
import type { Resultat } from "@/lib/process/moteur";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { appliquerEffets, chargerAffaireProcess, type AffaireProcess } from "@/server/process";

/**
 * Actions du moteur de process (EF-32, RG-01 à RG-07). Le moteur pur décide à partir de l'état lu avec
 * les droits de l'utilisateur ; public.appliquer_effets écrit tout ou rien. « Aujourd'hui » vient de Clock.
 */

export type ResultatAction = { ok: true; avertissements: string[] } | { ok: false; message: string };

const codeEtape = z.string().regex(/^[A-Z][A-Z0-9_]*$/);

const entreeValidation = z.object({
  affaireId: z.uuid(),
  etape: codeEtape,
  iteration: z.number().int().positive().optional(),
  issue: z.string().regex(/^[a-z][a-z0-9_]*$/),
  motif: z.string().trim().min(1).optional(),
  date: z.iso.date().optional(),
  ouvrir: z.array(codeEtape).optional(),
});
export type EntreeValidation = z.input<typeof entreeValidation>;

async function executer(
  affaireId: string,
  decider: (a: AffaireProcess, moment: { quand: string; aujourdhui: string; par: string }) => Resultat,
): Promise<ResultatAction> {
  const profil = await exigerProfil();
  const db = await clientUtilisateur();
  const affaire = await chargerAffaireProcess(db, affaireId);
  if (!affaire) return { ok: false, message: "Affaire introuvable." };

  const { clock } = adaptateurs();
  const [maintenant, aujourdhui] = await Promise.all([clock.now(), clock.today()]);
  const decision = decider(affaire, { quand: maintenant.toISOString(), aujourdhui, par: profil.id });
  if (!decision.ok) return { ok: false, message: decision.message };

  const erreur = await appliquerEffets(db, affaire, decision.effets);
  if (erreur) return { ok: false, message: erreur };
  revalidatePath(`/affaires/${affaireId}`);
  return { ok: true, avertissements: decision.avertissements };
}

/** Valide une étape ouverte avec l'issue choisie (EF-32). */
export async function validerEtape(brut: EntreeValidation): Promise<ResultatAction> {
  const lu = entreeValidation.safeParse(brut);
  if (!lu.success) return { ok: false, message: "Demande de validation invalide." };
  const { affaireId, ...v } = lu.data;
  return executer(affaireId, (a, moment) => a.moteur.valider(a.etat, { ...moment, ...v, dates: a.dates }));
}

/** Repasse une commande AGEM depuis un SAV ouvert (recommande). */
export async function repasserCommandeSav(affaireId: string): Promise<ResultatAction> {
  if (!z.uuid().safeParse(affaireId).success) return { ok: false, message: "Affaire invalide." };
  return executer(affaireId, (a, moment) => a.moteur.repasserCommandeSav(a.etat, { ...moment, dates: a.dates }));
}

// ── Tâches, RDV, réassignation (EF-31, EF-34, EF-41) ─────────────────────────────────────────

const message = (e: { code?: string; message: string } | null, defaut: string): string =>
  e?.code === "42501" || e?.code === "P0001" ? e.message : defaut;

/** Coche ou décoche une tâche (EF-31) ; la date vient de Clock. */
export async function cocherTache(affaireId: string, tacheId: string, faite: boolean): Promise<ResultatAction> {
  const profil = await exigerProfil();
  if (!z.uuid().safeParse(tacheId).success || !z.uuid().safeParse(affaireId).success) return { ok: false, message: "Tâche invalide." };
  const db = await clientUtilisateur();
  const maintenant = await adaptateurs().clock.now();
  const { data, error } = await db
    .from("tache")
    .update(faite ? { statut: "faite", fait_le: maintenant.toISOString(), fait_par: profil.id } : { statut: "a_faire", fait_le: null, fait_par: null })
    .eq("id", tacheId)
    .eq("affaire_id", affaireId)
    .neq("statut", "annulee")
    .select("id");
  if (error || !data?.length) return { ok: false, message: message(error, "Cette tâche ne peut pas être modifiée.") };
  revalidatePath(`/affaires/${affaireId}`);
  return { ok: true, avertissements: [] };
}

const entreeRdv = z.object({
  affaireId: z.uuid(),
  type: z.enum(["R1", "R2", "R3", "R4", "point_technique", "point_strategique"]),
  date: z.iso.date(),
  heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: z.string().trim().max(2000).optional(),
});
export type EntreeRdv = z.input<typeof entreeRdv>;

/** Ajoute un RDV à l'affaire (EF-34) : chez le concepteur, ou chez la responsable R4 pour un R4. */
export async function ajouterRdv(brut: EntreeRdv): Promise<ResultatAction> {
  await exigerProfil();
  const lu = entreeRdv.safeParse(brut);
  if (!lu.success) return { ok: false, message: "Indiquez le type, la date et l'heure du RDV." };
  const { affaireId, type, date, heure, notes } = lu.data;
  const db = await clientUtilisateur();
  const { data: affaire } = await db.from("affaire").select("client_id, concepteur_id").eq("id", affaireId).maybeSingle();
  if (!affaire) return { ok: false, message: "Affaire introuvable." };
  let profilId = affaire.concepteur_id;
  if (type === "R4") {
    const { data: r4 } = await db.from("parametre").select("valeur").eq("cle", "responsable_r4").maybeSingle();
    if (typeof r4?.valeur === "string") profilId = r4.valeur;
  }
  const { data: r3 } = await db.from("rdv").select("rang").eq("affaire_id", affaireId).eq("type", "R3").neq("statut", "annule");
  const rang = type === "R3" ? Math.max(0, ...(r3 ?? []).map((r) => r.rang)) + 1 : 1;
  const { error } = await db.from("rdv").insert({
    affaire_id: affaireId, client_id: affaire.client_id, type, rang, debut: instantParis(date, heure), profil_id: profilId, notes: notes || null,
  });
  if (error) return { ok: false, message: message(error, "Le RDV n'a pas pu être enregistré.") };
  revalidatePath(`/affaires/${affaireId}`);
  return { ok: true, avertissements: [] };
}

/** Marque un RDV comme fait (EF-34). */
export async function marquerRdvFait(affaireId: string, rdvId: string): Promise<ResultatAction> {
  await exigerProfil();
  if (!z.uuid().safeParse(rdvId).success || !z.uuid().safeParse(affaireId).success) return { ok: false, message: "RDV invalide." };
  const db = await clientUtilisateur();
  const { data, error } = await db.from("rdv").update({ statut: "fait" }).eq("id", rdvId).eq("affaire_id", affaireId).eq("statut", "prevu").select("id");
  if (error || !data?.length) return { ok: false, message: message(error, "Ce RDV ne peut pas être modifié.") };
  revalidatePath(`/affaires/${affaireId}`);
  return { ok: true, avertissements: [] };
}

/** Réassigne l'affaire à un autre concepteur (EF-41, gérants ; gardé aussi par trigger). */
export async function reassignerAffaire(affaireId: string, concepteurId: string): Promise<ResultatAction> {
  const profil = await exigerProfil();
  if (profil.role !== "gerant") return { ok: false, message: "Seul un gérant peut réassigner une affaire." };
  if (!z.uuid().safeParse(affaireId).success || !z.uuid().safeParse(concepteurId).success) return { ok: false, message: "Choix invalide." };
  const db = await clientUtilisateur();
  const { data: avant } = await db.from("affaire").select("concepteur_id").eq("id", affaireId).maybeSingle();
  if (!avant) return { ok: false, message: "Affaire introuvable." };
  const { data, error } = await db.from("affaire").update({ concepteur_id: concepteurId }).eq("id", affaireId).select("id");
  if (error || !data?.length) return { ok: false, message: message(error, "L'affaire n'a pas pu être réassignée.") };
  // Les tâches à faire de l'ancien concepteur sur cette affaire suivent l'affaire.
  await db.from("tache").update({ assignee_id: concepteurId })
    .eq("affaire_id", affaireId).eq("assignee_id", avant.concepteur_id).eq("statut", "a_faire").in("origine", ["process", "relance", "avis"]);
  revalidatePath(`/affaires/${affaireId}`);
  return { ok: true, avertissements: [] };
}
