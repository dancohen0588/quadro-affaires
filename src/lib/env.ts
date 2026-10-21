import { z } from "zod";

/**
 * Lecture des variables d'environnement (section 5.4, .env.example).
 * Fonctions pures qui prennent l'environnement en paramètre : testables, et lues à l'exécution
 * (jamais figées au build).
 */

export const appModeSchema = z.enum(["demo", "production"]);
export type AppMode = z.infer<typeof appModeSchema>;

type Env = Record<string, string | undefined>;

/** Mode de l'application. Une valeur absente ou inconnue est une erreur : on ne devine pas le mode. */
export function readAppMode(env: Env = process.env): AppMode {
  const parsed = appModeSchema.safeParse(env.APP_MODE);
  if (!parsed.success) {
    throw new Error(
      `APP_MODE doit valoir "demo" ou "production" (reçu : ${env.APP_MODE ?? "rien"}). Voir .env.example.`,
    );
  }
  return parsed.data;
}

export function isDemo(env: Env = process.env): boolean {
  return readAppMode(env) === "demo";
}

/** Code d'accès à l'URL de démo (section 5.4). Chaîne vide considérée comme absente. */
export function readDemoAccessCode(env: Env = process.env): string | null {
  const code = env.DEMO_ACCESS_CODE?.trim();
  return code ? code : null;
}

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/** Configuration Supabase publique (utilisable côté navigateur). */
export function readSupabasePublicEnv(env: Env = process.env) {
  const parsed = supabaseSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error("Configuration Supabase incomplète : voir NEXT_PUBLIC_SUPABASE_* dans .env.example.");
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
