import { cn } from "cn";

/** Pastille colorée d'une phase (« 04 Commande »), aux couleurs de la charte. */
export function PastillePhase({
  numero, nom, couleur, attenuee = false, className, children,
}: { numero?: string; nom?: string; couleur: string; attenuee?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn("inline-flex h-6 w-fit items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap", attenuee && "opacity-60", className)}
      style={{ color: couleur, backgroundColor: `color-mix(in srgb, ${couleur} 12%, white)` }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: couleur }} />
      {children ?? `${numero} ${nom}`}
    </span>
  );
}

/** Étiquette d'état (OK, attendu, à venir, retard). */
export function Etat({ ton, children, className }: { ton: "ok" | "attention" | "retard" | "neutre"; children: React.ReactNode; className?: string }) {
  const tons = {
    ok: "bg-etat-ok/12 text-etat-ok",
    attention: "bg-etat-attention/14 text-etat-attention",
    retard: "bg-etat-retard/12 text-etat-retard",
    neutre: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span className={cn("inline-flex h-6 w-fit items-center rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap", tons[ton], className)}>
      {children}
    </span>
  );
}
