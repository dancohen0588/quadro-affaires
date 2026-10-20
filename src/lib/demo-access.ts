/**
 * Code d'accès à l'URL de démo (section 5.4, ENF-06).
 *
 * Sans ce verrou, la page « Choisir un personnage » serait ouverte à quiconque connaît l'URL.
 * Le cookie ne contient jamais le code en clair, seulement son empreinte SHA-256.
 * Module sans dépendance Node : utilisable dans le proxy comme dans une server action.
 */

export const DEMO_ACCESS_COOKIE = "qa_acces_demo";
export const DEMO_ACCESS_PATH = "/acces";
export const DEMO_ACCESS_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 jours

export async function accessToken(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`quadro-affaires:demo:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison à temps constant de deux chaînes de même alphabet. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chemins jamais soumis au code : la page de saisie elle-même et les routes cron (protégées par CRON_SECRET). */
export function isPublicPath(pathname: string): boolean {
  return pathname === DEMO_ACCESS_PATH || pathname.startsWith("/api/cron/");
}

/**
 * N'accepte qu'un chemin interne comme destination après saisie du code,
 * pour empêcher une redirection vers un autre site (« //exemple.com », « https://… »).
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.startsWith(DEMO_ACCESS_PATH)) return "/";
  return raw;
}

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "misconfigured" };

/**
 * Décision du proxy pour une requête.
 * - Hors mode démo : le verrou ne s'applique pas (la production utilise Microsoft 365, bloc B1).
 * - Mode démo sans code configuré : on bloque, sauf en développement local.
 */
export async function decideAccess(input: {
  appMode: "demo" | "production";
  configuredCode: string | null;
  cookieValue: string | undefined;
  pathname: string;
  search: string;
  isDevelopment: boolean;
}): Promise<AccessDecision> {
  if (input.appMode !== "demo") return { kind: "allow" };
  if (isPublicPath(input.pathname)) return { kind: "allow" };
  if (!input.configuredCode) {
    return input.isDevelopment ? { kind: "allow" } : { kind: "misconfigured" };
  }
  const expected = await accessToken(input.configuredCode);
  if (input.cookieValue && safeEqual(input.cookieValue, expected)) return { kind: "allow" };
  const suite = safeNextPath(`${input.pathname}${input.search}`);
  return { kind: "redirect", to: `${DEMO_ACCESS_PATH}?suite=${encodeURIComponent(suite)}` };
}
