/**
 * ONE DIGEST PER PASS, AND ONE LINE PER CARD (#1281 requirement 3).
 *
 * The arms that matter are about what the digest may NOT say: it may not claim a
 * card became a pull request because a seat said so, and it may not print a
 * silent line for a card nothing happened to. Every outcome is derived from the
 * artifacts (`crewCardBuildState`), so the fixtures here are pull requests and
 * comments rather than seat reports.
 */
import { describe, expect, it } from "vitest";

import { passCardOutcome, renderPassDigest } from "../scripts/lib/seatPassDigest.mts";
import { buildBoard, factsFromRows } from "../scripts/lib/cardBuildState.mts";
import type { OpenPullRequest } from "../scripts/lib/cardClaimWarning.mts";

const NOW = Date.parse("2026-09-26T12:00:00Z");

/**
 * THE BOARD, BUILT BY THE REAL OWNER (#1094). A stubbed `phraseFor` would make
 * every arm below a test of the stub: the words are `crewCardBuildPhrase`'s and
 * the judgement is `crewCardBuildState`'s, which is the whole reason the digest
 * asks a board rather than reading pull requests itself.
 */
function commentRow(card: number, body: string, at: string) {
  return { issue_url: `https://api.github.com/repos/michaelpaulrattray/Drape/issues/${card}`, body, created_at: at };
}
function boardOf(prs: readonly OpenPullRequest[], rows: readonly unknown[] = []) {
  return buildBoard({ openPullRequests: prs, comments: factsFromRows(rows), nowMs: NOW });
}

const OPEN_PRS: readonly OpenPullRequest[] = [
  { number: 1350, title: "fix the roll (#300)", headRefName: "team/roll-300", isDraft: false, labels: [] },
  { number: 1351, title: "money", body: "for card #400", isDraft: false, labels: [{ name: "needs-fable" }] },
];
const BOARD = boardOf(OPEN_PRS, [commentRow(301, "CLAIMED — seat-1-20260926, 2026-09-26T11:30:00Z", "2026-09-26T11:30:00Z")]);

const base = {
  passStartedAt: "2026-09-26T10:00:00Z",
  finishedAt: "2026-09-26T12:00:00Z",
  seatCount: 2,
  focusCard: { number: 180, title: "the N2 card" },
  handout: [
    { number: 300, title: "a", seat: 1, area: "casting" },
    { number: 301, title: "b", seat: 1, area: "casting" },
    { number: 400, title: "c", seat: 2, area: "boards" },
  ],
  skipped: [{ number: 500, title: "d", why: "in NEXT UP — the focus lane's, never a seat's" }],
  board: BOARD,
  awaitingVerdict: [1351],
  jev: { asked: true, failure: null, readings: [], spendUsd: 0 },
};

describe("a card's outcome comes from the artifacts", () => {
  it("names the pull request that builds it", () => {
    expect(passCardOutcome(BOARD, 300)).toContain("PR #1350");
  });

  it("names who claimed it when there is no pull request", () => {
    expect(passCardOutcome(BOARD, 301)).toContain("claimed by seat-1-20260926");
  });

  it("says plainly that nothing was recorded rather than implying a failure", () => {
    expect(passCardOutcome(BOARD, 999)).toContain("nothing recorded");
  });

  it("does NOT read a pull request that merely cites the card", () => {
    /* `shared/crewCardBuildState.ts`'s narrow rule: a bare `#N` in a body is a
       citation. A digest that counted it would tell the relay a card was built
       because another PR quoted it. */
    const cited = passCardOutcome(
      boardOf([{ number: 1360, title: "something", body: "the law from #493 applies", headRefName: "team/x-77" }]),
      493,
    );
    expect(cited).toContain("nothing recorded");
  });
});

describe("the digest itself", () => {
  const digest = renderPassDigest(base);

  it("prints one line per card handed out, with its seat and area", () => {
    expect(digest).toContain("- #300 (seat 1, casting) → being built — PR #1350");
    expect(digest).toContain("- #400 (seat 2, boards) → waiting on review — PR #1351");
  });

  it("prints every card it did not hand out, with the reason", () => {
    expect(digest).toContain("- #500 — in NEXT UP");
  });

  it("names the focus lane's card beside the seats", () => {
    expect(digest).toContain("#180");
  });

  it("counts the pull requests waiting on the relay", () => {
    expect(digest).toContain("1 open pull request is held for the relay's verdict: #1351");
  });

  it("says so when Jev was unreachable rather than staying silent", () => {
    const mechanical = renderPassDigest({
      ...base,
      jev: { asked: true, failure: "getaddrinfo ENOTFOUND api.typesafe.ai", readings: [], spendUsd: 0 },
    });
    expect(mechanical).toContain("Jev was unreachable");
    expect(mechanical).toContain("mechanical facts alone");
  });

  it("records every Jev answer so the relay can audit it", () => {
    const audited = renderPassDigest({
      ...base,
      jev: {
        asked: true,
        failure: null,
        readings: [{ card: 301, question: "dependency", answer: "no", confidence: 0.91, used: true, note: "offered to a seat" }],
        spendUsd: 0.0002,
      },
    });
    expect(audited).toContain('#301 dependency: "no" at 0.91 — used');
    expect(audited).toContain("$0.0002");
  });

  it("names a seat that did not finish cleanly rather than hiding it", () => {
    const withFailure = renderPassDigest({ ...base, seatFailures: [{ seat: 2, why: "exited 1 with a 0-byte log" }] });
    expect(withFailure).toContain("seat 2 — exited 1 with a 0-byte log");
  });

  it("says plainly when a pass handed nothing out", () => {
    const empty = renderPassDigest({ ...base, seatCount: 0, handout: [], skipped: [], awaitingVerdict: [] });
    expect(empty).toContain("nothing was handed out this pass");
    expect(empty).toContain("No open pull request is held for a verdict");
  });
});
