import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  ajouterJoursOuvres,
  estJourOuvre,
  jourDeSemaine,
  joursEntre,
  joursFeries,
  joursOuvresEcoules,
  lundiDeSemaine,
  paques,
  semaineIso,
} from "./calendrier";

describe("calendrier métier (section 8.7)", () => {
  it("calcule Pâques", () => {
    expect([paques(2026), paques(2027), paques(2028)]).toEqual(["2026-04-05", "2027-03-28", "2028-04-16"]);
  });

  it("liste les jours fériés français, y compris les fêtes mobiles", () => {
    expect(joursFeries(2026)).toEqual([
      "2026-01-01", "2026-04-06", "2026-05-01", "2026-05-08", "2026-05-14", "2026-05-25",
      "2026-07-14", "2026-08-15", "2026-11-01", "2026-11-11", "2026-12-25",
    ]);
    expect(joursFeries(2027)).toContain("2027-05-06"); // Ascension
    expect(joursFeries(2028)).toContain("2028-06-05"); // lundi de Pentecôte
  });

  it("reconnaît les jours ouvrés", () => {
    expect(estJourOuvre("2026-10-21")).toBe(true); // mercredi
    expect(estJourOuvre("2026-10-24")).toBe(false); // samedi
    expect(estJourOuvre("2026-10-25")).toBe(false); // dimanche
    expect(estJourOuvre("2026-11-11")).toBe(false); // férié
    expect(jourDeSemaine("2026-10-21")).toBe(3);
  });

  it("compte en jours ouvrés, en sautant week-ends et fériés", () => {
    expect(ajouterJoursOuvres("2026-10-21", 3)).toBe("2026-10-26"); // mer → lun
    expect(ajouterJoursOuvres("2026-11-10", 1)).toBe("2026-11-12"); // le 11 novembre est sauté
    expect(ajouterJoursOuvres("2026-10-26", -1)).toBe("2026-10-23"); // lun → ven précédent
    expect(ajouterJoursOuvres("2026-10-24", 0)).toBe("2026-10-24");
    expect(joursOuvresEcoules("2026-10-16", "2026-10-21")).toBe(3); // lun, mar, mer
    expect(joursOuvresEcoules("2026-10-21", "2026-10-21")).toBe(0);
    expect(joursOuvresEcoules("2026-10-21", "2026-10-01")).toBe(0);
  });

  it("calcule en jours calendaires", () => {
    expect(ajouterJours("2026-12-30", 3)).toBe("2027-01-02");
    expect(joursEntre("2026-10-01", "2026-10-21")).toBe(20);
  });

  it("donne la semaine ISO au format de la spec et son lundi", () => {
    expect(semaineIso("2026-10-29")).toBe("2026-S44");
    expect(semaineIso("2027-01-01")).toBe("2026-S53"); // un vendredi rattaché à la dernière semaine de 2026
    expect(semaineIso("2026-01-01")).toBe("2026-S01");
    expect(lundiDeSemaine("2026-S44")).toBe("2026-10-26");
    expect(lundiDeSemaine("2026-S01")).toBe("2025-12-29");
  });
});
