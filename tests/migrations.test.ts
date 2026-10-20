import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(__dirname, "..", "supabase", "migrations");
const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort();

/** Retire les commentaires SQL pour ne contrôler que le code. */
const code = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("migrations (CLAUDE.md, sections 5.3 et 6.1)", () => {
  it("sont nommées <horodatage>_<sujet>.sql et en ordre strict", () => {
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    const versions = fichiers.map((f) => f.slice(0, 14));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("n'utilisent now() et current_date que dans la définition de l'horloge", () => {
    for (const f of fichiers) {
      const sql = code(readFileSync(join(DOSSIER, f), "utf8"));
      const usages = sql.match(/\bnow\s*\(\s*\)|\bcurrent_date\b|\bcurrent_timestamp\b/gi) ?? [];
      if (f.endsWith("_horloge.sql")) {
        expect(usages, f).toEqual(["now()"]); // le seul now() autorisé : celui de prive.app_now()
      } else {
        expect(usages, f).toEqual([]);
      }
    }
  });

  it("activent la RLS sur chaque table créée", () => {
    const tout = fichiers.map((f) => code(readFileSync(join(DOSSIER, f), "utf8"))).join("\n");
    const tables = [...tout.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(10);
    for (const t of tables) {
      const directe = new RegExp(`alter table public\\.${t} enable row level security`, "i").test(tout);
      const parBoucle = new RegExp(`array\\[[^\\]]*'${t}'[^\\]]*\\][^;]*loop[\\s\\S]*?enable row level security`, "i").test(tout);
      expect(directe || parBoucle, `RLS absente sur ${t}`).toBe(true);
    }
  });
});
