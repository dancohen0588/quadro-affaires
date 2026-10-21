import { describe, expect, it } from "vitest";
import { avertissementsCharge, jaugesSemaine, r3DeLaSemaine, type RdvCharge } from "./charge";

const seuils = { max_r2_par_jour: 1, max_r3_par_semaine: 4 };
const rdv = (type: string, debut: string, statut = "prevu", notes: string | null = null): RdvCharge => ({ type, debut, statut, notes });
const AUJ = "2026-10-21"; // mercredi

describe("charge des concepteurs (RG-30, RG-31, RG-32)", () => {
  const liste = [
    rdv("R2", "2026-10-21T08:00:00Z"),
    rdv("R2", "2026-10-21T13:00:00Z", "annule"),
    rdv("R2", "2026-10-20T13:00:00Z", "fait", "Relevé fait"),
    rdv("R3", "2026-10-19T08:00:00Z", "fait"), // lundi
    rdv("R3", "2026-10-25T20:30:00Z"), // dimanche 21 h 30 à Paris
    rdv("R3", "2026-10-25T23:30:00Z"), // lundi suivant 0 h 30 à Paris (heure d'hiver)
    rdv("R3", "2026-10-18T08:00:00Z", "fait", "ok"), // dimanche précédent
    rdv("R1", "2026-10-14T08:00:00Z", "fait", "x"), // hors des 7 jours
    rdv("point_technique", "2026-10-21T09:00:00Z", "fait"),
  ];

  it("calcule les jauges de Ma journée (EF-14)", () => {
    expect(jaugesSemaine(liste, AUJ, seuils)).toEqual({
      r2: { nombre: 1, max: 1 },
      r3: { nombre: 2, max: 4 },
      notes: { avecNotes: 2, faits: 3 },
    });
  });

  it("compte les R3 du lundi au dimanche, à l'heure de Paris", () => {
    expect(r3DeLaSemaine(liste, "2026-10-26")).toBe(1);
  });

  it("avertit sans bloquer au-delà des seuils", () => {
    expect(avertissementsCharge({ type: "R2", jour: AUJ }, liste, seuils, "Manon")).toEqual(["Manon a 2 R2 ce jour-là, pour 1 au plus (RG-30)."]);
    expect(avertissementsCharge({ type: "R2", jour: "2026-10-22" }, liste, seuils, "Manon")).toEqual([]);
    const pleine = [...liste, rdv("R3", "2026-10-22T08:00:00Z"), rdv("R3", "2026-10-23T08:00:00Z")];
    expect(avertissementsCharge({ type: "R3", jour: AUJ }, pleine, seuils, "Manon")).toEqual(["Manon a 5 R3 cette semaine-là, pour 4 au plus (RG-31)."]);
    expect(avertissementsCharge({ type: "R3", jour: AUJ }, liste, seuils, "Manon")).toEqual([]);
    expect(avertissementsCharge({ type: "R1", jour: AUJ }, pleine, seuils, "Manon")).toEqual([]);
  });
});
