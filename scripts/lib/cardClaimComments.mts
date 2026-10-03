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
  crewCardClaimLine,
  crewCardCommentFact,
  crewCardReleaseLine,
} from "../../shared/crewCardBuildState.js";
import { cardNumberOf, cardNumbersNamedIn } from "../../shared/crewShiftState.js";

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
  /** Nothing to say: no card number, or nobody's live claim — so nothing to refuse. */
  | { readonly kind: "free" }
  /**
   * THIS seat's own live claim is the newest fact (#1735).
   *
   * ⚠ **It was folded into `free` until the writer below existed, and the fold
   * was right while nothing acted on the answer.** `free` meant *nothing to
   * refuse*, and a seat's own claim is indeed nothing to refuse. But a caller
   * that POSTS a claim on `free` would post one on every heartbeat that
   * re-declares the card, so the two reasons for not refusing had to stop being
   * one word. A stale claim of this seat's own is still `free`: it has aged out
   * of the board's window, and a fresh one is exactly what should be written.
   */
  | { readonly kind: "mine"; readonly at: string }
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

  const atMs = Date.parse(newest.at);
  const live = Number.isFinite(atMs) && now - atMs <= CREW_CLAIM_LIVE_MS;
  /* ⚠ THE LIVENESS TEST MOVED ABOVE THIS LINE (#1735) AND THE REFUSAL DID NOT
     MOVE WITH IT. `sameSeat` returned `free` before the window was consulted,
     which was right for a reader and wrong for a writer: a seat's own STALE
     claim has aged off the board and wants a fresh one, while its own LIVE
     claim wants silence. Both still refuse nothing, which is the only thing
     the refusal path ever asked. */
  if (sameSeat(newest.seat, input.mine)) return live ? { kind: "mine", at: newest.at } : { kind: "free" };
  if (!live) return { kind: "free" };
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
    + "\n   If that claim is yours under another name, or the other seat has finished, pass --same-card."
    /* ⚠ #1701's SECOND SIGNAL, named where it actually bites. This refusal fired
       on #1602 nine hours after the other seat had FINISHED and posted its pull
       request, because the orders tell a seat it may release "or the PR" and no
       reader can see a pull request as a release. A shift reading only the clock
       takes `--same-card` and the lock is gone; a shift told what is missing
       knows which three artifacts answer the question honestly. */
    + `\n\n   ⚠ A finished seat owes a \`${crewCardReleaseLine()}\` comment and an open pull`
    + "\n   request is NOT one — a pull request may be a half-finished slice, so it is read"
    + "\n   as a warning and never as a handback (#1083, #1701). Before --same-card on the"
    + "\n   clock alone, read the three artifacts that settle it: that seat's row is closed,"
    + "\n   its pull request is merged, and its body puts your slice out of scope.";
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

