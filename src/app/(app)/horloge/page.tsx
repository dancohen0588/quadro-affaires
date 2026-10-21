import type { Metadata } from "next";
import Link from "next/link";
import { adaptateurs } from "@/adapters";
import { SystemClock } from "@/adapters/clock";
import { lireDecalageDemo } from "@/adapters/horloge-demo";
import { PanneauHorloge } from "@/components/horloge/panneau-horloge";
import { JOURS } from "@/lib/affaire/journee";
import { dateCourte, heure } from "@/lib/format";
import { decalageLisible } from "@/lib/horloge";
import { jourDeSemaine, semaineIso } from "@/lib/rules/calendrier";
import { exigerGerant, exigerModeDemo } from "@/server/garde";

export const metadata: Metadata = { title: "Horloge de démo" };

/**
 * Horloge de démo (session 4.2, gérants) : la date simulée vient de parametre.horloge_demo, lue par
 * prive.app_now() et par l'adaptateur Clock. Chaque avance rejoue les traitements de nuit des jours franchis.
 */
export default async function Horloge() {
  exigerModeDemo();
  await exigerGerant();
  const [simule, reel, decalage, jour] = await Promise.all([
    adaptateurs().clock.now(), new SystemClock().now(), lireDecalageDemo(), adaptateurs().clock.today(),
  ]);
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 px-6 py-6">
      <div>
        <h1 className="text-3xl text-encre">Horloge de démo</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Avancer l&apos;horloge rejoue, pour chaque nuit franchie, les alertes, les relances et les digests. Ne pas l&apos;utiliser hors démonstration.
        </p>
      </div>
      <section aria-labelledby="horloge-date" className="grid gap-4 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10 sm:grid-cols-3">
        <div>
          <h2 id="horloge-date" className="font-sans text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Date simulée</h2>
          <p className="mt-1 font-heading text-[30px] leading-tight font-bold text-teal-900" data-testid="date-simulee">
            {JOURS[jourDeSemaine(jour)]} {dateCourte(jour, 0)} · {heure(simule.toISOString())}
          </p>
          <p className="text-[14px] text-muted-foreground">Semaine {semaineIso(jour).slice(5)}</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Heure réelle</p>
          <p className="mt-1 text-[20px] font-semibold text-encre">{dateCourte(reel.toISOString())} · {heure(reel.toISOString())}</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Décalage</p>
          <p className="mt-1 text-[20px] font-semibold text-encre">{decalageLisible(decalage)}</p>
        </div>
      </section>
      <PanneauHorloge />
      <p className="text-[14px] text-muted-foreground">
        Les mails générés arrivent dans la <Link href="/boite-envoi" className="font-semibold text-teal-700 underline-offset-2 hover:underline">boîte d&apos;envoi</Link> ;
        les alertes et indicateurs suivent la date simulée dans le <Link href="/pilotage" className="font-semibold text-teal-700 underline-offset-2 hover:underline">Pilotage</Link>.
      </p>
    </div>
  );
}
