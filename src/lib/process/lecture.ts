import type { Echeance, Role } from "./schema";

/** Lecture humaine du modèle de process (Administration, version en lecture seule, EF-103 partiel). */

export const LIBELLES_ROLES: Record<Role, string> = {
  concepteur: "Concepteur",
  gerant_bpa: "Gérant BPA",
  gerant_logistique: "Gérant logistique",
  gerant_finance: "Gérant finance",
  responsable_r4: "Responsable R4",
};

const DEPUIS: Record<string, string> = {
  ouverture_etape: "l'ouverture de l'étape", date_pose: "la pose", date_livraison: "la livraison", fin_chantier: "la fin de chantier",
};

/** « 3 jours ouvrés après l'ouverture de l'étape », « la veille du R3 », « à réception ». */
export function decrireEcheance(e: Echeance): string {
  if ("premiere_de" in e) return `au plus tôt de : ${e.premiere_de.map(decrireEcheance).join(" ; ")}`;
  if (e.depuis === "aucune") return "à réception";
  const ref = e.depuis === "rdv" ? `le ${e.rdv ?? "RDV de l'étape"}` : DEPUIS[e.depuis];
  if (e.jours === 0) return e.depuis === "rdv" ? `le jour du ${e.rdv ?? "RDV"}` : `à ${ref}`;
  const n = Math.abs(e.jours);
  const unite = `${n} jour${n > 1 ? "s" : ""}${e.ouvres ? (n > 1 ? " ouvrés" : " ouvré") : ""}`;
  return e.jours > 0 ? `${unite} après ${ref}` : `${unite} avant ${ref}`;
}
