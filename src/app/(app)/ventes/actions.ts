"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { mailBpaADonner, mailDemandePlanning, mailFactureRecap, mailPlanningRepondu } from "@/lib/mails/modeles";
import type { Effet, EtatAffaire } from "@/lib/process/moteur";
import { erreursVente } from "@/lib/rules/affaire";
import { ECHEANCIER_STANDARD, erreursEcheancier, toutesRecues, type LigneEcheancier, type TypeEcheance } from "@/lib/rules/echeancier";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { lienAbsolu, notifier, referent } from "@/server/notifications";
import { chargerAffaireProcess } from "@/server/process";

/**
 * Vente, règlements, planning et commandes (session 3.2 : EF-50 à EF-53, EF-60 à EF-62, EF-70 à EF-73,
 * RG-08, RG-10 à RG-15). Les écritures à plusieurs tables passent par des fonctions SQL tout ou rien.
 */

export type Resultat = { ok: true; avertissements: string[]; id?: string } | { ok: false; message: string };
const refus = (message: string): Resultat => ({ ok: false, message });
const MESSAGES_SQL = ["42501", "22023", "P0001", "P0002", "40001", "23514"];
const depuisSql = (e: { code?: string; message: string } | null, defaut: string) =>
  refus(e && MESSAGES_SQL.includes(e.code ?? "") ? e.message.replace(/^.*violates check constraint "echeance_pas_franfinance_acompte_1".*$/, "Franfinance n'est pas accepté sur l'acompte 1 (RG-13).") : defaut);

const TYPES = ["acompte_1", "acompte_2", "solde", "autre"] as const;
const MODES = ["cheque", "cb", "virement", "especes", "franfinance"] as const;
const semaine = z.string().regex(/^\d{4}-S\d{2}$/);

const ligne = z.object({
  type: z.enum(TYPES),
  montantCts: z.number().int().min(0),
  dateAttendue: z.iso.date().nullable().optional(),
  mode: z.enum(MODES).nullable().optional(),
  commentaire: z.string().trim().max(200).nullable().optional(),
});

const entreeVente = z.object({
  affaireIds: z.array(z.uuid()).min(1).max(6),
  dateSignature: z.iso.date(),
  montantHtCts: z.number().int().min(1),
  montantTtcCts: z.number().int().min(1),
  financement: z.enum(["aucun", "franfinance"]),
  gesteosRef: z.string().trim().max(40).optional(),
  lignes: z.array(ligne).min(1).max(12),
  semaineLivraison: semaine.nullable().optional(),
  datePose: z.iso.date().nullable().optional(),
});
export type EntreeVente = z.input<typeof entreeVente>;

/** Tâches de l'étape VENTE accomplies par la création de la vente elle-même. */
const FAITES_PAR_LA_VENTE = ["creer_vente", "saisir_dates"];

/**
 * Crée la vente d'une ou plusieurs affaires du même client (EF-50, RG-08) avec son échéancier (EF-51,
 * RG-10 à RG-13) : les affaires passent « gagnee », l'étape VENTE est validée (après la présentation si
 * besoin), l'acompte 1 s'ouvre et la demande de planning part chez le gérant logistique (EF-60).
 */
