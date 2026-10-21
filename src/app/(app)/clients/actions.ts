"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptateurs } from "@/adapters";
import { contremarqueParDefaut, erreursAffaire, libelleAffaire, nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";
import { moteurActif } from "@/server/process";

/** Contacts, clients et création d'affaires (EF-20 à EF-23). */

export type ClientTrouve = {
  id: string; nom: string; telephone: string | null; ville: string | null; magasin: string; affaires: number; visible: boolean;
};

/** Clients existants de tous les magasins, pour reconnaître un client qui revient (EF-21). */
export async function rechercherClients(q: string): Promise<ClientTrouve[]> {
  const moi = await exigerProfil();
  if (moi.role === "transverse" || q.trim().length < 2) return [];
  const db = await clientUtilisateur();
  const { data } = await db.rpc("rechercher_clients", { q: q.slice(0, 60) });
  return (data ?? []).map((c) => ({
    id: c.id,
    nom: nomClient({ type: c.type as ClientIdentite["type"], nom: c.nom, prenom: c.prenom, raison_sociale: c.raison_sociale }),
    telephone: c.telephone, ville: c.ville, magasin: c.magasin, affaires: c.affaires, visible: c.visible,
  }));
}

const vide = (s: string | undefined) => (s?.trim() ? s.trim() : null);

const entreeContact = z
  .object({
    type: z.enum(["particulier", "professionnel"]),
    nom: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
    prenom: z.string().max(60).optional(),
    raisonSociale: z.string().max(120).optional(),
    telephone: z.string().max(30).optional(),
    email: z.union([z.literal(""), z.email("Adresse e-mail invalide.")]).optional(),
    adresse: z.string().max(160).optional(),
    codePostal: z.string().max(10).optional(),
    ville: z.string().max(80).optional(),
    cnq: z.boolean(),
    source: z.string().max(40).optional(),
    rappelLe: z.union([z.literal(""), z.iso.date()]).optional(),
    magasinCode: z.string().max(6).optional(),
  })
  .refine((c) => c.type !== "professionnel" || !!c.raisonSociale?.trim(), { message: "Indiquez la raison sociale.", path: ["raisonSociale"] });
export type EntreeContact = z.input<typeof entreeContact>;

export type ResultatContact = { ok: true; clientId: string } | { ok: false; message: string };

/**
 * Contact rapide au R0 (EF-20) : seul le nom est obligatoire ; CNQ efface les coordonnées ; un rappel
 * convenu crée une tâche de relance à la date saisie (RG-35), sans rappel aucune relance (RG-33).
 */
export async function creerContact(brut: EntreeContact): Promise<ResultatContact> {
  const moi = await exigerProfil();
  if (moi.role === "transverse") return { ok: false, message: "Seuls les gérants et les conceptrices créent des contacts." };
  const lu = entreeContact.safeParse(brut);
  if (!lu.success) return { ok: false, message: lu.error.issues[0]?.message ?? "Contact invalide." };
  const c = lu.data;
  const db = await clientUtilisateur();

  const code = c.magasinCode ?? (moi.magasins.length === 1 ? moi.magasins[0].code : undefined);
  if (!code || (moi.role !== "gerant" && !moi.magasins.some((m) => m.code === code))) return { ok: false, message: "Choisissez le magasin." };
  const { data: magasin } = await db.from("magasin").select("id").eq("code", code).maybeSingle();
  if (!magasin) return { ok: false, message: "Magasin introuvable." };

  const aujourdhui = await adaptateurs().clock.today();
  if (c.rappelLe && c.rappelLe < aujourdhui) return { ok: false, message: "La date de rappel est déjà passée." };
  const pro = c.type === "professionnel";
  const { data: client, error } = await db
    .from("client")
    .insert({
      type: c.type, nom: c.nom.trim().toUpperCase(), prenom: vide(c.prenom), raison_sociale: pro ? vide(c.raisonSociale) : null,
      telephone: c.cnq ? null : vide(c.telephone), email: c.cnq ? null : vide(c.email), adresse: vide(c.adresse),
      code_postal: vide(c.codePostal), ville: vide(c.ville), cnq: c.cnq, source: vide(c.source), magasin_id: magasin.id,
      rappel_convenu_le: vide(c.rappelLe),
    })
    .select("id, type, nom, prenom, raison_sociale")
    .single();
  if (error?.code === "23505") return { ok: false, message: "Ce client existe déjà avec ce nom et ce téléphone : choisissez-le dans la liste." };
  if (error || !client) return { ok: false, message: "Le contact n'a pas pu être enregistré." };

  if (c.rappelLe) {
    await db.from("tache").insert({
      client_id: client.id, titre: `Rappeler ${nomClient(client as ClientIdentite)} (rappel convenu au R0)`,
      assignee_id: moi.id, echeance: c.rappelLe, origine: "relance",
    });
  }
  revalidatePath("/ma-journee");
  return { ok: true, clientId: client.id };
}

const entreeAffaires = z.object({
  clientId: z.uuid(),
  projets: z.array(z.string().trim().min(2).max(40)).min(1, "Choisissez au moins un projet.").max(6),
  contremarque: z.string().trim().max(120).optional(),
  concepteurId: z.uuid().optional(),
  magasinCode: z.string().max(6).optional(),
  depart: z.enum(["R0", "R1"]),
});
export type EntreeAffaires = z.input<typeof entreeAffaires>;
export type ResultatAffaires = { ok: true; affaires: string[] } | { ok: false; message: string };

/**
 * Crée une ou plusieurs affaires pour un client (EF-23, RG-02, RG-03) : libellé et contremarque
 * préremplis, démarrées au R0 ou au R1 dans la version de process active (RG-04), tout ou rien.
 */
export async function creerAffaires(brut: EntreeAffaires): Promise<ResultatAffaires> {
  const moi = await exigerProfil();
  if (moi.role === "transverse") return { ok: false, message: "Seuls les gérants et les conceptrices créent des affaires." };
  const lu = entreeAffaires.safeParse(brut);
  if (!lu.success) return { ok: false, message: lu.error.issues[0]?.message ?? "Demande invalide." };
  const e = lu.data;
  const concepteurId = e.concepteurId ?? moi.id;
  const code = e.magasinCode ?? (moi.magasins.length === 1 ? moi.magasins[0].code : undefined);
  if (!code) return { ok: false, message: "Choisissez le magasin." };
  const erreurs = e.projets.flatMap((projet) => erreursAffaire({ clientId: e.clientId, concepteurId, projet }));
  if (erreurs.length) return { ok: false, message: erreurs[0] };

  const db = await clientUtilisateur();
  const [{ data: magasin }, trouve] = await Promise.all([
    db.from("magasin").select("id").eq("code", code).maybeSingle(),
    db.from("client").select("type, nom, prenom, raison_sociale").eq("id", e.clientId).maybeSingle(),
  ]);
  if (!magasin) return { ok: false, message: "Magasin introuvable." };
  // Un client d'un autre magasin n'est pas encore lisible : son identité vient de public.identite_client (EF-21).
  let identite = trouve.data as ClientIdentite | null;
  if (!identite) {
    const { data } = await db.rpc("identite_client", { client_id: e.clientId });
    identite = (data?.[0] as ClientIdentite | undefined) ?? null;
  }
  if (!identite) return { ok: false, message: "Client introuvable." };

  const { moteur, versionId } = await moteurActif(db);
  const { clock } = adaptateurs();
  const [maintenant, aujourdhui] = await Promise.all([clock.now(), clock.today()]);
  const affaires = [];
  for (const projet of e.projets) {
    const demarrage = moteur.demarrer({ quand: maintenant.toISOString(), aujourdhui, par: moi.id }, e.depart);
    if (!demarrage.ok) return { ok: false, message: demarrage.message };
    affaires.push({
      magasin_id: magasin.id, concepteur_id: concepteurId, projet,
      libelle: libelleAffaire(identite, projet), contremarque: e.contremarque || contremarqueParDefaut(identite),
      process_version_id: versionId, effets: demarrage.effets,
    });
  }
  const { data: ids, error } = await db.rpc("creer_affaires", { client_id: e.clientId, affaires: affaires as never });
  if (error) return { ok: false, message: ["42501", "22023", "P0002"].includes(error.code) ? error.message : "Les affaires n'ont pas pu être créées." };
  revalidatePath(`/clients/${e.clientId}`);
  revalidatePath("/affaires");
  return { ok: true, affaires: ids ?? [] };
}
