import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { seDeconnecter } from "@/app/connexion/actions";

export const metadata: Metadata = { title: "Accès non autorisé" };

/** Compte connecté sans profil actif (EF-02). */
export default function PageAccesRefuse() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
        <h1 className="text-2xl">Accès non autorisé</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Accès non autorisé, contactez un gérant.</p>
        <form action={seDeconnecter} className="mt-6">
          <Button type="submit" variant="outline" className="h-10 text-[15px]">Se déconnecter</Button>
        </form>
      </div>
    </main>
  );
}
