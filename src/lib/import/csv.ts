/**
 * Lecture d'un CSV de reprise (section 13.1) : UTF-8 (BOM toléré), séparateur « ; », guillemets doubles
 * pour les champs qui contiennent « ; », un saut de ligne ou des guillemets (doublés). Fins de ligne CRLF ou LF.
 */

export type CsvLu = { entetes: string[]; lignes: { numero: number; valeurs: Record<string, string> }[] };

/** Découpe le texte en enregistrements de champs bruts. */
export function decouperCsv(texte: string, separateur = ";"): string[][] {
  const t = texte.replace(/^﻿/, "");
  const enregistrements: string[][] = [];
  let champ = "", champs: string[] = [], guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"' && champ === "") guillemets = true;
    else if (c === separateur) { champs.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      champs.push(champ); enregistrements.push(champs); champs = []; champ = "";
    } else champ += c;
  }
  if (champ !== "" || champs.length) { champs.push(champ); enregistrements.push(champs); }
  return enregistrements.filter((r) => r.some((v) => v.trim() !== ""));
}

/** En-têtes (en minuscules, sans espaces autour) et lignes indexées par en-tête ; numéro de ligne du fichier (en-tête = 1). */
export function lireCsv(texte: string): CsvLu {
  const [entete, ...corps] = decouperCsv(texte);
  const entetes = (entete ?? []).map((e) => e.trim().toLowerCase());
  return {
    entetes,
    lignes: corps.map((valeurs, i) => ({
      numero: i + 2,
      valeurs: Object.fromEntries(entetes.map((e, j) => [e, (valeurs[j] ?? "").trim()])),
    })),
  };
}
