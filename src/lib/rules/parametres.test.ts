import { describe, expect, it } from "vitest";
import { SEUILS, lireListe, seuilsSchema } from "./parametres";

describe("paramètres (EF-102)", () => {
  const valides = Object.fromEntries(SEUILS.map(([c]) => [c, 7]));
  it("valide les seuils", () => {
    expect(seuilsSchema.safeParse(valides).success).toBe(true);
    const r = seuilsSchema.safeParse({ ...valides, inactivite_jours: -1, max_r2_par_jour: 1.5 });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toEqual(["RG-27 Inactivité : 0 au moins.", "RG-30 R2 par jour et par concepteur : nombre entier attendu."]);
    expect(seuilsSchema.safeParse({ ...valides, solde_non_recu_jours: 400 }).error!.issues[0].message).toBe("RG-26 Solde non reçu : 365 au plus.");
  });
  it("lit une liste, une valeur par ligne", () => {
    expect(lireListe(" cuisine \n\n dressing  sur  mesure\r\nplacard", "Types")).toEqual({ ok: true, valeurs: ["cuisine", "dressing sur mesure", "placard"] });
    expect(lireListe("\n ", "Types")).toEqual({ ok: false, message: "Types : au moins une valeur." });
    expect(lireListe("Prix\nprix", "Motifs")).toEqual({ ok: false, message: "Motifs : « prix » en double." });
    expect(lireListe("x".repeat(41), "Motifs")).toEqual({ ok: false, message: `Motifs : « ${"x".repeat(20)}… » dépasse 40 caractères.` });
    expect(lireListe(Array.from({ length: 31 }, (_, i) => `v${i}`).join("\n"), "Motifs")).toEqual({ ok: false, message: "Motifs : 30 valeurs au plus." });
  });
});
