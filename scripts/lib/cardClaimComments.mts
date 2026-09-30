/**
 * HAS ANOTHER SEAT ALREADY CLAIMED THIS CARD? — the comment read the shift-start
 * sequence never had (#1580).
 *
 * # The incident, read at the rows rather than at the card
 *
 * On 2026-09-30 two seats built #1554 at once: `seat1-20260930-155058` claimed
 * it at 05:54:21Z, `foreman-20260930-1553` claimed it at 05:56:59Z, and both
 * shipped a pull request for the same deletion. One seat's hour was spent and
 * the relay read two four-hundred-line diffs to keep one.
 *
 * ⚠ **THE MECHANICAL LOCK THAT EXISTS COULD NOT HAVE FIRED, AND THE REASON IS
 * NOT THE RACE.** `crew-shift-start.mts` already REFUSES when an open shift row
 * names the card being declared (#608), and its own docblock puts the residual
 * window at seconds while this collision was **two minutes thirty-eight seconds**
 * wide — comfortably inside what that guard catches. It never fired because
 * **neither row named #1554**: read at `crew_shift_runs`, run #449
 * (`foreman-20260930-1553`) declared `#1503` and run #450
 * (`seat1-20260930-155058`) declared `#1414`. #1554 was the Nth card of both
 * seats' batches, and a row names only the FIRST.
 *
 * **So a batch of N cards has one card's worth of lock and N−1 cards of
 * convention**, and the convention is a comment an agent writes by hand. That
 * is the hole, and it is structural rather than careless: both seats did what
 * the standing orders ask.
 *
 * # What this file is, and what it is not
 *
 * It is the transport and the judgement for the OTHER artifact — the
 * `CLAIMED — <seat>, <UTC time>` comment the standing orders already require.
 * `crew-shift-start.mts` asks it at every moment a card is DECLARED on a row,
 * which since #1580 includes a heartbeat that re-declares, so the Nth card of a
 * batch is asked the same question as the first.
 *
 * ⚠ **THE RULE IS NOT WRITTEN HERE.** `crewCardCommentFact` in
 * `shared/crewCardBuildState.ts` decides what a claim, a release and a refusal
 * ARE — anchored per block-opening line since #1559, measured over 84 real
 * comments — and `CREW_CLAIM_LIVE_MS` decides how long one lives. Only the
 * TRANSPORT is here. That matters because there is already a second transport
 * (`server/crew/cardActivity.ts`, the REST listing his page reads) and a second
 * copy of the RULE would be the drift working law 4 is about. The two differ
 * only in field names — `gh issue view` says `createdAt` where the REST listing
 * says `created_at` — and both hand the same judge the same three facts.
 *
 * It lives in a lib rather than inside the script for the reason its sibling
 * `cardClaimWarning.mts` does: the script's block sits past a live database
 * connection and `vitest.setup.ts` strips `DATABASE_URL`, so no suite could
 * ever reach it there. Every branch is driven in
 * `server/crewShiftCardClaimComments.test.ts`, fixture-fed, with no network and
 * no token.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CREW_CLAIM_LIVE_MS,
  crewCardCommentFact,
} from "../../shared/crewCardBuildState.js";
import { cardNumberOf } from "../../shared/crewShiftState.js";

/**
 * Twenty seconds — the same bound `cardClaimWarning.mts` sets, and for the same
 * reason: the worst this read may ever cost is a slow start.
 */
export const CARD_COMMENT_READ_TIMEOUT_MS = 20_000;

/**
 * THE `gh issue view` CALL, AS AN ARRAY, so a caller with its own reader spends
 * the same field list. `comments` is the whole of it: a claim is a body and a
 * time, and asking for more would be asking for a budget this read does not
 * need.
 */
export function cardCommentListArgs(card: number): readonly string[] {
  return ["issue", "view", String(card), "--json", "comments"];
}

/** One comment, as `gh issue view --json comments` hands it back. */
export interface CardComment {
  readonly body?: string;
  readonly createdAt?: string;
}

/**
 * The card's comments, from `gh` or from a fixture — `null` when the answer
 * could not be read at all.
 *
 * ⚠ **THE THREE OUTCOMES STAY DISTINCT**, exactly as they do for the open-PR
 * read beside it: "no comments" and "the read failed" are the same picture to a
 * caller that collapses them, and the second is a board nobody looked at. An
 * absent, unauthenticated, offline or slow `gh` answers `null`, and the caller
 * says so in words rather than reporting a free card.
 */
export function readCardComments(
  card: number,
  fixturePath?: string | null,
  cwd?: string | null,
): CardComment[] | null {
  if (fixturePath) {
    try {
      const parsed = JSON.parse(readFileSync(resolve(fixturePath), "utf8"));
      const rows = Array.isArray(parsed) ? parsed : parsed?.comments;
      return Array.isArray(rows) ? (rows as CardComment[]) : null;
    } catch {
      return null;
    }
  }
  try {
    /* `gh` with no shell — it is an .exe, and the shell form emits DEP0190. */
    const out = execFileSync("gh", [...cardCommentListArgs(card)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CARD_COMMENT_READ_TIMEOUT_MS,
      ...(cwd ? { cwd } : {}),
    });
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed) ? parsed : parsed?.comments;
    return Array.isArray(rows) ? (rows as CardComment[]) : null;
  } catch {
    return null;
  }
}

