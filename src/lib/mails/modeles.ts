import { dateCourte, euros, semaineCourte } from "../format";

/**
 * Mails de notification (section 11) : planning, BPA, facture récapitulative. En démo, ils arrivent dans la
 * boîte d'envoi (table mail_sortant, écran J4) au lieu d'être envoyés. HTML simple à styles en ligne,
 * aux couleurs de la charte, lisible dans tous les clients de messagerie.
 */

export type Mail = { objet: string; html: string };

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function gabarit(c: { titre: string; intro: string; lignes?: [string, string][]; action?: { libelle: string; lien: string } }): string {
  const lignes = (c.lignes ?? [])
    .map(([l, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#4f6268">${echapper(l)}</td><td style="padding:4px 0;color:#15262b;font-weight:600">${echapper(v)}</td></tr>`)
    .join("");
  const action = c.action
    ? `<p style="margin:24px 0 0"><a href="${echapper(c.action.lien)}" style="display:inline-block;background:#0e3b45;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${echapper(c.action.libelle)}</a></p>`
    : "";
  return [
    `<div style="font-family:'Source Sans 3',Arial,sans-serif;font-size:15px;line-height:1.5;color:#15262b;background:#f4f7f6;padding:24px">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #dbe4e0">`,
    `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;color:#2f7a86;font-weight:700">QUADRO AFFAIRES</p>`,
    `<h1 style="margin:0 0 12px;font-size:20px;color:#0e3b45">${echapper(c.titre)}</h1>`,
    `<p style="margin:0 0 16px">${echapper(c.intro)}</p>`,
    lignes ? `<table style="border-collapse:collapse">${lignes}</table>` : "",
    action,
    `</div></div>`,
  ].join("");
}

const joindre = (affaires: string[]) => affaires.join(" + ");

/** EF-60 : demande de planning à Valentin à la création de la vente. */
export function mailDemandePlanning(p: {
  affaires: string[]; concepteur: string; semaine: string | null; datePose: string | null; lien: string;
}): Mail {
  return {
    objet: `Demande de planning : ${joindre(p.affaires)}`,
    html: gabarit({
      titre: "Nouvelle demande de planning",
      intro: `${p.concepteur} vient d'enregistrer la vente de ${joindre(p.affaires)}.`,
      lignes: [
        ["Livraison souhaitée", p.semaine ? semaineCourte(p.semaine) : "à définir"],
        ["Pose souhaitée", p.datePose ? dateCourte(p.datePose) : "à définir"],
      ],
      action: { libelle: "Confirmer le planning", lien: p.lien },
    }),
  };
}

/** EF-61 : le concepteur est prévenu de la confirmation ou des nouvelles dates proposées. */
export function mailPlanningRepondu(p: {
  affaires: string[]; statut: "confirmee" | "decalee"; semaine: string | null; datePose: string | null;
  poseur: string | null; commentaire: string | null; par: string; lien: string;
}): Mail {
  const confirme = p.statut === "confirmee";
  return {
    objet: `${confirme ? "Planning confirmé" : "Nouvelles dates proposées"} : ${joindre(p.affaires)}`,
    html: gabarit({
      titre: confirme ? "Planning confirmé" : "Nouvelles dates proposées",
      intro: confirme
        ? `${p.par} a confirmé la livraison et la pose de ${joindre(p.affaires)}.`
        : `${p.par} propose d'autres dates pour ${joindre(p.affaires)} : à valider avec le client.`,
      lignes: [
        ["Livraison", p.semaine ? semaineCourte(p.semaine) : "à définir"],
        ["Pose", p.datePose ? dateCourte(p.datePose) : "à définir"],
        ...(p.poseur ? [["Poseur", p.poseur] as [string, string]] : []),
        ...(p.commentaire ? [["Commentaire", p.commentaire] as [string, string]] : []),
      ],
      action: { libelle: "Ouvrir l'affaire", lien: p.lien },
    }),
  };
}

/** EF-73 : confirmation AGEM reçue, le BPA est à donner. */
export function mailBpaADonner(p: { affaire: string; version: string | null; confirmationLe: string; lien: string }): Mail {
  return {
    objet: `BPA à donner : ${p.affaire}`,
    html: gabarit({
      titre: "BPA à donner",
      intro: `La confirmation AGEM de ${p.affaire} est arrivée : les plans sont à vérifier puis le BPA à donner.`,
      lignes: [
        ["Confirmation reçue le", dateCourte(p.confirmationLe)],
        ...(p.version ? [["Version", p.version] as [string, string]] : []),
      ],
      action: { libelle: "Ouvrir l'affaire", lien: p.lien },
    }),
  };
}

/** RG-15 : tous les règlements sont reçus, la facture récapitulative est à éditer. */
export function mailFactureRecap(p: { affaires: string[]; montantTtcCts: number; lien: string }): Mail {
  return {
    objet: `Facture récapitulative à éditer : ${joindre(p.affaires)}`,
    html: gabarit({
      titre: "Facture récapitulative à éditer",
      intro: `Tous les règlements de ${joindre(p.affaires)} sont reçus.`,
      lignes: [["Montant TTC", euros(p.montantTtcCts)]],
      action: { libelle: "Ouvrir l'affaire", lien: p.lien },
    }),
  };
}
