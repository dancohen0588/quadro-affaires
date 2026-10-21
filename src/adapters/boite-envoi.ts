import "server-only";
import { clientAdmin } from "@/lib/supabase/server";
import type { MailSortant } from "./types";

/**
 * Boîte d'envoi de la démo (section 5.4) : les mails sont enregistrés dans `mail_sortant`, jamais envoyés ;
 * l'écran Boîte d'envoi (J4) les affiche tels qu'ils partiraient.
 */
export async function enregistrerMailDemo(mail: MailSortant): Promise<{ id: string }> {
  const { data, error } = await clientAdmin()
    .from("mail_sortant")
    .insert({ destinataire_id: mail.destinataireId, destinataire_email: mail.destinataireEmail, type: mail.type, objet: mail.objet, html: mail.html, cle: mail.cle ?? null })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Boîte d'envoi : ${error?.message ?? "enregistrement impossible"}`);
  return { id: data.id };
}
