import { csvPipeline } from "@/lib/indicateurs/pipeline";
import { exigerProfil } from "@/server/garde";
import { chargerPipeline } from "@/server/indicateurs";
import { lireFiltresPipeline } from "../filtres";

/** Export CSV de la vue liste du pipeline (EF-82), avec les filtres de l'écran et les droits de l'utilisateur. */
export async function GET(request: Request) {
  const moi = await exigerProfil();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { colonnes, aujourdhui } = await chargerPipeline(moi, lireFiltresPipeline(sp));
  return new Response(csvPipeline(colonnes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pipeline-${aujourdhui}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
