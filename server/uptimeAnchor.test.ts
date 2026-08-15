import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { uptimeAnchor } from "../scripts/lib/uptimeAnchor.mts";

/**
 * THE UPTIME ANCHOR MUST NOT DEPEND ON WHEN IT IS ASKED.
 *
 * The anchor answers one question across shifts — is production still the same
 * process the last shift saw, or did it restart? Two scripts computed it as
 * `Date.now() - healths[0].uptime`, taking the uptime from the first of three
 * health reads and the clock from after the read loop, which sleeps between
 * reads. Measured against production on 2026-08-16 over six reads of one
 * unmoving process: the honest anchor was 2026-08-15T23:13:43.726Z with a
 * spread of 0 ms, while `deploy-rite.mts` landed 8.009 s late, `park-state.mts`
 * 6.059 s late, and the two disagreed with each other by 1.950 s. A shift
 * comparing one against the other reads a restart that never happened.
 *
 * # What this covers, and what it does NOT
 *
 * The property is INVARIANCE: the anchor is a function of the reading alone.
 * Asserting only "anchor == timestamp - uptime" would run green over the defect
 * too if it were evaluated at one instant, so the arm moves the clock between
 * two calls and demands the same answer — and the legacy shape is kept here as
 * a negative control to prove that demand can fail. Without that control this
 * file would assert a property nothing threatens.
 *
 * It does NOT check that production is actually up, that the health payload has
 * these fields, or that the scripts are otherwise correct — the source guard
 * below only proves neither script computes the anchor privately again.
 */

/** The exact shape that shipped, kept solely so the arm can be shown to fail. */
const legacyAnchor = (reading: { uptime: number }) =>
  new Date(Date.now() - Math.round(reading.uptime * 1000)).toISOString();

const READING = { uptime: 260.205517334, timestamp: "2026-08-15T23:18:03.932Z" };

describe("uptimeAnchor", () => {
  it("is a function of the reading alone — the clock cannot move it", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-15T23:18:03.932Z"));
      const first = uptimeAnchor(READING);
      vi.setSystemTime(new Date("2026-08-15T23:18:09.932Z")); // the loop's sleeps
      const second = uptimeAnchor(READING);
      expect(second).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("NEGATIVE CONTROL: the shape it replaced moves by exactly the delay", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-15T23:18:03.932Z"));
      const first = legacyAnchor(READING);
      vi.setSystemTime(new Date("2026-08-15T23:18:09.932Z"));
      const second = legacyAnchor(READING);
      // Proves the arm above is not asserting a property nothing threatens.
      expect(new Date(second).getTime() - new Date(first).getTime()).toBe(6_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers the process start recorded against production", () => {
    // The reading and its answer are the real first read of the six.
    expect(uptimeAnchor(READING)).toBe("2026-08-15T23:13:43.726Z");
  });

  it("refuses an unreadable reading rather than inventing an instant", () => {
    expect(() => uptimeAnchor({ uptime: 1, timestamp: "" })).toThrow(/timestamp unreadable/);
    expect(() => uptimeAnchor({ uptime: NaN, timestamp: READING.timestamp })).toThrow(/uptime unreadable/);
  });
});

describe("the two instruments that print an anchor", () => {
  const repoRoot = path.resolve(__dirname, "..");

  for (const script of ["scripts/deploy-rite.mts", "scripts/park-state.mts"]) {
    it(`${script} derives the anchor instead of recomputing it`, () => {
      const source = fs.readFileSync(path.join(repoRoot, script), "utf8");
      expect(source).toMatch(/uptimeAnchor\(/);
      // The drift began as two private copies of one subtraction (law 4).
      expect(source).not.toMatch(/Date\.now\(\)[^\n]*uptime/);
    });
  }
});
