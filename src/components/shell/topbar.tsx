import { Search } from "lucide-react";
import { LIBELLES_ROLE } from "@/lib/demo/personnages";
import { isDemo } from "@/lib/env";
import type { ProfilCourant } from "@/server/session";
import { listerPersonnages } from "@/server/personnages";
import { MenuUtilisateur } from "./menu-utilisateur";

function libelle(role: ProfilCourant["role"], magasins: string[]): string {
  const ou = magasins.length >= 3 ? "3 magasins" : magasins.join(", ");
  return ou ? `${LIBELLES_ROLE[role]} · ${ou}` : LIBELLES_ROLE[role];
}

/**
 * Barre du haut : recherche globale (clients, affaires, contremarques, références Gesteos — section 9,
 * branchée en J3, EF-21) et menu utilisateur.
 */
export async function Topbar({ profil }: { profil: ProfilCourant }) {
  const personnages = isDemo()
    ? (await listerPersonnages()).map((p) => ({ ...p, libelle: libelle(p.role, p.magasins) }))
    : null;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b bg-card px-6">
      <form role="search" className="relative w-full max-w-md" action="/affaires">
        <label htmlFor="recherche-globale" className="sr-only">
          Rechercher un client, une affaire, une contremarque ou une référence Gesteos
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="recherche-globale"
          name="q"
          type="search"
          placeholder="Rechercher un client, une affaire, une contremarque…"
          className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-[15px] placeholder:text-muted-foreground"
        />
      </form>

      <MenuUtilisateur
        moi={{
          id: profil.id,
          prenom: profil.prenom,
          nom: profil.nom,
          initiales: profil.initiales,
          libelle: libelle(profil.role, profil.magasins.map((m) => m.nom)),
        }}
        personnages={personnages}
      />
    </header>
  );
}
