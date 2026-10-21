import type { Metadata } from "next";
import { EcranAVenir } from "@/components/shell/ecran-a-venir";
import { NAVIGATION } from "@/lib/navigation";

const entree = NAVIGATION.find((e) => e.href === "/affaires")!;

export const metadata: Metadata = { title: entree.libelle };

export default function Page() {
  return <EcranAVenir entree={entree} description="Vos affaires en cours, avec leur étape, leur prochaine échéance et leur état." />;
}
