import "server-only";
import { clientAdmin } from "@/lib/supabase/server";

/**
 * Décalage de l'horloge de démo, lu dans `parametre.horloge_demo` (section 5.4) : même source que
 * prive.app_now() côté SQL, pour que l'interface, les triggers et le moteur voient le même jour.
 */
export async function lireDecalageDemo(): Promise<number> {
  const { data, error } = await clientAdmin().from("parametre").select("valeur").eq("cle", "horloge_demo").maybeSingle();
  if (error) throw new Error(`Horloge de démo illisible : ${error.message}`);
  const valeur = data?.valeur as { decalage_secondes?: unknown } | null | undefined;
  const decalage = Number(valeur?.decalage_secondes ?? 0);
  return Number.isFinite(decalage) ? decalage : 0;
}
