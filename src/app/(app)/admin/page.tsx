import type { Metadata } from "next";
import { EcranAVenir } from "@/components/shell/ecran-a-venir";
import { NAVIGATION } from "@/lib/navigation";
import { exigerGerant } from "@/server/garde";

const entree = NAVIGATION.find((e) => e.href === "/admin")!;

export const metadata: Metadata = { title: entree.libelle };

export default async function Page() {
  await exigerGerant();
  return <EcranAVenir entree={entree} description="Utilisateurs, magasins, paramètres et modèle de process." />;
}
