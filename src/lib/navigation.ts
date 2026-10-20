/**
 * Entrées de la navigation latérale (section 9).
 * `gerantsSeulement` : visibles uniquement par les gérants une fois les rôles branchés (session 1.2).
 */
export type EntreeNavigation = {
  href: string;
  libelle: string;
  icone: "ma-journee" | "affaires" | "pipeline" | "planning" | "reglements" | "pilotage" | "admin";
  gerantsSeulement?: boolean;
  exigences: string;
  bloc: string;
};

export const NAVIGATION: readonly EntreeNavigation[] = [
  { href: "/ma-journee", libelle: "Ma journée", icone: "ma-journee", exigences: "EF-10 à EF-18", bloc: "J3" },
  { href: "/affaires", libelle: "Mes affaires", icone: "affaires", exigences: "EF-20 à EF-41", bloc: "J2-J3" },
  { href: "/pipeline", libelle: "Pipeline", icone: "pipeline", exigences: "EF-80 à EF-82", bloc: "J4" },
  { href: "/planning", libelle: "Planning", icone: "planning", exigences: "EF-60 à EF-62", bloc: "J3" },
  { href: "/reglements", libelle: "Règlements", icone: "reglements", exigences: "EF-50 à EF-53", bloc: "J3" },
  { href: "/pilotage", libelle: "Pilotage", icone: "pilotage", gerantsSeulement: true, exigences: "EF-90 à EF-93", bloc: "J4" },
  { href: "/admin", libelle: "Administration", icone: "admin", gerantsSeulement: true, exigences: "EF-100 à EF-104", bloc: "J5" },
] as const;

export const PAGE_PAR_DEFAUT = "/ma-journee";

/** Entrée active pour un chemin : correspondance exacte ou sous-chemin (/affaires/123 → Mes affaires). */
export function entreeActive(pathname: string): EntreeNavigation | undefined {
  return NAVIGATION.find((e) => pathname === e.href || pathname.startsWith(`${e.href}/`));
}
