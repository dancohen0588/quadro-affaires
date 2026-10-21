import { type DateIso, joursEntre } from "../rules/calendrier";
import { type Alerte, type EtatAffaire, etatAffaire, versCsv } from "./agregats";

/**
 * Pipeline (EF-80 à EF-82) : les affaires en cours rangées dans les 6 phases du process d'après leur étape
 * courante (affichage seulement : une affaire peut avoir plusieurs étapes ouvertes, section 7.4).
 */

export type PhaseVue = { code: string; numero: string; nom: string; couleur: string; etapes: { code: string; titre: string }[] };

export type AffairePipeline = {
  id: string; libelle: string; contremarque: string; etapeCode: string | null; montantCts: number | null; derniereActivite: DateIso;
  vendue: boolean; concepteur: { id: string; prenom: string; initiales: string }; magasin: { code: string; nom: string };
};
export type TacheAFaire = { affaireId: string; titre: string; echeance: DateIso; origine: string };

export type Carte = {
  id: string; libelle: string; contremarque: string; montantCts: number | null; vendue: boolean;
  phase: Omit<PhaseVue, "etapes">; etape: { code: string; titre: string } | null;
  concepteur: AffairePipeline["concepteur"]; magasin: AffairePipeline["magasin"];
  jalon: { titre: string; echeance: DateIso; enRetard: boolean } | null;
  joursSansMouvement: number; inactive: boolean; etat: EtatAffaire; alertes: string[];
};
export type Colonne = { phase: Omit<PhaseVue, "etapes">; cartes: Carte[] };

const RANG: Record<EtatAffaire, number> = { retard: 0, attention: 1, ok: 2 };

export function construirePipeline(p: {
  phases: readonly PhaseVue[]; affaires: readonly AffairePipeline[]; taches: readonly TacheAFaire[];
  alertes: readonly Pick<Alerte, "affaire_id" | "gravite" | "regle" | "detail">[];
  aujourdhui: DateIso; seuilInactivite: number; inactivesSeulement?: boolean;
}): Colonne[] {
  const ordre = new Map<string, { phase: number; etape: number }>();
  p.phases.forEach((ph, i) => ph.etapes.forEach((e, j) => ordre.set(e.code, { phase: i, etape: j })));

  const prochaine = new Map<string, TacheAFaire>();
  const enAttente = new Set<string>();
  for (const t of p.taches) {
    const d = prochaine.get(t.affaireId);
    if (!d || t.echeance < d.echeance) prochaine.set(t.affaireId, t);
    if (t.origine === "relance" && t.echeance > p.aujourdhui) enAttente.add(t.affaireId);
  }
  const alertesDe = new Map<string, typeof p.alertes[number][]>();
  for (const a of p.alertes) alertesDe.set(a.affaire_id, [...(alertesDe.get(a.affaire_id) ?? []), a]);

  const colonnes: Colonne[] = p.phases.map(({ code, numero, nom, couleur }) => ({ phase: { code, numero, nom, couleur }, cartes: [] }));
  const rangEtape = new Map<string, number>();
  for (const a of p.affaires) {
    const o = a.etapeCode ? ordre.get(a.etapeCode) : undefined;
    const iPhase = o?.phase ?? 0;
    const phase = p.phases[iPhase];
    const etape = o ? phase.etapes[o.etape] : null;
    const jours = Math.max(0, joursEntre(a.derniereActivite, p.aujourdhui));
    const inactive = jours > p.seuilInactivite;
    if (p.inactivesSeulement && !inactive) continue;
    const siennes = alertesDe.get(a.id) ?? [];
    const t = prochaine.get(a.id);
    rangEtape.set(a.id, o?.etape ?? 0);
    colonnes[iPhase].cartes.push({
      id: a.id, libelle: a.libelle, contremarque: a.contremarque, montantCts: a.montantCts, vendue: a.vendue,
      phase: colonnes[iPhase].phase, etape,
      concepteur: a.concepteur, magasin: a.magasin,
      jalon: t ? { titre: t.titre, echeance: t.echeance, enRetard: t.echeance < p.aujourdhui } : null,
      joursSansMouvement: jours, inactive,
      etat: inactive ? "retard" : etatAffaire(siennes, enAttente.has(a.id)),
      alertes: siennes.map((x) => x.detail),
    });
  }
  for (const c of colonnes) {
    c.cartes.sort((x, y) => RANG[x.etat] - RANG[y.etat] || rangEtape.get(x.id)! - rangEtape.get(y.id)! || x.libelle.localeCompare(y.libelle, "fr"));
  }
  return colonnes;
}

/** Totaux de l'en-tête : affaires affichées ; montant des affaires vendues pas encore en clôture (« signés en attente de pose »). */
export function totauxPipeline(colonnes: readonly Colonne[]): { affaires: number; signesCts: number } {
  const signees = colonnes.slice(0, -1).flatMap((c) => c.cartes).filter((c) => c.vendue);
  return {
    affaires: colonnes.reduce((n, c) => n + c.cartes.length, 0),
    signesCts: signees.reduce((s, c) => s + (c.montantCts ?? 0), 0),
  };
}

const LIBELLE_ETAT: Record<EtatAffaire, string> = { ok: "Actif", attention: "En attente", retard: "En retard" };
export const libelleEtat = (e: EtatAffaire) => LIBELLE_ETAT[e];

/** Export CSV de la vue liste (EF-82), mêmes filtres que l'écran. */
export function csvPipeline(colonnes: readonly Colonne[]): string {
  const entete = ["Affaire", "Contremarque", "Magasin", "Concepteur", "Phase", "Étape", "Montant devis HT (€)", "Prochain jalon",
    "Échéance", "Sans mouvement (j)", "État", "Alertes"];
  const lignes = colonnes.flatMap((c) => c.cartes).map((c) => [
    c.libelle, c.contremarque, c.magasin.nom, c.concepteur.prenom, `${c.phase.numero} ${c.phase.nom}`, c.etape?.titre ?? "",
    c.montantCts === null ? null : (c.montantCts / 100).toFixed(2).replace(".", ","),
    c.jalon?.titre ?? "", c.jalon?.echeance ?? "", c.joursSansMouvement, libelleEtat(c.etat), c.alertes.join(" | "),
  ]);
  return versCsv([entete, ...lignes]);
}
