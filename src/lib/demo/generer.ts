/**
 * Jeu de données de la démonstration (session 1.4, docs/conception.md sections 15.3 et 15.5).
 *
 * Déterministe (graine fixe) et relatif au jour du seed : relancer `pnpm seed:demo` la veille d'une
 * présentation remet les mêmes affaires aux mêmes étapes, avec des dates recalées sur ce jour.
 *   - environ 6 mois d'historique : ventes clôturées, affaires perdues avec motif, contacts CNQ ;
 *   - environ 75 affaires actives réparties sur les 6 phases, comme dans la maquette Pipeline ;
 *   - les cas imposés par la section 15.3 (voir `CAS_DEMO`), utilisés par le scénario de la section 15.5.
 * Fonction pure : renvoie des lignes au format des tables, l'écriture en base est faite par le seed.
 */
import type { Database } from "../db/types";
import { instantParis } from "../format";
import { creerMoteur } from "../process/moteur";
import type { ProcessDefinition, Role } from "../process/schema";
import { indexerEtapes } from "../process/valider";
import { contremarqueParDefaut, libelleAffaire, type ClientIdentite } from "../rules/affaire";
import { ajouterJours, ajouterJoursOuvres, estJourOuvre, jourDeSemaine, semaineIso, type DateIso } from "../rules/calendrier";
import { genererEcheancier } from "../rules/echeancier";
import { creerAlea } from "./aleatoire";
import { COMMUNES, NOMS, PRENOMS, RAISONS_SOCIALES, RUES, emailFictif, telephoneFictif } from "./noms";
import type { CodeMagasin } from "./personnages";
import { rejouerAffaire, type Pas } from "./rejouer";

type Insert<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Insert"];

export const GRAINE_DEMO = 20261027;

/** Cas imposés par la section 15.3, retrouvables par le scénario de démo et par les tests. */
export const CAS_DEMO = [
  "r3n_en_cours", // 3 présentations R3.n en cours
  "arc_en_retard", // 2 ARC en retard (RG-22)
  "bpa_en_retard", // 1 BPA en retard (RG-21)
  "acompte_1_non_recu", // 2 acomptes 1 non reçus (RG-24)
  "acompte_2_en_retard", // 1 acompte 2 en retard (RG-25)
  "acompte_2_apres_3_jours", // 1 acompte 2 qui passe en retard quand on avance l'horloge de 3 jours (scénario n° 8)
  "retard_commerce", // 2 retards commerce, R1 + 14 j (RG-20)
  "sav_ouvert", // 1 SAV ouvert
  "client_professionnel", // 1 client professionnel (D24)
  "client_qui_revient", // 1 client qui revient avec une 2e affaire (D1)
  "jean_concepteur", // 1 affaire dont Jean est le concepteur (D25)
  "branche_autres_fournisseurs", // 1 commande autres fournisseurs en parallèle du BPA (section 7.4)
  "vente_multi_affaires", // 1 vente qui regroupe deux affaires (D1)
  "manon_r2_aujourdhui", // la journée de Manon (scénario n° 1)
] as const;
export type CasDemo = (typeof CAS_DEMO)[number];

export type EntreeJeu = {
  aujourdhui: DateIso;
  definition: ProcessDefinition;
  processVersionId: string;
  /** Identifiants des profils par clé de personnage (jean, manon…). */
  profils: Record<string, string>;
  magasins: Record<CodeMagasin, string>;
  graine?: number;
};

export type JeuDemo = {
  clients: Insert<"client">[];
  ventes: Insert<"vente">[];
  affaires: Insert<"affaire">[];
  echeances: Insert<"echeance">[];
  rdv: Insert<"rdv">[];
  etapes: Insert<"etape_instance">[];
  taches: Insert<"tache">[];
  commandes: Insert<"commande_fournisseur">[];
  plannings: Insert<"planning">[];
  cas: Record<CasDemo, string[]>;
};

/** Chemin principal du process 2026 v1, dans l'ordre (la branche autres fournisseurs, le SAV et R4 sont gérés à part). */
const CHEMIN = [
  "R0", "R1", "R2", "CONCEPTION", "PREP_R3", "R3", "VENTE", "ACOMPTE_1", "PREP_COMMANDE", "COMMANDE_AGEM",
  "ARC", "BPA", "BL", "PLANNING_LIVRAISON", "DOSSIER_POSE", "MAIL_AVANT_POSE", "ACOMPTE_2", "POSE", "SOLDE", "FACTURE_RECAP",
] as const;
type CodeChemin = (typeof CHEMIN)[number];

