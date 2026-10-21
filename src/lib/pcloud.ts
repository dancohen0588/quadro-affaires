/**
 * PCloud simulé (section 13.4) : chemins, noms de dossiers et arborescence affichée. Les noms logiques
 * (« 01 - Données d'Entrée ») sont ceux de PCloud ; le stockage de démo (Supabase Storage) n'accepte que des
 * clés ASCII, d'où une clé dérivée pour chaque chemin. La référence d'un fichier déposé reste la ligne
 * `document` (nom final, dossier), jamais une copie du contenu ailleurs.
 */

/** « 06 - ARC-BPA AGEM / ARC-BPA AGEM / AR » (process) → « 06 - ARC-BPA AGEM/ARC-BPA AGEM/AR ». */
export function cheminLogique(dossier: string): string {
  return dossier.split("/").map((s) => s.trim()).filter(Boolean).join("/");
}

/** Segment de clé Supabase Storage : sans accents ni caractères refusés (\w, espace et - . ' ( ) & , + = @ seulement). */
function segmentCle(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[’‘]/g, "'").replace(/[^\w .'()&,+=@-]/g, "_").replace(/\s+/g, " ").trim() || "_";
}

/** Clé de stockage d'un chemin logique (dossier client, sous-dossier, fichier). */
export function cleStockage(...parties: string[]): string {
  return parties.flatMap((p) => cheminLogique(p).split("/")).map(segmentCle).join("/");
}

/** Caractères interdits dans un nom de fichier ou de dossier PCloud. */
export const nomPropre = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

/**
 * Dossier d'une affaire dans le magasin : « {CLIENT} - {Projet} ({concepteur}) ». Convention provisoire :
 * section 13.4, à confirmer avec Benjamin (une affaire = un dossier, comme la contremarque).
 */
export function nomDossierAffaire(v: { magasinCode: string; client: string; projet: string; concepteur: string }): string {
  const projet = v.projet ? v.projet.charAt(0).toUpperCase() + v.projet.slice(1) : v.projet;
  return `${v.magasinCode}/${nomPropre(`${v.client} - ${projet} (${v.concepteur})`)}`;
}

export type FichierArbre = { id: string; nom: string; dossier: string; deposeLe: string; parQui: string | null; lien: string | null };
export type NoeudArbre = { nom: string; chemin: string; enfants: NoeudArbre[]; fichiers: FichierArbre[] };

/** Arborescence affichée : le modèle « NOUVEAU CLIENT », complété des dossiers où un fichier a été rangé. */
export function construireArbre(modele: readonly string[], fichiers: readonly FichierArbre[]): NoeudArbre[] {
  const racine: NoeudArbre = { nom: "", chemin: "", enfants: [], fichiers: [] };
  const noeud = (chemin: string) => {
    let courant = racine;
    for (const nom of cheminLogique(chemin).split("/")) {
      let suivant = courant.enfants.find((e) => e.nom === nom);
      if (!suivant) {
        suivant = { nom, chemin: courant.chemin ? `${courant.chemin}/${nom}` : nom, enfants: [], fichiers: [] };
        courant.enfants.push(suivant);
      }
      courant = suivant;
    }
    return courant;
  };
  for (const m of modele) noeud(m);
  for (const f of fichiers) noeud(f.dossier).fichiers.push(f);
  const trier = (n: NoeudArbre) => {
    n.enfants.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }));
    n.fichiers.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    n.enfants.forEach(trier);
  };
  trier(racine);
  return racine.enfants;
}

/** Nombre de fichiers d'un nœud et de ses sous-dossiers. */
export const compterFichiers = (n: NoeudArbre): number => n.fichiers.length + n.enfants.reduce((s, e) => s + compterFichiers(e), 0);
