/**
 * THE STALLED VERDICT, DRIVEN DIRECTLY (issue #272, `shared/crewShiftState.ts`).
 *
 * #272's bar: *"A shift that dies without stamping its row shows as stalled,
 * not as working."* That case cannot be produced by running the product — it
 * requires a shift to DIE — so the only honest way to test it is to drive the
 * derivation with the clock as a parameter (working law 3: a backstop needs a
 * test the model cannot rescue; here, a test the absent shift cannot rescue).
 *
 * `now` is passed in rather than mocked for the same reason: a frozen clock is
 * a second mechanism that can itself be wrong, and this function has no other
 * input worth isolating.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_SHIFT_OUTCOMES,
  CREW_SHIFT_SEATS,
  CREW_SHIFT_STALL_MS,
  CREW_SHIFT_WORK_KINDS,
  CARD_REF_STORED_LENGTH,
  findCardCollisions,
  looksLive,
  deriveShiftRunState,
} from "../shared/crewShiftState";

const NOW = Date.UTC(2026, 7, 30, 6, 0, 0);
const minutesAgo = (n: number) => new Date(NOW - n * 60_000);

/**
 * Inside and outside the window, DERIVED from it (#295).
 *
 * These arms used to read `minutesAgo(59)` and `minutesAgo(61)` against an
 * hour-long window. When #295 widened the window to clear a real shift, all
 * three literals silently changed meaning — 61 minutes is now a running shift
 * — and the suite went red rather than passing about the wrong thing, which is
 * the good outcome and also the reason not to write it that way twice.
 */
const insideWindow = () => new Date(NOW - CREW_SHIFT_STALL_MS + 60_000);
const pastWindow = () => new Date(NOW - CREW_SHIFT_STALL_MS - 60_000);

describe("what a shift run is doing", () => {
  it("a fresh heartbeat is running", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(2), endedAt: null }, NOW)).toBe("running");
  });

  it("a heartbeat inside the window is still running", () => {
    expect(deriveShiftRunState({ heartbeatAt: insideWindow(), endedAt: null }, NOW)).toBe("running");
  });

  /*
    THE ARM THIS FILE EXISTS FOR. An open run whose shift died: nothing wrote
    "failed", nothing wrote `endedAt`, and the page must not say it is working.
  */
  it("an open run past the window is STALLED, not running", () => {
    expect(deriveShiftRunState({ heartbeatAt: pastWindow(), endedAt: null }, NOW)).toBe("stalled");
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(60 * 24), endedAt: null }, NOW)).toBe("stalled");
  });

  /*
    THE BOUNDARY IS ASSERTED AGAINST THE CONSTANT, NEVER AGAINST A LITERAL —
    a magic number here would pin the fixture rather than the rule, and moving
    the window would leave a test that passes about the wrong thing.
  */
  it("the window is exactly the declared one", () => {
    expect(deriveShiftRunState({ heartbeatAt: new Date(NOW - CREW_SHIFT_STALL_MS), endedAt: null }, NOW)).toBe("running");
    expect(deriveShiftRunState({ heartbeatAt: new Date(NOW - CREW_SHIFT_STALL_MS - 1), endedAt: null }, NOW)).toBe("stalled");
  });

  /*
    `endedAt` WINS OVER EVERYTHING. Without this, every run in the "last three
    shifts" list would read as stalled the moment it aged past the window —
    which is all of them, always.
  */
  it("a closed run is finished however old its heartbeat is", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(60 * 24 * 30), endedAt: minutesAgo(60 * 24 * 30) }, NOW))
      .toBe("finished");
  });

  it("accepts the ISO strings tRPC puts on the wire, not just Dates", () => {
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(2).toISOString(), endedAt: null }, NOW)).toBe("running");
    expect(deriveShiftRunState({ heartbeatAt: pastWindow().toISOString(), endedAt: null }, NOW)).toBe("stalled");
    expect(deriveShiftRunState({ heartbeatAt: minutesAgo(2).toISOString(), endedAt: minutesAgo(1).toISOString() }, NOW))
      .toBe("finished");
  });

  /* An unreadable timestamp is not evidence of life. The safe direction is the
     one that makes him look. */
  it("an unparseable heartbeat reads as stalled, never as running", () => {
    expect(deriveShiftRunState({ heartbeatAt: "not a date", endedAt: null }, NOW)).toBe("stalled");
  });
});

/**
 * The closed vocabularies. These are asserted because the shift scripts
 * validate against them and the page draws from them — a member added on one
 * side and not the other is how a typo'd seat draws a blank strip.
 */
