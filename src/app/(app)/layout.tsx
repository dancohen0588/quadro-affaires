import { adaptateurs } from "@/adapters";
import { lireDecalageDemo } from "@/adapters/horloge-demo";
import { DemoBanner } from "@/components/shell/demo-banner";
import { dateCourte, heure } from "@/lib/format";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { isDemo } from "@/lib/env";
import { exigerProfil } from "@/server/garde";
import { compterAlertesUrgentes } from "@/server/indicateurs";
import { compterPlanningsEnAttente, compterTachesDuJour } from "@/server/journee";

/** Coquille de l'application : bandeau démo, navigation latérale, barre du haut (section 9). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await exigerProfil();
  const gerant = profil.role === "gerant";
  const demo = isDemo();
  const [aFaire, plannings, alertes, decalage] = await Promise.all([
    compterTachesDuJour(profil),
    gerant ? compterPlanningsEnAttente() : Promise.resolve(0),
    gerant ? compterAlertesUrgentes() : Promise.resolve(0),
    demo ? lireDecalageDemo() : Promise.resolve(0),
  ]);
  const simule = Math.abs(decalage) >= 60 ? (await adaptateurs().clock.now()).toISOString() : null;
  return (
    <div className="flex h-dvh flex-col">
      {demo && <DemoBanner connecte estGerant={gerant} dateSimulee={simule ? `${dateCourte(simule)} · ${heure(simule)}` : null} />}
      <div className="flex min-h-0 flex-1">
        <Sidebar estGerant={gerant} badges={{
            "/ma-journee": { nombre: aFaire, libelle: "tâches à faire" },
            "/planning": { nombre: plannings, libelle: "demandes de planning en attente" },
            "/pilotage": { nombre: alertes, libelle: "alertes urgentes" },
          }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar profil={profil} />
          <main id="contenu" className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
