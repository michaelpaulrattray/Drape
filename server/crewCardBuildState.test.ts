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
  CREW_CARD_CLAIM_WORD,
  CREW_CARD_REFUSAL_WORDS,
  CREW_CARD_RELEASE_WORD,
  CREW_CLAIM_LIVE_MS,
  CREW_NOT_BUILT_LABEL,
  buildStateHoldsOffOffer,
  crewCardClaimLine,
  crewCardHandbackInstruction,
  crewCardRefusalLine,
  crewCardReleaseLine,
  handVerdictForPullRequest,
  crewCardBuildPhrase,
  crewCardBuildState,
  crewCardBuildViews,
  crewCardCommentFact,
  isNotBuiltLabelled,
  liveCardClaimFromFacts,
  liveCardClaimsFromFacts,
  notBuiltCards,
  indexCardBuilds,
  pullRequestBuildsCard,
  openPullRequestBuilding,
} from "../shared/crewCardBuildState";
import { findCardPullRequests } from "../shared/crewShiftState";
/* #2707: the instruction's claim about the cutter is driven through the real
   readers rather than asserted as prose. */
import { CREW_HOLD_LABELS, CREW_HOLD_MARKER, holdOwnerFromReason } from "../shared/crewNextUpHold";
import { workHoldExclusionFor } from "../shared/crewQueueExclusions";

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

/**
 * A WORD BETWEEN `CLAIMED` AND THE DASH USED TO MAKE A CLAIM INVISIBLE — #2898,
 * and the first row is the line that cost it.
 *
 * `relay-agent-spotlight-surface` claimed #14's slice 3b at 05:11:41Z on
 * 2026-10-31 and said which slice in the line. **The board read #14 as ON OFFER
 * for the next forty minutes while that agent was building it** — the one
 * takeable card `queue-standing-exceptions.mts` offered in the whole ordered
 * band — until a later shift re-spelled the claim by hand.
 *
 * Every row below was driven at this reader BEFORE the repair, which is how the
 * card's own table was produced; four of them are that table and the rest are
 * the hyphen cases it did not reach. The two that stay `null` are the controls
 * that matter: a line with no separator at all must not name a seat, and a
 * hyphen INSIDE a word is not a separator — `relay-agent-x` is how every seat
 * in this repository is spelled, so a rule that took any hyphen would file a
 * claim on a seat called `slice`.
 */
