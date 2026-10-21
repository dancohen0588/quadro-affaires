import { describe, expect, it } from "vitest";
import { construirePipeline, csvPipeline, libelleEtat, totauxPipeline, type AffairePipeline, type PhaseVue } from "./pipeline";

const phases: PhaseVue[] = [
  { code: "accueil", numero: "01", nom: "Accueil & découverte", couleur: "#3B6E8F", etapes: [{ code: "R0", titre: "Accueil client" }, { code: "R1", titre: "Découverte" }] },
  { code: "vente", numero: "03", nom: "Vente", couleur: "#B9812E", etapes: [{ code: "R3", titre: "Présentation" }, { code: "ACOMPTE_1", titre: "Règlement acompte 1" }] },
  { code: "cloture", numero: "06", nom: "Clôture", couleur: "#5B6472", etapes: [{ code: "SOLDE", titre: "Règlement du solde" }] },
];
const qui = { id: "c1", prenom: "Manon", initiales: "MA" };
const ou = { code: "AIX", nom: "Aix La Pioline" };
const affaire = (id: string, etapeCode: string | null, derniereActivite: string, montantCts: number | null = null): AffairePipeline => ({
  id, libelle: `${id} · Cuisine`, contremarque: id.toUpperCase(), etapeCode, montantCts, derniereActivite, vendue: etapeCode === "ACOMPTE_1",
  concepteur: qui, magasin: ou,
});

describe("pipeline", () => {
  const colonnes = construirePipeline({
    phases,
    affaires: [affaire("b", "R1", "2026-10-20"), affaire("a", "R0", "2026-10-05"), affaire("c", "R3", "2026-10-20", 900_000),
               affaire("d", "ACOMPTE_1", "2026-10-21", 1_200_000), affaire("e", null, "2026-10-21"), affaire("f", "R3", "2026-10-21")],
    taches: [
      { affaireId: "c", titre: "Compte rendu", echeance: "2026-10-23", origine: "process" },
      { affaireId: "c", titre: "Check-list", echeance: "2026-10-19", origine: "process" },
      { affaireId: "f", titre: "Relancer le client", echeance: "2026-10-28", origine: "relance" },
    ],
    alertes: [{ affaire_id: "d", gravite: 1, regle: "RG-24", detail: "Acompte 1 non reçu" }],
    aujourdhui: "2026-10-21", seuilInactivite: 10,
  });

  it("range chaque affaire dans la phase de son étape courante, inconnue en première colonne", () => {
    expect(colonnes.map((c) => [c.phase.numero, c.cartes.map((x) => x.id)])).toEqual([
      ["01", ["a", "e", "b"]],
      ["03", ["d", "f", "c"]],
      ["06", []],
    ]);
    expect(colonnes[0].cartes[1].etape).toBeNull();
  });

  it("calcule jalon, inactivité et point d'état (EF-80, RG-27)", () => {
    const [a] = colonnes[0].cartes;
    expect(a).toMatchObject({ inactive: true, joursSansMouvement: 16, etat: "retard", jalon: null });
    const c = colonnes[1].cartes.find((x) => x.id === "c")!;
    expect(c.jalon).toEqual({ titre: "Check-list", echeance: "2026-10-19", enRetard: true });
    expect(c.etat).toBe("ok");
    expect(colonnes[1].cartes.find((x) => x.id === "f")!.etat).toBe("attention");
    expect(colonnes[1].cartes[0]).toMatchObject({ id: "d", etat: "retard", alertes: ["Acompte 1 non reçu"] });
  });

  it("filtre les inactives et totalise l'en-tête (EF-81)", () => {
    const inactives = construirePipeline({ phases, affaires: [affaire("a", "R0", "2026-10-05"), affaire("b", "R1", "2026-10-20")], taches: [], alertes: [], aujourdhui: "2026-10-21", seuilInactivite: 10, inactivesSeulement: true });
    expect(inactives.flatMap((c) => c.cartes.map((x) => x.id))).toEqual(["a"]);
    expect(totauxPipeline(colonnes)).toEqual({ affaires: 6, signesCts: 1_200_000 });
    const solde = construirePipeline({ phases, affaires: [{ ...affaire("g", "SOLDE", "2026-10-21", 500_000), vendue: true }], taches: [], alertes: [], aujourdhui: "2026-10-21", seuilInactivite: 10 });
    expect(totauxPipeline(solde)).toEqual({ affaires: 1, signesCts: 0 });
  });

  it("exporte la liste en CSV (EF-82)", () => {
    const csv = csvPipeline(colonnes);
    const lignes = csv.trim().split("\r\n");
    expect(lignes).toHaveLength(7);
    expect(lignes[0]).toContain("Affaire;Contremarque;Magasin");
    expect(lignes.find((l) => l.startsWith("d ·"))).toBe("d · Cuisine;D;Aix La Pioline;Manon;03 Vente;Règlement acompte 1;12000,00;;;0;En retard;Acompte 1 non reçu");
    expect(libelleEtat("attention")).toBe("En attente");
  });
});
