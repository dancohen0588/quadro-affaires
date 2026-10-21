import type { FiltresPipeline } from "@/server/indicateurs";

const texte = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().slice(0, 60) : "");

/** Filtres communs à l'écran et à l'export CSV (EF-81, EF-82). */
export function lireFiltresPipeline(sp: Record<string, string | string[] | undefined>): FiltresPipeline {
  return { magasin: texte(sp.magasin), concepteur: texte(sp.concepteur), inactives: sp.inactives === "1" };
}
