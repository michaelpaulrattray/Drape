/**
 * THE SHIFT LEDGER'S TWO NUMBERS (#543 item 4, founder-ordered and urgent).
 *
 * The card's requirement, verbatim: *"The join script from this investigation
 * is the reader; make it a tracked `scripts/lib` reader with a fixture arm,
 * not a disposable."* This is that arm.
 *
 * What it is really guarding is a JOIN, and a join's failure mode is silent:
 * it drops what it cannot match and reports a clean, small population. So the
 * arms that matter most here are the ones about MISSES — the unattributed PR,
 * the open run, the overlapping windows, and the empty window that must never
 * report a met target.
 */
import { describe, expect, it } from "vitest";

import {
  type MergedPrReading,
  type ShiftRunReading,
  TARGETS,
  attributePrsToSessions,
  judge,
  renderLedgerBlock,
  summarise,
} from "../scripts/lib/shiftLedger.mts";

const run = (over: Partial<ShiftRunReading> = {}): ShiftRunReading => ({
  id: 1,
  shift: "foreman-20260905-1000",
  seat: "foreman",
  startedAt: "2026-09-05T10:00:00Z",
  endedAt: "2026-09-05T11:15:00Z",
  outcome: "shipped",
  ...over,
});

const pr = (over: Partial<MergedPrReading> = {}): MergedPrReading => ({
  number: 500,
  mergedAt: "2026-09-05T10:30:00Z",
  gateMinutes: 7,
  gateRuns: 1,
  ...over,
});

