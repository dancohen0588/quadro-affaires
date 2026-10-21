import type { Clock, DateMetier } from "./types";

export const FUSEAU = "Europe/Paris";

/** Date `AAAA-MM-JJ` d'un instant, vue depuis Paris (ENF-12). */
export function dateParis(instant: Date): DateMetier {
  // en-CA formate en AAAA-MM-JJ ; le fuseau gère les changements d'heure.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Horloge réelle : heure système (production). */
export class SystemClock implements Clock {
  async now(): Promise<Date> {
    return new Date();
  }
  async today(): Promise<DateMetier> {
    return dateParis(await this.now());
  }
}

/**
 * Horloge de démo : heure système décalée de `parametre.horloge_demo.decalage_secondes`.
 * Même règle que `app_now()` côté SQL (section 5.4) : l'interface, les triggers et les indicateurs
 * avancent ensemble, et le temps continue de s'écouler pendant la démo.
 */
export class DemoClock implements Clock {
  constructor(
    private readonly lireDecalageSecondes: () => Promise<number>,
    private readonly systeme: Clock = new SystemClock(),
  ) {}

  async now(): Promise<Date> {
    const [reel, decalage] = await Promise.all([this.systeme.now(), this.lireDecalageSecondes()]);
    return new Date(reel.getTime() + decalage * 1000);
  }

  async today(): Promise<DateMetier> {
    return dateParis(await this.now());
  }
}