/** What the board says about this card right now, for this seat. */
export type CardClaimVerdict =
  /** Nothing to say: no card number, or no live claim by anybody else. */
  | { readonly kind: "free" }
  /** The board could not be read. Never a refusal — an unread board is not a clean one. */
  | { readonly kind: "unreadable" }
  /** Somebody else has their hands on it. */
  | { readonly kind: "claimed"; readonly seat: string | null; readonly at: string };

/** Two seat names are the same seat, compared the one way. */
function sameSeat(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * IS ANOTHER SEAT LIVE ON THIS CARD — the judgement, pure over facts already read.
 *
 * Newest comment wins, exactly as `crewCardBuildState` decides it: a RELEASE or
 * a REFUSAL newer than a claim puts the card back on offer, so only the newest
 * fact of the card's own comments is consulted.
 *
 * ⚠ **AN UNATTRIBUTED CLAIM COUNTS AS SOMEBODY ELSE'S**, and the asymmetry is
 * the reason. A claim whose seat could not be parsed is either another seat's
 * (refusing is right) or this seat's own earlier line (refusing costs one word
 * — `--same-card`, which the refusal names). A missed claim costs an hour of a
 * seat and a duplicate pull request; a spurious refusal costs a flag. The cheap
 * mistake is the one to make.
 */
export function readCardClaim(input: {
  readonly cardRef: string | null | undefined;
  readonly comments: readonly CardComment[] | null;
  /** This shift's own id, so its own claim is never read as a rival's. */
  readonly mine?: string | null;
  readonly now?: number;
}): CardClaimVerdict {
  const card = cardNumberOf(input.cardRef);
  /* A free-text card ref has no number to ask `gh` about, so there is nothing
     to read and nothing to say — the same answer its sibling gives. */
  if (card === null) return { kind: "free" };
  if (input.comments === null) return { kind: "unreadable" };

  const now = input.now ?? Date.now();
  const newest = input.comments
    .map((comment) =>
      crewCardCommentFact({
        card,
        body: typeof comment.body === "string" ? comment.body : "",
        createdAt: typeof comment.createdAt === "string" ? comment.createdAt : "",
      }),
    )
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null)
    /* A verdict names a PULL REQUEST, never a card (`CrewCardCommentFact`'s own
       note), and this reader is asked about cards — so it is dropped rather
       than ranked, or the newest thing on a card could be an answer to a
       different question. */
    .filter((fact) => fact.kind !== "verdict")
    .sort((a, b) => b.at.localeCompare(a.at))[0];

  if (!newest || newest.kind !== "claim") return { kind: "free" };
  if (sameSeat(newest.seat, input.mine)) return { kind: "free" };

  const atMs = Date.parse(newest.at);
  if (!Number.isFinite(atMs) || now - atMs > CREW_CLAIM_LIVE_MS) return { kind: "free" };
  return { kind: "claimed", seat: newest.seat, at: newest.at };
}

/** Whole minutes, for a message a person reads at a glance. */
function agePhrase(at: string, now: number): string {
  const ms = now - Date.parse(at);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "less than a minute ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/**
 * The refusal, in the words the seat needs — or `null` when there is nothing to
 * refuse.
 *
 * ⚠ **IT NAMES THE OTHER SEAT**, which is the whole point: a refusal that says
 * only "taken" leaves a seat unable to tell a rival from its own stale line, and
 * the `--same-card` escape unreadable.
 *
 * An UNREADABLE board is returned as a warning by {@link renderCardClaimNote}
 * and never as a refusal — `gh` being unauthenticated must never stop a night,
 * which is #504's own ruling on the NEXT UP read wearing a different hat.
 */
export function renderCardClaimRefusal(
  cardRef: string | null | undefined,
  verdict: CardClaimVerdict,
  now: number = Date.now(),
): string | null {
  if (verdict.kind !== "claimed") return null;
  const who = verdict.seat ?? "a seat that did not name itself";
  return `${cardRef} is already claimed by ${who}, ${agePhrase(verdict.at, now)} (${verdict.at}).`
    + "\n\n   Two seats on one card is a duplicated session. On 2026-09-30 it cost a seat an hour"
    + "\n   and the relay two four-hundred-line diffs for one merge (#1580); neither shift's ROW"
    + "\n   named the card, because it was the Nth of a batch, so nothing could refuse."
    + "\n\n   Take the next card instead, and say in your entry that you stood off this one."
    + "\n   If that claim is yours under another name, or the other seat has finished, pass --same-card.";
}

/** The line to PRINT when the board could not be read — never a refusal. */
export function renderCardClaimNote(
  cardRef: string | null | undefined,
  verdict: CardClaimVerdict,
): string | null {
  if (verdict.kind !== "unreadable") return null;
  return `\n⚠ could not read ${cardRef}'s comments, so nobody checked whether another seat has`
    + "\n  claimed it. That is not a free card — it is an unread one (`gh auth status`).";
}
