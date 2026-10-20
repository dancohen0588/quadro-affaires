import { Construction } from "lucide-react";
import type { EntreeNavigation } from "@/lib/navigation";

/** Écran provisoire : dit honnêtement ce qui arrive et quand (plan de la section 15). */
export function EcranAVenir({ entree, description }: { entree: EntreeNavigation; description: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="text-3xl text-encre">{entree.libelle}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-start gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-teal-900">
          <Construction aria-hidden className="size-5" />
        </span>
        <div className="text-[15px]">
          <p className="font-semibold">Écran prévu au bloc {entree.bloc}</p>
          <p className="mt-1 text-muted-foreground">
            Exigences couvertes : <span className="font-mono text-[13px] text-encre">{entree.exigences}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
