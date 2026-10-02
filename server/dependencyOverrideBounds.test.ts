/**
 * ⚠ A SECURITY FLOOR MUST NOT BE A BLANK CHEQUE — `pnpm.overrides` IS BOUNDED ABOVE.
 *
 * `package.json`'s `pnpm.overrides` is this repository's lever for pinning a
 * transitive above a vulnerability: `cf764795a` added the first five for exactly
 * that (*"pnpm overrides for transitive vulnerabilities"*), and #1803 added three
 * more. An override wins over **every** declaration in the tree, including the
 * root's own — so the range written here is not a preference, it is the last word.
 *
 * **`">=7.5.18"` does not say "at least the patched version". It says "the newest
 * version that exists, forever."** The moment that package publishes a new major,
 * a line written to close a CVE pulls that major in behind it, across whatever
 * narrower range its parents declared — with no failing test, because a lockfile
 * that resolves is a lockfile that installs.
 *
 * # IT IS MEASURED, NOT REASONED ABOUT (#1808, Warden run 6 finding W6-F)
 *
 * Working #1803, a third entry was written in the house style — `"fast-uri":
 * ">=3.1.8"`, to close a moderate advisory patched at 3.1.8 — and pnpm resolved
 * `fast-uri 3.1.7 -> 4.2.1`: **a major bump across `ajv`, from a one-line security
 * floor.** It was caught only because the lockfile diff was read package by
 * package before committing. Nothing held it; this suite is what holds it now.
 *
 * The sharpest instance was `esbuild`. This repository's own `devDependencies`
 * declares `"esbuild": "^0.28.1"` — carefully bounded, because esbuild ships
 * breaking changes in MINORS and both load-bearing parents refuse 0.29
 * (`vite@7.3.6` asks `^0.27.0 || ^0.28.0`, `tsx@4.23.13` asks `~0.28.0`). The
 * override read `">=0.28.1"` and therefore **silently widened the root's own
 * bound**, which the lockfile recorded at the artifact: the `importers` entry for
 * esbuild read `specifier: '>=0.28.1'`, the override's value standing in place of
 * the one package.json declares.
 *
 * # WHAT IT ASKS, AND WHY IT ASKS IT BY FORM RATHER THAN BY RANGE ALGEBRA
 *
 * **Does every override range state an upper bound?** The check is a stated
 * POLICY rather than an approximation of semver, and the distinction is the whole
 * design: it accepts exactly the forms this repository uses to express a bounded
 * floor — `^`, `~`, an exact version, or any range carrying a `<` comparator —
 * and REFUSES everything else, including exotic-but-bounded forms. An override
 * block is nine hand-written lines read by people; narrowing it to three
 * recognisable shapes is correct there, not a false positive.
 *
 * ⚠ **The dedicated tool was declined, and the fidelity law asks that to be said
 * out loud rather than left as a silent approximation.** `semver.satisfies()`
 * would answer "is this range bounded above" exactly, and `semver` is NOT a
 * declared dependency of this repository — it exists only as an undeclared
 * transitive (two copies in the store), so importing it here would bind a guard
 * to a package the tree never promised to keep. Declaring one to lint nine lines
 * is not proportionate. **So the reader is explicit and FAILS CLOSED**: a form it
 * does not positively recognise is refused, never passed, which is the direction
 * that cannot hide the defect this suite exists for.
 *
 * # THE POPULATION IS DERIVED
 *
 * Not a list of override names kept in step with `package.json` — that is the
 * mirror working law 4 forbids, and it would read green for an entry added after
 * it was written. The population is `Object.keys()` of the real `pnpm.overrides`
 * object, so a new override is enrolled here with no edit anywhere.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");

/**
 * An upper bound, expressed in one of the three shapes this repository uses.
 *
 * `^1.2.3` / `~1.2.3`  — a caret or tilde bound. For a 0.x package a caret bounds
 *                        at the MINOR (`^0.28.1` is `>=0.28.1 <0.29.0`), which is
 *                        why esbuild's bound reads tighter than lodash's while
 *                        wearing the same character.
 * `1.2.3`              — an exact version; its own upper bound.
 * anything with `<`    — an explicit ceiling, e.g. `>=6.14.1 <7.0.0`.
 *
 * Deliberately NOT accepted: a bare `>=` or `>`, `*`, `x`, `latest`, an empty
 * string, and x-ranges/hyphen ranges. The first five are unbounded; the last two
 * are bounded but unused here, and an unrecognised form in a block that governs
 * the whole tree is refused rather than guessed at.
 */
