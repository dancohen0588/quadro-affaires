import "server-only";
import { adaptateurs } from "@/adapters";
import { instantParis, jourDe } from "@/lib/format";
import { type Alerte, type Periode, REGLES_REGLEMENT, filtrer, trierAlertes } from "@/lib/indicateurs/agregats";
import { construirePipeline, type AffairePipeline, type Colonne, type PhaseVue } from "@/lib/indicateurs/pipeline";
import { chargerProcess } from "@/lib/process/valider";
import { ajouterJours, semaineIso, type DateIso } from "@/lib/rules/calendrier";
import { clientUtilisateur } from "@/lib/supabase/server";
import { chargerReferentiel, type Referentiel } from "./referentiel";
import type { ProfilCourant } from "./session";

/**
 * Lecture des indicateurs (docs/indicateurs.md) : les vues SQL font les définitions, avec les droits de la
 * personne connectée ; ce module ne fait que filtrer et assembler pour Pipeline, Pilotage et Point du mardi.
 */

export type Db = Awaited<ReturnType<typeof clientUtilisateur>>;
export type Magasin = { id: string; code: string; nom: string };

function lire<T>(r: { data: T | null; error: { message: string } | null }, quoi: string): T {
  if (r.error) throw new Error(`${quoi} : ${r.error.message}`);
  return r.data as T;
}

/** Phases de la version de process active (validée par chargerProcess). */
async function chargerPhases(db: Db): Promise<PhaseVue[]> {
  const { data, error } = await db.from("process_version").select("definition").eq("active", true).single();
  if (error || !data) throw new Error(`Process actif : ${error?.message ?? "introuvable"}`);
  return chargerProcess(data.definition).phases.map((p) => ({
    code: p.code, numero: p.numero, nom: p.nom, couleur: p.couleur, etapes: p.etapes.map((e) => ({ code: e.code, titre: e.titre })),
  }));
}

async function chargerMagasins(db: Db): Promise<Magasin[]> {
  return lire(await db.from("magasin").select("id, code, nom").order("nom"), "Magasins");
}

export async function chargerAlertes(db: Db): Promise<Alerte[]> {
  const lignes = lire(await db.from("alertes").select("affaire_id, magasin_id, concepteur_id, regle, gravite, depuis, detail, montant_cts, echeance_id"), "Alertes");
  return trierAlertes(lignes as Alerte[]);
}

// ── Pipeline (EF-80 à EF-82) ──────────────────────────────────────────────────────────────────

export type FiltresPipeline = { magasin: string; concepteur: string; inactives: boolean };
export type Pipeline = { colonnes: Colonne[]; referentiel: Referentiel; aujourdhui: DateIso; magasin: Magasin | null };

export async function chargerPipeline(moi: ProfilCourant, f: FiltresPipeline): Promise<Pipeline> {
  const db = await clientUtilisateur();
  const [aujourdhui, referentiel, phases, magasins, alertes] = await Promise.all([
    adaptateurs().clock.today(), chargerReferentiel(moi), chargerPhases(db), chargerMagasins(db), chargerAlertes(db),
  ]);
  const magasin = magasins.find((m) => m.code === f.magasin) ?? null;

  let requete = db
    .from("affaire")
    .select("id, libelle, contremarque, etape_courante_code, montant_devis_ht_cts, derniere_activite_at, vente_id, magasin_id, magasin:magasin!inner(code, nom), concepteur:profil!affaire_concepteur_id_fkey(id, prenom, initiales)")
    .in("statut", ["active", "gagnee"])
    .limit(1000);
  if (magasin) requete = requete.eq("magasin_id", magasin.id);
  if (f.concepteur) requete = requete.eq("concepteur_id", f.concepteur);
  const [affaires, taches] = await Promise.all([
    requete,
    db.from("tache").select("affaire_id, titre, echeance, origine").eq("statut", "a_faire").eq("optionnelle", false)
      .not("affaire_id", "is", null).not("echeance", "is", null).limit(5000),
  ]);
  type Lue = {
    id: string; libelle: string; contremarque: string; etape_courante_code: string | null; montant_devis_ht_cts: number | null;
    derniere_activite_at: string; vente_id: string | null; magasin: { code: string; nom: string };
    concepteur: { id: string; prenom: string; initiales: string };
  };
  const lues = lire(affaires, "Affaires") as unknown as Lue[];
  const vues: AffairePipeline[] = lues.map((a) => ({
    id: a.id, libelle: a.libelle, contremarque: a.contremarque, etapeCode: a.etape_courante_code, montantCts: a.montant_devis_ht_cts,
    derniereActivite: jourDe(a.derniere_activite_at), vendue: !!a.vente_id, concepteur: a.concepteur, magasin: a.magasin,
  }));
  const colonnes = construirePipeline({
    phases, affaires: vues, alertes, aujourdhui, seuilInactivite: referentiel.seuils.inactivite_jours, inactivesSeulement: f.inactives,
    taches: lire(taches, "Tâches").map((t) => ({ affaireId: t.affaire_id!, titre: t.titre, echeance: t.echeance!, origine: t.origine })),
  });
  return { colonnes, referentiel, aujourdhui, magasin };
}

