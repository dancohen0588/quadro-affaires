import { describe, expect, it } from "vitest";
import { datesAttendues, erreursEcheancier, etatEcheance, genererEcheancier, toutesRecues } from "./echeancier";

describe("échéancier de règlement (RG-10 à RG-13)", () => {
  it("génère 40 / 50 / 10 sur le TTC, acompte 1 attendu à la signature (RG-10, RG-12)", () => {
    const lignes = genererEcheancier({ montantTtcCts: 1_488_000, dateSignature: "2026-10-12" });
    expect(lignes.map((l) => [l.type, l.ordre, l.montantPrevuCts, l.dateAttendue])).toEqual([
      ["acompte_1", 1, 595_200, "2026-10-12"],
      ["acompte_2", 2, 744_000, null],
      ["solde", 3, 148_800, null],
    ]);
  });

  it("porte l'écart d'arrondi sur le solde et égale toujours le TTC (RG-11)", () => {
    for (const ttc of [1, 3, 99_999, 1_234_567, 372_001]) {
      const lignes = genererEcheancier({ montantTtcCts: ttc, dateSignature: "2026-10-01" });
      expect(lignes.reduce((s, l) => s + l.montantPrevuCts, 0)).toBe(ttc);
      expect(erreursEcheancier(lignes, ttc)).toEqual([]);
    }
    expect(genererEcheancier({ montantTtcCts: 1001, dateSignature: "2026-10-01" }).map((l) => l.montantPrevuCts)).toEqual([400, 501, 100]);
  });

  it("accepte un échéancier standard personnalisé et refuse un total différent de 100 %", () => {
    const lignes = genererEcheancier({
      montantTtcCts: 100_000,
      dateSignature: "2026-10-01",
      standard: [{ type: "acompte_1", pourcentage: 30 }, { type: "solde", pourcentage: 70 }],
    });
    expect(lignes.map((l) => l.montantPrevuCts)).toEqual([30_000, 70_000]);
    expect(() => genererEcheancier({ montantTtcCts: 1, dateSignature: "2026-10-01", standard: [{ type: "solde", pourcentage: 90 }] })).toThrow(/100 %/);
    expect(() => genererEcheancier({ montantTtcCts: 10.5, dateSignature: "2026-10-01" })).toThrow(/centimes/);
  });

  it("refuse une somme fausse, un montant invalide et Franfinance sur l'acompte 1 (RG-11, RG-13)", () => {
    const lignes = genererEcheancier({ montantTtcCts: 10_000, dateSignature: "2026-10-01" });
    expect(erreursEcheancier(lignes, 10_001)).toEqual([expect.stringMatching(/diffère du montant TTC/)]);
    const modifiees = lignes.map((l) => (l.type === "acompte_1" ? { ...l, mode: "franfinance" as const, montantPrevuCts: -1 } : l));
    expect(erreursEcheancier(modifiees, 5_999)).toEqual([
      expect.stringMatching(/Échéance 1 : montant invalide/),
      "Franfinance n'est pas accepté sur l'acompte 1 (RG-13).",
    ]);
  });

  it("date l'acompte 2 à la livraison et le solde à la pose plus la durée de chantier (RG-12)", () => {
    expect(datesAttendues({ dateLivraison: "2026-11-23", datePose: "2026-11-26" })).toEqual({ acompte_2: "2026-11-23", solde: "2026-11-26" });
    expect(datesAttendues({ dateLivraison: null, datePose: "2026-11-26", dureeChantierJours: 2 })).toEqual({ acompte_2: null, solde: "2026-11-28" });
    expect(datesAttendues({ dateLivraison: null, datePose: null })).toEqual({ acompte_2: null, solde: null });
  });
});

describe("état des échéances (EF-52, RG-15)", () => {
  const e = (x: Partial<Parameters<typeof etatEcheance>[0]>) => ({ montantPrevuCts: 1000, montantRecuCts: null, recuLe: null, dateAttendue: null, ...x });
  it("distingue reçue, partielle, en retard, attendue et à planifier", () => {
    expect(etatEcheance(e({ recuLe: "2026-10-01", montantRecuCts: 1000 }), "2026-10-21")).toBe("recue");
    expect(etatEcheance(e({ recuLe: "2026-10-01", montantRecuCts: 400 }), "2026-10-21")).toBe("partielle");
    expect(etatEcheance(e({ dateAttendue: "2026-10-20" }), "2026-10-21")).toBe("en_retard");
    expect(etatEcheance(e({ dateAttendue: "2026-10-21" }), "2026-10-21")).toBe("attendue");
    expect(etatEcheance(e({}), "2026-10-21")).toBe("a_planifier");
  });
  it("sait quand tout est reçu", () => {
    expect(toutesRecues([{ recuLe: "2026-10-01" }, { recuLe: "2026-10-02" }])).toBe(true);
    expect(toutesRecues([{ recuLe: "2026-10-01" }, { recuLe: null }])).toBe(false);
    expect(toutesRecues([])).toBe(false);
  });
});