describe("the join attributes a merged PR to the session that landed it", () => {
  it("puts a PR merged inside a window into that session", () => {
    const reading = attributePrsToSessions([run()], [pr()]);
    expect(reading.sessions).toHaveLength(1);
    expect(reading.sessions[0]!.prs.map((p) => p.number)).toEqual([500]);
    expect(reading.unattributed).toEqual([]);
  });

  it("splits several PRs across several sessions by their merge time", () => {
    const reading = attributePrsToSessions(
      [
        run({ id: 1, startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T11:00:00Z" }),
        run({ id: 2, startedAt: "2026-09-05T12:00:00Z", endedAt: "2026-09-05T13:00:00Z" }),
      ],
      [
        pr({ number: 1, mergedAt: "2026-09-05T10:30:00Z" }),
        pr({ number: 2, mergedAt: "2026-09-05T10:45:00Z" }),
        pr({ number: 3, mergedAt: "2026-09-05T12:30:00Z" }),
      ],
    );
    expect(reading.sessions[0]!.prs.map((p) => p.number)).toEqual([1, 2]);
    expect(reading.sessions[1]!.prs.map((p) => p.number)).toEqual([3]);
  });

  it("⚠ REPORTS a PR that fits no window rather than dropping it", () => {
    // A join that discards its misses reads as a clean, small population —
    // which is exactly the reading a denominator exists to prevent.
    const reading = attributePrsToSessions([run()], [pr({ number: 77, mergedAt: "2026-09-04T09:00:00Z" })]);
    expect(reading.sessions[0]!.prs).toEqual([]);
    expect(reading.unattributed.map((p) => p.number)).toEqual([77]);
    expect(summarise(reading).unattributedPrs).toBe(1);
  });

  it("an OPEN run is not a session — it has no upper bound to attribute inside", () => {
    const reading = attributePrsToSessions([run({ endedAt: null })], [pr()]);
    expect(reading.sessions).toEqual([]);
    expect(reading.unattributed.map((p) => p.number)).toEqual([500]);
  });

  it("reports overlapping windows, and gives the overlap to the later-starting run", () => {
    // One runner launches shifts, so this should be empty. If it is not, the
    // attribution is ambiguous and the caller is told rather than left to guess.
    const reading = attributePrsToSessions(
      [
        run({ id: 1, startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T12:00:00Z" }),
        run({ id: 2, startedAt: "2026-09-05T11:00:00Z", endedAt: "2026-09-05T13:00:00Z" }),
      ],
      [pr({ number: 9, mergedAt: "2026-09-05T11:30:00Z" })],
    );
    expect(reading.overlappingRunIds).toEqual([1, 2]);
    expect(reading.sessions.find((s) => s.run.id === 2)!.prs.map((p) => p.number)).toEqual([9]);
    expect(reading.sessions.find((s) => s.run.id === 1)!.prs).toEqual([]);
  });

  it("a PR merged exactly on a boundary is inside the window, not lost between two", () => {
    const reading = attributePrsToSessions(
      [run({ startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T11:00:00Z" })],
      [pr({ number: 1, mergedAt: "2026-09-05T10:00:00Z" }), pr({ number: 2, mergedAt: "2026-09-05T11:00:00Z" })],
    );
    expect(reading.sessions[0]!.prs.map((p) => p.number)).toEqual([1, 2]);
    expect(reading.unattributed).toEqual([]);
  });
});

describe("the figures, and their denominators", () => {
  it("counts cards, gate runs and gate minutes across sessions", () => {
    const reading = attributePrsToSessions(
      [
        run({ id: 1, startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T11:00:00Z" }),
        run({ id: 2, startedAt: "2026-09-05T12:00:00Z", endedAt: "2026-09-05T13:00:00Z" }),
      ],
      [
        pr({ number: 1, mergedAt: "2026-09-05T10:20:00Z", gateMinutes: 7, gateRuns: 1 }),
        pr({ number: 2, mergedAt: "2026-09-05T10:40:00Z", gateMinutes: 14, gateRuns: 2 }),
        pr({ number: 3, mergedAt: "2026-09-05T12:30:00Z", gateMinutes: 9, gateRuns: 1 }),
      ],
    );
    const f = summarise(reading);
    expect(f.sessions).toBe(2);
    expect(f.cards).toBe(3);
    expect(f.gateRuns).toBe(4);
    expect(f.gateMinutes).toBe(30);
    expect(f.gateMinutesPerCard).toBe(10);
    expect(f.gateRunsPerCard).toBeCloseTo(4 / 3, 5);
  });

  it("⚠ a quiet session drags the flat mean but not the target's figure", () => {
    // A quiet night that correctly lands nothing is a CORRECT shift (the
    // founder's anti-boredom rule), so the card's ">= 3 on a small-card night"
    // is read against sessions that landed something — with the all-sessions
    // figure printed beside it so the quiet ones stay visible.
    const reading = attributePrsToSessions(
      [
        run({ id: 1, startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T11:00:00Z" }),
        run({ id: 2, startedAt: "2026-09-05T12:00:00Z", endedAt: "2026-09-05T13:00:00Z" }),
      ],
      [
        pr({ number: 1, mergedAt: "2026-09-05T10:10:00Z" }),
        pr({ number: 2, mergedAt: "2026-09-05T10:20:00Z" }),
        pr({ number: 3, mergedAt: "2026-09-05T10:30:00Z" }),
      ],
    );
    const f = summarise(reading);
    expect(f.landingSessions).toBe(1);
    expect(f.cardsPerLandingSession).toBe(3);
    expect(f.cardsPerSession).toBe(1.5);
    expect(judge(f).find((v) => v.name.startsWith("cards landed"))!.met).toBe(true);
  });

  it("misses the gate-minutes target when the gate is spent 3.1 runs deep", () => {
    const reading = attributePrsToSessions(
      [run()],
      [pr({ gateMinutes: 22, gateRuns: 3 })],
    );
    const verdicts = judge(summarise(reading));
    expect(verdicts.find((v) => v.name === "gate minutes per card")!.met).toBe(false);
    expect(verdicts.find((v) => v.name.startsWith("gate runs"))!.met).toBe(true);
  });

  it("⚠ AN EMPTY WINDOW RETURNS met: null, NEVER met: true", () => {
    // A target that passes on no data is how an instrument reports success
    // while measuring nothing.
    const verdicts = judge(summarise(attributePrsToSessions([], [])));
    for (const v of verdicts) {
      expect(v.met, `${v.name} must not pass on an empty window`).toBeNull();
      expect(v.figure).toBeNull();
    }
  });

  it("and a session that landed nothing is still not a pass", () => {
    const verdicts = judge(summarise(attributePrsToSessions([run()], [])));
    expect(verdicts.find((v) => v.name.startsWith("cards landed"))!.met).toBeNull();
  });

  it("the targets are the card's own", () => {
    expect(TARGETS.cardsPerLandingSession).toBe(3);
    expect(TARGETS.gateMinutesPerCard).toBe(10);
    expect(TARGETS.baselineGateRunsPerCard).toBeCloseTo(3.1, 5);
  });
});

describe("the block the ledger prints", () => {
  it("says NO CLOSED RUNS rather than printing zeros", () => {
    const text = renderLedgerBlock(attributePrsToSessions([], []), "last 14d");
    expect(text).toMatch(/NO CLOSED SHIFT RUNS/);
    expect(text).not.toMatch(/OK /);
  });

  it("names every unattributed PR in the output", () => {
    const text = renderLedgerBlock(
      attributePrsToSessions([run()], [pr({ number: 77, mergedAt: "2026-09-04T09:00:00Z" })]),
      "last 14d",
    );
    expect(text).toMatch(/#77/);
    expect(text).toMatch(/NOT in the figures above/);
  });

  it("names overlapping runs in the output", () => {
    const text = renderLedgerBlock(
      attributePrsToSessions(
        [
          run({ id: 1, startedAt: "2026-09-05T10:00:00Z", endedAt: "2026-09-05T12:00:00Z" }),
          run({ id: 2, startedAt: "2026-09-05T11:00:00Z", endedAt: "2026-09-05T13:00:00Z" }),
        ],
        [pr({ mergedAt: "2026-09-05T11:30:00Z" })],
      ),
      "last 14d",
    );
    expect(text).toMatch(/overlapping windows: 1, 2/);
  });

  it("carries both figures and both denominators", () => {
    const text = renderLedgerBlock(
      attributePrsToSessions([run()], [pr({ gateMinutes: 7, gateRuns: 1 })]),
      "last 14d",
    );
    expect(text).toMatch(/cards landed per session/);
    expect(text).toMatch(/gate minutes per card/);
    expect(text).toMatch(/closed sessions          1/);
  });
});
