import { processDefinitionSchema, type Etape, type Phase, type ProcessDefinition } from "./schema";

/**
 * Contrôles de cohérence d'une définition de process, au-delà de la forme (Zod) :
 * codes uniques, cibles existantes, sens des types d'issue, étapes atteignables depuis le départ.
 * Utilisé par les tests, au seed et à la publication d'une nouvelle version (EF-103).
 */

export type EtapeIndexee = { etape: Etape; phase: Phase };

export function indexerEtapes(def: ProcessDefinition): Map<string, EtapeIndexee> {
  const index = new Map<string, EtapeIndexee>();
  for (const phase of def.phases) for (const etape of phase.etapes) index.set(etape.code, { etape, phase });
  return index;
}

/** Étapes suivantes possibles d'une étape : cibles des issues, étapes ouvertes en parallèle. */
export function successeurs(etape: Etape): string[] {
  const cibles = new Set<string>();
  for (const issue of etape.issues) {
    if (issue.vers) cibles.add(issue.vers);
    if (issue.vers_si_avis_obtenu) cibles.add(issue.vers_si_avis_obtenu);
    for (const o of issue.ouvre ?? []) cibles.add(o.etape);
  }
  return [...cibles];
}

/** Codes des étapes atteignables depuis le départ. */
export function atteignables(def: ProcessDefinition): Set<string> {
  const index = indexerEtapes(def);
  const vues = new Set<string>();
  const file = [def.depart];
  while (file.length > 0) {
    const code = file.shift()!;
    if (vues.has(code)) continue;
    const entree = index.get(code);
    if (!entree) continue;
    vues.add(code);
    file.push(...successeurs(entree.etape));
  }
  return vues;
}

function doublons(valeurs: string[]): string[] {
  const vus = new Set<string>();
  const doubles = new Set<string>();
  for (const v of valeurs) (vus.has(v) ? doubles : vus).add(v);
  return [...doubles];
}

export function erreursCoherence(def: ProcessDefinition): string[] {
  const erreurs: string[] = [];
  const etapes = def.phases.flatMap((p) => p.etapes);
  const codes = new Set(etapes.map((e) => e.code));

  for (const c of doublons(def.phases.map((p) => p.code))) erreurs.push(`Phase en double : ${c}`);
  def.phases.forEach((p, i) => {
    const attendu = String(i + 1).padStart(2, "0");
    if (p.numero !== attendu) erreurs.push(`Phase ${p.code} : numéro ${p.numero}, attendu ${attendu}`);
  });
  for (const c of doublons(etapes.map((e) => e.code))) erreurs.push(`Étape en double : ${c}`);
  if (!codes.has(def.depart)) erreurs.push(`Étape de départ inconnue : ${def.depart}`);

  for (const e of etapes) {
    for (const c of doublons(e.taches.map((t) => t.code))) erreurs.push(`${e.code} : tâche en double ${c}`);
    for (const c of doublons(e.documents.map((d) => d.code))) erreurs.push(`${e.code} : document en double ${c}`);
    for (const c of doublons(e.issues.map((i) => i.code))) erreurs.push(`${e.code} : issue en double ${c}`);

    for (const i of e.issues) {
      const ou = `${e.code} › ${i.code}`;
      for (const cible of [i.vers, i.vers_si_avis_obtenu, ...(i.ouvre ?? []).map((o) => o.etape)]) {
        if (cible && !codes.has(cible)) erreurs.push(`${ou} : étape cible inconnue ${cible}`);
      }
      switch (i.type) {
        case "go":
          if (!i.vers) erreurs.push(`${ou} : une issue « go » indique l'étape suivante (vers)`);
          break;
        case "loop":
          if (i.vers !== e.code) erreurs.push(`${ou} : une issue « loop » reboucle sur sa propre étape`);
          if (!e.repetable) erreurs.push(`${ou} : une issue « loop » exige une étape répétable`);
          break;
        case "end":
          if (!i.statut_affaire) erreurs.push(`${ou} : une issue « end » fixe le statut de l'affaire`);
          if ((i.statut_affaire === "perdue" || i.statut_affaire === "abandonnee") && !i.motif_obligatoire) {
            erreurs.push(`${ou} : une affaire perdue ou abandonnée exige un motif (RG-06)`);
          }
          break;
        case "wait":
          if (!i.demande_date && !i.relance_jours) erreurs.push(`${ou} : une issue « wait » demande une date ou une relance`);
          break;
        case "fin_branche":
          if (i.vers) erreurs.push(`${ou} : une fin de branche n'a pas d'étape suivante`);
          break;
        case "alert":
          break;
      }
    }
  }

  const accessibles = atteignables(def);
  for (const e of etapes) if (!accessibles.has(e.code)) erreurs.push(`Étape inatteignable depuis ${def.depart} : ${e.code}`);

  const cloture = etapes.some((e) => e.issues.some((i) => i.type === "end" && i.statut_affaire === "cloturee"));
  if (!cloture) erreurs.push("Aucune issue ne clôture l'affaire (statut « cloturee »)");

  return erreurs;
}

/** Lit et valide une définition ; lève une erreur lisible qui liste tous les problèmes. */
export function chargerProcess(brut: unknown): ProcessDefinition {
  const forme = processDefinitionSchema.safeParse(brut);
  if (!forme.success) {
    const details = forme.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`);
    throw new Error(`Définition de process invalide :\n- ${details.join("\n- ")}`);
  }
  const erreurs = erreursCoherence(forme.data);
  if (erreurs.length > 0) throw new Error(`Définition de process incohérente :\n- ${erreurs.join("\n- ")}`);
  return forme.data;
}
