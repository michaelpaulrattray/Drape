import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A SCRIPT THAT READS THE APP'S DATABASE DECLARES WHICH WORLD IT IS IN.
 *
 * `railway run --service MySQL` injects that service's variables and **no
 * `DATABASE_URL`**. A script that loads `.env` for anything else — a `FAL_KEY`,
 * an R2 credential — then reaches for `DATABASE_URL` gets the DEV database
 * back, under a command whose entire purpose was to read production, with
 * nothing in the output to say so. That is how a "production is empty" reading
 * was once taken from dev.
 *
 * `assertOneWorld` (`scripts/lib/worldGuard.mts`) refuses that process by name.
 * It is inert outside a Railway run, so a plain `npx tsx` against dev never
 * sees it — which is exactly why it is cheap to require and easy to forget.
 *
 * # Why a scan and not a list
 *
 * A roadmap line has said "11 dev-fixture `getDb()` scripts still lack world
 * guards — guard when next touched, or burn down in one sitting" since
 * 2026-08-09. By 2026-08-16 it was **thirty-four**, and the line had not
 * changed. A burn-down without a guard is a burn-down with a schedule for
 * coming back.
 *
 * # The scope is derived twice, and neither half is a hand list
 *
 * IN scope: a file under `scripts/` whose text calls `getDb()` — the app's own
 * pool, which reads `DATABASE_URL` and nothing else. The scan decides that, so
 * a script written tomorrow is in scope the moment it calls it.
 *
 * OUT of scope: a file named `*-disposable.mts`. That suffix is this
 * repository's own convention for a one-shot bench, not a category invented
 * here — 200-odd files use it. The module's own header makes the argument for
 * excluding them: *"a guard people learn to work around is a guard that is
 * off."* A bench that ran once against dev and will never be run again does
 * not need a ceremony, and requiring one on 200 files is how the ceremony stops
 * being read.
 *
 * The residue — a permanent script that genuinely should not carry the guard —
 * goes in `EXEMPT` with a reason, and the reason is asserted to exist.
 */

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptsDir = path.join(repoRoot, "scripts");

/**
 * Permanent scripts that call `getDb()` and deliberately carry no guard.
 *
 * Empty on purpose as of 2026-08-16: the burn-down closed all twenty-one. An
 * entry here is a decision, not a backlog.
 */
const EXEMPT: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.m?ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Everything under `scripts/` that reaches the app's own pool. */
export function databaseScripts(root: string): string[] {
  return walk(root)
    .filter((file) => readFileSync(file, "utf8").includes("getDb()"))
    .map((file) => path.relative(root, file).split(path.sep).join("/"));
}

/**
 * Does this file CALL the guard — not merely import it?
 *
 * The distinction is the whole point, and the first cut of this checker missed
 * it: matching the bare identifier `assertOneWorld` is satisfied by the import
 * line alone. Deleting the call and leaving the import — which is exactly what
 * a careless edit or a bad merge produces — left the scan green. Found by
 * sabotaging a guarded script and watching nothing happen. Invariant 7: a
 * control that is not invoked does not exist.
 */
function callsTheGuard(source: string): boolean {
  return /\bassertOneWorld\s*\(/.test(source);
}

/** In scope, unguarded, and not a one-shot bench. */
export function unguardedScripts(root: string): string[] {
  return databaseScripts(root).filter((relative) => {
    if (relative.endsWith("-disposable.mts")) return false;
    if (relative in EXEMPT) return false;
    return !callsTheGuard(readFileSync(path.join(root, relative), "utf8"));
  });
}

describe("a script that reads the app's database declares its world", () => {
  it("every permanent getDb() script calls assertOneWorld", () => {
    const unguarded = unguardedScripts(scriptsDir);
    expect(
      unguarded,
      `Add \`assertOneWorld(["DATABASE_URL"])\` after the imports — it is inert `
        + `locally and refuses a half-production process under \`railway run\`:\n`
        + unguarded.map((f) => `  scripts/${f}`).join("\n"),
    ).toEqual([]);
  });

  /*
    POSITIVE CONTROL, on a real unguarded file rather than a string.

    Without it the assertion above is what a scan that found NOTHING prints,
    and a walk that silently stopped reading — a renamed directory, a changed
    extension — is indistinguishable from a fully guarded repository. So the
    reader is pointed at a fixture it must complain about: the one-shot
    benches, which are unguarded on purpose and therefore always available as
    a known-positive population.
  */
  it("POSITIVE CONTROL — the reader does find unguarded getDb() scripts", () => {
    const benches = databaseScripts(scriptsDir)
      .filter((relative) => relative.endsWith("-disposable.mts"))
      .filter((relative) => !callsTheGuard(readFileSync(path.join(scriptsDir, relative), "utf8")));
    expect(
      benches.length,
      "no unguarded bench left to control against — swap this fixture for a synthetic one",
    ).toBeGreaterThan(0);
  });

  /* The scan must reach the tree: zero files read is zero violations found. */
  it("the scan reads the scripts tree", () => {
    expect(walk(scriptsDir).length).toBeGreaterThan(100);
    expect(databaseScripts(scriptsDir).length).toBeGreaterThan(10);
  });

  /*
    The hole the sabotage found, pinned so it cannot come back: an import
    without a call is not a guard. Driven directly rather than through the
    tree, because the tree is (correctly) free of the shape.
  */
  it("an import without a call does not count as guarded", () => {
    const importOnly = `import { assertOneWorld } from "./lib/worldGuard.mts";\nconst db = await getDb();\n`;
    expect(callsTheGuard(importOnly), "the import line must not satisfy the check").toBe(false);
    expect(callsTheGuard(`${importOnly}assertOneWorld(["DATABASE_URL"]);\n`)).toBe(true);
  });

  it("every exemption names a file that still exists, with a reason", () => {
    for (const [relative, reason] of Object.entries(EXEMPT)) {
      expect(databaseScripts(scriptsDir), `stale exemption: ${relative}`).toContain(relative);
      expect(reason.length, `exemption without a reason: ${relative}`).toBeGreaterThan(10);
    }
  });
});