// ── Pilotage (EF-90 à EF-92) ──────────────────────────────────────────────────────────────────

export type AlerteVue = Alerte & { libelle: string; magasin: string; phase: { numero: string; nom: string; couleur: string } | null };
export type ReglementAVerifier = {
  id: string; affaireId: string; libelle: string; magasin: string; type: string; montantCts: number; dateAttendue: string; aRelancer: boolean;
};

export async function chargerPilotage(periode: Periode, magasinCode: string) {
  const db = await clientUtilisateur();
  const [aujourdhui, phases, magasins, alertes] = await Promise.all([
    adaptateurs().clock.today(), chargerPhases(db), chargerMagasins(db), chargerAlertes(db),
  ]);
  const magasin = magasins.find((m) => m.code === magasinCode) ?? null;
  const filtre = { magasinId: magasin?.id ?? null };
  const [periodes, ventes, flux, potentiel, transfo, rdv, reglements, delai, motifs, enCours, affaires, echeances, marge] = await Promise.all([
    db.from("kpi_periodes").select("code, libelle, debut, fin").order("ordre"),
    db.from("kpi_ventes").select("magasin_id, concepteur_id, nb_ventes, ca_ht_cts").eq("periode", periode),
    db.from("kpi_flux_entrant").select("magasin_id, concepteur_id, nb_clients, nb_cnq").eq("periode", periode),
    db.from("kpi_potentiel").select("magasin_id, concepteur_id, nb_affaires, potentiel_ht_cts"),
    db.from("kpi_transformation").select("magasin_id, concepteur_id, nb_r3, nb_vendues").eq("periode", periode),
    db.from("kpi_rdv").select("magasin_id, concepteur_id, type, nb").eq("periode", periode),
    db.from("kpi_reglements").select("magasin_id, concepteur_id, attendu_30j_cts, nb_attendus_30j, retard_cts, nb_retard"),
    db.from("kpi_delai_r1_vente").select("magasin_id, concepteur_id, nb_ventes, total_jours").eq("periode", periode),
    db.from("kpi_motifs").select("magasin_id, concepteur_id, motif, nb").eq("periode", periode),
    db.from("kpi_en_cours").select("magasin_id, concepteur_id, nb_affaires, nb_inactives"),
    db.from("affaire").select("id, libelle, etape_courante_code, magasin_id").in("statut", ["active", "gagnee"]).limit(2000),
    db.from("echeance")
      .select("id, type, montant_prevu_cts, date_attendue, vente:vente!inner(magasin_id, affaire(id, libelle))")
      .is("recu_le", null).gt("montant_prevu_cts", 0).not("date_attendue", "is", null).lte("date_attendue", ajouterJours(aujourdhui, 7))
      .order("date_attendue").limit(200),
    db.from("kpi_marge").select("magasin_id, concepteur_id, nb_ventes, ca_ht_cts, achats_cts").eq("periode", periode),
  ]);

  const phaseDe = new Map(phases.flatMap((p) => p.etapes.map((e) => [e.code, p] as const)));
  const nomMagasin = new Map(magasins.map((m) => [m.id, m.nom]));
  const lesAffaires = lire(affaires, "Affaires");
  const affaire = new Map(lesAffaires.map((a) => [a.id, a]));
  const alertesVues: AlerteVue[] = filtrer(alertes, filtre).map((x) => {
    const a = affaire.get(x.affaire_id);
    const p = a?.etape_courante_code ? phaseDe.get(a.etape_courante_code) : undefined;
    return { ...x, libelle: a?.libelle ?? "Affaire", magasin: nomMagasin.get(x.magasin_id ?? "") ?? "", phase: p ? { numero: p.numero, nom: p.nom, couleur: p.couleur } : null };
  });
  const aRelancer = new Set(alertes.filter((x) => (REGLES_REGLEMENT as readonly string[]).includes(x.regle)).map((x) => x.echeance_id));
  type EcheanceLue = { id: string; type: string; montant_prevu_cts: number; date_attendue: string; vente: { magasin_id: string; affaire: { id: string; libelle: string }[] } };
  const aVerifier: ReglementAVerifier[] = (lire(echeances, "Échéances") as unknown as EcheanceLue[])
    .filter((e) => e.vente.affaire.length && (!magasin || e.vente.magasin_id === magasin.id))
    .map((e) => ({
      id: e.id, affaireId: e.vente.affaire[0].id, libelle: e.vente.affaire.map((a) => a.libelle).join(" + "), magasin: nomMagasin.get(e.vente.magasin_id) ?? "",
      type: e.type, montantCts: e.montant_prevu_cts, dateAttendue: e.date_attendue, aRelancer: aRelancer.has(e.id),
    }))
    .sort((a, b) => Number(b.aRelancer) - Number(a.aRelancer) || a.dateAttendue.localeCompare(b.dateAttendue));

  const parPhase = phases.map((p) => ({
    numero: p.numero, nom: p.nom, couleur: p.couleur,
    nombre: lesAffaires.filter((a) => (!magasin || a.magasin_id === magasin.id) && a.etape_courante_code && phaseDe.get(a.etape_courante_code)?.code === p.code).length,
  }));

  return {
    aujourdhui, magasins, magasin,
    periodes: lire(periodes, "Périodes"),
    ventes: filtrer(lire(ventes, "KPI-01"), filtre),
    flux: filtrer(lire(flux, "KPI-03"), filtre),
    potentiel: filtrer(lire(potentiel, "KPI-04"), filtre),
    transformation: filtrer(lire(transfo, "KPI-05"), filtre),
    rdv: filtrer(lire(rdv, "KPI-06"), filtre),
    reglements: filtrer(lire(reglements, "KPI-08"), filtre),
    delai: filtrer(lire(delai, "KPI-09"), filtre),
    motifs: filtrer(lire(motifs, "KPI-10"), filtre),
    marge: filtrer(lire(marge, "KPI-11"), filtre),
    enCours: lire(enCours, "Affaires en cours"),
    alertes: alertesVues,
    aVerifier,
    parPhase,
  };
}
export type Pilotage = Awaited<ReturnType<typeof chargerPilotage>>;

