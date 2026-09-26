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
import { CREW_PIPELINE_GROUPS } from "../../shared/crewPipelineGroups";
import { CREW_WORK_CATEGORIES } from "../../shared/crewWorkSwitches";
import {
  cardsNamedIn,
  deriveLiveDesk,
  ladderNoteFor,
  liveLadderCards,
  liveWorkCounts,
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
    /* #1094 — a pull request keeps its body server-side; a card never does. */
    body: null,
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
      { issueNumber: 10, title: "Card 10", kind: "roadmap", rung: "N2", note: null },
      { issueNumber: 11, title: "Card 11", kind: "parked", rung: null, note: null },
      { issueNumber: 12, title: "Card 12", kind: "design-unbuilt", rung: null, note: null },
    ]);
    /* Control: the population is the shared partition's, not this file's. */
    for (const row of rows.filter((r) => r.kind === "issue")) {
      const inLadder = CREW_LADDER_GROUP_KEYS.includes(pipelineGroupFor(row.labels));
      expect(cards.some((c) => c.issueNumber === row.number)).toBe(inLadder);
    }
  });

  it("⚠ a blocked card on a rung stays ON the rung and says so — his ruling 2026-09-25 (#1199)", () => {
    const cards = liveLadderCards(reading([
      item({ number: 1129, labels: ["blocked", "rung:N2"] }),
      item({ number: 1125, labels: ["debt", "rung:N3"] }),
      item({ number: 1121, labels: ["blocked", "rung:N1"] }),
    ]), RUNGS);
    expect(cards.map((c) => [c.issueNumber, c.kind, c.rung, c.note])).toEqual([
      [1121, "rung", "N1", "blocked"],
      [1125, "rung", "N3", "debt"],
      [1129, "rung", "N2", "blocked"],
    ]);
    expect(ladderNoteFor(["awaiting-fable"])).toBe("needs fable");
    expect(ladderNoteFor(["roadmap"])).toBeNull();
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

describe("the switch counts and the groups, live (#1199)", () => {
  const rows = [
    item({ number: 1, labels: ["bug"], createdAt: "2026-09-01T00:00:00Z" }),
    item({ number: 2, labels: ["bug", "founder-ordered"], createdAt: "2026-09-02T00:00:00Z" }),
    item({ number: 3, labels: ["bug", "blocked"], createdAt: "2026-09-03T00:00:00Z" }),
    item({ number: 4, labels: ["bug"], createdAt: "2026-09-04T00:00:00Z", title: "the rail" }),
    item({ number: 5, labels: ["seat:retro", "debt"] }),
    item({ number: 6, labels: ["blocked", "rung:N2"] }),
    item({ number: 7, labels: ["debt"] }),
    item({ number: 8, labels: [] }),
    item({ number: 9, kind: "pr", labels: ["bug"] }),
  ];
  const merged = [item({ number: 90, kind: "pr", status: "merged", mergedAt: "2026-09-24T00:00:00Z", closedAt: "2026-09-24T00:00:00Z", title: "fix: the rail (#4)" })];
  const work = liveWorkCounts(reading(rows, merged));

  it("a switch count is the OFFERED population, with what left it named, newest first, and a merged PR flags a card", () => {
    const bugs = work.counts.find((c) => c.categoryKey === "bugs")!;
    expect(bugs.openCount).toBe(2);
    expect(bugs.excluded).toEqual({ ordered: 1, blocked: 1 });
    expect(bugs.titles.map((t) => t.number)).toEqual([4, 1]);
    expect(bugs.possiblyDone).toEqual({ count: 1, cards: [4] });
    expect(bugs.countedAt.toISOString()).toBe("2026-09-25T00:00:00.000Z");
    const process = work.counts.find((c) => c.categoryKey === "process")!;
    expect(process.openCount).toBe(1);
    expect(process.excluded).toEqual({});
  });

  it("every category and every group is written, at zero too — a row must never vanish (#277)", () => {
    expect(work.counts.map((c) => c.categoryKey)).toEqual(CREW_WORK_CATEGORIES.map((c) => c.key));
    expect(work.groups.map((g) => g.groupKey)).toEqual(CREW_PIPELINE_GROUPS.map((g) => g.key));
  });

  it("the groups file every open card once and sum to the queue — the sweep's own control", () => {
    const byKey = new Map(work.groups.map((g) => [g.groupKey, g.openCount]));
    expect(byKey.get("switched")).toBe(5);
    expect(byKey.get("rung")).toBe(1);
    expect(byKey.get("debt")).toBe(1);
    expect(byKey.get("unfiled")).toBe(1);
    expect(byKey.get("blocked")).toBe(0);
    const sum = work.groups.reduce((total, g) => total + g.openCount, 0);
    expect(sum).toBe(rows.filter((r) => r.kind === "issue").length);
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
    expect(desk.finishedLadder).toEqual([]);
  });

  it("names the ladder cards that finished in the window, on their rung, newest first (#1201)", () => {
    const desk = deriveLiveDesk(reading([], [
      item({ number: 203, status: "closed", closedAt: "2026-09-24T20:00:00Z", labels: ["roadmap", "rung:N2"], title: "retire the two paths" }),
      item({ number: 1160, status: "closed", closedAt: "2026-09-24T23:42:00Z", labels: ["rung:N2"], title: "retire the segment pair" }),
      item({ number: 1126, status: "closed", closedAt: "2026-09-24T23:00:00Z", labels: ["bug"] }),
      item({ number: 5, status: "closed", closedAt: "2026-09-24T22:00:00Z", labels: ["parked"] }),
    ]), RUNGS);
    expect(desk.finishedLadder).toEqual([
      { issueNumber: 1160, title: "retire the segment pair", rung: "N2", closedAt: "2026-09-24T23:42:00Z" },
      { issueNumber: 5, title: "Card 5", rung: null, closedAt: "2026-09-24T22:00:00Z" },
      { issueNumber: 203, title: "retire the two paths", rung: "N2", closedAt: "2026-09-24T20:00:00Z" },
    ]);
  });
});

describe("a card with two work labels is drawn and counted ONCE (his question, 2026-09-25)", () => {
  const rows = [
    item({ number: 1221, labels: ["bug", "casting-upkeep"], title: "strips her tattoos" }),
    item({ number: 1187, labels: ["bug", "small-fix"], title: "capped at 701px" }),
    item({ number: 1218, labels: ["casting-upkeep", "rung:N2"], title: "a fourth axis" }),
    item({ number: 1183, labels: ["small-fix"], title: "born-held race" }),
  ];
  const work = liveWorkCounts(reading(rows, []));
  const numbersUnder = (key: string) => work.counts.find((c) => c.categoryKey === key)!.titles.map((t) => t.number);

  it("homes the double-labelled card under Bugs and NOT under the second category", () => {
    expect(numbersUnder("bugs")).toEqual([1221, 1187]);
    expect(numbersUnder("castingUpkeep")).toEqual([1218]);
    expect(numbersUnder("smallFixes")).toEqual([1183]);
    expect(work.counts.find((c) => c.categoryKey === "bugs")!.openCount).toBe(2);
    expect(work.counts.find((c) => c.categoryKey === "castingUpkeep")!.openCount).toBe(1);
  });

  it("GUARD — no card number appears under two categories, and the category counts sum to the number of labelled cards", () => {
    const seen = new Map<number, string[]>();
    for (const count of work.counts) {
      for (const title of count.titles) seen.set(title.number, [...(seen.get(title.number) ?? []), count.categoryKey]);
    }
    for (const [number, homes] of seen) expect(homes, `#${number} is drawn under ${homes.join(" and ")}`).toHaveLength(1);
    expect(work.counts.reduce((sum, c) => sum + c.openCount, 0)).toBe(rows.length);
  });

  it("CONTROL — the same reader would have seen the double-up: counting by label alone finds #1221 in two populations", () => {
    const byLabel = (label: string) => rows.filter((row) => row.labels.includes(label)).map((row) => row.number);
    expect(byLabel("bug")).toContain(1221);
    expect(byLabel("casting-upkeep")).toContain(1221);
  });
});

describe("the cards still held on him — his question 2026-09-25, \"do i need to reply to these?\"", () => {
  it("names the OPEN cards carrying the hold label, never a closed one and never a PR", () => {
    const desk = deriveLiveDesk(reading([
      item({ number: 1208, labels: ["founder-ordered", "blocked", "rung:N2"] }),
      item({ number: 1220, labels: ["bug", "urgent"] }),
      item({ number: 1210, labels: ["blocked"] }),
      item({ number: 1211, kind: "pr", labels: ["blocked"] }),
    ], [
      item({ number: 1207, status: "closed", closedAt: "2026-09-25T04:55:00Z", labels: ["blocked"] }),
    ]), RUNGS);
    expect(desk.heldCards).toEqual([1208, 1210]);
    expect(desk.closedCards).toEqual([1207]);
  });

  it("CONTROL — the label it reads is the hold vocabulary's, not a second spelling", () => {
    const desk = deriveLiveDesk(reading([item({ number: 5, labels: ["BLOCKED", "awaiting-fable"] })]), RUNGS);
    expect(desk.heldCards).toEqual([]);
  });
});

describe("what is already happening to each card — his order 2026-09-26, \"so the desk shows whats built\"", () => {
  /* The measured instance: five cards on his Background Work panel, every one
     with a pull request in the queue or a refusal written on it, all five
     offered to him as tonight's work. */
  const openCards = [
    item({ number: 1231, labels: ["seat:janitor"] }),
    item({ number: 1217, labels: ["seat:janitor"] }),
    item({ number: 1258, labels: ["seat:retro"] }),
    item({ number: 1248, labels: ["seat:retro"] }),
    item({ number: 1288, labels: ["casting-upkeep"] }),
    item({ number: 493, labels: ["seat:retro"] }),
  ];
  const openPrs = [
    /* Its title names no card at all — the body's `card #N` is the only road. */
    item({
      number: 1316, kind: "pr",
      title: "build(typecheck): the scripts check runs over the scripts the repository has",
      body: "Opened for card #1231 (closed by hand with its receipt). Replaces #1311 (#566).",
    }),
    item({
      number: 1326, kind: "pr",
      title: "The desk says one thing about a debt card, not two (#1248)",
      body: "For card #1248. The live desk (#1193) derives every list; #493 homed the orphan rows (#566).",
      labels: ["needs-fable"],
    }),
  ];
  const facts = [
    { kind: "refusal" as const, card: 1217, at: "2026-09-26T00:21:50Z" },
    { kind: "claim" as const, card: 1288, seat: "seat-casting", at: "2026-09-26T01:09:00Z" },
  ];
  const now = reading([]).readAt;

  it("names the pull request, the refusal and the live claim — and nothing for a card nobody is on", () => {
    const desk = deriveLiveDesk(
      { ...reading([...openCards, ...openPrs]), readAt: "2026-09-26T02:30:00Z" },
      RUNGS,
      { facts, why: null },
    );
    expect(desk.builds.items).toEqual([
      { issueNumber: 1217, phrase: "not built — the reason is on the card" },
      { issueNumber: 1231, phrase: "being built — PR #1316" },
      { issueNumber: 1248, phrase: "waiting on review — PR #1326" },
      { issueNumber: 1288, phrase: "claimed by seat-casting, 1 h ago" },
    ]);
    expect(desk.builds.commentsWhy).toBeNull();
    expect(now).toBe("2026-09-25T00:00:00Z");
  });

  it("⚠ #493 is CITED by PR #1326 and is not being built — the row stays quiet", () => {
    const desk = deriveLiveDesk(
      { ...reading([...openCards, ...openPrs]), readAt: "2026-09-26T02:30:00Z" },
      RUNGS,
      { facts, why: null },
    );
    expect(desk.builds.items.map((row) => row.issueNumber)).not.toContain(493);
    /* CONTROL — the derivation DID look at that PR's body, so the silence is a
       judgement rather than an unread field. */
    expect(desk.builds.items.map((row) => row.issueNumber)).toContain(1248);
  });

  it("no comment read means no comment phrases and a reason on the panel — never a quiet board", () => {
    const desk = deriveLiveDesk(
      { ...reading([...openCards, ...openPrs]), readAt: "2026-09-26T02:30:00Z" },
      RUNGS,
      { facts: [], why: "GitHub answered 403 (rate limited)" },
    );
    /* The pull requests ride the queue, so they survive; the claim and the
       refusal do not, and the panel is told why. */
    expect(desk.builds.items.map((row) => row.issueNumber)).toEqual([1231, 1248]);
    expect(desk.builds.commentsWhy).toBe("GitHub answered 403 (rate limited)");
  });

  it("CONTROL — a caller that passes no activity at all says so rather than claiming a clean board", () => {
    const desk = deriveLiveDesk(reading([item({ number: 7, labels: ["bug"] })]), RUNGS);
    expect(desk.builds.items).toEqual([]);
    expect(desk.builds.commentsWhy).not.toBeNull();
  });

  it("a MERGED pull request is not an open one — a landed card is not still being built", () => {
    const desk = deriveLiveDesk({
      ...reading(
        [item({ number: 1231, labels: ["seat:janitor"] })],
        [item({
          number: 1316, kind: "pr", status: "merged", mergedAt: "2026-09-26T01:00:00Z",
          closedAt: "2026-09-26T01:00:00Z", body: "for card #1231",
        })],
      ),
      readAt: "2026-09-26T02:30:00Z",
    }, RUNGS, { facts: [], why: null });
    expect(desk.builds.items).toEqual([]);
  });
});
