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
 * Horloge de démo : renvoie la date simulée si elle existe, l'heure système sinon.
 * La date simulée vit dans `parametre.horloge_demo`, lue aussi par `app_now()` côté SQL (section 5.4),
 * pour que l'interface, les triggers et les indicateurs avancent ensemble.
 */
export class DemoClock implements Clock {
  constructor(
    private readonly lireDateSimulee: () => Promise<Date | null>,
    private readonly systeme: Clock = new SystemClock(),
  ) {}

  async now(): Promise<Date> {
    return (await this.lireDateSimulee()) ?? this.systeme.now();
  }

  async today(): Promise<DateMetier> {
    return dateParis(await this.now());
  }
}
