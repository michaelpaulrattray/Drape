/**
 * The live desk's derivations (#1193) — pure functions over one reading.
 *
 * Each arm compares against the SHARED partition the sweep used to write the
 * snapshot, because the whole promise of the live page is that it and the
 * shift's tools read a label the same way. Where a rule has a ruling behind
 * it (the ordered band's sort, #718/#1006) the arm is a positive control on
 * that ruling, not a restatement of the code.
 */
import { describe, expect, it } from "vitest";
import { CREW_LADDER_GROUP_KEYS, pipelineGroupFor } from "../../shared/crewPipelineGroups";
import {
  cardsNamedIn,
  deriveLiveDesk,
  liveLadderCards,
  liveNextUp,
  livePullRequestState,
  livePullRequests,
  liveRecent,
} from "./liveDesk";
import type { LiveQueueItem, LiveQueueReading } from "./liveQueue";

function item(overrides: Partial<LiveQueueItem> & { number: number }): LiveQueueItem {
  return {
    title: `Card ${overrides.number}`,
    kind: "issue",
    status: "open",
    draft: false,
    labels: [],
    author: "shift",
    assignees: [],
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
    closedAt: null,
    mergedAt: null,
    holdReason: null,
    url: `https://github.com/x/y/issues/${overrides.number}`,
    ...overrides,
  };
}

const RUNGS = ["N1", "N2", "N3"];
const reading = (open: LiveQueueItem[], recent: LiveQueueItem[] = []): LiveQueueReading => ({
  readAt: "2026-09-25T00:00:00Z",
  open,
  recent,
  truncated: false,
});

describe("the ladder's cards", () => {
  it("is exactly the ladder population of the shared partition, on the rung its label names", () => {
    const rows = [
      item({ number: 10, labels: ["roadmap", "rung:N2"] }),
      item({ number: 11, labels: ["parked"] }),
      item({ number: 12, labels: ["design-unbuilt", "rung:N9"] }),
      item({ number: 13, labels: ["bug"] }),
      item({ number: 14, labels: ["founder-ordered"] }),
      item({ number: 15, labels: [] }),
      item({ number: 16, kind: "pr", labels: ["roadmap"] }),
    ];
    const cards = liveLadderCards(reading(rows), RUNGS);
    expect(cards).toEqual([
      { issueNumber: 10, title: "Card 10", kind: "roadmap", rung: "N2" },
      { issueNumber: 11, title: "Card 11", kind: "parked", rung: null },
      { issueNumber: 12, title: "Card 12", kind: "design-unbuilt", rung: null },
    ]);
    /* Control: the population is the shared partition's, not this file's. */
    for (const row of rows.filter((r) => r.kind === "issue")) {
      const inLadder = CREW_LADDER_GROUP_KEYS.includes(pipelineGroupFor(row.labels));
      expect(cards.some((c) => c.issueNumber === row.number)).toBe(inLadder);
    }
  });

  it("a rung the ladder does not hold is the honest remainder, never a guessed rung", () => {
    const cards = liveLadderCards(reading([item({ number: 1, labels: ["roadmap", "rung:N9"] })]), RUNGS);
    expect(cards[0]!.rung).toBeNull();
  });
});

describe("NEXT UP", () => {
  it("is the ordered band in his running order: order labels, then urgent, then oldest", () => {
    const rows = [
      item({ number: 5, labels: ["founder-ordered"], createdAt: "2026-09-01T00:00:00Z" }),
      item({ number: 6, labels: ["founder-ordered", "urgent"], createdAt: "2026-09-03T00:00:00Z" }),
      item({ number: 7, labels: ["founder-ordered", "order:2"], createdAt: "2026-09-04T00:00:00Z" }),
      item({ number: 8, labels: ["founder-ordered", "order:1"], createdAt: "2026-09-05T00:00:00Z" }),
      item({ number: 9, labels: ["founder-ordered"], createdAt: "2026-08-01T00:00:00Z" }),
      item({ number: 10, labels: ["urgent"] }),
      item({ number: 11, labels: ["founder-ordered"], status: "closed" }),
    ];
    expect(liveNextUp(reading(rows)).map((r) => r.issueNumber)).toEqual([8, 7, 6, 9, 5]);
  });

  it("a held card keeps its place and carries the label's state with the card's own reason", () => {
    const rows = [
      item({ number: 1, labels: ["founder-ordered", "blocked"], holdReason: "his frames" }),
      item({ number: 2, labels: ["founder-ordered", "awaiting-fable"] }),
      item({ number: 3, labels: ["founder-ordered"], holdReason: "a rotted line with no label" }),
    ];
    const items = liveNextUp(reading(rows));
    expect(items[0]).toEqual({ issueNumber: 1, title: "Card 1", urgent: false, held: { state: "blocked", because: "his frames" } });
    expect(items[1]).toEqual({ issueNumber: 2, title: "Card 2", urgent: false, held: { state: "fable" } });
    expect(items[2], "no label, no hold — the reason never outlives the state (#298)")
      .toEqual({ issueNumber: 3, title: "Card 3", urgent: false });
    for (const row of items) expect(row).not.toHaveProperty("rank");
  });
});

