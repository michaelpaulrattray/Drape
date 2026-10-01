/**
 * A FINDING IS NOT A PASS — the six hours PR #1649 cost (#1673).
 *
 * The relay posts two kinds of hand comment: *I read this and it is fine*, and
 * *I read this and here is what is wrong*. Until 2026-10-01 the readers had a
 * word for only the first, and the second wore the first's marker.
 *
 * **Measured, at the artifact.** The comment on PR #1649 at `2026-09-30T23:46Z`
 * was headed `**Fable review — by hand, FINDING (head …) — held; …`.
 * `isHandVerdict` read the prefix and stopped, so it classified as a FRESH
 * VERDICT: the build board printed *"passed and merging — PR #1649"* on every
 * pass from 23:46Z to 05:48Z while the pull request sat held, unrepaired and
 * then DIRTY, and every P1 card that builds on #1600 waited behind a card the
 * record called done. `pr-merge-in-order` would have merged on it.
 *
 * # ⚠ THE ARM THAT MATTERS MOST IS THE NEGATIVE ONE, AND IT IS THE WHOLE RISK
 *
 * A real verdict's BODY discusses its findings at length — that is what a
 * verdict is FOR, and `--acknowledge` exists because they must be read. A
 * reader scanning the whole comment for the word *finding* would classify every
 * genuine verdict as a hold and **nothing would ever merge again**. So the words
 * are read in the HEADER LINE and nowhere else, and the arms below drive a
 * verdict whose body says *finding* four times.
 *
 * # Both spellings, because an old comment must not flip
 *
 * The convention from today is `**Relay finding — HELD** (head …)` for a
 * finding and `**Fable review — by hand** (head …)` for a verdict. The
 * verdict-marked-and-HELD shape is still read as a finding, because that is
 * what the comments already on the record look like — #1649's own has since
 * been re-headed by hand, and the shape outlives the instance.
 */
import { describe, expect, it } from "vitest";

import {
  HAND_FINDING_MARKER,
  HAND_VERDICT_MARKER,
  isHandFinding,
  isHandVerdict,
} from "../shared/handVerdict";
import { crewCardBuildPhrase, crewCardCommentFact, handVerdictForPullRequest } from "../shared/crewCardBuildState";
import { classifyComment, reviewPresence, tallyRounds } from "../scripts/lib/reviewRounds.mts";

/**
 * PR #1649's comment as GitHub returned it, 2026-10-01 — the first line is the
 * fixture, verbatim from `gh api .../issues/1649/comments`, and the rest is the
 * shape of the body under it.
 */
const PR_1649_FINDING = [
  "**Fable review — by hand, FINDING (head `afb786b6`) — held; the census misses the tile face**",
  "",
  "The hover tooltip converts and the number on the tile's face does not, so a customer",
  "would read 240 on hover and 1,200 on the tile at the same moment.",
].join("\n");

/** The verdict that eventually landed on the same pull request, six hours later. */
const PR_1649_VERDICT = [
  "**Fable review — by hand** (head `0719270b`)",
  "",
  "The finding is answered. Four sabotage arms, each red. Merging.",
].join("\n");

const PR = {
  number: 1649,
  headRefName: "team/credit-display-1600",
  createdAt: "2026-09-30T20:00:00Z",
  headCommittedAt: "2026-10-01T06:02:00Z",
  ownerLogin: "michaelpaulrattray",
};

const comment = (body: string, createdAt: string, id = 1) => ({
  id,
  authorLogin: "michaelpaulrattray",
  createdAt,
  body,
});

describe("the comment that cost six hours", () => {
  it("reads #1649's real header as a FINDING, not a verdict", () => {
    expect(isHandFinding(PR_1649_FINDING)).toBe(true);
    expect(isHandVerdict(PR_1649_FINDING)).toBe(false);
  });

  it("reads the new convention's own header too, so a finding need not wear the marker", () => {
    const today = "**Relay finding — HELD** (head `afb786b6`)\n\nThe census misses the tile face.";
    expect(today.startsWith(HAND_FINDING_MARKER)).toBe(true);
    expect(isHandFinding(today)).toBe(true);
    expect(isHandVerdict(today)).toBe(false);
  });

  it("still reads a plain verdict as a verdict", () => {
    expect(isHandVerdict(PR_1649_VERDICT)).toBe(true);
    expect(isHandFinding(PR_1649_VERDICT)).toBe(false);
    expect(PR_1649_VERDICT.startsWith(HAND_VERDICT_MARKER)).toBe(true);
  });

  it("⚠ CONTROL — a verdict whose BODY discusses findings is still a verdict", () => {
    /* The expensive direction. A reader scanning the whole comment would hold
       every genuine verdict, and a verdict's findings are the reason
       `--acknowledge` exists. */
    const real = [
      "**Fable review — by hand** (head `0719270b`)",
      "",
      "Three findings, none blocking:",
      "1. The finding about the tile face is answered.",
      "2. A finding worth filing separately: the census is a fixed list of names.",
      "3. No finding on the money path. HELD nothing. Merging.",
    ].join("\n");
    expect(isHandFinding(real)).toBe(false);
    expect(isHandVerdict(real)).toBe(true);
  });

  it("⚠ CONTROL — a comment by any other account is neither", () => {
    expect(classifyComment({ ...comment(PR_1649_FINDING, "2026-10-01T06:10:00Z"), authorLogin: "a-seat" }, PR))
      .toBe("not-a-verdict");
  });
});

