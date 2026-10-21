import { describe, expect, it } from "vitest";
import { LIBELLES_ROLES, decrireEcheance } from "./lecture";

describe("lecture du modèle de process", () => {
  it("décrit les échéances des tâches modèles", () => {
    expect(decrireEcheance({ depuis: "ouverture_etape", jours: 3, ouvres: true })).toBe("3 jours ouvrés après l'ouverture de l'étape");
    expect(decrireEcheance({ depuis: "ouverture_etape", jours: 1, ouvres: true })).toBe("1 jour ouvré après l'ouverture de l'étape");
    expect(decrireEcheance({ depuis: "ouverture_etape", jours: 0 })).toBe("à l'ouverture de l'étape");
    expect(decrireEcheance({ depuis: "rdv", rdv: "R3", jours: -1 })).toBe("1 jour avant le R3");
    expect(decrireEcheance({ depuis: "rdv", jours: 2 })).toBe("2 jours après le RDV de l'étape");
    expect(decrireEcheance({ depuis: "rdv", jours: 0 })).toBe("le jour du RDV");
    expect(decrireEcheance({ depuis: "aucune" })).toBe("à réception");
    expect(decrireEcheance({ premiere_de: [{ depuis: "ouverture_etape", jours: 5 }, { depuis: "date_pose", jours: -7 }] }))
      .toBe("au plus tôt de : 5 jours après l'ouverture de l'étape ; 7 jours avant la pose");
    expect(LIBELLES_ROLES.gerant_bpa).toBe("Gérant BPA");
  });
});