export async function creerVente(brut: EntreeVente): Promise<Resultat> {
  const moi = await exigerProfil();
  if (moi.role === "transverse") return refus("Seuls les gérants et les conceptrices créent une vente.");
  const lu = entreeVente.safeParse(brut);
  if (!lu.success) return refus(lu.error.issues[0]?.message ?? "Vente invalide.");
  const v = lu.data;
  if (v.montantTtcCts < v.montantHtCts) return refus("Le montant TTC ne peut pas être inférieur au HT.");

  const lignes: LigneEcheancier[] = v.lignes.map((l, i) => ({
    type: l.type as TypeEcheance, ordre: i + 1,
    pourcentage: ECHEANCIER_STANDARD.find((s) => s.type === l.type && l.type !== "autre")?.pourcentage ?? 0,
    montantPrevuCts: l.montantCts, dateAttendue: l.type === "acompte_1" ? v.dateSignature : (l.dateAttendue ?? null), mode: l.mode ?? null,
  }));
  const erreurs = erreursEcheancier(lignes, v.montantTtcCts);
  if (erreurs.length) return refus(erreurs[0]);

  const db = await clientUtilisateur();
  const { data: affaires } = await db.from("affaire").select("id, libelle, client_id, statut, magasin_id, concepteur_id").in("id", v.affaireIds);
  if (!affaires || affaires.length !== v.affaireIds.length) return refus("Affaire introuvable.");
  const regle = erreursVente(affaires);
  if (regle.length) return refus(regle[0]);

  // Effets du moteur pour chaque affaire : présentation conclue par une vente si besoin, puis VENTE validée.
  const { clock } = adaptateurs();
  const [maintenant, aujourdhui] = await Promise.all([clock.now(), clock.today()]);
  const moment = { quand: maintenant.toISOString(), aujourdhui, par: moi.id };
  const avertissements: string[] = [];
  const parAffaire = [];
  for (const a of affaires) {
    const p = await chargerAffaireProcess(db, a.id);
    if (!p) return refus("Affaire introuvable.");
    let etat: EtatAffaire = p.etat;
    const effets: Effet[] = [];
    const ouvertes = p.moteur.ouvertes(etat).map((e) => e.code);
    if (!ouvertes.includes("VENTE")) {
      if (!ouvertes.includes("R3")) return refus(`${a.libelle} n'est ni en présentation ni en vente : la vente se crée depuis le R3 ou l'étape Vente.`);
      const r3 = p.moteur.valider(etat, { ...moment, etape: "R3", issue: "vente", dates: p.dates });
      if (!r3.ok) return refus(r3.message);
      effets.push(...r3.effets);
      etat = r3.etat;
    }
    const instance = etat.etapes.find((e) => e.code === "VENTE" && e.statut === "en_cours")!;
    effets.push({ type: "faire_taches", etape: "VENTE", iteration: instance.iteration, codes: FAITES_PAR_LA_VENTE });
    // Ces tâches sont faites par la vente : elles ne sont ni annulées ni signalées (RG-05).
    const titresFaits = new Set(
      p.moteur.definition.phases.flatMap((ph) => ph.etapes).find((e) => e.code === "VENTE")?.taches
        .filter((t) => FAITES_PAR_LA_VENTE.includes(t.code)).map((t) => t.titre) ?? [],
    );
    const r = p.moteur.valider(
      { ...etat, statut: "gagnee", tachesOuvertes: etat.tachesOuvertes.filter((t) => !(t.etape === "VENTE" && titresFaits.has(t.titre))) },
      { ...moment, etape: "VENTE", issue: "vendu", dates: p.dates },
    );
    if (!r.ok) return refus(r.message);
    effets.push(...r.effets);
    avertissements.push(...r.avertissements.map((x) => `${a.libelle} · ${x}`));
    parAffaire.push({ id: a.id, effets, ouvertes: p.ouvertes });
  }

  const { data: venteId, error } = await db.rpc("creer_vente", {
    vente: {
      client_id: affaires[0].client_id, magasin_id: affaires[0].magasin_id, date_signature: v.dateSignature,
      montant_ht_cts: v.montantHtCts, montant_ttc_cts: v.montantTtcCts, financement: v.financement, gesteos_devis_ref: v.gesteosRef ?? null,
    },
    echeances: lignes.map((l, i) => ({
      type: l.type, ordre: l.ordre, pourcentage: l.pourcentage || null, montant_prevu_cts: l.montantPrevuCts,
      date_attendue: l.dateAttendue, mode: l.mode, commentaire: v.lignes[i].commentaire ?? null,
    })),
    affaires: parAffaire as never,
    planning: { semaine_livraison_souhaitee: v.semaineLivraison ?? null, date_pose_souhaitee: v.datePose ?? null },
  });
  if (error || !venteId) return depuisSql(error, "La vente n'a pas pu être enregistrée.");

  await notifier(await referent("gerant_logistique"), "planning", mailDemandePlanning({
    affaires: affaires.map((a) => a.libelle), concepteur: moi.prenom, semaine: v.semaineLivraison ?? null, datePose: v.datePose ?? null,
    lien: await lienAbsolu("/planning"),
  }));
  for (const a of affaires) revalidatePath(`/affaires/${a.id}`);
  revalidatePath("/planning");
  return { ok: true, avertissements, id: venteId };
}

