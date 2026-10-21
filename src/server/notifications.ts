import "server-only";
import { headers } from "next/headers";
import { adaptateurs } from "@/adapters";
import type { TypeMail } from "@/adapters/types";
import type { Mail } from "@/lib/mails/modeles";
import { clientAdmin } from "@/lib/supabase/server";

/** Adresse absolue d'une page de l'application, pour les liens des mails. */
export async function lienAbsolu(chemin: string): Promise<string> {
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocole = h.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  return `${protocole}://${hote}${chemin}`;
}

/**
 * Prévient une personne par mail (Mailer : boîte d'envoi en démo, Resend en production, B2). Une
 * notification qui échoue n'annule jamais l'action métier déjà enregistrée : l'erreur est journalisée.
 */
export async function notifier(destinataireId: string | null | undefined, type: TypeMail, mail: Mail): Promise<void> {
  if (!destinataireId) return;
  try {
    const { data: p } = await clientAdmin().from("profil").select("email").eq("id", destinataireId).maybeSingle();
    if (!p?.email) return;
    await adaptateurs().mailer.envoyer({ destinataireId, destinataireEmail: p.email, type, objet: mail.objet, html: mail.html });
  } catch (e) {
    console.error("Notification non enregistrée", e);
  }
}

/** Profil désigné pour un rôle de référent (parametre), ou null. */
export async function referent(role: "gerant_bpa" | "gerant_logistique" | "gerant_finance" | "responsable_r4"): Promise<string | null> {
  const { data } = await clientAdmin().from("parametre").select("valeur").eq("cle", role).maybeSingle();
  return typeof data?.valeur === "string" ? data.valeur : null;
}
