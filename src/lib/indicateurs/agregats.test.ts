import { describe, expect, it } from "vitest";
import {
  affairesEnRetard, estPeriode, etatAffaire, eurosCompacts, filtrer, moyenne, repartition, somme, taux, trierAlertes, versCsv,
} from "./agregats";

const lignes = [
  { magasin_id: "AIX", concepteur_id: "manon", nb: 2 },
  { magasin_id: "AIX", concepteur_id: "clara", nb: 3 },
  { magasin_id: "VAL", concepteur_id: "manon", nb: null },
];

describe("agrégats d'indicateurs", () => {
  it("filtre par magasin et concepteur, puis additionne", () => {
    expect(filtrer(lignes, {})).toHaveLength(3);
    expect(filtrer(lignes, { magasinId: "AIX" })).toHaveLength(2);
    expect(filtrer(lignes, { magasinId: "AIX", concepteurId: "manon" })).toEqual([lignes[0]]);
    expect(somme(lignes, (l) => l.nb)).toBe(5);
    expect(somme([], (l: { nb: number }) => l.nb)).toBe(0);
  });

  it("calcule taux et moyennes sans diviser par zéro (KPI-02, KPI-05, KPI-09)", () => {
    expect(taux(17, 29)).toBe(59);
    expect(taux(1, 0)).toBeNull();
    expect(moyenne(3890, 267)).toBe(15);
    expect(moyenne(0, 0)).toBeNull();
  });

  it("répartit par clé, dans l'ordre décroissant (KPI-06, KPI-10)", () => {
    const r = repartition([{ m: "prix", n: 2 }, { m: "délai", n: 3 }, { m: "prix", n: 2 }, { m: null, n: 9 }], (l) => l.m, (l) => l.n);
    expect(r).toEqual([{ cle: "prix", total: 4 }, { cle: "délai", total: 3 }]);
  });

  it("affiche les gros montants en k€", () => {
    expect(eurosCompacts(14_800_000)).toEqual({ valeur: "148", unite: "k€" });
    expect(eurosCompacts(870_000)).toEqual({ valeur: "8\u00a0700", unite: "€" });
  });

  it("reconnaît les périodes", () => {
    expect(estPeriode("mois")).toBe(true);
    expect(estPeriode("siecle")).toBe(false);
  });
});

describe("alertes", () => {
  const a = (affaire_id: string, regle: string, gravite: number, depuis: string | null) => ({ affaire_id, regle, gravite, depuis });

  it("trie par gravité puis ancienneté (EF-91)", () => {
    const triees = trierAlertes([a("1", "RG-27", 2, "2026-10-01"), a("2", "RG-22", 1, "2026-10-13"), a("3", "RG-20", 1, "2026-10-01"), a("4", "RG-21", 1, null)]);
    expect(triees.map((x) => x.affaire_id)).toEqual(["4", "3", "2", "1"]);
  });

  it("compte les affaires en retard sans doublon (KPI-07)", () => {
    const r = affairesEnRetard([a("1", "RG-20", 1, null), a("2", "RG-21", 1, null), a("2", "RG-29", 1, null), a("3", "RG-24", 1, null), a("4", "RG-27", 2, null)]);
    expect(r).toEqual({ total: 2, commerce: 1, apresVente: 1, sansMouvement: 1 });
  });

  it("donne le point d'état du pipeline (EF-80, RG-27)", () => {
    expect(etatAffaire([], false)).toBe("ok");
    expect(etatAffaire([], true)).toBe("attention");
    expect(etatAffaire([{ gravite: 2, regle: "RG-23" }], false)).toBe("attention");
    expect(etatAffaire([{ gravite: 2, regle: "RG-27" }], false)).toBe("retard");
    expect(etatAffaire([{ gravite: 1, regle: "RG-22" }], false)).toBe("retard");
  });
});

describe("CSV", () => {
  it("échappe les séparateurs et guillemets, avec BOM pour Excel (EF-82)", () => {
    expect(versCsv([["a", 1, null], ['x;"y"', "l1\nl2", "ok"]])).toBe('﻿a;1;\r\n"x;""y""";"l1\nl2";ok\r\n');
  });
});
