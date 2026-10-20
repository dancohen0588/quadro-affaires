import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoBanner } from "@/components/shell/demo-banner";
import { safeNextPath } from "@/lib/demo-access";
import { verifierCodeAcces } from "./actions";

export const metadata: Metadata = { title: "Accès à la démonstration" };

export default async function PageAcces({
  searchParams,
}: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const suite = safeNextPath(typeof params.suite === "string" ? params.suite : "/");
  const erreur = params.erreur === "1";

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl bg-card p-8 ring-1 ring-foreground/10">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-teal-900 text-white">
              <KeyRound aria-hidden className="size-5" />
            </span>
            <div>
              <h1 className="text-xl">Quadro Affaires</h1>
              <p className="text-sm text-muted-foreground">Accès à la démonstration</p>
            </div>
          </div>

          <form action={verifierCodeAcces} className="flex flex-col gap-4">
            <input type="hidden" name="suite" value={suite} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code d&apos;accès</Label>
              <Input
                id="code"
                name="code"
                type="password"
                autoComplete="off"
                required
                autoFocus
                aria-invalid={erreur || undefined}
                aria-describedby={erreur ? "code-erreur" : undefined}
                className="h-10 text-[15px]"
              />
              {erreur && (
                <p id="code-erreur" role="alert" className="text-sm font-semibold text-etat-retard">
                  Code incorrect. Vérifiez-le auprès de Dan Cohen.
                </p>
              )}
            </div>
            <Button type="submit" className="h-10 text-[15px]">
              Entrer
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
