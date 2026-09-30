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
  CREW_NOT_BUILT_LABEL,
  buildStateHoldsOffOffer,
  handVerdictForPullRequest,
  crewCardBuildPhrase,
  crewCardBuildState,
  crewCardBuildViews,
  crewCardCommentFact,
  isNotBuiltLabelled,
  notBuiltCards,
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

  /*
    ── #180's OWN COMMENT BODIES, QUOTED (#1559) ────────────────────────────

    The card ordering this work asked for exactly these: the real bodies, both
    directions, with the negative control kept. #180 was released at 18:19Z on
    2026-09-29 and read as `claimed` until the next morning — every seat pass in
    between stepped over a founder-ordered N2 card that nobody was on.

    The shift wrote precisely what the standing orders ask for. What could not
    read it is that `RELEASE_RE` carried no `m` flag, so `^` meant the start of
    the whole comment and a release under a heading was invisible.
  */
  const RELEASE_UNDER_HEADING = [
    "## SLICE 5 IS SHIPPED — `a5576571` (PR #1520). The retirement is finished.",
    "",
    "**RELEASED — Foreman (night shift), 2026-09-29T18:19Z.** The body now leads with",
    "what shipped and what is left, so the next shift does not open this card looking",
    "for machinery to remove.",
    "",
    "### What slice 5 turned out to be",
    "",
    "Not paperwork.",
    "",
  ].join("\n");

  /* #180's OTHER missed release, three days earlier and the same shape — so the
     defect had already cost a pass before the one that was noticed. */
  const RELEASE_UNDER_HEADING_EARLIER = [
    "## Read at the code, and the card's premise holds.",
    "",
    "**RELEASED — Foreman (night shift), 2026-09-26.** Nothing was built on this card.",
    "",
  ].join("\n");

  /*
    ⚠ THE NEGATIVE CONTROL THE CARD NAMED, and it guards the expensive
    direction. A missed release idles a seat; a FALSE release cancels a live
    claim and two seats build the same card. This is a shift reporting on a
    release in ordinary prose — the word, the dash and a seat name all present,
    mid-sentence — and it must stay nothing at all.
  */
  const RELEASE_PROSE = [
    "⚠ Worth knowing for whoever takes this: the previous shift posted",
    "RELEASED — Foreman (night shift) on #1492 while its part 2 was still held, so a",
    "reader that treats any mention of RELEASED as a handback would have reopened a",
    "card that was never free.",
    "",
  ].join("\n");

  it("⚠ reads a RELEASE written under a heading — #180's own body, the twelve hours this cost", () => {
    expect(crewCardCommentFact({ card: 180, body: RELEASE_UNDER_HEADING, createdAt: "2026-09-29T18:19:46Z" }))
      .toEqual({ kind: "release", card: 180, at: "2026-09-29T18:19:46Z" });
    expect(crewCardCommentFact({ card: 180, body: RELEASE_UNDER_HEADING_EARLIER, createdAt: "2026-09-26T11:46:34Z" })?.kind)
      .toBe("release");
  });

  it("and prose ABOUT releasing is still not a release — the direction that would cost a collision", () => {
    expect(crewCardCommentFact({ card: 180, body: RELEASE_PROSE, createdAt: "2026-09-30T02:00:00Z" }))
      .toBeNull();
  });

  it("reads a claim, a release and a refusal through ordinary block decoration", () => {
    /* The three matchers share one population now, so each is driven through the
       same decoration rather than one being assumed to follow the others. */
    const through = (body: string) =>
      crewCardCommentFact({ card: 180, body, createdAt: "2026-09-30T02:00:00Z" })?.kind;
    expect(through(["Some prose first.", "", "> CLAIMED — seat-desk-2, 02:15Z", ""].join("\n"))).toBe("claim");
    expect(through(["Some prose first.", "", "- **RELEASED — seat-desk-2**", ""].join("\n"))).toBe("release");
    expect(through(["Some prose first.", "", "### NOT BUILT — the premise is wrong at the code", ""].join("\n"))).toBe("refusal");
    /* And the seat still comes back off a decorated claim line. */
    expect(crewCardCommentFact({
      card: 180,
      body: ["## Handover", "", "> CLAIMED — seat-desk-2, 02:15Z", ""].join("\n"),
      createdAt: "2026-09-30T02:00:00Z",
    })).toEqual({ kind: "claim", card: 180, seat: "seat-desk-2", at: "2026-09-30T02:00:00Z" });
  });

  it("keeps the precedence a body carrying two of them always had", () => {
    /* Refusal beats release beats claim whatever order the LINES are in — the
       old reader asked the whole body in that order, and this must not have
       quietly become "whichever line comes first". */
    const body = ["> CLAIMED — seat-desk-2, 02:15Z", "", "## NOT BUILT — read at the bytes", ""].join("\n");
    expect(crewCardCommentFact({ card: 180, body, createdAt: "2026-09-30T02:00:00Z" })?.kind).toBe("refusal");
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

/**
 * THE `not-built` LABEL — a refusal's durable home (#1337).
 *
 * His word, 2026-09-29, on *"should a refused card stay open with a mark on it,
 * or close?"*: **A**. So the label had to become a fact the judgement reads, and
 * the whole of what is interesting is WHERE IT SITS: the comment facts are dated
 * and the label is not, so it cannot join the newest-wins sort and is instead the
 * answer everything else falls through to.
 *
 * ⚠ **THE TWO ARMS THAT MATTER ARE THE FALL-THROUGHS.** Before this card a
 * RELEASE and a STALE CLAIM both answered `null` — *ordinary untouched work* —
 * and that was correct while a refusal was only ever a comment newer than them.
 * With a mark that does not age out, answering `null` over it is the defect.
 */
describe("the refusal label", () => {
  const base = { card: 1217, openPullRequests: [] as const, nowMs: NOW };

  it("⚠ a labelled card with NO comment at all reads refused — the window's floor, closed", () => {
    /* This is the case the paged comment reader could never answer: the refusal
       is months old, nobody re-commented, and the listing has moved past it. */
    expect(crewCardBuildState({ ...base, facts: [], notBuilt: new Set([1217]) }))
      .toEqual({ kind: "refused", at: null });
    /* THE NEGATIVE CONTROL: without the label the very same call is a quiet row,
       so the arm above is not passing on something else. */
    expect(crewCardBuildState({ ...base, facts: [], notBuilt: new Set([9999]) })).toBeNull();
    /* And a caller that never read the labels behaves as it did before #1337. */
    expect(crewCardBuildState({ ...base, facts: [] })).toBeNull();
  });

  it("⚠ A LIVE CLAIM OUTRANKS THE LABEL — somebody's hands are on it right now", () => {
    const live = new Date(NOW - 60 * 60 * 1000).toISOString();
    expect(crewCardBuildState({ ...base, facts: [claim(1217, live)], notBuilt: new Set([1217]) }))
      .toMatchObject({ kind: "claimed", seat: "seat-desk" });
  });

  it("⚠ A RELEASE FALLS THROUGH TO THE LABEL rather than erasing it", () => {
    /* A release cancels a CLAIM. It has never been a withdrawal of a refusal, and
       reading it as one would let a released card read as untouched work over a
       mark nobody removed. */
    expect(crewCardBuildState({
      ...base,
      facts: [claim(1217, "2026-09-26T00:18:00Z"), release(1217, "2026-09-26T01:00:00Z")],
      notBuilt: new Set([1217]),
    })).toEqual({ kind: "refused", at: null });
  });

  it("⚠ A CLAIM THAT AGED OUT FALLS THROUGH TO THE LABEL TOO", () => {
    const stale = new Date(NOW - CREW_CLAIM_LIVE_MS - 1_000).toISOString();
    expect(crewCardBuildState({ ...base, facts: [claim(1217, stale)], notBuilt: new Set([1217]) }))
      .toEqual({ kind: "refused", at: null });
    /* Unlabelled, the same stale claim is still nothing — the pre-#1337 answer. */
    expect(crewCardBuildState({ ...base, facts: [claim(1217, stale)] })).toBeNull();
  });

  it("a comment refusal keeps its OWN timestamp; the label has none to keep", () => {
    expect(crewCardBuildState({
      ...base,
      facts: [refusal(1217, "2026-09-26T00:21:50Z")],
      notBuilt: new Set([1217]),
    })).toEqual({ kind: "refused", at: "2026-09-26T00:21:50Z" });
  });

  it("an open pull request still outranks the label — the artifact that cannot be stale", () => {
    expect(crewCardBuildState({
      card: 1248,
      openPullRequests: [PR_1326],
      facts: [],
      notBuilt: new Set([1248]),
      nowMs: NOW,
    })).toMatchObject({ kind: "pull-request" });
  });

  it("⚠ THE LABEL DOES NOT WITHHOLD THE CARD — his ruling was A, not B", () => {
    /* B was "it closes". A is "it stays open with a mark", and the mark must
       therefore leave the card takeable: a shift reads the reason and decides. */
    const state = crewCardBuildState({ ...base, facts: [], notBuilt: new Set([1217]) });
    expect(buildStateHoldsOffOffer(state)).toBe(false);
    expect(crewCardBuildPhrase(state!, NOW)).toBe("not built — the reason is on the card");
  });

  it("the spelling has ONE owner, and the set is derived from the rows", () => {
    expect(CREW_NOT_BUILT_LABEL).toBe("not-built");
    expect(isNotBuiltLabelled(["seat:retro", CREW_NOT_BUILT_LABEL])).toBe(true);
    expect(isNotBuiltLabelled(["seat:retro"])).toBe(false);
    expect(isNotBuiltLabelled(undefined)).toBe(false);
    /* The shape both `gh issue list --json number,labels` and the Desk's live
       reading carry, so no caller shapes it and two cannot shape it differently. */
    expect([...notBuiltCards([
      { number: 1217, labels: ["not-built", "seat:janitor"] },
      { number: 1218, labels: ["seat:janitor"] },
      { number: 0, labels: ["not-built"] },
      { labels: ["not-built"] },
    ])]).toEqual([1217]);
  });

  it("the views carry it too, so his page and a shift read one phrase", () => {
    const views = crewCardBuildViews({
      cards: [1217, 1218],
      openPullRequests: [],
      facts: [],
      notBuilt: new Set([1217]),
      nowMs: NOW,
    });
    expect(views).toEqual([{ issueNumber: 1217, phrase: "not built — the reason is on the card" }]);
  });
});

/**
 * ⚠ **HIS DESK CORRECTION, 2026-09-26: A PULL REQUEST THE RELAY HAS ALREADY READ
 * WAS DRAWN AS *WAITING ON REVIEW*, BESIDE ONE NOBODY HAD LOOKED AT.**
 *
 * The two states he acts differently on are *somebody owes this a look* and
 * *somebody looked and it is merging*, and the label alone cannot tell them apart:
 * the verdict is a COMMENT (`**Fable review — by hand`, by the founder's account),
 * and nothing removes the label when it lands.
 *
 * **The shapes below are the two real ones off the board on the day**, read at the
 * wire rather than imagined: #1322's newest verdict at 03:03:27Z against a head
 * commit at 03:03:02Z and `updated_at` 03:03:27Z (fresh), and #1326 carrying
 * `needs-fable` with its verdict read the same way. `shared/handVerdict.ts` holds
 * why `updatedAt` is the bound these readers use and what it costs.
 */
describe("has this pull request been reviewed? (his desk, 2026-09-26)", () => {
  const verdict = (pr: number, at: string) => ({ kind: "verdict", card: pr, at } as const);

  it("a FRESH verdict reads as passed and merging — measured on PR #1322", () => {
    const pr = { ...PR_1326, number: 1322, labels: ["needs-fable"], updatedAt: "2026-09-26T03:03:27Z" };
    const handVerdict = handVerdictForPullRequest({
      pullRequest: 1322,
      updatedAt: pr.updatedAt,
      facts: [verdict(1322, "2026-09-26T03:03:27Z")],
    });
    expect(handVerdict).toBe("fresh");
    expect(crewCardBuildState({
      card: 1248,
      openPullRequests: [{ ...pr, handVerdict }],
      facts: [],
      nowMs: NOW,
    })).toEqual({ kind: "pull-request", pullRequest: 1322, stage: "passed" });
  });

  it("⚠ THE NEGATIVE CONTROL: `needs-fable` and NO verdict still reads as waiting on review", () => {
    const handVerdict = handVerdictForPullRequest({
      pullRequest: 1326,
      updatedAt: "2026-09-26T02:01:51Z",
      facts: [],
    });
    expect(handVerdict).toBe("none");
    expect(crewCardBuildState({
      card: 1248,
      openPullRequests: [{ ...PR_1326, labels: ["needs-fable"], handVerdict }],
      facts: [],
      nowMs: NOW,
    })).toMatchObject({ stage: "review" });
  });

  it("⚠ a verdict with something AFTER it is stale — the head may have moved", () => {
    /* A push, a label change or a later comment all move `updatedAt`, so this
       under-claims rather than over-claims: it can say *not yet* about a verdict
       that stands, never *passed* about one that does not. */
    expect(handVerdictForPullRequest({
      pullRequest: 1322,
      updatedAt: "2026-09-26T03:10:00Z",
      facts: [verdict(1322, "2026-09-26T03:03:27Z")],
    })).toBe("stale");
    expect(crewCardBuildState({
      card: 1248,
      openPullRequests: [{ ...PR_1326, labels: ["needs-fable"], handVerdict: "stale" }],
      facts: [],
      nowMs: NOW,
    })).toMatchObject({ stage: "review" });
  });

  it("a DRAFT is still a draft, verdict or not — an unfinished PR is unfinished", () => {
    expect(crewCardBuildState({
      card: 1248,
      openPullRequests: [{ ...PR_1326, draft: true, handVerdict: "fresh" }],
      facts: [],
      nowMs: NOW,
    })).toMatchObject({ stage: "draft" });
  });

  it("⚠ a VERDICT fact names a PULL REQUEST and can never be a card's own state", () => {
    /* GitHub gives issues and pull requests one number sequence and hands both
       through one comment listing, so the judgement filters the kind out rather
       than sorting it with the claims. Without that, "PR #1322 was reviewed" would
       read as "the newest thing on card 1322 is a verdict" and answer nothing. */
    expect(crewCardBuildState({
      card: 1322,
      openPullRequests: [],
      facts: [verdict(1322, "2026-09-26T03:03:27Z")],
      nowMs: NOW,
    })).toBeNull();
    /* And it does not shadow a live claim on the same number either. */
    expect(crewCardBuildState({
      card: 1322,
      openPullRequests: [],
      facts: [claim(1322, "2026-09-26T02:00:00Z"), verdict(1322, "2026-09-26T03:03:27Z")],
      nowMs: NOW,
    })).toMatchObject({ kind: "claimed" });
  });

  it("an unreadable clock refuses to vouch for a verdict", () => {
    expect(handVerdictForPullRequest({ pullRequest: 1, updatedAt: "not a date", facts: [verdict(1, "2026-09-26T00:00:00Z")] }))
      .toBe("stale");
    expect(handVerdictForPullRequest({ pullRequest: 1, updatedAt: null, facts: [] })).toBe("none");
  });
});

/**
 * ⚠ **WHICH STATES TAKE A CARD OFF OFFER — the predicate the five queue readers
 * act on (#1094 piece 2), and it is TWO of the three.**
 */
describe("is this card still on offer?", () => {
  it("an open pull request and a live claim hold it off offer", () => {
    expect(buildStateHoldsOffOffer({ kind: "pull-request", pullRequest: 1, stage: "gate" })).toBe(true);
    expect(buildStateHoldsOffOffer({ kind: "pull-request", pullRequest: 1, stage: "passed" })).toBe(true);
    expect(buildStateHoldsOffOffer({ kind: "claimed", seat: "seat-x", at: "2026-09-26T02:00:00Z" })).toBe(true);
  });

  it("⚠ A REFUSAL DOES NOT — it is a judgement the next reader may overturn", () => {
    /* The re-scope's sentence names three states; this is deliberately two. A
       refusal is a shift's reading of the code, with `file:line` on the card, and
       withholding on it would let one shift retire a card of HIS silently — with
       no label, no ruling and nothing on his desk (#1337 is open because a refusal
       has no permanent home). So it annotates and stays on offer. */
    expect(buildStateHoldsOffOffer({ kind: "refused", at: "2026-09-26T00:21:50Z" })).toBe(false);
  });

  it("a card nobody is on is on offer", () => {
    expect(buildStateHoldsOffOffer(null)).toBe(false);
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
    /* His desk correction of 2026-09-26: reviewed and queued to merge is not the
       same row as still waiting for a look. */
    expect(crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1322, stage: "passed" }, NOW))
      .toBe("passed and merging — PR #1322");
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