describe("the vocabularies are closed and shared", () => {
  it("the seats are the ones PROGRAM.md names", () => {
    expect([...CREW_SHIFT_SEATS]).toEqual(["foreman", "janitor", "warden", "machinist", "retro"]);
  });

  it("the work kinds include `background`, which #277's switch gates", () => {
    expect(CREW_SHIFT_WORK_KINDS).toContain("background");
    expect([...CREW_SHIFT_WORK_KINDS]).toEqual(["focus", "sidelane", "patrol", "maintenance", "background"]);
  });

  it("the outcomes are exactly the three #272 names", () => {
    expect([...CREW_SHIFT_OUTCOMES]).toEqual(["shipped", "stopped", "failed"]);
  });
});

/**
 * THE CARD COLLISION (#608) — two seats worked the same founder reply three
 * minutes apart, and the merge conflict at push time was the only control.
 *
 * The arms that matter are the two the design turns on: it must fire on a row
 * that has NEVER CHECKED IN (which is what the origin incident's row was, and
 * why `looksLive` is not the instrument), and it must be silent when no card
 * is named, because a shift may legitimately open a run without one.
 */
describe("findCardCollisions", () => {
  const run = (id: number, cardRef: string | null) => ({
    id,
    cardRef,
    shift: `foreman-${id}`,
    seat: "foreman" as const,
  });

  it("finds an open run on the same card", () => {
    const hits = findCardCollisions([run(1, "#535"), run(2, "#601")], "#535");

    expect(hits.map((h) => h.id)).toEqual([1]);
  });

  it("fires on a row that has never checked in — the origin incident's shape", () => {
    /* The other seat's row was three minutes old and had never heartbeated, so
       `looksLive` reads it as not live. This reading does not consult it. */
    const justOpened = { ...run(118, "#535"), heartbeatAt: new Date(), startedAt: new Date() };

    expect(findCardCollisions([justOpened], "#535")).toHaveLength(1);
    expect(looksLive(justOpened, Date.now())).toBe(false);
  });

  it("treats `#535`, `535` and a padded ref as one card", () => {
    expect(findCardCollisions([run(1, "535")], "#535")).toHaveLength(1);
    expect(findCardCollisions([run(1, "#535")], " 535 ")).toHaveLength(1);
    expect(findCardCollisions([run(1, " #535")], "535")).toHaveLength(1);
  });

  it("does not collide different cards, or #535 with #5350", () => {
    expect(findCardCollisions([run(1, "#5350")], "#535")).toHaveLength(0);
    expect(findCardCollisions([run(1, "#601")], "#535")).toHaveLength(0);
  });

  it("is silent when either side names no card", () => {
    expect(findCardCollisions([run(1, "#535")], null)).toHaveLength(0);
    expect(findCardCollisions([run(1, "#535")], "  ")).toHaveLength(0);
    expect(findCardCollisions([run(1, null)], "#535")).toHaveLength(0);
    // Two cardless runs are not "the same card".
    expect(findCardCollisions([run(1, null)], null)).toHaveLength(0);
  });

  /*
   * ⚠ THE TRUNCATION HOLE, FOUND BY THE PR #691 REVIEW, ON THE GUARD'S OWN
   * DEFENDED CLASS. `crew-shift-start.mts` stores `--card` truncated to the
   * column's 64 characters; comparing the UNTRUNCATED argument against that row
   * meant two seats declaring the same long free-text ref — a founder-reply
   * description, which is the origin incident's own shape — normalised
   * differently and never collided.
   */
  it("a long free-text ref collides with its own stored truncation", () => {
    const long = `remove the suggestion chips from every brief box and close the cards ${"x".repeat(20)}`;
    expect(long.length).toBeGreaterThan(CARD_REF_STORED_LENGTH);

    const stored = long.slice(0, CARD_REF_STORED_LENGTH); // what the column holds
    expect(findCardCollisions([run(1, stored)], long)).toHaveLength(1);
  });

  it("two long refs that differ only past the stored length are one card, honestly", () => {
    /* The consequence of the fix, stated rather than discovered: past 64
       characters the column cannot tell them apart, so neither can this. */
    const base = "a".repeat(CARD_REF_STORED_LENGTH);
    expect(findCardCollisions([run(1, `${base}ONE`)], `${base}TWO`)).toHaveLength(1);
  });

  it("leading zeros do not make a second card", () => {
    expect(findCardCollisions([run(1, "#0608")], "#608")).toHaveLength(1);
    expect(findCardCollisions([run(1, "608")], "#00608")).toHaveLength(1);
    // ...and it is still not a different NUMBER.
    expect(findCardCollisions([run(1, "#6080")], "#608")).toHaveLength(0);
  });

  it("collides on an unparseable ref by its own text, rather than dropping it", () => {
    expect(findCardCollisions([run(1, "PROGRAM.md ladder")], "program.md LADDER")).toHaveLength(1);
  });

  it("reports every colliding run, not just the newest", () => {
    const hits = findCardCollisions([run(3, "#535"), run(2, "#601"), run(1, "#535")], "#535");

    expect(hits.map((h) => h.id)).toEqual([3, 1]);
  });
});
