"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { enregistrerCommande } from "@/app/(app)/ventes/actions";
import { extraireDebit, memeTexte, type ExtractionDebit } from "@/lib/debit/agem";
import { DocxIllisible, paragraphesDocx } from "@/lib/debit/docx";
import { cheminLogique } from "@/lib/pcloud";
import { TACHE_DU_DOCUMENT, formatAccepte, nomDeDepot } from "@/lib/rules/documents";
import { clientUtilisateur } from "@/lib/supabase/server";
import { chargerFiche } from "@/server/fiche-affaire";
import { exigerProfil } from "@/server/garde";
import { assurerDossierAffaire } from "@/server/pcloud";

/** Taille maximale d'un dépôt en démo (limite des fonctions Vercel : 4,5 Mo par requête). */
const TAILLE_MAX = 4 * 1024 * 1024;

export type CommandeAgem = {
  id: string; gesteosRef: string | null; envoyeeLe: string | null; semaineDemandee: string | null; lieuLivraison: string | null;
  prixAchatCts: number | null; points: number | null;
};
export type LectureDebit = ExtractionDebit & { contremarqueOk: boolean; concepteurOk: boolean; commandeExistante: CommandeAgem | null };
export type ResultatDepot =
  | { ok: true; nomFinal: string; dossier: string; debit: LectureDebit | null }
  | { ok: false; message: string };

type Db = Awaited<ReturnType<typeof clientUtilisateur>>;

/** Marque faites les tâches que le dépôt (ou la saisie) accomplit dans l'étape ouverte. */
async function faireTaches(db: Db, affaireId: string, etape: string, codes: string[], moi: string) {
  const { data: ouvertes } = await db.from("etape_instance").select("id").eq("affaire_id", affaireId).eq("etape_code", etape).eq("statut", "en_cours");
  const ids = (ouvertes ?? []).map((e) => e.id);
  if (!ids.length || !codes.length) return;
  const maintenant = await adaptateurs().clock.now();
  await db.from("tache").update({ statut: "faite", fait_le: maintenant.toISOString(), fait_par: moi })
    .eq("affaire_id", affaireId).in("etape_instance_id", ids).in("modele_code", codes).eq("statut", "a_faire");
}

async function commandeAgemOuverte(db: Db, affaireId: string): Promise<CommandeAgem | null> {
  const { data } = await db.from("commande_fournisseur")
    .select("id, gesteos_commande_ref, envoyee_le, semaine_demandee, lieu_livraison, prix_achat_cts, points")
    .eq("affaire_id", affaireId).eq("fournisseur", "AGEM").neq("statut", "livree").order("iteration", { ascending: false }).limit(1);
  const c = data?.[0];
  return c ? {
    id: c.id, gesteosRef: c.gesteos_commande_ref, envoyeeLe: c.envoyee_le, semaineDemandee: c.semaine_demandee, lieuLivraison: c.lieu_livraison,
    prixAchatCts: c.prix_achat_cts, points: c.points === null ? null : Number(c.points),
  } : null;
}

/**
 * Dépôt d'un document attendu sur la fiche affaire (section 7.3, 13.4) : contrôle du format, renommage selon le
 * gabarit, rangement dans le sous-dossier du PCloud simulé, ligne `document` (la référence), tâche
 * « Enregistrer … dans PCloud » faite. Pour le débit AGEM, lecture des champs (section 13.3), proposés ensuite
 * à la validation : rien n'est écrit dans la commande à ce stade.
 */
