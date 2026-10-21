import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête (cookies de jeton), comme le recommande @supabase/ssr.
 * Sans configuration Supabase (build, tests du socle), ne fait rien.
 */
export async function rafraichirSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aPoser, headers) => {
        aPoser.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        aPoser.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([cle, valeur]) => response.headers.set(cle, valeur));
      },
    },
  });

  // Vérifie le jeton et le renouvelle si besoin ; ne rien intercaler entre la création du client et cet appel.
  await supabase.auth.getClaims();
  return response;
}
