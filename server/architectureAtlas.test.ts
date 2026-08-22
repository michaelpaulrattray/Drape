import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { atlasSourcePaths, checkArchitecture } from "../scripts/check-architecture.mts";
import { sourceText } from "../scripts/generate-architecture.mts";

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

  it("⚠ AN ATLAS PATH GIT DOES NOT TRACK IS A CLONE THAT CANNOT BUILD", () => {
    /*
      The incident: `52f4d93b` committed an Atlas naming
      `server/castingV2/carrySurvival.test.ts` and never staged the file. 173
      lines, 28 passing arms, present on exactly one machine — and the freshness
      check above could not see it, because it regenerates from that same
      working tree and therefore agreed with itself. A clean clone of `main`
      failed this file with a fingerprint mismatch and no explanation.

      Driven on an INJECTED index rather than the real one, so the arm proves
      the rule and not today's tree: a suite that passes only because the tree
      happens to be clean tests nothing on the day it is not.
    */
    const realPaths = atlasSourcePaths(JSON.parse(
      fs.readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
    ));
    /* Population first — an empty path list would make both arms below vacuous,
       and an empty list is exactly what a renamed `path:` key produces. */
    expect(realPaths.length, "source paths the Atlas names").toBeGreaterThan(500);
    expect(realPaths).toContain("server/castingV2/carrySurvival.test.ts");

    /* An index missing one real file — the defect, reported by name because the
       action is `git add <path>` and a count does not tell you what to add. */
    const missingOne = new Set(realPaths.filter((file) => file !== realPaths[0]));
    const withHole = checkArchitecture({ trackedFiles: () => missingOne });
    expect(withHole.problems.join("\n")).toContain(`${realPaths[0]} is in the Atlas but is NOT TRACKED BY GIT`);

    /* And the reader's own blindness is a problem rather than a pass: an empty
       `git ls-files` — no git, a wrong cwd, a swallowed throw — would otherwise
       let this check report a clean tree while examining nothing. */
    const blind = checkArchitecture({ trackedFiles: () => new Set<string>() });
    expect(blind.problems.join("\n")).toContain("cannot see the index");
    /* It must NOT then also blame every file individually — one honest problem,
       not a thousand derived from it. */
    expect(blind.problems.filter((p) => p.includes("NOT TRACKED BY GIT"))).toEqual([]);
  }, 120_000);

  it("CAN FAIL — the path reader driven on the shapes the generator emits", () => {
    /*
      `atlasSourcePaths` decides a POPULATION, and a population reader that
      returns everything is as useless as one that returns nothing. The
      generator emits three kinds of `path:` and only one is a file.
    */
    expect(atlasSourcePaths({
      modules: [{ path: "server/db/storageCleanup.ts" }],
      tests: [{ path: "server/castingV2/carrySurvival.test.ts" }],
      client: [{ path: "client/src/App.tsx" }],
      routes: [
        /* Not a file — the generator's own placeholder for a router-defined route. */
        { path: "(defined by the router)" },
        /* Not a file — an HTTP path. */
        { path: "/api/health" },
      ],
    })).toEqual([
      "client/src/App.tsx",
      "server/castingV2/carrySurvival.test.ts",
      "server/db/storageCleanup.ts",
    ]);
    /* Nested arbitrarily deep, because the Atlas nests. */
    expect(atlasSourcePaths({ a: { b: [{ c: { path: "scripts/deploy-rite.mts" } }] } }))
      .toEqual(["scripts/deploy-rite.mts"]);
    /* And nothing at all, from something that names no paths. */
    expect(atlasSourcePaths({ meta: { sourceFingerprint: "abc" } })).toEqual([]);
  });

  it("⚠ A CRLF-SMUDGED CHECKOUT IS NOT A STALE ATLAS (fable-1366 §3c)", () => {
    /*
      The generator writes LF; git on Windows hands the working copy back with
      CRLF. A raw byte comparison then reported the Atlas STALE with IDENTICAL
      fingerprints on both sides and an EMPTY `git diff` — a verdict whose own
      instructions cannot reproduce it, on the gate the currency law just gave
      teeth to.

      Driven through `checkArchitecture` itself rather than through the
      normalizer, because a normalizer that is correct and never consulted is
      the failure this whole file exists to be the opposite of.
    */
    const CR = String.fromCharCode(13);
    const smudged = (at: string) =>
      fs.readFileSync(at, "utf8").split("\n").join(`${CR}\n`);
    const { ok, problems } = checkArchitecture({ readFile: smudged });
    expect(ok, `a CRLF checkout was read as stale: ${problems.join(" | ")}`).toBe(true);
  }, 60_000);

  it("CONTROL — a REAL content change is still stale", () => {
    /*
      Without this, the arm above is satisfied by a checker that compares
      nothing at all. One character, inside the committed JSON, and the
      freshness rule must still fire.
    */
    const tampered = (at: string) => {
      const text = fs.readFileSync(at, "utf8");
      return at.endsWith("drape-architecture.json")
        ? text.replace(/"schemaVersion": "/, '"schemaVersion": "9')
        : text;
    };
    const { ok, problems } = checkArchitecture({ readFile: tampered });
    expect(ok).toBe(false);
    expect(problems.join(" ")).toContain("drape-architecture.json is stale");
  }, 60_000);

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

  /**
   * ⚠ A FLAG IS AN ENVIRONMENT VARIABLE, AND FOR MOST OF THIS ATLAS'S LIFE THE
   * TWO LISTS DID NOT AGREE THAT IT WAS.
   *
   * `collectFlags` was hardened to read three access forms — `process.env.NAME`,
   * `process.env["NAME"]`, and `const SOMETHING_ENV = "NAME"` — because the
   * rollout scopes are all reached through that third one. `collectEnvVars` was
   * a separate reader that knew only the first two, and nothing ever compared
   * them. Read off the committed artifact on 2026-08-23: **25 of the 29 flags
   * were absent from `envVars`**, among them `CASTING_V2_SCOPE`, the root flag
   * of the whole program. Four evidence-bucket credential NAMES were missing
   * with them (`R2_EVIDENCE_BUCKET` and its two keys, `R7_EVIDENCE_COMPOSER_RECIPE`).
   *
   * This is the strongest kind of finding an artifact can carry, because it
   * needs no outside reference: **one list contradicted the other inside the
   * same file.**
   *
   * `collectFlags` is now a filtered VIEW of the env-var set rather than a
   * parallel reading of the same source (working law 4), so the inclusion holds
   * by construction. This asserts it anyway — the construction is the fix, and
   * this is what notices if someone un-derives it.
   */
  it("every flag is also an env var — one reader, not two", () => {
    const atlas = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs", "architecture", "drape-architecture.json"),
        "utf8",
      ),
    ) as { envVars: Array<{ name: string }>; flags: Array<{ name: string }> };

    const envNames = new Set(atlas.envVars.map((entry) => entry.name));
    const flagNames = atlas.flags.map((entry) => entry.name);

    /* Population first: an empty flag list is a subset of anything, and that
       reads exactly like coverage (`absence-only-expect-passes-on-nothing`). */
    expect(flagNames.length).toBeGreaterThan(20);
    expect(envNames.size).toBeGreaterThan(flagNames.length);

    expect(
      flagNames.filter((name) => !envNames.has(name)),
      "flags the env-var inventory has never heard of — the two readers have stopped seeing the same access forms",
    ).toEqual([]);
  });

  /**
   * THE FRESHNESS VERDICT ABOVE IS ONLY A READING IF ITS HASH IS OF THE SOURCE
   * (found opus-926 §5, ordered fable-1234 §2b).
   *
   * `core.autocrlf` is `true` here, so `git checkout` rewrites line endings on
   * every file it touches and the working tree runs MIXED. The fingerprint
   * hashes file text, so before `sourceText` it hashed that skew: the same
   * commit answered `23a85001b1a85f4d` and then `99989fd2d9720929` minutes
   * apart, and flipping ONE file from LF to CRLF — content untouched, `git
   * diff` empty — moved it on demand. The first test in this file was
   * therefore a coin flip wearing a reading's face, over the arm that keeps
   * the Atlas usable as the retirement program's deletion authority.
   *
   * This is the property guarded by construction rather than remembered. It
   * drives the normalize DIRECTLY, on a fixture pair, so it cannot be rescued
   * by whatever endings this checkout happens to hold.
   */
  it("hashes the SOURCE and not this disk — CRLF and LF text are the same text", () => {
    const lf = "const a = 1;\nconst b = 2;\n\nexport { a, b };\n";
    const crlf = lf.replaceAll("\n", "\r\n");

    // The negative control: the two fixtures really are different bytes, so a
    // passing assertion below is the normalize working and not the fixtures
    // being identical.
    expect(crlf).not.toEqual(lf);
    expect(sha(crlf)).not.toEqual(sha(lf));

    expect(sourceText(crlf)).toEqual(sourceText(lf));
    expect(sha(sourceText(crlf))).toEqual(sha(sourceText(lf)));

    // And a lone CR is CONTENT, not a line ending — it must survive, or the
    // normalize is quietly editing source rather than folding endings.
    expect(sourceText("a\rb")).toEqual("a\rb");
  });
});

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