/**
 * THE WRITE SIDE — POSTING THE CLAIM, SO IT EXISTS BEFORE THE BUILD DOES (#1735).
 *
 * # The incident this closes, at the timestamps
 *
 * Two seats built #1725 in full on 2026-10-01, and the loser found out when the
 * winner merged:
 *
 * ```
 * 21:14:00Z   the other seat branched on #1725 — and posted NO claim
 * 21:41:33Z   seat 1 ran all three checks of the claim rule. All three were CLEAN.
 * 21:42:05Z   the other seat's pull request appeared                      (+32 s)
 * 21:51:20Z   it merged; seat 1's finished build — code, a guard, sabotage
 *             and a two-theme render — was thrown away
 * ```
 *
 * ⚠ **THE CARD'S OWN FRAMING WAS CORRECTED BY THE OTHER SEAT, AGAINST ITS OWN
 * INTEREST, AND THE CORRECTION IS WHAT THIS CODE ANSWERS.** The card read the
 * failure as a 32-second simultaneous start. It was not: **twenty-seven minutes**
 * separated that branch from seat 1's check, and all three checks came back clean
 * **because no claim had been posted**, not because the rule is blind. In its own
 * words: *"I ran the first two checks of the two-seat rule, found it free, and
 * skipped the third. The proximate cause is my missing comment."*
 *
 * **So the rule's defect is not its width — it is that it is CHECKED by machinery
 * and ANNOUNCED by hand.** A seat that performs two of three acts believes it has
 * complied, and the claim it owes benefits only *other* seats, which is exactly
 * the kind of act that gets skipped. That is invariant 7 with a twist: not a
 * control nobody invokes, but one invoked too late to bind.
 *
 * # Why it is posted HERE
 *
 * The card's recommendation is that the runner post the claim at launch, before
 * any seat reads anything. The runner is `.agents/foreman/foreman-runner.ps1`,
 * which is untracked and not a seat's to edit. **This is the same act at the
 * earliest TRACKED moment**: declaring a card on the Desk row is the one thing a
 * seat does *before any code*, this module is already the reader asked at that
 * moment, and the standing orders already require the comment. Nothing new is
 * asked of a seat — the act it was asked to remember is simply performed.
 *
 * The window left is the few hundred milliseconds between this module's READ and
 * its POST, against twenty-seven minutes measured, and unbounded for a seat that
 * never comments at all. **That residue is real and is not claimed to be closed**;
 * the runner remains the only place it can be.
 *
 * # ⚠ THE LINE IS PROVEN READABLE BEFORE IT IS POSTED, NEVER AFTER
 *
 * The body is composed here and then handed to `crewCardCommentFact` — the
 * board's own judge — and a line that does not read back as a claim is **not
 * posted at all**. That is assert-at-the-wire (invariant 5), and it is the arm
 * this file most needs: #1701 measured the cost of a writer and a reader keeping
 * two copies of one spelling, where **0 of 5 refusals on #1669 were visible** to
 * the reader that looks for them. A claim nobody can read is worse than no claim,
 * because the seat that wrote it believes the card is locked.
 */

/** Twenty seconds, the same bound the read side sets, and for the same reason. */
export const CARD_CLAIM_POST_TIMEOUT_MS = 20_000;

/** What happened when the claim was posted — never a throw, on any road. */
export type CardClaimPostOutcome =
  /** Posted. The board names this seat on the card from now on. */
  | { readonly kind: "posted"; readonly body: string }
  /** Deliberately not posted, with the reason a seat reads. */
  | { readonly kind: "skipped"; readonly why: string }
  /** `gh` refused, is absent, or is unauthenticated. A warning, never a failure. */
  | { readonly kind: "failed"; readonly body: string; readonly why: string };

/**
 * The claim line — {@link crewCardClaimLine}'s spelling, not a second one.
 *
 * ⚠ **THIS WAS A LITERAL `CLAIMED — ${seat}, ${at}` UNTIL #1701 LANDED ON MAIN
 * WHILE THIS BRANCH WAS OPEN, AND LEAVING IT WOULD HAVE SHIPPED THE DEFECT
 * #1701 EXISTS TO REMOVE.** That card declared the three handback words once in
 * `shared/crewCardBuildState.ts` and built the board's readers from them,
 * precisely so a writer and a reader could not hold two copies of one spelling
 * — the shape that left **0 of 5 refusals on #1669 invisible**. A second
 * literal here, in the module that WRITES the claim, is that mistake with the
 * ink still wet (working law 4).
 *
 * So this is now a thin alias, kept only because {@link postCardClaim}'s seam
 * names a `(seat, at) => string` and a caller reading this file should see what
 * it posts without crossing into `shared/`. `postCardClaim` PROVES the result
 * through the board's own judge rather than trusting either sentence.
 */
export function cardClaimBody(seat: string, at: string): string {
  return crewCardClaimLine(seat, at);
}

/** The `gh` call, as an array, so a caller with its own transport spends the same one. */
export function cardClaimPostArgs(card: number, body: string): readonly string[] {
  return ["issue", "comment", String(card), "--body", body];
}

