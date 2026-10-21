import { ajouterJours, type DateIso } from "../rules/calendrier";
import { tachesAGenerer, type ContexteEcheances } from "./echeances";
import { TYPES_RDV, type CodePhase, type Etape, type Issue, type ProcessDefinition, type Role } from "./schema";
import { indexerEtapes } from "./valider";

/**
 * Moteur de process (docs/conception.md, sections 7 et 8.1 : RG-01, RG-05 à RG-07, RG-34 à RG-36).
 *
 * Module pur : il reçoit l'état d'une affaire et une demande, et renvoie soit un refus motivé, soit le
 * nouvel état et la liste des effets à écrire en base (dans une seule transaction, par l'appelant).
 * Il raisonne sur l'ensemble des étapes ouvertes (section 7.4) ; `etapeCourante` n'est qu'un résumé
 * d'affichage. Il ne lit jamais l'horloge : « quand » et « aujourd'hui » viennent de l'appelant (Clock).
 */

export type StatutAffaire = "active" | "gagnee" | "perdue" | "abandonnee" | "cloturee";
export type Branche = "principale" | "autres_fournisseurs" | "sav";
export type TypeRdv = (typeof TYPES_RDV)[number];

export type EtapeEtat = {
  code: string;
  iteration: number;
  /** « sautee » : étape fermée sans issue par la clôture de l'affaire (EF-25). */
  statut: "en_cours" | "faite" | "sautee";
  branche: Branche;
  phase: CodePhase;
  issue: string | null;
  motif: string | null;
  debut: string;
  fin: string | null;
  validePar: string | null;
};

/** Tâche « à faire » rattachée à une étape (pour RG-05). */
export type TacheOuverte = { etape: string; iteration: number; titre: string; optionnelle: boolean };

export type EtatAffaire = {
  statut: StatutAffaire;
  etapes: EtapeEtat[];
  tachesOuvertes: TacheOuverte[];
  /** RG-01 : une échéance acompte_1 de la vente a `recu_le` renseigné. */
  acompte1Recu: boolean;
  /** RG-36 : `affaire.avis_google_obtenu_le` est renseigné. */
  avisObtenu: boolean;
};

/** Dates connues de l'affaire, pour dater les tâches des étapes ouvertes. */
export type DatesAffaire = Omit<ContexteEcheances, "ouverture">;

export type Moment = {
  /** Instant de l'action (horodatage ISO), fourni par Clock. */
  quand: string;
  /** Jour de l'action à Paris, fourni par Clock. */
  aujourdhui: DateIso;
  /** Identifiant de l'utilisateur qui agit. */
  par: string;
  dates?: DatesAffaire;
};

export type Validation = Moment & {
  etape: string;
  /** Itération visée ; par défaut la plus récente ouverte. */
  iteration?: number;
  issue: string;
  motif?: string | null;
  /** Date exigée par l'issue (R3.n, relance convenue). */
  date?: DateIso;
  /** Étapes optionnelles à ouvrir en parallèle (section 7.4), choisies par l'utilisateur. */
  ouvrir?: string[];
};

export type OrigineTache = "process" | "relance" | "avis";

export type Effet =
  | { type: "fermer_etape"; etape: string; iteration: number; issue: string; motif: string | null; quand: string; par: string }
  | { type: "sauter_etape"; etape: string; iteration: number; motif: string; quand: string; par: string }
  | { type: "annuler_taches"; etape: string; iteration: number }
  | { type: "ouvrir_etape"; etape: string; iteration: number; branche: Branche; phase: CodePhase; quand: string }
  | {
      type: "creer_tache";
      etape: string;
      iteration: number;
      /** Code de la tâche modèle ; null pour une relance ou une demande d'avis. */
      code: string | null;
      titre: string;
      role: Role;
      echeance: DateIso | null;
      optionnelle: boolean;
      origine: OrigineTache;
    }
  | { type: "statut_affaire"; statut: StatutAffaire; motif: string | null }
  | { type: "creer_rdv"; rdv: TypeRdv; rang: number; date: DateIso }
  | { type: "etape_courante"; etape: string | null };

