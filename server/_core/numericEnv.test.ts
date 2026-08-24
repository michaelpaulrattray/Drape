/**
 * `envInt` / `assertNumericEnv` — the boot refusal for a blank numeric
 * variable.
 *
 * ⚠ THE CLASS THIS GUARDS, STATED ONCE: `?? "default"` in front of `parseInt`
 * DOES NOT CATCH THE EMPTY STRING. `??` answers to `null` and `undefined` and
 * nothing else, and an empty string is exactly what a Railway variable created
 * with no value holds. Four sites were written that way and each turned a
 * blank variable into a silent outage — the daily quota refusing EVERY
 * generation at zero used ("Daily generation limit reached (NaN per day)"),
 * and the three Gemini queue settings becoming a queue that admits nothing and
 * holds every call forever. Found 2026-08-25 while reading the quota, swept
 * under law 7, ruled fable-1635 §2.
 *
 * The fix direction is deliberate: with the defect, a blank variable is a full
 * outage ANYWAY — silent, at six call sites, wearing a quota message that
 * sends the customer away believing they hit a limit. A boot refusal moves the
 * same outage to deploy time, where the rite's health check catches it and the
 * operator reads the variable's NAME.
 *
 * The arms below drive `envInt` directly rather than through a consumer,
 * because a guard tested only through the module that usually behaves is
 * working law 3's untested backstop.
 */
import { describe, it, expect, afterEach } from "vitest";
import { envInt, assertNumericEnv, validateEnv, NUMERIC_ENV_VARS } from "./env";

const SUBJECT = "DAILY_GENERATION_LIMIT" as const;
const saved = new Map<string, string | undefined>();

function set(name: string, value: string | undefined) {
  if (!saved.has(name)) saved.set(name, process.env[name]);
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  saved.clear();
});

describe("envInt — a blank variable is not a zero and not a NaN", () => {
  it("UNSET takes the declared default", () => {
    set(SUBJECT, undefined);
    expect(envInt(SUBJECT)).toBe(NUMERIC_ENV_VARS[SUBJECT]);
  });

  it("⚠ the EMPTY STRING takes the default too — the whole point of this guard", () => {
    // `parseInt(process.env.X ?? "50", 10)` returned NaN here, and NaN is what
    // made the outage silent.
    set(SUBJECT, "");
    expect(envInt(SUBJECT)).toBe(NUMERIC_ENV_VARS[SUBJECT]);
  });

  it("WHITESPACE takes the default — a variable typed with a space is still blank", () => {
    set(SUBJECT, "   ");
    expect(envInt(SUBJECT)).toBe(NUMERIC_ENV_VARS[SUBJECT]);
  });

  it("CONTROL — a real value is read, and is not quietly replaced by the default", () => {
    // Without this every arm above would pass against a function that returned
    // the default unconditionally, which would make the variable inert.
    set(SUBJECT, "7");
    expect(envInt(SUBJECT)).toBe(7);
    expect(envInt(SUBJECT)).not.toBe(NUMERIC_ENV_VARS[SUBJECT]);
  });

  it.each([
    ["junk", "abc"],
    ["a number with junk after it", "50x"],
    ["zero", "0"],
    ["negative", "-1"],
    ["a fraction", "2.5"],
  ])("refuses %s, and the refusal NAMES the variable and its default", (_what, value) => {
    set(SUBJECT, value);
    // Naming both is the point: an operator reading this at deploy time needs
    // to know which variable and what happens if they simply remove it.
    expect(() => envInt(SUBJECT)).toThrow(new RegExp(SUBJECT));
    expect(() => envInt(SUBJECT)).toThrow(/must be a positive integer/);
    expect(() => envInt(SUBJECT)).toThrow(
      new RegExp(`default of ${NUMERIC_ENV_VARS[SUBJECT]}`),
    );
  });

  it("⚠ `50x` is the arm parseInt would have PASSED — it reads 50 and drops the rest", () => {
    // Kept as its own sentence because it is the one case where the old code
    // was not merely NaN but confidently wrong: `parseInt("50x", 10)` is 50.
    expect(parseInt("50x", 10)).toBe(50);
    set(SUBJECT, "50x");
    expect(() => envInt(SUBJECT)).toThrow(/must be a positive integer/);
  });
});

