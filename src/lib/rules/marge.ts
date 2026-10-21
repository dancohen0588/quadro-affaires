/**
 * KPI-11, marge estimée (section 10) : montant HT de la vente − somme des prix d'achat des commandes de ses
 * affaires. Estimée tant qu'une commande n'a pas de prix (débit pas encore lu) : on le signale.
 */
export type Marge = { achatsCts: number; margeCts: number; tauxPct: number | null; complete: boolean };

export function margeEstimee(venteHtCts: number, prixAchats: readonly (number | null)[]): Marge | null {
  const connus = prixAchats.filter((p): p is number => p !== null);
  if (!connus.length) return null;
  const achatsCts = connus.reduce((s, p) => s + p, 0);
  const margeCts = venteHtCts - achatsCts;
  return {
    achatsCts, margeCts,
    tauxPct: venteHtCts > 0 ? Math.round((1000 * margeCts) / venteHtCts) / 10 : null,
    complete: connus.length === prixAchats.length,
  };
}
