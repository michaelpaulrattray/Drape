/**
 * THE DETECTOR THAT DOES NOT DEPEND ON A SHIFT RUNNING (#2719, R23).
 *
 * The team stopped for six days and no reader the team owns could see it,
 * because every alarm it has keys on work IN FLIGHT. The repair's buildable
 * half is a scheduled job, and this is the half of THAT which can be driven:
 * the verdict, the threshold arithmetic, and the reader that assembles both
 * facts from `gh`.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE NEGATIVE ONE.** A detector that raised
 * on silence alone would fire every time the team correctly parked, and an
 * alarm that fires routinely is the state this card is about arriving by the
 * opposite road — the card's own words: *"6d ago reads identically to a quiet
 * weekend."* So `parked` is asserted as carefully as `stopped`.
 */
import { describe, expect, it, vi } from "vitest";

import {
  judgeTeamSilence,
  readTeamSilence,
  takeableOrderedCards,
  teamSilenceExitCode,
  teamSilenceSentence,
  TEAM_SILENCE_HOURS,
} from "../scripts/lib/teamSilence.mts";
import { buildBoard } from "../scripts/lib/cardBuildState.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/*
  ⚠ THIS SUITE IS IN `childProcessSuites`' DERIVED POPULATION, and it took the
  guard to notice. None of these arms spawns anything — `gh` is injected as a
  fake on every one of them — but the deriver is TRANSITIVE: it follows relative
  imports, and `cardBuildState.mts` (imported here for `buildBoard`, the real
  board the takeable count is asked of) runs `gh` through `execFileSync`. So a
  path through this file CAN start a process, and under load that is the 5-second
  default this class exists for.

  It only became visible once the file was committed — `git ls-files` cannot see
  an untracked suite, which the guard's own header says about itself.
*/
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const NOW = Date.parse("2026-10-28T00:00:00Z");
const hoursAgo = (hours: number): number => NOW - hours * 3_600_000;

/** A board nothing is being built on — every card free, nothing unread. */
const cleanBoard = () => buildBoard({
  openPullRequests: [],
  comments: [],
  notBuilt: new Set<number>(),
  nowMs: NOW,
});

describe("judgeTeamSilence — silence alone is not the finding", () => {
  it("says the team is running while main has moved inside the window", () => {
    const verdict = judgeTeamSilence({
      nowMs: NOW,
      lastCommitMs: hoursAgo(2),
      takeable: 5,
      thresholdHours: 18,
    });
    expect(verdict.kind).toBe("moving");
    expect(teamSilenceExitCode(verdict)).toBe(0);
  });

  /*
    ⚠ THE NEGATIVE CONTROL, and the reason this detector is two facts rather
    than one. Six days of silence with an EMPTY board is the runner parking
    exactly as #504 designed it, and raising on it would make the alarm
    worthless within a week.
  */
  it("⚠ CONTROL — six days of silence with an empty board is a PARK, not a finding", () => {
    const verdict = judgeTeamSilence({
      nowMs: NOW,
      lastCommitMs: hoursAgo(24 * 6),
      takeable: 0,
      thresholdHours: 18,
    });
    expect(verdict.kind).toBe("parked");
    expect(teamSilenceExitCode(verdict)).toBe(0);
    expect(teamSilenceSentence(verdict)).toContain("a correct park");
  });

  it("raises when main has stood still with work on the board", () => {
    const verdict = judgeTeamSilence({
      nowMs: NOW,
      lastCommitMs: hoursAgo(24 * 6),
      takeable: 2,
      thresholdHours: 18,
    });
    expect(verdict.kind).toBe("stopped");
    /* 2 is the finding, as the house uses it — `gate-stall-check` and the desk
       sweep both exit 2 on theirs. */
    expect(teamSilenceExitCode(verdict)).toBe(2);
  });

  /*
    THE MEASURED SPECIMEN, at the real threshold rather than an invented one:
    the outage ran 2026-10-21 20:18 to 2026-10-27 13:36 local, and the first
    scheduled run a full threshold into it must raise.
  */
  it("⚠ the six-day outage raises at the shipped threshold, not only at a tuned one", () => {
    const verdict = judgeTeamSilence({
      nowMs: Date.parse("2026-10-22T20:18:00Z"),
      lastCommitMs: Date.parse("2026-10-21T20:18:00Z"),
      takeable: 1,
    });
    expect(TEAM_SILENCE_HOURS).toBeLessThan(24);
    expect(verdict.kind).toBe("stopped");
  });

  it("holds its tongue right up to the threshold and speaks just past it", () => {
    const just = (hours: number) => judgeTeamSilence({
      nowMs: NOW, lastCommitMs: hoursAgo(hours), takeable: 1, thresholdHours: 18,
    }).kind;
    expect(just(17.9)).toBe("moving");
    expect(just(18)).toBe("stopped");
  });

  /*
    ⚠ A COMMIT DATED IN THE FUTURE MUST NOT READ AS THE HEALTHIEST POSSIBLE
    ANSWER. A committer date is whatever the committing clock said, so a skewed
    one would make the elapsed hours NEGATIVE — and negative silence is below
    every threshold, which is the silent direction on the one input an outside
    clock controls.
  */
  it("⚠ CONTROL — a clock-skewed commit in the future does not manufacture health", () => {
    const verdict = judgeTeamSilence({
      nowMs: NOW,
      lastCommitMs: NOW + 48 * 3_600_000,
      takeable: 3,
      thresholdHours: 18,
    });
    expect(verdict.kind).toBe("moving");
    /* Clamped to zero rather than reported as -48. */
    expect(verdict.kind === "moving" ? verdict.hoursSilent : -1).toBe(0);
  });

  it("⚠ files nothing when either fact is unreadable — it can tell neither state", () => {
    const noCommit = judgeTeamSilence({ nowMs: NOW, lastCommitMs: null, takeable: 4 });
    expect(noCommit.kind).toBe("unreadable");
    expect(teamSilenceExitCode(noCommit)).toBe(1);

    const noBand = judgeTeamSilence({ nowMs: NOW, lastCommitMs: hoursAgo(100), takeable: null });
    expect(noBand.kind).toBe("unreadable");
    expect(teamSilenceExitCode(noBand)).toBe(1);
    expect(teamSilenceSentence(noBand)).toContain("cannot be told from");
  });
});

