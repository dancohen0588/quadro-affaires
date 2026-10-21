import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./session", () => ({ lireSession: vi.fn() }));

import { exigerModeDemo } from "./garde";

describe("exigerModeDemo (section 5.4)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("laisse passer en démo", () => {
    vi.stubEnv("APP_MODE", "demo");
    expect(() => exigerModeDemo()).not.toThrow();
  });

  it("rend la page introuvable (404) en production", () => {
    vi.stubEnv("APP_MODE", "production");
    expect(() => exigerModeDemo()).toThrow(expect.objectContaining({ digest: expect.stringContaining("404") }));
  });
});
