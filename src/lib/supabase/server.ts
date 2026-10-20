import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { readSupabasePublicEnv } from "@/lib/env";

/**
 * Client Supabase de l'utilisateur connecté (Server Components, Server Actions, Route Handlers).
 * Les droits sont ceux de l'utilisateur : la RLS s'applique (section 12).
 */
export async function clientUtilisateur() {
  // Lire les cookies d'abord : la page devient dynamique (jamais pré-rendue au build, où la config peut manquer).
  const cookieStore = await cookies();
  const { url, publishableKey } = readSupabasePublicEnv();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (aPoser) => {
        try {
          aPoser.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appel depuis un Server Component : écriture impossible, la session est rafraîchie par src/proxy.ts.
        }
      },
    },
  });
}

/**
 * Client administrateur (clé secrète) : contourne la RLS. Réservé aux usages serveur explicites
 * (seed de démo, liste des personnages). Jamais exposé au navigateur (ENF-06).
 */
export function clientAdmin() {
  const { url } = readSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY manquante (voir .env.example).");
  return createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
