import "server-only";
import { adaptateurs } from "@/adapters";
import { estAVenir, estDuJour, type TacheJournee } from "@/lib/affaire/journee";
import { instantParis, jourDe } from "@/lib/format";
import { jaugesSemaine, type Jauges } from "@/lib/rules/charge";
import { ajouterJours, joursEntre, joursOuvresEcoules } from "@/lib/rules/calendrier";
import { nomClient, type ClientIdentite } from "@/lib/rules/affaire";
import type { Role } from "@/lib/process/schema";
import { clientUtilisateur } from "@/lib/supabase/server";
import { chargerReferentiel, type Referentiel } from "./referentiel";
import type { ProfilCourant } from "./session";

/** Données de Ma journée (EF-10 à EF-18), lues avec les droits de l'utilisateur. */

type Definition = { phases: { numero: string; nom: string; couleur: string; etapes: { code: string; titre: string }[] }[] };
export type EtapeAffichee = { titre: string; numero: string; couleur: string };

export type Relance = { id: string; titre: string; echeance: string; lien: string; libelle: string; detail: string | null };
export type Reglement = { id: string; affaireId: string; libelle: string; type: string; montantCts: number; dateAttendue: string; enRetard: boolean };
export type ElementFile = { affaireId: string; libelle: string; depuis: string; detail: string | null; enRetard: boolean };
export type File = { titre: string; vide: string; elements: ElementFile[] };

export type Journee = {
  aujourdhui: string;
  aFaire: TacheJournee[];
  aVenir: TacheJournee[];
  rdvDuJour: number;
  jauges: Jauges;
  relances: Relance[];
  reglements: Reglement[];
  mesAffaires: { enCours: number; sansMouvement: number; signees: number; signeesTtcCts: number };
  files: File[];
  etapes: Record<string, EtapeAffichee>;
  referentiel: Referentiel;
  /** Affaires auxquelles rattacher une tâche libre (EF-13). */
  affairesPourTache: { id: string; libelle: string }[];
};

type TacheLue = {
  id: string; titre: string; detail: string | null; echeance: string | null; statut: string; fait_le: string | null; origine: string;
  affaire: { id: string; libelle: string; contremarque: string; etape_courante_code: string | null } | null;
  client: (ClientIdentite & { id: string }) | null;
  etape_instance: { etape_code: string } | null;
};

const ROLES_FILES: Exclude<Role, "concepteur" | "responsable_r4">[] = ["gerant_bpa", "gerant_logistique", "gerant_finance"];

