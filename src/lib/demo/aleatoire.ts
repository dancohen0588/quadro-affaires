/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : le jeu de démo est identique à chaque seed. */
export type Alea = ReturnType<typeof creerAlea>;

export function creerAlea(graine: number) {
  let etat = graine >>> 0;
  const suivant = (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entier = (min: number, max: number) => min + Math.floor(suivant() * (max - min + 1));
  const choix = <T>(liste: readonly T[]): T => liste[Math.floor(suivant() * liste.length)];
  const proba = (p: number) => suivant() < p;
  /** Choix pondéré : [[valeur, poids], …]. */
  const pondere = <T>(options: readonly (readonly [T, number])[]): T => {
    const total = options.reduce((s, [, p]) => s + p, 0);
    let x = suivant() * total;
    for (const [v, p] of options) {
      x -= p;
      if (x < 0) return v;
    }
    return options[options.length - 1][0];
  };
  /** UUID v4 déterministe. */
  const uuid = () => {
    const o = Array.from({ length: 16 }, () => entier(0, 255));
    o[6] = (o[6] & 0x0f) | 0x40;
    o[8] = (o[8] & 0x3f) | 0x80;
    const h = o.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  return { suivant, entier, choix, proba, pondere, uuid };
}
