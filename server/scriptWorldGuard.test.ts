import { execFileSync } from "node:child_process";
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
 * OUT of scope: a file the repository does not contain — an untracked one-shot
 * bench. The module's own header makes the argument for excluding them: *"a
 * guard people learn to work around is a guard that is off."* A bench that ran
 * once against dev and will never be run again does not need a ceremony, and
 * requiring one on hundreds of files is how the ceremony stops being read.
 *
 * This was keyed on the `-disposable.mts` SUFFIX until 2026-08-19, and the
 * suffix is not the sentence — see `trackedScripts` for the day the two came
 * apart and what it cost. Both halves of the scope are now derived, and neither
 * is a hand list.
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

/**
 * THE ONE-SHOTS, BY WHAT MAKES THEM ONE-SHOTS — not by how they are spelled.
 *
 * The exemption above used to read `relative.endsWith("-disposable.mts")`, and
 * the argument for it was never about the letters: *"a bench that ran once
 * against dev and will never be run again does not need a ceremony."* A bench
 * that will never be run again is a file **the repository does not contain**.
 * Tracking status is that sentence; the suffix is a convention that agrees with
 * it right up until it does not.
 *
 * It stopped agreeing on 2026-08-19. Twenty-four `-disposable.mts` files were
 * promoted into the repository because tracked source and standing design notes
 * cite them by name — they are standing instruments now, and three of them read
 * the app's database. Under the old key they kept a one-shot's exemption
 * forever: guard calls were added to all three, and **deleting those calls
 * would not have reddened anything.** That is invariant 7 in the same shape the
 * sabotage found once already — an import without a call is not a guard, and a
 * guard nothing can fail is not a control.
 *
 * A rename would have closed it for those three files and left the class open
 * for the twenty-fifth promotion. This closes the class: the names stay as the
 * citers spell them, and the suffix is now residue.
 */
function trackedScripts(root: string): Set<string> {
  const listed = execFileSync("git", ["ls-files", "--", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const names = listed
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map((line) => path.relative(root, path.join(repoRoot, line)).split(path.sep).join("/"));
  /*
    REFUSE, DO NOT ALLOW, WHEN THE DEPENDENCY IS MISSING. This predicate decides
    who is EXEMPT, so an empty answer — git absent, a detached export, a build
    context that is not a checkout — would exempt every script in the tree and
    turn the whole suite green by making it blind. Invariant 7's other half.
  */
  if (names.length === 0) throw new Error("git ls-files returned no scripts — the exemption cannot be decided");
  return new Set(names);
}

/** In scope, unguarded, and not a one-shot bench. */
export function unguardedScripts(root: string): string[] {
  const tracked = trackedScripts(root);
  return databaseScripts(root).filter((relative) => {
    if (!tracked.has(relative)) return false;
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
        + `locally and refuses a half-production process under \`railway run\`. `
        /* The remedy by path (fable-1038 §4): a guard that names its remedy
           gets followed, one that only refuses gets worked around. */
        + `\`scripts/SKELETON-disposable.mts\` is the shape both script guards `
        + `want; copy it rather than starting from a blank file:\n`
        + unguarded.map((f) => `  scripts/${f}`).join("\n"),
    ).toEqual([]);
  });

  /*
    POSITIVE CONTROL, on a real unguarded file rather than a string.

    Without it the assertion above is what a scan that found NOTHING prints,
    and a walk that silently stopped reading — a renamed directory, a changed
    extension — is indistinguishable from a fully guarded repository. So the
    reader is pointed at a fixture it must complain about: the untracked
    one-shot benches, which are unguarded on purpose and therefore available as
    a known-positive population.

    That population is what this milestone is emptying, so the day it hits zero
    this control says so out loud rather than passing on nothing.
  */
  it("POSITIVE CONTROL — the reader does find unguarded getDb() scripts", () => {
    const tracked = trackedScripts(scriptsDir);
    const benches = databaseScripts(scriptsDir)
      .filter((relative) => !tracked.has(relative))
      .filter((relative) => !callsTheGuard(readFileSync(path.join(scriptsDir, relative), "utf8")));
    expect(
      benches.length,
      "no unguarded bench left to control against — swap this fixture for a synthetic one",
    ).toBeGreaterThan(0);
  });

  /*
    THE EXEMPTION PREDICATE'S OWN CONTROL — and it is the one that matters most,
    because this predicate decides who is exempt and it fails in the SILENT
    direction. `trackedScripts` returning nothing does not redden anything: it
    exempts the entire tree, and "every permanent getDb() script calls
    assertOneWorld" passes because the reader has gone blind. The refusal inside
    the function is the guard; this proves the refusal is reachable and that a
    real answer discriminates in both directions.
  */
  it("the tracked/untracked split is real in both directions", () => {
    const tracked = trackedScripts(scriptsDir);
    /* POSITIVE: a file this suite cannot run without is tracked. */
    expect(tracked.has("lib/worldGuard.mts"), "the guard module itself reads as untracked").toBe(true);
    /* NEGATIVE: a name git has never seen is not tracked — the set is not "everything". */
    expect(tracked.has("no-such-script-a4f19c-disposable.mts")).toBe(false);
    expect(tracked.size, "suspiciously few tracked scripts — is the walk in the right tree?")
      .toBeGreaterThan(50);
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
