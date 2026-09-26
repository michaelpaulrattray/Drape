/**
 * IS SOMEBODY ALREADY BUILDING THIS CARD — DRIVEN ON THE REAL ARTIFACTS (#1094).
 *
 * Every fixture in this file was captured at the wire on 2026-09-26: the eleven
 * open pull requests from GitHub's search API and the 222 comments filed in the
 * twelve hours before it shipped. The bodies are quoted, not imagined, because
 * the whole question this module answers is what the repository's own writing
 * looks like.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE CONTRAST WITH `findCardPullRequests`.**
 * The card ordering this work said to start from that reader, and it is the
 * right reader for a WARNING and the wrong one for his page. The arm below
 * proves the difference on a real body rather than asserting it: PR #1326 cites
 * #493, the wide reader says #493 is being built, and this one says nothing. If
 * that arm ever goes green in both directions, the narrowing has been lost.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_CLAIM_LIVE_MS,
  crewCardBuildPhrase,
  crewCardBuildState,
  crewCardBuildViews,
  crewCardCommentFact,
  indexCardBuilds,
  pullRequestBuildsCard,
} from "../shared/crewCardBuildState";
import { findCardPullRequests } from "../shared/crewShiftState";

/** PR #1326, as the search API returned it — its card and four it merely cites. */
const PR_1326 = {
  number: 1326,
  title: "The desk says one thing about a debt card, not two (#1248)",
  body: "**What he sees.** …\n\nThis is for card #1248 (closed by hand with its receipt).\n"
    + "The live desk (#1193) derives every list; #493 homed the orphan rows; #893 is the\n"
    + "blurb's own card; a conflicting PR fires no runs (#566).\n",
  draft: false,
  labels: [] as string[],
};

/** PR #1316 — its TITLE names no card at all, which is the point of the body limb. */
const PR_1316 = {
  number: 1316,
  title: "build(typecheck): the scripts check runs over the scripts the repository has",
  body: "Opened for card #1231 (closed by hand with its receipt). Replaces #1311, which was\n"
    + "born CONFLICTING (#566). The population is derived, per #335 and #1182.\n",
  draft: false,
  labels: [] as string[],
  headRefName: "team/scripts-typecheck-population-1231-r2",
};

describe("which card a pull request is building", () => {
  it("reads the card out of the title", () => {
    expect(pullRequestBuildsCard(PR_1326, 1248)).toEqual(["title", "body"]);
  });

  it("reads it out of the body's own `card #N` sentence when the title is silent", () => {
    /* The two of his five examples a title-only reader would have missed. */
    expect(pullRequestBuildsCard(PR_1316, 1231)).toEqual(["body", "branch"]);
  });

  it("⚠ a cited card is NOT a built card — and the wide reader disagrees, which is why this exists", () => {
    for (const cited of [1193, 493, 893, 566]) {
      expect(pullRequestBuildsCard(PR_1326, cited)).toEqual([]);
      /* THE CONTRAST, DRIVEN: the shift-facing warning fires on every one of
         these. A page that used it would tell him four cards were being built. */
      expect(findCardPullRequests([PR_1326], `#${cited}`)).toHaveLength(1);
    }
  });

  it("reads the branch's digit runs, and only a run that IS the number", () => {
    expect(pullRequestBuildsCard({ number: 9, headRefName: "team/slug-1231-r2" }, 1231)).toEqual(["branch"]);
    /* `2` is a real digit run in that branch and is not a card it builds. */
    expect(pullRequestBuildsCard({ number: 9, headRefName: "team/slug-1231-r2" }, 12310)).toEqual([]);
  });

  it("the title token is the product's one spelling — padded yes, contained no", () => {
    const of = (title: string, card: number) =>
      pullRequestBuildsCard({ number: 1, title }, card);
    expect(of("a fix (#01094)", 1094)).toEqual(["title"]);
    expect(of("a fix (#11094)", 1094)).toEqual([]);
    expect(of("a fix (#10940)", 1094)).toEqual([]);
  });

  it("a nonsense card number is never matched", () => {
    expect(pullRequestBuildsCard(PR_1326, 0)).toEqual([]);
    expect(pullRequestBuildsCard(PR_1326, -1248)).toEqual([]);
  });
});

