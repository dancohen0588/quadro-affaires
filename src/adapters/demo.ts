import { DemoClock } from "./clock";
import {
  NonDisponibleError,
  type AuthAdapter,
  type CalendarSource,
  type FileStore,
  type MailSortant,
  type Mailer,
} from "./types";

/**
 * Implémentations de démonstration (section 5.4).
 * Les dépendances à la base (`mail_sortant`, `rdv`, `parametre.horloge_demo`) sont injectées :
 * elles sont branchées quand les tables existent (session 1.3, J3, J4), sans toucher au code métier.
 */

export const demoAuth: AuthAdapter = {
  methode: "personnage",
  cheminConnexion: "/connexion", // page « Choisir un personnage », session 1.2
};

/** Boîte d'envoi interne : chaque mail est enregistré, jamais envoyé. */
export class DemoMailer implements Mailer {
  constructor(private readonly enregistrer: (mail: MailSortant) => Promise<{ id: string }>) {}

  envoyer(mail: MailSortant): Promise<{ id: string }> {
    return this.enregistrer(mail);
  }
}

/** Boîte d'envoi en mémoire, pour les tests et tant que `mail_sortant` n'existe pas. */
export function boiteEnvoiMemoire() {
  const mails: (MailSortant & { id: string })[] = [];
  return {
    mails,
    enregistrer: async (mail: MailSortant) => {
      const id = `mail-${mails.length + 1}`;
      mails.push({ ...mail, id });
      return { id };
    },
  };
}

/** PCloud simulé dans Supabase Storage : livré en J5 (session 5.1). */
export const demoFileStore: FileStore = {
  creerDossierClient: async () => {
    throw new NonDisponibleError("PCloud simulé", "J5");
  },
  deposer: async () => {
    throw new NonDisponibleError("PCloud simulé", "J5");
  },
  lister: async () => {
    throw new NonDisponibleError("PCloud simulé", "J5");
  },
};

/** RDV saisis dans l'outil (table `rdv`) : la lecture est branchée en J3. */
export class DemoCalendarSource implements CalendarSource {
  constructor(private readonly lireRdv: CalendarSource["rdvDe"]) {}

  rdvDe(input: Parameters<CalendarSource["rdvDe"]>[0]) {
    return this.lireRdv(input);
  }
}

export { DemoClock };
