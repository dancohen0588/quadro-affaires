import { ajouterJours, type DateIso } from "./calendrier";

/**
 * Effets des alertes (section 8.4, colonne « Effet ») et rappels RG-32, appliqués par les traitements de nuit.
 * Les alertes elles-mêmes sont définies une seule fois, dans la vue SQL `alertes` ; ici on décide seulement
 * qui est prévenu et quelle tâche est créée.
 */

export type AlerteNuit = {
  affaire_id: string; concepteur_id: string | null; regle: string; gravite: number; depuis: string | null; detail: string;
};
export type Referents = {
  gerants: readonly string[];
  gerantBpa: string | null; gerantLogistique: string | null; gerantFinance: string | null;
};

/** Personnes prévenues d'une alerte (digest quotidien). */
export function destinatairesAlerte(a: AlerteNuit, r: Referents): string[] {
  const concepteur = a.concepteur_id ? [a.concepteur_id] : [];
  const choix: Record<string, (string | null)[]> = {
    "RG-20": concepteur,
    "RG-21": [r.gerantBpa, ...r.gerants], // Benjamin et les gérants
    "RG-22": concepteur,
    "RG-23": concepteur,
    "RG-24": [...concepteur, r.gerantFinance], // concepteur + Jean
    "RG-25": [...concepteur, r.gerantFinance],
    "RG-26": [...concepteur, r.gerantFinance],
    "RG-27": concepteur,
    "RG-28": [r.gerantLogistique, ...concepteur], // Valentin et concepteur
    "RG-29": [r.gerantLogistique, ...concepteur],
  };
  return [...new Set((choix[a.regle] ?? concepteur).filter((x): x is string => !!x))];
}

/** Tâches créées par une alerte (RG-20 « Relancer le projet », RG-22 « Relancer AGEM », RG-23). */
const TACHES: Record<string, { titre: (detail: string) => string }> = {
  "RG-20": { titre: () => "Relancer le projet" },
  "RG-22": { titre: () => "Relancer AGEM : ARC non reçu" },
  "RG-23": { titre: (d) => `Relancer ${/^AR (.+?) attendu/.exec(d)?.[1] ?? "le fournisseur"} : AR non reçu` },
};

export type TacheNuit = {
  cle: string; affaire_id: string | null; client_id?: string | null; assignee_id: string; titre: string; detail: string | null;
  echeance: DateIso; origine: "alerte" | "relance"; modele_code: string;
};

/**
 * Une tâche par épisode d'alerte : la clé contient la date de début de l'alerte, si bien qu'une alerte qui
 * dure ne crée pas une tâche chaque nuit, mais une nouvelle commande en retard en crée une nouvelle.
 */
export function tachesDAlertes(alertes: readonly AlerteNuit[], jour: DateIso): TacheNuit[] {
  return alertes
    .filter((a) => TACHES[a.regle] && a.concepteur_id)
    .map((a) => ({
      cle: `${a.regle}:${a.affaire_id}:${a.depuis ?? ""}`,
      affaire_id: a.affaire_id, assignee_id: a.concepteur_id!, titre: TACHES[a.regle].titre(a.detail), detail: a.detail,
      echeance: jour, origine: "alerte" as const, modele_code: a.regle,
    }));
}

export type RdvSansNotes = { id: string; type: string; jour: DateIso; profil_id: string; affaire_id: string | null; client_id: string };

/** RG-32 : après un RDV fait sans notes, rappel au concepteur le lendemain (rattrapé sur 7 jours si une nuit manque). */
export function rappelsNotes(rdv: readonly RdvSansNotes[], jour: DateIso): TacheNuit[] {
  const depuis = ajouterJours(jour, -7);
  return rdv
    .filter((r) => r.jour < jour && r.jour >= depuis)
    .map((r) => ({
      cle: `RG-32:${r.id}`, affaire_id: r.affaire_id, client_id: r.client_id, assignee_id: r.profil_id,
      titre: `Noter le compte rendu du ${r.type}`, detail: `RDV du ${r.jour} marqué fait sans notes`,
      echeance: jour, origine: "relance" as const, modele_code: "RG-32",
    }));
}
