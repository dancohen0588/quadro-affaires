import { describe, expect, it } from "vitest";
import brut from "../../../process/2026-v1.json";
import { creerMoteur, type EtatAffaire, type Resultat, type Validation } from "./moteur";
import { chargerProcess } from "./valider";

const definition = chargerProcess(brut);
const MOTIFS = ["prix", "délai", "concurrent", "réflexion longue", "projet abandonné", "injoignable", "autre"];
const moteur = creerMoteur(definition, { motifsAutorises: MOTIFS });

const JOUR = "2026-10-21";
const moment = (jour = JOUR) => ({ quand: `${jour}T10:00:00+02:00`, aujourdhui: jour, par: "manon" });

function ok(r: Resultat): Extract<Resultat, { ok: true }> {
  if (!r.ok) throw new Error(`${r.erreur} : ${r.message}`);
  return r;
}
/** Valide une étape et renvoie le nouvel état ; échoue si le moteur refuse. */
function avancer(etat: EtatAffaire, etape: string, issue: string, extra: Partial<Validation> = {}): EtatAffaire {
  return ok(moteur.valider(etat, { ...moment(), etape, issue, ...extra })).etat;
}
/** Étapes ouvertes, dans l'ordre du process (R3.2 pour la deuxième itération). */
const ouvertes = (etat: EtatAffaire) => moteur.ouvertes(etat).map((e) => `${e.code}${e.iteration > 1 ? `.${e.iteration}` : ""}`);
const sansTaches = (etat: EtatAffaire): EtatAffaire => ({ ...etat, tachesOuvertes: [] });
const nouvelleAffaire = () => ok(moteur.demarrer(moment())).etat;

/** Mène une affaire du R0 jusqu'à l'étape indiquée par le chemin principal. */
function jusqua(cible: string, etat = nouvelleAffaire()): EtatAffaire {
  const chemin: [string, string, Partial<Validation>?][] = [
    ["R0", "r1_pris"], ["R1", "r2_pris"], ["R2", "conception"], ["CONCEPTION", "pret"], ["PREP_R3", "pret"], ["R3", "vente"],
    ["VENTE", "vendu"], ["ACOMPTE_1", "recu"], ["PREP_COMMANDE", "pret"], ["COMMANDE_AGEM", "envoyee"], ["ARC", "recu"],
    ["BPA", "bpa_donne"], ["BL", "fait"], ["PLANNING_LIVRAISON", "confirme"], ["DOSSIER_POSE", "complet"],
    ["MAIL_AVANT_POSE", "envoye"], ["ACOMPTE_2", "recu"], ["POSE", "ok"],
  ];
  for (const [etape, issue, extra] of chemin) {
    if (etape === cible) return etat;
    if (etape === "COMMANDE_AGEM") etat = { ...etat, acompte1Recu: true };
    if (etape === "VENTE") etat = { ...etat, statut: "gagnee" }; // RG-08 : la création de la vente passe l'affaire en « gagnee »
    etat = avancer(etat, etape, issue, extra);
  }
  return etat;
}

describe("démarrage d'une affaire", () => {
  it("ouvre R0 avec ses tâches datées, assignées au concepteur", () => {
    const r = ok(moteur.demarrer(moment()));
    expect(ouvertes(r.etat)).toEqual(["R0"]);
    const taches = r.effets.filter((e) => e.type === "creer_tache");
    expect(taches.map((t) => t.type === "creer_tache" && [t.titre, t.role, t.echeance, t.optionnelle])).toEqual([
      ["Noter le RDV ou le passage dans l'agenda", "concepteur", JOUR, false],
      ["Créer le contact, ou cocher CNQ", "concepteur", JOUR, false],
      ["Si un rappel est convenu, saisir sa date", "concepteur", JOUR, true],
    ]);
    expect(r.effets).toContainEqual({ type: "etape_courante", etape: "R0" });
    expect(r.etat.tachesOuvertes).toHaveLength(3);
  });

  it("peut démarrer au R1 quand l'affaire est créée en découverte (D3)", () => {
    expect(ouvertes(ok(moteur.demarrer(moment(), "R1")).etat)).toEqual(["R1"]);
  });
});

