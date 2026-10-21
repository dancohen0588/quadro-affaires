import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { DOMAINE_DEMO } from "../demo/personnages";
import { creerMoteur } from "../process/moteur";
import { chargerProcess } from "../process/valider";
import { affaireExistante, cheminPrincipal, cleClient, colonnesManquantes, lireDate, lireSemaine, planifierLigne, type ContexteImport } from "./affaires";
import { decouperCsv, lireCsv } from "./csv";

const definition = chargerProcess(brut);
const moteur = creerMoteur(definition, { motifsAutorises: ["prix"] });

function contexte(): ContexteImport {
  let n = 0;
  const p = (prenom: string, magasins: string[], role = "conceptrice") => ({ id: `p-${prenom}`, prenom, magasins, role });
  return {
    aujourdhui: "2026-10-21", moteur, processVersionId: "pv",
    magasins: { AIX: { id: "m-aix", code: "AIX" }, VAL: { id: "m-val", code: "VAL" }, CIO: { id: "m-cio", code: "CIO" } },
    concepteurs: {
      [`alexia@${DOMAINE_DEMO}`]: p("Alexia", ["AIX"]), [`lisa-marie@${DOMAINE_DEMO}`]: p("Lisa-Marie", ["AIX"]),
      [`clara@${DOMAINE_DEMO}`]: p("Clara", ["VAL"]), [`lea@${DOMAINE_DEMO}`]: p("Léa", ["VAL"]), [`jean@${DOMAINE_DEMO}`]: p("Jean", ["VAL", "CIO"], "gerant"),
    },
    referents: { gerant_bpa: "p-benjamin", gerant_logistique: "p-valentin", gerant_finance: "p-jean" },
    projets: ["cuisine", "dressing", "placard", "bibliothèque", "bureau"],
    affairesExistantes: new Set(), clientsExistants: new Map(),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  };
}

const exemple = lireCsv(readFileSync("docs/import/affaires-exemple.csv", "utf8"));

describe("CSV de reprise (section 13.1)", () => {
  it("découpe les champs, guillemets et sauts de ligne compris", () => {
    expect(decouperCsv('﻿a;b\r\n"x;y";"il dit ""oui""\nfin"\r\n\r\n;\n')).toEqual([["a", "b"], ["x;y", 'il dit "oui"\nfin']]);
    expect(decouperCsv("a;b\nc;d")).toEqual([["a", "b"], ["c", "d"]]);
    expect(lireCsv("A ; B\n1;\n").lignes).toEqual([{ numero: 2, valeurs: { a: "1", b: "" } }]);
    expect(lireCsv("").lignes).toEqual([]);
  });

  it("vérifie les colonnes, lit dates et semaines", () => {
    expect(colonnesManquantes(exemple.entetes)).toEqual([]);
    expect(colonnesManquantes(["magasin"])).toContain("etape_code");
    expect(lireDate("16/10/2026")).toBe("2026-10-16");
    expect(lireDate("2026-02-30")).toBe("invalide");
    expect(lireDate("demain")).toBe("invalide");
    expect(lireDate("")).toBeNull();
    expect(lireSemaine("44 / 2026")).toBe("2026-S44");
    expect(lireSemaine("2026-S7")).toBe("2026-S07");
    expect(lireSemaine("S60/2026")).toBe("invalide");
    expect(lireSemaine("")).toBeNull();
  });

  it("suit le chemin principal du process", () => {
    const c = cheminPrincipal(definition).map((x) => x.code);
    expect(c.slice(0, 7)).toEqual(["R0", "R1", "R2", "CONCEPTION", "PREP_R3", "R3", "VENTE"]);
    expect(c.at(-1)).toBe("FACTURE_RECAP");
  });
});