// ── Règlements (EF-52, RG-14, RG-15) ──────────────────────────────────────────────────────────

const entreeReception = z.object({
  echeanceId: z.uuid(),
  recuLe: z.iso.date(),
  montantCts: z.number().int().min(1),
  mode: z.enum(MODES),
});
export type EntreeReception = z.input<typeof entreeReception>;

const VERIFICATIONS: Record<string, string> = { acompte_1: "verifier_acompte_1", acompte_2: "verifier_acompte_2", solde: "verifier_solde" };

/**
 * Saisit la réception d'un règlement (EF-52). Un montant inférieur au prévu laisse la ligne partiellement
 * reçue. La tâche « Vérifier la réception » correspondante est faite ; l'acompte 1 rappelle la commission
 * (RG-14) ; quand tout est reçu, la facture récapitulative est demandée au gérant finance (RG-15).
 */
export async function saisirReception(brut: EntreeReception): Promise<Resultat> {
  const moi = await exigerProfil();
  const lu = entreeReception.safeParse(brut);
  if (!lu.success) return refus("Indiquez la date, le montant et le mode du règlement.");
  const r = lu.data;
  const { clock } = adaptateurs();
  const [maintenant, aujourdhui] = await Promise.all([clock.now(), clock.today()]);
  if (r.recuLe > aujourdhui) return refus("La date de réception est dans le futur.");

  const db = await clientUtilisateur();
  const { data: e, error } = await db
    .from("echeance")
    .update({ recu_le: r.recuLe, montant_recu_cts: r.montantCts, mode: r.mode, saisi_par: moi.id })
    .eq("id", r.echeanceId)
    .is("recu_le", null)
    .select("type, vente_id")
    .maybeSingle();
  if (error) return depuisSql(error, "Le règlement n'a pas pu être enregistré.");
  if (!e) return refus("Ce règlement est déjà saisi ou ne vous est pas accessible.");

  const [{ data: affaires }, { data: lignes }, { data: vente }] = await Promise.all([
    db.from("affaire").select("id, libelle, concepteur_id").eq("vente_id", e.vente_id),
    db.from("echeance").select("recu_le").eq("vente_id", e.vente_id),
    db.from("vente").select("montant_ttc_cts").eq("id", e.vente_id).single(),
  ]);
  const ids = (affaires ?? []).map((a) => a.id);
  const fait = { statut: "faite", fait_le: maintenant.toISOString(), fait_par: moi.id };
  if (VERIFICATIONS[e.type] && ids.length) {
    await db.from("tache").update(fait).in("affaire_id", ids).eq("modele_code", VERIFICATIONS[e.type]).eq("statut", "a_faire");
  }
  const premiere = affaires?.[0];
  // RG-14 : rappel de la commission au concepteur, une fois.
  if (e.type === "acompte_1" && premiere) {
    const { count } = await db.from("tache").select("id", { count: "exact", head: true }).eq("affaire_id", premiere.id).eq("modele_code", "commission");
    if (!count) {
      await db.from("tache").insert({
        affaire_id: premiere.id, modele_code: "commission", titre: "Reporter la vente au tableau de commission (RG-14)",
        assignee_id: premiere.concepteur_id, echeance: aujourdhui, origine: "alerte",
      });
    }
  }
  // RG-15 : tout est reçu, la facture récapitulative est à éditer.
  if (premiere && toutesRecues((lignes ?? []).map((l) => ({ recuLe: l.recu_le })))) {
    const { count } = await db.from("tache").select("id", { count: "exact", head: true }).eq("affaire_id", premiere.id).eq("modele_code", "facture_recap");
    if (!count) {
      const jean = await referent("gerant_finance");
      if (jean) {
        await db.from("tache").insert({
          affaire_id: premiere.id, modele_code: "facture_recap", titre: "Éditer la facture récapitulative : tous les règlements sont reçus",
          assignee_id: jean, echeance: aujourdhui, origine: "alerte",
        });
        await notifier(jean, "facture_recap", mailFactureRecap({
          affaires: (affaires ?? []).map((a) => a.libelle), montantTtcCts: vente?.montant_ttc_cts ?? 0, lien: await lienAbsolu(`/affaires/${premiere.id}`),
        }));
      }
    }
  }
  for (const id of ids) revalidatePath(`/affaires/${id}`);
  revalidatePath("/reglements");
  return { ok: true, avertissements: [] };
}