/** Durée typique (jours) passée dans chaque étape. R1 → vente reste sous les 14 jours de RG-20. */
const DUREES: Record<CodeChemin, number> = {
  R0: 2, R1: 5, R2: 4, CONCEPTION: 3, PREP_R3: 2, R3: 2, VENTE: 0, ACOMPTE_1: 2, PREP_COMMANDE: 2, COMMANDE_AGEM: 1,
  ARC: 4, BPA: 3, BL: 2, PLANNING_LIVRAISON: 2, DOSSIER_POSE: 4, MAIL_AVANT_POSE: 14, ACOMPTE_2: 5, POSE: 3, SOLDE: 7,
  FACTURE_RECAP: 3,
};
const ECART_R3N = 4; // jours entre deux présentations R3.n
const BRANCHE_AF = [["AF_COMMANDE", 2], ["AF_AR", 5], ["AF_LISTE", 2], ["AF_CARTONS", 7]] as const;

const PROJETS = [
  ["cuisine", 38, 8_000, 25_000],
  ["dressing", 24, 3_000, 9_000],
  ["placard", 12, 1_800, 5_000],
  ["bibliothèque", 8, 2_500, 7_000],
  ["entrée", 7, 1_500, 4_000],
  ["bureau", 6, 2_000, 6_000],
  ["salle de bain", 5, 4_000, 10_000],
] as const;
type Projet = (typeof PROJETS)[number][0];

const MOTIFS_R3 = [["prix", 35], ["concurrent", 20], ["réflexion longue", 20], ["délai", 10], ["injoignable", 10], ["autre", 5]] as const;
const SOURCES = [["passage", 30], ["recommandation", 20], ["internet", 25], ["réseaux sociaux", 10], ["salon", 5], ["autre", 10]] as const;

/** Affaires actives par magasin et par étape courante (≈ maquette Pipeline). */
const ACTIVES: Record<CodeMagasin, readonly (readonly [string, number])[]> = {
  CIO: [["R0", 2], ["R1", 3], ["R2", 2], ["CONCEPTION", 2], ["PREP_R3", 1], ["R3", 3], ["ACOMPTE_1", 1], ["PREP_COMMANDE", 1],
        ["COMMANDE_AGEM", 1], ["ARC", 1], ["BPA", 2], ["BL", 1], ["PLANNING_LIVRAISON", 1], ["DOSSIER_POSE", 1],
        ["MAIL_AVANT_POSE", 1], ["ACOMPTE_2", 1], ["SOLDE", 1]],
  VAL: [["R0", 2], ["R1", 4], ["R2", 2], ["CONCEPTION", 2], ["PREP_R3", 1], ["R3", 3], ["ACOMPTE_1", 1], ["PREP_COMMANDE", 1],
        ["COMMANDE_AGEM", 1], ["ARC", 2], ["BPA", 1], ["BL", 1], ["DOSSIER_POSE", 1], ["MAIL_AVANT_POSE", 1], ["ACOMPTE_2", 1],
        ["SAV", 1], ["SOLDE", 1], ["FACTURE_RECAP", 1]],
  AIX: [["R0", 1], ["R1", 2], ["R2", 1], ["CONCEPTION", 2], ["PREP_R3", 1], ["R3", 2], ["ACOMPTE_1", 1], ["PREP_COMMANDE", 1],
        ["COMMANDE_AGEM", 1], ["ARC", 1], ["BPA", 2], ["BL", 1], ["PLANNING_LIVRAISON", 1], ["DOSSIER_POSE", 2],
        ["MAIL_AVANT_POSE", 1], ["POSE", 1], ["ACOMPTE_2", 1], ["SOLDE", 1]],
};

const CONCEPTEURS: Record<CodeMagasin, readonly (readonly [string, number])[]> = {
  AIX: [["alexia", 50], ["lisa-marie", 50]],
  VAL: [["clara", 45], ["lea", 45], ["jean", 10]],
  CIO: [["manon", 50], ["eva", 50]],
};

