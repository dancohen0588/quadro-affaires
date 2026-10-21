import "server-only";
import { adaptateurs } from "@/adapters";
import {
  construireDocumentsVue, construireIntervenants, construireProcessVue,
  type DocumentVue, type EtapeVue, type IntervenantVue, type PhaseVue,
} from "@/lib/affaire/fiche";
import { construireHistorique, type EvenementVue, type JournalLigne } from "@/lib/affaire/historique";
import { nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import type { Role } from "@/lib/process/schema";
import { clientUtilisateur } from "@/lib/supabase/server";
import { cleEtape } from "@/lib/process/etat";
import { chargerAffaireProcess } from "./process";
import type { ProfilCourant } from "./session";
import type { CommandeVue } from "@/components/commandes/bloc-commandes";
import type { EcheanceVue } from "@/components/vente/dialogues-vente";

/**
 * Données de la fiche affaire (EF-30 à EF-41), lues avec les droits de l'utilisateur (RLS) :
 * une affaire qu'il ne voit pas est introuvable.
 */

export type IssueOption = {
  code: string;
  libelle: string;
  type: string;
  motifObligatoire: boolean;
  demandeDate: boolean;
  /** Étapes optionnelles à ouvrir en parallèle (section 7.4). */
  options: { etape: string; question: string }[];
};

export type EtapeAValider = {
  cle: string;
  code: string;
  iteration: number;
  titre: string;
  branche: string;
  issues: IssueOption[];
  /** Motif du blocage RG-01, ou null. */
  blocage: string | null;
  /** L'utilisateur peut-il valider cette étape (section 12) ? */
  autorisee: boolean;
};

export type RdvVue = { id: string; type: string; rang: number; debut: string; statut: string; notes: string | null; avec: string | null };

export type Fiche = {
  id: string;
  libelle: string;
  projet: string;
  contremarque: string;
  statut: string;
  motifPerte: string | null;
  etapeCourante: { code: string; titre: string; phaseNumero: string; phaseNom: string; couleur: string } | null;
  derniereActivite: string;
  magasin: { code: string; nom: string };
  concepteur: { id: string; prenom: string; nom: string };
  client: { id: string; nom: string; telephone: string | null; email: string | null; adresse: string | null; type: string };
  montantDevisHtCts: number | null;
  vente: {
    id: string; dateSignature: string; montantHtCts: number; montantTtcCts: number; financement: string; gesteosRef: string | null;
    commissionLe: string | null; affaires: string[];
  } | null;
  echeances: EcheanceVue[];
  planning: {
    statut: string; semaineLivraison: string | null; livraisonConfirmee: boolean; datePose: string | null; poseConfirmee: boolean; poseur: string | null;
    semaineSouhaitee: string | null; datePoseSouhaitee: string | null; proposition: { semaine: string | null; datePose: string | null } | null;
    commentaire: string | null;
  } | null;
  commandes: CommandeVue[];
  /** Affaires du même client vendables ensemble (EF-50), si cette affaire est en présentation ou en vente. */
  vendables: { id: string; libelle: string; montantDevisHtCts: number | null }[] | null;
  estGerant: boolean;
  rdv: RdvVue[];
  process: { nom: string; phases: PhaseVue[]; faites: number; total: number };
  aValider: EtapeAValider[];
  motifs: string[];
  documents: DocumentVue[];
  intervenants: IntervenantVue[];
  historique: EvenementVue[];
  /** Réassignation (EF-41) : concepteurs possibles, pour un gérant seulement. */
  concepteursPossibles: { id: string; nom: string }[] | null;
  peutModifier: boolean;
  aujourdhui: string;
};

/** RG-08 : l'étape VENTE se valide en créant la vente, jamais seule. */
export const MESSAGE_VENTE = "Créez la vente depuis le bloc « Vente et règlements » : l'étape se valide avec elle (RG-08).";

const ROLES_REFERENTS: Exclude<Role, "concepteur">[] = ["gerant_bpa", "gerant_logistique", "gerant_finance", "responsable_r4"];

export async function chargerFiche(affaireId: string, moi: ProfilCourant): Promise<Fiche | null> {
  const db = await clientUtilisateur();
  const { data: a, error } = await db
    .from("affaire")
    .select(
      "id, libelle, projet, contremarque, statut, motif_perte, montant_devis_ht_cts, derniere_activite_at, vente_id, " +
        "client:client(id, type, nom, prenom, raison_sociale, telephone, email, adresse, code_postal, ville), " +
        "magasin:magasin(code, nom), concepteur:profil!affaire_concepteur_id_fkey(id, prenom, nom, initiales, role)",
    )
    .eq("id", affaireId)
    .maybeSingle();
  if (error) throw new Error(`Lecture de l'affaire : ${error.message}`);
  if (!a) return null;
  type Lue = {
    id: string; libelle: string; projet: string; contremarque: string; statut: string; motif_perte: string | null;
    montant_devis_ht_cts: number | null; derniere_activite_at: string; vente_id: string | null;
    client: ClientIdentite & { id: string; telephone: string | null; email: string | null; adresse: string | null; code_postal: string | null; ville: string | null };
    magasin: { code: string; nom: string };
    concepteur: { id: string; prenom: string; nom: string; initiales: string; role: string };
  };
  const x = a as unknown as Lue;

  const venteId = x.vente_id;
  const [processus, etapes, taches, rdv, documents, journal, profils, parametres, vente, echeances, planning] = await Promise.all([
    chargerAffaireProcess(db, affaireId),
    db.from("etape_instance").select("id, etape_code, iteration, statut, branche, issue_code, motif, debut_at, fin_at, valide_par").eq("affaire_id", affaireId),
    db.from("tache").select("id, etape_instance_id, titre, statut, optionnelle, echeance, assignee_id").eq("affaire_id", affaireId),
    db.from("rdv").select("id, type, rang, debut, statut, notes, profil_id").eq("affaire_id", affaireId).order("debut"),
    db.from("document").select("type_doc, nom_final, created_at").eq("affaire_id", affaireId),
    db.from("journal")
      .select("id, table_nom, ligne_id, action, avant, apres, auteur_id, at")
      .or(venteId ? `affaire_id.eq.${affaireId},vente_id.eq.${venteId}` : `affaire_id.eq.${affaireId}`)
      .order("at", { ascending: false })
      .limit(300),
    db.from("profil").select("id, prenom, nom, initiales, role, actif"),
    db.from("parametre").select("cle, valeur").in("cle", [...ROLES_REFERENTS, "motifs_non_vente"]),
    venteId
      ? db.from("vente").select("id, date_signature, montant_ht_cts, montant_ttc_cts, financement, gesteos_devis_ref, commission_saisie_le, affaire(libelle)").eq("id", venteId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    venteId
      ? db.from("echeance").select("id, type, ordre, recu_le, montant_recu_cts, date_attendue, montant_prevu_cts, mode, commentaire").eq("vente_id", venteId).order("ordre")
      : Promise.resolve({ data: [], error: null }),
    venteId
      ? db.from("planning").select("semaine_livraison_souhaitee, semaine_livraison_confirmee, date_pose_souhaitee, date_pose_confirmee, poseur, statut, commentaire").eq("vente_id", venteId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [etapes, taches, rdv, documents, journal, profils, parametres, vente, echeances, planning]) {
    if (r.error) throw new Error(`Lecture de la fiche : ${r.error.message}`);
  }
  if (!processus) return null;
  const [{ data: commandes }, { data: memeClient }] = await Promise.all([
    db.from("commande_fournisseur").select("*").eq("affaire_id", affaireId).order("created_at"),
    db.from("affaire").select("id, libelle, montant_devis_ht_cts, statut, vente_id").eq("client_id", x.client.id).eq("statut", "active"),
  ]);

  const aujourdhui = await adaptateurs().clock.today();
  const definition = processus.moteur.definition;
  const parProfil = new Map((profils.data ?? []).map((p) => [p.id, p]));
  const prenomDe = (id: string | null) => (id ? (parProfil.get(id)?.prenom ?? null) : null);
  const parametre = new Map((parametres.data ?? []).map((p) => [p.cle, p.valeur]));
  const close = ["perdue", "abandonnee", "cloturee"].includes(x.statut);
  const lignesEtapes = etapes.data ?? [];

  // Droits (section 12) : gérant partout, conceptrice dans ses magasins, responsable R4 sur le R4.
  const peutModifier = moi.role === "gerant" || (moi.role === "conceptrice" && moi.magasins.some((m) => m.code === x.magasin.code));
  const r4 = moi.role === "transverse" && moi.rubriques.includes("r4_avis");
  const etapesDef = new Map(definition.phases.flatMap((p) => p.etapes.map((e) => [e.code, { etape: e, phase: p }] as const)));
  const aValider: EtapeAValider[] = processus.moteur.ouvertes(processus.etat).map((e) => {
    const { etape } = etapesDef.get(e.code)!;
    return {
      cle: cleEtape(e),
      code: e.code,
      iteration: e.iteration,
      titre: e.iteration > 1 ? `${etape.titre} (${e.code}.${e.iteration})` : etape.titre,
      branche: e.branche,
      issues: etape.issues.map((i) => ({
        code: i.code,
        libelle: i.libelle,
        type: i.type,
        motifObligatoire: !!i.motif_obligatoire,
        demandeDate: !!i.demande_date,
        options: (i.ouvre ?? []).filter((o) => o.optionnel).map((o) => ({ etape: o.etape, question: o.question ?? `Ouvrir ${etapesDef.get(o.etape)?.etape.titre ?? o.etape} ?` })),
      })),
      blocage: processus.moteur.blocage(processus.etat, e.code) ?? (e.code === "VENTE" ? MESSAGE_VENTE : null),
      autorisee: peutModifier || (r4 && e.code === "R4"),
    };
  });

  const courant = processus.moteur.etapeCourante(processus.etat.etapes);
  const defCourant = courant ? etapesDef.get(courant) : undefined;
  const nom = nomClient(x.client);
  const confirme = planning.data?.statut === "confirmee";
  const semaine = (confirme ? planning.data?.semaine_livraison_confirmee : null) ?? planning.data?.semaine_livraison_souhaitee ?? null;
  const ouvertesIci = processus.moteur.ouvertes(processus.etat).map((e) => e.code);
  const personne = (id: unknown) => {
    const p = typeof id === "string" ? parProfil.get(id) : undefined;
    return p ? { prenom: p.prenom, initiales: p.initiales } : null;
  };

  return {
    id: x.id,
    libelle: x.libelle,
    projet: x.projet,
    contremarque: x.contremarque,
    statut: x.statut,
    motifPerte: x.motif_perte,
    etapeCourante: defCourant
      ? { code: courant!, titre: defCourant.etape.titre, phaseNumero: defCourant.phase.numero, phaseNom: defCourant.phase.nom, couleur: defCourant.phase.couleur }
      : null,
    derniereActivite: x.derniere_activite_at,
    magasin: x.magasin,
    concepteur: { id: x.concepteur.id, prenom: x.concepteur.prenom, nom: x.concepteur.nom },
    client: {
      id: x.client.id,
      nom,
      type: x.client.type,
      telephone: x.client.telephone,
      email: x.client.email,
      adresse: [x.client.adresse, [x.client.code_postal, x.client.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    },
    montantDevisHtCts: x.montant_devis_ht_cts,
    vente: vente.data
      ? {
          id: vente.data.id, dateSignature: vente.data.date_signature, montantHtCts: vente.data.montant_ht_cts, montantTtcCts: vente.data.montant_ttc_cts,
          financement: vente.data.financement, gesteosRef: vente.data.gesteos_devis_ref, commissionLe: vente.data.commission_saisie_le,
          affaires: ((vente.data.affaire ?? []) as { libelle: string }[]).map((a) => a.libelle).sort((a, b) => a.localeCompare(b, "fr")),
        }
      : null,
    echeances: (echeances.data ?? []).map((e) => ({
      id: e.id, type: e.type, ordre: e.ordre, recuLe: e.recu_le, montantRecuCts: e.montant_recu_cts, dateAttendue: e.date_attendue,
      montantPrevuCts: e.montant_prevu_cts, mode: e.mode, commentaire: e.commentaire,
    })),
    planning: planning.data
      ? {
          statut: planning.data.statut,
          semaineLivraison: semaine,
          livraisonConfirmee: confirme && !!planning.data.semaine_livraison_confirmee,
          datePose: (confirme ? planning.data.date_pose_confirmee : null) ?? planning.data.date_pose_souhaitee,
          poseConfirmee: confirme && !!planning.data.date_pose_confirmee,
          poseur: planning.data.poseur,
          semaineSouhaitee: planning.data.semaine_livraison_souhaitee,
          datePoseSouhaitee: planning.data.date_pose_souhaitee,
          proposition: planning.data.statut === "decalee"
            ? { semaine: planning.data.semaine_livraison_confirmee, datePose: planning.data.date_pose_confirmee }
            : null,
          commentaire: planning.data.commentaire,
        }
      : null,
    commandes: (commandes ?? []).map((c) => ({
      id: c.id, fournisseur: c.fournisseur, iteration: c.iteration, gesteosRef: c.gesteos_commande_ref, envoyeeLe: c.envoyee_le,
      semaineDemandee: c.semaine_demandee, lieuLivraison: c.lieu_livraison, prixAchatCts: c.prix_achat_cts, points: c.points === null ? null : Number(c.points),
      arcRecuLe: c.arc_recu_le, arRecuLe: c.ar_recu_le, semaineAnnoncee: c.semaine_annoncee, confirmationRecueLe: c.confirmation_recue_le,
      bpaVersion: c.bpa_version, bpaDonneLe: c.bpa_donne_le, statut: c.statut,
    })),
    vendables: x.statut === "active" && peutModifier && (ouvertesIci.includes("R3") || ouvertesIci.includes("VENTE"))
      ? (memeClient ?? [])
          // Toutes les affaires actives du client ; le moteur vérifie à la création qu'elles sont en R3 ou en Vente.
          .filter((m) => !m.vente_id)
          .map((m) => ({ id: m.id, libelle: m.libelle, montantDevisHtCts: m.montant_devis_ht_cts }))
      : null,
    estGerant: moi.role === "gerant",
    rdv: (rdv.data ?? []).map((r) => ({ id: r.id, type: r.type, rang: r.rang, debut: r.debut, statut: r.statut, notes: r.notes, avec: prenomDe(r.profil_id) })),
    process: { nom: definition.nom, ...construireProcessVue(definition, lignesEtapes, taches.data ?? [], { aujourdhui, prenomDe }) },
    aValider,
    motifs: (parametre.get("motifs_non_vente") ?? []) as string[],
    documents: construireDocumentsVue(definition, lignesEtapes, documents.data ?? [], {
      contremarque: x.contremarque, projet: x.projet, client: nom, semaine,
    }),
    intervenants: construireIntervenants(definition, lignesEtapes, {
      concepteur: { prenom: x.concepteur.prenom, initiales: x.concepteur.initiales, role: x.concepteur.role, magasin: x.magasin.nom },
      referents: Object.fromEntries(ROLES_REFERENTS.map((r) => [r, personne(parametre.get(r))])),
      close,
    }),
    // Les traces de la vente commune sont gardées, pas celles des autres affaires qu'elle regroupe.
    historique: construireHistorique(
      ((journal.data ?? []) as (JournalLigne & { ligne_id: string | null })[]).filter((j) => !(j.table_nom === "affaire" && j.ligne_id !== affaireId)),
      { definition, prenomDe },
    ),
    concepteursPossibles:
      moi.role === "gerant"
        ? (profils.data ?? [])
            .filter((p) => p.actif && (p.role === "conceptrice" || p.role === "gerant"))
            .map((p) => ({ id: p.id, nom: `${p.prenom} ${p.nom}`.trim() }))
            .sort((p1, p2) => p1.nom.localeCompare(p2.nom, "fr"))
        : null,
    peutModifier,
    aujourdhui,
  };
}

export type { EtapeVue };
