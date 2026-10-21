import type { Metadata } from "next";
import { DemoBanner } from "@/components/shell/demo-banner";
import { LIBELLES_ROLE, PERSONNAGES } from "@/lib/demo/personnages";
import { exigerModeDemo } from "@/server/garde";
import { listerPersonnages, type PersonnageListe } from "@/server/personnages";
import { seConnecterCommePersonnage } from "./actions";

export const metadata: Metadata = { title: "Choisir un personnage" };

const GROUPES: { role: PersonnageListe["role"]; titre: string }[] = [
  { role: "gerant", titre: "Gérants" },
  { role: "conceptrice", titre: "Conceptrices" },
  { role: "transverse", titre: "Transverses" },
];

const MESSAGES_ERREUR: Record<string, string> = {
  personnage: "Ce personnage n'existe plus. Relancez pnpm seed:demo.",
  connexion: "La connexion a échoué. Vérifiez DEMO_PERSONA_PASSWORD et relancez pnpm seed:demo.",
};

/** Page « Choisir un personnage » (AuthAdapter démo, section 5.4). Introuvable en production. */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
}) {
  exigerModeDemo();
  const params = await searchParams;
  const erreur = typeof params.erreur === "string" ? MESSAGES_ERREUR[params.erreur] : undefined;
  const personnages = await listerPersonnages();
  const usage = new Map(PERSONNAGES.map((p) => [p.prenom, p.usage]));

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span aria-hidden className="size-5 rounded-[6px_6px_6px_1px] bg-sage-500" />
          <div>
            <h1 className="text-3xl">Choisir un personnage</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Connectez-vous en un clic sous l&apos;identité d&apos;un membre de l&apos;équipe. Les droits sont ceux du vrai rôle.
            </p>
          </div>
        </div>

        {erreur && (
          <p role="alert" className="mb-6 rounded-lg bg-[#f7e3e1] px-4 py-3 text-sm font-semibold text-etat-retard">
            {erreur}
          </p>
        )}
        {personnages.length === 0 && (
          <p className="rounded-lg bg-card px-4 py-3 text-[15px] ring-1 ring-foreground/10">
            Aucun personnage en base. Lancez <code className="font-mono text-sm">pnpm seed:demo</code>.
          </p>
        )}

        <div className="flex flex-col gap-8">
          {GROUPES.map(({ role, titre }) => {
            const liste = personnages.filter((p) => p.role === role);
            if (liste.length === 0) return null;
            return (
              <section key={role} aria-labelledby={`groupe-${role}`}>
                <h2 id={`groupe-${role}`} className="mb-3 text-lg">{titre}</h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liste.map((p) => (
                    <li key={p.id}>
                      <form action={seConnecterCommePersonnage}>
                        <input type="hidden" name="profilId" value={p.id} />
                        <button
                          type="submit"
                          className="flex w-full items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition hover:ring-2 hover:ring-teal-500"
                        >
                          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-500 text-sm font-bold text-teal-900">
                            {p.initiales}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-heading text-base font-bold text-encre">
                              {p.prenom} {p.nom}
                            </span>
                            <span className="block text-sm text-muted-foreground">
                              {LIBELLES_ROLE[p.role]} · {p.magasins.length === 3 ? "3 magasins" : p.magasins.join(", ")}
                            </span>
                            {usage.get(p.prenom) && <span className="mt-1.5 block text-sm text-encre/80">{usage.get(p.prenom)}</span>}
                          </span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