export type CodeErreur =
  | "affaire_close"
  | "etape_non_ouverte"
  | "issue_inconnue"
  | "bloquee_acompte_1"
  | "motif_obligatoire"
  | "motif_inconnu"
  | "date_obligatoire"
  | "date_passee"
  | "option_inconnue"
  | "branches_ouvertes"
  | "sav_non_ouvert"
  | "recommande_en_cours"
  | "etape_inconnue"
  | "cloture_impossible";

export type Resultat =
  | { ok: true; etat: EtatAffaire; effets: Effet[]; avertissements: string[] }
  | { ok: false; erreur: CodeErreur; message: string };

/** Recommande AGEM pendant un SAV : la chaîne commande → ARC → BPA est rejouée, sans nouveau BL. */
export const RECOMMANDE_SAV = ["COMMANDE_AGEM", "ARC", "BPA"] as const;

export const TITRE_AVIS = "Demander un avis Google";
const MESSAGE_ACOMPTE_1 = "La commande AGEM attend l'acompte 1 : enregistrez sa réception avant de valider (RG-01).";

const refus = (erreur: CodeErreur, message: string): Resultat => ({ ok: false, erreur, message });
const estRdv = (code: string): code is TypeRdv => (TYPES_RDV as readonly string[]).includes(code);

export type OptionsMoteur = {
  /** Liste `motifs_non_vente` de la table parametre (RG-06). */
  motifsAutorises: readonly string[];
  /** Seuil `relance_r2_sans_reponse_jours` de la table parametre (RG-34) ; à défaut, celui du process. */
  relanceSansReponseJours?: number;
};

