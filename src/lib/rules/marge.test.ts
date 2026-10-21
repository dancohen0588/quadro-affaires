import { describe, expect, it } from "vitest";
import { margeEstimee } from "./marge";

describe("marge estimée (KPI-11)", () => {
  it("retire les prix d'achat connus du montant HT", () => {
    expect(margeEstimee(1_000_000, [310_272])).toEqual({ achatsCts: 310_272, margeCts: 689_728, tauxPct: 69, complete: true });
    expect(margeEstimee(1_000_000, [310_272, null])).toMatchObject({ margeCts: 689_728, complete: false });
    expect(margeEstimee(0, [100])).toMatchObject({ margeCts: -100, tauxPct: null });
  });
  it("ne dit rien sans aucun prix d'achat", () => {
    expect(margeEstimee(1_000_000, [])).toBeNull();
    expect(margeEstimee(1_000_000, [null])).toBeNull();
  });
});
