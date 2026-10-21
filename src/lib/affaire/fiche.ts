import { jourDe } from "../format";
import type { CodePhase, Etape, ProcessDefinition, Role } from "../process/schema";
import { successeurs } from "../process/valider";
import { nomAttendu, type ValeursGabarit } from "../rules/documents";
import type { DateIso } from "../rules/calendrier";

/**
 * Modèle de vue de la fiche affaire (EF-31, EF-33, EF-35, EF-39), calculé à partir des lignes de la
 * base et de la définition du process de l'affaire (RG-04). Module pur, sans accès à la base.
 */

export type EtapeLigne = {
  id: string;
  etape_code: string;
  iteration: number;
  statut: string;
  branche: string;
  issue_code: string | null;
  motif: string | null;
  debut_at: string | null;
  fin_at: string | null;
  valide_par: string | null;
};

export type TacheLigne = {
  id: string;
  etape_instance_id: string | null;
  titre: string;
  statut: string;
  optionnelle: boolean;
  echeance: string | null;
  assignee_id: string;
};

export type DocumentLigne = { type_doc: string; nom_final: string; created_at: string };

export type TacheVue = {
  id: string;
  titre: string;
  faite: boolean;
  optionnelle: boolean;
  echeance: string | null;
  enRetard: boolean;
  assignee: string | null;
};

export type StatutEtapeVue = "faite" | "en_cours" | "a_venir";

export type EtapeVue = {
  /** Identifiant de l'instance ; null pour une étape à venir. */
  id: string | null;
  code: string;
  titre: string;
  iteration: number;
  branche: "principale" | "autres_fournisseurs" | "sav";
  statut: StatutEtapeVue;
  issue: string | null;
  motif: string | null;
  fin: string | null;
  validePar: string | null;
  taches: TacheVue[];
  /** Titres des tâches modèles, pour une étape à venir. */
  tachesModeles: string[];
  enRetard: boolean;
};

export type PhaseVue = {
  code: CodePhase;
  numero: string;
  nom: string;
  couleur: string;
  etat: "terminee" | "en_cours" | "a_venir";
  termineeLe: string | null;
  etapes: EtapeVue[];
};

export type ContexteVue = {
  aujourdhui: DateIso;
  /** Prénom d'un profil, ou null s'il est inconnu. */
  prenomDe: (id: string | null) => string | null;
};

type Indexees = Map<string, { etape: Etape; phase: ProcessDefinition["phases"][number]; rang: number }>;

function indexer(def: ProcessDefinition): Indexees {
  const index: Indexees = new Map();
  let rang = 0;
  for (const phase of def.phases) for (const etape of phase.etapes) index.set(etape.code, { etape, phase, rang: rang++ });
  return index;
}

const estPrincipale = (e: Etape) => (e.branche ?? "principale") === "principale";

/**
 * Étapes du chemin principal encore à venir : pas encore ouvertes et atteignables depuis une étape
 * ouverte (les branches parallèles et le SAV n'apparaissent qu'une fois ouverts). Une affaire sans
 * étape ouverte (perdue, clôturée) n'a plus d'étape à venir.
 */
function etapesAVenir(index: Indexees, etapes: readonly EtapeLigne[]): Set<string> {
  const atteintes = new Set(etapes.filter((e) => e.statut === "faite" || e.statut === "en_cours").map((e) => e.etape_code));
  const file = etapes.filter((e) => e.statut === "en_cours").map((e) => e.etape_code);
  const vues = new Set<string>(file);
  while (file.length) {
    const code = file.shift()!;
    const def = index.get(code)?.etape;
    for (const suivant of def ? successeurs(def) : []) {
      if (!vues.has(suivant)) {
        vues.add(suivant);
        file.push(suivant);
      }
    }
  }
  return new Set([...vues].filter((c) => !atteintes.has(c) && index.has(c) && estPrincipale(index.get(c)!.etape)));
}

/** Étiquette d'une étape : « Présentation » ou « Présentation (R3.2) » pour une itération. */
export function titreEtape(titre: string, code: string, iteration: number): string {
  return iteration > 1 ? `${titre} (${code}.${iteration})` : titre;
}

