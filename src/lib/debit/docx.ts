import { inflateRawSync } from "node:zlib";

/**
 * Lecture minimale d'un .docx (archive ZIP) pour le débit AGEM (section 13.3) : on n'a besoin que du texte
 * des paragraphes de word/document.xml. Pas de dépendance : le format ZIP se lit avec node:zlib
 * (entrées « stockées » ou « deflate », les deux seules utilisées par Word).
 */

const SIG_FIN = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export class DocxIllisible extends Error {}

/** Contenu décompressé d'une entrée de l'archive, ou null si elle n'existe pas. */
export function lireEntreeZip(octets: Uint8Array, nom: string): Buffer | null {
  const b = Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (b.readUInt32LE(i) === SIG_FIN) { fin = i; break; }
  }
  if (fin < 0) throw new DocxIllisible("Ce fichier n'est pas un document Word (.docx).");
  const nombre = b.readUInt16LE(fin + 10);
  let p = b.readUInt32LE(fin + 16);
  for (let n = 0; n < nombre; n++) {
    if (b.readUInt32LE(p) !== SIG_CENTRAL) throw new DocxIllisible("Archive .docx endommagée.");
    const methode = b.readUInt16LE(p + 10);
    const taille = b.readUInt32LE(p + 20);
    const lgNom = b.readUInt16LE(p + 28), lgExtra = b.readUInt16LE(p + 30), lgCommentaire = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const nomEntree = b.toString("utf8", p + 46, p + 46 + lgNom);
    if (nomEntree === nom) {
      if (b.readUInt32LE(local) !== SIG_LOCAL) throw new DocxIllisible("Archive .docx endommagée.");
      const debut = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
      const donnees = b.subarray(debut, debut + taille);
      if (methode === 0) return Buffer.from(donnees);
      if (methode === 8) return inflateRawSync(donnees);
      throw new DocxIllisible(`Compression non prise en charge (${methode}).`);
    }
    p += 46 + lgNom + lgExtra + lgCommentaire;
  }
  return null;
}

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decoder = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, e: string) =>
    e[0] === "#" ? String.fromCodePoint(parseInt(e.slice(e[1] === "x" || e[1] === "X" ? 2 : 1), e[1] === "x" || e[1] === "X" ? 16 : 10)) : ENTITES[e] ?? tout);

/** Texte de chaque paragraphe (w:p) du corps du document, dans l'ordre ; tabulations et sauts de ligne conservés. */
export function paragraphesDocx(octets: Uint8Array): string[] {
  const xml = lireEntreeZip(octets, "word/document.xml");
  if (!xml) throw new DocxIllisible("Document Word sans contenu (word/document.xml absent).");
  const texte = xml.toString("utf8");
  return [...texte.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map(([p]) =>
    [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)]
      .map((m) => (m[1] !== undefined ? decoder(m[1]) : m[0] === "<w:tab/>" ? "\t" : "\n"))
      .join(""),
  );
}
