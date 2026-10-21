import { describe, expect, it } from "vitest";
import { magasinSchema, sirenValide, societeSchema } from "./referentiel";

const ID = "00000000-0000-4000-8000-000000000001";
const SOC = "00000000-0000-4000-8000-000000000002";

describe("SIREN (clé de Luhn)", () => {
  it("accepte un numéro dont la clé est juste, refuse les autres", () => {
    expect(sirenValide("999123458")).toBe(true);
    expect(sirenValide("999123459")).toBe(false);
    expect(sirenValide("12345678")).toBe(false);
    expect(sirenValide("12345678A")).toBe(false);
  });
});

describe("magasins et sociétés (EF-101)", () => {
  it("magasin : nom obligatoire, champs facultatifs vides enregistrés à null", () => {
    expect(magasinSchema.parse({ id: ID, nom: " La Ciotat ", societeId: SOC, adresse: " ", telephone: "" }))
      .toEqual({ id: ID, nom: "La Ciotat", societeId: SOC, adresse: null, telephone: null });
    expect(magasinSchema.safeParse({ id: ID, nom: "", societeId: SOC, adresse: "", telephone: "" }).error?.issues[0].message).toBe("Indiquez le nom du magasin.");
  });

  it("magasin : téléphone au format libre mais plausible", () => {
    expect(magasinSchema.parse({ id: ID, nom: "Aix", societeId: SOC, adresse: "", telephone: "+33 4 42 00 00 00" }).telephone).toBe("+33 4 42 00 00 00");
    expect(magasinSchema.safeParse({ id: ID, nom: "Aix", societeId: SOC, adresse: "", telephone: "appeler Jean" }).success).toBe(false);
  });

  it("société : SIREN facultatif, espaces retirés, clé contrôlée", () => {
    expect(societeSchema.parse({ id: SOC, nom: "JVB Aix", siren: "999 123 458" }).siren).toBe("999123458");
    expect(societeSchema.parse({ id: SOC, nom: "JVB Aix", siren: "" }).siren).toBeNull();
    expect(societeSchema.safeParse({ id: SOC, nom: "JVB Aix", siren: "999 123 459" }).error?.issues[0].message).toMatch(/SIREN invalide/);
  });
});