export function construireProcessVue(
  def: ProcessDefinition,
  etapes: readonly EtapeLigne[],
  taches: readonly TacheLigne[],
  ctx: ContexteVue,
): { phases: PhaseVue[]; faites: number; total: number } {
  const index = indexer(def);
  const instances = etapes
    .filter((e) => (e.statut === "faite" || e.statut === "en_cours") && index.has(e.etape_code))
    .sort((a, b) => index.get(a.etape_code)!.rang - index.get(b.etape_code)!.rang || a.iteration - b.iteration);
  const aVenir = etapesAVenir(index, etapes);

  const vueInstance = (e: EtapeLigne): EtapeVue => {
    const { etape } = index.get(e.etape_code)!;
    const sesTaches = taches
      .filter((t) => t.etape_instance_id === e.id && t.statut !== "annulee")
      .map((t) => ({
        id: t.id,
        titre: t.titre,
        faite: t.statut === "faite",
        optionnelle: t.optionnelle,
        echeance: t.echeance,
        enRetard: t.statut === "a_faire" && !!t.echeance && t.echeance < ctx.aujourdhui,
        assignee: ctx.prenomDe(t.assignee_id),
      }))
      .sort((a, b) => Number(a.optionnelle) - Number(b.optionnelle));
    const issue = etape.issues.find((i) => i.code === e.issue_code);
    return {
      id: e.id,
      code: e.etape_code,
      titre: titreEtape(etape.titre, e.etape_code, e.iteration),
      iteration: e.iteration,
      branche: e.branche as EtapeVue["branche"],
      statut: e.statut as StatutEtapeVue,
      issue: issue?.libelle ?? e.issue_code,
      motif: e.motif,
      fin: e.fin_at,
      validePar: ctx.prenomDe(e.valide_par),
      taches: sesTaches,
      tachesModeles: [],
      enRetard: e.statut === "en_cours" && sesTaches.some((t) => t.enRetard),
    };
  };

  const phases = def.phases.map((phase): PhaseVue => {
    const vues = instances.filter((e) => index.get(e.etape_code)!.phase.code === phase.code).map(vueInstance);
    // Étapes du chemin principal pas encore atteintes (les branches n'apparaissent qu'une fois ouvertes).
    for (const etape of phase.etapes.filter((e) => aVenir.has(e.code))) {
      vues.push({
        id: null, code: etape.code, titre: etape.titre, iteration: 1, branche: "principale", statut: "a_venir",
        issue: null, motif: null, fin: null, validePar: null, taches: [],
        tachesModeles: etape.taches.filter((t) => !t.optionnelle).map((t) => t.titre), enRetard: false,
      });
    }
    const enCours = vues.some((v) => v.statut === "en_cours");
    const faites = vues.filter((v) => v.statut === "faite");
    const etat = enCours ? "en_cours" : faites.length && !vues.some((v) => v.statut === "a_venir") ? "terminee" : faites.length ? "en_cours" : "a_venir";
    const fins = faites.map((v) => v.fin).filter((f): f is string => !!f).sort();
    return {
      code: phase.code, numero: phase.numero, nom: phase.nom, couleur: phase.couleur, etat,
      termineeLe: etat === "terminee" ? (fins.at(-1) ?? null) : null, etapes: vues,
    };
  });

  const principales = [...index.values()].filter((x) => estPrincipale(x.etape));
  const faitesCodes = new Set(
    instances.filter((e) => e.statut === "faite" && estPrincipale(index.get(e.etape_code)!.etape)).map((e) => e.etape_code),
  );
  return { phases, faites: faitesCodes.size, total: principales.length };
}

// ── Documents attendus (EF-35) ─────────────────────────────────────────────────────────────────

export type DocumentVue = {
  code: string;
  libelle: string;
  /** Nom attendu (gabarit rempli) ou nom du fichier déposé. */
  nom: string;
  dossier: string;
  statut: "ok" | "attendu" | "a_venir";
  deposeLe: string | null;
};

export function construireDocumentsVue(
  def: ProcessDefinition,
  etapes: readonly EtapeLigne[],
  documents: readonly DocumentLigne[],
  valeurs: ValeursGabarit,
  aVenir = 2,
): DocumentVue[] {
  const index = indexer(def);
  const atteintes = new Set(etapes.filter((e) => e.statut === "faite" || e.statut === "en_cours").map((e) => e.etape_code));
  const aVenirCodes = etapesAVenir(index, etapes);
  const vues: DocumentVue[] = [];
  let suivants = 0;
  for (const { etape } of [...index.values()].sort((a, b) => a.rang - b.rang)) {
    const atteinte = atteintes.has(etape.code);
    const prochaine = aVenirCodes.has(etape.code);
    if (!atteinte && !prochaine) continue;
    for (const doc of etape.documents) {
      if (prochaine && suivants >= aVenir) break;
      const depose = documents.filter((d) => d.type_doc === doc.code).sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
      vues.push({
        code: doc.code,
        libelle: doc.libelle,
        nom: depose?.nom_final ?? (doc.gabarit_nom ? nomAttendu(doc.gabarit_nom, valeurs) : doc.libelle),
        dossier: doc.dossier,
        statut: depose ? "ok" : atteinte ? "attendu" : "a_venir",
        deposeLe: depose ? jourDe(depose.created_at) : null,
      });
      if (prochaine) suivants++;
    }
  }
  return vues;
}

// ── Intervenants (EF-39) ───────────────────────────────────────────────────────────────────────

export type Personne = { prenom: string; initiales: string };

export type IntervenantVue = Personne & { mission: string; statut: string | null; detail: string | null };

const MISSIONS: Record<Exclude<Role, "concepteur">, string> = {
  gerant_bpa: "plans, BPA",
  gerant_logistique: "livraison et pose",
  gerant_finance: "facture récapitulative",
  responsable_r4: "R4 et avis Google",
};

export function construireIntervenants(
  def: ProcessDefinition,
  etapes: readonly EtapeLigne[],
  p: {
    concepteur: Personne & { role: string; magasin: string };
    referents: Partial<Record<Exclude<Role, "concepteur">, Personne | null>>;
    close: boolean;
  },
): IntervenantVue[] {
  const liste: IntervenantVue[] = [
    { ...p.concepteur, mission: p.concepteur.role === "gerant" ? "concepteur" : "conceptrice", statut: null, detail: p.concepteur.magasin },
  ];
  const index = indexer(def);
  for (const role of Object.keys(MISSIONS) as Exclude<Role, "concepteur">[]) {
    const personne = p.referents[role];
    if (!personne) continue;
    const siennes = etapes.filter(
      (e) => (e.statut === "faite" || e.statut === "en_cours") && index.get(e.etape_code)?.etape.responsable === role,
    );
    if (p.close && siennes.length === 0) continue;
    const statut = siennes.some((e) => e.statut === "en_cours") ? "En cours" : siennes.length ? "Validé" : "À venir";
    const deja = liste.find((x) => x.prenom === personne.prenom);
    if (deja) {
      deja.mission = `${deja.mission}, ${MISSIONS[role]}`;
      continue;
    }
    liste.push({ ...personne, mission: MISSIONS[role], statut, detail: null });
  }
  return liste;
}
