import type { Metadata } from "next";
import { EcranAVenir } from "@/components/shell/ecran-a-venir";
import { NAVIGATION } from "@/lib/navigation";

const entree = NAVIGATION.find((e) => e.href === "/pipeline")!;

export const metadata: Metadata = { title: entree.libelle };

export default function Page() {
  return <EcranAVenir entree={entree} description="Toutes les affaires actives, une colonne par phase du process." />;
}
