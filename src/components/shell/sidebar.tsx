"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Columns3,
  FolderKanban,
  Gauge,
  ListChecks,
  Settings,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAVIGATION, entreeActive, type EntreeNavigation } from "@/lib/navigation";

const ICONES: Record<EntreeNavigation["icone"], LucideIcon> = {
  "ma-journee": ListChecks,
  affaires: FolderKanban,
  pipeline: Columns3,
  planning: Truck,
  reglements: Wallet,
  pilotage: Gauge,
  admin: Settings,
};

/** `badges` : compteur par entrée (tâches du jour, demandes de planning en attente). */
export type Badge = { nombre: number; libelle: string };
export function Sidebar({ estGerant, badges = {} }: { estGerant: boolean; badges?: Record<string, Badge> }) {
  const pathname = usePathname();
  const active = entreeActive(pathname);
  const commun = NAVIGATION.filter((e) => !e.gerantsSeulement);
  const gerants = NAVIGATION.filter((e) => e.gerantsSeulement);

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
        <span aria-hidden className="size-4 rounded-[5px_5px_5px_1px] bg-sage-500" />
        <div className="leading-tight">
          <p className="font-heading text-xl font-bold text-white">Quadro</p>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-sidebar-foreground/80">AFFAIRES</p>
        </div>
      </div>

      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-6 px-3">
        <ul className="flex flex-col gap-1">
          {commun.map((e) => (
            <ItemNavigation key={e.href} entree={e} actif={active?.href === e.href} badge={badges[e.href]} />
          ))}
        </ul>
        {estGerant && (
          <div>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-sidebar-foreground/70 uppercase">
              Gérants
            </p>
            <ul className="flex flex-col gap-1">
              {gerants.map((e) => (
                <ItemNavigation key={e.href} entree={e} actif={active?.href === e.href} badge={badges[e.href]} />
              ))}
            </ul>
          </div>
        )}
      </nav>
    </aside>
  );
}

function ItemNavigation({ entree, actif, badge }: { entree: EntreeNavigation; actif: boolean; badge?: Badge }) {
  const Icone = ICONES[entree.icone];
  return (
    <li>
      <Link
        href={entree.href}
        aria-current={actif ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors",
          "hover:bg-sidebar-accent/60 hover:text-white focus-visible:outline-sidebar-ring",
          actif && "bg-sidebar-accent text-white",
        )}
      >
        <Icone aria-hidden className="size-[18px] opacity-90" />
        {entree.libelle}
        {!!badge?.nombre && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sage-500 px-1.5 text-[12px] font-bold text-teal-900">
            {badge.nombre}<span className="sr-only"> {badge.libelle}</span>
          </span>
        )}
      </Link>
    </li>
  );
}