/** RG-14 : la vente est reportée au tableau de commission (hors outil en V1). */
export async function marquerCommission(venteId: string): Promise<Resultat> {
  await exigerProfil();
  if (!z.uuid().safeParse(venteId).success) return refus("Vente invalide.");
  const db = await clientUtilisateur();
  const aujourdhui = await adaptateurs().clock.today();
  const { data, error } = await db.from("vente").update({ commission_saisie_le: aujourdhui }).eq("id", venteId).select("id");
  if (error || !data?.length) return depuisSql(error, "La vente n'a pas pu être mise à jour.");
  const { data: affaires } = await db.from("affaire").select("id").eq("vente_id", venteId);
  const maintenant = await adaptateurs().clock.now();
  await db.from("tache").update({ statut: "faite", fait_le: maintenant.toISOString() }).in("affaire_id", (affaires ?? []).map((a) => a.id))
    .eq("modele_code", "commission").eq("statut", "a_faire");
  for (const a of affaires ?? []) revalidatePath(`/affaires/${a.id}`);
  return { ok: true, avertissements: [] };
}

const entreeEcheancier = z.object({
  venteId: z.uuid(),
  lignes: z.array(ligne.extend({ id: z.uuid().optional() })).min(1).max(12),
});
export type EntreeEcheancier = z.input<typeof entreeEcheancier>;

/**
 * Modifie l'échéancier (EF-51, RG-13) : montants, dates, modes et commentaires des lignes non reçues,
 * ajout de lignes (chèques échelonnés). Les lignes reçues ne changent pas ; la somme reste égale au TTC.
 */
