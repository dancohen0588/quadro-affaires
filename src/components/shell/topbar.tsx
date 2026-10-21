import { Search, UserRound } from "lucide-react";

/**
 * Barre du haut : recherche globale (clients, affaires, contremarques, références Gesteos — section 9)
 * et menu utilisateur. La recherche est branchée en J3 (EF-21), le menu personnage en session 1.2.
 */
export function Topbar() {
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

      <div className="flex items-center gap-3 text-sm">
        <span className="flex size-9 items-center justify-center rounded-full bg-sage-100 text-teal-900" aria-hidden>
          <UserRound className="size-4" />
        </span>
        <span className="text-muted-foreground">Personnage à choisir (session 1.2)</span>
      </div>
    </header>
  );
}