describe("the merge decision", () => {
  it("a finding on the current head classifies as a finding and holds the merge", () => {
    const tally = tallyRounds([comment(PR_1649_FINDING, "2026-10-01T06:10:00Z")], PR);
    expect(tally.findings.length).toBe(1);
    expect(tally.verdicts.length).toBe(0);
    /* ⚠ `reviewOwed: false` — a finding holds an ORDINARY pull request too. If
       the relay has said something is wrong, the repair is owed whatever triage
       thought about whether this diff earned a look. */
    expect(reviewPresence(tally, false)).toBe("finding");
    expect(reviewPresence(tally, true)).toBe("finding");
  });

  it("a finding NEVER counts toward the acknowledgement tally", () => {
    /* `verdictCount` in `pr-merge-in-order.mts` is `verdicts + stale`, and an
       `--acknowledge` is pinned to it. A finding raising that count would let a
       shift's "I read the verdict" absorb a hold nobody repaired. */
    const tally = tallyRounds(
      [comment(PR_1649_FINDING, "2026-10-01T06:10:00Z"), comment(PR_1649_FINDING, "2026-09-30T23:46:16Z", 2)],
      PR,
    );
    expect(tally.findings.length).toBe(1);
    expect(tally.staleFindings.length).toBe(1);
    expect(tally.verdicts.length + tally.stale.length).toBe(0);
  });

  it("a finding followed by a later fresh verdict MERGES — the normal road", () => {
    const tally = tallyRounds(
      [
        comment(PR_1649_FINDING, "2026-10-01T06:10:00Z", 1),
        comment(PR_1649_VERDICT, "2026-10-01T06:24:47Z", 2),
      ],
      PR,
    );
    expect(reviewPresence(tally, true)).toBe("verdict");
  });

  it("a verdict followed by a later finding on the SAME head does NOT", () => {
    /* The relay changing its mind. The newest hand comment is what decides. */
    const tally = tallyRounds(
      [
        comment(PR_1649_VERDICT, "2026-10-01T06:24:47Z", 1),
        comment(PR_1649_FINDING, "2026-10-01T07:00:00Z", 2),
      ],
      PR,
    );
    expect(reviewPresence(tally, true)).toBe("finding");
  });

  it("a tie goes to the finding — the two directions are not symmetric", () => {
    const at = "2026-10-01T06:24:47Z";
    const tally = tallyRounds([comment(PR_1649_VERDICT, at, 1), comment(PR_1649_FINDING, at, 2)], PR);
    expect(reviewPresence(tally, true)).toBe("finding");
  });

  it("a finding from BEFORE the head commit is stale — the repair was pushed", () => {
    expect(classifyComment(comment(PR_1649_FINDING, "2026-09-30T23:46:16Z"), PR)).toBe("stale-finding");
    const tally = tallyRounds([comment(PR_1649_FINDING, "2026-09-30T23:46:16Z")], PR);
    expect(reviewPresence(tally, true)).toBe("no-verdict");
    expect(reviewPresence(tally, false)).toBe("declined");
  });
});

describe("what the board says about it", () => {
  const fact = (body: string, at: string) => crewCardCommentFact({
    card: 1649,
    body,
    createdAt: at,
    authorLogin: "michaelpaulrattray",
    ownerLogin: "michaelpaulrattray",
  });

  it("reads a finding comment as a finding fact", () => {
    expect(fact(PR_1649_FINDING, "2026-09-30T23:46:16Z"))
      .toEqual({ kind: "finding", card: 1649, at: "2026-09-30T23:46:16Z" });
    expect(fact(PR_1649_VERDICT, "2026-10-01T06:24:47Z"))
      .toEqual({ kind: "verdict", card: 1649, at: "2026-10-01T06:24:47Z" });
  });

  it("⚠ the phrase that was wrong for six hours — it now names the work owed", () => {
    /* The board's bound is the pull request's own clock (it cannot afford a
       commit read per PR — `shared/handVerdict.ts` carries the measurement), so
       a finding stands while nothing has happened since. */
    const freshness = handVerdictForPullRequest({
      pullRequest: 1649,
      updatedAt: "2026-09-30T23:46:16Z",
      facts: [fact(PR_1649_FINDING, "2026-09-30T23:46:16Z")!],
    });
    expect(freshness).toBe("finding");
    expect(crewCardBuildPhrase(
      { kind: "pull-request", pullRequest: 1649, stage: "finding" },
      Date.parse("2026-10-01T06:00:00Z"),
    )).toBe("held on the relay's finding — repair owed — PR #1649");
  });

  it("a repair pushed after the finding lifts the hold and asks for a look", () => {
    /* The pull request's clock moving past the finding IS the repair, so the row
       goes back to waiting on review rather than staying held for ever. */
    expect(handVerdictForPullRequest({
      pullRequest: 1649,
      updatedAt: "2026-10-01T06:02:28Z",
      facts: [fact(PR_1649_FINDING, "2026-09-30T23:46:16Z")!],
    })).toBe("stale");
  });

  it("a later verdict wins over an earlier finding on the board too", () => {
    expect(handVerdictForPullRequest({
      pullRequest: 1649,
      updatedAt: "2026-10-01T06:24:47Z",
      facts: [
        fact(PR_1649_FINDING, "2026-09-30T23:46:16Z")!,
        fact(PR_1649_VERDICT, "2026-10-01T06:24:47Z")!,
      ],
    })).toBe("fresh");
  });

  it("⚠ and an earlier verdict NEVER wins over a later finding", () => {
    /* This is the shape the old reader could not express at all: it filtered to
       verdicts, so a finding posted after one was stepped over and the row read
       *passed and merging*. */
    expect(handVerdictForPullRequest({
      pullRequest: 1649,
      updatedAt: "2026-10-01T07:00:00Z",
      facts: [
        fact(PR_1649_VERDICT, "2026-10-01T06:24:47Z")!,
        fact(PR_1649_FINDING, "2026-10-01T07:00:00Z")!,
      ],
    })).toBe("finding");
  });
});
