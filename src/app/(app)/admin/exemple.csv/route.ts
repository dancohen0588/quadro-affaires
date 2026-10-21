import { readFile } from "node:fs/promises";
import path from "node:path";
import { exigerGerant } from "@/server/garde";

/** Fichier d'exemple de l'import de reprise (docs/import/affaires-exemple.csv, section 13.1). */
export async function GET() {
  await exigerGerant();
  const contenu = await readFile(path.join(process.cwd(), "docs/import/affaires-exemple.csv"));
  return new Response(contenu, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="affaires-exemple.csv"' },
  });
}
