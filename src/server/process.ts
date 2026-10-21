import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { cleEtape, construireEtat, datesAffaire, type LignesAffaire } from "@/lib/process/etat";
import { creerMoteur, type DatesAffaire, type Effet, type EtatAffaire, type Moteur } from "@/lib/process/moteur";
import type { ProcessDefinition } from "@/lib/process/schema";
import { chargerProcess } from "@/lib/process/valider";

/**
 * Lecture d'une affaire pour le moteur de process et écriture de ses effets (session 2.1).
 * Tout passe par le client de l'utilisateur : la lecture respecte la RLS, l'écriture est contrôlée par
 * public.appliquer_effets (droits, concurrence, RG-01 par trigger).
 */

type Client = SupabaseClient<Database>;

export class ErreurProcess extends Error {}

const lire = <T>(r: { data: T | null; error: { message: string } | null }, quoi: string): T => {
  if (r.error) throw new ErreurProcess(`${quoi} : ${r.error.message}`);
  if (r.data === null) throw new ErreurProcess(`${quoi} : introuvable`);
  return r.data;
};

// Une version de process publiée ne change plus (RG-04) : elle est validée une fois par processus.
const definitions = new Map<string, ProcessDefinition>();

export type AffaireProcess = {
  affaireId: string;
  moteur: Moteur;
  etat: EtatAffaire;
  dates: DatesAffaire;
  /** Étapes ouvertes à la lecture (« R3.2 »), vérifiées à l'écriture. */
  ouvertes: string[];
};

/** Charge l'état d'une affaire visible par l'utilisateur, ou null si elle ne l'est pas. */
export async function chargerAffaireProcess(db: Client, affaireId: string): Promise<AffaireProcess | null> {
  const { data: affaire, error } = await db
    .from("affaire")
    .select("id, statut, avis_google_obtenu_le, vente_id, process_version_id")
    .eq("id", affaireId)
    .maybeSingle();
  if (error) throw new ErreurProcess(`Lecture de l'affaire : ${error.message}`);
  if (!affaire) return null;

  const [etapes, taches, rdv, acompte, planning, parametres, version] = await Promise.all([
    db.from("etape_instance")
      .select("etape_code, iteration, statut, branche, phase_code, issue_code, motif, debut_at, fin_at, valide_par")
      .eq("affaire_id", affaireId),
    db.from("tache")
      .select("titre, optionnelle, etape_instance!inner(etape_code, iteration)")
      .eq("affaire_id", affaireId)
      .eq("statut", "a_faire"),
    db.from("rdv").select("type, rang, debut, statut").eq("affaire_id", affaireId),
    affaire.vente_id
      ? db.from("echeance").select("id").eq("vente_id", affaire.vente_id).eq("type", "acompte_1").not("recu_le", "is", null).limit(1)
      : Promise.resolve({ data: [], error: null }),
    affaire.vente_id
      ? db.from("planning")
          .select("date_pose_confirmee, date_pose_souhaitee, semaine_livraison_confirmee, semaine_livraison_souhaitee")
          .eq("vente_id", affaire.vente_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("parametre").select("cle, valeur").in("cle", ["motifs_non_vente", "seuils"]),
    definitions.has(affaire.process_version_id)
      ? Promise.resolve({ data: null, error: null })
      : db.from("process_version").select("definition").eq("id", affaire.process_version_id).single(),
  ]);

  if (!definitions.has(affaire.process_version_id)) {
    const { definition } = lire(version, "Version de process");
    definitions.set(affaire.process_version_id, chargerProcess(definition));
  }
  const parametre = new Map(lire(parametres, "Paramètres").map((p) => [p.cle, p.valeur]));
  const seuils = (parametre.get("seuils") ?? {}) as { relance_r2_sans_reponse_jours?: number };
  const moteur = creerMoteur(definitions.get(affaire.process_version_id)!, {
    motifsAutorises: (parametre.get("motifs_non_vente") ?? []) as string[],
    relanceSansReponseJours: seuils.relance_r2_sans_reponse_jours,
  });

  type TacheLue = { titre: string; optionnelle: boolean; etape_instance: { etape_code: string; iteration: number } };
  if (planning.error) throw new ErreurProcess(`Planning : ${planning.error.message}`);
  const lignes: LignesAffaire = {
    affaire,
    etapes: lire(etapes, "Étapes"),
    taches: (lire(taches, "Tâches") as unknown as TacheLue[]).map((t) => ({
      etape_code: t.etape_instance.etape_code,
      iteration: t.etape_instance.iteration,
      titre: t.titre,
      optionnelle: t.optionnelle,
    })),
    acompte1Recu: lire(acompte, "Échéances").length > 0,
    rdv: lire(rdv, "RDV"),
    planning: planning.data,
  };
  const etat = construireEtat(lignes);
  return {
    affaireId,
    moteur,
    etat,
    dates: datesAffaire(lignes),
    ouvertes: moteur.ouvertes(etat).map(cleEtape),
  };
}

/** Écrit les effets d'une décision du moteur en une transaction. Renvoie un message d'erreur lisible, ou null. */
export async function appliquerEffets(db: Client, a: AffaireProcess, effets: Effet[]): Promise<string | null> {
  const { error } = await db.rpc("appliquer_effets", {
    affaire_id: a.affaireId,
    effets: effets as unknown as Database["public"]["Functions"]["appliquer_effets"]["Args"]["effets"],
    ouvertes: a.ouvertes,
  });
  if (!error) return null;
  // Refus attendus (droits, concurrence, RG-01) : leur message est rédigé pour l'utilisateur.
  if (["42501", "40001", "P0001"].includes(error.code)) return error.message;
  console.error("appliquer_effets", error);
  return "L'enregistrement a échoué. Réessayez dans un instant.";
}