export async function modifierEcheancier(brut: EntreeEcheancier): Promise<Resultat> {
  await exigerProfil();
  const lu = entreeEcheancier.safeParse(brut);
  if (!lu.success) return refus("Échéancier invalide.");
  const { venteId, lignes } = lu.data;
  const db = await clientUtilisateur();
  const [{ data: vente }, { data: existantes }] = await Promise.all([
    db.from("vente").select("montant_ttc_cts").eq("id", venteId).maybeSingle(),
    db.from("echeance").select("id, type, ordre, montant_prevu_cts, recu_le").eq("vente_id", venteId),
  ]);
  if (!vente || !existantes) return refus("Vente introuvable.");
  const recues = new Map(existantes.filter((e) => e.recu_le).map((e) => [e.id, e]));
  const parId = new Map(existantes.map((e) => [e.id, e]));
  if (lignes.some((l) => l.id && !parId.has(l.id))) return refus("Ligne inconnue.");
  if (existantes.some((e) => !lignes.some((l) => l.id === e.id))) return refus("Une ligne ne peut pas être retirée : mettez son montant à 0.");
  const finales: LigneEcheancier[] = lignes.map((l, i) => {
    const recue = l.id ? recues.get(l.id) : undefined;
    return {
      type: (recue?.type ?? l.type) as TypeEcheance, ordre: i + 1, pourcentage: 0,
      montantPrevuCts: recue ? recue.montant_prevu_cts : l.montantCts, dateAttendue: l.dateAttendue ?? null, mode: l.mode ?? null,
    };
  });
  const erreurs = erreursEcheancier(finales, vente.montant_ttc_cts);
  if (erreurs.length) return refus(erreurs[0]);

  let ordre = Math.max(0, ...existantes.map((e) => e.ordre));
  for (const l of lignes) {
    if (l.id && recues.has(l.id)) continue;
    const champs = { montant_prevu_cts: l.montantCts, date_attendue: l.dateAttendue ?? null, mode: l.mode ?? null, commentaire: l.commentaire ?? null };
    const { error } = l.id
      ? await db.from("echeance").update(champs).eq("id", l.id).is("recu_le", null)
      : await db.from("echeance").insert({ ...champs, vente_id: venteId, type: l.type, ordre: ++ordre });
    if (error) return depuisSql(error, "L'échéancier n'a pas pu être enregistré.");
  }
  const { data: affaires } = await db.from("affaire").select("id").eq("vente_id", venteId);
  for (const a of affaires ?? []) revalidatePath(`/affaires/${a.id}`);
  revalidatePath("/reglements");
  return { ok: true, avertissements: [] };
}

// ── Planning (EF-61) ──────────────────────────────────────────────────────────────────────────

const entreePlanning = z.object({
  venteId: z.uuid(),
  statut: z.enum(["confirmee", "decalee"]),
  semaine: semaine,
  datePose: z.iso.date(),
  poseur: z.string().trim().max(80).optional(),
  commentaire: z.string().trim().max(300).optional(),
});
export type EntreePlanning = z.input<typeof entreePlanning>;

/** Le gérant confirme la livraison et la pose ou propose d'autres dates ; le concepteur est prévenu (EF-61). */
export async function repondrePlanning(brut: EntreePlanning): Promise<Resultat> {
  const moi = await exigerProfil();
  if (moi.role !== "gerant") return refus("Seul un gérant confirme ou décale un planning.");
  const lu = entreePlanning.safeParse(brut);
  if (!lu.success) return refus("Indiquez la semaine de livraison et la date de pose.");
  const p = lu.data;
  const db = await clientUtilisateur();
  const { error } = await db.rpc("confirmer_planning", {
    vente_id: p.venteId, statut: p.statut, semaine: p.semaine, date_pose: p.datePose, poseur: p.poseur ?? "", commentaire: p.commentaire ?? "",
  });
  if (error) return depuisSql(error, "Le planning n'a pas pu être enregistré.");
  const { data: affaires } = await db.from("affaire").select("id, libelle, concepteur_id").eq("vente_id", p.venteId);
  const premiere = affaires?.[0];
  if (premiere) {
    if (p.statut === "decalee") {
      const aujourdhui = await adaptateurs().clock.today();
      await db.from("tache").insert({
        affaire_id: premiere.id, titre: "Valider avec le client les nouvelles dates proposées pour la livraison et la pose",
        assignee_id: premiere.concepteur_id, echeance: aujourdhui, origine: "alerte",
      });
    }
    await notifier(premiere.concepteur_id, "planning", mailPlanningRepondu({
      affaires: (affaires ?? []).map((a) => a.libelle), statut: p.statut, semaine: p.semaine, datePose: p.datePose,
      poseur: p.poseur ?? null, commentaire: p.commentaire ?? null, par: moi.prenom, lien: await lienAbsolu(`/affaires/${premiere.id}`),
    }));
  }
  for (const a of affaires ?? []) revalidatePath(`/affaires/${a.id}`);
  revalidatePath("/planning");
  return { ok: true, avertissements: [] };
}

