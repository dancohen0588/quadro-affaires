import { dateCourte, euros, jourDe, semaineCourte } from "../format";
import type { ProcessDefinition } from "../process/schema";
import { titreEtape } from "./fiche";

/**
 * Historique lisible d'une affaire (EF-40) à partir du journal (ENF-09) :
 * « Acompte 1 reçu (3 720,00 €) · Clara · 15 sept. ». Les écritures techniques (ouverture d'étape,
 * tâches générées ou annulées par le process) sont omises : la validation de l'étape les résume.
 */

export type JournalLigne = {
  id: string;
  table_nom: string;
  action: string;
  avant: unknown;
  apres: unknown;
  auteur_id: string | null;
  at: string;
};

export type EvenementVue = { id: string; jour: string; texte: string; auteur: string | null };

type Ligne = Record<string, unknown>;
const str = (l: Ligne | null, cle: string): string | null => {
  const v = l?.[cle];
  return v === null || v === undefined ? null : String(v);
};
const change = (avant: Ligne | null, apres: Ligne | null, cle: string) => str(avant, cle) !== str(apres, cle);

const ECHEANCES: Record<string, string> = { acompte_1: "Acompte 1", acompte_2: "Acompte 2", solde: "Solde", autre: "Règlement" };
const STATUTS: Record<string, string> = {
  gagnee: "Affaire gagnée", perdue: "Affaire perdue", abandonnee: "Affaire abandonnée", cloturee: "Affaire clôturée", active: "Affaire réactivée",
};

export type ContexteHistorique = {
  definition: ProcessDefinition;
  prenomDe: (id: string | null) => string | null;
};

