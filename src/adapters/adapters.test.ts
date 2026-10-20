import { describe, expect, it } from "vitest";
import { DemoClock, SystemClock, dateParis } from "./clock";
import { DemoMailer, boiteEnvoiMemoire, demoFileStore } from "./demo";
import { creerAdaptateurs } from "./index";
import { NonDisponibleError } from "./types";

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

  it("signale le PCloud simulé comme prévu en J5", async () => {
    await expect(demoFileStore.lister({ dossierId: "x", sousDossier: "01" })).rejects.toBeInstanceOf(NonDisponibleError);
  });
});