describe("parcours complet R0 → ARCHIVAGE", () => {
  it("mène une affaire vendue jusqu'à la clôture", () => {
    let etat = jusqua("SOLDE");
    expect(ouvertes(etat)).toEqual(["SOLDE", "R4"]); // R4 s'ouvre dès la fin de chantier (7.2)
    expect(moteur.etapeCourante(etat.etapes)).toBe("SOLDE"); // le R4 parallèle ne masque pas le solde
    etat = avancer(etat, "SOLDE", "recu");
    etat = avancer(etat, "FACTURE_RECAP", "envoyee");
    etat = avancer(etat, "R4", "fait");
    etat = avancer(etat, "RELANCE_AVIS", "fait");
    expect(ouvertes(etat)).toEqual(["ARCHIVAGE"]);
    const fin = ok(moteur.valider(etat, { ...moment(), etape: "ARCHIVAGE", issue: "archive" }));
    expect(fin.etat.statut).toBe("cloturee");
    expect(fin.effets.at(-1)).toEqual({ type: "etape_courante", etape: "ARCHIVAGE" }); // dernière étape faite
    expect(ouvertes(fin.etat)).toEqual([]);
    expect(fin.effets).toContainEqual({ type: "statut_affaire", statut: "cloturee", motif: null });
    // Toutes les étapes du chemin principal ont été faites une fois, avec leur issue.
    expect(fin.etat.etapes.every((e) => e.statut === "faite" && e.issue)).toBe(true);
    expect(fin.etat.etapes.map((e) => e.code)).toContain("ACOMPTE_2");
  });
});

describe("présentations R3.n (D4, RG-07)", () => {
  it("enchaîne R3, R3.2 et R3.3 puis la vente, en créant chaque RDV à la date choisie", () => {
    let etat = jusqua("R3");
    const r2 = ok(moteur.valider(etat, { ...moment(), etape: "R3", issue: "r3_suivant", date: "2026-10-28" }));
    expect(r2.effets).toContainEqual({ type: "creer_rdv", rdv: "R3", rang: 2, date: "2026-10-28" });
    etat = r2.etat;
    const r3 = ok(moteur.valider(etat, { ...moment(), etape: "R3", issue: "r3_suivant", date: "2026-11-04" }));
    expect(r3.effets).toContainEqual({ type: "creer_rdv", rdv: "R3", rang: 3, date: "2026-11-04" });
    etat = r3.etat;
    expect(ouvertes(etat)).toEqual(["R3.3"]);
    etat = avancer(etat, "R3", "vente");
    expect(ouvertes(etat)).toEqual(["VENTE"]);
    expect(etat.etapes.filter((e) => e.code === "R3").map((e) => [e.iteration, e.issue])).toEqual([
      [1, "r3_suivant"], [2, "r3_suivant"], [3, "vente"],
    ]);
  });

  it("exige une date à venir pour une nouvelle présentation", () => {
    const etat = jusqua("R3");
    expect(moteur.valider(etat, { ...moment(), etape: "R3", issue: "r3_suivant" })).toMatchObject({ ok: false, erreur: "date_obligatoire" });
    expect(moteur.valider(etat, { ...moment(), etape: "R3", issue: "r3_suivant", date: "2026-10-20" })).toMatchObject({ ok: false, erreur: "date_passee" });
  });
});

describe("pertes et abandons (RG-06)", () => {
  it("refuse une perte sans motif ou avec un motif hors liste", () => {
    const etat = jusqua("R3");
    expect(moteur.valider(etat, { ...moment(), etape: "R3", issue: "perdue" })).toMatchObject({ ok: false, erreur: "motif_obligatoire" });
    expect(moteur.valider(etat, { ...moment(), etape: "R3", issue: "perdue", motif: "météo" })).toMatchObject({ ok: false, erreur: "motif_inconnu" });
  });

  it("clôt une affaire perdue avec son motif, demande un avis et l'archive sans la passer en clôturée", () => {
    const r = ok(moteur.valider(jusqua("R3"), { ...moment(), etape: "R3", issue: "perdue", motif: "prix" }));
    expect(r.etat.statut).toBe("perdue");
    expect(r.effets).toContainEqual({ type: "statut_affaire", statut: "perdue", motif: "prix" });
    expect(r.effets).toContainEqual(expect.objectContaining({ type: "creer_tache", origine: "avis", role: "concepteur" })); // RG-36
    expect(ouvertes(r.etat)).toEqual(["ARCHIVAGE"]);
    const archive = ok(moteur.valider(sansTaches(r.etat), { ...moment(), etape: "ARCHIVAGE", issue: "archive" }));
    expect(archive.etat.statut).toBe("perdue");
    expect(archive.effets.some((e) => e.type === "statut_affaire")).toBe(false);
  });

  it("enregistre un abandon au R2 avec son motif", () => {
    const etat = avancer(jusqua("R2"), "R2", "abandon", { motif: "projet abandonné" });
    expect(etat.statut).toBe("abandonnee");
  });
});