describe("a claim that says what it is claiming", () => {
  const seatOn = (body: string) => {
    const fact = crewCardCommentFact({ card: 14, body, createdAt: "2026-10-31T05:11:41Z" });
    return fact === null ? null : fact.kind === "claim" ? fact.seat : fact.kind;
  };

  it("⚠ reads the line that read ON OFFER for forty minutes", () => {
    expect(seatOn("**CLAIMED for slice 3b — relay-agent-spotlight-surface** (2026-10-31)"))
      .toBe("relay-agent-spotlight-surface");
  });

  it("still reads the canonical line, decorated or bare, exactly as before", () => {
    expect(seatOn("CLAIMED — relay-agent-spotlight-surface, 2026-10-31T05:11:41Z"))
      .toBe("relay-agent-spotlight-surface");
    expect(seatOn("**CLAIMED — relay-agent-sides, 2026-10-31T05:11:41Z**")).toBe("relay-agent-sides");
    /* The hyphen form a hand-written line sometimes takes, which the old
       expression accepted and this must not have quietly dropped. */
    expect(seatOn("CLAIMED - relay-agent-x, 2026-10-31T05:11:41Z")).toBe("relay-agent-x");
  });

  it("takes the seat from a SPACED hyphen too, words and all", () => {
    expect(seatOn("CLAIMED for slice 3b - relay-agent-x")).toBe("relay-agent-x");
  });

  it("⚠ a dash wins over a hyphen inside a word, so the seat is the seat", () => {
    /* Looked for first on purpose: a reader that stopped at the first hyphen
       would answer `slice 3b — relay-agent-x` here. */
    expect(seatOn("CLAIMED for sub-slice 3b — relay-agent-x")).toBe("relay-agent-x");
  });

  it("NEGATIVE CONTROL: no separator at all is not a claim, however it reads", () => {
    expect(seatOn("**CLAIMED for slice 3b, relay-agent-spotlight-surface**")).toBeNull();
  });

  it("⚠ NEGATIVE CONTROL: a hyphen inside a word is a letter, not a separator", () => {
    /* The false claim this rule exists to refuse: a seat called `slice`, which
       nobody holds, on a card the real seat can no longer recognise. */
    expect(seatOn("CLAIMED for sub-slice, relay-agent-x")).toBeNull();
  });

  it("NEGATIVE CONTROL: the line must still OPEN with the word — prose files nothing", () => {
    /* The bound this repair deliberately does not loosen. The arm above with
       `PROSE_BODY` is the same control on a real comment. */
    expect(seatOn("I have not CLAIMED — anything here")).toBeNull();
    expect(seatOn("the spelling is CLAIMED — <seat>, <UTC time>")).toBeNull();
  });

  it("a claim with a separator and nothing after it names no seat, as before", () => {
    expect(seatOn("CLAIMED —")).toBeNull();
    expect(crewCardCommentFact({ card: 14, body: "CLAIMED —", createdAt: "2026-10-31T05:11:41Z" }))
      .toEqual({ kind: "claim", card: 14, seat: null, at: "2026-10-31T05:11:41Z" });
  });

  it("and a release still outranks a claim on the same body", () => {
    /* Precedence is untouched by the widening — the one thing a generous claim
       reader could have broken. */
    const body = `CLAIMED for slice 3b — relay-agent-x

RELEASED — relay-agent-x`;
    expect(seatOn(body)).toBe("release");
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
      .toMatchObject({ kind: "claimed", claims: [{ seat: "seat-desk", at: live }] });
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
 * ⚠ **EVERY LIVE CLAIM, AND THE SINGULAR READER AS THIS LIST'S HEAD (#2775).**
 *
 * The defect was the NAME and never the lock: on a card two seats both hold,
 * the reader named the seat that got there LAST, and three surfaces print that
 * as *whose hands are on it*. The measurement that chose the repair is in
 * `liveCardClaimsFromFacts`'s own docblock — over the three collisions the
 * record holds, oldest-wins is right 2 times in 3 and newest-wins 1 in 3, so
 * no single name is a rule and the list is the honest answer.
 */
describe("every live claim on a card", () => {
  const CARD = 2769;

  it("reports both seats, newest first, when two are live", () => {
    const run = liveCardClaimsFromFacts({
      card: CARD,
      facts: [
        claim(CARD, "2026-09-26T02:15:00Z", "seat1-20261029-095243"),
        claim(CARD, "2026-09-26T01:00:00Z", "foreman-20261029-1005"),
      ],
      nowMs: NOW,
    });
    expect(run.map((entry) => entry.seat))
      .toEqual(["seat1-20261029-095243", "foreman-20261029-1005"]);
  });

  /**
   * ⚠ **THE EQUIVALENCE THAT MAKES THIS REPAIR SAFE.** `liveCardClaimFromFacts`
   * is now `run[0]`, so every verdict it has ever given on a single claim is
   * unchanged — which is why the walk STOPS at the first non-claim fact rather
   * than skipping past it. This is the arm that would redden if the walk were
   * loosened to skip, because then a claim under a release would surface.
   */
  it("the singular reader is exactly this list's head, on every shape", () => {
    const boards = [
      [claim(CARD, "2026-09-26T02:15:00Z", "a")],
      [claim(CARD, "2026-09-26T02:15:00Z", "a"), claim(CARD, "2026-09-26T01:00:00Z", "b")],
      [release(CARD, "2026-09-26T02:20:00Z"), claim(CARD, "2026-09-26T02:15:00Z", "a")],
      [refusal(CARD, "2026-09-26T02:20:00Z"), claim(CARD, "2026-09-26T02:15:00Z", "a")],
      /* Stale: the window is 12 h and NOW is 02:30, so this is long gone. */
      [claim(CARD, "2026-09-25T10:00:00Z", "a")],
      [],
    ];
    for (const facts of boards) {
      const single = liveCardClaimFromFacts({ card: CARD, facts, nowMs: NOW });
      const head = liveCardClaimsFromFacts({ card: CARD, facts, nowMs: NOW })[0] ?? null;
      expect(single).toEqual(head);
    }
  });

  it("a release or a refusal cancels EVERY claim under it, not only the newest", () => {
    /* The rule this module has always applied, now read one line deeper: a
       release puts the card back on offer for everybody, so neither of the two
       seats beneath it is still holding anything. */
    for (const canceller of [release(CARD, "2026-09-26T02:20:00Z"), refusal(CARD, "2026-09-26T02:20:00Z")]) {
      expect(liveCardClaimsFromFacts({
        card: CARD,
        facts: [
          canceller,
          claim(CARD, "2026-09-26T02:15:00Z", "a"),
          claim(CARD, "2026-09-26T01:00:00Z", "b"),
        ],
        nowMs: NOW,
      })).toEqual([]);
    }
  });

  it("a stale claim stops the walk, and everything under it is staler", () => {
    /* NOW is 02:30 and the window is 12 h, so the 10:00 line of the previous day
       is dead. A list is sorted, so nothing beneath a dead claim can be alive —
       which is why one `break` is the whole rule. */
    const run = liveCardClaimsFromFacts({
      card: CARD,
      facts: [
        claim(CARD, "2026-09-26T02:15:00Z", "live"),
        claim(CARD, "2026-09-25T10:00:00Z", "stale"),
        claim(CARD, "2026-09-25T09:00:00Z", "staler"),
      ],
      nowMs: NOW,
    });
    expect(run.map((entry) => entry.seat)).toEqual(["live"]);
  });

  it("another card's claims are never counted, and a verdict is not a claim", () => {
    expect(liveCardClaimsFromFacts({
      card: CARD,
      facts: [claim(1322, "2026-09-26T02:15:00Z", "elsewhere")],
      nowMs: NOW,
    })).toEqual([]);
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
    expect(buildStateHoldsOffOffer({
      kind: "claimed",
      claims: [{ seat: "seat-x", at: "2026-09-26T02:00:00Z" }],
    })).toBe(true);
    /* ⚠ AND A CONTESTED CARD IS HELD OFF OFFER EXACTLY AS A SINGLY-CLAIMED ONE
       IS (#2775). The card's own sentence is *"the LOCK is intact; only the NAME
       is wrong"*, so this is the arm that proves the repair did not widen into
       the lock: two live claims must not make a card MORE takeable than one. */
    expect(buildStateHoldsOffOffer({
      kind: "claimed",
      claims: [
        { seat: "seat-b", at: "2026-09-26T02:00:00Z" },
        { seat: "seat-a", at: "2026-09-26T01:00:00Z" },
      ],
    })).toBe(true);
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

  it("a held PR a shift has answered says who it is waiting on (#2855)", () => {
    /*
      ⚠ **A REPAIR IS NOT ALWAYS A COMMIT.** When the relay asks for a
      re-measurement rather than for code (PR #2852, the live instance), the
      answer lands in a comment and the head never moves — so this row said
      *repair owed* over work that was done and on the record, which is the
      direction that HIDES work. The stage is still `finding` on every row
      below: nothing here clears a hold.
    */
    expect(crewCardBuildPhrase(
      { kind: "pull-request", pullRequest: 2852, stage: "finding", findingNote: null, findingAnswered: true },
      NOW,
    )).toBe("answered — waiting on the relay — PR #2852");

    /* UNCHANGED, and it is the ordinary case: nobody has acted. */
    expect(crewCardBuildPhrase(
      { kind: "pull-request", pullRequest: 2850, stage: "finding", findingNote: null, findingAnswered: false },
      NOW,
    )).toBe("held on the relay's finding — repair owed — PR #2850");
    /* And a row from before the field existed reads exactly as it did. */
    expect(crewCardBuildPhrase(
      { kind: "pull-request", pullRequest: 2850, stage: "finding", findingNote: null },
      NOW,
    )).toBe("held on the relay's finding — repair owed — PR #2850");

    /*
      ⚠ **THE RELAY'S OWN NOTE STILL WINS (#1705).** A header saying *held for
      merge order, not a defect* is a fact about the hold; an answer is a fact
      about who is next. The first is the relay's words and is never overwritten
      by a shift's.
    */
    expect(crewCardBuildPhrase(
      {
        kind: "pull-request", pullRequest: 1682, stage: "finding",
        findingNote: "held for merge order, not a defect", findingAnswered: true,
      },
      NOW,
    )).toBe("held for merge order, not a defect — PR #1682");
  });

  it("a claim names the seat and how long ago, and the first hour says so in words", () => {
    expect(crewCardBuildPhrase({
      kind: "claimed",
      claims: [{ seat: "seat-desk-2", at: "2026-09-26T02:15:00Z" }],
    }, NOW)).toBe("claimed by seat-desk-2, under an hour ago");
    expect(crewCardBuildPhrase({
      kind: "claimed",
      claims: [{ seat: "seat-atlas", at: "2026-09-25T23:30:00Z" }],
    }, NOW)).toBe("claimed by seat-atlas, 3 h ago");
    expect(crewCardBuildPhrase({
      kind: "claimed",
      claims: [{ seat: null, at: "2026-09-25T23:30:00Z" }],
    }, NOW)).toBe("claimed 3 h ago");
  });

  /**
   * ⚠ **TWO SEATS READ AS TWO, AND THE AGE IS THE FIRST ARRIVAL (#2775).** The
   * sentence for one claim is UNCHANGED above — that is the ordinary case and
   * every claim this board has drawn but three — so this is the only wording
   * the card adds.
   */
  it("two live claims are counted rather than resolved to one name", () => {
    expect(crewCardBuildPhrase({
      kind: "claimed",
      claims: [
        { seat: "seat1-20261029-095243", at: "2026-09-26T02:15:00Z" },
        { seat: "foreman-20261029-1005", at: "2026-09-25T23:30:00Z" },
      ],
    }, NOW)).toBe("claimed by 2 seats, 3 h ago");
    /* ⚠ THE AGE IS THE OLDEST CLAIM'S, NOT THE NEWEST — the question is how
       long the card has been held at all, which is what "3 h ago" answers on a
       single claim. Sabotaging this to `claims[0]` makes it "under an hour
       ago", which is a different and wronger fact. */
    expect(crewCardBuildPhrase({
      kind: "claimed",
      claims: [
        { seat: "b", at: "2026-09-26T02:15:00Z" },
        { seat: "a", at: "2026-09-26T02:10:00Z" },
      ],
    }, NOW)).toBe("claimed by 2 seats, under an hour ago");
    /* Three is not a shape the record has ever held, and it must still read. */
    expect(crewCardBuildPhrase({
      kind: "claimed",
      claims: [
        { seat: "c", at: "2026-09-26T02:15:00Z" },
        { seat: "b", at: "2026-09-26T01:00:00Z" },
        { seat: null, at: "2026-09-25T23:30:00Z" },
      ],
    }, NOW)).toBe("claimed by 3 seats, 3 h ago");
  });

  it("no phrase carries a term of art from the pipeline", () => {
    const phrases = [
      crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1, stage: "gate" }, NOW),
      crewCardBuildPhrase({ kind: "pull-request", pullRequest: 1, stage: "review" }, NOW),
      crewCardBuildPhrase({ kind: "refused", at: "2026-09-26T00:00:00Z" }, NOW),
      crewCardBuildPhrase({
        kind: "claimed",
        claims: [{ seat: "s", at: "2026-09-26T02:00:00Z" }],
      }, NOW),
      /* ⚠ THE CONTESTED PHRASE IS IN THIS CAP ON PURPOSE (#2775) — the cell is
         `flex: none` beside a title that ellipsises, so every character here is
         taken off the card's own title. Naming both seats would be ~110
         characters, which is why the names go to the two terminal lines instead.

         ⚠ **AND THIS CAP IS WEAKER THAN IT LOOKS, MEASURED RATHER THAN
         ASSUMED (#2775).** Every seat name in this arm is a short invented one,
         so 42 is a bound on the FIXTURES and not on the phrase: driven over the
         real board, a single live claim by `foreman-20261029-1005` renders
         **50** characters and has done since #1094. The contested phrase is 37.
         Left as it stands rather than widened, because tightening or loosening
         it is a judgement about his page that belongs on its own card — filed
         as such — and not inside this repair. */
      crewCardBuildPhrase({
        kind: "claimed",
        claims: [
          { seat: "seat1-20261029-095243", at: "2026-09-26T02:15:00Z" },
          { seat: null, at: "2026-09-26T02:14:00Z" },
        ],
      }, NOW),
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

/**
 * THE WORDS THE WRITER IS TOLD, DRIVEN THROUGH THE READER THAT WANTS THEM (#1701).
 *
 * ⚠ **EVERY ARM HERE PARSES — NOTHING COMPARES THE INSTRUCTION TO A SECOND COPY
 * OF ITSELF.** That is the whole point of the card: the instruction and the
 * reader were two literals in two files, they drifted, and **0 of 5 refusals
 * written on #1669 were visible**. A guard asserting the rendered line equals a
 * string typed in this file would be the same mistake one layer down — it would
 * hold the instruction equal to a third copy and still not prove the board can
 * see it. So the example lines go through `crewCardCommentFact`, which is the
 * thing that actually decides (invariant 5 — assert at the wire).
 *
 * The negative control is not decoration: a reader that calls everything a
 * refusal would pass every positive arm below (working law 2).
 */
describe("the handback vocabulary a seat is told", () => {
  const SEAT = "seat1-20261002-134131";
  const AT = "2026-10-02T04:05:00Z";

  it("the three rendered lines are read as the three facts they name", () => {
    const fact = (body: string) => crewCardCommentFact({ card: 1701, body, createdAt: AT });
    expect(fact(crewCardRefusalLine(SEAT, AT))).toMatchObject({ kind: "refusal", card: 1701 });
    expect(fact(crewCardReleaseLine(SEAT, AT))).toMatchObject({ kind: "release", card: 1701 });
    expect(fact(crewCardClaimLine(SEAT, AT))).toMatchObject({ kind: "claim", seat: SEAT });
  });

  it("every refusal word the reader accepts is a refusal when written as a line", () => {
    expect(CREW_CARD_REFUSAL_WORDS.length).toBeGreaterThan(0);
    for (const word of CREW_CARD_REFUSAL_WORDS) {
      expect(
        crewCardCommentFact({ card: 1701, body: `${word} — ${SEAT}, ${AT}`, createdAt: AT }),
        `the reader accepts \`${word}\` and the writer is never told it`,
      ).toMatchObject({ kind: "refusal" });
    }
  });

  /* THE NEGATIVE CONTROL, and it is the word the seats actually wrote. */
  it("the words the seats wrote in good faith are still not facts", () => {
    for (const body of ["SKIPPED — the premise is wrong", "WORKED — all three asks", "BUILT — PR #1729"]) {
      expect(
        crewCardCommentFact({ card: 1701, body, createdAt: AT }),
        "a reader that sees these would make every arm above pass for the wrong reason",
      ).toBeNull();
    }
  });

  /*
    ⚠ THE DERIVED ARM — a word added to a reader must reach the writer.

    The instruction is RENDERED from the same constants the expressions are
    built from, so this holds the rendering to the population rather than to a
    sentence. The `not-built` label is in it on purpose: it is the durable half
    of a refusal and had five uses in the repository's whole history, for the
    same reason the word was never written — nothing told a seat it was there.
  */
  it("the instruction names every word, the label, and the pull-request trap", () => {
    const text = crewCardHandbackInstruction(SEAT);
    for (const word of [...CREW_CARD_REFUSAL_WORDS, CREW_CARD_RELEASE_WORD, CREW_CARD_CLAIM_WORD]) {
      expect(text, `\`${word}\` is read by the board and absent from what a seat is told`)
        .toContain(word);
    }
    expect(text).toContain(CREW_NOT_BUILT_LABEL);
    expect(text).toContain(SEAT);
    /* "or the PR" is the clause in the orders that actively misleads. */
    expect(text.toLowerCase()).toContain("not a release");
    /*
      ⚠ AND THE HOLD (#2707). Both are read from the constants that own them, so
      a renamed label or a changed marker reaches what a seat is told in the
      same edit — which is the whole reason this instruction is rendered
      rather than written out.
    */
    expect(text, "a refusing seat is not told which label takes the card off the offer")
      .toContain(CREW_HOLD_LABELS.blocked);
    expect(text, "a refusing seat is not told how to write the hold's sentence")
      .toContain(CREW_HOLD_MARKER);
  });

  /*
    An unnamed seat renders a placeholder rather than a line that would parse
    with an empty seat — the refusal message in `cardClaimComments.mts` prints
    this form, where there is no shift to name.
  */
  it("with no seat it still parses, and says what to put there", () => {
    expect(crewCardReleaseLine()).toContain("<seat>");
    expect(crewCardCommentFact({ card: 1701, body: crewCardReleaseLine(), createdAt: AT }))
      .toMatchObject({ kind: "release" });
  });

  /*
    ⚠ A WORD CARRYING A REGEX METACHARACTER WOULD BUILD A BROKEN EXPRESSION
    SILENTLY, and the expressions are now assembled rather than written. This is
    the cost of deriving them and it is paid here rather than discovered.
  */
  it("the vocabulary is plain words, so the assembled expressions stay expressions", () => {
    for (const word of [...CREW_CARD_REFUSAL_WORDS, CREW_CARD_RELEASE_WORD, CREW_CARD_CLAIM_WORD]) {
      expect(word, `\`${word}\` would be read as a regular expression, not a word`)
        .toMatch(/^[A-Z]+(?: [A-Z]+)*$/);
    }
  });

  /*
    ⚠ THE PRECEDENCE ARM — #2272, and it is the one thing the instruction itself
    used to get wrong. A release that DISCUSSES a refusal is filed as a refusal:
    `crewCardCommentFact` reads every block-opening line and checks refusal
    BEFORE release, so a correct `RELEASED` at the top loses to ordinary prose
    further down. It happened on #1469 — the board called a free card not-built
    until the comment was edited.

    The reader is RIGHT and is not the subject here. The subject is that what a
    seat is TOLD must keep matching it, which is why the third arm holds the
    rendered prose to this behaviour rather than to a second copy of itself.
  */
  it("a release whose later paragraph opens with a refusal word is filed as a refusal", () => {
    for (const word of CREW_CARD_REFUSAL_WORDS) {
      const body = [
        crewCardReleaseLine(SEAT, AT),
        "",
        `${word}, and it never will be directly — this card is the rung's design of record.`,
      ].join("\n");
      expect(
        crewCardCommentFact({ card: 2272, body, createdAt: AT }),
        `a seat told the board reads only the first word writes this and means \`${CREW_CARD_RELEASE_WORD}\``,
      ).toMatchObject({ kind: "refusal" });
    }
  });

  /*
    THE NEGATIVE CONTROL, and the arm above is worthless without it: a reader
    that called every release a refusal would pass it. The same handback with
    that one phrase reworded is still a release — which is the whole of the
    repair #1469's comment needed.
  */
  it("the same release without the refusal words is still a release", () => {
    const body = [
      crewCardReleaseLine(SEAT, AT),
      "",
      "It is never built directly — this card is the rung's design of record.",
    ].join("\n");
    expect(crewCardCommentFact({ card: 2272, body, createdAt: AT })).toMatchObject({ kind: "release" });
  });

  /*
    AND THE INSTRUCTION IS HELD TO THAT PRECEDENCE. Both phrases are pinned for
    a reason rather than for their wording: the first is the correction of the
    false claim, the second is the fact that makes the body above a refusal.
    *"nothing else"* is pinned ABSENT because that was the sentence which made
    the trap look safe — it is the thing that must not come back.
  */
  it("the instruction says where the words are read, and which one outranks the other", () => {
    const lower = crewCardHandbackInstruction(SEAT).toLowerCase();
    expect(lower, "a seat is not told the words are read past the first line")
      .toContain("not only the first line");
    expect(lower, "a seat is not told a refusal beats a release wherever it sits")
      .toContain("outranks a release");
    expect(lower, "the FIRST-WORD claim is back, and it is false of crewCardCommentFact (#2272)")
      .not.toContain("nothing else");
  });

  /*
    ⚠ AND THE HELP TEXT MUST NOT ITSELF PARSE AS A HANDBACK. It renders all three
    ceremonial lines, so a reader anchored anywhere but a block opener would read
    the instruction as a refusal of whatever card it was printed under. This is
    the arm that would fail if the precedence above were ever "fixed" by reading
    every line instead.
  */
  it("the instruction text is not itself read as a fact", () => {
    expect(crewCardCommentFact({ card: 2272, body: crewCardHandbackInstruction(SEAT), createdAt: AT }))
      .toBeNull();
  });
});

/*
  ⚠ #2707 — THE HOLD IS PART OF A REFUSAL, AND THE SEAT IS TOLD SO.

  Four builder-seat sessions on 2026-10-27 were spent on four cards
  (#2599, #2616, #2631, #2658) that no seat could build, and **three of the
  seats named the missing act in writing and each left it for somebody who would
  not read it** — a card comment. `#2198` is the same shape (six sessions, ended
  by a seat applying `blocked` by hand) and `#1669` is its ancestor.

  **What is NOT the bug: a refused card staying on offer.** That is his own word
  of 2026-09-29 (Crew reply #237, option A), `refused` is `holdsOffWork: false`
  by declaration, and the cutter is not touched by this card. The missing act is
  the hold, and `blocked` is the only label that performs it.

  # Why these arms are not just "the prose contains a word"

  The instruction makes a FACTUAL CLAIM about the cutter — that `not-built`
  alone leaves a card takeable and `blocked` is what stops it. That claim is
  DRIVEN here through the real reader rather than trusted, with the refused-only
  case as the control. An instruction that told a seat something the cutter does
  not do would be the #2272 defect again: an instruction that is false is worse
  than one that is missing.
*/
describe("⚠ a refusal's hold — the sentence #2707 added, and the claim it makes", () => {
  /* Its own, because the block above scopes these inside its describe. */
  const SEAT = "seat1-20261027-223547";
  const AT = "2026-10-27T23:45:00Z";

  it("⚠ THE CLAIM IS TRUE OF THE CUTTER — `not-built` leaves it takeable, `blocked` does not", () => {
    /*
      THE CONTROL FIRST, because the arm below means nothing without it: a card
      carrying the refusal label ALONE is still offered. That is correct and
      ruled, and it is what the four cards did for four sessions.
    */
    expect(workHoldExclusionFor([CREW_NOT_BUILT_LABEL, "bug"])).toBeNull();

    /* And the hold is what takes it off. */
    expect(workHoldExclusionFor([CREW_NOT_BUILT_LABEL, "bug", CREW_HOLD_LABELS.blocked]))
      .toBe("blocked");

    /*
      AND THE HOLD ALONE DOES IT, which is why the instruction says the two
      labels do DIFFERENT jobs rather than that one implies the other: the
      verdict and the hold are independent facts, and a seat that applies only
      the hold has recorded no verdict for the next reader.
    */
    expect(workHoldExclusionFor([CREW_HOLD_LABELS.blocked])).toBe("blocked");
  });

  it("the instruction says both labels are needed, and what each one is for", () => {
    const text = crewCardHandbackInstruction(SEAT);
    expect(text).toContain("IN THE SAME ACT");
    expect(text.toLowerCase()).toContain("off the offer");
    /* The cost, so the sentence carries its own reason rather than reading as
       one more piece of ceremony. */
    expect(text).toContain("#2707");
  });

  it("⚠ and it warns about the FIRST WORD, which is what would put the card on his desk", () => {
    /*
      `holdOwnerFromReason` reads the first word of the hold's sentence (past an
      article) and answers `you` for "you", "his", "him", "he", "michael",
      "founder". So a seat writing `**Waiting on:** YOU` on a card it just
      refused would put its own refusal in front of him — which is the one way
      this new instruction could do harm, so it is named in it.
    */
    const text = crewCardHandbackInstruction(SEAT).toLowerCase();
    expect(text).toContain("first word");
    for (const word of ["you", "his", "michael"]) expect(text).toContain(word);
  });

  it("⚠ THE WARNING IS TRUE OF THE READER — driven, both answers", () => {
    /* The harm the warning prevents… */
    expect(holdOwnerFromReason("YOU — your word on whether this is worth building")).toBe("you");
    expect(holdOwnerFromReason("his eye on the frames")).toBe("you");
    /* …and the shape a refusing seat should actually write. */
    expect(holdOwnerFromReason("#2688 closing — this card's premise moves with it")).toBe("other");
    expect(holdOwnerFromReason("a decision on whether the sweep's population widens")).toBe("other");
  });

  it("it offers the escape, because a hold is sometimes the wrong answer", () => {
    /* A card that turns out already finished is CLOSED with its receipt, not
       frozen — #541's freezer is the failure a blanket "always hold" would add. */
    const text = crewCardHandbackInstruction(SEAT);
    expect(text).toContain("If a hold would be WRONG");
    expect(text.toLowerCase()).toContain("close it with the receipt");
  });

  it("⚠ the longer instruction STILL does not parse as a handback of its own card", () => {
    /*
      The arm that matters most about ADDING to this text: it renders all three
      ceremonial lines, so any new line that happened to open a block with a
      read word would file the help text as a refusal of whatever card it was
      printed under. Nine lines were added by #2707.
    */
    expect(crewCardCommentFact({ card: 2707, body: crewCardHandbackInstruction(SEAT), createdAt: AT }))
      .toBeNull();
  });
});

describe("the `take it` entry says not to write a claim by hand (#2773)", () => {
  const SEAT = "seat1-20261029-112410";
  const AT = "2026-10-29T01:40:28Z";

  /*
    ⚠ THE HALF A SEAT CAN BE TOLD ON. `readCardClaim`'s `contested` verdict is
    the mechanical repair and it catches the collision on the NEXT read; this
    stops the hand claim being written at all, which is the only thing that
    catches it before the work is spent. The launch orders say the opposite in
    prose and live in `.agents/`, which is not a seat's to edit — the same split
    #1701 and #2707 left owed, answered the same way they answered it.
  */
  it("names the tool and the flag that posts it, so the sentence is actionable", () => {
    const text = crewCardHandbackInstruction(SEAT);
    expect(text).toContain("scripts/crew-shift-start.mts");
    expect(text).toContain("--card '#N'");
    expect(text.toLowerCase()).toContain("do not write by hand");
  });

  it("carries the mechanism and the cost, so it reads as a reason not more ceremony", () => {
    const text = crewCardHandbackInstruction(SEAT);
    expect(text).toContain("#2773");
    /* The mechanism in one clause: it is the NEWEST line that gets consulted. */
    expect(text).toContain("NEWEST line");
    expect(text).toContain("HIDES a rival's live claim");
    /* And why the row's own refusal did not save that seat. */
    expect(text).toContain("the card your ROW names");
  });

  it("still shows the claim LINE itself, in the spelling the board reads", () => {
    /*
      ⚠ THE ARM THAT KEEPS THE ESCAPE OPEN. `postCardClaim` prints this exact
      command when `gh` refuses, and `--same-card` leaves a seat claiming by
      hand on purpose — so a seat must still be able to see what to write. An
      instruction that only forbade the hand claim would strand both roads.
    */
    const text = crewCardHandbackInstruction(SEAT);
    expect(text).toContain(crewCardClaimLine(SEAT));
    expect(crewCardCommentFact({ card: 2773, body: crewCardClaimLine(SEAT), createdAt: AT }))
      .toMatchObject({ kind: "claim", seat: SEAT });
  });

  it("⚠ and the longer instruction STILL does not parse as a handback of its own card", () => {
    /* The arm that matters most about adding to this text, re-asserted for the
       ten lines added here: a line opening a block with a read word would file
       the help text as a refusal of whatever card it was printed under. */
    expect(crewCardCommentFact({ card: 2773, body: crewCardHandbackInstruction(SEAT), createdAt: AT }))
      .toBeNull();
  });
});

/**
 * ⚠ **THE SELECTION HAS A SECOND CALLER NOW, SO IT IS ONE FUNCTION — #2866.**
 *
 * The sweep's unheld-decision band printed *"every seat is still offered them"*
 * about cards an open pull request already holds off offer, and repairing it
 * means asking which pull request is building a card from a module this one
 * IMPORTS (`./crewNextUpHold`, for the hold vocabulary) — so the answer is
 * injected and the rule stays here.
 *
 * ⚠ **THE ARM THAT MATTERS IS THE LAST ONE: `crewCardBuildState` AGREES WITH
 * IT BY CONSTRUCTION.** Three lines of filter-and-sort copied into a second
 * reader is the mirror working law 4 names, and this family's whole job is to
 * agree about what is still on offer. If that arm can ever go green while the
 * two disagree, the extraction has been undone.
 */
describe("which open pull request is building a card — one owner, two callers (#2866)", () => {
  /* The live specimen the band was wrong about, at the shapes `gh pr list`
     returned them on 2026-10-30: 97 open cards, 12 open pull requests. */
  const PR_2860 = {
    number: 2860,
    title: "fix(crew): a cut broken into 29 pieces (Card: #2841)",
    headRefName: "team/cut-fragmentation-2841",
  };
  const PR_2852 = {
    number: 2852,
    title: "fix(casting-v2): a tattoo sleeve is one piece of ink, so it gets a row (Card: #2848)",
    headRefName: "team/sleeve-coverage-2848",
  };

  it("⚠ names the pull request that proved the band wrong — the whole point of it", () => {
    /* `pullRequestBuildsCard` answered `["title","branch"]` on the live read,
       so this specimen exercises both halves of the match. */
    expect(pullRequestBuildsCard(PR_2860, 2841)).toEqual(["title", "branch"]);
    expect(openPullRequestBuilding([PR_2852, PR_2860], 2841)?.number).toBe(2860);
  });

  it("⚠ CONTROL — a card nothing builds is `null`, or the arm above passes by holding everything", () => {
    expect(openPullRequestBuilding([PR_2852, PR_2860], 999999)).toBeNull();
    expect(openPullRequestBuilding([], 2841)).toBeNull();
  });

  it("⚠ takes the LOWEST number, whatever order the board arrives in", () => {
    /* A card with a replacement pull request and its predecessor both open
       names one of them deterministically — two readers answering in different
       orders would disagree about which number a row prints. */
    const replacement = { ...PR_2860, number: 2899 };
    const earlier = { ...PR_2860, number: 2700 };
    expect(openPullRequestBuilding([replacement, earlier], 2841)?.number).toBe(2700);
    expect(openPullRequestBuilding([earlier, replacement], 2841)?.number).toBe(2700);
  });

  it("⚠ `crewCardBuildState` DERIVES from it rather than keeping a copy of the rule", () => {
    const board = [{ ...PR_2860, number: 2899 }, { ...PR_2860, number: 2700 }, PR_2852];
    for (const card of [2841, 2848, 999999]) {
      const picked = openPullRequestBuilding(board, card);
      const state = crewCardBuildState({ card, openPullRequests: board, facts: [], nowMs: 0 });
      /* Not "both answer something" — the SAME pull request, or both nothing. */
      expect(
        state?.kind === "pull-request" ? state.pullRequest : null,
        `card ${card}`,
      ).toBe(picked?.number ?? null);
    }
  });
});
