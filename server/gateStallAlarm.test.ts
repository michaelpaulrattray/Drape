import { describe, expect, it } from "vitest";

import {
  GATE_DURATION,
  NO_SUITE_FINDING_MS,
  SUITE_CREATION,
  decideStall,
  describeVerdict,
  type GateRun,
} from "../scripts/lib/gateStall.mts";

/**
 * THE FORTY MINUTES SPENT WAITING FOR A GREEN THAT COULD NOT ARRIVE (#368).
 *
 * On 2026-08-26 from 13:44Z the Gate and Fable Review workflows stopped
 * producing runs for this repository. Three consecutive `pull_request` events
 * on PR #78 created NO check suite at all while Railway's and Claude's apps
 * created theirs on the same commits. Nothing unsafe happened — branch
 * protection refused the merge — but a shift sat waiting on silence it had no
 * way to read.
 *
 * The alarm is a polling loop, which is the hardest thing here to drive by
 * hand, so the whole decision is a pure function and this drives it directly
 * (law 3: a backstop needs a test the model cannot rescue). Every fixture
 * below is a shape GitHub actually returns.
 *
 * ⚠ THE ARM THAT MATTERS MOST IS THE NEGATIVE ONE. An alarm that cries stall
 * over a healthy gate would be worse than no alarm: it would teach shifts to
 * ignore it, and the one real stall in a week would then be ignored too. So
 * the card's own bar — *"a slow-but-alive gate does NOT alarm — a positive
 * control over a real run at the gate's p99"* — is pinned twice below, at the
 * measured p99 and past it.
 */

const NOW = "2026-09-01T05:00:00.000Z";
const at = (msBefore: number) => new Date(new Date(NOW).getTime() - msBefore).toISOString();

const run = (over: Partial<GateRun> = {}): GateRun => ({
  status: "in_progress",
  conclusion: null,
  createdAt: at(60_000),
  updatedAt: at(0),
  ...over,
});

describe("a run that EXISTS is never a stall, whatever the clock says", () => {
  it("the card's named bar: a gate run at the measured p99 (15.1m) does NOT alarm", () => {
    const v = decideStall({
      runs: [run({ createdAt: at(GATE_DURATION.p99Ms) })],
      // Pushed long enough ago to be well past the finding line — the point is
      // that it cannot matter, because a run exists.
      pushedAt: at(GATE_DURATION.p99Ms + 60_000),
      now: NOW,
    });
    expect(v.kind).toBe("running");
    expect(describeVerdict(v)).not.toContain("STALL");
  });

  it("the same run PAST p99 still does not alarm — it is reported as long, not stuck", () => {
    const v = decideStall({
      runs: [run({ createdAt: at(GATE_DURATION.p100Ms + 10 * 60_000) })],
      pushedAt: at(GATE_DURATION.p100Ms + 11 * 60_000),
      now: NOW,
    });
    expect(v).toMatchObject({ kind: "running", beyondP99: true });
    expect(describeVerdict(v)).toContain("Alive, not stalled");
  });

  it("a queued run that has not started is a run — GitHub created the suite", () => {
    const v = decideStall({
      runs: [run({ status: "queued", createdAt: at(9 * 60_000) })],
      pushedAt: at(10 * 60_000),
      now: NOW,
    });
    expect(v.kind).toBe("running");
  });

  it("a COMPLETED run reports its conclusion and never a stall", () => {
    const v = decideStall({
      runs: [
        run({
          status: "completed",
          conclusion: "failure",
          createdAt: at(20 * 60_000),
          updatedAt: at(12 * 60_000),
        }),
      ],
      pushedAt: at(21 * 60_000),
      now: NOW,
    });
    expect(v).toMatchObject({ kind: "complete", conclusion: "failure" });
  });

  /*
   * ⚠ FOUND BY DRIVING IT, NOT BY READING IT. Watching PR #371's own gate, the
   * last line printed `COMPLETE — the gate finished 8.2m ago: success` two
   * seconds after it finished: the reporter was reading the run's AGE and
   * calling it a finish time, so a shift would have believed it missed the
   * result by eight minutes. A claim about when something ended is read from
   * the field that says when it ended.
   */
  it("a finish time is read from updatedAt, never from the run's age", () => {
    const v = decideStall({
      runs: [
        run({
          status: "completed",
          conclusion: "success",
          createdAt: at(8.2 * 60_000),
          updatedAt: at(2_000), // finished two seconds ago
        }),
      ],
      pushedAt: at(9 * 60_000),
      now: NOW,
    });
    expect(v).toMatchObject({ kind: "complete", finishedMsAgo: 2_000 });
    const line = describeVerdict(v);
    expect(line).toContain("finished 0.0m ago");
    expect(line).not.toContain("finished 8.2m ago");
  });

  it("a RE-RUN supersedes the run it replaced — the newest row decides", () => {
    const v = decideStall({
      runs: [
        run({ status: "completed", conclusion: "cancelled", createdAt: at(30 * 60_000) }),
        run({ status: "in_progress", createdAt: at(2 * 60_000) }),
      ],
      pushedAt: at(31 * 60_000),
      now: NOW,
    });
    // Read off the oldest row this would say "complete: cancelled" and a shift
    // would stop waiting on a gate that is at that moment running.
    expect(v.kind).toBe("running");
  });
});

