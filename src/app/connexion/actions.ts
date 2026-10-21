"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/demo-access";
import { clientAdmin, clientUtilisateur } from "@/lib/supabase/server";
import { exigerModeDemo } from "@/server/garde";

const entree = z.object({ profilId: z.uuid(), suite: z.string().optional() });

/**
 * Connexion en un clic sous un personnage (AuthAdapter démo, section 5.4).
 * Le mot de passe commun des comptes de démo ne quitte jamais le serveur.
 * Sert aussi au changement de personnage depuis le menu utilisateur (la session est remplacée).
 */
export async function seConnecterCommePersonnage(formData: FormData) {
  exigerModeDemo();
  const { profilId, suite } = entree.parse({
    profilId: formData.get("profilId"),
    suite: formData.get("suite") ?? undefined,
  });

  const { data: profil } = await clientAdmin()
    .from("profil")
    .select("email, actif")
    .eq("id", profilId)
    .maybeSingle();
  if (!profil?.actif) redirect("/connexion?erreur=personnage");

  const motDePasse = process.env.DEMO_PERSONA_PASSWORD;
  if (!motDePasse) throw new Error("DEMO_PERSONA_PASSWORD manquant : impossible de connecter un personnage.");

  const supabase = await clientUtilisateur();
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithPassword({ email: profil.email, password: motDePasse });
  if (error) redirect("/connexion?erreur=connexion");

  redirect(safeNextPath(suite ?? "/ma-journee"));
}

/** Déconnexion (EF-03). */
export async function seDeconnecter() {
  const supabase = await clientUtilisateur();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/connexion");
}
