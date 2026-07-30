import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkArchitecture } from "../scripts/check-architecture.mts";

const repoRoot = path.resolve(__dirname, "..");

/**
 * The Atlas guard (plan §P.7, §P.10).
 *
 * The repo has no CI service, so `pnpm test` *is* the CI — and since every push
 * is gated on the suite, this guard gates deploys too. It fails in three
 * distinct ways, each with a different fix:
 *
 *   stale output          → run `pnpm architecture:generate`, review the diff,
 *                           and include it in the change like any other file.
 *   schema-invalid or
 *   nondeterministic      → a generator bug. Fix it before proceeding.
 *   a new finding         → a control went dormant, a route lost its auth
 *                           classification, or a module marked for retirement
 *                           gained a caller. Fix the code, or record a reviewed
 *                           exception. Silence is never an option.
 *
 * The check reads only source; it opens no database, reads no env value and
 * touches no storage, so it is safe in every environment the suite runs in.
 */
describe("architecture atlas", () => {
  it(
    "is fresh, schema-valid, deterministic and free of secret-shaped strings",
    () => {
      const { ok, problems } = checkArchitecture();
      expect(ok, `Atlas check failed:\n  - ${problems.join("\n  - ")}`).toBe(true);
    },
    60_000,
  );

  it("lives outside the client tree so Vite never bundles it", () => {
    // §P.9: the explorer is an internal document, not a product surface. It
    // sits under docs/ precisely so it cannot be shipped to a browser by
    // accident, and the vite root is client/ — this pins both facts.
    const atlasDir = path.join(repoRoot, "docs", "architecture");
    expect(fs.existsSync(atlasDir)).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "client", "src", "architecture"))).toBe(false);

    const viteConfig = fs.readFileSync(path.join(repoRoot, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toContain("docs/architecture");
    expect(viteConfig).not.toContain("docs\\architecture");
  });

  it("records env var names without their values", () => {
    // The generator cannot read a value by construction (§P.3); this pins the
    // shape of the output so a future extension cannot quietly start doing so.
    const atlas = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs", "architecture", "drape-architecture.json"),
        "utf8",
      ),
    ) as { envVars: Array<Record<string, unknown>> };

    expect(atlas.envVars.length).toBeGreaterThan(0);
    for (const entry of atlas.envVars) {
      expect(Object.keys(entry).sort()).toEqual(["id", "name", "valueRecorded"]);
      expect(entry.valueRecorded).toBe(false);
    }
  });
});