describe("no run at all — the incident, and the window before it counts as one", () => {
  it("FIRES: no gate run five minutes after the push", () => {
    const v = decideStall({ runs: [], pushedAt: at(NO_SUITE_FINDING_MS), now: NOW });
    expect(v).toMatchObject({ kind: "stall", findingAtMs: NO_SUITE_FINDING_MS });
    expect(describeVerdict(v)).toContain("STOP WAITING");
  });

  it("FIRES on the 2026-08-26 incident's own shape — 40 minutes, no suite of ours", () => {
    const v = decideStall({ runs: [], pushedAt: at(40 * 60_000), now: NOW });
    expect(v.kind).toBe("stall");
  });

  it("NEGATIVE CONTROL — a fresh push is not a stall, it is a wait", () => {
    // The measured p100 for a push to an open PR is 5 seconds; this is 12x it
    // and must still read as normal.
    const v = decideStall({ runs: [], pushedAt: at(60_000), now: NOW });
    expect(v).toMatchObject({ kind: "waiting" });
    expect(describeVerdict(v)).not.toContain("STALL");
  });

  it("NEGATIVE CONTROL — a branch's FIRST push at its measured p100 is not a stall", () => {
    const v = decideStall({
      runs: [],
      pushedAt: at(SUITE_CREATION.branchFirstP100Ms),
      now: NOW,
    });
    expect(v.kind).toBe("waiting");
  });

  it("the boundary is inclusive at the finding line and open below it", () => {
    expect(decideStall({ runs: [], pushedAt: at(NO_SUITE_FINDING_MS - 1), now: NOW }).kind).toBe(
      "waiting",
    );
    expect(decideStall({ runs: [], pushedAt: at(NO_SUITE_FINDING_MS + 1), now: NOW }).kind).toBe(
      "stall",
    );
  });
});

describe("it refuses rather than guesses when the push cannot be dated", () => {
  it("no reference suite means NO VERDICT, not a stall and not a wait", () => {
    const v = decideStall({ runs: [], pushedAt: null, now: NOW });
    expect(v.kind).toBe("unknown-push");
    expect(describeVerdict(v)).toContain("No verdict");
  });

  it("but a run existing settles it without needing the push at all", () => {
    const v = decideStall({ runs: [run()], pushedAt: null, now: NOW });
    expect(v.kind).toBe("running");
  });
});

describe("the threshold is the measured one, and the measurement is on the record", () => {
  /*
   * A number in a source file is a claim like any other. These arms do not
   * re-measure GitHub — they pin the relationship between the threshold and
   * the distribution it was drawn from, so that moving one without the other
   * reddens. The three-round derivation is in `lib/gateStall.mts`'s header;
   * two plausible proxies were wrong in the same direction before it.
   */
  it("the finding line clears the worst suite-creation time ever measured, with margin", () => {
    const worst = Math.max(SUITE_CREATION.pushP100Ms, SUITE_CREATION.branchFirstP100Ms);
    expect(NO_SUITE_FINDING_MS / worst).toBeGreaterThanOrEqual(5);
  });

  it("and it is well UNDER the gate's own duration, because it is not a duration", () => {
    // The card set 10 minutes from the gate taking ~6. That reasoning applies
    // to a run FINISHING; this alarm asks whether the run was ever CREATED.
    // Pinning the inequality keeps the two from being conflated again.
    expect(NO_SUITE_FINDING_MS).toBeLessThan(GATE_DURATION.p50Ms);
  });

  it("the sample sizes are recorded, so a later re-measure has something to beat", () => {
    expect(SUITE_CREATION.pushSample).toBeGreaterThan(30);
    expect(SUITE_CREATION.branchFirstSample).toBeGreaterThan(30);
  });
});
