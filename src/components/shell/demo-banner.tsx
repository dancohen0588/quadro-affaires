import { FlaskConical } from "lucide-react";

/** Bandeau permanent du mode démo (section 5.4). Texte + icône : la couleur ne porte pas seule l'information (ENF-04). */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="flex shrink-0 items-center justify-center gap-2 bg-[#f6ead2] px-4 py-1.5 text-sm font-semibold text-[#6b4a0f]"
    >
      <FlaskConical aria-hidden className="size-4" />
      Démonstration — données fictives
    </div>
  );
}