/* ── The comments, quoted from the repository ── */
const CLAIM_BODY = "CLAIMED — seat-desk-2, 2026-09-26T02:15:15Z\n";
const REFUSAL_BODY = "**NOT BUILT — the card's measurement is wrong against the code, and the"
  + " prescription that follows from it would have been a capability change. Read at the bytes"
  + " by seat-janitor, 2026-09-26.**\n";
const RELEASE_BODY = "RELEASED — seat-desk-2 (the card's premise held but the tree had moved)\n";
/**
 * ⚠ THE ANCHOR'S OWN CONTROL, AND IT IS NOT A SOFT ONE. This card's fifth
 * comment QUOTES a claim inside a paragraph of prose, dash and seat and all —
 * which is the ordinary way a shift reports a collision. Un-anchor the parser
 * and this comment files a claim on #1094 that nobody made.
 */
const PROSE_BODY = "⚠ One thing worth noticing for whoever does take it: the shift posted"
  + " CLAIMED — foreman-20260923-0955, 00:12 and the relay opened its PR anyway — so a reader"
  + " that only looks at PRs and branches would have to look at COMMENTS to see this one.\n";

describe("what a comment on a card says", () => {
  it("a claim names its seat", () => {
    expect(crewCardCommentFact({ card: 1094, body: CLAIM_BODY, createdAt: "2026-09-26T02:15:15Z" }))
      .toEqual({ kind: "claim", card: 1094, seat: "seat-desk-2", at: "2026-09-26T02:15:15Z" });
  });

  it("a refusal is a refusal through its bold heading", () => {
    expect(crewCardCommentFact({ card: 1217, body: REFUSAL_BODY, createdAt: "2026-09-26T00:21:50Z" })?.kind)
      .toBe("refusal");
  });

  it("⚠ RELEASED is NOT a refusal — the card that ordered this work said it was, and the standing orders say otherwise", () => {
    expect(crewCardCommentFact({ card: 1094, body: RELEASE_BODY, createdAt: "2026-09-26T03:00:00Z" })?.kind)
      .toBe("release");
  });

  it("prose about claiming is not a claim — the anchor is the whole control", () => {
    expect(crewCardCommentFact({ card: 1094, body: PROSE_BODY, createdAt: "2026-09-23T00:52:31Z" }))
      .toBeNull();
  });

  it("an unusable row is nothing, never a fact", () => {
    expect(crewCardCommentFact({ card: 0, body: CLAIM_BODY, createdAt: "2026-09-26T02:15:15Z" })).toBeNull();
    expect(crewCardCommentFact({ card: 1094, body: CLAIM_BODY, createdAt: "" })).toBeNull();
  });
});

const NOW = Date.parse("2026-09-26T02:30:00Z");
const claim = (card: number, at: string, seat: string | null = "seat-desk") =>
  ({ kind: "claim", card, seat, at } as const);
const refusal = (card: number, at: string) => ({ kind: "refusal", card, at } as const);
const release = (card: number, at: string) => ({ kind: "release", card, at } as const);