export async function chargerJournee(moi: ProfilCourant): Promise<Journee> {
  const db = await clientUtilisateur();
  const aujourdhui = await adaptateurs().clock.today();
  const dans7 = ajouterJours(aujourdhui, 7);
  const debutMois = `${aujourdhui.slice(0, 7)}-01`;

  const [taches, rdv, referentiel, version, mesAffaires, parametres, ventesMois] = await Promise.all([
    db.from("tache")
      .select("id, titre, detail, echeance, statut, fait_le, origine, affaire:affaire(id, libelle, contremarque, etape_courante_code), client:client(id, type, nom, prenom, raison_sociale), etape_instance(etape_code)")
      .eq("assignee_id", moi.id)
      .or(`and(statut.eq.a_faire,echeance.lte.${dans7}),and(statut.eq.faite,fait_le.gte.${instantParis(aujourdhui, "00:00")})`)
      .order("echeance", { ascending: true })
      .limit(500),
    db.from("rdv").select("type, debut, statut, notes").eq("profil_id", moi.id)
      .gte("debut", instantParis(ajouterJours(aujourdhui, -7), "00:00")).lte("debut", instantParis(ajouterJours(aujourdhui, 7), "23:59")),
    chargerReferentiel(moi),
    db.from("process_version").select("definition").eq("active", true).maybeSingle(),
    db.from("affaire").select("id, libelle, statut, derniere_activite_at, vente_id").eq("concepteur_id", moi.id).in("statut", ["active", "gagnee"]),
    db.from("parametre").select("cle, valeur").in("cle", ROLES_FILES),
    db.from("vente").select("id, montant_ttc_cts, date_signature, affaire(concepteur_id)").gte("date_signature", debutMois).lte("date_signature", aujourdhui),
  ]);
  for (const r of [taches, rdv, mesAffaires, parametres, ventesMois]) if (r.error) throw new Error(`Ma journée : ${r.error.message}`);

  // Étapes affichées (titre, phase) d'après la version active.
  const etapes: Record<string, EtapeAffichee> = {};
  for (const p of (version.data?.definition as unknown as Definition | undefined)?.phases ?? []) {
    for (const e of p.etapes) etapes[e.code] = { titre: e.titre, numero: p.numero, couleur: p.couleur };
  }

  const lues = (taches.data ?? []) as unknown as TacheLue[];
  const vues: TacheJournee[] = lues.map((t) => ({
    id: t.id, titre: t.titre, detail: t.detail, echeance: t.echeance, statut: t.statut, faitLe: t.fait_le, origine: t.origine,
    affaire: t.affaire ? { id: t.affaire.id, libelle: t.affaire.libelle, contremarque: t.affaire.contremarque, etape: t.affaire.etape_courante_code } : null,
    etape: t.etape_instance ? (etapes[t.etape_instance.etape_code]?.titre ?? t.etape_instance.etape_code) : null,
  }));

  // Relances dues (EF-15, RG-33 à RG-36) : à faire aujourd'hui ou en retard, vers l'affaire ou le client.
  const relances: Relance[] = lues
    .filter((t) => t.origine === "relance" && t.statut === "a_faire" && t.echeance && t.echeance <= aujourdhui)
    .map((t) => ({
      id: t.id, titre: t.titre, echeance: t.echeance!, detail: t.detail,
      lien: t.affaire ? `/affaires/${t.affaire.id}` : t.client ? `/clients/${t.client.id}` : "/affaires",
      libelle: t.affaire?.libelle ?? (t.client ? nomClient(t.client) : "Relance"),
    }));
  const idsRelances = new Set(relances.map((r) => r.id));

  // Files des gérants (EF-17) selon leur rôle de référent.
  const roles = new Set((parametres.data ?? []).filter((p) => p.valeur === moi.id).map((p) => p.cle));
  const files: File[] = [];
  const etapesOuvertes = async (codes: string[]) => {
    const { data } = await db.from("etape_instance")
      .select("etape_code, debut_at, affaire:affaire!inner(id, libelle, statut)")
      .eq("statut", "en_cours").in("etape_code", codes).order("debut_at");
    return (data ?? []) as unknown as { etape_code: string; debut_at: string; affaire: { id: string; libelle: string; statut: string } }[];
  };
  if (roles.has("gerant_bpa")) {
    const bpa = await etapesOuvertes(["BPA"]);
    files.push({
      titre: "BPA à donner", vide: "Aucun BPA en attente.",
      elements: bpa.map((e) => {
        const jours = joursOuvresEcoules(jourDe(e.debut_at), aujourdhui);
        return { affaireId: e.affaire.id, libelle: e.affaire.libelle, depuis: e.debut_at, detail: `${jours} j ouvré${jours > 1 ? "s" : ""}`, enRetard: jours > 3 };
      }),
    });
  }
  if (roles.has("gerant_logistique")) {
    const { data: plannings } = await db.from("planning")
      .select("created_at, semaine_livraison_souhaitee, date_pose_souhaitee, vente:vente!inner(affaire(id, libelle))").eq("statut", "demandee").order("created_at");
    type PlanningLu = { created_at: string; semaine_livraison_souhaitee: string | null; date_pose_souhaitee: string | null; vente: { affaire: { id: string; libelle: string }[] } };
    files.push({
      titre: "Plannings à confirmer", vide: "Aucune demande de planning.",
      elements: ((plannings ?? []) as unknown as PlanningLu[]).flatMap((p) => p.vente.affaire.slice(0, 1).map((a) => ({
        affaireId: a.id, libelle: p.vente.affaire.map((x) => x.libelle).join(" + "), depuis: p.created_at,
        detail: [p.semaine_livraison_souhaitee?.replace(/^\d{4}-/, "livraison "), p.date_pose_souhaitee && `pose ${p.date_pose_souhaitee.slice(8)}/${p.date_pose_souhaitee.slice(5, 7)}`].filter(Boolean).join(" · ") || null,
        enRetard: joursEntre(jourDe(p.created_at), aujourdhui) > 2,
      }))),
    });
    const dossiers = await etapesOuvertes(["DOSSIER_POSE"]);
    files.push({
      titre: "Dossiers de pose à vérifier", vide: "Aucun dossier de pose en cours.",
      elements: dossiers.map((e) => ({ affaireId: e.affaire.id, libelle: e.affaire.libelle, depuis: e.debut_at, detail: null, enRetard: joursEntre(jourDe(e.debut_at), aujourdhui) > 5 })),
    });
  }
  if (roles.has("gerant_finance")) {
    const factures = await etapesOuvertes(["FACTURE_RECAP"]);
    files.push({
      titre: "Factures récapitulatives à éditer", vide: "Aucune facture à éditer.",
      elements: factures.map((e) => ({ affaireId: e.affaire.id, libelle: e.affaire.libelle, depuis: e.debut_at, detail: null, enRetard: joursEntre(jourDe(e.debut_at), aujourdhui) > 3 })),
    });
  }

  // Règlements à suivre (EF-16) : échéances attendues sous 7 jours ou en retard, de mes affaires
  // (toutes pour le gérant finance).
  const ventesSuivies = roles.has("gerant_finance") ? null : (mesAffaires.data ?? []).map((a) => a.vente_id).filter((v): v is string => !!v);
  let reglements: Reglement[] = [];
  if (ventesSuivies === null || ventesSuivies.length) {
    let req = db.from("echeance").select("id, type, montant_prevu_cts, date_attendue, vente:vente!inner(affaire(id, libelle))")
      .is("recu_le", null).not("date_attendue", "is", null).lte("date_attendue", dans7).order("date_attendue").limit(50);
    if (ventesSuivies) req = req.in("vente_id", ventesSuivies);
    const { data } = await req;
    type EcheanceLue = { id: string; type: string; montant_prevu_cts: number; date_attendue: string; vente: { affaire: { id: string; libelle: string }[] } };
    reglements = ((data ?? []) as unknown as EcheanceLue[])
      .filter((e) => e.vente.affaire.length)
      .map((e) => ({
        id: e.id, affaireId: e.vente.affaire[0].id, libelle: e.vente.affaire.map((a) => a.libelle).join(" + "), type: e.type,
        montantCts: e.montant_prevu_cts, dateAttendue: e.date_attendue, enRetard: e.date_attendue < aujourdhui,
      }));
  }

  const seuil = referentiel.seuils.inactivite_jours;
  type VenteLue = { id: string; montant_ttc_cts: number; affaire: { concepteur_id: string }[] };
  const signees = ((ventesMois.data ?? []) as unknown as VenteLue[]).filter((v) => v.affaire.some((a) => a.concepteur_id === moi.id));

  return {
    aujourdhui,
    aFaire: vues.filter((t) => estDuJour(t, aujourdhui) && !idsRelances.has(t.id)),
    aVenir: vues.filter((t) => estAVenir(t, aujourdhui)),
    rdvDuJour: (rdv.data ?? []).filter((r) => r.statut !== "annule" && jourDe(r.debut) === aujourdhui).length,
    jauges: jaugesSemaine(rdv.data ?? [], aujourdhui, referentiel.seuils),
    relances,
    reglements,
    mesAffaires: {
      enCours: mesAffaires.data?.length ?? 0,
      sansMouvement: (mesAffaires.data ?? []).filter((a) => joursEntre(jourDe(a.derniere_activite_at), aujourdhui) > seuil).length,
      signees: signees.length,
      signeesTtcCts: signees.reduce((s, v) => s + v.montant_ttc_cts, 0),
    },
    files,
    etapes,
    referentiel,
    affairesPourTache: (mesAffaires.data ?? []).map((a) => ({ id: a.id, libelle: a.libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
  };
}

/** Nombre de tâches du jour et en retard, pour le badge de la navigation. */
export async function compterTachesDuJour(moi: { id: string }): Promise<number> {
  const db = await clientUtilisateur();
  const aujourdhui = await adaptateurs().clock.today();
  const { count } = await db.from("tache").select("id", { count: "exact", head: true })
    .eq("assignee_id", moi.id).eq("statut", "a_faire").lte("echeance", aujourdhui);
  return count ?? 0;
}
