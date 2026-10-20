import { describe, expect, it } from "vitest";
import { NAVIGATION, entreeActive } from "./navigation";

describe("navigation (section 9)", () => {
  it("suit l'ordre de la spécification", () => {
    expect(NAVIGATION.map((e) => e.libelle)).toEqual([
      "Ma journée",
      "Mes affaires",
      "Pipeline",
      "Planning",
      "Règlements",
      "Pilotage",
      "Administration",
    ]);
    expect(NAVIGATION.filter((e) => e.gerantsSeulement).map((e) => e.href)).toEqual(["/pilotage", "/admin"]);
  });

  it("active l'entrée parente sur une sous-page", () => {
    expect(entreeActive("/affaires/123")?.libelle).toBe("Mes affaires");
    expect(entreeActive("/pipeline")?.libelle).toBe("Pipeline");
    expect(entreeActive("/affairesx")).toBeUndefined();
  });
});