/**
 * POST THIS SEAT'S CLAIM — pure in its decisions, impure only in the one call.
 *
 * It declines in five states and each is a sentence rather than silence: no card
 * number to post against, a row naming no shift, a dry run, a board this seat
 * already holds, and a board that could not be read — because **an unread board
 * is not a free one**, and claiming a card whose comments were never seen is how
 * two seats both come to believe they hold it.
 */
export function postCardClaim(input: {
  readonly cardRef: string | null | undefined;
  readonly seat: string | null | undefined;
  readonly verdict: CardClaimVerdict;
  readonly at: string;
  /** A dry run says what it would do and writes nothing (#288). */
  readonly dryRun?: boolean;
  /** Injected by the suite, so no arm reaches the network. */
  readonly post?: (card: number, body: string) => void;
  /*
    ⚠ **A SEAM FOR THE SELF-CHECK, AND IT IS THE ONLY REASON IT EXISTS.** The
    check below is the one thing standing between a drifted spelling and a claim
    nobody can read, and a writer that cannot be made to drift cannot prove it —
    working law 3: a backstop whose only test runs through the thing that usually
    behaves is an untested backstop. Production passes nothing and gets
    {@link cardClaimBody}.
  */
  readonly bodyFor?: (seat: string, at: string) => string;
  readonly cwd?: string | null;
}): CardClaimPostOutcome {
  const card = cardNumberOf(input.cardRef);
  if (card === null) return { kind: "skipped", why: "no card number to claim" };
  const seat = typeof input.seat === "string" ? input.seat.trim() : "";
  if (seat === "") return { kind: "skipped", why: "this row names no shift, so a claim would name nobody" };
  if (input.verdict.kind === "mine") {
    return { kind: "skipped", why: `already claimed by this seat at ${input.verdict.at}` };
  }
  if (input.verdict.kind === "unreadable") {
    return { kind: "skipped", why: "the board could not be read, and an unread board is not a free one" };
  }
  if (input.verdict.kind === "claimed") {
    /* Unreachable through the shift script, which refuses first — stated rather
       than assumed, because a second caller must not be able to paper over a
       rival's live claim with its own. */
    return { kind: "skipped", why: `another seat holds it (${input.verdict.seat ?? "unnamed"})` };
  }

  const body = (input.bodyFor ?? cardClaimBody)(seat, input.at);
  /* ⚠ THE SELF-CHECK, against the board's own judge rather than a copy of it. */
  const readsBack = crewCardCommentFact({ card, body, createdAt: input.at });
  if (readsBack?.kind !== "claim") {
    return {
      kind: "skipped",
      why: `the line this would post does not read back as a claim (${JSON.stringify(body)})`
        + " — nothing was posted, because a claim the board cannot see is worse than none (#1701)",
    };
  }

  if (input.dryRun === true) return { kind: "skipped", why: `dry run — would post ${JSON.stringify(body)}` };

  const post = input.post ?? ((number: number, text: string) => {
    /* `gh` with no shell — it is an .exe, and the shell form emits DEP0190. */
    execFileSync("gh", [...cardClaimPostArgs(number, text)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CARD_CLAIM_POST_TIMEOUT_MS,
      ...(input.cwd ? { cwd: input.cwd } : {}),
    });
  });
  try {
    post(card, body);
    return { kind: "posted", body };
  } catch (cause) {
    return { kind: "failed", body, why: (cause as Error).message };
  }
}

/**
 * The line to PRINT for an outcome — or `null` when there is nothing worth a
 * seat's attention.
 *
 * ⚠ **A FAILED POST TELLS THE SEAT TO POST IT BY HAND AND NEVER STOPS THE
 * NIGHT.** `gh` being absent or unauthenticated must not fail a Desk row — that
 * is #504's ruling on the NEXT UP read wearing a third hat — but a seat that
 * believes the tool claimed its card when it did not is in the exact state this
 * module exists to prevent, so the warning carries the command to run.
 */
