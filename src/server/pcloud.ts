import "server-only";
import { adaptateurs } from "@/adapters";
import { jourDe } from "@/lib/format";
import { cheminLogique, nomDossierAffaire, type FichierArbre } from "@/lib/pcloud";
import { nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import { clientAdmin, clientUtilisateur } from "@/lib/supabase/server";

/**
 * PCloud simulé côté serveur (section 13.4) : dossier de chaque affaire, copie du modèle « NOUVEAU CLIENT »,
 * lecture de l'arborescence d'un client. Les droits sont vérifiés par la lecture de l'affaire avec le client de
 * l'utilisateur ; l'écriture du dossier passe par la clé secrète (le stockage n'est jamais exposé au navigateur).
 */

export async function chargerModelePcloud(): Promise<string[]> {
  const { data } = await clientAdmin().from("parametre").select("valeur").eq("cle", "pcloud_modele").maybeSingle();
  return Array.isArray(data?.valeur) ? (data.valeur as string[]) : [];
}

/** Dossier PCloud de l'affaire, créé (copie du modèle) s'il n'existe pas encore. */
export async function assurerDossierAffaire(affaireId: string): Promise<string> {
  const admin = clientAdmin();
  const { data: a, error } = await admin
    .from("affaire")
    .select("id, projet, pcloud_folder_id, magasin:magasin(code), client:client(type, nom, prenom, raison_sociale), concepteur:profil!affaire_concepteur_id_fkey(prenom)")
    .eq("id", affaireId)
    .single();
  if (error || !a) throw new Error(`PCloud simulé : affaire introuvable (${error?.message ?? ""})`);
  if (a.pcloud_folder_id) return a.pcloud_folder_id;
  const x = a as unknown as { projet: string; magasin: { code: string }; client: ClientIdentite; concepteur: { prenom: string } };
  const chemin = nomDossierAffaire({ magasinCode: x.magasin.code, client: nomClient(x.client), projet: x.projet, concepteur: x.concepteur.prenom });
  const dossier = await adaptateurs().fileStore.creerDossierClient({ chemin, sousDossiers: await chargerModelePcloud() });
  await admin.from("affaire").update({ pcloud_folder_id: dossier.id, pcloud_url: dossier.url ?? `/pcloud?affaire=${affaireId}` }).eq("id", affaireId);
  return dossier.id;
}

/** À la création des affaires : copie du modèle pour chacune. Un échec n'annule jamais la création (journalisé). */
export async function creerDossiersAffaires(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    try {
      await assurerDossierAffaire(id);
    } catch (e) {
      console.error("Dossier PCloud simulé non créé", id, e);
    }
  }
}

export type DossierAffaire = { affaireId: string; libelle: string; chemin: string | null; fichiers: FichierArbre[] };

/** Arborescence PCloud des affaires d'un client, avec les droits de l'utilisateur (RLS). */
export async function chargerPcloudClient(clientId: string) {
  const db = await clientUtilisateur();
  const [{ data: client }, { data: affaires }, modele] = await Promise.all([
    db.from("client").select("id, type, nom, prenom, raison_sociale").eq("id", clientId).maybeSingle(),
    db.from("affaire").select("id, libelle, pcloud_folder_id, created_at").eq("client_id", clientId).order("created_at"),
    chargerModelePcloud(),
  ]);
  if (!client) return null;
  const ids = (affaires ?? []).map((a) => a.id);
  const { data: documents } = ids.length
    ? await db.from("document").select("id, affaire_id, nom_final, dossier_pcloud, pcloud_file_id, created_at, depose_par:profil!document_depose_par_fkey(prenom)").in("affaire_id", ids)
    : { data: [] };
  type DocLu = { id: string; affaire_id: string; nom_final: string; dossier_pcloud: string; pcloud_file_id: string | null; created_at: string; depose_par: { prenom: string } | null };
  const docs = (documents ?? []) as unknown as DocLu[];
  const fileStore = adaptateurs().fileStore;
  const liens = new Map(await Promise.all(docs.map(async (d) => [d.id, d.pcloud_file_id ? await fileStore.lien({ fichierId: d.pcloud_file_id }).catch(() => null) : null] as const)));
  const dossiers: DossierAffaire[] = (affaires ?? []).map((a) => ({
    affaireId: a.id, libelle: a.libelle, chemin: a.pcloud_folder_id,
    fichiers: docs.filter((d) => d.affaire_id === a.id).map((d) => ({
      id: d.id, nom: d.nom_final, dossier: cheminLogique(d.dossier_pcloud), deposeLe: jourDe(d.created_at), parQui: d.depose_par?.prenom ?? null, lien: liens.get(d.id) ?? null,
    })),
  }));
  return { client: { id: client.id, nom: nomClient(client as ClientIdentite) }, modele, dossiers };
}
