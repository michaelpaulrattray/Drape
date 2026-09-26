/**
 * A CHARGE REFERENCE IS NEVER OPTIONAL, AND NEVER FALLS BACK TO A CONSTANT.
 *
 * Found by the Warden money audit (#1225, finding W5-D), filed as #1362.
 *
 * # What the trap was
 *
 * A charge reference is the ledger's idempotency key. A duplicate deduct is
 * REFUSED — `server/db/credits.ts`: *"Credit charge already recorded"*. Two
 * paid roads defaulted theirs to a value that was **constant per model**:
 * `` `legacy-refresh-${modelId}` ``, `` `legacy-mint-${modelId}` ``, and (the
 * one the audit did not name, found by sweeping the class rather than its two
 * instances) `` `legacy-package-${modelId}` `` on the per-slot refund key.
 *
 * Reaching one of those a SECOND time for one model would have refused the
 * charge permanently. Not "insufficient credits" — a dead button, carrying a
 * message about a charge already recorded, that never recovers. **The money
 * direction was safe and the customer direction was not:** nothing is taken
 * and nothing is lost; what breaks is the ability to press the button again,
 * for that model, forever.
 *
 * # Why this suite exists rather than the fix alone
 *
 * ⚠ **THE FIX'S OWN SABOTAGE IS WHY.** #1362 was closed by dropping the
 * optionality — removing the branch rather than making it survivable — and the
 * compiler is a real guard for every file it sees. Driven, that guard caught
 * **2 of 4** sabotage cases:
 *
 *   CAUGHT  the refresh deduct's fallback comes back        tsc RED
 *   CAUGHT  the reference goes optional again, no fallback  tsc RED
 *   MISSED  the mint deduct's fallback comes back           tsc green, suites green
 *   MISSED  the per-slot refund key's fallback comes back   tsc green, suites green
 *
 * The two misses are not a weak sabotage, they are the honest shape of a
 * type-only fix: **loosen every declaration together and re-add the fallback,
 * and it compiles and behaves identically**, because the branch is unreachable
 * while the one production caller passes a unique reference. No test can drive
 * a branch nothing can reach, so no test can notice it return. That is the
 * #1204 class pointed at money — and the card's own words are that *"the trap
 * arms itself the moment anyone makes the field optional again, adds a second
 * caller, or promotes a test helper that omits it."*
 *
 * So the control is a READING of the source, which is the only reader that can
 * see an unreachable branch at all.
 *
 * # It is derived, not a list of two filenames
 *
 * Working law 4: a second list shadowing a source of truth drifts from it, and
 * a list of the two modules the audit happened to find is exactly that list.
 * The population is every non-test module under `server/` that declares a
 * charge reference, so a THIRD paid road inherits the rule on the day it is
 * written rather than on the day somebody remembers this file.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* This suite walks every module under `server/` off the real tree, which is the
   #741 class: green alone, red under load on somebody else's machine. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

import { readListedSource } from "./testing/listedSource";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every production module under `server/`, read through the helper rather than
 * with a bare `readFileSync` (#223): an entry a walk listed can be gone by the
 * time it is opened — a rebase, a clean tree, another shift's deletion — and
 * the ENOENT would land on the deploy rite rather than on whoever is looking.
 * `null` means it went; skip it.
 */
function productionSources(): Array<{ file: string; source: string }> {
  const out: Array<{ file: string; source: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(rel);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
      const source = readListedSource(path.join(repoRoot, rel));
      if (source !== null) out.push({ file: rel, source });
    }
  };
  walk("server");
  return out;
}

const SOURCES = productionSources();

/**
 * Does this line DEFAULT a charge or refund reference to something?
 *
 * ⚠ THE RULE IS "A DEFAULT", NOT "THE WORD `legacy`". All three shapes the
 * audit found began `legacy-`, and keying on that word would guard the three
 * instances rather than the class — the next one will be called something
 * else. What makes a fallback dangerous is only that it is not unique per
 * invocation, so any default on a reference is refused.
 *
 * ⚠ AND ONE SHAPE IS DELIBERATELY NOT A DEFAULT: a NEGATED presence check on a
 * persisted row (`if (!operation.chargeReferenceId || …)`). That `||` produces
 * a boolean for control flow, never a reference, and the column really can be
 * null. The exclusion is driven in the control arm below rather than left to be
 * discovered, because an exclusion nobody drives is how a reading comes to
 * report a clean tree forever.
 */
function defaultsAReference(line: string): boolean {
  if (!/\b(?:charge|refund)Reference[A-Za-z]*\s*(?:\?\?|\|\|)/.test(line)) return false;
  /* A negated presence check is a condition, not a default. */
  if (/![A-Za-z_$.]*\b(?:charge|refund)Reference/.test(line)) return false;
  return true;
}