describe("blocage de la commande AGEM (RG-01)", () => {
  it("refuse la commande tant que l'acompte 1 n'est pas reçu, puis l'accepte", () => {
    const etat = { ...jusqua("COMMANDE_AGEM"), acompte1Recu: false };
    expect(moteur.valider(etat, { ...moment(), etape: "COMMANDE_AGEM", issue: "envoyee" })).toMatchObject({
      ok: false, erreur: "bloquee_acompte_1", message: expect.stringMatching(/acompte 1/),
    });
    expect(ouvertes(avancer({ ...etat, acompte1Recu: true }, "COMMANDE_AGEM", "envoyee"))).toEqual(["ARC"]);
  });

  it("signale l'étape bloquée sans empêcher les autres validations", () => {
    const etat = { ...jusqua("COMMANDE_AGEM"), acompte1Recu: false };
    expect(moteur.blocage(etat, "COMMANDE_AGEM")).toMatch(/acompte 1/);
    expect(moteur.blocage(etat, "ARC")).toBeNull();
    expect(moteur.blocage({ ...etat, acompte1Recu: true }, "COMMANDE_AGEM")).toBeNull();
  });
});

describe("branche autres fournisseurs (section 7.4)", () => {
  it("s'ouvre au choix à la réception de l'acompte 1 et avance en parallèle jusqu'à sa fin de branche", () => {
    const avant = jusqua("ACOMPTE_1");
    expect(ouvertes(avancer(avant, "ACOMPTE_1", "recu"))).toEqual(["PREP_COMMANDE"]);
    expect(moteur.valider(avant, { ...moment(), etape: "ACOMPTE_1", issue: "recu", ouvrir: ["SAV"] })).toMatchObject({ ok: false, erreur: "option_inconnue" });
    let etat = avancer(avant, "ACOMPTE_1", "recu", { ouvrir: ["AF_COMMANDE"] });
    expect(ouvertes(etat)).toEqual(["PREP_COMMANDE", "AF_COMMANDE"]);
    etat = { ...etat, acompte1Recu: true };
    for (const [e, i] of [["PREP_COMMANDE", "pret"], ["COMMANDE_AGEM", "envoyee"], ["ARC", "recu"], ["AF_COMMANDE", "envoyee"]] as const) etat = avancer(etat, e, i);
    expect(ouvertes(etat)).toEqual(["BPA", "AF_AR"]); // en parallèle du BPA
    expect(moteur.etapeCourante(etat.etapes)).toBe("BPA"); // l'affichage suit le chemin principal
    for (const [e, i] of [["BPA", "bpa_donne"], ["AF_AR", "recu"], ["BL", "fait"], ["PLANNING_LIVRAISON", "confirme"], ["DOSSIER_POSE", "complet"]] as const) etat = avancer(etat, e, i);
    expect(ouvertes(etat)).toEqual(["AF_LISTE", "MAIL_AVANT_POSE"]);
    etat = avancer(avancer(etat, "AF_LISTE", "fait"), "AF_CARTONS", "fait");
    expect(ouvertes(etat)).toEqual(["MAIL_AVANT_POSE"]);
    expect(etat.etapes.find((e) => e.code === "AF_CARTONS")).toMatchObject({ statut: "faite", branche: "autres_fournisseurs" });
  });
});

describe("SAV avec recommande AGEM", () => {
  it("ouvre le SAV, repasse une commande AGEM dans la branche SAV, puis termine le chantier", () => {
    let etat = avancer(jusqua("POSE"), "POSE", "sav");
    expect(ouvertes(etat)).toEqual(["SAV"]);
    expect(moteur.etapeCourante(etat.etapes)).toBe("SAV");
    const recommande = ok(moteur.repasserCommandeSav(etat, moment()));
    etat = recommande.etat;
    expect(ouvertes(etat)).toEqual(["COMMANDE_AGEM.2", "SAV"]);
    expect(etat.etapes.find((e) => e.code === "COMMANDE_AGEM" && e.iteration === 2)?.branche).toBe("sav");
    etat = avancer(etat, "COMMANDE_AGEM", "envoyee");
    etat = avancer(etat, "ARC", "recu");
    expect(ouvertes(etat)).toEqual(["BPA.2", "SAV"]);
    etat = avancer(etat, "BPA", "bpa_donne");
    expect(ouvertes(etat)).toEqual(["SAV"]); // la recommande s'arrête au BPA : pas de nouveau BL
    etat = avancer(etat, "SAV", "sav_ok");
    expect(ouvertes(etat)).toEqual(["SOLDE", "R4"]);
  });

  it("refuse une recommande hors SAV", () => {
    expect(moteur.repasserCommandeSav(jusqua("POSE"), moment())).toMatchObject({ ok: false, erreur: "sav_non_ouvert" });
  });
});

