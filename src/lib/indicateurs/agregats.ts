/**
 * Agrégation des vues d'indicateurs (docs/indicateurs.md). Les vues SQL donnent des lignes par magasin et par
 * concepteur ; l'écran filtre puis additionne ici. Aucune définition d'indicateur n'est recopiée : seuls les
 * ratios (panier moyen, taux, moyenne) et les tris se calculent côté TypeScript.
 */

export type Filtre = { magasinId?: string | null; concepteurId?: string | null };
type Decline = { magasin_id: string | null; concepteur_id: string | null };

export const PERIODES = [
  ["semaine", "Cette semaine"],
  ["semaine_precedente", "Semaine dernière"],
  ["mois", "Ce mois"],
  ["mois_precedent", "Mois dernier"],
  ["trimestre", "Ce trimestre"],
  ["annee", "Cette année"],
  ["douze_mois", "12 derniers mois"],
] as const;
export type Periode = (typeof PERIODES)[number][0];
export const estPeriode = (v: unknown): v is Periode => PERIODES.some(([c]) => c === v);

/** Lignes du magasin et du concepteur demandés (filtre vide : tout ce que la RLS laisse voir). */
export function filtrer<T extends Decline>(lignes: readonly T[], f: Filtre): T[] {
  return lignes.filter((l) => (!f.magasinId || l.magasin_id === f.magasinId) && (!f.concepteurId || l.concepteur_id === f.concepteurId));
}

/** Somme d'une colonne numérique (les vues renvoient null pour une somme vide). */
export function somme<T>(lignes: readonly T[], valeur: (l: T) => number | null): number {
  return lignes.reduce((s, l) => s + (valeur(l) ?? 0), 0);
}

/** Pourcentage arrondi, null si le dénominateur est nul. */
export function taux(numerateur: number, denominateur: number): number | null {
  return denominateur > 0 ? Math.round((100 * numerateur) / denominateur) : null;
}

/** Moyenne arrondie à l'unité, null sans données. */
export function moyenne(total: number, nombre: number): number | null {
  return nombre > 0 ? Math.round(total / nombre) : null;
}

/** Regroupe et additionne une colonne par clé (type de RDV, motif…), dans l'ordre décroissant. */
export function repartition<T>(lignes: readonly T[], cle: (l: T) => string | null, valeur: (l: T) => number): { cle: string; total: number }[] {
  const m = new Map<string, number>();
  for (const l of lignes) {
    const k = cle(l);
    if (k !== null) m.set(k, (m.get(k) ?? 0) + valeur(l));
  }
  return [...m].map(([k, total]) => ({ cle: k, total })).sort((a, b) => b.total - a.total || a.cle.localeCompare(b.cle, "fr"));
}

/** « 148 k€ » pour les cartes ; sous 10 000 €, le montant entier. */
export function eurosCompacts(centimes: number): { valeur: string; unite: string } {
  const e = Math.round(centimes / 100);
  if (Math.abs(e) < 10_000) return { valeur: e.toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, "\u00a0"), unite: "€" };
  return { valeur: Math.round(e / 1000).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, "\u00a0"), unite: "k€" };
}

// ── Alertes (vue `alertes`, RG-20 à RG-29) ──────────────────────────────────────────────────────

export type Alerte = Decline & {
  affaire_id: string; regle: string; gravite: number; depuis: string | null; detail: string; montant_cts: number | null; echeance_id: string | null;
};

export const LIBELLES_REGLES: Record<string, string> = {
  "RG-20": "Retard commerce",
  "RG-21": "Retard BPA",
  "RG-22": "ARC non reçu",
  "RG-23": "AR non reçu",
  "RG-24": "Acompte 1 non reçu",
  "RG-25": "Acompte 2 non reçu",
  "RG-26": "Solde non reçu",
  "RG-27": "Inactivité",
  "RG-28": "Dossier de pose incomplet",
  "RG-29": "Livraison menacée",
};

/** KPI-07 : règles qui font une « affaire en retard » (commerce, puis après-vente). */
export const REGLES_RETARD = { commerce: ["RG-20"], apresVente: ["RG-21", "RG-28", "RG-29"] } as const;
export const REGLES_REGLEMENT = ["RG-24", "RG-25", "RG-26"] as const;

/** Tri EF-91 : gravité (1 rouge avant 2 orange), puis la plus ancienne, puis la règle. */
export function trierAlertes<T extends Pick<Alerte, "gravite" | "depuis" | "regle">>(alertes: readonly T[]): T[] {
  return [...alertes].sort((a, b) => a.gravite - b.gravite || (a.depuis ?? "").localeCompare(b.depuis ?? "") || a.regle.localeCompare(b.regle));
}

/** KPI-07 : affaires distinctes en retard, avec le détail commerce / après-vente / sans mouvement (RG-27). */
export function affairesEnRetard(alertes: readonly Pick<Alerte, "affaire_id" | "regle">[]) {
  const distinctes = (regles: readonly string[]) => new Set(alertes.filter((a) => regles.includes(a.regle)).map((a) => a.affaire_id));
  const commerce = distinctes(REGLES_RETARD.commerce);
  const apresVente = distinctes(REGLES_RETARD.apresVente);
  return {
    total: new Set([...commerce, ...apresVente]).size,
    commerce: commerce.size,
    apresVente: apresVente.size,
    sansMouvement: distinctes(["RG-27"]).size,
  };
}

// ── Point d'état d'une affaire dans le pipeline (EF-80) ────────────────────────────────────────

export type EtatAffaire = "ok" | "attention" | "retard";

/**
 * Rouge : une alerte de gravité 1 ou l'inactivité (RG-27 : « point rouge dans le pipeline ») ;
 * orange : une alerte de gravité 2 ou une relance en attente (client qui doit revenir) ; vert sinon.
 */
export function etatAffaire(alertes: readonly Pick<Alerte, "gravite" | "regle">[], enAttente: boolean): EtatAffaire {
  if (alertes.some((a) => a.gravite === 1 || a.regle === "RG-27")) return "retard";
  if (alertes.length > 0 || enAttente) return "attention";
  return "ok";
}

// ── Export CSV (EF-82) ──────────────────────────────────────────────────────────────────────────

/** CSV pour Excel en français : séparateur « ; », guillemets si besoin, BOM UTF-8, fins de ligne CRLF. */
export function versCsv(lignes: readonly (readonly (string | number | null)[])[]): string {
  const cellule = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n";
}
