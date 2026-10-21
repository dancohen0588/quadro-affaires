import { DemoBanner } from "@/components/shell/demo-banner";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { isDemo } from "@/lib/env";
import { exigerProfil } from "@/server/garde";
import { compterPlanningsEnAttente, compterTachesDuJour } from "@/server/journee";

/** Coquille de l'application : bandeau démo, navigation latérale, barre du haut (section 9). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await exigerProfil();
  const [aFaire, plannings] = await Promise.all([
    compterTachesDuJour(profil),
    profil.role === "gerant" ? compterPlanningsEnAttente() : Promise.resolve(0),
  ]);
  return (
    <div className="flex h-dvh flex-col">
      {isDemo() && <DemoBanner />}
      <div className="flex min-h-0 flex-1">
        <Sidebar estGerant={profil.role === "gerant"} badges={{
            "/ma-journee": { nombre: aFaire, libelle: "tâches à faire" },
            "/planning": { nombre: plannings, libelle: "demandes de planning en attente" },
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
