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
  resolveCloseTarget,
  type OpenRunForClose,
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

/**
 * WHOSE ROW A BARE CLOSE CLOSES (#1234), DRIVEN WITHOUT A DATABASE.
 *
 * The incident, at the rows: #360 (`foreman-20260925-1649`) open from 06:50Z, a
 * second seat's #361 (`foreman-20260925-1745`) opened at 07:45Z, and at 07:55Z
 * the first shift's bare close stamped **#361** — `ORDER BY id DESC LIMIT 1` —
 * with the first shift's note, while that seat was mid-shift on a
 * `founder-ordered` card and its worktree held an unpushed commit.
 *
 * ⚠ **No time-based guard can catch this and that is why the default went.**
 * `looksLive` refuses a row that checked in within the last couple of minutes; a
 * live seat that is simply building looks exactly like a dead one. So the arms
 * here are about the CHOICE, and the one that carries the weight is the refusal:
 * a resolver that always picked something would pass every happy arm.
 */
describe("resolveCloseTarget — #1234", () => {
  const run = (id: number, shift: string, seat = "foreman"): OpenRunForClose => ({
    id,
    shift,
    seat,
    intent: `what ${shift} is doing`,
  });

  /** The two rows as they actually stood on 2026-09-25. */
  const THE_INCIDENT = [run(361, "foreman-20260925-1745"), run(360, "foreman-20260925-1649")];

  it("REFUSES a bare close while two seats are open, and names both", () => {
    const verdict = resolveCloseTarget({ openRuns: THE_INCIDENT, shift: null });

    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.why).toContain("#360");
    expect(verdict.why).toContain("#361");
    expect(verdict.why).toContain("--shift");
  });

  it("closes the row the caller NAMES, never the newest", () => {
    /* The whole repair in one arm: the shift that made the mistake would have
       closed #360, its own, and #361 would have stayed open. */
    const verdict = resolveCloseTarget({ openRuns: THE_INCIDENT, shift: "foreman-20260925-1649" });

    expect(verdict.kind).toBe("one");
    if (verdict.kind !== "one") return;
    expect(verdict.run.id).toBe(360);
    expect(verdict.how).toBe("the shift id");
  });

  it("⚠ POSITIVE CONTROL — a single-seat night still closes with no flags at all", () => {
    /* A resolver that refused whenever it was unsure would pass every arm above
       and cost every ordinary night an extra flag. */
    const verdict = resolveCloseTarget({ openRuns: [run(360, "foreman-20260925-1649")], shift: null });

    expect(verdict.kind).toBe("one");
    if (verdict.kind !== "one") return;
    expect(verdict.run.id).toBe(360);
    expect(verdict.how).toBe("the only open run");
  });

  it("refuses a shift id that has no OPEN row, and shows what is open instead", () => {
    /* The shape a shift meets when its own row was already closed by somebody
       else — the other side of this very incident. Silently falling back to the
       only open row would close a stranger's. */
    const verdict = resolveCloseTarget({ openRuns: THE_INCIDENT, shift: "foreman-20260925-0000" });

    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.why).toContain("no OPEN run");
    expect(verdict.why).toContain("#360");
    expect(verdict.why).toContain("--id");
  });

  it("⚠ a named shift that matches nothing REFUSES even when exactly one row is open", () => {
    /*
      ⚠ **THE ARM THE SABOTAGE RUN ASKED FOR.** The first shape of this suite
      only ever met a non-matching `--shift` with TWO rows open, so a fall-back
      reading *"nothing matched, but there is only one open row, so that must be
      it"* passed green — and that fall-back is this very incident: the shift's
      own row had been closed by somebody else, and the only row left open
      belongs to a stranger.
    */
    const verdict = resolveCloseTarget({
      openRuns: [run(361, "foreman-20260925-1745", "retro")],
      shift: "foreman-20260925-1649",
    });

    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.why).toContain("no OPEN run");
    expect(verdict.why).toContain("#361");
  });

  it("refuses when nothing is open, and says that is itself the finding", () => {
    const verdict = resolveCloseTarget({ openRuns: [], shift: null });

    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.why).toContain("no open run");
  });

  it("a named shift with nothing open at all says so rather than listing an empty set", () => {
    const verdict = resolveCloseTarget({ openRuns: [], shift: "foreman-20260925-1649" });

    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.why).toContain("Nothing is open at all");
  });

  it("refuses when two open rows share one shift id, rather than taking either", () => {
    /* It should not happen, and `--shift` would silently pick one if it did.
       A guess is a guess whichever flag produced it. */
    const verdict = resolveCloseTarget({
      openRuns: [run(361, "foreman-20260925-1649", "retro"), run(360, "foreman-20260925-1649")],
      shift: "foreman-20260925-1649",
    });

    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.why).toContain("does not pick one");
  });

  it("treats blank and whitespace --shift as not named, never as a shift called nothing", () => {
    for (const blank of ["", "   "]) {
      const verdict = resolveCloseTarget({ openRuns: [run(360, "foreman-20260925-1649")], shift: blank });
      expect(verdict.kind, JSON.stringify(blank)).toBe("one");
    }
    /* And with two open, a blank still refuses rather than matching neither and
       falling through to a guess. */
    expect(resolveCloseTarget({ openRuns: THE_INCIDENT, shift: "  " }).kind).toBe("refuse");
  });
});