describe("plan d'import", () => {
  it("positionne chaque ligne du fichier d'exemple à son étape", () => {
    const ctx = contexte();
    const r = exemple.lignes.map((l) => planifierLigne(l.numero, l.valeurs, ctx));
    expect(r.filter((x) => !x.ok)).toEqual([]);
    const plans = r.map((x) => (x.ok ? x.plan : null)!);
    expect(plans.map((p) => [p.affaire.etape_courante_code, p.affaire.statut])).toEqual([
      ["R1", "active"], ["R2", "active"], ["CONCEPTION", "active"], ["R3", "active"], ["ACOMPTE_1", "gagnee"],
      ["COMMANDE_AGEM", "gagnee"], ["PLANNING_LIVRAISON", "gagnee"], ["SOLDE", "gagnee"],
    ]);
    // Étapes antérieures faites, tâches des seules étapes ouvertes, toutes à faire.
    const commande = plans[5];
    expect(commande.etapes.filter((e) => e.statut === "en_cours").map((e) => e.etape_code)).toEqual(["COMMANDE_AGEM"]);
    expect(commande.etapes.filter((e) => e.statut === "faite")).toHaveLength(9);
    expect(commande.taches.every((t) => t.statut === "a_faire")).toBe(true);
    expect(new Set(commande.taches.map((t) => t.etape_instance_id))).toEqual(new Set(commande.etapes.filter((e) => e.statut === "en_cours").map((e) => e.id)));
    // Vente, échéancier 40 / 50 / 10 et règlements reçus (RG-10).
    expect(commande.vente).toMatchObject({ montant_ht_cts: 1_840_000, montant_ttc_cts: 2_208_000, date_signature: "2026-09-30", gesteos_devis_ref: "D20260930#4372" });
    expect(commande.echeances.map((e) => [e.type, e.montant_prevu_cts, e.recu_le, e.date_attendue])).toEqual([
      ["acompte_1", 883_200, "2026-10-02", "2026-09-30"], ["acompte_2", 1_104_000, null, "2026-11-09"], ["solde", 220_800, null, "2026-11-18"],
    ]);
    expect(commande.planning).toMatchObject({ statut: "confirmee", semaine_livraison_confirmee: "2026-S46", date_pose_confirmee: "2026-11-18" });
    expect(commande.affaire).toMatchObject({ contremarque: "FABRE CUISINE", libelle: "FABRE Luc · Cuisine", pcloud_folder_id: "AIX/FABRE Luc - Cuisine (Alexia)" });
    // RDV : faits au passé, prévu au futur ; client professionnel.
    expect(plans[3].rdv.map((x) => [x.type, x.statut])).toEqual([["R1", "fait"], ["R2", "fait"], ["R3", "prevu"]]);
    expect(plans[3].client).toMatchObject({ type: "professionnel", raison_sociale: "SARL Atelier Delmas" });
    expect(plans[7].echeances.map((e) => e.recu_le)).toEqual(["2026-07-30", "2026-09-28", null]);
    expect(plans[4].planning).toBeNull();
    expect(plans[0].vente).toBeNull();
  });

  it("refuse les lignes fautives avec leurs motifs", () => {
    const ctx = contexte();
    const base = exemple.lignes[5].valeurs;
    const motifs = (v: Record<string, string>) => {
      const r = planifierLigne(9, { ...base, ...v }, ctx);
      return r.ok ? [] : r.motifs;
    };
    expect(motifs({ magasin: "PAR", concepteur_email: "x@y.test", client_type: "pro", client_nom: "", projet: "véranda", etape_code: "SAV" })).toEqual([
      "Magasin inconnu : « PAR ».", "Concepteur inconnu ou inactif : « x@y.test ».", "client_type : particulier ou professionnel.", "Nom du client manquant.",
      "Projet inconnu : « véranda » (cuisine, dressing, placard, bibliothèque, bureau).", "Étape inconnue ou hors du chemin principal : « SAV ».",
    ]);
    expect(motifs({ concepteur_email: `clara@${DOMAINE_DEMO}` })).toEqual(["Clara n'est pas rattachée au magasin AIX."]);
    expect(motifs({ client_type: "professionnel", raison_sociale: "" })).toEqual(["Raison sociale manquante pour un client professionnel."]);
    expect(motifs({ date_signature: "", montant_vente_ht: "", acompte1_recu_le: "" })).toEqual([
      "Date de signature manquante pour une affaire vendue.", "Montants HT et TTC de la vente manquants pour une affaire vendue.",
      "Acompte 1 non reçu : l'affaire ne peut pas dépasser l'étape Règlement acompte 1 (RG-01).",
    ]);
    expect(motifs({ montant_vente_ttc: "100,00" })).toEqual(["Montant TTC inférieur au HT."]);
    expect(motifs({ date_r1: "2026-13-01", date_r2: "2026-12-01", semaine_livraison: "S99", montant_devis_ht: "beaucoup" })).toEqual([
      "date_r1 : date illisible « 2026-13-01 » (AAAA-MM-JJ ou JJ/MM/AAAA).", "date_r2 : date future.",
      "semaine_livraison illisible « S99 » (2026-S44).", "montant_devis_ht : montant illisible « beaucoup ».",
    ]);
    expect(motifs({ date_r2: "2026-08-01" })).toEqual(["Dates incohérentes : R1, R2, R3 et signature doivent se suivre."]);
  });

  it("ne crée jamais deux fois la même affaire, reprend un client connu", () => {
    const ctx = contexte();
    const ligne = exemple.lignes[0].valeurs;
    expect(planifierLigne(2, ligne, ctx).ok).toBe(true);
    expect(planifierLigne(3, ligne, ctx)).toEqual({ numero: 3, ok: false, motifs: ["Déjà présente : ARMAND Sophie · cuisine dans AIX."] });
    const autre = planifierLigne(4, { ...ligne, projet: "dressing" }, ctx);
    expect(autre.ok && autre.plan.client).toBeNull();
    expect(autre.ok && autre.plan.clientExistant).toBe("00000000-0000-4000-8000-000000000001");
    expect(affaireExistante("m", "Élan  ", "Cuisine")).toBe(affaireExistante("m", "ELAN", "cuisine"));
    expect(cleClient("m", "Roux", "06 39 98 00 01")).toBe("m|ROUX|0639980001");
  });

  it("signale une affaire que le moteur ne peut pas positionner", () => {
    const ctx = { ...contexte(), moteur: { ...moteur, valider: () => ({ ok: false, message: "refus" }) } as unknown as typeof moteur };
    const r = planifierLigne(2, exemple.lignes[1].valeurs, ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motifs[0]).toMatch(/^Positionnement impossible : /);
  });
});