/** Cas imposés : magasin, étape courante, rang parmi les affaires de cette étape, réglages. */
type Reglage = { cas?: CasDemo; age?: number; concepteur?: string; iterationsR3?: number; rdvDans?: number };
const REGLAGES: Record<string, Reglage[]> = {
  "CIO:R2:0": [{ cas: "manon_r2_aujourdhui", concepteur: "manon", age: 2 }],
  "CIO:R3:0": [{ cas: "r3n_en_cours", concepteur: "manon", iterationsR3: 2, age: 4 }],
  "CIO:R3:1": [{ cas: "manon_r2_aujourdhui", concepteur: "manon", age: 1 }],
  "CIO:R3:2": [{ cas: "manon_r2_aujourdhui", concepteur: "manon", age: 0 }],
  // Semaine de Manon à 4 R3 sur 4 (RG-31) : ces deux affaires vont à Eva.
  "CIO:PREP_R3:0": [{ concepteur: "eva" }],
  "CIO:PREP_COMMANDE:0": [{ concepteur: "eva" }],
  "VAL:R3:0": [{ cas: "r3n_en_cours", concepteur: "clara", iterationsR3: 2, age: 5 }],
  "AIX:R3:0": [{ cas: "r3n_en_cours", concepteur: "alexia", iterationsR3: 2, age: 5 }],
  "VAL:ARC:0": [{ cas: "arc_en_retard", age: 8 }],
  "AIX:ARC:0": [{ cas: "arc_en_retard", age: 10 }],
  "CIO:BPA:0": [{ cas: "bpa_en_retard", age: 7 }],
  "CIO:ACOMPTE_1:0": [{ cas: "acompte_1_non_recu", concepteur: "manon", age: 5 }],
  "AIX:ACOMPTE_1:0": [{ cas: "acompte_1_non_recu", age: 7 }],
  "AIX:ACOMPTE_2:0": [{ cas: "acompte_2_en_retard", age: 7 }],
  "VAL:ACOMPTE_2:0": [{ cas: "acompte_2_apres_3_jours", age: 2 }],
  "CIO:CONCEPTION:0": [{ cas: "retard_commerce", concepteur: "eva", age: 13 }],
  "VAL:CONCEPTION:0": [{ cas: "retard_commerce", concepteur: "lea", age: 16 }],
  "VAL:SAV:0": [{ cas: "sav_ouvert" }],
  "AIX:DOSSIER_POSE:0": [{ cas: "client_professionnel" }],
  "CIO:R1:0": [{ cas: "client_qui_revient" }],
  "VAL:BPA:0": [{ cas: "jean_concepteur", concepteur: "jean" }],
  "AIX:BPA:0": [{ cas: "branche_autres_fournisseurs" }],
  "CIO:PLANNING_LIVRAISON:0": [{ cas: "vente_multi_affaires" }],
};

