import "server-only";
import { notFound, redirect } from "next/navigation";
import { adaptateurs } from "@/adapters";
import { isDemo } from "@/lib/env";
import { lireSession, type ProfilCourant } from "./session";

/** Pages et actions propres au mode démo : introuvables en production (section 5.4, test associé). */
export function exigerModeDemo(): void {
  if (!isDemo()) notFound();
}

/** Profil connecté et actif, sinon renvoi vers la connexion (ou page « accès non autorisé », EF-02). */
export async function exigerProfil(): Promise<ProfilCourant> {
  const session = await lireSession();
  if (session.etat === "connecte") return session.profil;
  if (session.etat === "sans_profil") redirect("/acces-refuse");
  redirect(adaptateurs().auth.cheminConnexion);
}

/** Écrans réservés aux gérants (Pilotage, Administration — section 9). */
export async function exigerGerant(): Promise<ProfilCourant> {
  const profil = await exigerProfil();
  if (profil.role !== "gerant") notFound();
  return profil;
}