describe("assertNumericEnv — the boot check, derived from the table", () => {
  it("passes when every variable is unset", () => {
    for (const name of Object.keys(NUMERIC_ENV_VARS)) set(name, undefined);
    expect(() => assertNumericEnv()).not.toThrow();
  });

  it("refuses if ANY ONE of them is blank — every member is checked", () => {
    // The population control, and the reason the check derives from the table
    // rather than from a hand-written list: a variable added to
    // NUMERIC_ENV_VARS and forgotten here would be unguarded, and this arm
    // walks all of them.
    for (const name of Object.keys(NUMERIC_ENV_VARS)) {
      for (const other of Object.keys(NUMERIC_ENV_VARS)) set(other, undefined);
      set(name, "");
      expect(() => assertNumericEnv(), `${name} blank must not refuse`).not.toThrow();

      set(name, "nonsense");
      expect(() => assertNumericEnv(), `${name} must be guarded`).toThrow(new RegExp(name));
    }
  });

  it("the table is not empty — a guard over nothing passes over nothing", () => {
    expect(Object.keys(NUMERIC_ENV_VARS).length).toBeGreaterThan(0);
    for (const value of Object.values(NUMERIC_ENV_VARS)) {
      expect(Number.isSafeInteger(value) && value > 0).toBe(true);
    }
  });
});

/**
 * ⚠ A CONTROL THAT IS NOT INVOKED DOES NOT EXIST (enforcement invariant 7).
 *
 * The arms above prove `envInt` refuses. They say nothing about whether
 * anything asks it to at boot — and "helper written, docs written, call site
 * never added" is the road three of this product's four inert controls took.
 * So these drive `validateEnv()` itself.
 *
 * ⚠ AND THE FIRST VERSION OF THIS DESCRIBE WAS A DEFECT WORTH RECORDING.
 * `validateEnv` refused on missing required variables before it reached the
 * numeric check, so the arm satisfied them — DERIVED from the function's own
 * error message rather than hand-listed, which was the right instinct about
 * working law 4 and the wrong act. `DATABASE_URL` is a required variable, and
 * `vitest.setup.ts` STRIPS it on purpose so that no unit test can ever reach
 * the live database. The arm set it back. It was caught because it perturbed a
 * neighbouring suite in the same run — not because anything about it looked
 * wrong.
 *
 * The repair is in the product rather than in the test: `assertNumericEnv()`
 * now runs FIRST in `validateEnv`, which is independently the better order (a
 * malformed value is refused even on a deployment that is also missing
 * something else). These arms touch exactly one variable and no other.
 */
describe("the guard is WIRED — validateEnv refuses a bad numeric variable", () => {
  it("a nonsense DAILY_GENERATION_LIMIT stops startup, by name", () => {
    set(SUBJECT, "nonsense");

    let thrown: unknown;
    try {
      validateEnv();
    } catch (err) {
      thrown = err;
    }

    expect(thrown, "validateEnv accepted a value envInt refuses").toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(SUBJECT);
    expect((thrown as Error).message).toMatch(/must be a positive integer/);
  });

  it("CONTROL — with a GOOD value, validateEnv gets PAST the numeric check", () => {
    /*
     * ⚠ THE FIRST VERSION OF THIS ARM PASSED FOR THE WRONG REASON: it asserted
     * only that the message did not name the variable, and on its first run
     * `validateEnv` was not imported, so the message was "validateEnv is not
     * defined" — which does not name it either. An absence assertion is green
     * over a subject that was never reached.
     *
     * So it asserts what it should have all along: the run gets far enough to
     * fail on the NEXT check instead. In this suite `DATABASE_URL` is stripped,
     * so reaching the missing-variable error is positive evidence that the
     * numeric check ran and passed.
     */
    set(SUBJECT, "7");

    let message = "";
    try {
      validateEnv();
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    expect(message).not.toMatch(/is not defined/);
    expect(message).not.toContain(SUBJECT);
    expect(message, "it must have reached a LATER check, not stopped at the numeric one")
      .toContain("Missing required environment variable(s)");
    expect(envInt(SUBJECT), "the good value must actually be in force").toBe(7);
  });
});
