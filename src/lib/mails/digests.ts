import { dateCourte, euros } from "../format";
import { gabarit, type Mail, type Section } from "./modeles";

/**
 * Digests de la section 11 : quotidien (6 h 30, jours ouvrés, chaque utilisateur ayant des tâches) et du lundi
 * (7 h, les trois gérants). Modèles purs : les traitements de nuit fournissent les données.
 */

export type TacheDigest = { titre: string; contexte: string | null; echeance: string };
export type AlerteDigest = { libelle: string; detail: string; gravite: number };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const versElement = (t: TacheDigest, avecDate: boolean) => ({
  texte: t.contexte ? `${t.titre} · ${t.contexte}` : t.titre,
  detail: avecDate ? `prévue le ${dateCourte(t.echeance)}` : undefined,
  ton: avecDate ? ("retard" as const) : undefined,
});
const versAlerte = (a: AlerteDigest) => ({ texte: a.libelle, detail: a.detail, ton: a.gravite === 1 ? ("retard" as const) : ("attention" as const) });

/** Au plus `max` lignes par section, la suite résumée (« et 9 de plus dans l'outil »). */
export function limiter<T extends { texte: string }>(elements: T[], max = 8): (T | { texte: string })[] {
  return elements.length <= max ? elements : [...elements.slice(0, max), { texte: `et ${elements.length - max} de plus dans l'outil` }];
}

/** Le digest est-il utile ? « Chaque utilisateur ayant des tâches » (section 11), ou une alerte qui le concerne. */
export function digestUtile(d: { aFaire: unknown[]; enRetard: unknown[]; relances: unknown[]; alertes: unknown[] }): boolean {
  return d.aFaire.length + d.enRetard.length + d.relances.length + d.alertes.length > 0;
}

export function mailDigestQuotidien(d: {
  prenom: string; jour: string; aFaire: TacheDigest[]; enRetard: TacheDigest[]; relances: TacheDigest[];
  reglements: AlerteDigest[]; alertes: AlerteDigest[]; lien: string;
}): Mail {
  const total = d.aFaire.length + d.enRetard.length + d.relances.length;
  const sections: Section[] = [
    { titre: "Tâches du jour", elements: limiter(d.aFaire.map((t) => versElement(t, false))), total: d.aFaire.length, vide: "Aucune tâche prévue aujourd'hui." },
    { titre: "En retard", elements: limiter(d.enRetard.map((t) => versElement(t, true))), total: d.enRetard.length, vide: "Aucune tâche en retard." },
    { titre: "Relances", elements: limiter(d.relances.map((t) => versElement(t, false))), total: d.relances.length, vide: "Aucune relance aujourd'hui." },
    { titre: "Règlements à suivre", elements: limiter(d.reglements.map(versAlerte)), total: d.reglements.length, vide: "Aucun règlement en retard." },
  ];
  if (d.alertes.length) sections.push({ titre: "Alertes", elements: limiter(d.alertes.map(versAlerte)), total: d.alertes.length });
  return {
    objet: `Votre journée du ${dateCourte(d.jour)} : ${pluriel(total, "tâche")}${d.enRetard.length ? `, dont ${d.enRetard.length} en retard` : ""}`,
    html: gabarit({
      titre: `Bonjour ${d.prenom}`,
      intro: `Voici votre journée (${dateCourte(d.jour)}).`,
      sections,
      action: { libelle: "Ouvrir Ma journée", lien: d.lien },
    }),
  };
}

export type MagasinLundi = {
  nom: string; potentielCts: number; nbPotentiel: number;
  r3: number; livraisons: number; poses: number; reglementsCts: number; nbReglements: number;
  alertes: AlerteDigest[];
};

export function mailDigestLundi(d: { prenom: string; semaine: string; magasins: MagasinLundi[]; lien: string }): Mail {
  const nbAlertes = d.magasins.reduce((n, m) => n + m.alertes.length, 0);
  const sections: Section[] = d.magasins.map((m) => ({
    titre: m.nom,
    elements: [
      { texte: `Potentiel en conception et vente : ${euros(m.potentielCts, true)} HT`, detail: pluriel(m.nbPotentiel, "affaire") },
      { texte: `Cette semaine : ${m.r3} R3, ${pluriel(m.livraisons, "livraison")}, ${pluriel(m.poses, "pose")}` },
      { texte: `Règlements attendus : ${euros(m.reglementsCts, true)}`, detail: pluriel(m.nbReglements, "échéance") },
      ...m.alertes.slice(0, 5).map(versAlerte),
      ...(m.alertes.length > 5 ? [{ texte: `et ${m.alertes.length - 5} autre${m.alertes.length - 5 > 1 ? "s" : ""} alerte${m.alertes.length - 5 > 1 ? "s" : ""}` }] : []),
    ],
  }));
  return {
    objet: `Semaine ${d.semaine} : les enjeux des trois showrooms (${pluriel(nbAlertes, "alerte")})`,
    html: gabarit({
      titre: `Bonjour ${d.prenom}, voici la semaine ${d.semaine}`,
      intro: "Potentiel, enjeux de la semaine et alertes ouvertes, par magasin. Le détail est sur la page Point du mardi.",
      sections,
      action: { libelle: "Ouvrir le Point du mardi", lien: d.lien },
    }),
  };
}
