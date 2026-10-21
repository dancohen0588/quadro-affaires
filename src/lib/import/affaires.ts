/**
 * Reprise initiale des affaires actives (section 13.1) : validation d'une ligne du CSV et plan d'écriture.
 * L'affaire est positionnée à `etape_code` par le rejeu du moteur (mêmes validations qu'un utilisateur, datées) :
 * les étapes antérieures sont faites, seules les tâches des étapes ouvertes sont créées. Une date de signature
 * crée la vente et son échéancier 40 / 50 / 10 (RG-10) ; les règlements déjà reçus sont marqués reçus.
 * Fonction pure : l'écriture, une ligne à la fois et tout ou rien, est faite par public.importer_affaire.
 */
import type { Database } from "../db/types";
import type { Alea } from "../demo/aleatoire";
import { rejouerAffaire, type Pas } from "../demo/rejouer";
import { centimesDepuis, instantParis } from "../format";
import { nomDossierAffaire } from "../pcloud";
import type { Moteur } from "../process/moteur";
import type { ProcessDefinition, Role } from "../process/schema";
import { contremarqueParDefaut, libelleAffaire, nomClient, type ClientIdentite } from "../rules/affaire";
import { lundiDeSemaine, type DateIso } from "../rules/calendrier";
import { genererEcheancier, type LigneStandard } from "../rules/echeancier";

type Insert<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Insert"];

/** Colonnes du fichier, dans l'ordre de la section 13.1. */
export const COLONNES = [
  "magasin", "concepteur_email", "client_type", "client_nom", "client_prenom", "raison_sociale", "telephone", "email", "adresse",
  "code_postal", "ville", "projet", "contremarque", "etape_code", "montant_devis_ht", "date_r1", "date_r2", "date_r3",
  "date_signature", "montant_vente_ht", "montant_vente_ttc", "acompte1_recu_le", "acompte2_recu_le", "solde_recu_le",
  "semaine_livraison", "date_pose", "gesteos_devis_ref",
] as const;

export type ContexteImport = {
  aujourdhui: DateIso;
  moteur: Moteur;
  processVersionId: string;
  magasins: Record<string, { id: string; code: string }>;
  /** Gérants et conceptrices actifs, par adresse en minuscules. */
  concepteurs: Record<string, { id: string; prenom: string; magasins: string[]; role: string }>;
  referents: Partial<Record<Exclude<Role, "concepteur">, string>>;
  projets: readonly string[];
  standard?: readonly LigneStandard[];
  /** Affaires déjà présentes, clé `affaireExistante` : une ligne réimportée est refusée, pas dupliquée. */
  affairesExistantes: Set<string>;
  /** Clients existants, clé `cleClient` : un client connu est repris, pas recréé. */
  clientsExistants: Map<string, string>;
  uuid: () => string;
};

export type PlanImport = {
  numero: number;
  libelle: string;
  etape: string;
  clientExistant: string | null;
  client: Insert<"client"> | null;
  vente: Insert<"vente"> | null;
  echeances: Insert<"echeance">[];
  planning: Insert<"planning"> | null;
  affaire: Insert<"affaire">;
  rdv: Insert<"rdv">[];
  etapes: Insert<"etape_instance">[];
  taches: Insert<"tache">[];
};
export type LigneImport = { numero: number; ok: true; plan: PlanImport } | { numero: number; ok: false; motifs: string[] };

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toUpperCase();
export const affaireExistante = (magasinId: string, contremarque: string, projet: string) => `${magasinId}|${normal(contremarque)}|${normal(projet)}`;
export const cleClient = (magasinId: string, nom: string, telephone: string) => `${magasinId}|${normal(nom)}|${telephone.replace(/\D/g, "")}`;

/** « 2026-10-21 » ou « 21/10/2026 » ; null si vide, « invalide » sinon. */
export function lireDate(v: string): DateIso | null | "invalide" {
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) {
    const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    if (fr) m = [v, fr[3], fr[2].padStart(2, "0"), fr[1].padStart(2, "0")] as unknown as RegExpExecArray;
  }
  if (!m) return "invalide";
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? "invalide" : iso;
}

/** « 2026-S44 », « S44/2026 » ou « 44 / 2026 » → « 2026-S44 » ; null si vide, « invalide » sinon. */
export function lireSemaine(v: string): string | null | "invalide" {
  if (!v) return null;
  const a = /^(\d{4})-?S(\d{1,2})$/i.exec(v.replace(/\s/g, ""));
  const b = /^S?(\d{1,2})\/(\d{4})$/i.exec(v.replace(/\s/g, ""));
  const [annee, sem] = a ? [a[1], a[2]] : b ? [b[2], b[1]] : [null, null];
  if (!annee || Number(sem) < 1 || Number(sem) > 53) return "invalide";
  return `${annee}-S${sem!.padStart(2, "0")}`;
}

