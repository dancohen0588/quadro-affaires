import { describe, expect, it } from "vitest";
import { cibleHorloge, decalageLisible, decalagePour, joursFranchis } from "./horloge";

const t = (s: string) => new Date(s);

describe("horloge de démo", () => {
  const mercredi = t("2026-10-21T16:00:00+02:00");
  it("vise +1 jour, +1 semaine, lundi 7 h, l'heure réelle", () => {
    expect(cibleHorloge("jour", mercredi, mercredi).toISOString()).toBe(t("2026-10-22T16:00:00+02:00").toISOString());
    expect(cibleHorloge("semaine", mercredi, mercredi).toISOString()).toBe(t("2026-10-28T15:00:00+01:00").toISOString());
    // Lundi 26 octobre : passage à l'heure d'hiver, 7 h = 06:00 UTC.
    expect(cibleHorloge("lundi", mercredi, mercredi).toISOString()).toBe("2026-10-26T06:00:00.000Z");
    expect(cibleHorloge("lundi", t("2026-10-26T06:30:00+01:00"), mercredi).toISOString()).toBe("2026-10-26T06:00:00.000Z");
    expect(cibleHorloge("lundi", t("2026-10-26T08:00:00+01:00"), mercredi).toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(cibleHorloge("reel", t("2026-11-02T08:00:00+01:00"), mercredi)).toBe(mercredi);
  });

  it("liste les nuits franchies (6 h 30)", () => {
    expect(joursFranchis(mercredi, t("2026-10-24T16:00:00+02:00"))).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
    expect(joursFranchis(t("2026-10-21T05:00:00+02:00"), t("2026-10-21T07:00:00+02:00"))).toEqual(["2026-10-21"]);
    expect(joursFranchis(mercredi, t("2026-10-22T06:00:00+02:00"))).toEqual([]);
    expect(joursFranchis(mercredi, t("2026-10-20T10:00:00+02:00"))).toEqual([]);
  });

  it("calcule et affiche le décalage", () => {
    expect(decalagePour(t("2026-10-24T16:00:00+02:00"), mercredi)).toBe(3 * 86_400);
    expect(decalageLisible(3 * 86_400 + 7200)).toBe("+3 j 2 h");
    expect(decalageLisible(-3600)).toBe("−1 h");
    expect(decalageLisible(25 * 60)).toBe("+25 min");
    expect(decalageLisible(10)).toBe("aucun");
  });
});
