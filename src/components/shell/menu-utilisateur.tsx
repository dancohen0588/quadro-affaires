"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { seConnecterCommePersonnage, seDeconnecter } from "@/app/connexion/actions";

type Personne = { id: string; prenom: string; nom: string; initiales: string; libelle: string };

/** Menu utilisateur : identité, changement de personnage (démo, section 5.4), déconnexion (EF-03). */
export function MenuUtilisateur({ moi, personnages }: { moi: Personne; personnages: Personne[] | null }) {
  const [enCours, demarrer] = useTransition();
  const pathname = usePathname();

  const changer = (id: string) =>
    demarrer(async () => {
      const fd = new FormData();
      fd.set("profilId", id);
      fd.set("suite", pathname);
      await seConnecterCommePersonnage(fd);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted aria-expanded:bg-muted"
        aria-label={`Menu de ${moi.prenom}`}
        disabled={enCours}
      >
        <Pastille initiales={moi.initiales} />
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold text-encre">{moi.prenom} {moi.nom}</span>
          <span className="block text-xs text-muted-foreground">{moi.libelle}</span>
        </span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {personnages && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Changer de personnage</DropdownMenuLabel>
              {personnages
                .filter((p) => p.id !== moi.id)
                .map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => changer(p.id)} className="py-1.5">
                    <Pastille initiales={p.initiales} petite />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{p.prenom} {p.nom}</span>
                      <span className="block text-xs text-muted-foreground">{p.libelle}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => demarrer(() => seDeconnecter())}>
          <LogOut aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pastille({ initiales, petite = false }: { initiales: string; petite?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-sage-500 font-bold text-teal-900 ${petite ? "size-7 text-[11px]" : "size-9 text-xs"}`}
    >
      {initiales}
    </span>
  );
}