export function genererJeuDemo(entree: EntreeJeu): JeuDemo {
  const a = creerAlea(entree.graine ?? GRAINE_DEMO);
  const j0 = entree.aujourdhui;
  const def = entree.definition;
  const index = indexerEtapes(def);
  const moteur = creerMoteur(def, { motifsAutorises: [...MOTIFS_R3.map(([m]) => m), "projet abandonné"] });
  const p = entree.profils;
  const referents: Record<Exclude<Role, "concepteur">, string> = {
    gerant_bpa: p.benjamin,
    gerant_logistique: p.valentin,
    gerant_finance: p.jean,
    responsable_r4: p.elsie,
  };

  const jeu: JeuDemo = {
    clients: [], ventes: [], affaires: [], echeances: [], rdv: [], etapes: [], taches: [], commandes: [], plannings: [],
    cas: Object.fromEntries(CAS_DEMO.map((c) => [c, [] as string[]])) as Record<CasDemo, string[]>,
  };
  let numero = 0;
  let numeroDevis = 4300;
  let numeroCommande = 700;
  const clientsHistoriques: Record<CodeMagasin, Insert<"client">[]> = { AIX: [], VAL: [], CIO: [] };

  // ── Outils ──────────────────────────────────────────────────────────────────────────────────
  const ouvre = (d: DateIso) => (estJourOuvre(d) ? d : ajouterJoursOuvres(d, 1));
  const auPlusTard = (d: DateIso) => (d > j0 ? j0 : d);
  const at = (d: DateIso, h = "10:00") => instantParis(d, h);
  const montantProjet = (projet: Projet) => {
    const [, , min, max] = PROJETS.find(([nom]) => nom === projet)!;
    return a.entier(min / 50, max / 50) * 50 * 100; // HT en centimes, arrondi à 50 €
  };
  const choisirProjet = (): Projet => a.pondere(PROJETS.map(([nom, poids]) => [nom, poids] as const));

  function nouveauClient(magasin: CodeMagasin, creeLe: DateIso, opts: { pro?: boolean; cnq?: boolean; rappel?: DateIso } = {}) {
    numero++;
    const prenom = a.choix(PRENOMS);
    const nom = a.choix(NOMS);
    const [ville, cp] = a.choix(COMMUNES[magasin]);
    const raison = opts.pro ? RAISONS_SOCIALES[numero % RAISONS_SOCIALES.length] : null;
    const client: Insert<"client"> = {
      id: a.uuid(),
      type: opts.pro ? "professionnel" : "particulier",
      raison_sociale: raison,
      nom: nom.toUpperCase(),
      prenom,
      telephone: opts.cnq ? null : telephoneFictif(numero),
      email: opts.cnq || a.proba(0.2) ? null : emailFictif(prenom, nom, numero),
      adresse: opts.cnq ? null : `${a.entier(1, 140)} ${a.choix(RUES)}`,
      code_postal: opts.cnq ? null : cp,
      ville: opts.cnq ? null : ville,
      cnq: opts.cnq ?? false,
      source: a.pondere(SOURCES),
      magasin_id: entree.magasins[magasin],
      gesteos_ref: opts.cnq ? null : `CL${String(10_000 + numero)}`,
      rappel_convenu_le: opts.rappel ?? null,
      created_at: at(creeLe, "10:00"),
      updated_at: at(creeLe, "10:00"),
    };
    jeu.clients.push(client);
    return client;
  }

  function nouvelleAffaire(
    client: Insert<"client">, magasin: CodeMagasin, concepteur: string, projet: Projet, creeLe: DateIso,
    champs: Partial<Insert<"affaire">>,
  ) {
    const identite = client as ClientIdentite;
    const affaire: Insert<"affaire"> = {
      id: a.uuid(),
      client_id: client.id!,
      magasin_id: entree.magasins[magasin],
      concepteur_id: p[concepteur],
      projet,
      libelle: libelleAffaire(identite, projet), // RG-03
      contremarque: contremarqueParDefaut(identite),
      process_version_id: entree.processVersionId,
      montant_devis_ht_cts: montantProjet(projet),
      created_at: at(creeLe, "10:30"),
      updated_at: at(creeLe, "10:30"),
      // Reprise d'historique : l'activité part de la création, les lignes liées l'avancent (RG-09).
      derniere_activite_at: at(creeLe, "10:30"),
      created_by: p[concepteur],
      ...champs,
    };
    jeu.affaires.push(affaire);
    return affaire;
  }

  function rdv(affaire: Insert<"affaire">, type: Insert<"rdv">["type"], date: DateIso, profil: string, rang = 1, notes?: string) {
    // Les showrooms sont fermés le dimanche : un RDV qui y tomberait passe au samedi.
    const jour = jourDeSemaine(date) === 0 ? ajouterJours(date, -1) : date;
    const fait = jour < j0;
    jeu.rdv.push({
      id: a.uuid(),
      affaire_id: affaire.id!,
      client_id: affaire.client_id,
      type,
      rang,
      debut: at(jour, a.choix(["09:30", "10:30", "14:00", "15:30", "17:00"])),
      profil_id: profil,
      statut: fait ? "fait" : "prevu",
      notes: fait ? (notes ?? null) : null,
      // Un RDV à venir a été planifié dans le passé : jamais de date de création postérieure à aujourd'hui.
      created_at: at(auPlusTard(ajouterJours(jour, -a.entier(2, 6))), "09:00"),
      updated_at: at(auPlusTard(fait ? jour : ajouterJours(jour, -2)), fait ? "18:00" : "09:00"),
      created_by: profil,
    });
  }

  function vente(
    client: Insert<"client">, magasin: CodeMagasin, affaires: Insert<"affaire">[], signature: DateIso, concepteur: string,
  ) {
    const ht = affaires.reduce((s, x) => s + (x.montant_devis_ht_cts ?? 0), 0);
    const v: Insert<"vente"> = {
      id: a.uuid(),
      client_id: client.id!,
      magasin_id: entree.magasins[magasin],
      date_signature: signature,
      montant_ht_cts: ht,
      montant_ttc_cts: Math.round(ht * 1.2),
      financement: a.proba(0.1) ? "franfinance" : "aucun",
      gesteos_devis_ref: `D${signature.replaceAll("-", "")}#${numeroDevis++}`,
      created_at: at(signature, "18:00"),
      updated_at: at(signature, "18:00"),
      created_by: p[concepteur],
    };
    jeu.ventes.push(v);
    for (const x of affaires) {
      x.vente_id = v.id;
      x.montant_devis_ht_cts = x.montant_devis_ht_cts ?? 0;
    }
    return v;
  }

  function echeances(
    v: Insert<"vente">, concepteur: string,
    recus: { acompte_1?: DateIso | null; acompte_2?: DateIso | null; solde?: DateIso | null },
    attendues: { acompte_2: DateIso | null; solde: DateIso | null },
  ) {
    const lignes = genererEcheancier({ montantTtcCts: v.montant_ttc_cts, dateSignature: v.date_signature });
    for (const l of lignes) {
      const recu = recus[l.type as "acompte_1" | "acompte_2" | "solde"] ?? null;
      const franfinance = v.financement === "franfinance" && l.type !== "acompte_1";
      jeu.echeances.push({
        id: a.uuid(),
        vente_id: v.id!,
        type: l.type,
        ordre: l.ordre,
        pourcentage: l.pourcentage,
        montant_prevu_cts: l.montantPrevuCts,
        date_attendue: l.type === "acompte_1" ? l.dateAttendue : attendues[l.type as "acompte_2" | "solde"],
        mode: franfinance ? "franfinance" : recu ? a.pondere([["cheque", 45], ["cb", 25], ["virement", 30]] as const) : null,
        recu_le: recu,
        montant_recu_cts: recu ? l.montantPrevuCts : null,
        saisi_par: recu ? p[concepteur] : null,
        created_at: at(v.date_signature, "18:05"),
        updated_at: at(recu ?? v.date_signature, "18:05"),
        created_by: p[concepteur],
      });
    }
  }

  function commandeAgem(affaire: Insert<"affaire">, c: Partial<Insert<"commande_fournisseur">>) {
    const ht = affaire.montant_devis_ht_cts ?? 0;
    const prix = Math.round((ht * a.entier(36, 44)) / 100);
    jeu.commandes.push({
      id: a.uuid(),
      affaire_id: affaire.id!,
      fournisseur: "AGEM",
      gesteos_commande_ref: c.envoyee_le ? `C${c.envoyee_le.replaceAll("-", "")}#${numeroCommande++}` : null,
      lieu_livraison: "TRANSTOCK 66",
      prix_achat_cts: prix,
      points: Math.round(prix * 1.3416) / 100,
      created_at: at(c.envoyee_le ?? j0, "11:00"),
      updated_at: at(c.bpa_donne_le ?? c.arc_recu_le ?? c.envoyee_le ?? j0, "11:00"),
      created_by: affaire.concepteur_id,
      ...c,
    });
  }

  // ── 1. Historique : ventes clôturées, affaires perdues, contacts CNQ ────────────────────────
  for (const magasin of ["AIX", "VAL", "CIO"] as const) {
    for (let k = 0; k < 76; k++) {
      const signature = ouvre(ajouterJours(j0, -a.entier(65, 185)));
      const concepteur = a.pondere(CONCEPTEURS[magasin]);
      const r2 = ajouterJours(signature, -a.entier(5, 12));
      const r1 = ajouterJours(r2, -a.entier(4, 9));
      const cree = ajouterJours(r1, -a.entier(1, 5));
      const client = nouveauClient(magasin, cree, { pro: a.proba(0.03) });
      clientsHistoriques[magasin].push(client);
      const projets: Projet[] = a.proba(0.15) ? ["cuisine", "dressing"] : [choisirProjet()];
      const affaires = projets.map((projet) =>
        nouvelleAffaire(client, magasin, concepteur, projet, cree, { statut: "cloturee", etape_courante_code: "ARCHIVAGE" }),
      );
      const premiere = affaires[0];
      rdv(premiere, "R1", r1, p[concepteur]);
      rdv(premiere, "R2", r2, p[concepteur]);
      rdv(premiere, "R3", signature, p[concepteur], 1, "Présentation validée, BDC signé.");
      const v = vente(client, magasin, affaires, signature, concepteur);
      const livraison = ouvre(ajouterJours(signature, a.entier(35, 50)));
      const pose = ajouterJoursOuvres(livraison, 3);
      echeances(v, concepteur,
        { acompte_1: ajouterJours(signature, a.entier(0, 3)), acompte_2: ajouterJours(livraison, a.entier(0, 2)), solde: ajouterJours(pose, a.entier(1, 15)) },
        { acompte_2: livraison, solde: pose });
      for (const x of affaires) {
        const envoi = ouvre(ajouterJours(signature, a.entier(3, 8)));
        commandeAgem(x, {
          envoyee_le: envoi, semaine_demandee: semaineIso(livraison), arc_recu_le: ajouterJoursOuvres(envoi, 3),
          semaine_annoncee: semaineIso(livraison), confirmation_recue_le: ajouterJoursOuvres(envoi, 4),
          bpa_version: "v1.01", bpa_donne_le: ajouterJoursOuvres(envoi, a.entier(5, 7)), statut: "livree",
        });
      }
      jeu.plannings.push({
        id: a.uuid(), vente_id: v.id!, semaine_livraison_souhaitee: semaineIso(livraison), date_pose_souhaitee: pose,
        semaine_livraison_confirmee: semaineIso(livraison), date_pose_confirmee: pose, poseur: "BAJV Agencements",
        statut: "confirmee", demande_par: p[concepteur], confirme_par: p.valentin,
        created_at: at(signature, "18:10"), updated_at: at(ajouterJours(signature, 20), "09:00"), created_by: p[concepteur],
      });
    }

    // Affaires perdues après présentation (≈ 58 % de transformation au R3) et plus tôt dans le parcours.
    for (let k = 0; k < 55; k++) {
      const r3 = ouvre(ajouterJours(j0, -a.entier(20, 185)));
      const concepteur = a.pondere(CONCEPTEURS[magasin]);
      const r2 = ajouterJours(r3, -a.entier(5, 12));
      const r1 = ajouterJours(r2, -a.entier(4, 9));
      const cree = ajouterJours(r1, -a.entier(1, 5));
      const client = nouveauClient(magasin, cree);
      const affaire = nouvelleAffaire(client, magasin, concepteur, choisirProjet(), cree, {
        statut: "perdue", motif_perte: a.pondere(MOTIFS_R3), etape_courante_code: "ARCHIVAGE",
      });
      rdv(affaire, "R1", r1, p[concepteur]);
      rdv(affaire, "R2", r2, p[concepteur]);
      rdv(affaire, "R3", r3, p[concepteur], 1, "Le client réfléchit.");
    }
    for (let k = 0; k < 18; k++) {
      const r1 = ouvre(ajouterJours(j0, -a.entier(20, 185)));
      const concepteur = a.pondere(CONCEPTEURS[magasin]);
      const client = nouveauClient(magasin, ajouterJours(r1, -a.entier(1, 4)));
      const abandon = a.proba(0.35);
      const affaire = nouvelleAffaire(client, magasin, concepteur, choisirProjet(), ajouterJours(r1, -1), {
        statut: abandon ? "abandonnee" : "perdue",
        motif_perte: abandon ? "projet abandonné" : a.choix(["prix", "injoignable", "délai"]),
        etape_courante_code: "ARCHIVAGE",
      });
      rdv(affaire, "R1", r1, p[concepteur]);
      if (abandon) rdv(affaire, "R2", ajouterJours(r1, a.entier(4, 9)), p[concepteur]);
    }
    for (let k = 0; k < 18; k++) nouveauClient(magasin, ouvre(ajouterJours(j0, -a.entier(1, 185))), { cnq: true });
  }

  // ── 2. Affaires actives, placées à leur étape ───────────────────────────────────────────────
  for (const magasin of ["CIO", "VAL", "AIX"] as const) {
    for (const [code, nombre] of ACTIVES[magasin]) {
      for (let rang = 0; rang < nombre; rang++) {
        const reglages = REGLAGES[`${magasin}:${code}:${rang}`] ?? [];
        const reglage = Object.assign({}, ...reglages) as Partial<Reglage>;
        creerAffaireActive(magasin, code, reglage, reglages.flatMap((r) => (r.cas ? [r.cas] : [])));
      }
    }
  }

  function planifier(courant: CodeChemin, age: number, iterationsR3: number): Record<CodeChemin, DateIso> {
    const duree = (c: CodeChemin) => (c === "R3" ? DUREES.R3 + ECART_R3N * (iterationsR3 - 1) : DUREES[c]);
    const i = CHEMIN.indexOf(courant);
    const o = {} as Record<CodeChemin, DateIso>;
    o[courant] = ajouterJours(j0, -age);
    for (let k = i - 1; k >= 0; k--) o[CHEMIN[k]] = ajouterJours(o[CHEMIN[k + 1]], -duree(CHEMIN[k]));
    for (let k = i + 1; k < CHEMIN.length; k++) o[CHEMIN[k]] = ajouterJours(o[CHEMIN[k - 1]], duree(CHEMIN[k - 1]));
    return o;
  }

  function issueVers(de: string, vers: string): string {
    const issue = index.get(de)!.etape.issues.find((i) => i.vers === vers || i.ouvre?.some((o) => o.etape === vers));
    if (!issue) throw new Error(`Aucune issue de ${de} vers ${vers}`);
    return issue.code;
  }

  function creerAffaireActive(magasin: CodeMagasin, code: string, reglage: Partial<Reglage>, cas: CasDemo[]) {
    const sav = code === "SAV";
    const courant: CodeChemin = sav ? "SOLDE" : (code as CodeChemin);
    const iterationsR3 = reglage.iterationsR3 ?? 1;
    const dureeCourante = courant === "R3" ? DUREES.R3 + ECART_R3N * (iterationsR3 - 1) : DUREES[courant];
    const age = reglage.age ?? (sav ? 4 : a.entier(0, Math.max(0, dureeCourante - 1)));
    const o = planifier(courant, age, iterationsR3);
    const iCourant = CHEMIN.indexOf(courant);
    const passe = (c: CodeChemin) => CHEMIN.indexOf(c) < iCourant;

    const concepteur = reglage.concepteur ?? a.pondere(CONCEPTEURS[magasin]);
    const revient = cas.includes("client_qui_revient") || (iCourant <= CHEMIN.indexOf("R1") && a.proba(0.2));
    const client = revient
      ? a.choix(clientsHistoriques[magasin])
      : nouveauClient(magasin, o.R0, { pro: cas.includes("client_professionnel") });
    const multi = cas.includes("vente_multi_affaires");
    const projets: Projet[] = multi ? ["cuisine", "dressing"] : [revient ? a.choix(["dressing", "placard", "bibliothèque"] as const) : choisirProjet()];
    const vendue = passe("VENTE") || courant === "VENTE";
    const affaires = projets.map((projet) =>
      nouvelleAffaire(client, magasin, concepteur, projet, o.R0, { statut: vendue ? "gagnee" : "active" }),
    );
    for (const c of cas) jeu.cas[c].push(...affaires.map((x) => x.id!));

    // Dates clés tirées du plan (passées = faits, futures = prévisions).
    const r1 = o.R2;
    const r2 = ajouterJours(o.R2, 2);
    const r3 = (n: number) => ajouterJours(o.R3, 2 + ECART_R3N * (n - 1));
    const signature = o.VENTE;
    const livraison = ajouterJours(o.ACOMPTE_2, 2);
    const pose = o.POSE;
    const finChantier = o.SOLDE;
    const premiere = affaires[0];

    // RDV
    if (passe("R1")) rdv(premiere, "R1", r1, p[concepteur]);
    else if (courant === "R1") rdv(premiere, "R1", ajouterJours(o.R1, DUREES.R1), p[concepteur]);
    if (passe("R2") || courant === "R2") rdv(premiere, "R2", r2, p[concepteur]);
    if (passe("R3") || courant === "R3" || courant === "PREP_R3") {
      const n = courant === "PREP_R3" ? 1 : iterationsR3;
      for (let k = 1; k <= n; k++) rdv(premiere, "R3", r3(k), p[concepteur], k, k < n || passe("R3") ? "Compte rendu noté." : undefined);
    }

    // Vente, échéancier, commandes, planning
    if (vendue) {
      const v = vente(client, magasin, affaires, signature, concepteur);
      const planningConfirme = passe("PLANNING_LIVRAISON");
      echeances(v, concepteur, {
        acompte_1: passe("ACOMPTE_1") ? ajouterJours(signature, a.entier(0, 2)) : null,
        acompte_2: passe("ACOMPTE_2") ? livraison : null,
        solde: passe("SOLDE") ? o.FACTURE_RECAP : null,
      }, { acompte_2: planningConfirme ? livraison : null, solde: planningConfirme ? pose : null });
      for (const x of affaires) {
        if (passe("COMMANDE_AGEM")) {
          commandeAgem(x, {
            envoyee_le: o.ARC,
            semaine_demandee: semaineIso(livraison),
            arc_recu_le: passe("ARC") ? o.BPA : null,
            semaine_annoncee: passe("ARC") ? semaineIso(livraison) : null,
            confirmation_recue_le: passe("ARC") ? o.BPA : null,
            bpa_version: passe("ARC") ? "v1.01" : null,
            bpa_donne_le: passe("BPA") ? o.BL : null,
            statut: passe("POSE") ? "livree" : passe("BPA") ? "bpa_donne" : passe("ARC") ? "en_verification" : "envoyee",
          });
        }
      }
      jeu.plannings.push({
        id: a.uuid(), vente_id: v.id!, semaine_livraison_souhaitee: semaineIso(livraison), date_pose_souhaitee: pose,
        semaine_livraison_confirmee: planningConfirme ? semaineIso(livraison) : null,
        date_pose_confirmee: planningConfirme ? pose : null, poseur: planningConfirme ? "BAJV Agencements" : null,
        statut: planningConfirme ? "confirmee" : "demandee", demande_par: p[concepteur],
        confirme_par: planningConfirme ? p.valentin : null,
        created_at: at(signature, "18:10"), updated_at: at(planningConfirme ? o.DOSSIER_POSE : signature, "18:10"),
        created_by: p[concepteur],
      });
    }

    // Étapes et tâches : rejeu du moteur de process, validation par validation, aux dates du plan.
    const pas: Pas[] = [];
    for (let k = 0; k < iCourant; k++) {
      const c = CHEMIN[k];
      if (c === "R3") {
        for (let n = 1; n < iterationsR3; n++) pas.push({ jour: r3(n), etape: "R3", issue: "r3_suivant", date: r3(n + 1) });
        pas.push({ jour: o.VENTE, etape: "R3", issue: "vente" });
        continue;
      }
      if (c === "ACOMPTE_1" && cas.includes("branche_autres_fournisseurs")) {
        pas.push({ jour: o.PREP_COMMANDE, etape: c, issue: "recu", ouvrir: ["AF_COMMANDE"] });
        continue;
      }
      if (sav && c === "POSE") {
        pas.push({ jour: o.SOLDE, etape: c, issue: "sav" });
        break;
      }
      pas.push({ jour: o[CHEMIN[k + 1]], etape: c, issue: issueVers(c, CHEMIN[k + 1]) });
    }
    // Présentations précédentes d'une affaire actuellement en R3.n.
    if (courant === "R3") for (let n = 1; n < iterationsR3; n++) pas.push({ jour: r3(n), etape: "R3", issue: "r3_suivant", date: r3(n + 1) });
    // Branche autres fournisseurs (section 7.4), ouverte à la réception de l'acompte 1 : étapes finies avant aujourd'hui.
    if (cas.includes("branche_autres_fournisseurs") && passe("ACOMPTE_1")) {
      let jour = o.PREP_COMMANDE;
      for (const [af, duree] of BRANCHE_AF) {
        jour = ajouterJours(jour, duree);
        if (jour > j0) break;
        const suite = BRANCHE_AF[BRANCHE_AF.findIndex(([c]) => c === af) + 1]?.[0];
        pas.push({ jour, etape: af, issue: suite ? issueVers(af, suite) : "fait" });
      }
    }
    const dates = {
      rdv: { R1: r1, R2: r2, R3: r3(iterationsR3), R4: ajouterJours(finChantier, 10) },
      datePose: passe("PLANNING_LIVRAISON") ? pose : null,
      dateLivraison: passe("PLANNING_LIVRAISON") ? livraison : null,
      finChantier: passe("POSE") ? finChantier : null,
    };
    const acompte1 = jeu.echeances.find((e) => e.vente_id === premiere.vente_id && e.type === "acompte_1")?.recu_le ?? null;
    for (const x of affaires) {
      const rejeu = rejouerAffaire(moteur, {
        affaireId: x.id!, concepteurId: x.concepteur_id, referents, debut: o.R0, pas, aujourdhui: j0, dates,
        vendueLe: vendue ? signature : null, acompte1Le: acompte1, instant: at,
      }, a);
      x.statut = rejeu.statut;
      x.etape_courante_code = rejeu.etapeCourante;
      jeu.etapes.push(...rejeu.etapes);
      jeu.taches.push(...rejeu.taches);
      if (cas.includes("branche_autres_fournisseurs") && passe("ACOMPTE_1")) {
        jeu.commandes.push({
          id: a.uuid(), affaire_id: x.id!, fournisseur: "Électroménager (fournisseur fictif)",
          envoyee_le: ajouterJours(o.PREP_COMMANDE, 2), statut: "envoyee",
          created_at: at(ajouterJours(o.PREP_COMMANDE, 2), "11:00"), updated_at: at(ajouterJours(o.PREP_COMMANDE, 2), "11:00"),
          created_by: x.concepteur_id,
        });
      }
    }
  }

  // ── 3. Contacts du jour et tâches libres ────────────────────────────────────────────────────
  // R0 sans affaire avec rappel convenu (RG-35), dont un rappel dû aujourd'hui pour Manon.
  const rappels: [CodeMagasin, string, number][] = [["CIO", "manon", 0], ["CIO", "eva", 2], ["VAL", "clara", -1], ["AIX", "lisa-marie", 1]];
  for (const [magasin, concepteur, dans] of rappels) {
    const quand = ajouterJours(j0, dans);
    const client = nouveauClient(magasin, ajouterJours(j0, -a.entier(3, 8)), { rappel: quand });
    jeu.taches.push({
      id: a.uuid(), client_id: client.id, titre: `Rappeler ${client.nom} ${client.prenom} (rappel convenu au R0)`, assignee_id: p[concepteur],
      echeance: quand, statut: "a_faire", origine: "relance", created_at: client.created_at, updated_at: client.created_at,
      created_by: p[concepteur],
    });
  }
  const libres: [string, string, string, number][] = [
    ["jean", "jean", "Préparer la réunion du mardi", joursAvantMardi(j0)],
    ["jean", "jean", "Mettre à jour le tableau des commissions", -1],
    ["valentin", "valentin", "Appeler Transtock pour les créneaux du mois prochain", 0],
    ["benjamin", "benjamin", "Commander les échantillons de façades 2027", 3],
    ["manon", "elsie", "Envoyer à Elsie les photos du salon de l'habitat", 0],
    ["manon", "manon", "Rappeler le fournisseur de poignées", -1],
    ["clara", "clara", "Mettre à jour la vitrine du showroom", 2],
    ["elsie", "elsie", "Publier les photos de fin de chantier de la semaine", 1],
  ];
  for (const [auteur, assignee, titre, dans] of libres) {
    jeu.taches.push({
      id: a.uuid(), titre, assignee_id: p[assignee], echeance: ajouterJours(j0, dans), statut: "a_faire", origine: "libre",
      created_at: at(ajouterJours(j0, -2), "09:00"), updated_at: at(ajouterJours(j0, -2), "09:00"), created_by: p[auteur],
    });
  }

  return jeu;
}

/** Jours jusqu'au prochain mardi (0 si on est mardi). */
function joursAvantMardi(j0: DateIso): number {
  for (let k = 0; k < 7; k++) if (new Date(`${ajouterJours(j0, k)}T12:00:00Z`).getUTCDay() === 2) return k;
  return 0;
}

