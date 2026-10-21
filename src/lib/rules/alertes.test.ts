import { describe, expect, it } from "vitest";
import { destinatairesAlerte, rappelsNotes, tachesDAlertes, type AlerteNuit } from "./alertes";

const r = { gerants: ["jean", "valentin", "benjamin"], gerantBpa: "benjamin", gerantLogistique: "valentin", gerantFinance: "jean" };
const alerte = (regle: string, detail = "", concepteur_id: string | null = "manon"): AlerteNuit =>
  ({ affaire_id: "a1", concepteur_id, regle, gravite: 1, depuis: "2026-10-13", detail });

describe("effets des alertes (section 8.4)", () => {
  it("prévient les bonnes personnes", () => {
    expect(destinatairesAlerte(alerte("RG-20"), r)).toEqual(["manon"]);
    expect(destinatairesAlerte(alerte("RG-21"), r)).toEqual(["benjamin", "jean", "valentin"]);
    expect(destinatairesAlerte(alerte("RG-24"), r)).toEqual(["manon", "jean"]);
    expect(destinatairesAlerte(alerte("RG-28"), r)).toEqual(["valentin", "manon"]);
    expect(destinatairesAlerte(alerte("RG-27", "", null), r)).toEqual([]);
    expect(destinatairesAlerte(alerte("RG-99"), r)).toEqual(["manon"]);
    expect(destinatairesAlerte(alerte("RG-24"), { ...r, gerantFinance: null })).toEqual(["manon"]);
  });

  it("crée une tâche par épisode pour RG-20, RG-22 et RG-23", () => {
    const t = tachesDAlertes([
      alerte("RG-20"), alerte("RG-22"), alerte("RG-23", "AR Hettich attendu depuis 6 jours ouvrés"), alerte("RG-23", "AR ?"),
      alerte("RG-24"), alerte("RG-22", "", null),
    ], "2026-10-22");
    expect(t.map((x) => [x.cle, x.titre])).toEqual([
      ["RG-20:a1:2026-10-13", "Relancer le projet"],
      ["RG-22:a1:2026-10-13", "Relancer AGEM : ARC non reçu"],
      ["RG-23:a1:2026-10-13", "Relancer Hettich : AR non reçu"],
      ["RG-23:a1:2026-10-13", "Relancer le fournisseur : AR non reçu"],
    ]);
    expect(t[0]).toMatchObject({ assignee_id: "manon", echeance: "2026-10-22", origine: "alerte", modele_code: "RG-20" });
    expect(tachesDAlertes([{ ...alerte("RG-22"), depuis: null }], "2026-10-22")[0].cle).toBe("RG-22:a1:");
  });

  it("rappelle les notes d'un RDV fait la veille (RG-32), sur 7 jours au plus", () => {
    const rdv = (id: string, jour: string) => ({ id, type: "R2", jour, profil_id: "manon", affaire_id: "a1", client_id: "c1" });
    const t = rappelsNotes([rdv("hier", "2026-10-21"), rdv("jour", "2026-10-22"), rdv("vieux", "2026-10-14"), rdv("limite", "2026-10-15")], "2026-10-22");
    expect(t.map((x) => x.cle)).toEqual(["RG-32:hier", "RG-32:limite"]);
    expect(t[0]).toMatchObject({ titre: "Noter le compte rendu du R2", origine: "relance", assignee_id: "manon" });
  });
});
