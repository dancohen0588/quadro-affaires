import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { centimesDebit, extraireDebit, memeTexte } from "./agem";
import { DocxIllisible, lireEntreeZip, paragraphesDocx } from "./docx";

const exemple = readFileSync("docs/sources/debit-agem-exemple-anonymise.docx");

describe("débit AGEM (section 13.3)", () => {
  it("lit les paragraphes du .docx d'exemple anonymisé", () => {
    const p = paragraphesDocx(exemple);
    expect(p).toContain("N° du devis : D20260928#4538");
    expect(p.some((l) => l.startsWith("PRIX D’ACHAT :"))).toBe(true);
  });

  it("extrait les huit champs, espaces insécables et apostrophe typographique compris", () => {
    expect(extraireDebit(paragraphesDocx(exemple))).toEqual({
      devis: "D20260928#4538",
      commande: "C20260929#848",
      contremarque: "SAS VISIOLAB Julien ROUSSEL",
      semaine: "2026-S44",
      lieuLivraison: "TRANSTOCK 66, Marseille 11",
      concepteur: "Jean FARHAT",
      prixAchatCts: 310_272,
      points: 4162.57,
      manquants: [],
    });
  });

  it("ne confond pas l'en-tête « Prix d’’achat » des lignes avec le total, et signale les champs absents", () => {
    const r = extraireDebit(["Prix d’’achat", "PRIX D'ACHAT : 12,00 €", "Semaine de livraison demandée : 7 / 2027", "Adresse de livraison demandée : Magasin"]);
    expect(r.prixAchatCts).toBe(1200);
    expect(r.semaine).toBe("2027-S07");
    expect(r.lieuLivraison).toBe("Magasin");
    expect(r.manquants).toEqual(["N° de devis", "N° de commande", "Contremarque", "Concepteur", "Points"]);
  });

  it("convertit les montants Gesteos en centimes", () => {
    expect(centimesDebit("3 102,72")).toBe(310_272);
    expect(centimesDebit("3 102,72")).toBe(310_272);
    expect(centimesDebit("14,52")).toBe(1452);
    expect(centimesDebit("1 234 567,00")).toBe(123_456_700);
    expect(centimesDebit("douze")).toBeNull();
  });

  it("compare contremarque et concepteur sans tenir compte de la casse ni des accents", () => {
    expect(memeTexte("Jean FARHAT", "jean  farhat")).toBe(true);
    expect(memeTexte("ÉLODIE", "Elodie")).toBe(true);
    expect(memeTexte("A", null)).toBe(false);
  });
});

/** Archive ZIP minimale à une entrée, pour les cas limites du lecteur. */
function zip(nom: string, contenu: string, methode: 0 | 8 = 8, signatureLocale = 0x04034b50): Buffer {
  const brut = Buffer.from(contenu, "utf8");
  const donnees = methode === 8 ? deflateRawSync(brut) : brut;
  const n = Buffer.from(nom, "utf8");
  const local = Buffer.alloc(30); local.writeUInt32LE(signatureLocale, 0); local.writeUInt16LE(methode, 8);
  local.writeUInt32LE(donnees.length, 18); local.writeUInt32LE(brut.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(methode, 10);
  central.writeUInt32LE(donnees.length, 20); central.writeUInt32LE(brut.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const debutCentral = 30 + n.length + donnees.length;
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10);
  fin.writeUInt32LE(46 + n.length, 12); fin.writeUInt32LE(debutCentral, 16);
  return Buffer.concat([local, n, donnees, central, n, fin]);
}

describe("lecteur .docx", () => {
  const doc = '<w:body><w:p><w:r><w:t>A &amp; B</w:t><w:tab/><w:t xml:space="preserve">&#233;t&#xE9;</w:t><w:br/><w:t>&inconnu;</w:t></w:r></w:p><w:p><w:pPr/></w:p></w:body>';
  it("lit une entrée stockée ou compressée, décode les entités", () => {
    expect(paragraphesDocx(zip("word/document.xml", doc, 0))).toEqual(["A & B\tété\n&inconnu;", ""]);
    expect(paragraphesDocx(zip("word/document.xml", doc, 8))[0]).toBe("A & B\tété\n&inconnu;");
    expect(lireEntreeZip(zip("autre.xml", "x"), "word/document.xml")).toBeNull();
  });

  it("refuse un fichier qui n'est pas un .docx", () => {
    expect(() => paragraphesDocx(Buffer.from("pas un zip du tout, rien à voir"))).toThrow(DocxIllisible);
    expect(() => paragraphesDocx(zip("autre.xml", "x"))).toThrow("word/document.xml absent");
    expect(() => lireEntreeZip(zip("word/document.xml", doc, 8, 0x12345678), "word/document.xml")).toThrow("endommagée");
    const inconnue = zip("word/document.xml", doc, 0);
    inconnue.writeUInt16LE(14, inconnue.length - 22 - 46 - "word/document.xml".length + 10);
    expect(() => lireEntreeZip(inconnue, "word/document.xml")).toThrow("Compression non prise en charge");
    const centrale = zip("word/document.xml", doc, 0);
    centrale.writeUInt32LE(0, centrale.length - 22 - 46 - "word/document.xml".length);
    expect(() => lireEntreeZip(centrale, "word/document.xml")).toThrow("endommagée");
  });
});
