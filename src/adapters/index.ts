import "server-only";
import { readAppMode, type AppMode } from "@/lib/env";
import { SystemClock } from "./clock";
import { comptesSupabase } from "./comptes-demo";
import { DemoAuth, DemoCalendarSource, DemoClock, DemoFileStore, DemoMailer } from "./demo";
import { enregistrerMailDemo } from "./boite-envoi";
import { lireDecalageDemo } from "./horloge-demo";
import { stockageSupabase } from "./pcloud-demo";
import { NonDisponibleError, type Adaptateurs } from "./types";

export type { Adaptateurs } from "./types";

/**
 * Sélection des adaptateurs selon `APP_MODE` (section 5.4).
 * En production, chaque adaptateur réel arrive avec son bloc de branchement (B1 à B5) :
 * tant qu'il n'existe pas, l'appel échoue explicitement plutôt que de retomber sur la démo.
 */
export function creerAdaptateurs(mode: AppMode): Adaptateurs {
  if (mode === "demo") {
    // Horloge lue en base (parametre.horloge_demo), mails enregistrés dans mail_sortant, PCloud sur Supabase Storage,
    // comptes des personnages (et des utilisateurs ajoutés) dans Supabase Auth.
    return {
      auth: new DemoAuth(comptesSupabase),
      mailer: new DemoMailer(enregistrerMailDemo),
      fileStore: new DemoFileStore(stockageSupabase),
      calendar: new DemoCalendarSource(async () => []),
      clock: new DemoClock(lireDecalageDemo),
    };
  }

  return {
    get auth(): never {
      throw new NonDisponibleError("Connexion Microsoft 365", "B1");
    },
    get mailer(): never {
      throw new NonDisponibleError("Envoi des mails par Resend", "B2");
    },
    get fileStore(): never {
      throw new NonDisponibleError("PCloud", "B3");
    },
    get calendar(): never {
      throw new NonDisponibleError("Agendas Outlook", "B5");
    },
    clock: new SystemClock(),
  };
}

let instance: Adaptateurs | null = null;

/** Adaptateurs de l'application, créés une fois par processus. */
export function adaptateurs(): Adaptateurs {
  instance ??= creerAdaptateurs(readAppMode());
  return instance;
}
