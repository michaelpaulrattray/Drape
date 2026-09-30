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
  cardCommentListArgs,
  readCardClaim,
  readCardComments,
  renderCardClaimNote,
  renderCardClaimRefusal,
  type CardComment,
} from "../scripts/lib/cardClaimComments.mts";
import { CREW_CLAIM_LIVE_MS } from "../shared/crewCardBuildState";

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
      comments: [claim("seat1-20260930-155058", SEAT1_CLAIMED_AT)],
      mine: "foreman-20260930-1553",
      now: JUST_AFTER,
    });
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER)).toContain("2 minutes ago");
  });
});

describe("whose claim it is", () => {
  it("lets a seat re-declare a card it claimed itself", () => {
    /* THE ARM THAT KEEPS A BATCH WORKING. A seat heartbeats `--card` more than
       once on the same card; its own claim must never refuse it. */
    expect(readCardClaim({
      cardRef: "#1554",
      comments: [claim("seat2-20260930-173234", SEAT1_CLAIMED_AT)],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    })).toEqual({ kind: "free" });
  });

  it("compares seat names the one way, so case and padding are not a rival", () => {
    expect(readCardClaim({
      cardRef: "#1554",
      comments: [{ body: "CLAIMED —  SEAT2-20260930-173234 , 05:54Z", createdAt: SEAT1_CLAIMED_AT }],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    })).toEqual({ kind: "free" });
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
      comments: [{ body: `**CLAIMED — seat1-20260930-155058, ${SEAT1_CLAIMED_AT}**`, createdAt: SEAT1_CLAIMED_AT }],
      mine: "seat2-20260930-173234",
      now: JUST_AFTER,
    }).kind).toBe("claimed");
  });
});

describe("an unread board is not a free one", () => {
  it("returns unreadable rather than free when the comments could not be read", () => {
    const verdict = readCardClaim({ cardRef: "#1554", comments: null, mine: "x", now: JUST_AFTER });
    expect(verdict).toEqual({ kind: "unreadable" });
  });

  it("never refuses on it, and says so in words", () => {
    /*
      THE ARM THIS FILE EXISTS FOR, and it is the same one its sibling names: an
      unauthenticated `gh` prints nothing, which looks exactly like a card
      nobody has claimed. It must not stop a night (#504's ruling on the NEXT UP
      read), and it must not pass silently either.
    */
    const verdict = readCardClaim({ cardRef: "#1554", comments: null, mine: "x", now: JUST_AFTER });
    expect(renderCardClaimRefusal("#1554", verdict, JUST_AFTER)).toBeNull();
    const note = renderCardClaimNote("#1554", verdict)!;
    expect(note).toContain("unread one");
    expect(note).toContain("gh auth status");
  });

  it("says nothing at all about a free-text card ref", () => {
    /* There is no number to ask `gh` about, so there is nothing to read — the
       same answer `renderCardClaimWarning` gives, rather than noise dressed as
       diligence. */
    const verdict = readCardClaim({ cardRef: "his reply about the outfit court", comments: null, mine: "x" });
    expect(verdict).toEqual({ kind: "free" });
    expect(renderCardClaimNote("his reply", verdict)).toBeNull();
  });
});

describe("the reader's transport", () => {
  it("reads a gh --json comments document, and a bare array too", () => {
    const wrapped = fixture({ comments: [claim("seat1", SEAT1_CLAIMED_AT)] });
    expect(readCardComments(1554, wrapped)).toHaveLength(1);
    const bare = fixture([claim("seat1", SEAT1_CLAIMED_AT)]);
    expect(readCardComments(1554, bare)).toHaveLength(1);
  });

  it("answers null — never an empty list — when the fixture cannot be read", () => {
    expect(readCardComments(1554, join(tmpdir(), "no-such-file-1580.json"))).toBeNull();
    const notJson = fixture(null);
    writeFileSync(notJson, "{ not json", "utf8");
    expect(readCardComments(1554, notJson)).toBeNull();
  });

  it("asks gh for the card it was given, and for comments only", () => {
    /* Working law 5: the contract is proven on the call that goes out, not on a
       constant near it. */
    expect(cardCommentListArgs(1554)).toEqual(["issue", "view", "1554", "--json", "comments"]);
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
