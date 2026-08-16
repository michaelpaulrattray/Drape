import { describe, expect, it } from "vitest";

import { findSuiteLine, readSuiteLine, suiteVerdict } from "../scripts/lib/suiteLine.mts";

/** The tail of the real red run of 2026-08-16, verbatim. */
const RED_RUN = [
  " Test Files  1 failed | 460 passed | 27 skipped (488)",
  "      Tests  1 failed | 6754 passed | 302 skipped (7057)",
  "   Start at  01:39:42",
  "   Duration  45.51s (transform 59.27s, setup 13.97s)",
].join("\n");

/** And the green one that followed it. */
const GREEN_RUN = [
  " Test Files  461 passed | 27 skipped (488)",
  "      Tests  6755 passed | 302 skipped (7057)",
  "   Duration  45.48s",
].join("\n");

/**
 * The control this guard exists for is the reading that CONVICTED it: a park
 * that reported the suite green while it was red, with the evidence already
 * printed in the line the park was copying from.
 *
 * Positive control — a real green line sums.
 * Negative control — the park's own three numbers do NOT sum, and the deficit
 * is exactly the failure that was dropped.
 */
describe("a suite reading is only a reading if its parts sum to its own total", () => {
  it("POSITIVE — a real green line sums to its parenthetical", () => {
    const reading = readSuiteLine("      Tests  6755 passed | 302 skipped (7057)")!;
    expect(reading.sums).toBe(true);
    expect(reading.total).toBe(7057);
    expect(reading.sum).toBe(7057);
    expect(reading.unaccounted).toBe(0);
  });

  it("POSITIVE — a real RED line sums too, once the failure is counted", () => {
    const reading = readSuiteLine("      Tests  1 failed | 6754 passed | 302 skipped (7057)")!;
    expect(reading.sums).toBe(true);
    expect(reading.parts).toContainEqual({ count: 1, label: "failed" });
  });

  it("NEGATIVE — the claim that was made on 2026-08-16 is refused, by one test", () => {
    const reading = readSuiteLine("      Tests  6754 passed | 302 skipped | 0 failed (7057)")!;
    expect(reading.sums).toBe(false);
    expect(reading.unaccounted).toBe(1);
    expect(suiteVerdict("      Tests  6754 passed | 302 skipped | 0 failed (7057)"))
      .toContain("NOT A READING");
  });

  it("NEGATIVE — a line with no total printed is refused rather than believed", () => {
    const reading = readSuiteLine("      Tests  6755 passed | 302 skipped")!;
    expect(reading.total).toBeNull();
    expect(reading.sums).toBe(false);
    expect(suiteVerdict("      Tests  6755 passed | 302 skipped")).toContain("no total printed");
  });

  it("reads a line that is not the summary as nothing, rather than as zero", () => {
    expect(readSuiteLine(" Duration  45.48s (transform 53.84s, setup 13.83s)")?.sums).not.toBe(true);
    expect(readSuiteLine("no numbers here at all")).toBeNull();
  });

  it("widens to a category nobody enumerated, rather than breaking on it", () => {
    // `todo` is not named anywhere in the reader; a word it has never seen must
    // join the sum, because a list of expected labels would mirror vitest's
    // vocabulary and drift from it (working law 4).
    const reading = readSuiteLine("      Tests  6750 passed | 302 skipped | 5 todo (7057)")!;
    expect(reading.sums).toBe(true);
  });

  it("picks the Tests line, NEVER the Test Files line — the red-run trap", () => {
    // The predicate this replaced also matched `failed |`, and on a red run
    // `Test Files  1 failed | …` comes FIRST. Its parts sum (488), so a reader
    // taking the first match would print file counts with a tick beside them.
    expect(findSuiteLine(RED_RUN)).toBe("Tests  1 failed | 6754 passed | 302 skipped (7057)");
    expect(findSuiteLine(GREEN_RUN)).toBe("Tests  6755 passed | 302 skipped (7057)");
    expect(readSuiteLine(findSuiteLine(RED_RUN)!)!.parts).toContainEqual({ count: 1, label: "failed" });
    expect(findSuiteLine("no run happened here")).toBeNull();
  });

  it("and the PREDICATE is what does it, not the last-match — driven, because a "
    + "sabotage said otherwise", () => {
    // Restoring the old `failed |` predicate did NOT redden the case above:
    // taking the LAST match already skips the `Test Files` line, so that test
    // passed for a reason it was not testing. This fixture is CONSTRUCTED — a
    // counting line after the summary — and it is the one that tells the two
    // mechanisms apart, so the predicate stops being decoration.
    const trailing = `${RED_RUN}\n ELIFECYCLE  Command failed with exit code 1.`
      + "\n   Serialized Error: 3 failed | 1 passed (4)";
    expect(findSuiteLine(trailing)).toBe("Tests  1 failed | 6754 passed | 302 skipped (7057)");
  });

  it("survives colour and thousands separators — the shapes a report copies", () => {
    const coloured = `      Tests  ${String.fromCharCode(27)}[32m6755 passed${String.fromCharCode(27)}[39m | 302 skipped (7057)`;
    expect(readSuiteLine(coloured)!.sums).toBe(true);
    expect(readSuiteLine("      Tests  6,755 passed | 302 skipped (7,057)")!.sums).toBe(true);
  });
});
