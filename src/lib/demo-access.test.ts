import { describe, expect, it } from "vitest";
import { accessToken, decideAccess, isPublicPath, safeEqual, safeNextPath } from "./demo-access";

const base = {
  appMode: "demo" as const,
  configuredCode: "quadro-2026",
  cookieValue: undefined as string | undefined,
  pathname: "/pipeline",
  search: "?magasin=CIO",
  isDevelopment: false,
};

describe("verrou de la démo (section 5.4)", () => {
  it("laisse tout passer hors mode démo", async () => {
    expect(await decideAccess({ ...base, appMode: "production" })).toEqual({ kind: "allow" });
  });

  it("renvoie vers /acces en gardant la destination", async () => {
    expect(await decideAccess(base)).toEqual({
      kind: "redirect",
      to: "/acces?suite=%2Fpipeline%3Fmagasin%3DCIO",
    });
  });

  it("accepte le cookie qui porte l'empreinte du bon code", async () => {
    const cookieValue = await accessToken("quadro-2026");
    expect(await decideAccess({ ...base, cookieValue })).toEqual({ kind: "allow" });
  });

  it("refuse l'empreinte d'un autre code et le code en clair", async () => {
    expect((await decideAccess({ ...base, cookieValue: await accessToken("autre") })).kind).toBe("redirect");
    expect((await decideAccess({ ...base, cookieValue: "quadro-2026" })).kind).toBe("redirect");
  });

  it("bloque une démo sans code configuré, sauf en développement local", async () => {
    expect(await decideAccess({ ...base, configuredCode: null })).toEqual({ kind: "misconfigured" });
    expect(await decideAccess({ ...base, configuredCode: null, isDevelopment: true })).toEqual({ kind: "allow" });
  });

  it("ne verrouille ni la page de saisie ni les routes cron", async () => {
    expect(isPublicPath("/acces")).toBe(true);
    expect(isPublicPath("/api/cron/nuit")).toBe(true);
    expect(isPublicPath("/admin")).toBe(false);
    expect(await decideAccess({ ...base, pathname: "/acces", search: "" })).toEqual({ kind: "allow" });
  });

  it("n'accepte que des destinations internes", () => {
    expect(safeNextPath("/affaires/12?x=1")).toBe("/affaires/12?x=1");
    expect(safeNextPath("//exemple.com")).toBe("/");
    expect(safeNextPath("/\\exemple.com")).toBe("/");
    expect(safeNextPath("https://exemple.com")).toBe("/");
    expect(safeNextPath("/acces?suite=/x")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });

  it("produit une empreinte stable qui ne contient pas le code", async () => {
    const t = await accessToken("quadro-2026");
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t).toBe(await accessToken("quadro-2026"));
    expect(t).not.toContain("quadro");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