// ── Commandes (EF-70 à EF-72) ─────────────────────────────────────────────────────────────────

const date = z.iso.date().nullable().optional();
const entreeCommande = z.object({
  id: z.uuid().optional(),
  affaireId: z.uuid(),
  fournisseur: z.string().trim().min(2).max(80),
  gesteosRef: z.string().trim().max(40).nullable().optional(),
  envoyeeLe: date,
  semaineDemandee: semaine.nullable().optional(),
  lieuLivraison: z.string().trim().max(80).nullable().optional(),
  prixAchatCts: z.number().int().min(0).nullable().optional(),
  points: z.number().min(0).nullable().optional(),
  arcRecuLe: date,
  arRecuLe: date,
  semaineAnnoncee: semaine.nullable().optional(),
  confirmationRecueLe: date,
  bpaVersion: z.string().trim().max(20).nullable().optional(),
  bpaDonneLe: date,
});
export type EntreeCommande = z.input<typeof entreeCommande>;

/** Statut d'une commande d'après les dates saisies. */
function statutCommande(c: z.infer<typeof entreeCommande>): string {
  if (c.bpaDonneLe) return "bpa_donne";
  if (c.confirmationRecueLe) return "en_verification";
  if (c.arcRecuLe || c.arRecuLe) return "arc_recu";
  if (c.envoyeeLe) return "envoyee";
  return "a_passer";
}

/**
 * Crée ou complète une commande fournisseur (EF-70 à EF-72) : envoi, ARC ou AR, confirmation, versions de
 * BPA, BPA donné (gérants seulement, gardé par trigger). Une confirmation AGEM prévient Benjamin (EF-73).
 */
export async function enregistrerCommande(brut: EntreeCommande): Promise<Resultat> {
  await exigerProfil();
  const lu = entreeCommande.safeParse(brut);
  if (!lu.success) return refus(lu.error.issues[0]?.message ?? "Commande invalide.");
  const c = lu.data;
  const db = await clientUtilisateur();
  const avant = c.id ? (await db.from("commande_fournisseur").select("confirmation_recue_le, iteration").eq("id", c.id).maybeSingle()).data : null;
  const champs = {
    affaire_id: c.affaireId, fournisseur: c.fournisseur, gesteos_commande_ref: c.gesteosRef ?? null, envoyee_le: c.envoyeeLe ?? null,
    semaine_demandee: c.semaineDemandee ?? null, lieu_livraison: c.lieuLivraison ?? null, prix_achat_cts: c.prixAchatCts ?? null,
    points: c.points ?? null, arc_recu_le: c.arcRecuLe ?? null, ar_recu_le: c.arRecuLe ?? null, semaine_annoncee: c.semaineAnnoncee ?? null,
    confirmation_recue_le: c.confirmationRecueLe ?? null, bpa_version: c.bpaVersion ?? null, bpa_donne_le: c.bpaDonneLe ?? null,
    statut: statutCommande(c),
  };
  const { error } = c.id
    ? await db.from("commande_fournisseur").update(champs).eq("id", c.id)
    : await db.from("commande_fournisseur").insert(champs);
  if (error) return depuisSql(error, "La commande n'a pas pu être enregistrée.");

  if (c.fournisseur.toUpperCase() === "AGEM" && c.confirmationRecueLe && !avant?.confirmation_recue_le && !c.bpaDonneLe) {
    const { data: a } = await db.from("affaire").select("libelle").eq("id", c.affaireId).maybeSingle();
    await notifier(await referent("gerant_bpa"), "bpa", mailBpaADonner({
      affaire: a?.libelle ?? "Affaire", version: c.bpaVersion ?? null, confirmationLe: c.confirmationRecueLe, lien: await lienAbsolu(`/affaires/${c.affaireId}`),
    }));
  }
  revalidatePath(`/affaires/${c.affaireId}`);
  revalidatePath("/ma-journee");
  return { ok: true, avertissements: [] };
}