describe("open pull requests", () => {
  it("draft → building; a review label → held for the hand verdict; otherwise in the gate", () => {
    expect(livePullRequestState({ draft: true, labels: ["needs-fable"] })).toBe("draft");
    expect(livePullRequestState({ draft: false, labels: ["needs-fable"] })).toBe("held");
    expect(livePullRequestState({ draft: false, labels: ["founder-review"] })).toBe("held");
    expect(livePullRequestState({ draft: false, labels: ["bug"] })).toBe("gate");
  });

  it("names the cards a PR's title points at, newest-touched first, and only PRs", () => {
    const rows = [
      item({ number: 100, kind: "pr", title: "fix: rail (#1126) (#1190)", updatedAt: "2026-09-25T01:00:00Z" }),
      item({ number: 101, kind: "pr", title: "refactor: #1160 slice 3", updatedAt: "2026-09-25T02:00:00Z", labels: ["needs-fable"] }),
      item({ number: 1126, title: "the rail" }),
      item({ number: 1160, title: "retire", status: "closed" }),
    ];
    const prs = livePullRequests(reading(rows, [item({ number: 1160, status: "closed", closedAt: "2026-09-24T00:00:00Z" })]));
    expect(prs.map((p) => [p.number, p.state, p.cards])).toEqual([
      [101, "held", [1160]],
      [100, "gate", [1126]],
    ]);
  });
});

describe("cardsNamedIn", () => {
  it("reads #N tokens the reading knows and ignores numbers that are not cards", () => {
    const known = new Set([1126, 1160]);
    expect(cardsNamedIn("her answer (#1126) (#1190) and #1160 slice 3", known)).toEqual([1126, 1160]);
    expect(cardsNamedIn("no cards here 1126", known)).toEqual([]);
    expect(cardsNamedIn("#01126 leading zero", known)).toEqual([1126]);
    expect(cardsNamedIn("#11260 is a different number", known)).toEqual([]);
  });
});

describe("since you last looked", () => {
  it("is everything that finished, newest first, with the three outcomes told apart", () => {
    const recent = [
      item({ number: 50, kind: "pr", status: "merged", mergedAt: "2026-09-24T23:34:59Z", closedAt: "2026-09-24T23:34:59Z", title: "slice 3 (#1160)" }),
      item({ number: 51, status: "closed", closedAt: "2026-09-24T23:42:55Z", title: "N2: retire" }),
      item({ number: 52, kind: "pr", status: "closed", closedAt: "2026-09-24T20:00:00Z", title: "dup of 1107" }),
      item({ number: 53, status: "closed", closedAt: null }),
      item({ number: 54, status: "open" }),
    ];
    const rows = liveRecent(reading([item({ number: 1160, status: "closed" })], recent));
    expect(rows.map((r) => [r.number, r.outcome, r.at])).toEqual([
      [51, "closed", "2026-09-24T23:42:55Z"],
      [50, "merged", "2026-09-24T23:34:59Z"],
      [52, "closed-unmerged", "2026-09-24T20:00:00Z"],
    ]);
  });
});

describe("deriveLiveDesk", () => {
  it("stamps every list with the reading's instant and counts what is open", () => {
    const desk = deriveLiveDesk(reading([
      item({ number: 1, labels: ["roadmap"] }),
      item({ number: 2, kind: "pr" }),
      item({ number: 3, labels: ["founder-ordered"] }),
    ]), RUNGS);
    expect(desk.readAt).toBe("2026-09-25T00:00:00Z");
    expect(desk.ladderCards.readAt).toBe(desk.readAt);
    expect(desk.nextUp.readAt).toBe(desk.readAt);
    expect(desk.counts).toEqual({ openCards: 2, openPullRequests: 1, truncated: false });
    expect(desk.ladderCards.items.map((c) => c.issueNumber)).toEqual([1]);
    expect(desk.nextUp.items.map((c) => c.issueNumber)).toEqual([3]);
    expect(desk.pullRequests.map((p) => p.number)).toEqual([2]);
    expect(desk.closedCards).toEqual([]);
  });

  it("names the cards GitHub has closed inside the window, and never a PR", () => {
    const desk = deriveLiveDesk(reading([], [
      item({ number: 1126, status: "closed", closedAt: "2026-09-24T23:00:00Z" }),
      item({ number: 1190, kind: "pr", status: "merged", mergedAt: "2026-09-24T23:00:00Z" }),
      item({ number: 7, status: "closed", closedAt: "2026-09-24T22:00:00Z" }),
    ]), RUNGS);
    expect(desk.closedCards).toEqual([7, 1126]);
  });
});
