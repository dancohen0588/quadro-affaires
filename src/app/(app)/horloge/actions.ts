"use server";

import { revalidatePath } from "next/cache";
import { SystemClock } from "@/adapters/clock";
import { ecrireDecalageDemo, lireDecalageDemo } from "@/adapters/horloge-demo";
import { instantParis } from "@/lib/format";
import { HEURE_NUIT, cibleHorloge, decalagePour, joursFranchis, type Pas } from "@/lib/horloge";
import { exigerGerant, exigerModeDemo } from "@/server/garde";
import { lienAbsolu } from "@/server/notifications";
import { traitementsDeNuit, type BilanNuit } from "@/server/nuit";

export type ResultatHorloge = { ok: true; simule: string; bilans: BilanNuit[] } | { ok: false; message: string };

const reel = () => new SystemClock().now();

/**
 * Avance l'horloge de démo (gérants) : pour chaque nuit franchie, l'horloge est posée à 6 h 30 de ce jour et
 * les traitements de nuit tournent ; puis elle est posée sur l'instant visé. « Revenir à aujourd'hui » remet
 * l'heure réelle sans rien rejouer.
 */
export async function avancerHorloge(pas: Pas): Promise<ResultatHorloge> {
  exigerModeDemo();
  await exigerGerant();
  if (!["jour", "semaine", "lundi", "reel"].includes(pas)) return { ok: false, message: "Pas inconnu." };
  try {
    const maintenant = await reel();
    const simule = new Date(maintenant.getTime() + (await lireDecalageDemo()) * 1000);
    const cible = cibleHorloge(pas, simule, maintenant);
    const base = await lienAbsolu("");
    const bilans: BilanNuit[] = [];
    if (pas !== "reel") {
      for (const jour of joursFranchis(simule, cible)) {
        await ecrireDecalageDemo(decalagePour(new Date(instantParis(jour, HEURE_NUIT)), await reel()));
        bilans.push(await traitementsDeNuit(jour, base));
      }
    }
    await ecrireDecalageDemo(pas === "reel" ? null : decalagePour(cible, await reel()));
    revalidatePath("/", "layout");
    return { ok: true, simule: cible.toISOString(), bilans };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Horloge : erreur inattendue." };
  }
}
