import { describe, expect, it } from "vitest";
import { dateCourte, depuis, euros, heure, instantParis, jourDe, semaineCourte } from "./format";

const nb = (s: string) => s.replace(/ /g, " ");

describe("formats d'affichage", () => {
  it("écrit les montants en euros à partir des centimes", () => {
    expect(nb(euros(372000))).toBe("3 720,00 €");
    expect(nb(euros(1240000, true))).toBe("12 400 €");
    expect(nb(euros(5))).toBe("0,05 €");
  });

  it("donne le jour à Paris d'un horodatage", () => {
    expect(jourDe("2026-10-20T22:30:00Z")).toBe("2026-10-21");
    expect(jourDe("2026-09-15")).toBe("2026-09-15");
  });

  it("écrit les dates courtes, avec l'année si elle change", () => {
    expect(dateCourte("2026-09-15")).toBe("15 sept.");
    expect(dateCourte("2026-08-01T10:00:00+02:00")).toBe("1 août");
    expect(dateCourte("2025-12-03", 2026)).toBe("3 déc. 2025");
    expect(dateCourte("2026-12-03", 2026)).toBe("3 déc.");
  });

  it("écrit l'heure de Paris", () => {
    expect(heure("2026-10-21T12:30:00Z")).toBe("14 h 30");
    expect(heure("2026-11-04T09:00:00Z")).toBe("10 h 00");
  });

  it("dit depuis quand", () => {
    expect(depuis("2026-10-21", "2026-10-21")).toBe("aujourd'hui");
    expect(depuis("2026-10-20", "2026-10-21")).toBe("hier");
    expect(depuis("2026-10-22", "2026-10-21")).toBe("demain");
    expect(depuis("2026-10-17T10:00:00+02:00", "2026-10-21")).toBe("il y a 4 jours");
    expect(depuis("2026-10-24", "2026-10-21")).toBe("dans 3 jours");
  });

  it("horodate un jour à une heure de Paris, été comme hiver", () => {
    expect(instantParis("2026-10-21", "14:30")).toBe("2026-10-21T14:30:00+02:00");
    expect(instantParis("2026-11-04")).toBe("2026-11-04T10:00:00+01:00");
  });

  it("raccourcit une semaine ISO", () => {
    expect(semaineCourte("2026-S41")).toBe("S41");
  });
});
