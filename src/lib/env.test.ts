import { describe, expect, it } from "vitest";
import { isDemo, readAppMode, readDemoAccessCode, readSupabasePublicEnv } from "./env";

describe("APP_MODE", () => {
  it("accepte demo et production", () => {
    expect(readAppMode({ APP_MODE: "demo" })).toBe("demo");
    expect(readAppMode({ APP_MODE: "production" })).toBe("production");
    expect(isDemo({ APP_MODE: "demo" })).toBe(true);
  });

  it("refuse une valeur absente ou inconnue plutôt que de deviner", () => {
    expect(() => readAppMode({})).toThrow(/APP_MODE/);
    expect(() => readAppMode({ APP_MODE: "prod" })).toThrow(/APP_MODE/);
  });
});

describe("DEMO_ACCESS_CODE", () => {
  it("considère une chaîne vide comme absente", () => {
    expect(readDemoAccessCode({ DEMO_ACCESS_CODE: "  " })).toBeNull();
    expect(readDemoAccessCode({})).toBeNull();
    expect(readDemoAccessCode({ DEMO_ACCESS_CODE: " quadro " })).toBe("quadro");
  });
});

describe("configuration Supabase publique", () => {
  it("exige l'URL et la clé publishable", () => {
    expect(() => readSupabasePublicEnv({})).toThrow(/Supabase/);
    expect(
      readSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }),
    ).toEqual({ url: "https://abc.supabase.co", publishableKey: "sb_publishable_x" });
  });
});
