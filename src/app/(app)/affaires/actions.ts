"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
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
