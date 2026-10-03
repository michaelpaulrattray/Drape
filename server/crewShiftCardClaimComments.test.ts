/**
 * ANOTHER SEAT'S CLAIM, DRIVEN DIRECTLY (#1580).
 *
 * The finding, read at `crew_shift_runs` rather than at the card: on
 * 2026-09-30 `seat1-20260930-155058` claimed #1554 at 05:54:21Z and
 * `foreman-20260930-1553` claimed it at 05:56:59Z, and both shipped a pull
 * request for the same deletion. The mechanical lock that exists (#608, the
 * row-collision refusal) could not fire, and the reason is not the two-and-a-
 * half-minute gap — it is that **neither row named #1554**: run #449 declared
 * `#1503`, run #450 declared `#1414`, and #1554 was the Nth card of both
 * seats' batches.
 *
 * So the repair has two halves and this file drives both:
 *
 *   1. the COMMENT read — `scripts/lib/cardClaimComments.mts`, the artifact a
 *      batch's Nth card actually has;
 *   2. the RE-DECLARATION — `--card` on a heartbeat, which puts the row on the
 *      card the seat is on so the older lock has something to compare.
 *
 * It lives here rather than beside the script for the reason its sibling
 * `crewShiftCardClaim.test.ts` gives: the script's blocks sit past a live
 * database connection and `vitest.setup.ts` strips `DATABASE_URL`, so no suite
 * can reach them there. Nothing here touches a network, a token or a queue —
 * the reader takes a fixture path, and the source arms read the files' bytes.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  CARD_COMMENT_READ_TIMEOUT_MS,
  cardClaimBody,
  cardClaimPostArgs,
  cardCommentListArgs,
  HEARTBEAT_FOREIGN_CLAIM_PROBE_MAX,
  postCardClaim,
  readCardClaim,
  readCardComments,
  readNoteForeignClaims,
  renderCardClaimNote,
  renderCardClaimPost,
  renderCardClaimRefusal,
  renderNoteForeignClaimWarning,
  type CardComment,
  type CardCommentRead,
} from "../scripts/lib/cardClaimComments.mts";
import {
  CREW_CLAIM_LIVE_MS,
  cardStateSpendsClaim,
  crewCardClaimLine,
  crewCardCommentFact,
  crewCardReleaseLine,
  type CrewCardReadState,
} from "../shared/crewCardBuildState";
import { cardNumbersNamedIn, cardNumberToken } from "../shared/crewShiftState";

/*
  ⚠ THIS SUITE IS IN #548's POPULATION, THROUGH THE MODULE IT DRIVES. Every arm
  below is fixture-fed and spawns nothing today — but `readCardComments` reaches
  `execFileSync` when no fixture is given, so the deriver counts this file the
  moment it is tracked, and it is RIGHT to: the first arm that omits a fixture
  path would spawn `gh` inside vitest's 5 s default and go red under load on
  somebody's machine rather than in CI. Declared with the population, not after
  it bites.
*/
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/** The moment the foreman's claim landed on #1554, as GitHub recorded it. */
const FOREMAN_CLAIMED_AT = "2026-09-30T05:56:59Z";
/** Seat 1's claim, two minutes thirty-eight seconds earlier. */
const SEAT1_CLAIMED_AT = "2026-09-30T05:54:21Z";
const JUST_AFTER = Date.parse("2026-09-30T05:57:10Z");

function claim(seat: string, at: string): CardComment {
  return { body: `CLAIMED — ${seat}, ${at}`, createdAt: at };
}

function fixture(rows: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "card-claim-1580-"));
  const path = join(dir, "comments.json");
  writeFileSync(path, JSON.stringify(rows), "utf8");
  return path;
}

describe("the incident, reproduced (#1580)", () => {
  it("refuses the foreman's claim on #1554 and names the seat already on it", () => {
    const verdict = readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [claim("seat1-20260930-155058", SEAT1_CLAIMED_AT)],
      mine: "foreman-20260930-1553",
      now: Date.parse(FOREMAN_CLAIMED_AT),
    });

    expect(verdict).toEqual({
      kind: "claimed",
      seat: "seat1-20260930-155058",
      at: SEAT1_CLAIMED_AT,
    });

    const refusal = renderCardClaimRefusal("#1554", verdict, JUST_AFTER)!;
    /* The seat by name, because a refusal saying only "taken" leaves the seat
       unable to tell a rival from its own stale line. */
    expect(refusal).toContain("seat1-20260930-155058");
    expect(refusal).toContain("#1554");
    /* And the way out, or the guard costs a night the first time it is wrong. */
    expect(refusal).toContain("--same-card");
  });

  it("says how long ago, so a seat can judge a stale claim at a glance", () => {
    const verdict = readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [claim("seat1-20260930-155058", SEAT1_CLAIMED_AT)],
      mine: "foreman-20260930-1553",
      now: JUST_AFTER,
    });
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER)).toContain("2 minutes ago");
  });
});

describe("whose claim it is", () => {
  /*
    ⚠ **THESE TWO ARMS READ `free` UNTIL #1735 AND NOW READ `mine`, AND THE
    BEHAVIOUR THEY GUARD HAS NOT MOVED AT ALL.** Both reasons for not refusing
    were one word while nothing acted on the answer; the writer added that day
    posts a claim on `free`, so a seat's own live claim had to become sayable or
    every heartbeat would have added another line. What each arm actually
    asserts — that this seat is NOT refused — is asserted directly below,
    against the renderer the script calls, rather than inferred from a word.
  */
  it("lets a seat re-declare a card it claimed itself", () => {
    /* THE ARM THAT KEEPS A BATCH WORKING. A seat heartbeats `--card` more than
       once on the same card; its own claim must never refuse it. */
    const verdict = readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [claim("seat2-20260930-173234", SEAT1_CLAIMED_AT)],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    });
    expect(verdict).toEqual({ kind: "mine", at: SEAT1_CLAIMED_AT });
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER)).toBeNull();
  });

  it("compares seat names the one way, so case and padding are not a rival", () => {
    const verdict = readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [{ body: "CLAIMED —  SEAT2-20260930-173234 , 05:54Z", createdAt: SEAT1_CLAIMED_AT }],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    });
    expect(verdict).toMatchObject({ kind: "mine" });
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER)).toBeNull();
  });

  it("treats an unattributed claim as somebody else's", () => {
    /*
      THE ASYMMETRY, pinned. A claim whose seat could not be read is either a
      rival's — where refusing is right — or this seat's own under a name it did
      not write, where refusing costs one word. A missed claim costs an hour and
      a duplicate pull request.
    */
    const verdict = readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [{ body: "CLAIMED — , 2026-09-30", createdAt: SEAT1_CLAIMED_AT }],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    });
    expect(verdict.kind).toBe("claimed");
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER))
      .toContain("a seat that did not name itself");
  });
});