const BOUNDED_FORM = /^(?:\^|~)\d|^\d|<\d/;

function isBoundedAbove(range: string): boolean {
  const trimmed = range.trim();
  if (trimmed.length === 0) return false;
  // A union is bounded only if EVERY disjunct is: `>=1 || ^2` permits any future
  // major through its first half.
  return trimmed
    .split("||")
    .every((disjunct) => BOUNDED_FORM.test(disjunct.trim()));
}

function readOverrides(): Record<string, string> {
  const raw = fs.readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as {
    pnpm?: { overrides?: Record<string, string> };
  };
  return parsed.pnpm?.overrides ?? {};
}

describe("isBoundedAbove — the reader, driven both ways before its verdicts count", () => {
  // The positive controls: every one of these MUST be caught, or this suite is
  // decoration. The first six are the exact strings that stood in package.json
  // until #1808, and `>=3.1.8` is the one that actually pulled a major.
  it.each([
    ">=7.5.18",
    ">=4.17.23",
    ">=6.14.1",
    ">=13.2.1",
    ">=0.28.1",
    ">=3.1.8",
    ">1.2.3",
    "*",
    "x",
    "latest",
    "",
    "   ",
    ">=1.0.0 || ^2.0.0",
  ])("refuses the unbounded range %j", (range) => {
    expect(isBoundedAbove(range)).toBe(false);
  });

  // The negative controls: a guard that refuses everything would pass the arms
  // above by refusing the whole block, which is the failure mode worth more than
  // the finding. These are the forms the repository actually ships.
  it.each([
    "^7.5.18",
    "^4.17.23",
    "^6.14.1",
    "^13.2.1",
    "^0.28.1",
    "^5.0.12",
    "^3.4.16",
    "^3.1.8",
    "~6.16.0",
    "3.3.7",
    "6.2.12",
    ">=6.14.1 <7.0.0",
    "<8.0.0",
    "^1.0.0 || ^2.0.0",
  ])("accepts the bounded range %j", (range) => {
    expect(isBoundedAbove(range)).toBe(true);
  });
});

describe("package.json — pnpm.overrides", () => {
  it("declares at least one override, so an empty read cannot pass as compliance", () => {
    // Without this, deleting the block — or a parse that silently returned {} —
    // satisfies the arm below by having nothing to check.
    expect(Object.keys(readOverrides()).length).toBeGreaterThan(0);
  });

  it("bounds every override above, so a security floor cannot pull a major in behind it", () => {
    const unbounded = Object.entries(readOverrides())
      .filter(([, range]) => !isBoundedAbove(range))
      .map(([name, range]) => `${name}: ${JSON.stringify(range)}`);

    expect(
      unbounded,
      [
        "An override wins over every declaration in the tree, including this",
        "repository's own, so an unbounded range pulls in whatever major exists",
        "at install time (#1808: `fast-uri: \">=3.1.8\"` resolved 3.1.7 -> 4.2.1,",
        "a major across ajv, from a one-line security floor).",
        "",
        "Bound it to the line its parents declare — `^` where their range allows",
        "it, an explicit `<N` where it does not — after reading the lockfile diff",
        "package by package. If an override must genuinely be unbounded, this",
        "guard is the place that decision is argued, not worked around.",
      ].join("\n"),
    ).toEqual([]);
  });
});
