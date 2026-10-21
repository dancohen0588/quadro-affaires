import Link from "next/link";
import { Clock, FlaskConical, Mail } from "lucide-react";

/**
 * Bandeau permanent du mode démo (section 5.4). Texte + icône : la couleur ne porte pas seule l'information (ENF-04).
 * Il signale la date simulée quand l'horloge est avancée et mène à l'horloge (gérants) et à la boîte d'envoi.
 */
export function DemoBanner({ connecte = false, estGerant = false, dateSimulee = null }: { connecte?: boolean; estGerant?: boolean; dateSimulee?: string | null }) {
  const lien = "inline-flex items-center gap-1 underline-offset-2 hover:underline";
  return (
    <div
      role="note"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#f6ead2] px-4 py-1.5 text-sm font-semibold text-[#6b4a0f]"
    >
      <span className="inline-flex items-center gap-2"><FlaskConical aria-hidden className="size-4" /> Démonstration — données fictives</span>
      {dateSimulee && <span data-testid="bandeau-date-simulee">Date simulée : {dateSimulee}</span>}
      {connecte && estGerant && <Link href="/horloge" className={lien}><Clock aria-hidden className="size-3.5" /> Horloge</Link>}
      {connecte && <Link href="/boite-envoi" className={lien}><Mail aria-hidden className="size-3.5" /> Boîte d&apos;envoi</Link>}
    </div>
  );
}
