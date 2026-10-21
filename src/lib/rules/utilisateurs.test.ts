import { describe, expect, it } from "vitest";
import { DOMAINE_QUADRO, domaineDe, initialesDe, nouvelUtilisateurSchema } from "./utilisateurs";

const DEMO = "demo.quadro-affaires.test";
const schema = nouvelUtilisateurSchema([DOMAINE_QUADRO, DEMO]);
const base = { prenom: "Sophie", nom: "Martin", email: "sophie.martin@magasin-quadro.fr", role: "conceptrice", magasins: ["CIO"], rubriques: [] };

describe("initiales (pastilles)", () => {
  it("prénom et nom, prénom composé, prénom seul, comme les personnages", () => {
    expect(initialesDe("Jean", "Farhat")).toBe("JF");
    expect(initialesDe("Lisa-Marie", "")).toBe("LM");
    expect(initialesDe("Clara", "")).toBe("CL");
    expect(initialesDe("Léa", "")).toBe("LÉ");
    expect(initialesDe("  élodie ", "d'Arc")).toBe("ÉD");
    expect(initialesDe("", "")).toBe("?");
  });
});

describe("ajout d'un utilisateur (EF-100)", () => {
  it("accepte une conceptrice du domaine du groupe et normalise l'adresse", () => {
    const r = schema.parse({ ...base, email: "  Sophie.Martin@Magasin-Quadro.fr " });
    expect(r).toMatchObject({ email: "sophie.martin@magasin-quadro.fr", initiales: "SM", rubriques: [] });
  });

  it("refuse une adresse hors des domaines acceptés", () => {
    const r = schema.safeParse({ ...base, email: "sophie@gmail.com" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/magasin-quadro\.fr/);
    expect(nouvelUtilisateurSchema([DOMAINE_QUADRO]).safeParse({ ...base, email: `x@${DEMO}` }).success).toBe(false);
    expect(domaineDe("sans-arobase")).toBe("");
  });

  it("exige un prénom, un rôle connu et au moins un magasin", () => {
    expect(schema.safeParse({ ...base, prenom: "  " }).error?.issues[0].message).toBe("Indiquez le prénom.");
    expect(schema.safeParse({ ...base, role: "stagiaire" }).success).toBe(false);
    expect(schema.safeParse({ ...base, magasins: [] }).error?.issues[0].message).toMatch(/au moins un magasin/);
  });

  it("rubriques : obligatoires pour une transverse, retirées pour les autres rôles", () => {
    expect(schema.safeParse({ ...base, role: "transverse" }).error?.issues[0].message).toMatch(/rubrique/);
    expect(schema.parse({ ...base, role: "transverse", rubriques: ["r4_avis"] }).rubriques).toEqual(["r4_avis"]);
    expect(schema.parse({ ...base, role: "gerant", rubriques: ["r4_avis"] }).rubriques).toEqual([]);
  });
});
