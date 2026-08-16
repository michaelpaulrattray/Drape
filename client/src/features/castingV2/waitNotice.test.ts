import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { waitExceeds } from "./waitNotice";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const SHEET = path.join(ROOT, "client", "src", "pages", "CastingSheet.tsx");
const PANEL = path.join(ROOT, "client", "src", "features", "castingV2", "components", "RefinePanel.tsx");

const TWO_MINUTES = 2 * 60 * 1000;

describe("waitExceeds — the decision, on a duration", () => {
  it("says nothing on a wait that has not reached the mark", () => {
    expect(waitExceeds(TWO_MINUTES - 1, TWO_MINUTES)).toBe(false);
    expect(waitExceeds(TWO_MINUTES, TWO_MINUTES)).toBe(false);
    expect(waitExceeds(0, TWO_MINUTES)).toBe(false);
  });

  it("says so past it", () => {
    expect(waitExceeds(TWO_MINUTES + 1, TWO_MINUTES)).toBe(true);
    expect(waitExceeds(15 * 60 * 1000, TWO_MINUTES)).toBe(true);
  });

  /*
    AN ABSENT DURATION IS NOT A LONG WAIT.

    A payload written before the field existed, a query that has not answered
    yet, or a malformed number must all read as "nothing to confess". The
    dangerous one is `undefined`: `undefined > 120000` is false by accident, and
    an accident is not a decision.
  */
  it("treats an unknown wait as no wait at all", () => {
    for (const absent of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(waitExceeds(absent as number | null | undefined, TWO_MINUTES), String(absent)).toBe(false);
    }
  });
});

/*
  AND THE CLOCK ITSELF, GUARDED AT BOTH SURFACES.

  This is the arm that would have caught the defect: the two promises were
  decided from the BROWSER's `Date.now()` minus a server-written moment, so a
  laptop two minutes out of true either confessed on every roll or never
  confessed at all — silently, in the direction that matters. The rule is not
  "call this helper", it is that neither surface subtracts a server timestamp
  from its own clock to decide when to speak. Read off the sources, because the
  defect was in a line of JSX that no unit test reaches.
*/
describe("neither wait notice is decided on the browser's clock", () => {
  it("the sheet's still-casting confession compares a server-sent duration", async () => {
    const source = await readFile(SHEET, "utf8");
    expect(source).toMatch(/rollIsOverdue = waitExceeds\(roll\.data\?\.ageMs/);
    expect(source).not.toMatch(/Date\.now\(\)\s*-\s*rollStartedAt/);
    expect(source).not.toMatch(/Date\.parse\(roll\.data\.createdAt\)/);
  });

  it("the refine panel's long-wait note compares a server-sent duration", async () => {
    const source = await readFile(PANEL, "utf8");
    expect(source).toMatch(/waitExceeds\(entry\.waitedMs, LONG_WAIT_MS\)/);
    expect(source).not.toMatch(/Date\.now\(\)\s*-\s*new Date\(entry\.startedAt\)/);
  });

  /*
    The negative control for the two `not.toMatch`es above: a source-reading
    assertion passes just as happily against a file that has moved, been
    renamed, or come back empty, and "the defect is absent" would then be a
    reading of nothing at all.
  */
  it("is reading the real sources", async () => {
    for (const file of [SHEET, PANEL]) {
      const source = await readFile(file, "utf8");
      expect(source.length, file).toBeGreaterThan(1_000);
      expect(source, file).toContain("waitExceeds");
    }
  });
});