export function renderCardClaimPost(
  cardRef: string | null | undefined,
  outcome: CardClaimPostOutcome,
): string | null {
  if (outcome.kind === "posted") {
    return `claimed ${cardRef} on the card: ${outcome.body}`
      + "\n  Posted for you — you do not need to comment it by hand.";
  }
  if (outcome.kind === "failed") {
    return `\n⚠ could not post this seat's claim on ${cardRef} (${outcome.why.split("\n")[0]}).`
      + "\n  POST IT BY HAND BEFORE YOU BUILD, or another seat reads the card as free:"
      + `\n    gh issue comment ${cardNumberOf(cardRef) ?? "<n>"} --body ${JSON.stringify(outcome.body)}`;
  }
  /* A skip for a reason the seat can act on is worth a line; the ordinary ones
     (no card, already mine) are not, and would be noise on every heartbeat. */
  if (outcome.why.startsWith("the line this would post")) {
    return `\n⚠ this seat's claim on ${cardRef} was NOT posted: ${outcome.why}`;
  }
  if (outcome.why.startsWith("dry run")) return `claim: ${outcome.why}`;
  return null;
}

/**
 * ⚠ **THE FOREIGN-CLAIM PROBE — THE HEARTBEAT THAT DOES *NOT* RE-DECLARE
 * (#1877), WHICH IS THE ONLY ROAD TO A CARD THAT HAD NOTHING ON IT.**
 *
 * # What was measured, and why the obvious repair is not here
 *
 * On 2026-10-03 two seats built #1872. Everything above this line was already
 * in the tree and would have refused the duplicate — driven against the real
 * comments at the real moment, `readCardClaim` returns
 * `{"kind":"claimed","seat":"foreman-20261004-0635"}` and
 * `renderCardClaimRefusal` says *"already claimed … 13 minutes ago"*. **The
 * guard was adequate and was never REACHED**: `assertCardIsFree` runs on a
 * heartbeat only when `--card` re-declares, the seat passed `--note` alone, and
 * its row's `cardRef` never left `#1870` while its own note said *"Now #1872"*.
 * So the claim it posted by hand met nothing, and two live `CLAIMED —` lines sat
 * on one card for nineteen minutes.
 *
 * ⚠ **THE FIRST DESIGN WAS MEASURED AND DISCARDED, AND THE NUMBER IS KEPT
 * BECAUSE IT IS THE REASON THIS FILE IS SHAPED THIS WAY.** The cheap repair is
 * to warn whenever a note names a card the row does not. Read over all 568
 * production rows: **453 (79.8%) name a foreign card** — shifts cite the card
 * they filed, the sibling, the precedent and the pull request as a matter of
 * course. A warning on four heartbeats in five is ignored by the second day, and
 * is then worse than the silence it replaced.
 *
 * # So the heuristic decides what to ASK, and only a FACT decides what to SAY
 *
 * The note gives candidates (`cardNumbersNamedIn`, deliberately wide — #1094
 * licenses exactly that width for a warning). The BOARD gives the answer. This
 * speaks only when a candidate carries another seat's LIVE claim, which is
 * neither a guess nor a clock: it is the same `readCardClaim` verdict the start
 * path refuses on. A false candidate costs one `gh` read and no words.
 *
 * ⚠ **IT WARNS AND NEVER REFUSES, which is the card's own reasoning and
 * #1281's rule**: a refused heartbeat goes quiet on his Working-now table and
 * reads as a dead shift, so the cure would present as the disease. A seat that
 * really is sharing a card, or citing one somebody else happens to hold, must
 * not lose its check-in over it — it reads the line and decides.
 */
export const HEARTBEAT_FOREIGN_CLAIM_PROBE_MAX = 4;

/** One foreign card the board says somebody else has their hands on. */
export interface ForeignClaim {
  readonly card: number;
  readonly seat: string | null;
  readonly at: string;
}

