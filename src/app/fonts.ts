import localFont from "next/font/local";

// Polices de la charte, hébergées avec l'application (licence OFL, fichiers dans ./fonts).
// Pas d'appel à Google Fonts : builds reproductibles hors ligne, et aucun transfert vers un tiers (RGPD).

export const fontTitre = localFont({
  src: [
    { path: "./fonts/quicksand-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/quicksand-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/quicksand-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-titre",
  display: "swap",
});

export const fontTexte = localFont({
  src: [
    { path: "./fonts/source-sans-3-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-sans-3-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/source-sans-3-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/source-sans-3-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-texte",
  display: "swap",
});

export const fontReference = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-reference",
  display: "swap",
});