describe("takeableOrderedCards — asked of the cut's own owner, never re-derived", () => {
  it("counts a plain ordered card and holds a blocked one", () => {
    const count = takeableOrderedCards({
      cards: [
        { number: 1, labels: ["founder-ordered"] },
        { number: 2, labels: ["founder-ordered", "blocked"] },
        { number: 3, labels: ["founder-ordered", "parked"] },
      ],
      focusRung: null,
      board: cleanBoard(),
    });
    /*
      ONE of three. `blocked` and `parked` are two of the five walls
      `orderedBandHoldFor` folds, and the measured reason this asks the owner
      rather than testing a label itself is #1881: exactly one wall was asked
      there and a heading printed `8 ON OFFER` over a band the cutter held
      entirely.
    */
    expect(count).toBe(1);
  });

  it("⚠ holds a rung card when no rung is current, which makes this reader QUIETER", () => {
    const count = takeableOrderedCards({
      cards: [{ number: 9, labels: ["founder-ordered", "rung:N3"] }],
      focusRung: null,
      board: cleanBoard(),
    });
    expect(count).toBe(0);
  });

  /*
    ⚠ A PARTIALLY-READ BOARD REFUSES RATHER THAN COUNTING WHAT IT HAS, which is
    `cut-seat-batches.mts`'s own behaviour in the same condition. An unread
    board makes a card somebody is already building look free, so counting
    through it would INFLATE the takeable figure and raise on a team that is
    working perfectly well.
  */
  it("⚠ CONTROL — an unread board answers null, never a count", () => {
    const count = takeableOrderedCards({
      cards: [{ number: 1, labels: ["founder-ordered"] }],
      focusRung: null,
      board: buildBoard({
        openPullRequests: { unreadable: "gh pr list could not be read" },
        comments: [],
        notBuilt: new Set<number>(),
        nowMs: NOW,
      }),
    });
    expect(count).toBeNull();
  });
});

