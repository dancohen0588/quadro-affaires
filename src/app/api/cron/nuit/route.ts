import { adaptateurs } from "@/adapters";
import { safeEqual } from "@/lib/demo-access";
import { readCronSecret } from "@/lib/env";
import { traitementsDeNuit } from "@/server/nuit";

/**
 * Traitements de nuit déclenchés par Vercel Cron (vercel.json), protégés par CRON_SECRET
 * (en-tête « Authorization: Bearer <secret> », envoyé par Vercel). Idempotent : un second appel le même jour
 * ne crée rien de plus.
 */
export async function GET(request: Request) {
  const secret = readCronSecret();
  if (!secret) return Response.json({ erreur: "CRON_SECRET absent" }, { status: 503 });
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ erreur: "Non autorisé" }, { status: 401 });
  const jour = await adaptateurs().clock.today();
  const bilan = await traitementsDeNuit(jour, new URL(request.url).origin);
  return Response.json(bilan, { status: bilan.erreurs.length ? 207 : 200 });
}
