import { cheminLogique, cleStockage } from "@/lib/pcloud";
import { DemoClock } from "./clock";
import {
  type AuthAdapter,
  type CalendarSource,
  type FileStore,
  type MailSortant,
  type Mailer,
} from "./types";

/**
 * Implémentations de démonstration (section 5.4).
 * Les dépendances à la base (`mail_sortant`, `rdv`, décalage `parametre.horloge_demo`) sont injectées :
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
/** Stockage de fichiers vu par le PCloud simulé : Supabase Storage en démo (./pcloud-demo.ts), mémoire en test. */
export interface PortStockage {
  televerser(cle: string, contenu: Blob): Promise<void>;
  lister(prefixe: string): Promise<string[]>;
  lienSigne(cle: string): Promise<string | null>;
}

/**
 * PCloud simulé (section 13.4, J5) : l'arborescence et les noms sont ceux de PCloud ; les clés de stockage en
 * sont dérivées (ASCII). Un dépôt n'écrase jamais un fichier : un nom déjà pris devient « nom (2).ext ».
 */
export class DemoFileStore implements FileStore {
  constructor(private readonly stockage: PortStockage) {}

  async creerDossierClient({ chemin, sousDossiers }: { chemin: string; sousDossiers: readonly string[] }) {
    const vide = new Blob([""], { type: "text/plain" });
    await Promise.all(sousDossiers.map((s) => this.stockage.televerser(`${cleStockage(chemin, s)}/${DOSSIER_VIDE}`, vide)));
    return { id: cheminLogique(chemin), url: null };
  }

  async deposer({ dossierId, sousDossier, nomFinal, contenu }: { dossierId: string; sousDossier: string; nomFinal: string; contenu: Blob }) {
    const dossier = cleStockage(dossierId, sousDossier);
    const pris = new Set(await this.stockage.lister(dossier));
    const point = nomFinal.lastIndexOf(".");
    const [base, ext] = point > 0 ? [nomFinal.slice(0, point), nomFinal.slice(point)] : [nomFinal, ""];
    let nom = nomFinal;
    for (let n = 2; pris.has(cleStockage(nom)); n++) nom = `${base} (${n})${ext}`;
    const id = `${dossier}/${cleStockage(nom)}`;
    await this.stockage.televerser(id, contenu);
    return { id, nomFinal: nom, cheminRelatif: `${cheminLogique(sousDossier)}/${nom}` };
  }

  async lister({ dossierId, sousDossier }: { dossierId: string; sousDossier: string }) {
    return (await this.stockage.lister(cleStockage(dossierId, sousDossier))).filter((n) => n !== DOSSIER_VIDE);
  }

  lien({ fichierId }: { fichierId: string }) {
    return this.stockage.lienSigne(fichierId);
  }
}

/** Fichier témoin d'un dossier vide (convention de Supabase Storage). */
export const DOSSIER_VIDE = ".emptyFolderPlaceholder";

/** Stockage en mémoire, pour les tests. */
export function stockageMemoire(): PortStockage & { fichiers: Map<string, Blob> } {
  const fichiers = new Map<string, Blob>();
  return {
    fichiers,
    televerser: async (cle, contenu) => { fichiers.set(cle, contenu); },
    lister: async (prefixe) => [...fichiers.keys()].filter((k) => k.startsWith(`${prefixe}/`) && !k.slice(prefixe.length + 1).includes("/")).map((k) => k.slice(prefixe.length + 1)),
    lienSigne: async (cle) => (fichiers.has(cle) ? `memoire://${cle}` : null),
  };
}

/** RDV saisis dans l'outil (table `rdv`) : la lecture est branchée en J3. */
export class DemoCalendarSource implements CalendarSource {
  constructor(private readonly lireRdv: CalendarSource["rdvDe"]) {}

  rdvDe(input: Parameters<CalendarSource["rdvDe"]>[0]) {
    return this.lireRdv(input);
  }
}

export { DemoClock };