describe("readTeamSilence — both facts, from an injected gh", () => {
  /** A `gh` that answers each read by the first argument it recognises. */
  const fakeGh = (answers: {
    tip?: unknown;
    ordered?: unknown;
    prs?: unknown;
    comments?: unknown;
    notBuilt?: unknown;
  }) => (args: readonly string[]): string => {
    const line = args.join(" ");
    if (line.startsWith("api ")) {
      if (answers.tip === undefined) throw new Error("no commit");
      return JSON.stringify(answers.tip);
    }
    if (line.includes("--label founder-ordered")) return JSON.stringify(answers.ordered ?? []);
    if (line.includes("--label not-built")) return JSON.stringify(answers.notBuilt ?? []);
    if (line.startsWith("pr list")) return JSON.stringify(answers.prs ?? []);
    return JSON.stringify(answers.comments ?? []);
  };

  const tipAt = (iso: string) => ({ commit: { committer: { date: iso } } });

  it("reads the committer date off the tip WITHOUT --jq", () => {
    /*
      ⚠ THIS ARM IS A DRIVEN CORRECTION, NOT A PRECAUTION. The first cut asked
      `gh api … --jq .commit.committer.date`, and `gh` prints a jq string result
      UNQUOTED — so `JSON.parse` threw on a perfectly good answer, every road
      read `unreadable`, and the job would have failed every three hours forever
      while reporting it could not see the repository. Found by running the
      command against the live repository before the workflow existed.
    */
    const asked: string[] = [];
    const { verdict } = readTeamSilence({
      nowMs: NOW,
      gh: (args) => {
        asked.push(args.join(" "));
        return fakeGh({ tip: tipAt("2026-10-27T23:00:00Z") })(args);
      },
      ladder: null,
    });
    expect(verdict.kind).toBe("moving");
    const apiCall = asked.find((one) => one.startsWith("api "));
    expect(apiCall, "the tip was never asked for").toBeTruthy();
    expect(apiCall).not.toContain("--jq");
  });

  it("puts the two facts together into the finding", () => {
    const { verdict, sentence } = readTeamSilence({
      nowMs: NOW,
      gh: fakeGh({
        tip: tipAt("2026-10-21T20:18:00Z"),
        ordered: [{ number: 10, labels: [{ name: "founder-ordered" }] }],
      }),
      ladder: null,
    });
    expect(verdict.kind).toBe("stopped");
    expect(sentence).toContain("1 card(s) are on offer");
  });

  it("calls a long silence with an empty band a park", () => {
    const { verdict } = readTeamSilence({
      nowMs: NOW,
      gh: fakeGh({ tip: tipAt("2026-10-21T20:18:00Z"), ordered: [] }),
      ladder: null,
    });
    expect(verdict.kind).toBe("parked");
  });

  it("⚠ a gh that throws on the tip is unreadable, never a finding", () => {
    const { verdict } = readTeamSilence({
      nowMs: NOW,
      gh: fakeGh({ ordered: [{ number: 10, labels: [{ name: "founder-ordered" }] }] }),
      ladder: null,
    });
    expect(verdict.kind).toBe("unreadable");
    expect(teamSilenceExitCode(verdict)).toBe(1);
  });

  it("⚠ an unreadable ordered band is unreadable too — it cannot tell a park from a stall", () => {
    const { verdict } = readTeamSilence({
      nowMs: NOW,
      gh: (args) => {
        if (args.join(" ").includes("--label founder-ordered")) return "not json at all";
        return fakeGh({ tip: tipAt("2026-10-21T20:18:00Z") })(args);
      },
      ladder: null,
    });
    expect(verdict.kind).toBe("unreadable");
  });

  it("⚠ an unreadable PULL REQUEST list is unreadable too, through the board's own partial flag", () => {
    /* The board is how a live claim is ruled out; unread, it would make a card
       somebody is on look free and inflate the count. */
    const { verdict } = readTeamSilence({
      nowMs: NOW,
      gh: (args) => {
        if (args.join(" ").startsWith("pr list")) return "not json at all";
        return fakeGh({
          tip: tipAt("2026-10-21T20:18:00Z"),
          ordered: [{ number: 10, labels: [{ name: "founder-ordered" }] }],
        })(args);
      },
      ladder: null,
    });
    expect(verdict.kind).toBe("unreadable");
  });

  it("holds a rung card unless the ladder names its rung current", () => {
    const ordered = [{ number: 11, labels: [{ name: "founder-ordered" }, { name: "rung:N3" }] }];
    const silent = tipAt("2026-10-21T20:18:00Z");

    const held = readTeamSilence({
      nowMs: NOW,
      gh: fakeGh({ tip: silent, ordered }),
      ladder: [{ key: "N3", state: "queued" }],
    });
    expect(held.verdict.kind).toBe("parked");

    const open = readTeamSilence({
      nowMs: NOW,
      gh: fakeGh({ tip: silent, ordered }),
      ladder: [{ key: "N3", state: "current" }],
    });
    expect(open.verdict.kind).toBe("stopped");
  });
});