/** Chemin principal du process : du départ, première issue « go » à chaque étape (R0 → … → FACTURE_RECAP). */
export function cheminPrincipal(def: ProcessDefinition): { code: string; issueVersSuivante: string | null }[] {
  const etapes = new Map(def.phases.flatMap((p) => p.etapes.map((e) => [e.code, e] as const)));
  const chemin: { code: string; issueVersSuivante: string | null }[] = [];
  for (let code: string | undefined = def.depart; code && !chemin.some((c) => c.code === code); ) {
    const go: { code: string; vers?: string } | undefined = etapes.get(code)!.issues.find((i) => i.type === "go");
    chemin.push({ code, issueVersSuivante: go?.code ?? null });
    code = go?.vers;
  }
  return chemin;
}

export function planifierLigne(numero: number, v: Record<string, string>, ctx: ContexteImport): LigneImport {
  const motifs: string[] = [];
  const refus = (m: string) => motifs.push(m);
  const def = ctx.moteur.definition;
  const chemin = cheminPrincipal(def);
  const rang = (code: string) => chemin.findIndex((c) => c.code === code);

  const magasin = ctx.magasins[v.magasin?.toUpperCase() ?? ""];
  if (!magasin) refus(`Magasin inconnu : « ${v.magasin ?? ""} ».`);
  const concepteur = ctx.concepteurs[(v.concepteur_email ?? "").toLowerCase()];
  if (!concepteur) refus(`Concepteur inconnu ou inactif : « ${v.concepteur_email ?? ""} ».`);
  else if (magasin && concepteur.role !== "gerant" && !concepteur.magasins.includes(magasin.code)) refus(`${concepteur.prenom} n'est pas rattachée au magasin ${magasin.code}.`);
  const type = v.client_type === "professionnel" ? "professionnel" : v.client_type === "particulier" || !v.client_type ? "particulier" : null;
  if (!type) refus("client_type : particulier ou professionnel.");
  if (!v.client_nom) refus("Nom du client manquant.");
  if (type === "professionnel" && !v.raison_sociale) refus("Raison sociale manquante pour un client professionnel.");
  if (!ctx.projets.includes(v.projet)) refus(`Projet inconnu : « ${v.projet ?? ""} » (${ctx.projets.join(", ")}).`);
  const iEtape = rang(v.etape_code ?? "");
  if (iEtape < 0) refus(`Étape inconnue ou hors du chemin principal : « ${v.etape_code ?? ""} ».`);

  const dates: Record<string, DateIso | null> = {};
  for (const c of ["date_r1", "date_r2", "date_r3", "date_signature", "acompte1_recu_le", "acompte2_recu_le", "solde_recu_le", "date_pose"] as const) {
    const d = lireDate(v[c] ?? "");
    if (d === "invalide") refus(`${c} : date illisible « ${v[c]} » (AAAA-MM-JJ ou JJ/MM/AAAA).`);
    else if (d && d > ctx.aujourdhui && c !== "date_pose" && c !== "date_r3") refus(`${c} : date future.`);
    else dates[c] = d;
  }
  const semaine = lireSemaine(v.semaine_livraison ?? "");
  if (semaine === "invalide") refus(`semaine_livraison illisible « ${v.semaine_livraison} » (2026-S44).`);
  const montant = (c: string) => {
    if (!v[c]) return null;
    const m = centimesDepuis(v[c]);
    if (m === null || m < 0) refus(`${c} : montant illisible « ${v[c]} ».`);
    return m;
  };
  const devis = montant("montant_devis_ht");
  const venteHt = montant("montant_vente_ht");
  const venteTtc = montant("montant_vente_ttc");

  const iVente = rang("VENTE"), iAcompte1 = rang("ACOMPTE_1");
  const vendue = iEtape > iVente;
  if (vendue) {
    if (!dates.date_signature) refus("Date de signature manquante pour une affaire vendue.");
    if (venteHt === null || venteTtc === null) refus("Montants HT et TTC de la vente manquants pour une affaire vendue.");
    else if (venteTtc < venteHt) refus("Montant TTC inférieur au HT.");
  }
  if (iEtape > iAcompte1 && !dates.acompte1_recu_le) refus("Acompte 1 non reçu : l'affaire ne peut pas dépasser l'étape Règlement acompte 1 (RG-01).");
  const suite = [dates.date_r1, dates.date_r2, dates.date_r3 && dates.date_r3 <= ctx.aujourdhui ? dates.date_r3 : null, vendue ? dates.date_signature : null].filter(Boolean) as DateIso[];
  if (suite.some((d, i) => i > 0 && d < suite[i - 1])) refus("Dates incohérentes : R1, R2, R3 et signature doivent se suivre.");

  const identite: ClientIdentite = { type: type ?? "particulier", nom: v.client_nom ?? "", prenom: v.client_prenom || null, raison_sociale: v.raison_sociale || null };
  const contremarque = v.contremarque || contremarqueParDefaut(identite);
  if (magasin && v.projet && ctx.affairesExistantes.has(affaireExistante(magasin.id, contremarque, v.projet))) {
    refus(`Déjà présente : ${contremarque} · ${v.projet} dans ${magasin.code}.`);
  }
  if (motifs.length) return { numero, ok: false, motifs };

  // ── Plan ─────────────────────────────────────────────────────────────────────────────────────
  const at = (jour: DateIso, h = "10:00") => instantParis(jour, h);
  const connues = [dates.date_r1, dates.date_r2, dates.date_signature].filter(Boolean) as DateIso[];
  const debut = connues.length ? connues.sort()[0] : ctx.aujourdhui;
  const clientExistant = v.telephone ? ctx.clientsExistants.get(cleClient(magasin!.id, identite.nom, v.telephone)) ?? null : null;
  const clientId = clientExistant ?? ctx.uuid();
  const client: Insert<"client"> | null = clientExistant ? null : {
    id: clientId, type: identite.type, nom: identite.nom, prenom: identite.prenom, raison_sociale: identite.raison_sociale,
    telephone: v.telephone || null, email: v.email || null, adresse: v.adresse || null, code_postal: v.code_postal || null, ville: v.ville || null,
    magasin_id: magasin!.id, source: "reprise", created_at: at(debut), updated_at: at(debut), created_by: concepteur!.id,
  };

  // Jour d'entrée dans chaque étape : la date connue la plus proche, jamais avant la précédente ni après aujourd'hui.
  const entree: Record<string, DateIso | null | undefined> = {
    R1: dates.date_r1, R2: dates.date_r2, R3: dates.date_r3 && dates.date_r3 <= ctx.aujourdhui ? dates.date_r3 : null,
    VENTE: dates.date_signature, ACOMPTE_1: dates.date_signature, PREP_COMMANDE: dates.acompte1_recu_le,
    POSE: dates.acompte2_recu_le, SOLDE: dates.date_pose && dates.date_pose <= ctx.aujourdhui ? dates.date_pose : null, FACTURE_RECAP: dates.solde_recu_le,
  };
  const pas: Pas[] = [];
  let jour = debut;
  for (let k = 0; k < iEtape; k++) {
    const suivante = chemin[k + 1].code;
    const candidat = entree[suivante];
    if (candidat && candidat > jour) jour = candidat;
    pas.push({ jour: jour > ctx.aujourdhui ? ctx.aujourdhui : jour, etape: chemin[k].code, issue: chemin[k].issueVersSuivante! });
  }

  const affaireId = ctx.uuid();
  const venteId = vendue ? ctx.uuid() : null;
  const pose = dates.date_pose ?? null;
  const livraison = semaine && semaine !== "invalide" ? lundiDeSemaine(semaine) : null;
  const referents = Object.fromEntries((["gerant_bpa", "gerant_logistique", "gerant_finance", "responsable_r4"] as const).map((r) => [r, ctx.referents[r] ?? concepteur!.id])) as Record<Exclude<Role, "concepteur">, string>;
  let rejeu;
  try {
    rejeu = rejouerAffaire(ctx.moteur, {
      affaireId, concepteurId: concepteur!.id, referents, debut, pas, aujourdhui: ctx.aujourdhui,
      dates: { rdv: { R1: dates.date_r1 ?? undefined, R2: dates.date_r2 ?? undefined, R3: dates.date_r3 ?? undefined }, datePose: pose, dateLivraison: livraison, finChantier: null },
      vendueLe: vendue ? dates.date_signature : null, acompte1Le: dates.acompte1_recu_le, instant: at,
    }, { uuid: ctx.uuid, proba: () => false } as unknown as Alea);
  } catch (e) {
    return { numero, ok: false, motifs: [`Positionnement impossible : ${e instanceof Error ? e.message : String(e)}`] };
  }

  const vente: Insert<"vente"> | null = venteId ? {
    id: venteId, client_id: clientId, magasin_id: magasin!.id, date_signature: dates.date_signature!, montant_ht_cts: venteHt!, montant_ttc_cts: venteTtc!,
    gesteos_devis_ref: v.gesteos_devis_ref || null, created_at: at(dates.date_signature!, "18:00"), updated_at: at(dates.date_signature!, "18:00"), created_by: concepteur!.id,
  } : null;
  const recus = { acompte_1: dates.acompte1_recu_le, acompte_2: dates.acompte2_recu_le, solde: dates.solde_recu_le } as Record<string, DateIso | null | undefined>;
  const attendues = { acompte_2: livraison, solde: pose } as Record<string, DateIso | null>;
  const echeances: Insert<"echeance">[] = vente
    ? genererEcheancier({ montantTtcCts: vente.montant_ttc_cts, dateSignature: vente.date_signature, standard: ctx.standard }).map((l) => {
        const recu = recus[l.type] ?? null;
        return {
          id: ctx.uuid(), vente_id: vente.id!, type: l.type, ordre: l.ordre, pourcentage: l.pourcentage, montant_prevu_cts: l.montantPrevuCts,
          date_attendue: l.type === "acompte_1" ? l.dateAttendue : attendues[l.type] ?? null,
          recu_le: recu, montant_recu_cts: recu ? l.montantPrevuCts : null, saisi_par: recu ? concepteur!.id : null,
          created_at: vente.created_at, updated_at: vente.created_at, created_by: concepteur!.id,
        };
      })
    : [];
  const planning: Insert<"planning"> | null = vente && (semaine || pose) ? {
    id: ctx.uuid(), vente_id: vente.id!, semaine_livraison_souhaitee: semaine || null, date_pose_souhaitee: pose,
    semaine_livraison_confirmee: semaine && pose ? semaine : null, date_pose_confirmee: semaine && pose ? pose : null,
    statut: semaine && pose ? "confirmee" : "demandee", demande_par: concepteur!.id, created_at: vente.created_at, updated_at: vente.created_at, created_by: concepteur!.id,
  } : null;
  const rdv: Insert<"rdv">[] = (["R1", "R2", "R3"] as const)
    .filter((t) => dates[`date_${t.toLowerCase()}`])
    .map((t) => {
      const d = dates[`date_${t.toLowerCase()}`]!;
      return {
        id: ctx.uuid(), affaire_id: affaireId, client_id: clientId, type: t, debut: at(d), profil_id: concepteur!.id,
        statut: d <= ctx.aujourdhui ? "fait" : "prevu", created_at: at(d < debut ? d : debut, "09:00"), created_by: concepteur!.id,
      };
    });
  const derniere = pas.length ? pas[pas.length - 1].jour : debut;
  const affaire: Insert<"affaire"> = {
    id: affaireId, client_id: clientId, magasin_id: magasin!.id, concepteur_id: concepteur!.id, projet: v.projet,
    libelle: libelleAffaire(identite, v.projet), contremarque, statut: rejeu.statut, montant_devis_ht_cts: devis,
    process_version_id: ctx.processVersionId, etape_courante_code: rejeu.etapeCourante, vente_id: venteId,
    pcloud_folder_id: nomDossierAffaire({ magasinCode: magasin!.code, client: nomClient(identite), projet: v.projet, concepteur: concepteur!.prenom }),
    pcloud_url: `/pcloud?affaire=${affaireId}`,
    created_at: at(debut), updated_at: at(derniere, "17:00"), derniere_activite_at: at(derniere, "17:00"), created_by: concepteur!.id,
  };
  ctx.affairesExistantes.add(affaireExistante(magasin!.id, contremarque, v.projet));
  if (client && v.telephone) ctx.clientsExistants.set(cleClient(magasin!.id, identite.nom, v.telephone), clientId);
  return {
    numero, ok: true,
    plan: { numero, libelle: affaire.libelle, etape: v.etape_code, clientExistant, client, vente, echeances, planning, affaire, rdv, etapes: rejeu.etapes, taches: rejeu.taches },
  };
}

/** Contrôle des en-têtes : toutes les colonnes de la section 13.1 sont attendues (l'ordre est libre). */
export function colonnesManquantes(entetes: readonly string[]): string[] {
  return COLONNES.filter((c) => !entetes.includes(c));
}
