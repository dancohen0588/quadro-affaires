import { describe, expect, it } from "vitest";
import { badgeEcheance, estAVenir, estDuJour, grouperParAffaire, titreDuJour, type TacheJournee } from "./journee";

const AUJ = "2026-10-21";
const a1 = { id: "a1", libelle: "ROUX Marie · Cuisine", contremarque: "ROUX Marie", etape: "ARC" };
const a2 = { id: "a2", libelle: "BENALI Karim · Dressing", contremarque: "BENALI Karim", etape: "R3" };
const t = (id: string, echeance: string | null, affaire: TacheJournee["affaire"], extra: Partial<TacheJournee> = {}): TacheJournee => ({
  id, titre: id, detail: null, echeance, statut: "a_faire", faitLe: null, origine: "process", affaire, etape: null, ...extra,
});

describe("Ma journée (EF-10, EF-11, EF-18)", () => {
  it("titre la journée", () => {
    expect(titreDuJour(AUJ)).toBe("Mercredi 21 octobre");
    expect(titreDuJour("2026-09-28")).toBe("Lundi 28 septembre");
  });

  it("donne le badge d'échéance", () => {
    expect(badgeEcheance({ echeance: "2026-10-17", statut: "a_faire" }, AUJ)).toEqual({ texte: "Retard 4 j", ton: "retard" });
    expect(badgeEcheance({ echeance: AUJ, statut: "a_faire" }, AUJ)).toEqual({ texte: "Aujourd'hui", ton: "attention" });
    expect(badgeEcheance({ echeance: "2026-10-23", statut: "a_faire" }, AUJ)).toEqual({ texte: "Ven. 23 oct.", ton: "neutre" });
    expect(badgeEcheance({ echeance: null, statut: "a_faire" }, AUJ)).toEqual({ texte: "Sans date", ton: "neutre" });
    expect(badgeEcheance({ echeance: "2026-10-01", statut: "faite" }, AUJ)).toEqual({ texte: "OK", ton: "ok" });
  });

  it("sépare les tâches du jour et celles à venir", () => {
    expect(estDuJour(t("x", "2026-10-20", null), AUJ)).toBe(true);
    expect(estDuJour(t("x", AUJ, null), AUJ)).toBe(true);
    expect(estDuJour(t("x", "2026-10-22", null), AUJ)).toBe(false);
    expect(estDuJour(t("x", null, null), AUJ)).toBe(false);
    expect(estDuJour(t("x", "2026-10-01", null, { statut: "faite", faitLe: "2026-10-21T09:00:00+02:00" }), AUJ)).toBe(true);
    expect(estDuJour(t("x", "2026-10-01", null, { statut: "faite", faitLe: "2026-10-20T09:00:00+02:00" }), AUJ)).toBe(false);
    expect(estDuJour(t("x", "2026-10-01", null, { statut: "annulee" }), AUJ)).toBe(false);
    expect(estAVenir(t("x", "2026-10-28", null), AUJ)).toBe(true);
    expect(estAVenir(t("x", "2026-10-29", null), AUJ)).toBe(false);
    expect(estAVenir(t("x", AUJ, null), AUJ)).toBe(false);
    expect(estAVenir(t("x", null, null), AUJ)).toBe(false);
  });

  it("regroupe par affaire, par échéance, sans affaire en dernier", () => {
    const groupes = grouperParAffaire([
      t("libre", "2026-10-10", null),
      t("b2", AUJ, a2),
      t("a-tard", AUJ, a1),
      t("a-tot", "2026-10-17", a1),
      t("b1", "2026-10-19", a2),
      t("sans-date", null, a2),
    ]);
    expect(groupes.map((g) => [g.affaire?.id ?? null, g.taches.map((x) => x.id)])).toEqual([
      ["a1", ["a-tot", "a-tard"]],
      ["a2", ["b1", "b2", "sans-date"]],
      [null, ["libre"]],
    ]);
  });
});
