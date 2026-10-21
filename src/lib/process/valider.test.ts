import { describe, expect, it } from "vitest";
import type { Etape, ProcessDefinition } from "./schema";
import { chargerProcess, erreursCoherence, successeurs } from "./valider";

const etape = (code: string, issues: Etape["issues"], extra: Partial<Etape> = {}): Etape => ({
  code, titre: `Étape ${code}`, responsable: "concepteur", taches: [], documents: [], issues, ...extra,
});
const fin = etape("FIN", [{ code: "archive", libelle: "Archivée", type: "end", statut_affaire: "cloturee" }]);
const process = (etapes: Etape[], extra: Partial<ProcessDefinition> = {}): ProcessDefinition => ({
  nom: "test", depart: "A", phases: [{ code: "accueil", numero: "01", nom: "Accueil", couleur: "#3B6E8F", etapes }], ...extra,
});
const valide = () => process([etape("A", [{ code: "suite", libelle: "Suite", type: "go", vers: "FIN" }]), fin]);

describe("contrôles de cohérence d'un process", () => {
  it("accepte un process minimal correct", () => {
    expect(erreursCoherence(valide())).toEqual([]);
    expect(chargerProcess(valide()).nom).toBe("test");
  });

  it("refuse une forme invalide avec un message lisible (Zod)", () => {
    expect(() => chargerProcess({ nom: "x", depart: "a", phases: [] })).toThrow(/Définition de process invalide[\s\S]*depart/);
  });

  it("signale une cible inconnue, une étape de départ inconnue et une étape inatteignable", () => {
    const def = process([etape("A", [{ code: "suite", libelle: "Suite", type: "go", vers: "ZZZ" }]), fin], { depart: "X" });
    const erreurs = erreursCoherence(def);
    expect(erreurs).toContain("A › suite : étape cible inconnue ZZZ");
    expect(erreurs).toContain("Étape de départ inconnue : X");
    expect(erreurs).toContain("Étape inatteignable depuis X : FIN");
    expect(() => chargerProcess(def)).toThrow(/incohérente/);
  });

  it("vérifie le sens de chaque type d'issue", () => {
    const def = process([
      etape("A", [
        { code: "go_sans_cible", libelle: "x", type: "go" },
        { code: "boucle_ailleurs", libelle: "x", type: "loop", vers: "FIN" },
        { code: "fin_sans_statut", libelle: "x", type: "end" },
        { code: "perdue_sans_motif", libelle: "x", type: "end", vers: "FIN", statut_affaire: "perdue" },
        { code: "attente_vide", libelle: "x", type: "wait" },
        { code: "branche_avec_suite", libelle: "x", type: "fin_branche", vers: "FIN" },
        { code: "alerte", libelle: "x", type: "alert" },
      ]),
      fin,
    ]);
    expect(erreursCoherence(def)).toEqual([
      "A › go_sans_cible : une issue « go » indique l'étape suivante (vers)",
      "A › boucle_ailleurs : une issue « loop » reboucle sur sa propre étape",
      "A › boucle_ailleurs : une issue « loop » exige une étape répétable",
      "A › fin_sans_statut : une issue « end » fixe le statut de l'affaire",
      "A › perdue_sans_motif : une affaire perdue ou abandonnée exige un motif (RG-06)",
      "A › attente_vide : une issue « wait » demande une date ou une relance",
      "A › branche_avec_suite : une fin de branche n'a pas d'étape suivante",
    ]);
  });

  it("accepte une boucle sur une étape répétable", () => {
    const def = process([
      etape("A", [
        { code: "encore", libelle: "x", type: "loop", vers: "A", demande_date: true },
        { code: "suite", libelle: "x", type: "go", vers: "FIN" },
      ], { repetable: true }),
      fin,
    ]);
    expect(erreursCoherence(def)).toEqual([]);
  });

  it("signale les doublons et la numérotation des phases", () => {
    const tache = { code: "t", titre: "Tâche", assignee: "concepteur" as const, echeance: { depuis: "aucune" as const } };
    const doc = { code: "d", libelle: "Document", dossier: "01 - X", formats: ["pdf" as const] };
    const a = etape("A", [
      { code: "suite", libelle: "x", type: "go", vers: "FIN" },
      { code: "suite", libelle: "x", type: "go", vers: "FIN" },
    ], { taches: [tache, tache], documents: [doc, doc] });
    const def: ProcessDefinition = {
      nom: "test",
      depart: "A",
      phases: [
        { code: "accueil", numero: "01", nom: "Accueil", couleur: "#3B6E8F", etapes: [a, fin] },
        { code: "accueil", numero: "03", nom: "Bis", couleur: "#3B6E8F", etapes: [etape("A", [{ code: "s", libelle: "x", type: "go", vers: "FIN" }])] },
      ],
    };
    const erreurs = erreursCoherence(def);
    expect(erreurs).toEqual(expect.arrayContaining([
      "Phase en double : accueil",
      "Phase accueil : numéro 03, attendu 02",
      "Étape en double : A",
      "A : tâche en double t",
      "A : document en double d",
      "A : issue en double suite",
    ]));
  });

  it("exige une issue qui clôture l'affaire", () => {
    const def = process([etape("A", [{ code: "fin", libelle: "x", type: "fin_branche" }])]);
    expect(erreursCoherence(def)).toContain("Aucune issue ne clôture l'affaire (statut « cloturee »)");
  });

  it("compte les étapes ouvertes en parallèle et la cible « avis obtenu » parmi les successeurs", () => {
    const e = etape("A", [
      { code: "ok", libelle: "x", type: "go", vers: "B", ouvre: [{ etape: "C" }], vers_si_avis_obtenu: "D" },
    ]);
    expect(successeurs(e).sort()).toEqual(["B", "C", "D"]);
  });
});