export function creerMoteur(definition: ProcessDefinition, options: OptionsMoteur) {
  const index = indexerEtapes(definition);
  const ordre = new Map([...index.keys()].map((code, i) => [code, i]));
  const rang = (code: string) => ordre.get(code) ?? Number.MAX_SAFE_INTEGER;

  /** Étapes ouvertes, dans l'ordre du process puis des itérations. */
  function ouvertes(etat: EtatAffaire): EtapeEtat[] {
    return etat.etapes
      .filter((e) => e.statut === "en_cours")
      .sort((a, b) => rang(a.code) - rang(b.code) || a.iteration - b.iteration);
  }

  // Étapes ouvertes en parallèle d'une autre (R4, branche autres fournisseurs) : secondaires pour l'affichage.
  const paralleles = new Set(
    [...index.values()].flatMap(({ etape }) => etape.issues.flatMap((i) => (i.ouvre ?? []).map((o) => o.etape))),
  );

  /**
   * Résumé d'affichage (affaire.etape_courante_code) : l'étape ouverte la plus avancée du chemin principal
   * (hors étapes ouvertes en parallèle, comme le R4 pendant le solde), sinon de n'importe quelle branche ;
   * sans étape ouverte, la dernière étape faite. Jamais utilisé par la logique (CLAUDE.md).
   */
  function etapeCourante(etapes: readonly EtapeEtat[]): string | null {
    const plusAvancee = (liste: EtapeEtat[]) =>
      liste.length ? liste.reduce((a, b) => (rang(b.code) >= rang(a.code) ? b : a)).code : null;
    const enCours = etapes.filter((e) => e.statut === "en_cours");
    const principales = enCours.filter((e) => e.branche === "principale");
    return (
      plusAvancee(principales.filter((e) => !paralleles.has(e.code))) ??
      plusAvancee(principales) ??
      plusAvancee(enCours) ??
      plusAvancee(etapes.filter((e) => e.statut === "faite"))
    );
  }

  /** Motif du blocage d'une étape (RG-01), ou null si elle peut être validée. */
  function blocage(etat: EtatAffaire, code: string): string | null {
    const def = index.get(code)?.etape;
    if (def?.bloquee_si?.includes("acompte_1_non_recu") && !etat.acompte1Recu) return MESSAGE_ACOMPTE_1;
    return null;
  }

  /** Ouvre une étape : instance, tâches datées (sauf demandes d'avis inutiles, RG-36). */
  function ouvrir(
    etat: EtatAffaire,
    code: string,
    branche: Branche | null,
    m: Moment,
    dates: DatesAffaire,
    effets: Effet[],
  ): EtatAffaire {
    const { etape, phase } = index.get(code)!;
    if (etat.etapes.some((e) => e.code === code && e.statut === "en_cours")) return etat; // déjà ouverte
    const iteration = Math.max(0, ...etat.etapes.filter((e) => e.code === code).map((e) => e.iteration)) + 1;
    const nouvelle: EtapeEtat = {
      code, iteration, statut: "en_cours", branche: branche ?? etape.branche ?? "principale", phase: phase.code,
      issue: null, motif: null, debut: m.quand, fin: null, validePar: null,
    };
    effets.push({ type: "ouvrir_etape", etape: code, iteration, branche: nouvelle.branche, phase: phase.code, quand: m.quand });
    const taches: TacheOuverte[] = [];
    for (const t of tachesAGenerer(etape, { ...dates, ouverture: m.aujourdhui })) {
      if (t.avis_google && etat.avisObtenu) continue;
      const optionnelle = t.optionnelle ?? false;
      effets.push({
        type: "creer_tache", etape: code, iteration, code: t.code, titre: t.titre, role: t.assignee,
        echeance: t.echeanceDate, optionnelle, origine: "process",
      });
      taches.push({ etape: code, iteration, titre: t.titre, optionnelle });
    }
    return { ...etat, etapes: [...etat.etapes, nouvelle], tachesOuvertes: [...etat.tachesOuvertes, ...taches] };
  }

  function terminer(etat: EtatAffaire, effets: Effet[], avertissements: string[] = []): Resultat {
    effets.push({ type: "etape_courante", etape: etapeCourante(etat.etapes) });
    return { ok: true, etat, effets, avertissements };
  }

  /** Démarre une affaire à l'étape d'entrée du process (R0), ou au R1 quand elle naît en découverte. */
  function demarrer(m: Moment, depart: string = definition.depart): Resultat {
    if (!index.has(depart)) return refus("etape_inconnue", `Étape inconnue : ${depart}.`);
    const vide: EtatAffaire = { statut: "active", etapes: [], tachesOuvertes: [], acompte1Recu: false, avisObtenu: false };
    const effets: Effet[] = [];
    return terminer(ouvrir(vide, depart, null, m, m.dates ?? {}, effets), effets);
  }

  /** Contrôles d'une validation, avant tout effet. */
  function controler(etat: EtatAffaire, v: Validation, etape: Etape, issue: Issue | undefined): Resultat | null {
    if (!issue) return refus("issue_inconnue", `L'étape ${etape.titre} n'a pas d'issue « ${v.issue} ».`);
    const bloque = blocage(etat, etape.code);
    if (bloque) return refus("bloquee_acompte_1", bloque);
    if (issue.motif_obligatoire) {
      if (!v.motif?.trim()) return refus("motif_obligatoire", "Choisissez un motif (RG-06).");
      if (!options.motifsAutorises.includes(v.motif)) return refus("motif_inconnu", `Motif inconnu : « ${v.motif} » (RG-06).`);
    }
    if (issue.demande_date) {
      if (!v.date) return refus("date_obligatoire", "Indiquez une date (RG-07).");
      if (v.date < v.aujourdhui) return refus("date_passee", "La date choisie est déjà passée (RG-07).");
    }
    const optionnelles = new Set((issue.ouvre ?? []).filter((o) => o.optionnel).map((o) => o.etape));
    const inconnue = (v.ouvrir ?? []).find((c) => !optionnelles.has(c));
    if (inconnue) return refus("option_inconnue", `L'issue « ${issue.libelle} » ne propose pas d'ouvrir ${inconnue}.`);
    if (issue.type === "end" && !issue.vers) {
      const autres = etat.etapes.filter((e) => e.statut === "en_cours" && e.code !== etape.code);
      if (autres.length) {
        const liste = ouvertes({ ...etat, etapes: autres }).map((e) => index.get(e.code)!.etape.titre).join(", ");
        return refus("branches_ouvertes", `Des étapes sont encore ouvertes : ${liste}.`);
      }
    }
    return null;
  }

  /** Valide une étape ouverte avec une issue (EF-32, RG-05 à RG-07). */
  function valider(etat: EtatAffaire, v: Validation): Resultat {
    if (etat.statut === "cloturee") return refus("affaire_close", "L'affaire est clôturée.");
    const candidates = etat.etapes.filter(
      (e) => e.code === v.etape && e.statut === "en_cours" && (v.iteration === undefined || e.iteration === v.iteration),
    );
    const instance = candidates.sort((a, b) => b.iteration - a.iteration)[0];
    const etape = index.get(v.etape)?.etape;
    if (!instance || !etape) return refus("etape_non_ouverte", `L'étape ${v.etape} n'est pas ouverte sur cette affaire.`);
    const issue = etape.issues.find((i) => i.code === v.issue);
    const erreur = controler(etat, v, etape, issue);
    if (erreur) return erreur;
    const dates: DatesAffaire = v.dates ?? {};
    const effets: Effet[] = [];
    const { iteration } = instance;

    // Attente (RG-07, RG-34, RG-35) : l'étape reste ouverte, une relance est créée.
    if (issue!.type === "wait") {
      const echeance = v.date ?? ajouterJours(v.aujourdhui, (issue!.relance_jours && options.relanceSansReponseJours) || issue!.relance_jours || 0);
      effets.push({
        type: "creer_tache", etape: v.etape, iteration, code: null, titre: `Relancer le client (${etape.titre})`,
        role: etape.responsable, echeance, optionnelle: false, origine: "relance",
      });
      const tache = { etape: v.etape, iteration, titre: `Relancer le client (${etape.titre})`, optionnelle: false };
      return terminer({ ...etat, tachesOuvertes: [...etat.tachesOuvertes, tache] }, effets);
    }

    // Fermeture de l'étape ; les tâches restantes sont annulées, les obligatoires signalées (RG-05).
    const motif = issue!.motif_obligatoire ? v.motif!.trim() : null;
    effets.push({ type: "fermer_etape", etape: v.etape, iteration, issue: v.issue, motif, quand: v.quand, par: v.par });
    effets.push({ type: "annuler_taches", etape: v.etape, iteration });
    const restantes = etat.tachesOuvertes.filter((t) => t.etape === v.etape && t.iteration === iteration);
    const avertissements = restantes.filter((t) => !t.optionnelle).map((t) => `Tâche non faite, annulée : ${t.titre}`);
    let suite: EtatAffaire = {
      ...etat,
      etapes: etat.etapes.map((e) =>
        e === instance ? { ...e, statut: "faite", issue: v.issue, motif, fin: v.quand, validePar: v.par } : e,
      ),
      tachesOuvertes: etat.tachesOuvertes.filter((t) => !restantes.includes(t)),
    };

    // Statut de l'affaire : perte ou abandon avec motif (RG-06) ; clôture d'une affaire gagnée seulement.
    const statut = issue!.statut_affaire;
    if (statut && (statut !== "cloturee" || etat.statut === "gagnee")) {
      effets.push({ type: "statut_affaire", statut, motif });
      suite = { ...suite, statut };
    }
    // Fin d'affaire avec demande d'avis Google (R1 sans suite, R3 perdue), sauf avis déjà obtenu (RG-36).
    if (issue!.type === "end" && issue!.demande_avis_google && !etat.avisObtenu) {
      effets.push({
        type: "creer_tache", etape: v.etape, iteration, code: null, titre: TITRE_AVIS, role: "concepteur",
        echeance: v.aujourdhui, optionnelle: false, origine: "avis",
      });
      suite = { ...suite, tachesOuvertes: [...suite.tachesOuvertes, { etape: v.etape, iteration, titre: TITRE_AVIS, optionnelle: false }] };
    }

    // Recommande SAV : la chaîne s'arrête après le BPA et reste dans la branche SAV.
    const recommande = instance.branche === "sav" && etape.branche !== "sav";
    if (issue!.type === "loop") {
      suite = ouvrir(suite, v.etape, instance.branche, v, demandeRdv(v, dates), effets);
      if (issue!.demande_date && estRdv(v.etape)) effets.push({ type: "creer_rdv", rdv: v.etape, rang: iteration + 1, date: v.date! });
    } else if (issue!.type !== "fin_branche") {
      const cible = etat.avisObtenu && issue!.vers_si_avis_obtenu ? issue!.vers_si_avis_obtenu : issue!.vers;
      if (recommande) {
        if (cible && (RECOMMANDE_SAV as readonly string[]).includes(cible)) suite = ouvrir(suite, cible, "sav", v, dates, effets);
      } else {
        if (cible) suite = ouvrir(suite, cible, null, v, dates, effets);
        for (const o of issue!.ouvre ?? []) {
          if (!o.optionnel || v.ouvrir?.includes(o.etape)) suite = ouvrir(suite, o.etape, null, v, dates, effets);
        }
      }
    }
    return terminer(suite, effets, avertissements);
  }

  /** Une nouvelle présentation datée (R3.n) date aussi les tâches de son itération. */
  function demandeRdv(v: Validation, dates: DatesAffaire): DatesAffaire {
    return v.date && estRdv(v.etape) ? { ...dates, rdv: { ...dates.rdv, [v.etape]: v.date } } : dates;
  }

  /** Repasse une commande AGEM pendant un SAV (recommande) : COMMANDE_AGEM → ARC → BPA dans la branche SAV. */
  function repasserCommandeSav(etat: EtatAffaire, m: Moment): Resultat {
    if (etat.statut === "cloturee") return refus("affaire_close", "L'affaire est clôturée.");
    if (!etat.etapes.some((e) => e.code === "SAV" && e.statut === "en_cours")) {
      return refus("sav_non_ouvert", "Une recommande AGEM se passe depuis un SAV ouvert.");
    }
    const enCours = etat.etapes.find(
      (e) => e.statut === "en_cours" && e.branche === "sav" && (RECOMMANDE_SAV as readonly string[]).includes(e.code),
    );
    if (enCours) return refus("recommande_en_cours", "Une recommande AGEM est déjà en cours sur ce SAV.");
    const effets: Effet[] = [];
    return terminer(ouvrir(etat, "COMMANDE_AGEM", "sav", m, m.dates ?? {}, effets), effets);
  }

  /**
   * Clôt une affaire avant la vente, perdue ou abandonnée, avec un motif (EF-25, RG-06) : les étapes
   * ouvertes sont sautées, leurs tâches annulées, et l'archivage s'ouvre comme après une issue « fin ».
   */
  function clore(etat: EtatAffaire, c: Moment & { statut: "perdue" | "abandonnee"; motif: string }): Resultat {
    if (etat.statut === "cloturee" || etat.statut === "perdue" || etat.statut === "abandonnee") {
      return refus("affaire_close", "L'affaire est déjà close.");
    }
    if (etat.statut !== "active") {
      return refus("cloture_impossible", "Une affaire vendue ne se clôt pas ainsi : poursuivez le process ou ouvrez un SAV.");
    }
    if (!c.motif?.trim()) return refus("motif_obligatoire", "Choisissez un motif (RG-06).");
    if (!options.motifsAutorises.includes(c.motif)) return refus("motif_inconnu", `Motif inconnu : « ${c.motif} » (RG-06).`);
    const effets: Effet[] = [];
    const ouvertesAvant = etat.etapes.filter((e) => e.statut === "en_cours");
    for (const e of ouvertesAvant) {
      effets.push({ type: "sauter_etape", etape: e.code, iteration: e.iteration, motif: c.motif, quand: c.quand, par: c.par });
      effets.push({ type: "annuler_taches", etape: e.code, iteration: e.iteration });
    }
    effets.push({ type: "statut_affaire", statut: c.statut, motif: c.motif });
    let suite: EtatAffaire = {
      ...etat,
      statut: c.statut,
      etapes: etat.etapes.map((e) =>
        e.statut === "en_cours" ? { ...e, statut: "sautee", motif: c.motif, fin: c.quand, validePar: c.par } : e,
      ),
      tachesOuvertes: etat.tachesOuvertes.filter((t) => !ouvertesAvant.some((e) => e.code === t.etape && e.iteration === t.iteration)),
    };
    const archivage = [...index.values()].find(({ etape }) => etape.issues.some((i) => i.type === "end" && !i.vers))?.etape.code;
    if (archivage) suite = ouvrir(suite, archivage, null, c, c.dates ?? {}, effets);
    return terminer(suite, effets);
  }

  return { definition, demarrer, valider, repasserCommandeSav, blocage, ouvertes, etapeCourante, clore };
}

export type Moteur = ReturnType<typeof creerMoteur>;
