/**
 * Extraction des champs du débit AGEM (section 13.3). Le débit est généré par Gesteos : libellés suivis
 * d'un espace insécable avant les deux-points, milliers séparés par des espaces insécables, apostrophe
 * typographique dans « PRIX D’ACHAT ». Les valeurs sont proposées à la validation, jamais écrites seules.
 */

export type ExtractionDebit = {
  devis: string | null;
  commande: string | null;
  contremarque: string | null;
  /** Semaine ISO « 2026-S44 ». */
  semaine: string | null;
  lieuLivraison: string | null;
  concepteur: string | null;
  prixAchatCts: number | null;
  points: number | null;
  /** Libellés des champs introuvables, pour prévenir avant la validation. */
  manquants: string[];
};

// Espaces ordinaires, insécables (U+00A0) et fines insécables (U+202F) : \s les couvre en JavaScript.
const DEUX_POINTS = String.raw`\s*:\s*`;
const nettoyer = (s: string) => s.replace(/\s+/g, " ").trim();

/** « 3 102,72 » (espaces insécables possibles) → 310272 centimes. */
export function centimesDebit(texte: string): number | null {
  const m = /^(\d{1,3}(?:\s?\d{3})*|\d+),(\d{2})$/.exec(nettoyer(texte).replace(/\s/g, " "));
  if (!m) return null;
  return Number(m[1].replace(/\s/g, "")) * 100 + Number(m[2]);
}

/** « Marseille 11 » depuis « 13011 MARSEILLE 11 ». */
function ville(ligne: string): string {
  return nettoyer(ligne.replace(/^\d{5}\s*/, ""))
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}

const LIBELLES: [keyof Omit<ExtractionDebit, "manquants">, string][] = [
  ["devis", "N° de devis"], ["commande", "N° de commande"], ["contremarque", "Contremarque"], ["semaine", "Semaine demandée"],
  ["lieuLivraison", "Lieu de livraison"], ["concepteur", "Concepteur"], ["prixAchatCts", "Prix d'achat"], ["points", "Points"],
];

export function extraireDebit(paragraphes: readonly string[]): ExtractionDebit {
  const lignes = paragraphes.map((p) => p.replace(/ | /g, " ")).filter((p) => p.trim());
  const chercher = (motif: RegExp) => {
    for (const l of lignes) {
      const m = motif.exec(l);
      if (m) return m;
    }
    return null;
  };

  const devis = chercher(new RegExp(String.raw`N°\s*du\s+devis${DEUX_POINTS}(\S+)`))?.[1] ?? null;
  const commande = chercher(new RegExp(String.raw`notre\s+commande${DEUX_POINTS}([^\s.]+)`))?.[1] ?? null;
  const contremarque = chercher(new RegExp(String.raw`Nom\s+de\s+la\s+contremarque${DEUX_POINTS}(.+)$`))?.[1];
  const semaine = chercher(new RegExp(String.raw`Semaine\s+de\s+livraison\s+demandée${DEUX_POINTS}(\d{1,2})\s*/\s*(\d{4})`));
  const concepteur = chercher(new RegExp(String.raw`Votre\s+concepteur${DEUX_POINTS}(.+)$`))?.[1];
  const prix = chercher(new RegExp(String.raw`PRIX\s+D['’]ACHAT${DEUX_POINTS}([\d\s]+,\d{2})\s*€?`));
  const points = chercher(new RegExp(String.raw`^\s*POINTS${DEUX_POINTS}([\d\s]+,\d{2})`));

  // Adresse : le paragraphe du libellé, puis les lignes suivantes (nom, rue, code postal et ville).
  let lieuLivraison: string | null = null;
  const i = lignes.findIndex((l) => new RegExp(String.raw`Adresse\s+de\s+livraison\s+demandée${DEUX_POINTS}`).test(l));
  if (i >= 0) {
    const suite = lignes[i].split(":").slice(1).join(":").trim();
    const bloc = (suite ? [suite] : []).concat(lignes.slice(i + 1, i + 5));
    const nom = bloc[0] ? nettoyer(bloc[0]) : null;
    const cp = bloc.find((l) => /^\s*\d{5}\s+\S/.test(l));
    lieuLivraison = nom ? (cp ? `${nom}, ${ville(cp)}` : nom) : null;
  }

  const pointsCts = points ? centimesDebit(points[1]) : null;
  const res: Omit<ExtractionDebit, "manquants"> = {
    devis, commande,
    contremarque: contremarque ? nettoyer(contremarque) : null,
    semaine: semaine ? `${semaine[2]}-S${semaine[1].padStart(2, "0")}` : null,
    lieuLivraison,
    concepteur: concepteur ? nettoyer(concepteur) : null,
    prixAchatCts: prix ? centimesDebit(prix[1]) : null,
    points: pointsCts === null ? null : pointsCts / 100,
  };
  return { ...res, manquants: LIBELLES.filter(([cle]) => res[cle] === null).map(([, l]) => l) };
}

/** Comparaison tolérante (casse, espaces, accents) pour signaler une contremarque ou un concepteur différent. */
export function memeTexte(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toUpperCase();
  return !!a && !!b && n(a) === n(b);
}
