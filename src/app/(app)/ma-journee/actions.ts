"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";

/** Actions de Ma journée : cocher (EF-11), reporter (EF-12), tâche libre (EF-13). */

export type Resultat = { ok: true } | { ok: false; message: string };

const refus = (e: { code?: string; message: string } | null, defaut: string): Resultat => ({
  ok: false, message: e?.code === "42501" ? e.message : defaut,
});

/** Coche ou décoche une de ses tâches ; décocher dans les 10 secondes annule l'action (EF-11). */
export async function cocherMaTache(tacheId: string, faite: boolean): Promise<Resultat> {
  const moi = await exigerProfil();
  if (!z.uuid().safeParse(tacheId).success) return { ok: false, message: "Tâche invalide." };
  const db = await clientUtilisateur();
  const maintenant = await adaptateurs().clock.now();
  const { data, error } = await db
    .from("tache")
    .update(faite ? { statut: "faite", fait_le: maintenant.toISOString(), fait_par: moi.id } : { statut: "a_faire", fait_le: null, fait_par: null })
    .eq("id", tacheId)
    .neq("statut", "annulee")
    .select("affaire_id");
  if (error || !data?.length) return refus(error, "Cette tâche ne peut pas être modifiée.");
  revalidatePath("/ma-journee");
  if (data[0].affaire_id) revalidatePath(`/affaires/${data[0].affaire_id}`);
  return { ok: true };
}

const entreeReport = z.object({ tacheId: z.uuid(), date: z.iso.date(), motif: z.string().trim().max(200).optional() });

/** Reporte une tâche à une nouvelle date, avec un motif facultatif (EF-12) ; le journal garde l'ancienne date. */
export async function reporterTache(brut: z.input<typeof entreeReport>): Promise<Resultat> {
  await exigerProfil();
  const lu = entreeReport.safeParse(brut);
  if (!lu.success) return { ok: false, message: "Choisissez une date." };
  const { tacheId, date, motif } = lu.data;
  if (date < (await adaptateurs().clock.today())) return { ok: false, message: "La nouvelle date est déjà passée." };
  const db = await clientUtilisateur();
  const { data: avant } = await db.from("tache").select("detail").eq("id", tacheId).maybeSingle();
  const detail = motif ? [avant?.detail, `Reportée : ${motif}`].filter(Boolean).join(" · ") : (avant?.detail ?? null);
  const { data, error } = await db.from("tache").update({ echeance: date, detail }).eq("id", tacheId).eq("statut", "a_faire").select("id");
  if (error || !data?.length) return refus(error, "Cette tâche ne peut pas être reportée.");
  revalidatePath("/ma-journee");
  return { ok: true };
}

const entreeLibre = z.object({
  titre: z.string().trim().min(3, "Donnez un titre d'au moins 3 caractères.").max(160),
  echeance: z.iso.date(),
  assigneeId: z.uuid(),
  affaireId: z.union([z.literal(""), z.uuid()]).optional(),
});
export type EntreeTacheLibre = z.input<typeof entreeLibre>;

/** Crée une tâche libre, pour soi ou pour un collègue, rattachée ou non à une affaire (EF-13, D14). */
export async function creerTacheLibre(brut: EntreeTacheLibre): Promise<Resultat> {
  await exigerProfil();
  const lu = entreeLibre.safeParse(brut);
  if (!lu.success) return { ok: false, message: lu.error.issues[0]?.message ?? "Tâche invalide." };
  const { titre, echeance, assigneeId, affaireId } = lu.data;
  const db = await clientUtilisateur();
  const { error } = await db.from("tache").insert({ titre, echeance, assignee_id: assigneeId, affaire_id: affaireId || null, origine: "libre" });
  if (error) return refus(error, "La tâche n'a pas pu être créée.");
  revalidatePath("/ma-journee");
  return { ok: true };
}