/**
 * The foreign cards a note names that another seat holds a live claim on.
 *
 * ⚠ **THE CAP IS A BUDGET AND NOT A JUDGEMENT.** GitHub's allowance is ONE
 * account shared by every seat and the crew, and its burst limit tripped three
 * times in two hours on 2026-09-26 — so a note naming eight cards (row #2 names
 * exactly eight) must not spend eight reads on a heartbeat. Lowest first, which
 * is arbitrary and said to be: a note naming more cards than this is citing
 * precedent rather than moving work, and the row read in `assertCardIsFree`
 * still covers the card the seat declared.
 *
 * `readComments` is injected so every branch is driven from a fixture with no
 * network and no token (`server/crewShiftCardClaimComments.test.ts`).
 */
export function readNoteForeignClaims(input: {
  readonly note: string | null | undefined;
  /** The card the row already names — never probed, it is this seat's own. */
  readonly ownCardRef: string | null | undefined;
  /** The row's shift id, so this seat's own claim elsewhere is not a rival. */
  readonly mine: string | null;
  readonly readComments: (card: number) => readonly CardComment[] | null;
  readonly now?: number;
  readonly max?: number;
}): { readonly claims: readonly ForeignClaim[]; readonly unreadable: readonly number[] } {
  const own = cardNumberOf(input.ownCardRef);
  const candidates = cardNumbersNamedIn(input.note)
    .filter((card) => card !== own)
    .slice(0, input.max ?? HEARTBEAT_FOREIGN_CLAIM_PROBE_MAX);

  const claims: ForeignClaim[] = [];
  const unreadable: number[] = [];
  for (const card of candidates) {
    const verdict = readCardClaim({
      cardRef: `#${card}`,
      comments: input.readComments(card),
      mine: input.mine,
      now: input.now,
    });
    /* `mine` and `free` are both silence, and for different reasons — the type
       above says which. Only another seat's live hands are worth a word. */
    if (verdict.kind === "claimed") claims.push({ card, seat: verdict.seat, at: verdict.at });
    else if (verdict.kind === "unreadable") unreadable.push(card);
  }
  return { claims, unreadable };
}

/**
 * The warning to PRINT, or `null` when the board had nothing to say.
 *
 * It names the seat and the age because that is what makes the line actionable
 * rather than alarming: a claim three minutes old is somebody at a keyboard, and
 * one eleven hours old is probably a finished shift that never released.
 */
export function renderNoteForeignClaimWarning(
  found: { readonly claims: readonly ForeignClaim[]; readonly unreadable: readonly number[] },
  ownCardRef: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (found.claims.length === 0) {
    /* ⚠ THE THREE OUTCOMES STAY DISTINCT, as they do for every reader in this
       file: an unread board is not a clean one, and collapsing them is how a
       shift reads an unauthenticated `gh` as "no collision". */
    if (found.unreadable.length > 0) {
      return `\n⚠ could not read the comments on ${found.unreadable.map((c) => `#${c}`).join(", ")},`
        + " so nobody checked whether another seat is on them (`gh auth status`).";
    }
    return null;
  }
  const them = found.claims
    .map((claim) => `   #${claim.card} — ${claim.seat ?? "a seat that did not name itself"},`
      + ` ${agePhrase(claim.at, now)} (${claim.at})`)
    .join("\n");
  return `\n⚠ THIS NOTE NAMES A CARD ANOTHER SEAT HAS ITS HANDS ON:\n${them}\n`
    + `\n   This row is on ${ownCardRef ?? "(no card)"}, so nothing refused — the row read and the`
    + "\n   claim read only ever cover the card a row DECLARES (#1580). On 2026-10-03 that gap"
    + "\n   cost a builder seat half a session: two live CLAIMED lines sat on #1872 for nineteen"
    + "\n   minutes because the second seat claimed by hand and its row never named the card."
    + "\n\n   If you have MOVED onto one of those cards, stop and stand off it — or re-declare it"
    + "\n   so the refusal can do its job:"
    + "\n     scripts/crew-shift-start.mts --shift <id> --note '…' --card '#N'"
    + "\n   If you are only CITING it, this line is noise and costs you nothing.";
}