describe("what puts a card back on offer", () => {
  it("a RELEASE newer than the claim", () => {
    expect(readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [
        claim("seat1-20260930-155058", SEAT1_CLAIMED_AT),
        { body: "RELEASED — seat1-20260930-155058", createdAt: "2026-09-30T05:55:00Z" },
      ],
      mine: "foreman-20260930-1553",
      now: JUST_AFTER,
    })).toEqual({ kind: "free" });
  });

  it("a claim older than the twelve-hour window", () => {
    const at = new Date(JUST_AFTER - CREW_CLAIM_LIVE_MS - 60_000).toISOString();
    expect(readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [claim("seat1-20260930-155058", at)],
      mine: "foreman-20260930-1553",
      now: JUST_AFTER,
    })).toEqual({ kind: "free" });
  });

  it("but a claim one minute INSIDE the window still refuses", () => {
    /* THE POSITIVE CONTROL for the arm above: without it, "stale is free" is
       satisfied by a reader that calls everything stale. */
    const at = new Date(JUST_AFTER - CREW_CLAIM_LIVE_MS + 60_000).toISOString();
    expect(readCardClaim({
      cardRef: "#1554",
      state: "open",
      comments: [claim("seat1-20260930-155058", at)],
      mine: "foreman-20260930-1553",
      now: JUST_AFTER,
    }).kind).toBe("claimed");
  });
});

describe("prose about claiming is not a claim", () => {
  it("ignores a comment that merely discusses one", () => {
    /*
      #1580's own comments discuss claiming at length, and this card's body is
      the fixture that matters: a reader that matched the word mid-paragraph
      would refuse every seat that ever read this file. The rule itself is
      `crewCardCommentFact`'s, anchored per block-opening line since #1559 —
      this arm proves this caller still gets that rule rather than its own.
    */
    expect(readCardClaim({
      cardRef: "#1580",
      state: "open",
      comments: [
        { body: "Either the batch reader did not consult the board before it CLAIMED — or it read the board early.", createdAt: SEAT1_CLAIMED_AT },
      ],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    })).toEqual({ kind: "free" });
  });

  it("reads a claim the relay bolded, because that is how they are written", () => {
    expect(readCardClaim({
      cardRef: "#1580",
      state: "open",
      comments: [{ body: `**CLAIMED — seat1-20260930-155058, ${SEAT1_CLAIMED_AT}**`, createdAt: SEAT1_CLAIMED_AT }],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    }).kind).toBe("claimed");
  });
});

describe("an unread board is not a free one", () => {
  it("returns unreadable rather than free when the comments could not be read", () => {
    const verdict = readCardClaim({ cardRef: "#1554", comments: null, state: "open", mine: "x", now: JUST_AFTER });
    expect(verdict).toEqual({ kind: "unreadable" });
  });

  it("never refuses on it, and says so in words", () => {
    /*
      THE ARM THIS FILE EXISTS FOR, and it is the same one its sibling names: an
      unauthenticated `gh` prints nothing, which looks exactly like a card
      nobody has claimed. It must not stop a night (#504's ruling on the NEXT UP
      read), and it must not pass silently either.
    */
    const verdict = readCardClaim({ cardRef: "#1554", comments: null, state: "open", mine: "x", now: JUST_AFTER });
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER)).toBeNull();
    const note = renderCardClaimNote("#1554", verdict)!;
    expect(note).toContain("unread one");
    expect(note).toContain("gh auth status");
  });

  it("says nothing at all about a free-text card ref", () => {
    /* There is no number to ask `gh` about, so there is nothing to read — the
       same answer `renderCardClaimWarning` gives, rather than noise dressed as
       diligence. */
    const verdict = readCardClaim({ cardRef: "his reply about the outfit court", comments: null, state: "open", mine: "x" });
    expect(verdict).toEqual({ kind: "free" });
    expect(renderCardClaimNote("his reply", verdict)).toBeNull();
  });
});