describe("clôture : R4 avant la facture récapitulative, archivage", () => {
  it("fait le R4 pendant que le solde est attendu, mais refuse l'archivage tant qu'une branche est ouverte", () => {
    let etat = avancer(jusqua("SOLDE"), "R4", "fait");
    expect(ouvertes(etat)).toEqual(["SOLDE", "RELANCE_AVIS"]);
    etat = avancer(etat, "RELANCE_AVIS", "fait");
    expect(ouvertes(etat)).toEqual(["SOLDE", "ARCHIVAGE"]);
    expect(moteur.valider(etat, { ...moment(), etape: "ARCHIVAGE", issue: "archive" })).toMatchObject({ ok: false, erreur: "branches_ouvertes" });
    etat = avancer(avancer(etat, "SOLDE", "recu"), "FACTURE_RECAP", "envoyee");
    expect(ouvertes(etat)).toEqual(["ARCHIVAGE"]);
    expect(avancer(etat, "ARCHIVAGE", "archive").statut).toBe("cloturee");
  });

  it("archive directement après le R4 si l'avis est déjà obtenu, et ne redemande pas d'avis (RG-36)", () => {
    const etat = { ...jusqua("SOLDE"), avisObtenu: true };
    const r = ok(moteur.valider(etat, { ...moment(), etape: "R4", issue: "fait" }));
    expect(ouvertes(r.etat)).toEqual(["SOLDE", "ARCHIVAGE"]);
    const avecAvis = ok(moteur.valider({ ...jusqua("R3"), avisObtenu: true }, { ...moment(), etape: "R3", issue: "vente" }));
    expect(avecAvis.effets.some((e) => e.type === "creer_tache" && /avis Google/.test(e.titre))).toBe(false);
    const sansAvis = ok(moteur.valider(jusqua("R3"), { ...moment(), etape: "R3", issue: "vente" }));
    expect(sansAvis.effets.some((e) => e.type === "creer_tache" && /avis Google/.test(e.titre))).toBe(true);
  });
});

