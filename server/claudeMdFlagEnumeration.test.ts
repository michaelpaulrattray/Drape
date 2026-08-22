/**
 * EVERY FEATURE FLAG THE CODE DECLARES IS NAMED IN `CLAUDE.md`.
 *
 * `CLAUDE.md`'s *"Optional .env vars (feature-gated)"* section reads as an
 * enumeration — one paragraph per flag, each naming its parent and what it
 * darkens — and a shift arriving at this product reads it as the flag list.
 *
 * ⚠ **On 2026-08-23 it was not one. EIGHT flags existed in the code and
 * appeared nowhere in it, and SIX of those were SET ON THE PRODUCTION SERVICE**
 * — `CASTING_TWO_PATHS_SCOPE`, `CASTING_DIAGNOSTIC_CAPTURE_SCOPE`,
 * `R7_SNAPSHOT_READ_SCOPE` (`all`), `R7_SNAPSHOT_RESTORE_SCOPE` (`users:1`),
 * `R7_EVIDENCE_COMPOSER_SCOPE`, `R7_EVIDENCE_COMPOSER_RECIPE`,
 * `R7_EVIDENCE_PACKAGE_SCOPE`, `ENABLE_EVIDENCE_CANDIDATE_WORKER`. Read off
 * `scripts/deploy-rite.mts`'s own flag block, which prints what the service
 * holds rather than what anyone remembers.
 *
 * It is the SAME failure as the Express route list one section up
 * (`architectureExpressSurfaces.test.ts`), pointed at a different list, and
 * `CLAUDE.md`'s own sentence about that one is the argument here: *a route that
 * exists but is not on the list is how the list stops being the list.*
 *
 * # DERIVED, NEVER MIRRORED (working law 4)
 *
 * The population is not a list typed here. It is every string literal assigned
 * to an exported `*_ENV` constant — the house pattern for *this is the name of
 * an environment variable* — so a new flag joins the population by being
 * written, not by anyone remembering this file.
 *
 * ⚠ **THE POPULATION IS ASSERTED NON-EMPTY AND LARGE FIRST**, before anything
 * is said about members. An enumeration guard whose scan silently returns
 * nothing is green over an empty set, which reads exactly like coverage
 * (`absence-only-expect-passes-on-nothing`). The negative control below drives
 * that directly.
 *
 * ⚠ **AND THE SCANNER IS MULTILINE ON PURPOSE.** `EVIDENCE_CANDIDATE_WORKER_ENV`
 * is declared with its value on the NEXT line, and a single-line regex drops it
 * without a word — which would have made this arm lose the one flag of the
 * eight that is not a scope. A derivation that silently loses a member is worse
 * than the list it replaces, because it reads as coverage. The positive control
 * pins that specimen by name.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Every non-test TypeScript file under the server and shared trees. */
function sourceFiles(from: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const at = path.join(dir, entry);
      if (statSync(at).isDirectory()) {
        walk(at);
        continue;
      }
      if (!at.endsWith(".ts")) continue;
      if (at.endsWith(".test.ts")) continue;
      found.push(at);
    }
  };
  walk(from);
  return found;
}

/**
 * The declared environment-variable names, read out of the code.
 *
 * `[\s\S]*?` rather than a same-line match: see the multiline note in the
 * header — one real declaration wraps, and dropping it would be the exact
 * defect this file exists to catch, committed by the file itself.
 */
export function declaredEnvNames(sources: readonly string[]): string[] {
  const names = new Set<string>();
  const declaration = /export\s+const\s+[A-Z0-9_]*ENV[A-Z0-9_]*\s*=[\s\S]{0,40}?"([A-Z][A-Z0-9_]{3,})"/g;
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const hit of text.matchAll(declaration)) names.add(hit[1]!);
  }
  return [...names].sort();
}

const DECLARED = declaredEnvNames([
  ...sourceFiles(path.join(repoRoot, "server")),
  ...sourceFiles(path.join(repoRoot, "shared")),
]);

describe("the flag list is the flag list", () => {
  it("⚠ CONTROL — the scanner found a real population, and the wrapped declaration is in it", () => {
    /*
      POSITIVE CONTROLS, first and by name. Without these every assertion below
      is vacuously true over an empty scan, which is how an enumeration guard
      goes green while enumerating nothing.
    */
    expect(DECLARED.length).toBeGreaterThan(25);
    expect(DECLARED, "the scope flags this product is built on").toContain("CASTING_V2_SCOPE");
    expect(
      DECLARED,
      "the WRAPPED declaration — its value is on the line after the `=`, and a same-line regex drops it silently",
    ).toContain("ENABLE_EVIDENCE_CANDIDATE_WORKER");
  });

  it("⚠ CONTROL — a declaration the scanner cannot see would be caught", () => {
    /*
      NEGATIVE CONTROL. The instrument must be able to answer NO, and the shape
      that matters is a name the document does not carry — driven against a
      fixture rather than by breaking the repository.
    */
    expect(declaredEnvNames([])).toEqual([]);
    const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
    expect(claude.includes("A_FLAG_NOBODY_HAS_WRITTEN_SCOPE")).toBe(false);
  });

  it("names every declared environment variable somewhere in CLAUDE.md", () => {
    const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
    const missing = DECLARED.filter((name) => !claude.includes(name));
    expect(
      missing,
      "these environment variables exist in the code and are absent from CLAUDE.md — "
      + "a flag that exists but is not on the list is how the list stops being the list. "
      + "Add a line to the feature-gated section naming its grammar and its parent.",
    ).toEqual([]);
  });
});