describe("the reader's transport", () => {
  it("reads a gh --json comments document, and a bare array too", () => {
    const wrapped = fixture({ comments: [claim("seat1", SEAT1_CLAIMED_AT)] });
    expect(readCardComments(1554, wrapped).comments).toHaveLength(1);
    const bare = fixture([claim("seat1", SEAT1_CLAIMED_AT)]);
    expect(readCardComments(1554, bare).comments).toHaveLength(1);
  });

  it("answers null comments — never an empty list — when the fixture cannot be read", () => {
    expect(readCardComments(1554, join(tmpdir(), "no-such-file-1580.json")).comments).toBeNull();
    const notJson = fixture(null);
    writeFileSync(notJson, "{ not json", "utf8");
    expect(readCardComments(1554, notJson).comments).toBeNull();
  });

  it("asks gh for the card it was given, and for the comments AND the state", () => {
    /* Working law 5: the contract is proven on the call that goes out, not on a
       constant near it — and #1879's whole claim is that the state rides THIS
       call rather than a second one, which is a fact about the argv and nowhere
       else. */
    expect(cardCommentListArgs(1554)).toEqual(["issue", "view", "1554", "--json", "comments,state"]);
  });

  it("spends ONE gh call for both facts, which is the card's whole argument", () => {
    /*
      ⚠ THE ARM THAT WOULD CATCH THE OBVIOUS WRONG REPAIR. A second `gh issue
      view … --json state` beside the first would pass every behavioural arm
      below and quietly double this read against the one GitHub allowance every
      seat and the crew share — whose burst limit tripped three times in two
      hours on 2026-09-26. So the argv is asserted to be one list naming both
      fields, rather than the state being read anywhere at all.
    */
    const args = cardCommentListArgs(1554);
    expect(args.filter((a) => a === "--json")).toHaveLength(1);
    expect(args.at(-1)).toContain("comments");
    expect(args.at(-1)).toContain("state");
  });

  it("carries the card's state out of that same document, in both casings", () => {
    /* The state is READ, not asked for twice — so the proof is that a document
       carrying it comes back with it. Both casings, because `gh` answers `open`
       on one road and `OPEN` on the other, and a reader that knew one spelling
       would call every card on the other road unknown. */
    expect(readCardComments(1554, fixture({ comments: [], state: "OPEN" })).state).toBe("open");
    expect(readCardComments(1554, fixture({ comments: [], state: "open" })).state).toBe("open");
    expect(readCardComments(1554, fixture({ comments: [], state: "CLOSED" })).state).toBe("closed");
    expect(readCardComments(1554, fixture({ comments: [], state: "closed" })).state).toBe("closed");
  });

  it("an unread state is `unknown` and NEVER `closed`, on every road that answers one", () => {
    /*
      ⚠ THE ASYMMETRY, AND IT IS THE ONE ARM THIS WHOLE CHANGE RESTS ON (#1879).
      This card can only ever LOOSEN a guard, and `closed` is the single value
      that loosens it — so every road that fails to produce a state must produce
      `unknown`. A state read wrongly as closed spends a live claim and puts a
      second seat on a card somebody is building, which is the hour and the
      duplicate diff this family of guards exists to prevent.
    */
    /* A bare array is a comment list and carries no state — the fixture road
       the suite itself writes, and a real shape rather than an invented one. */
    expect(readCardComments(1554, fixture([claim("seat1", SEAT1_CLAIMED_AT)])).state).toBe("unknown");
    /* A state nobody has seen, a state of the wrong type, and a missing field. */
    expect(readCardComments(1554, fixture({ comments: [], state: "MERGED" })).state).toBe("unknown");
    expect(readCardComments(1554, fixture({ comments: [], state: 42 })).state).toBe("unknown");
    expect(readCardComments(1554, fixture({ comments: [] })).state).toBe("unknown");
    /* And the two roads where nothing was read at all. */
    expect(readCardComments(1554, join(tmpdir(), "no-such-file-1879.json")).state).toBe("unknown");
    const notJson = fixture(null);
    writeFileSync(notJson, "{ not json", "utf8");
    expect(readCardComments(1554, notJson).state).toBe("unknown");
  });

  it("holds the state parse to the ONE owner, rather than keeping a copy of it", () => {
    /*
      ⚠ WORKING LAW 4, ON THE FIELD THIS REPOSITORY HAS ALREADY BEEN BITTEN BY.
      `state` is the one `gh` field whose VALUE differs between the REST and
      GraphQL roads, and #1829 wrote that reading down once. A second comparison
      here — `state === "closed"`, or a `toLowerCase()` of its own — would be
      that reading copied, and the copy is what drifts. So the module spends
      `crewCardStateFromJson` for the parse and `cardStateSpendsClaim` for the
      rule, and holds NEITHER literal of its own.
    */
    const source = readFileSync(resolve(__dirname, "../scripts/lib/cardClaimComments.mts"), "utf8");
    expect(source).toContain("crewCardStateFromJson(");
    expect(source).toContain("cardStateSpendsClaim(");
    /* The code, not the prose: the docblocks discuss both words at length. */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toContain('=== "closed"');
    expect(code).not.toContain('=== "open"');
  });

  it("bounds the call, so the worst it can cost is a slow start", () => {
    expect(CARD_COMMENT_READ_TIMEOUT_MS).toBeGreaterThan(0);
    expect(CARD_COMMENT_READ_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

describe("the script spends both readers at every moment a card is declared", () => {
  const SOURCE = readFileSync(resolve(__dirname, "../scripts/crew-shift-start.mts"), "utf8");

  it("runs one guard, from two call sites — the start and the re-declaring heartbeat", () => {
    /*
      ⚠ THE GUARD THIS WHOLE CARD IS ABOUT IS THE SECOND CALL SITE. Without it a
      batch's Nth card is declared nowhere and refused by nothing, which is
      exactly how #1554 was built twice. Two sites and ONE function, because the
      pair of scripts this lives in has already drifted once (#1234).
    */
    const callSites = SOURCE.match(/assertCardIsFree\(\{/g) ?? [];
    expect(callSites).toHaveLength(2);
    expect(SOURCE).toContain("function assertCardIsFree(");
  });

  it("excludes the row it is about to update from its own collision", () => {
    /* Without this a second heartbeat on one card refuses against itself, and a
       seat that obeyed the instruction is stopped by it. */
    expect(SOURCE).toContain("exceptRunId: verdict.run.id");
  });

  it("writes the re-declared card into the heartbeat's own statement", () => {
    /* Invariant 1: the scope goes in the statement that writes. A COALESCE, so
       a heartbeat with no `--card` leaves the row's card exactly as it was. */
    expect(SOURCE).toContain("cardRef = COALESCE(?, cardRef)");
  });

  it("no longer accepts --card on a heartbeat and silently drops it", () => {
    /* The defect underneath the defect: a strict parser that takes a flag and
       spends it nowhere. */
    expect(SOURCE).toContain('const reDeclared = arg("card");');
  });
});

/**
 * THE WRITE SIDE — THE CLAIM POSTED BEFORE THE BUILD (#1735).
 *
 * ⚠ **EVERY ARM INJECTS ITS TRANSPORT, so nothing here reaches GitHub** — the
 * `post` hook exists for exactly that, and an arm that forgot it would comment
 * on a live card from inside a test run.
 *
 * The arm that matters most is the self-check: the body is composed by this
 * module and judged by the BOARD's reader, so a writer and a reader can never
 * again hold two copies of one spelling. That is #1701's measured cost — 0 of 5
 * refusals on #1669 invisible to the reader that looks for them — paid once and
 * guarded here rather than re-learned on the claim signal.
 */
describe("posting this seat's claim", () => {
  const SEAT = "seat1-20261002-134131";
  const AT = "2026-10-02T04:05:00Z";

  /** A recording transport: what would have gone to `gh`, and nothing sent. */
  function recorder() {
    const sent: { card: number; body: string }[] = [];
    return { sent, post: (card: number, body: string) => { sent.push({ card, body }); } };
  }

  it("posts on a free board, and the line it posts reads back as a claim", () => {
    const { sent, post } = recorder();
    const outcome = postCardClaim({ cardRef: "#1725", seat: SEAT, verdict: { kind: "free" }, at: AT, post });
    expect(outcome).toMatchObject({ kind: "posted" });
    expect(sent).toEqual([{ card: 1725, body: `CLAIMED — ${SEAT}, ${AT}` }]);
    /* ⚠ THE BOARD'S OWN JUDGE, not a second copy of the spelling. */
    expect(crewCardCommentFact({ card: 1725, body: sent[0]!.body, createdAt: AT }))
      .toMatchObject({ kind: "claim", seat: SEAT });
  });

  /*
    THE INCIDENT, DRIVEN. Had the other seat's declare posted at 21:14Z, seat 1's
    21:41Z read would have refused instead of coming back clean — and that is the
    whole of this card. The 32-second residue is NOT closed and is not claimed to
    be: the read-then-post window is stated in the module's own docblock.
  */
  it("the #1725 collision refuses once the first seat's declare has posted", () => {
    const { sent, post } = recorder();
    postCardClaim({
      cardRef: "#1725", seat: "foreman-20261001-2114",
      verdict: { kind: "free" }, at: "2026-10-01T21:14:00Z", post,
    });
    const verdict = readCardClaim({
      cardRef: "#1725",
      state: "open",
      comments: [{ body: sent[0]!.body, createdAt: "2026-10-01T21:14:00Z" }],
      mine: "seat1-20261002-070323",
      now: Date.parse("2026-10-01T21:41:33Z"),
    });
    expect(verdict).toMatchObject({ kind: "claimed", seat: "foreman-20261001-2114" });
    expect(renderCardClaimRefusal("#1725", verdict, Date.parse("2026-10-01T21:41:33Z")))
      .toContain("foreman-20261001-2114");
  });

  it("stays silent on a heartbeat that re-declares a card this seat already holds", () => {
    const { sent, post } = recorder();
    const held = readCardClaim({
      cardRef: "#1725",
      state: "open",
      comments: [{ body: `CLAIMED — ${SEAT}, ${AT}`, createdAt: AT }],
      mine: SEAT,
      now: Date.parse(AT) + 60_000,
    });
    expect(held, "a seat's own live claim must be distinguishable from an empty board")
      .toMatchObject({ kind: "mine" });
    expect(postCardClaim({ cardRef: "#1725", seat: SEAT, verdict: held, at: AT, post }))
      .toMatchObject({ kind: "skipped" });
    expect(sent, "every heartbeat would otherwise add a line").toEqual([]);
  });

  it("posts a fresh claim when this seat's own has aged out of the window", () => {
    const { sent, post } = recorder();
    const stale = readCardClaim({
      cardRef: "#1725",
      state: "open",
      comments: [{ body: `CLAIMED — ${SEAT}, ${AT}`, createdAt: AT }],
      mine: SEAT,
      now: Date.parse(AT) + CREW_CLAIM_LIVE_MS + 60_000,
    });
    expect(stale).toMatchObject({ kind: "free" });
    expect(postCardClaim({ cardRef: "#1725", seat: SEAT, verdict: stale, at: AT, post }))
      .toMatchObject({ kind: "posted" });
    expect(sent).toHaveLength(1);
  });

  /* ⚠ AN UNREAD BOARD IS NOT A FREE ONE — the one road on which claiming would
     put two seats on one card believing they each hold it. */
  it("never posts against a board it could not read, and says why", () => {
    const { sent, post } = recorder();
    const outcome = postCardClaim({
      cardRef: "#1725", seat: SEAT, verdict: { kind: "unreadable" }, at: AT, post,
    });
    expect(outcome).toMatchObject({ kind: "skipped" });
    expect((outcome as { why: string }).why).toContain("not a free one");
    expect(sent).toEqual([]);
  });

  it("never papers over another seat's live claim", () => {
    const { sent, post } = recorder();
    expect(postCardClaim({
      cardRef: "#1725", seat: SEAT,
      verdict: { kind: "claimed", seat: "seat2", at: AT }, at: AT, post,
    })).toMatchObject({ kind: "skipped" });
    expect(sent).toEqual([]);
  });

  it("a dry run says what it would post and writes nothing (#288)", () => {
    const { sent, post } = recorder();
    const outcome = postCardClaim({
      cardRef: "#1725", seat: SEAT, verdict: { kind: "free" }, at: AT, dryRun: true, post,
    });
    expect(outcome).toMatchObject({ kind: "skipped" });
    expect(renderCardClaimPost("#1725", outcome)).toContain("would post");
    expect(sent).toEqual([]);
  });

  it("says nothing about a free-text card ref, and nothing about a nameless row", () => {
    const { sent, post } = recorder();
    for (const input of [
      { cardRef: "the lobby lane", seat: SEAT },
      { cardRef: "#1725", seat: "   " },
    ]) {
      expect(postCardClaim({ ...input, verdict: { kind: "free" } as const, at: AT, post }))
        .toMatchObject({ kind: "skipped" });
    }
    expect(sent).toEqual([]);
  });

  /*
    ⚠ `gh` ABSENT, UNAUTHENTICATED OR SLOW MUST NOT FAIL A DESK ROW — #504's
    ruling on the NEXT UP read, one script over. What it MUST do is tell the seat,
    because a seat believing the tool claimed its card is the state this module
    exists to prevent.
  */
  it("a refusing gh is a warning carrying the command to run by hand", () => {
    const outcome = postCardClaim({
      cardRef: "#1725", seat: SEAT, verdict: { kind: "free" }, at: AT,
      post: () => { throw new Error("gh: command not found"); },
    });
    expect(outcome).toMatchObject({ kind: "failed" });
    const line = renderCardClaimPost("#1725", outcome) ?? "";
    expect(line).toContain("POST IT BY HAND BEFORE YOU BUILD");
    expect(line).toContain("gh issue comment 1725 --body");
    expect(line).toContain(SEAT);
  });

  /*
    ⚠ THE SELF-CHECK, DRIVEN BY BREAKING IT. A writer whose line the board cannot
    read must post NOTHING — the alternative is a seat that believes its card is
    locked while every other seat reads it as free, which is strictly worse than
    the hand-posted convention this replaces.
  */
  it("refuses to post a line the board would not read as a claim", () => {
    /* The drift, driven through the seam — the words a seat would naturally
       write, which is exactly the shape #1701 measured on the refusal signal. */
    for (const drifted of ["TAKING #1725", "WORKING ON this one", "CLAIMING — SEAT, AT"]) {
      const { sent, post } = recorder();
      const outcome = postCardClaim({
        cardRef: "#1725", seat: SEAT, verdict: { kind: "free" }, at: AT, post,
        bodyFor: () => drifted,
      });
      expect(outcome, `\`${drifted}\` is unreadable and must not be posted`)
        .toMatchObject({ kind: "skipped" });
      expect((outcome as { why: string }).why).toContain("does not read back as a claim");
      expect(renderCardClaimPost("#1725", outcome)).toContain("was NOT posted");
      expect(sent, "a claim the board cannot see is worse than none").toEqual([]);
    }
  });

  /* THE POSITIVE CONTROL ON THE SEAM: the check must pass something real, or the
     arm above would be green against a predicate that refuses everything. */
  it("the self-check passes the spelling the module actually writes", () => {
    const { sent, post } = recorder();
    expect(postCardClaim({
      cardRef: "#1725", seat: SEAT, verdict: { kind: "free" }, at: AT, post,
      bodyFor: cardClaimBody,
    })).toMatchObject({ kind: "posted" });
    expect(sent).toHaveLength(1);
  });

  it("asks gh to comment on the card it was given, and nothing else", () => {
    expect(cardClaimPostArgs(1725, "CLAIMED — x, y"))
      .toEqual(["issue", "comment", "1725", "--body", "CLAIMED — x, y"]);
  });

  /*
    ⚠ ONE SPELLING, NOT TWO — and this arm exists because the branch very nearly
    shipped two. #1701 landed on main while this one was open: it declared the
    three handback words once and built the board's readers from them, exactly so
    a writer and a reader could not drift (the shape that left 0 of 5 refusals on
    #1669 invisible). This module's `cardClaimBody` was a second literal of the
    same line. It is an alias now, and the arm holds it there.
  */
  it("the writer's line IS the board's declared claim line, not a copy of it", () => {
    expect(cardClaimBody(SEAT, AT)).toBe(crewCardClaimLine(SEAT, AT));
  });

  /*
    THE WIRING, read at the script's own bytes — `.agents/` is not where this
    lives, and `vitest.setup.ts` strips `DATABASE_URL`, so no arm can reach the
    script's block past its database connection. These two assertions are the
    only thing that can say the writer is CALLED (invariant 7), and they name
    both roads, because the Nth card of a batch is where #1580 measured the hole.
  */
  it("the shift script posts the claim on BOTH the declare and the re-declare", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../scripts/crew-shift-start.mts"), "utf8",
    );
    expect(source).toContain("claimCardOnTheCard({ cardRef: row.cardRef");
    expect(source).toContain("claimCardOnTheCard({ cardRef: reDeclared");
    /* ⚠ AFTER THE ROW, NEVER BEFORE IT: a claim posted for a start that then
       failed is a twelve-hour lock held by nobody. */
    const declare = source.indexOf("claimCardOnTheCard({ cardRef: row.cardRef");
    expect(source.lastIndexOf("the insert reported success", declare)).toBeGreaterThan(-1);
  });
});

/**
 * THE HEARTBEAT THAT DECLARES NOTHING (#1877) — the road the two guards above
 * do not cover, and the one the 2026-10-03 collision walked down.
 *
 * # The reading that produced this block
 *
 * Everything above was already in the tree on 2026-10-03 and would have refused
 * the duplicate: driven against the real comments at the real moment,
 * `readCardClaim` returns `claimed` by `foreman-20261004-0635` and the refusal
 * reads *"already claimed … 13 minutes ago"*. **The guard was adequate and was
 * never reached.** `assertCardIsFree` runs on a heartbeat only when `--card`
 * re-declares; the seat passed `--note` alone, so its row's `cardRef` never left
 * `#1870` while its own note said *"Now #1872"*, and the claim it posted by hand
 * met nothing at all.
 *
 * # Why these arms are shaped around SILENCE
 *
 * The candidates come from free prose, and **453 of 568 production rows name a
 * foreign card in their note** — so the interesting arms are the ones proving
 * this says NOTHING in the ordinary case. A warning that fires four heartbeats
 * in five is ignored by the second day and is then worse than the silence it
 * replaced; that is the design this card threw away, and these arms are what
 * stop it coming back.
 */
describe("a heartbeat that names another seat's card (#1877)", () => {
  /** Row #566's own note, read off `crew_shift_runs` on production. */
  const REAL_NOTE =
    "#1870 shipped as PR #1873 (preflight green, full suite 970 files/16842 tests, 6 sabotages"
    + " each red on its own arm). Now #1872: read every heartbeatAt reader - nothing reads a"
    + " CLOSED rows value, so the close stops rewriting it.";
  /** The moment the seat's heartbeat landed, as `crew_shift_runs` recorded it. */
  const AT_THE_HEARTBEAT = Date.parse("2026-10-03T20:51:37Z");
  const FOREMAN_CLAIM: CardComment[] = [{
    body: crewCardClaimLine("foreman-20261004-0635", "2026-10-03T20:36:19Z"),
    createdAt: "2026-10-03T20:36:18Z",
  }];
  /**
   * The board as it really stood: #1872 claimed, #1873 a pull request number.
   *
   * ⚠ **BOTH CARDS ARE `open` HERE, AND THAT IS NOT INCIDENTAL (#1879).** The
   * collision this block reproduces was a claim on a card somebody really was
   * building, so every arm below is the POSITIVE control for the loosening —
   * the probe must still speak when the card is open. The spent case has its
   * own block at the foot of this file.
   */
  const REAL_BOARD: Record<number, CardCommentRead> = {
    1872: { comments: FOREMAN_CLAIM, state: "open" },
    1873: { comments: [], state: "open" },
  };
  /** A card the board could not be read for at all. */
  const UNREAD: CardCommentRead = { comments: null, state: "unknown" };
  /** A card with no comments, read cleanly. */
  const NO_COMMENTS: CardCommentRead = { comments: [], state: "open" };

  function probe(
    note: string | null | undefined,
    own: string | null,
    mine: string | null,
    board: (card: number) => CardCommentRead,
  ) {
    const found = readNoteForeignClaims({
      note, ownCardRef: own, mine, readComments: board, now: AT_THE_HEARTBEAT,
    });
    return { found, line: renderNoteForeignClaimWarning(found, own, AT_THE_HEARTBEAT) };
  }

  it("speaks on the real collision, and names the seat and the age", () => {
    const { found, line } = probe(REAL_NOTE, "#1870", "seat1-20261004-062135", (c) => REAL_BOARD[c] ?? UNREAD);
    expect(found.claims).toEqual([
      { card: 1872, seat: "foreman-20261004-0635", at: "2026-10-03T20:36:18Z" },
    ]);
    /* The age is what makes the line actionable: fifteen minutes is somebody at
       a keyboard, eleven hours is probably a shift that never released. */
    expect(line).toContain("#1872 — foreman-20261004-0635, 15 minutes ago");
    /* And it hands back the one command that puts the card under the refusal. */
    expect(line).toContain("--card '#N'");
  });

  it("says a live claim is not a live seat, and names what a finished seat owes", () => {
    /*
      ⚠ FOUND BY DRIVING THE LIVE BOARD, NOT BY REASONING — the first live
      negative control fired on #1870, whose work had MERGED two hours earlier:
      that seat released the DUPLICATE it stood off and never released its own
      finished card, and no reader can see a merged pull request as a handback
      (#1701). This probe meets that case on every card a note CITES, where the
      refusal meets it only on a card a row declares — so the honest wording is
      load-bearing here, and the header must not say "hands on".
    */
    const { line } = probe(REAL_NOTE, "#1870", "seat1-20261004-062135", (c) => REAL_BOARD[c] ?? UNREAD);
    expect(line).toContain("CARRYING ANOTHER SEAT'S LIVE CLAIM");
    expect(line).not.toContain("HAS ITS HANDS ON");
    expect(line).toContain("A LIVE CLAIM IS NOT A LIVE SEAT");
    /* The release line is the BOARD's spelling, never a copy of it. */
    expect(line).toContain(crewCardReleaseLine());
    /* And the window is quoted from the constant, so it cannot drift from it. */
    expect(line).toContain(`(${Math.round(CREW_CLAIM_LIVE_MS / 3_600_000)} h)`);
  });

  it("is SILENT when the live claim is this seat's own", () => {
    /* A seat re-reading its own card must never be warned off it. */
    const { found, line } = probe(REAL_NOTE, "#1870", "foreman-20261004-0635", (c) => REAL_BOARD[c] ?? UNREAD);
    expect(found.claims).toEqual([]);
    expect(line).toBeNull();
  });

  it("is SILENT on the ordinary note that merely CITES cards — the 79.8% case", () => {
    /* ⚠ THE ARM THE WHOLE DESIGN TURNS ON. 453 of 568 real rows look like this. */
    const { found, line } = probe(
      "filed as #1877, sibling of #1747, his ruling on #1612, PR #1873 merged",
      "#1870", "seat-x", () => NO_COMMENTS,
    );
    expect(found.claims).toEqual([]);
    expect(found.unreadable).toEqual([]);
    expect(line).toBeNull();
  });

  it("is SILENT on a claim that has aged out of the board's window", () => {
    const stale = [{
      body: crewCardClaimLine("somebody", "2026-10-02T00:00:00Z"),
      createdAt: "2026-10-02T00:00:00Z",
    }];
    /* Older than CREW_CLAIM_LIVE_MS at the moment asked — so not live, and the
       card is free. Derived from the constant rather than from a typed date. */
    expect(AT_THE_HEARTBEAT - Date.parse("2026-10-02T00:00:00Z")).toBeGreaterThan(CREW_CLAIM_LIVE_MS);
    const { line } = probe(REAL_NOTE, "#1870", "seat-x", () => ({ comments: stale, state: "open" }));
    expect(line).toBeNull();
  });

  it("never probes the card the row already declares", () => {
    /* That card is covered by `assertCardIsFree`, and warning about this seat's
       own declared card would fire on every heartbeat of every shift. */
    const asked: number[] = [];
    probe("#1870 shipped, preflight green", "#1870", "seat-x", (card) => {
      asked.push(card);
      return NO_COMMENTS;
    });
    expect(asked).toEqual([]);
  });

  it("says so when the board could not be read — an unread board is not a clean one", () => {
    const { found, line } = probe(REAL_NOTE, "#1870", "seat-x", () => UNREAD);
    expect(found.unreadable).toEqual([1872, 1873]);
    expect(line).toContain("could not read the comments on #1872, #1873");
    expect(line).toContain("gh auth status");
  });

  it("spends at most the declared budget, however many cards a note names", () => {
    /*
      ⚠ GitHub's allowance is ONE account shared by every seat and the crew, and
      its burst limit tripped three times in two hours on 2026-09-26. Row #2's
      note names eight cards; a heartbeat must not spend eight reads on prose.
    */
    let reads = 0;
    const eight = "cites #20, #35, #48, #49, #63, #80, #203 and #234";
    expect(cardNumbersNamedIn(eight)).toHaveLength(8);
    readNoteForeignClaims({
      note: eight, ownCardRef: "#1870", mine: "seat-x", now: AT_THE_HEARTBEAT,
      readComments: () => { reads += 1; return NO_COMMENTS; },
    });
    expect(reads).toBe(HEARTBEAT_FOREIGN_CLAIM_PROBE_MAX);
  });

  it("asks nothing at all of an empty or absent note", () => {
    for (const note of [null, undefined, ""]) {
      let reads = 0;
      const found = readNoteForeignClaims({
        note, ownCardRef: "#1870", mine: "seat-x",
        readComments: () => { reads += 1; return NO_COMMENTS; },
      });
      expect(reads).toBe(0);
      expect(found.claims).toEqual([]);
    }
  });
});

/**
 * THE SCANNER IS HELD TO THE ONE OWNER OF THE SPELLING (#1877).
 *
 * `cardNumberToken` has been the single expression for "this text names that
 * card" since #1094, and `cardNumbersNamedIn` is its inverse. Two hand-written
 * expressions would be working law 4 on the token every card reference in the
 * product turns on — so the second is DEFINED as a candidate pass confirmed by
 * the first, and these arms hold them to each other in both directions over the
 * inputs that would separate two independent regexes.
 */
describe("which cards does this text name (#1877)", () => {
  const CORPUS = [
    "#1870 shipped as PR #1873. Now #1872.",
    "cites #20, #35 and #0608",
    "no cards here at all",
    "#1 and #12 and #120",
    /*
      ⚠ THESE TWO ARE DELIBERATELY SEPARATE STRINGS AND THE SABOTAGE PASS IS WHY.
      Written as one subject — `"v1#12 is a version, #12 is a card"` — the arm
      below could not fail: dropping the confirmation entirely still returned
      `[12]`, because the VALID `#12` later in the same string confirmed the
      number the invalid `v1#12` had produced. That is the sibling-satisfied arm
      this repository has been bitten by before, and it cost case 8 of eight.
    */
    "v1#12 is a version number, not a card",
    "#12 is a card",
    "ends on a card #99",
    /* `#12x` IS card 12 by the owner's rule — only a following DIGIT separates
       them — and it is here so that stays a decision rather than an accident. */
    "#12x is not a card number boundary",
    "",
  ];

  it("every number it finds is confirmed by cardNumberToken, over the whole corpus", () => {
    for (const text of CORPUS) {
      for (const card of cardNumbersNamedIn(text)) {
        expect(cardNumberToken(card).test(text), `${card} in ${JSON.stringify(text)}`).toBe(true);
      }
    }
  });

  it("and it misses none that cardNumberToken would confirm", () => {
    /*
      The other direction, which is the one a candidate pass can fail silently.
      Every number in range is asked of the OWNER, and the scanner must have
      found exactly that set.
    */
    for (const text of CORPUS) {
      const byTheOwner: number[] = [];
      for (let card = 1; card <= 2000; card += 1) {
        if (cardNumberToken(card).test(text)) byTheOwner.push(card);
      }
      expect(cardNumbersNamedIn(text), JSON.stringify(text)).toEqual(byTheOwner);
    }
  });

  it("deduplicates, sorts, and reads a padded reference as its number", () => {
    expect(cardNumbersNamedIn("#35 then #20 then #35 again")).toEqual([20, 35]);
    expect(cardNumbersNamedIn("#0608 is #608")).toEqual([608]);
  });
});

/**
 * AND THE HEARTBEAT ACTUALLY RUNS IT — invariant 7 pointed at this very card.
 *
 * ⚠ **PR #1874 shipped a docblock as the whole deliverable for half of #1872 and
 * the suite stayed green when that paragraph was deleted**; a seat found it and
 * #1876 repaired it. These arms are that lesson applied in advance: a reader
 * nothing calls is a reader nobody has, and the call site is the deliverable.
 */
describe("the script spends the foreign-claim probe on a bare heartbeat (#1877)", () => {
  const PROBE_SOURCE = readFileSync(resolve(__dirname, "../scripts/crew-shift-start.mts"), "utf8");

  it("calls the probe, and renders it", () => {
    expect(PROBE_SOURCE).toContain("readNoteForeignClaims({");
    expect(PROBE_SOURCE).toContain("renderNoteForeignClaimWarning(foreign, target.cardRef)");
  });

  it("runs it ONLY when the heartbeat declared no card", () => {
    /* With a `--card` the stronger guard above already covers that card, and
       probing it twice would spend two reads for one answer. */
    expect(PROBE_SOURCE).toContain("if (reDeclared === null) {");
  });

  it("asks about the row's OWN card, so the probe can exclude it", () => {
    expect(PROBE_SOURCE).toContain("ownCardRef: target.cardRef");
  });

  it("WARNS and never refuses — a refused heartbeat reads as a dead shift", () => {
    /*
      ⚠ #1281's rule, and the card's own reasoning. The arm is sliced to the
      probe's own block rather than grepping `refuse(` across the file, which
      would pass on the many legitimate refusals elsewhere (the sibling-satisfied
      arm this repository has been bitten by): the probe's verdict must reach
      `console.log` and nothing else.
    */
    const at = PROBE_SOURCE.indexOf("const foreignWarning = renderNoteForeignClaimWarning(");
    expect(at, "the probe's render call could not be found").toBeGreaterThan(-1);
    const block = PROBE_SOURCE.slice(at, at + 220);
    expect(block).toContain("console.log(foreignWarning)");
    expect(block).not.toContain("refuse(");
  });
});

/**
 * THE CLASS SWEEP'S ONE OTHER MEMBER (#1877, working law 7).
 *
 * The class: **a guard that is adequate, and reachable only on the road a batch
 * does not take.** The instance was the claim read on a bare heartbeat. Sweeping
 * `crew-shift-start.mts` by diffing the calls each of its two branches makes,
 * the open-pull-request warning (#1083) was its one other member — it ran in the
 * START branch and nowhere else, so a batch's SECOND card never met the reader
 * that exists because a shift once spent thirty-five minutes rebuilding a feature
 * that had merged seven minutes before it began.
 *
 * The three other start-only calls were opened and are deliberately NOT members:
 * `readRunSupersessions` judges stale ROWS and a heartbeat's row is the seat's
 * own and open; `backgroundWorkAllowed` judges `--kind`, which has no per-card
 * dimension; `crewCardHandbackInstruction` is instruction text rather than a
 * control, and printing it on every heartbeat would be noise.
 */
describe("the open-PR warning covers a re-declared card too (#1877)", () => {
  const SWEPT_SOURCE = readFileSync(resolve(__dirname, "../scripts/crew-shift-start.mts"), "utf8");

  it("reads open pull requests on BOTH roads — the start and the re-declaration", () => {
    /* Two call sites, one reader. One site is #1083's original; the second is
       this card's sweep. A single site is the hole this arm exists to hold shut. */
    expect(SWEPT_SOURCE.match(/readOpenPullRequests\(/g) ?? []).toHaveLength(2);
    expect(SWEPT_SOURCE.match(/renderCardClaimWarning\(/g) ?? []).toHaveLength(2);
  });

  it("warns on the re-declared card, and never refuses on it", () => {
    const at = SWEPT_SOURCE.indexOf("const reDeclaredPrWarning = renderCardClaimWarning(");
    expect(at, "the re-declaration's open-PR warning could not be found").toBeGreaterThan(-1);
    const block = SWEPT_SOURCE.slice(at, at + 200);
    /* The card the seat is MOVING to, not the one the row still names. */
    expect(block).toContain("renderCardClaimWarning(reDeclared,");
    expect(block).toContain("console.log(reDeclaredPrWarning)");
    expect(block).not.toContain("refuse(");
  });
});

/**
 * A LIVE CLAIM ON A **CLOSED** CARD IS SPENT (#1879).
 *
 * # What was measured, and it was not reasoned about
 *
 * On 2026-10-03 at 22:4xZ the foreign-claim probe #1877 had just added spoke
 * for the first time on the live board, about **#1870** — a card whose work had
 * merged and which had been CLOSED two hours earlier. The verdict was correct
 * by the board's own rule and simply not useful: that seat had released the
 * duplicate it stood off and never released its own finished card, which is the
 * ordinary end of a card rather than an oversight. **Nothing ages a claim but
 * the clock** ({@link CREW_CLAIM_LIVE_MS}, twelve hours), a finished seat owes a
 * {@link crewCardReleaseLine} comment, and no reader can see a merged pull
 * request as a handback (#1083, #1701).
 *
 * # ⚠ THIS CHANGE CAN ONLY EVER LOOSEN A GUARD, SO THE CONTROLS ARE THE WORK
 *
 * Every arm that was in this file before #1879 now names `state: "open"`
 * explicitly, which is the positive control stated sixteen times over: the
 * refusal and the probe must behave exactly as they always did on a card
 * somebody may really be building. The arms below are the ones that would
 * redden if the loosening escaped its one fact:
 *
 *   - the same claim on an **open** card still refuses and still warns;
 *   - the same claim on an **unread** state still refuses and still warns,
 *     because `unknown` is not `closed`;
 *   - only `closed` is silent.
 *
 * **Both consumers are driven**, and the second meets this case far more often:
 * the refusal sees only a card a ROW declares, while the probe sees every card
 * a NOTE cites, and 453 of 568 production rows cite a foreign card.
 */
describe("a live claim on a card that has CLOSED (#1879)", () => {
  /** #1870's real claim, as the card recorded it. */
  const CLAIM_AT = "2026-10-03T20:36:18Z";
  /** The moment the probe spoke about it, fifteen minutes later. */
  const NOW = Date.parse("2026-10-03T20:51:37Z");
  const RIVAL = "foreman-20261004-0635";
  const MINE = "seat1-20261004-062135";
  const RIVAL_CLAIM: CardComment[] = [{
    body: crewCardClaimLine(RIVAL, "2026-10-03T20:36:19Z"),
    createdAt: CLAIM_AT,
  }];

  const verdictOn = (state: CrewCardReadState) => readCardClaim({
    cardRef: "#1870", comments: RIVAL_CLAIM, state, mine: MINE, now: NOW,
  });

  /** The note that cited #1870 — row #566's own shape, read off production. */
  const CITING_NOTE = "#1870 shipped as PR #1873 (preflight green). Now #1872.";
  const probeOn = (state: CrewCardReadState) => {
    const found = readNoteForeignClaims({
      note: CITING_NOTE,
      /* The row was on a DIFFERENT card, which is the only reason #1870 is
         probed at all — a row's own declared card is never asked about. */
      ownCardRef: "#1872",
      mine: MINE,
      readComments: (card) => (card === 1870
        ? { comments: RIVAL_CLAIM, state }
        : { comments: [], state: "open" }),
      now: NOW,
    });
    return { found, line: renderNoteForeignClaimWarning(found, "#1872", NOW) };
  };

  it("is still LIVE by the clock — the premise the whole card rests on", () => {
    /*
      ⚠ WITHOUT THIS ARM EVERY SILENCE BELOW IS SATISFIED BY A STALE CLAIM, and
      the block would pass over a reader that never consulted the state at all.
      Derived from the constant rather than from a typed date.
    */
    expect(NOW - Date.parse(CLAIM_AT)).toBeLessThan(CREW_CLAIM_LIVE_MS);
  });

  it("reads as spent, carrying the seat and the time it was reached by", () => {
    /* A distinct verdict rather than a fold into `free`: `free` is NOBODY's
       live claim, and this is somebody's live claim the card's close has spent.
       This file has already paid for that fold once, on `mine`. */
    expect(verdictOn("closed")).toEqual({ kind: "spent", seat: RIVAL, at: CLAIM_AT });
  });

  describe("consumer 1 — the refusal", () => {
    it("refuses nothing on a closed card, and does not call the board unreadable either", () => {
      expect(renderCardClaimRefusal("#1870", verdictOn("closed"), NOW)).toBeNull();
      expect(renderCardClaimNote("#1870", verdictOn("closed"))).toBeNull();
    });

    it("still refuses the SAME claim on an OPEN card — the positive control", () => {
      expect(verdictOn("open")).toMatchObject({ kind: "claimed", seat: RIVAL });
      expect(renderCardClaimRefusal("#1870", verdictOn("open"), NOW)).toContain(RIVAL);
    });

    it("still refuses when the state could not be read — `unknown` is not `closed`", () => {
      /* The direction that matters: a `gh` that answered no state must leave
         this guard exactly as tight as it was before #1879. */
      expect(verdictOn("unknown")).toMatchObject({ kind: "claimed", seat: RIVAL });
      expect(renderCardClaimRefusal("#1870", verdictOn("unknown"), NOW)).toContain(RIVAL);
    });
  });

  describe("consumer 2 — the heartbeat's foreign-claim probe", () => {
    it("says nothing about a cited card that has closed", () => {
      const { found, line } = probeOn("closed");
      expect(found.claims).toEqual([]);
      /* And it is not reported as an unread board — the other way this could go
         wrong is swapping one line of noise for another. */
      expect(found.unreadable).toEqual([]);
      expect(line).toBeNull();
    });

    it("still speaks about the SAME cited card while it is OPEN — the positive control", () => {
      const { found, line } = probeOn("open");
      expect(found.claims).toEqual([{ card: 1870, seat: RIVAL, at: CLAIM_AT }]);
      expect(line).toContain("#1870 — " + RIVAL + ", 15 minutes ago");
    });

    it("still speaks when the state could not be read — `unknown` is not `closed`", () => {
      const { found } = probeOn("unknown");
      expect(found.claims).toEqual([{ card: 1870, seat: RIVAL, at: CLAIM_AT }]);
    });
  });

  describe("the writer, which decides out loud rather than by falling through", () => {
    /*
      ⚠ A NEW VERDICT KIND ACQUIRES BEHAVIOUR BY FALLING PAST FOUR `if`s IN
      `postCardClaim`, WHICH IS EXACTLY HOW A DECISION GETS MADE BY NOBODY. So
      the decision is pinned: a spent claim POSTS, the same as `free`, because a
      closed card carrying no claim at all has always posted on that road, and
      three closed-card behaviours out of one would be the drift. Whether a seat
      should be claiming a CLOSED card at all is a real question and a separate
      one — it is not narrowed under this card's name.
    */
    const AT = "2026-10-03T20:51:37Z";
    const post = (verdict: ReturnType<typeof verdictOn>) => {
      const posted: string[] = [];
      const outcome = postCardClaim({
        cardRef: "#1870", seat: MINE, verdict, at: AT,
        post: (_card, body) => { posted.push(body); },
      });
      return { outcome, posted };
    };

    it("posts on a spent claim, exactly as it does on a card nobody has claimed", () => {
      const spent = post(verdictOn("closed"));
      const free = post(readCardClaim({
        cardRef: "#1870", comments: [], state: "closed", mine: MINE, now: NOW,
      }));
      expect(spent.outcome.kind).toBe("posted");
      expect(spent.posted).toEqual([crewCardClaimLine(MINE, AT)]);
      expect(spent.posted).toEqual(free.posted);
    });

    it("and still refuses to paper over a LIVE claim on an open card", () => {
      const { outcome, posted } = post(verdictOn("open"));
      expect(outcome).toEqual({ kind: "skipped", why: "another seat holds it (" + RIVAL + ")" });
      expect(posted).toEqual([]);
    });
  });

  it("the rule and the three states have ONE owner, in shared", () => {
    /* Not a copy of `state === "closed"` in two modules: the close asks the
       same question of the same field (#1829), and the two readings must not be
       able to disagree about what a closed card means. */
    expect(cardStateSpendsClaim("closed")).toBe(true);
    for (const state of ["open", "unknown", "none"] as const) {
      expect(cardStateSpendsClaim(state), state + " must not spend a claim").toBe(false);
    }
  });
});