/** Traduit une ligne du journal en événement lisible, ou null si elle n'a pas d'intérêt pour l'utilisateur. */
export function decrire(j: JournalLigne, ctx: ContexteHistorique): EvenementVue | null {
  const avant = (j.avant ?? null) as Ligne | null;
  const apres = (j.apres ?? null) as Ligne | null;
  const insertion = j.action === "insert";
  const devient = (cle: string, valeur: string) => str(apres, cle) === valeur && (insertion || str(avant, cle) !== valeur);
  const evenement = (texte: string, jour: string = j.at, auteur: string | null = j.auteur_id): EvenementVue => ({
    id: j.id, jour: jourDe(jour), texte, auteur: ctx.prenomDe(auteur),
  });
  if (j.action === "delete" || !apres) return null;

  switch (j.table_nom) {
    case "etape_instance": {
      if (!devient("statut", "faite")) return null;
      const code = str(apres, "etape_code")!;
      const etape = ctx.definition.phases.flatMap((p) => p.etapes).find((e) => e.code === code);
      const issue = etape?.issues.find((i) => i.code === str(apres, "issue_code"));
      const titre = etape ? titreEtape(etape.titre, code, Number(apres.iteration ?? 1)) : code;
      const motif = str(apres, "motif");
      return evenement(
        `${titre} : ${issue?.libelle ?? str(apres, "issue_code") ?? "validée"}${motif ? ` (${motif})` : ""}`,
        str(apres, "fin_at") ?? j.at,
        str(apres, "valide_par") ?? j.auteur_id,
      );
    }
    case "tache":
      if (devient("statut", "faite")) return evenement(`Tâche faite : ${str(apres, "titre")}`, str(apres, "fait_le") ?? j.at, str(apres, "fait_par") ?? j.auteur_id);
      if (!insertion && str(apres, "statut") === "a_faire" && str(avant, "echeance") && change(avant, apres, "echeance") && str(apres, "echeance")) {
        return evenement(`Tâche reportée au ${dateCourte(str(apres, "echeance")!)} : ${str(apres, "titre")}`);
      }
      if (insertion && str(apres, "origine") === "relance" && str(apres, "statut") === "a_faire") {
        const echeance = str(apres, "echeance");
        return evenement(`Relance prévue${echeance ? ` le ${dateCourte(echeance)}` : ""} : ${str(apres, "titre")}`);
      }
      return null;
    case "rdv": {
      const type = str(apres, "type")!;
      const rang = Number(apres.rang ?? 1);
      const nom = `RDV ${type}${rang > 1 ? `.${rang}` : ""}`.replace("point_technique", "point technique").replace("point_strategique", "point stratégique");
      if (insertion) return evenement(`${nom} planifié le ${dateCourte(str(apres, "debut")!)}`);
      if (devient("statut", "fait")) return evenement(`${nom} fait`, str(apres, "debut")!);
      if (devient("statut", "annule")) return evenement(`${nom} annulé`);
      if (change(avant, apres, "debut")) return evenement(`${nom} déplacé au ${dateCourte(str(apres, "debut")!)}`);
      return null;
    }
    case "echeance": {
      const recu = str(apres, "recu_le");
      if (!recu || !(insertion || change(avant, apres, "recu_le"))) return null;
      const montant = Number(apres.montant_recu_cts ?? 0);
      return evenement(`${ECHEANCES[str(apres, "type")!] ?? "Règlement"} reçu (${euros(montant)})`, recu, str(apres, "saisi_par") ?? j.auteur_id);
    }
    case "affaire": {
      if (insertion) return evenement("Affaire créée");
      if (change(avant, apres, "statut")) {
        const motif = str(apres, "motif_perte");
        const statut = str(apres, "statut")!;
        return evenement(`${STATUTS[statut] ?? statut}${motif && (statut === "perdue" || statut === "abandonnee") ? ` (${motif})` : ""}`);
      }
      if (change(avant, apres, "concepteur_id")) return evenement(`Affaire réassignée à ${ctx.prenomDe(str(apres, "concepteur_id")) ?? "un autre concepteur"}`);
      if (change(avant, apres, "magasin_id")) return evenement("Affaire transférée dans un autre magasin");
      if (change(avant, apres, "avis_google_obtenu_le") && str(apres, "avis_google_obtenu_le")) return evenement("Avis Google obtenu");
      return null;
    }
    case "vente":
      if (!insertion) return null;
      return evenement(`Vente signée (${euros(Number(apres.montant_ttc_cts ?? 0))} TTC)`, str(apres, "date_signature") ?? j.at);
    case "commande_fournisseur": {
      const f = str(apres, "fournisseur") ?? "fournisseur";
      if (str(apres, "bpa_donne_le") && (insertion || change(avant, apres, "bpa_donne_le"))) {
        const version = str(apres, "bpa_version");
        return evenement(`BPA donné${version ? ` (${version})` : ""}`, str(apres, "bpa_donne_le")!);
      }
      if (str(apres, "arc_recu_le") && (insertion || change(avant, apres, "arc_recu_le"))) return evenement(`ARC ${f} reçu`, str(apres, "arc_recu_le")!);
      if (str(apres, "envoyee_le") && (insertion || change(avant, apres, "envoyee_le"))) return evenement(`Commande ${f} envoyée`, str(apres, "envoyee_le")!);
      return null;
    }
    case "planning": {
      const sem = str(apres, "semaine_livraison_confirmee");
      const pose = str(apres, "date_pose_confirmee");
      if (devient("statut", "confirmee")) {
        return evenement(`Planning confirmé : livraison ${sem ? semaineCourte(sem) : "à préciser"}${pose ? `, pose le ${dateCourte(pose)}` : ""}`, j.at, str(apres, "confirme_par") ?? j.auteur_id);
      }
      if (insertion) {
        const souhait = str(apres, "semaine_livraison_souhaitee");
        return evenement(`Planning demandé${souhait ? ` : livraison ${semaineCourte(souhait)}` : ""}`);
      }
      return null;
    }
    case "document":
      return insertion ? evenement(`Document déposé : ${str(apres, "nom_final")}`) : null;
    default:
      return null;
  }
}

/** Événements lisibles, du plus récent au plus ancien. */
export function construireHistorique(lignes: readonly JournalLigne[], ctx: ContexteHistorique, limite = 30): EvenementVue[] {
  return lignes
    .map((l) => decrire(l, ctx))
    .filter((e): e is EvenementVue => e !== null)
    .sort((a, b) => b.jour.localeCompare(a.jour))
    .slice(0, limite);
}