describe("a charge reference is required, so a dead button cannot be built (#1362)", () => {
  /**
   * THE POSITIVE CONTROL, and it comes first on purpose. Every arm below is an
   * absence assertion, and an absence assertion over an empty population passes
   * for the wrong reason — a broken walk, a renamed directory, a helper
   * returning `null` for everything would each read as "no violations".
   */
  it("reads the tree it claims to read", () => {
    expect(SOURCES.length).toBeGreaterThan(200);
    const declaring = SOURCES.filter((s) => /\bchargeReferenceId\b/.test(s.source));
    expect(
      declaring.map((s) => s.file),
      "no module under server/ mentions a charge reference — the walk or the reader is broken",
    ).not.toEqual([]);
    /* The two modules the audit found must be among them, or the walk is not
       reaching the code this suite was written about. */
    const files = declaring.map((s) => s.file);
    expect(files).toContain("server/casting/mintPackage.ts");
    expect(files).toContain("server/casting/refreshSlots.ts");
  });

  /**
   * ⚠ **THE OPTIONALITY ITSELF.** A `chargeReferenceId?:` is what a
   * constant fallback needs in order to compile, so refusing the declaration
   * refuses the whole shape rather than the three spellings it happened to
   * take. The DB column is a different thing and is not matched here: this
   * reads a TypeScript property declaration, and `operationRecovery.ts`'s
   * `if (!operation.chargeReferenceId)` guard on a persisted row is a null
   * check on a value the database really can hold, not an optional input.
   */
  it("no production module declares one optional", () => {
    const offenders: string[] = [];
    for (const { file, source } of SOURCES) {
      source.split("\n").forEach((line, index) => {
        if (/\bchargeReferenceId\s*\?\s*:/.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }
    expect(
      offenders,
      "a charge reference declared optional is the shape a constant-per-model fallback needs to "
        + `compile (#1362): ${offenders.join(", ")}. The one production caller of each paid road `
        + "passes markGenerationOperationRunning's chargeReferenceId, which is non-optional and "
        + "unique per operation, so the type can say so.",
    ).toEqual([]);
  });

  /**
   * ⚠ **AND THE FALLBACK, whatever it is defaulted to.** The audit's three
   * spellings all began `legacy-`, and keying on that word would guard the
   * instances rather than the class — the next one will be called something
   * else. What makes a fallback dangerous is that it is NOT unique per
   * invocation, so any `??`/`||` default on a charge or refund reference is
   * refused and the safe form is to have no branch at all.
   */
  it("no production module defaults one to anything", () => {
    const offenders: string[] = [];
    for (const { file, source } of SOURCES) {
      source.split("\n").forEach((line, index) => {
        if (defaultsAReference(line)) {
          offenders.push(`${file}:${index + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(
      offenders,
      "a charge or refund reference with a fallback (#1362). A fallback that is not unique per "
        + `invocation kills the button forever the second time it is reached: ${offenders.join(" | ")}`,
    ).toEqual([]);
  });

  /**
   * THE SECOND POSITIVE CONTROL — the arms above can distinguish a clean tree
   * from a broken reader. Both patterns are driven against source that DOES
   * violate them, so a regex edited into inertness reddens here instead of
   * reporting a clean tree forever.
   */
  it("both readings can actually fail, and neither fires on the shapes it must not", () => {
    const optional = /\bchargeReferenceId\s*\?\s*:/;

    expect(optional.test("  chargeReferenceId?: string;")).toBe(true);
    expect(optional.test("  chargeReferenceId ?: string;")).toBe(true);
    expect(optional.test("  chargeReferenceId: string;")).toBe(false);

    /* The three real shapes the audit found, verbatim from the tree before the fix. */
    expect(defaultsAReference("    input.chargeReferenceId ?? `legacy-refresh-${input.modelId}`,")).toBe(true);
    expect(defaultsAReference("`Mint (pending)`, input.chargeReferenceId ?? `legacy-mint-${input.modelId}`,")).toBe(true);
    expect(defaultsAReference("  const k = `${ctx.chargeReferenceId ?? `legacy-package-${ctx.modelId}`}:slot:${angle}`;")).toBe(true);
    /* And the OTHER default operator, so the rule is not keyed on `??` alone. */
    expect(defaultsAReference('  const ref = ctx.refundReference || "legacy";')).toBe(true);

    /* The fixed shapes. */
    expect(defaultsAReference("    chargeReferenceId: input.chargeReferenceId,")).toBe(false);
    expect(defaultsAReference("  const k = `${ctx.chargeReferenceId}:slot:${angle}`;")).toBe(false);

    /*
      ⚠ THE EXCLUSION, AND IT IS A DECISION ON THE RECORD RATHER THAN A REGEX
      THAT QUIETLY SKIPS SOMETHING. `operationRecovery.ts:1159` reads
      `if (!operation.chargeReferenceId || chargedCredits === 0)` — a NEGATED
      presence check on a PERSISTED ROW, whose column really can be null. The
      `||` there produces a boolean for control flow, not a reference, so it is
      the one shape this reading must not call a fallback. This arm exists
      because the FIRST version of that reading flagged exactly that line.
    */
    expect(defaultsAReference("      if (!operation.chargeReferenceId || chargedCredits === 0) {")).toBe(false);
    expect(defaultsAReference("  if (!input.refundReference || amount === 0) return;")).toBe(false);
  });
});