export async function deposerDocument(donnees: FormData): Promise<ResultatDepot> {
  const moi = await exigerProfil();
  const affaireId = String(donnees.get("affaireId") ?? "");
  const code = String(donnees.get("code") ?? "");
  const fichier = donnees.get("fichier");
  if (!z.uuid().safeParse(affaireId).success || !code) return { ok: false, message: "Choisissez le document attendu." };
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Choisissez un fichier." };
  if (fichier.size > TAILLE_MAX) return { ok: false, message: "Fichier trop lourd pour la démo (4 Mo au plus)." };

  const fiche = await chargerFiche(affaireId, moi);
  if (!fiche || !fiche.peutModifier) return { ok: false, message: "Vous ne pouvez pas déposer de document sur cette affaire." };
  const doc = fiche.documents.find((d) => d.code === code && d.statut !== "a_venir");
  if (!doc) return { ok: false, message: "Ce document n'est pas attendu à ce stade de l'affaire." };
  if (!formatAccepte(doc.formats, fichier.name)) return { ok: false, message: `Format refusé : ${doc.formats.join(", ")} attendu.` };

  let debit: ExtractionDebit | null = null;
  if (code === "debit_agem") {
    try {
      debit = extraireDebit(paragraphesDocx(new Uint8Array(await fichier.arrayBuffer())));
    } catch (e) {
      return { ok: false, message: e instanceof DocxIllisible ? e.message : "Le débit n'a pas pu être lu." };
    }
  }

  const db = await clientUtilisateur();
  const { count } = await db.from("document").select("id", { count: "exact", head: true }).eq("affaire_id", affaireId).eq("type_doc", code);
  const version = (count ?? 0) + 1;
  try {
    const dossierId = await assurerDossierAffaire(affaireId);
    const nomFinal = nomDeDepot(doc.gabarit, { ...fiche.valeursGabarit, version }, fichier.name);
    const depose = await adaptateurs().fileStore.deposer({ dossierId, sousDossier: doc.dossier, nomFinal, contenu: fichier });
    const { data: etape } = await db.from("etape_instance").select("id").eq("affaire_id", affaireId).eq("etape_code", doc.etape)
      .order("iteration", { ascending: false }).limit(1);
    const { error } = await db.from("document").insert({
      affaire_id: affaireId, etape_instance_id: etape?.[0]?.id ?? null, type_doc: code, nom_original: fichier.name, nom_final: depose.nomFinal,
      dossier_pcloud: cheminLogique(doc.dossier), pcloud_file_id: depose.id, version,
    });
    if (error) return { ok: false, message: "Le fichier est rangé mais n'a pas pu être enregistré sur l'affaire." };
    if (TACHE_DU_DOCUMENT[code]) await faireTaches(db, affaireId, doc.etape, [TACHE_DU_DOCUMENT[code]], moi.id);
    revalidatePath(`/affaires/${affaireId}`);
    return {
      ok: true, nomFinal: depose.nomFinal, dossier: cheminLogique(doc.dossier),
      debit: debit && {
        ...debit,
        contremarqueOk: memeTexte(debit.contremarque, fiche.contremarque) || memeTexte(debit.contremarque, fiche.client.nom),
        concepteurOk: memeTexte(debit.concepteur, `${fiche.concepteur.prenom} ${fiche.concepteur.nom}`),
        commandeExistante: await commandeAgemOuverte(db, affaireId),
      },
    };
  } catch (e) {
    console.error("Dépôt PCloud simulé", e);
    return { ok: false, message: "Le fichier n'a pas pu être rangé dans le PCloud simulé." };
  }
}

const entreeDebit = z.object({
  affaireId: z.uuid(),
  gesteosRef: z.string().trim().min(1, "Indiquez le n° de commande Gesteos.").max(40),
  envoyeeLe: z.iso.date(),
  semaineDemandee: z.string().regex(/^\d{4}-S\d{2}$/).nullable(),
  lieuLivraison: z.string().trim().max(80).nullable(),
  prixAchatCts: z.number().int().min(0).nullable(),
  points: z.number().min(0).nullable(),
});
export type EntreeDebit = z.input<typeof entreeDebit>;

/**
 * Validation du débit lu (section 13.3) : les valeurs relues par le concepteur sont écrites dans la commande AGEM
 * ouverte (créée si besoin), la tâche « Saisir n° de commande… » est faite. KPI-11 suit.
 */
export async function validerDebit(brut: EntreeDebit) {
  const moi = await exigerProfil();
  const lu = entreeDebit.safeParse(brut);
  if (!lu.success) return { ok: false as const, message: lu.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = lu.data;
  const db = await clientUtilisateur();
  const { data: existante } = await db.from("commande_fournisseur").select("*")
    .eq("affaire_id", d.affaireId).eq("fournisseur", "AGEM").neq("statut", "livree").order("iteration", { ascending: false }).limit(1);
  const c = existante?.[0];
  const r = await enregistrerCommande({
    id: c?.id, affaireId: d.affaireId, fournisseur: "AGEM", gesteosRef: d.gesteosRef, envoyeeLe: d.envoyeeLe,
    semaineDemandee: d.semaineDemandee, lieuLivraison: d.lieuLivraison, prixAchatCts: d.prixAchatCts, points: d.points,
    arcRecuLe: c?.arc_recu_le ?? null, arRecuLe: c?.ar_recu_le ?? null, semaineAnnoncee: c?.semaine_annoncee ?? null,
    confirmationRecueLe: c?.confirmation_recue_le ?? null, bpaVersion: c?.bpa_version ?? null, bpaDonneLe: c?.bpa_donne_le ?? null,
  });
  if (!r.ok) return r;
  await faireTaches(db, d.affaireId, "COMMANDE_AGEM", ["saisir_commande"], moi.id);
  revalidatePath(`/affaires/${d.affaireId}`);
  return r;
}
