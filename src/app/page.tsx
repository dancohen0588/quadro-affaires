import { redirect } from "next/navigation";
import { PAGE_PAR_DEFAUT } from "@/lib/navigation";

/** « Ma journée » est l'écran par défaut (section 9.2). */
export default function Accueil() {
  redirect(PAGE_PAR_DEFAUT);
}
