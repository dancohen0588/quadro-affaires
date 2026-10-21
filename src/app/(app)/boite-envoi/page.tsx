import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { cn } from "cn";
import { adaptateurs } from "@/adapters";
import { dateCourte, heure, jourDe } from "@/lib/format";
import { clientUtilisateur } from "@/lib/supabase/server";
import { exigerProfil } from "@/server/garde";

export const metadata: Metadata = { title: "Boîte d'envoi" };

const TYPES: [string, string][] = [
  ["digest_quotidien", "Digest quotidien"], ["digest_lundi", "Digest du lundi"], ["planning", "Planning"],
  ["bpa", "BPA"], ["facture_recap", "Facture récapitulative"], ["autre", "Autre"],
];
const LIBELLE_TYPE = Object.fromEntries(TYPES);
const champ = "h-9 rounded-lg border border-input bg-card px-2.5 text-[14px]";
const texte = (v: string | string[] | undefined, n = 40) => (typeof v === "string" ? v.slice(0, n) : "");

type Ligne = {
  id: string; destinataire_email: string; type: string; objet: string; genere_le: string; envoye_le: string | null;
  destinataire: { prenom: string; nom: string } | null;
};

/**
 * Boîte d'envoi (session 4.2) : les mails générés par l'application (digests, planning, BPA, facture
 * récapitulative), avec destinataire, objet et aperçu HTML tel qu'il partirait. En démo, rien n'est envoyé.
 * Un gérant voit tous les mails, les autres les leurs (RLS mail_lecture).
 */
export default async function BoiteEnvoi({ searchParams }: PageProps<"/boite-envoi">) {
  const moi = await exigerProfil();
  const sp = await searchParams;
  const type = TYPES.some(([t]) => t === sp.type) ? (sp.type as string) : "";
  const pour = moi.role === "gerant" ? texte(sp.pour) : "";
  const db = await clientUtilisateur();
  const aujourdhui = await adaptateurs().clock.today();

  let requete = db.from("mail_sortant")
    .select("id, destinataire_email, type, objet, genere_le, envoye_le, destinataire:profil!mail_sortant_destinataire_id_fkey(prenom, nom)")
    .order("genere_le", { ascending: false }).limit(150);
  if (type) requete = requete.eq("type", type);
  if (pour) requete = requete.eq("destinataire_id", pour);
  const [{ data, error }, { data: personnes }] = await Promise.all([
    requete,
    moi.role === "gerant" ? db.from("profil").select("id, prenom, nom").eq("actif", true).order("prenom") : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(`Boîte d'envoi : ${error.message}`);
  const lignes = (data ?? []) as unknown as Ligne[];
  const choisi = texte(sp.mail, 36) || lignes[0]?.id;
  const { data: mail } = choisi
    ? await db.from("mail_sortant").select("id, destinataire_email, objet, html, genere_le, type").eq("id", choisi).maybeSingle()
    : { data: null };

  const lien = (id: string) => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (pour) p.set("pour", pour);
    p.set("mail", id);
    return `/boite-envoi?${p}`;
  };
  const quand = (instant: string) => `${jourDe(instant) === aujourdhui ? "Aujourd'hui" : dateCourte(instant)} · ${heure(instant)}`;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="text-3xl text-encre">Boîte d&apos;envoi</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {moi.role === "gerant" ? "Tous les mails générés" : "Les mails qui vous sont adressés"} · démonstration : aucun mail ne part réellement.
        </p>
      </div>
      <form className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10" aria-label="Filtres">
        <select name="type" defaultValue={type} className={champ} aria-label="Type de mail">
          <option value="">Tous les types</option>
          {TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
        </select>
        {moi.role === "gerant" && (
          <select name="pour" defaultValue={pour} className={champ} aria-label="Destinataire">
            <option value="">Tous les destinataires</option>
            {(personnes ?? []).map((p) => <option key={p.id} value={p.id}>{`${p.prenom} ${p.nom}`.trim()}</option>)}
          </select>
        )}
        <button type="submit" className="h-9 rounded-lg bg-teal-900 px-3 text-[14px] font-semibold text-white">Filtrer</button>
        <span className="ml-auto text-[14px] text-muted-foreground">{lignes.length} mail{lignes.length > 1 ? "s" : ""}{lignes.length === 150 ? " (les plus récents)" : ""}</span>
      </form>

      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section aria-labelledby="liste-mails" className="rounded-xl bg-card ring-1 ring-foreground/10">
          <h2 id="liste-mails" className="sr-only">Mails générés</h2>
          {lignes.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-[15px] text-muted-foreground"><Mail aria-hidden className="size-4" /> Aucun mail pour l&apos;instant.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y overflow-y-auto">
              {lignes.map((l) => (
                <li key={l.id}>
                  <Link href={lien(l.id)} aria-current={l.id === choisi ? "true" : undefined}
                    className={cn("flex flex-col gap-0.5 px-4 py-2.5 hover:bg-fond", l.id === choisi && "bg-sage-100")}>
                    <span className="flex items-baseline justify-between gap-2 text-[13px] text-muted-foreground">
                      <span className="truncate">{l.destinataire ? `${l.destinataire.prenom} ${l.destinataire.nom}`.trim() : l.destinataire_email}</span>
                      <span className="shrink-0">{quand(l.genere_le)}</span>
                    </span>
                    <span className="truncate text-[15px] font-semibold text-encre">{l.objet}</span>
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-teal-700 uppercase">{LIBELLE_TYPE[l.type] ?? l.type}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="apercu-mail" className="flex min-h-[70vh] flex-col rounded-xl bg-card ring-1 ring-foreground/10">
          {mail ? (
            <>
              <header className="border-b px-5 py-3">
                <h2 id="apercu-mail" className="text-[18px] text-encre">{mail.objet}</h2>
                <p className="text-[14px] text-muted-foreground">
                  À <span className="font-mono text-[13px]">{mail.destinataire_email}</span> · {LIBELLE_TYPE[mail.type] ?? mail.type} · généré {quand(mail.genere_le).toLowerCase()}
                </p>
              </header>
              {/* Aperçu fidèle : le HTML du mail, isolé de la page (aucun script, aucun style partagé). */}
              <iframe title={`Aperçu : ${mail.objet}`} srcDoc={`<base target="_blank">${mail.html}`} sandbox="allow-popups allow-popups-to-escape-sandbox" className="w-full flex-1 rounded-b-xl" />
            </>
          ) : (
            <h2 id="apercu-mail" className="px-5 py-6 text-[15px] font-normal text-muted-foreground">Choisissez un mail pour l&apos;afficher.</h2>
          )}
        </section>
      </div>
    </div>
  );
}