describe("validation d'une étape (RG-05)", () => {
  it("annule les tâches restantes de l'étape et signale les tâches obligatoires non faites", () => {
    const etat = nouvelleAffaire();
    const r = ok(moteur.valider(etat, { ...moment(), etape: "R0", issue: "r1_pris" }));
    expect(r.effets).toContainEqual({ type: "annuler_taches", etape: "R0", iteration: 1 });
    expect(r.avertissements).toEqual([
      "Tâche non faite, annulée : Noter le RDV ou le passage dans l'agenda",
      "Tâche non faite, annulée : Créer le contact, ou cocher CNQ",
    ]);
    expect(r.etat.tachesOuvertes.every((t) => t.etape !== "R0")).toBe(true);
    expect(ok(moteur.valider(sansTaches(etat), { ...moment(), etape: "R0", issue: "r1_pris" })).avertissements).toEqual([]);
  });

  it("refuse une issue inconnue, une étape non ouverte et une affaire clôturée", () => {
    const etat = nouvelleAffaire();
    expect(moteur.valider(etat, { ...moment(), etape: "R0", issue: "vente" })).toMatchObject({ ok: false, erreur: "issue_inconnue" });
    expect(moteur.valider(etat, { ...moment(), etape: "R1", issue: "r2_pris" })).toMatchObject({ ok: false, erreur: "etape_non_ouverte" });
    expect(moteur.valider({ ...etat, statut: "cloturee" }, { ...moment(), etape: "R0", issue: "r1_pris" })).toMatchObject({ ok: false, erreur: "affaire_close" });
  });

  it("garde l'étape ouverte sur une issue d'attente et crée la relance (RG-07, RG-34, RG-35)", () => {
    const r2 = ok(moteur.valider(jusqua("R2"), { ...moment(), etape: "R2", issue: "sans_reponse" }));
    expect(ouvertes(r2.etat)).toEqual(["R2"]);
    expect(r2.effets).toContainEqual(expect.objectContaining({ type: "creer_tache", origine: "relance", echeance: "2026-10-28", etape: "R2" }));
    const seuil = creerMoteur(definition, { motifsAutorises: MOTIFS, relanceSansReponseJours: 10 });
    expect(ok(seuil.valider(jusqua("R2"), { ...moment(), etape: "R2", issue: "sans_reponse" })).effets).toContainEqual(
      expect.objectContaining({ origine: "relance", echeance: "2026-10-31" }),
    );
    const r0 = ok(moteur.valider(nouvelleAffaire(), { ...moment(), etape: "R0", issue: "rappel_convenu", date: "2026-10-23" }));
    expect(ouvertes(r0.etat)).toEqual(["R0"]);
    expect(r0.effets).toContainEqual(expect.objectContaining({ type: "creer_tache", origine: "relance", echeance: "2026-10-23" }));
    expect(moteur.valider(nouvelleAffaire(), { ...moment(), etape: "R0", issue: "rappel_convenu" })).toMatchObject({ ok: false, erreur: "date_obligatoire" });
  });

  it("enregistre qui a validé, quand, et l'issue choisie", () => {
    const r = ok(moteur.valider(nouvelleAffaire(), { ...moment("2026-10-22"), etape: "R0", issue: "r1_pris" }));
    expect(r.effets[0]).toEqual({ type: "fermer_etape", etape: "R0", iteration: 1, issue: "r1_pris", motif: null, quand: "2026-10-22T10:00:00+02:00", par: "manon" });
    expect(r.etat.etapes[0]).toMatchObject({ statut: "faite", issue: "r1_pris", validePar: "manon", fin: "2026-10-22T10:00:00+02:00" });
    expect(r.etat.etapes[1]).toMatchObject({ code: "R1", statut: "en_cours", debut: "2026-10-22T10:00:00+02:00", phase: "accueil" });
  });

  it("repasse le BPA en vérification sur une nouvelle version", () => {
    const etat = avancer(jusqua("BPA"), "BPA", "nouvelle_version");
    expect(ouvertes(etat)).toEqual(["BPA.2"]);
  });

  it("date les tâches de l'étape ouverte avec les dates connues de l'affaire", () => {
    const r = ok(moteur.valider(jusqua("R1"), { ...moment(), etape: "R1", issue: "r2_pris", dates: { rdv: { R2: "2026-10-27" } } }));
    expect(r.effets).toContainEqual(expect.objectContaining({ type: "creer_tache", titre: "Point technique avec Benjamin ou Valentin", echeance: "2026-10-30" }));
  });
});

describe("clôture d'une affaire avant la vente (EF-25)", () => {
  it("saute les étapes ouvertes, annule leurs tâches, enregistre le motif et ouvre l'archivage", () => {
    const etat = jusqua("R2");
    const r = ok(moteur.clore(etat, { ...moment(), statut: "abandonnee", motif: "projet abandonné" }));
    expect(r.effets.slice(0, 3)).toEqual([
      { type: "sauter_etape", etape: "R2", iteration: 1, motif: "projet abandonné", quand: "2026-10-21T10:00:00+02:00", par: "manon" },
      { type: "annuler_taches", etape: "R2", iteration: 1 },
      { type: "statut_affaire", statut: "abandonnee", motif: "projet abandonné" },
    ]);
    expect(r.etat.statut).toBe("abandonnee");
    expect(ouvertes(r.etat)).toEqual(["ARCHIVAGE"]);
    expect(r.etat.etapes.find((e) => e.code === "R2")).toMatchObject({ statut: "sautee", motif: "projet abandonné" });
    expect(r.etat.tachesOuvertes.every((t) => t.etape === "ARCHIVAGE")).toBe(true);
  });

  it("refuse sans motif, avec un motif inconnu, après la vente ou sur une affaire déjà close", () => {
    const etat = jusqua("R3");
    expect(moteur.clore(etat, { ...moment(), statut: "perdue", motif: "" })).toMatchObject({ ok: false, erreur: "motif_obligatoire" });
    expect(moteur.clore(etat, { ...moment(), statut: "perdue", motif: "météo" })).toMatchObject({ ok: false, erreur: "motif_inconnu" });
    expect(moteur.clore(jusqua("ACOMPTE_1"), { ...moment(), statut: "perdue", motif: "prix" })).toMatchObject({ ok: false, erreur: "cloture_impossible" });
    expect(moteur.clore({ ...etat, statut: "perdue" }, { ...moment(), statut: "perdue", motif: "prix" })).toMatchObject({ ok: false, erreur: "affaire_close" });
  });
});
