/**
 * THE NON-SCOPE SETTINGS THE PUSH GATE GOVERNS — DERIVED FROM THE CODE THAT
 * READS THEM AT BOOT (#1174).
 *
 * # The hole, and it was live
 *
 * `productionFlagPositions.mts` compared a written record of where our settings
 * stand against the settings the live service actually holds, and refused if
 * they disagreed — for every name matching `SCOPE` or `STAGE` and **for nothing
 * else.** So for every other setting the product reads at boot the gate was
 * blind in both directions: it could not say one was set when the record said
 * nothing about it, and it could not say the record was wrong about one.
 *
 * ⚠ **Measured at the live service on 2026-09-26, and this is not a
 * hypothetical**: `CASTING_ROLL_ENGINE_MODEL` is **SET to `sunburst`** on
 * production. It decides which image model every roll on his account renders on
 * — his own word chose it ("flare is producing bad results - switch over to
 * sunburst") — and **the push gate could not see it.** Its sibling
 * `CASTING_ROLL_ENGINE_SCOPE` is governed only because the name happens to
 * contain SCOPE.
 *
 * The two earlier bites, both on #1158, both by accident:
 *
 *   1. Slice 4c's boot rehearsal passed its NEGATIVE CONTROLS for the wrong
 *      reason — allowlisting by the position table let `CASTING_ROLL_ENGINE_MODEL`
 *      fall through to the machine's own `.env`, so both controls "passed" while
 *      naming a setting with nothing to do with the work.
 *   2. Slice 4d's stated premise was false. Four places said
 *      `INK_PLATE_CONCURRENCY` *"is SET on the service"*; not one of the fal
 *      allowance variables is set on production and none ever has been. The live
 *      boot line `ink plates 1` is equally true of *set to 1* and of *unset,
 *      defaulting to 1*, and nothing on the push path could say which.
 *      (Re-measured 2026-09-26: still unset, all of them.)
 *
 * # ⚠ WHAT IS NOT PROPOSED, AND THE CARD IS EMPHATIC ABOUT IT
 *
 * **Not "govern every variable".** The service holds 67 and most are
 * credentials; the rite deliberately never prints an unrecognised value, and a
 * table that had to carry `DATABASE_URL` would be a worse thing than the gap.
 * The question is narrower: **which non-scope settings does the product READ AT
 * BOOT in a way that changes behaviour?**
 *
 * # THE POPULATION IS DERIVED, WHICH IS THE WHOLE POINT
 *
 * Three declarations already answer it, and each one is a place the product
 * REFUSES TO BOOT over:
 *
 *   `NUMERIC_ENV_VARS`  — `assertNumericEnv()` reads every one at boot and
 *                         throws on a malformed value, because a blank variable
 *                         turned four sites into silent outages.
 *   `FAL_ALLOWANCES`    — `assertFalBudget()` refuses to boot if the sum passes
 *     + the ceiling       the provider's ceiling or any path has no slots.
 *   the roll engine     — the boot gate refuses if `CASTING_ROLL_ENGINE_SCOPE`
 *     model name          names anyone and the model is unset or unknown.
 *
 * ⚠ **They are IMPORTED, never scanned.** A hand-typed second list is what
 * produced this card, and a regex standing in for something the code already
 * states is working law 4 inverted. The second reader lives in
 * `server/productionBootSettings.test.ts` and it is a TEXT SCAN of these same
 * three files — so the two do not share a resolver, and a declaration that moves
 * or a reader that stops reading is caught by them disagreeing.
 *
 * ⚠ **Every name here is safe to PRINT WITH ITS VALUE**, which is a condition of
 * being on the table at all (`never-filter-a-secret-listing`: the rite's flag
 * block is an allowlist of known-harmless names, never a redaction rule). These
 * are concurrency counts, queue depths, a daily limit and a model nickname. A
 * credential must never join them, and `PORT`/`LOG_LEVEL` are deliberately out:
 * `PORT` catches its own empty string and `findAvailablePort` throws before the
 * server listens, and `LOG_LEVEL` changes what is written, not what is done.
 */
import { NUMERIC_ENV_VARS } from "../../server/_core/env.js";
import { CASTING_ROLL_ENGINE_MODEL_ENV } from "../../server/castingV2/castingV2Scope.js";
import { FAL_ACCOUNT_CEILING_ENV, FAL_ALLOWANCES } from "../../server/castingV2/falBudget.js";

/**
 * The floor a derived collector must clear before its answer counts.
 *
 * ⚠ **A collector that can come up empty THROWS rather than returning a short
 * list** — the Atlas has paid for this four times over, and here a short list
 * reads as a clean gate: the settings it dropped simply stop being governed and
 * nothing says so. The figure is the three declarations at their smallest
 * credible size (six numerics, four allowances, a ceiling, a model) minus room
 * for one legitimate retirement.
 */
export const BOOT_GOVERNED_FLOOR = 10;

function collect(): string[] {
  const named: Array<{ name: string; from: string }> = [
    ...Object.keys(NUMERIC_ENV_VARS).map((name) => ({ name, from: "NUMERIC_ENV_VARS" })),
    ...FAL_ALLOWANCES.map((allowance) => ({ name: allowance.env, from: "FAL_ALLOWANCES" })),
    { name: FAL_ACCOUNT_CEILING_ENV, from: "falAccountCeiling" },
    { name: CASTING_ROLL_ENGINE_MODEL_ENV, from: "the roll engine model gate" },
  ];

  const seen = new Map<string, string>();
  for (const entry of named) {
    const first = seen.get(entry.name);
    if (first !== undefined) {
      /* Two owners for one variable is the defect `NUMERIC_ENV_VARS`'s own
         docblock refuses by hand ("the fal allowances are deliberately not
         here"). If it ever happens, the boot behaviour is ambiguous and a
         position table cannot describe it. */
      throw new Error(
        `governedBootSettings: ${entry.name} is declared by both ${first} and ${entry.from} — `
        + "one variable, two boot owners, and no position can describe that",
      );
    }
    seen.set(entry.name, entry.from);
  }

  const names = [...seen.keys()].sort();
  if (names.length < BOOT_GOVERNED_FLOOR) {
    throw new Error(
      `governedBootSettings: only ${names.length} boot settings were collected, under the floor of `
      + `${BOOT_GOVERNED_FLOOR}. A short list here reads as a clean gate over ungoverned settings — `
      + "one of NUMERIC_ENV_VARS, FAL_ALLOWANCES or the roll engine model gate has moved",
    );
  }
  return names;
}

/**
 * Every non-scope setting the push gate governs, sorted.
 *
 * ⚠ It is computed at import time on purpose: a collector that throws must do so
 * where the rite cannot proceed past it, not lazily inside one comparison.
 */
export const BOOT_GOVERNED_ENV_NAMES: readonly string[] = collect();

/** Where each one is read at boot — for a message that says why it is governed. */
export function bootOwnerOf(name: string): string | null {
  if (Object.prototype.hasOwnProperty.call(NUMERIC_ENV_VARS, name)) return "assertNumericEnv() at boot";
  if (FAL_ALLOWANCES.some((allowance) => allowance.env === name)) return "assertFalBudget() at boot";
  if (name === FAL_ACCOUNT_CEILING_ENV) return "assertFalBudget()'s ceiling at boot";
  if (name === CASTING_ROLL_ENGINE_MODEL_ENV) return "the roll engine model gate at boot";
  return null;
}