describe("the one judgement", () => {
  it("an open pull request outranks every comment, because it cannot be stale", () => {
    expect(crewCardBuildState({
      card: 1248,
      openPullRequests: [PR_1326],
      facts: [claim(1248, "2026-09-26T00:21:00Z")],
      nowMs: NOW,
    })).toEqual({ kind: "pull-request", pullRequest: 1326, stage: "gate" });
  });

  it("a held pull request says it is waiting on review, and a draft that it is unfinished", () => {
    const base = { card: 1248, facts: [], nowMs: NOW };
    expect(crewCardBuildState({ ...base, openPullRequests: [{ ...PR_1326, labels: ["needs-fable"] }] }))
      .toMatchObject({ stage: "review" });
    expect(crewCardBuildState({ ...base, openPullRequests: [{ ...PR_1326, draft: true }] }))
      .toMatchObject({ stage: "draft" });
  });

  it("⚠ the NEWEST comment wins — #1217 was claimed at 00:18 and refused at 00:21", () => {
    expect(crewCardBuildState({
      card: 1217,
      openPullRequests: [],
      facts: [claim(1217, "2026-09-26T00:18:00Z"), refusal(1217, "2026-09-26T00:21:50Z")],
      nowMs: NOW,
    })).toEqual({ kind: "refused", at: "2026-09-26T00:21:50Z" });
  });

  it("a release after a claim puts the card back on offer", () => {
    expect(crewCardBuildState({
      card: 1094,
      openPullRequests: [],
      facts: [claim(1094, "2026-09-26T00:18:00Z"), release(1094, "2026-09-26T01:00:00Z")],
      nowMs: NOW,
    })).toBeNull();
  });

  it("a claim older than the standing orders' twelve hours is not live", () => {
    const stale = new Date(NOW - CREW_CLAIM_LIVE_MS - 1_000).toISOString();
    const live = new Date(NOW - CREW_CLAIM_LIVE_MS + 60_000).toISOString();
    expect(crewCardBuildState({ card: 7, openPullRequests: [], facts: [claim(7, stale)], nowMs: NOW })).toBeNull();
    expect(crewCardBuildState({ card: 7, openPullRequests: [], facts: [claim(7, live)], nowMs: NOW }))
      .toMatchObject({ kind: "claimed" });
  });

  it("another card's facts are another card's", () => {
    expect(crewCardBuildState({
      card: 493,
      openPullRequests: [PR_1326],
      facts: [claim(1248, "2026-09-26T02:00:00Z")],
      nowMs: NOW,
    })).toBeNull();
  });

  it("a card nobody is on has no state at all — the quiet row", () => {
    expect(crewCardBuildState({ card: 999, openPullRequests: [PR_1326], facts: [], nowMs: NOW })).toBeNull();
  });
});

describe("the phrase his page draws", () => {
  it("says what is happening, in his words, with the PR named", () => {
    expect(crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1316, stage: "gate" }, NOW))
      .toBe("being built — PR #1316");
    expect(crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1326, stage: "review" }, NOW))
      .toBe("waiting on review — PR #1326");
    expect(crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1326, stage: "draft" }, NOW))
      .toBe("being written — PR #1326");
    expect(crewCardBuildPhrase({ kind: "refused", at: "2026-09-26T00:21:50Z" }, NOW))
      .toBe("not built — the reason is on the card");
  });

  it("a claim names the seat and how long ago, and the first hour says so in words", () => {
    expect(crewCardBuildPhrase({ kind: "claimed", seat: "seat-desk-2", at: "2026-09-26T02:15:00Z" }, NOW))
      .toBe("claimed by seat-desk-2, under an hour ago");
    expect(crewCardBuildPhrase({ kind: "claimed", seat: "seat-atlas", at: "2026-09-25T23:30:00Z" }, NOW))
      .toBe("claimed by seat-atlas, 3 h ago");
    expect(crewCardBuildPhrase({ kind: "claimed", seat: null, at: "2026-09-25T23:30:00Z" }, NOW))
      .toBe("claimed 3 h ago");
  });

  it("no phrase carries a term of art from the pipeline", () => {
    const phrases = [
      crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1, stage: "gate" }, NOW),
      crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1, stage: "review" }, NOW),
      crewCardBuildPhrase({ kind: "refused", at: "2026-09-26T00:00:00Z" }, NOW),
      crewCardBuildPhrase({ kind: "claimed", seat: "s", at: "2026-09-26T02:00:00Z" }, NOW),
    ];
    for (const phrase of phrases) {
      expect(phrase.length).toBeLessThanOrEqual(42);
      expect(phrase).not.toMatch(/gate|merge queue|mergeable|CONFLICTING|label|scope/i);
    }
  });
});

describe("the list that travels, and the lookup the page does", () => {
  it("only the cards with something to say, lowest number first", () => {
    const views = crewCardBuildViews({
      cards: [1326, 493, 1248, 1217, 999],
      openPullRequests: [PR_1326, PR_1316],
      facts: [refusal(1217, "2026-09-26T00:21:50Z")],
      nowMs: NOW,
    });
    expect(views.map((view) => view.issueNumber)).toEqual([1217, 1248]);
    expect(indexCardBuilds(views).get(1248)).toBe("being built — PR #1326");
    expect(indexCardBuilds(views).get(493)).toBeUndefined();
  });

  it("the lowest-numbered open pull request is the one named when two are open", () => {
    const replacement = { ...PR_1316, number: 1400 };
    expect(crewCardBuildState({
      card: 1231, openPullRequests: [replacement, PR_1316], facts: [], nowMs: NOW,
    })).toMatchObject({ pullRequest: 1316 });
  });
});
