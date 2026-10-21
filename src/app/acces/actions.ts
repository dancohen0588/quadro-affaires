"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEMO_ACCESS_COOKIE,
  DEMO_ACCESS_MAX_AGE_S,
  DEMO_ACCESS_PATH,
  accessToken,
  safeEqual,
  safeNextPath,
} from "@/lib/demo-access";
import { readDemoAccessCode } from "@/lib/env";

/** Vérifie le code saisi et pose le cookie d'accès à la démo (section 5.4). */
export async function verifierCodeAcces(formData: FormData) {
  const suite = safeNextPath(String(formData.get("suite") ?? "/"));
  const saisi = String(formData.get("code") ?? "").trim();
  const attendu = readDemoAccessCode();

  // Petit délai fixe : rend les essais en série moins confortables, sans bloquer un utilisateur légitime.
  await new Promise((r) => setTimeout(r, 400));

  if (!attendu || !saisi || !safeEqual(await accessToken(saisi), await accessToken(attendu))) {
    redirect(`${DEMO_ACCESS_PATH}?suite=${encodeURIComponent(suite)}&erreur=1`);
  }

  (await cookies()).set(DEMO_ACCESS_COOKIE, await accessToken(attendu), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_ACCESS_MAX_AGE_S,
  });
  redirect(suite);
}
