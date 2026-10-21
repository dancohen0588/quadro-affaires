import { describe, expect, it } from "vitest";
import { DemoClock, SystemClock, dateParis } from "./clock";
import { DOSSIER_VIDE, DemoAuth, DemoFileStore, DemoMailer, boiteEnvoiMemoire, comptesMemoire, stockageMemoire } from "./demo";
import { CompteExistantError } from "./types";
import { creerAdaptateurs } from "./index";

describe("Clock", () => {
  it("donne la date de Paris, y compris autour de minuit UTC et du changement d'heure", () => {
    expect(dateParis(new Date("2026-10-20T22:30:00Z"))).toBe("2026-10-21"); // 00 h 30 à Paris (UTC+2)
    expect(dateParis(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25"); // 23 h 30 à Paris (UTC+1, heure d'hiver)
  });

  it("décale l'heure système du réglage de démo, comme app_now()", async () => {
    const fixe = { now: async () => new Date("2026-10-30T06:00:00Z"), today: async () => "2026-10-30" };
    const troisJours = new DemoClock(async () => 3 * 86400, fixe);
    expect(await troisJours.now()).toEqual(new Date("2026-11-02T06:00:00Z"));
    expect(await troisJours.today()).toBe("2026-11-02");
    expect(await new DemoClock(async () => 0, fixe).today()).toBe("2026-10-30");
    const reelle = await new DemoClock(async () => 0).now();
    expect(Math.abs(reelle.getTime() - Date.now())).toBeLessThan(1000);
    expect(await new SystemClock().today()).toBe(dateParis(new Date()));
  });
});

describe("Mailer démo", () => {
  it("enregistre le mail dans la boîte d'envoi sans l'envoyer", async () => {
    const boite = boiteEnvoiMemoire();
    const mailer = new DemoMailer(boite.enregistrer);
    const { id } = await mailer.envoyer({
      destinataireId: null,
      destinataireEmail: "valentin@exemple.test",
      type: "planning",
      objet: "Nouvelle demande de planning",
      html: "<p>…</p>",
    });
    expect(id).toBe("mail-1");
    expect(boite.mails).toHaveLength(1);
    expect(boite.mails[0].type).toBe("planning");
  });
});

describe("AuthAdapter démo : comptes des utilisateurs ajoutés (EF-100)", () => {
  it("crée un compte par adresse (normalisée), refuse un doublon, annule un compte", async () => {
    const port = comptesMemoire();
    const auth = new DemoAuth(port);
    const { id } = await auth.creerCompte({ email: " Nina@Magasin-Quadro.fr", prenom: "Nina", nom: "" });
    expect(port.comptes.get(id)?.email).toBe("nina@magasin-quadro.fr");
    await expect(auth.creerCompte({ email: "nina@magasin-quadro.fr", prenom: "Nina", nom: "" })).rejects.toBeInstanceOf(CompteExistantError);
    await auth.annulerCompte(id);
    expect(port.comptes.size).toBe(0);
  });
});

describe("sélection des adaptateurs (section 5.4)", () => {
  it("fournit les implémentations démo en mode démo", () => {
    const a = creerAdaptateurs("demo");
    expect(a.auth.methode).toBe("personnage");
    expect(a.clock).toBeInstanceOf(DemoClock);
  });

  it("annonce le bloc de branchement des adaptateurs réels non livrés", () => {
    const a = creerAdaptateurs("production");
    expect(a.clock).toBeInstanceOf(SystemClock);
    expect(() => a.auth).toThrow(/B1/);
    expect(() => a.mailer).toThrow(/B2/);
    expect(() => a.fileStore).toThrow(/B3/);
    expect(() => a.calendar).toThrow(/B5/);
  });

  it("PCloud simulé : copie du modèle, dépôt sans écrasement, liste et lien (section 13.4)", async () => {
    const stockage = stockageMemoire();
    const pcloud = new DemoFileStore(stockage);
    const dossier = await pcloud.creerDossierClient({ chemin: "VAL/ROUX - Cuisine (Clara)", sousDossiers: ["01 - Données d'Entrée", "05 - Commande AGEM / Commande AGEM"] });
    expect(dossier).toEqual({ id: "VAL/ROUX - Cuisine (Clara)", url: null });
    expect([...stockage.fichiers.keys()]).toEqual([
      `VAL/ROUX - Cuisine (Clara)/01 - Donnees d'Entree/${DOSSIER_VIDE}`,
      `VAL/ROUX - Cuisine (Clara)/05 - Commande AGEM/Commande AGEM/${DOSSIER_VIDE}`,
    ]);
    const depot = (nomFinal: string) => pcloud.deposer({ dossierId: dossier.id, sousDossier: "05 - Commande AGEM / Commande AGEM", nomFinal, contenu: new Blob(["x"]) });
    expect(await depot("Débit.docx")).toEqual({ id: "VAL/ROUX - Cuisine (Clara)/05 - Commande AGEM/Commande AGEM/Debit.docx", nomFinal: "Débit.docx", cheminRelatif: "05 - Commande AGEM/Commande AGEM/Débit.docx" });
    expect((await depot("Débit.docx")).nomFinal).toBe("Débit (2).docx");
    expect((await depot("README")).nomFinal).toBe("README");
    expect((await depot("README")).nomFinal).toBe("README (2)");
    expect(await pcloud.lister({ dossierId: dossier.id, sousDossier: "05 - Commande AGEM / Commande AGEM" })).toEqual(["Debit.docx", "Debit (2).docx", "README", "README (2)"]);
    expect(await pcloud.lien({ fichierId: "VAL/ROUX - Cuisine (Clara)/05 - Commande AGEM/Commande AGEM/Debit.docx" })).toMatch(/^memoire:/);
    expect(await pcloud.lien({ fichierId: "absent" })).toBeNull();
  });
});
