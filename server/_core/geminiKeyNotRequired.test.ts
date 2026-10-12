/**
 * `GEMINI_API_KEY` IS NOT BOOT-REQUIRED — #2315 step 3, so his hand can delete
 * the Railway variable.
 *
 * **His word, 2026-10-12 (terminal):** *"1) wardrobe is getting retired. 2)
 * canvas is gertting redesigned and is calling gemini since its old routing. 3)
 * older casting refine route is getting retired. // id retire the paths and
 * remove the key"*.
 *
 * # Why a boot check is the thing that had to move first
 *
 * ⚠ **The coupling runs in exactly one direction and it is a crash-loop.** While
 * `GEMINI_API_KEY` sits in `REQUIRED_VARS`, deleting the variable makes the next
 * boot exit on a missing-variable error — the shape of 2026-07-31, when the
 * evidence boot guards took production down. Removing the entry first is safe
 * with the key present *or* absent, which is why the card orders it this way.
 *
 * # What this suite does NOT re-prove, and where that fact lives
 *
 * It says nothing about whether a road could still want the key, because
 * `server/rebuildDoor.test.ts` already carries that and carries it better:
 * `factoryIsGated` asserts, over the real source, that `assertRebuildDoorOpen()`
 * stands BEFORE both the key read and the construction inside `getAiClient`,
 * `keyReaders` pins the key to exactly two files, and both readers have a
 * positive control on a planted ungated source. Restating any of that here
 * would be a second list shadowing a source of truth (working law 4).
 *
 * ⚠ **And this arm cannot live in that file**, which is the reason for a suite of
 * its own: `rebuildDoor.test.ts` SETS `GEMINI_API_KEY` in `vi.hoisted()` on
 * purpose, so inside it the key is always present and an arm about its absence
 * would pass without ever reaching the subject.
 *
 * # The control, stated once
 *
 * An absence assertion is green over a subject that was never reached — this
 * repository has the receipt for exactly that mistake one file over
 * (`numericEnv.test.ts`: a message reading *"validateEnv is not defined"* does
 * not name the variable either). So the first arm proves the missing-variable
 * check RAN and that the same reader DOES name variables the server cannot run
 * without. Only then is the second arm's silence about `GEMINI_API_KEY` evidence
 * of anything.
 */
import { afterEach, describe, expect, it } from "vitest";

import { validateEnv } from "./env";

const SUBJECT = "GEMINI_API_KEY";

/**
 * Two variables that ARE required, used as the reader's positive control.
 *
 * ⚠ Both are only ever UNSET here, never set. `vitest.setup.ts` strips
 * `DATABASE_URL` so that no unit test can reach the live database, and the
 * recorded defect in `numericEnv.test.ts` is an arm that set it back — caught
 * because it perturbed a neighbouring suite, not because it looked wrong.
 * Unsetting is the safe direction; setting is the one that reaches around a
 * safety mechanism.
 */
const REQUIRED_CONTROLS = ["DATABASE_URL", "JWT_SECRET"] as const;

const saved = new Map<string, string | undefined>();

function unset(name: string): void {
  if (!saved.has(name)) saved.set(name, process.env[name]);
  delete process.env[name];
}

afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  saved.clear();
});

/** `validateEnv()`'s refusal, as an operator would read it at deploy time. */
function bootRefusal(): string {
  for (const name of [SUBJECT, ...REQUIRED_CONTROLS]) unset(name);
  try {
    validateEnv();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("the boot refusal — what the server still cannot run without", () => {
  it("CONTROL — the missing-variable check runs, and names a required variable", () => {
    const message = bootRefusal();

    /* Not "is not defined": that message names nothing and would satisfy the
       absence arm below over a subject that was never imported. */
    expect(message).not.toMatch(/is not defined/);
    expect(message, "validateEnv did not reach the missing-variable check").toContain(
      "Missing required environment variable(s)",
    );
    for (const name of REQUIRED_CONTROLS) {
      expect(message, `${name} must still stop startup, by name`).toContain(name);
    }
  });

  it("⚠ and it does NOT name GEMINI_API_KEY — the variable can be deleted (#2315 step 3)", () => {
    const message = bootRefusal();

    expect(process.env[SUBJECT], "the subject must actually be absent").toBeUndefined();
    /* The same positive control, in this arm's own body: a silence that follows
       a check which never ran is not a finding. */
    expect(message).toContain("Missing required environment variable(s)");
    expect(
      message,
      "GEMINI_API_KEY is boot-required again — deleting the Railway variable would crash-loop the service",
    ).not.toContain(SUBJECT);
  });

  it("no boot WARNING either — its absence switches nothing off", () => {
    /*
     * The `POSTHOG_HOST` rule in `env.ts` applied: an `OPTIONAL_VARS` entry
     * earns a boot warning, which is right for a key whose absence switches a
     * capability off and wrong for one whose capability is already closed by the
     * rebuild door.
     *
     * Driven through the one road a test can reach: the optional-variable loop
     * is the LAST thing `validateEnv` does, so with required variables missing
     * it is never reached — which is itself why the assertion below is about the
     * refusal rather than about `console.warn`. What it pins is that the subject
     * is absent from the message in BOTH halves of this function, so an entry
     * added to either list reddens an arm.
     */
    const message = bootRefusal();
    expect(message.split("\n").filter((line) => line.includes(SUBJECT))).toEqual([]);
  });
});