// ── Point du mardi (EF-93) ────────────────────────────────────────────────────────────────────

export type ElementSemaine = { affaireId: string; libelle: string; quand: string };
export type ColonneMardi = {
  magasin: Magasin;
  potentiel: { cts: number; affaires: number };
  passee: { ventes: number; caHtCts: number; rdv: Record<"R1" | "R2" | "R3", number>; r3: number; vendues: number };
  aVenir: { r3: ElementSemaine[]; livraisons: ElementSemaine[]; poses: ElementSemaine[]; reglementsCts: number; nbReglements: number };
  alertes: AlerteVue[];
};

/** `db` : client de l'utilisateur (page), ou client admin pour le digest du lundi des traitements de nuit. */
export async function chargerPointDuMardi(dbFourni?: Db) {
  const db = dbFourni ?? (await clientUtilisateur());
  const [aujourdhui, phases, magasins, alertes] = await Promise.all([
    adaptateurs().clock.today(), chargerPhases(db), chargerMagasins(db), chargerAlertes(db),
  ]);
  const fin = ajouterJours(aujourdhui, 6);
  const semaines = [...new Set([semaineIso(aujourdhui), semaineIso(fin)])];
  const [periodes, ventes, rdv, transfo, r3, plannings, echeances, affaires, potentiel] = await Promise.all([
    db.from("kpi_periodes").select("code, debut, fin").eq("code", "semaine_precedente").single(),
    db.from("kpi_ventes").select("magasin_id, concepteur_id, nb_ventes, ca_ht_cts").eq("periode", "semaine_precedente"),
    db.from("kpi_rdv").select("magasin_id, concepteur_id, type, nb").eq("periode", "semaine_precedente"),
    db.from("kpi_transformation").select("magasin_id, concepteur_id, nb_r3, nb_vendues").eq("periode", "semaine_precedente"),
    db.from("rdv").select("debut, affaire:affaire!inner(id, libelle, magasin_id)").eq("type", "R3").eq("statut", "prevu")
      .gte("debut", instantParis(aujourdhui, "00:00")).lt("debut", instantParis(ajouterJours(fin, 1), "00:00")).order("debut"),
    db.from("planning").select("semaine_livraison_confirmee, date_pose_confirmee, vente:vente!inner(magasin_id, affaire(id, libelle))").eq("statut", "confirmee")
      .or(`semaine_livraison_confirmee.in.(${semaines.join(",")}),and(date_pose_confirmee.gte.${aujourdhui},date_pose_confirmee.lte.${fin})`),
    db.from("echeance").select("montant_prevu_cts, vente:vente!inner(magasin_id)").is("recu_le", null).gt("montant_prevu_cts", 0)
      .gte("date_attendue", aujourdhui).lte("date_attendue", fin),
    db.from("affaire").select("id, libelle, etape_courante_code").in("statut", ["active", "gagnee"]).limit(2000),
    db.from("kpi_potentiel").select("magasin_id, concepteur_id, nb_affaires, potentiel_ht_cts"),
  ]);
  const phaseDe = new Map(phases.flatMap((p) => p.etapes.map((e) => [e.code, p] as const)));
  const affaire = new Map(lire(affaires, "Affaires").map((a) => [a.id, a]));
  type PlanningLu = { semaine_livraison_confirmee: string | null; date_pose_confirmee: string | null; vente: { magasin_id: string; affaire: { id: string; libelle: string }[] } };
  const lesPlannings = (lire(plannings, "Plannings") as unknown as PlanningLu[]).filter((p) => p.vente.affaire.length);
  type RdvLu = { debut: string; affaire: { id: string; libelle: string; magasin_id: string } };
  const lesR3 = lire(r3, "R3 prévus") as unknown as RdvLu[];
  const lesEcheances = lire(echeances, "Échéances") as unknown as { montant_prevu_cts: number; vente: { magasin_id: string } }[];
  const libelleVente = (p: PlanningLu) => p.vente.affaire.map((a) => a.libelle).join(" + ");

  const colonnes: ColonneMardi[] = magasins.map((m) => {
    const f = { magasinId: m.id };
    const rdvM = filtrer(lire(rdv, "KPI-06"), f);
    const nbRdv = (t: string) => rdvM.filter((r) => r.type === t).reduce((s, r) => s + (r.nb ?? 0), 0);
    const tr = filtrer(lire(transfo, "KPI-05"), f);
    const ve = filtrer(lire(ventes, "KPI-01"), f);
    const pl = lesPlannings.filter((p) => p.vente.magasin_id === m.id);
    const ech = lesEcheances.filter((e) => e.vente.magasin_id === m.id);
    const po = filtrer(lire(potentiel, "KPI-04"), f);
    return {
      magasin: m,
      potentiel: { cts: po.reduce((s, p) => s + (p.potentiel_ht_cts ?? 0), 0), affaires: po.reduce((s, p) => s + (p.nb_affaires ?? 0), 0) },
      passee: {
        ventes: ve.reduce((s, v) => s + (v.nb_ventes ?? 0), 0),
        caHtCts: ve.reduce((s, v) => s + (v.ca_ht_cts ?? 0), 0),
        rdv: { R1: nbRdv("R1"), R2: nbRdv("R2"), R3: nbRdv("R3") },
        r3: tr.reduce((s, v) => s + (v.nb_r3 ?? 0), 0),
        vendues: tr.reduce((s, v) => s + (v.nb_vendues ?? 0), 0),
      },
      aVenir: {
        r3: lesR3.filter((r) => r.affaire.magasin_id === m.id).map((r) => ({ affaireId: r.affaire.id, libelle: r.affaire.libelle, quand: r.debut })),
        livraisons: pl.filter((p) => p.semaine_livraison_confirmee && semaines.includes(p.semaine_livraison_confirmee))
          .map((p) => ({ affaireId: p.vente.affaire[0].id, libelle: libelleVente(p), quand: p.semaine_livraison_confirmee! }))
          .sort((a, b) => a.quand.localeCompare(b.quand)),
        poses: pl.filter((p) => p.date_pose_confirmee && p.date_pose_confirmee >= aujourdhui && p.date_pose_confirmee <= fin)
          .map((p) => ({ affaireId: p.vente.affaire[0].id, libelle: libelleVente(p), quand: p.date_pose_confirmee! }))
          .sort((a, b) => a.quand.localeCompare(b.quand)),
        reglementsCts: ech.reduce((s, e) => s + e.montant_prevu_cts, 0),
        nbReglements: ech.length,
      },
      alertes: alertes.filter((x) => x.magasin_id === m.id).map((x) => {
        const a = affaire.get(x.affaire_id);
        const p = a?.etape_courante_code ? phaseDe.get(a.etape_courante_code) : undefined;
        return { ...x, libelle: a?.libelle ?? "Affaire", magasin: m.nom, phase: p ? { numero: p.numero, nom: p.nom, couleur: p.couleur } : null };
      }),
    };
  });
  return { aujourdhui, fin, semainePassee: lire(periodes, "Période"), colonnes };
}
export type PointDuMardi = Awaited<ReturnType<typeof chargerPointDuMardi>>;

/** Alertes de gravité 1 (rouges), pour le badge Pilotage de la navigation des gérants. */
export async function compterAlertesUrgentes(): Promise<number> {
  const db = await clientUtilisateur();
  const { count } = await db.from("alertes").select("regle", { count: "exact", head: true }).eq("gravite", 1);
  return count ?? 0;
}
