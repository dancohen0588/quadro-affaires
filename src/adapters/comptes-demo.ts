import "server-only";
import { clientAdmin } from "@/lib/supabase/server";
import type { PortComptes } from "./demo";
import { CompteExistantError } from "./types";

/**
 * Comptes de la démo dans Supabase Auth (clé secrète, côté serveur). Un utilisateur ajouté par l'administration
 * reçoit le mot de passe commun des personnages (DEMO_PERSONA_PASSWORD), qui ne quitte jamais le serveur :
 * il apparaît aussitôt dans « Choisir un personnage ». Aucun mail n'est envoyé (adresse confirmée d'office).
 * Le jeu de démo (pnpm seed:demo) supprime ces comptes comme les autres.
 */
export const comptesSupabase: PortComptes = {
  async creer({ email, prenom }) {
    const motDePasse = process.env.DEMO_PERSONA_PASSWORD;
    if (!motDePasse) throw new Error("DEMO_PERSONA_PASSWORD manquant : impossible de créer le compte de démo.");
    const { data, error } = await clientAdmin().auth.admin.createUser({
      email, password: motDePasse, email_confirm: true, user_metadata: { prenom, ajoute_par: "administration" },
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists" || /already (been )?registered/i.test(error.message)) {
        throw new CompteExistantError(email);
      }
      throw new Error(`Compte de connexion : ${error.message}`);
    }
    if (!data.user) throw new Error("Compte de connexion : non créé.");
    return { id: data.user.id };
  },
  async supprimer(id) {
    const { error } = await clientAdmin().auth.admin.deleteUser(id);
    if (error) throw new Error(`Annulation du compte : ${error.message}`);
  },
};
