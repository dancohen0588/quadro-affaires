import { NextResponse, type NextRequest } from "next/server";
import { DEMO_ACCESS_COOKIE, decideAccess } from "@/lib/demo-access";
import { readAppMode, readDemoAccessCode } from "@/lib/env";

// Next.js 16 : l'ancien « middleware » s'appelle désormais « proxy » (docs/01-app/01-getting-started/16-proxy.md).
// Vérification optimiste du code d'accès de la démo ; les droits réels restent dans la base (RLS).

export async function proxy(request: NextRequest) {
  const decision = await decideAccess({
    appMode: readAppMode(),
    configuredCode: readDemoAccessCode(),
    cookieValue: request.cookies.get(DEMO_ACCESS_COOKIE)?.value,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isDevelopment: process.env.NODE_ENV === "development",
  });

  if (decision.kind === "allow") return NextResponse.next();
  if (decision.kind === "redirect") return NextResponse.redirect(new URL(decision.to, request.url));
  return new NextResponse(
    "Démonstration non configurée : la variable DEMO_ACCESS_CODE est absente.",
    { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

export const config = {
  // Tout sauf les fichiers statiques et les ressources internes de Next.js.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)"],
};
