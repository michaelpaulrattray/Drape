/**
 * IS SOMEBODY ALREADY BUILDING THIS CARD? — THE ONE READER EVERY QUEUE READER
 * CONSULTS (#1094, piece 2).
 *
 * His order, 2026-09-26 (terminal), verbatim: ***"work on 1094 and 1307 next so
 * the desk shows whats built"*** — said after his Background Work panel offered
 * him #1231, #1217, #1258, #1248 and #1288 as tonight's work while every one of
 * them had a pull request in the merge queue or a refusal written on the card.
 * Piece 1 (PR #1338) made his PAGE say it. This is the other half: **the five
 * readers that OFFER a shift a card stop offering one somebody is already on.**
 *
 * # ⚠ WHY THIS IS ONE MODULE AND NOT FIVE GREPS — the card's own sentence
 *
 * The re-scope: *"All from ONE reader (`findCardPullRequests` plus the
 * claim/refusal comment reader), never five greps."* Before this file the five
 * readers disagreed about the same English question in five ways — three read
 * open pull requests and two read nothing, and none of them read a CLAIM at
 * all, which is the artifact that existed at the moment the #1094 duplicate
 * actually happened (the 00:13:59 measurement on the card: a claim comment was
 * on the card and the second builder opened its PR eighty-five seconds later).
 * Working law 4, applied to a judgement rather than to a list.
 *
 * So: the JUDGEMENT is `shared/crewCardBuildState.ts` — one owner, shared with
 * his page, so a phrase a shift reads and a phrase he reads can never differ.
 * What is here is the two READS the scripts need and nothing else:
 *
 *  - the open pull requests — `readOpenPullRequests` in `lib/cardClaimWarning.mts`,
 *    the existing `gh pr list` with the existing field list. Not re-declared
 *    here: the branch limb of `pullRequestBuildsCard` depends on `headRefName`
 *    being in that list, and a second copy of it is the mirror that drops a limb;
 *  - the card comments — `gh api repos/{owner}/{repo}/issues/comments`, mapped
 *    through `factFromCommentRow`, the SAME row-to-fact mapping his page's
 *    `server/crew/cardActivity.ts` uses. One REST shape, one parser, two
 *    transports (`fetch` there, `gh api` here, which is what a script has auth
 *    for).
 *
 * # ⚠ THE THREE ANSWERS ARE KEPT APART, AND THAT IS THE WHOLE DOCTRINE HERE
 *
 * *Nobody is on this card*, *the board was read and it is clean*, and **the
 * board was NOT READ** are three different facts, and the third one looks
 * exactly like the second to any caller that maps a failure to an empty list.
 * That is #1083's own class and the reason `openPullRequestsVerdict` exists one
 * module along. So every read here answers `Unreadable` with a reason a shift
 * can act on, and `buildBoard` carries those reasons out to the renderer.
 *
 * # ⚠ WHAT A READER MAY DO WITH THE ANSWER, AND WHAT IT MAY NOT
 *
 * `buildStateHoldsOffOffer` (in `shared/`, beside the judgement) says which
 * states mean hands off, and it is TWO of the three: an open pull request and a
 * live claim. A refusal annotates and is still offered — its docblock has the
 * reasoning, and it is not a preference.
 *
 * ⚠ **AND A READER THAT WITHHOLDS WORK MUST NEVER WITHHOLD IT ON A READ IT DID
 * NOT TAKE.** `buildBoard` with an unreadable half answers `null` for every
 * card and says why: a `gh` blip must not empty a shift's queue. The one
 * exception is `next-up-escalation.mts`, which spends a Fable session and whose
 * own docblock rules that every unreadable state answers `NONE` — a gate that
 * cannot see the board does not buy an expensive session on it. That asymmetry
 * is deliberate and is written down in both places.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CARD_ACTIVITY_BOOT_HOURS,
  CARD_ACTIVITY_MAX_PAGES,
  CARD_ACTIVITY_PAGE,
  activitySince,
  factFromCommentRow,
} from "../../server/crew/cardActivity.js";
import {
  buildStateHoldsOffOffer,
  crewCardBuildPhrase,
  crewCardBuildState,
  handVerdictForPullRequest,
  type CrewBuildPullRequest,
  type CrewCardBuildState,
  type CrewCardCommentFact,
} from "../../shared/crewCardBuildState.js";

import { OPEN_PR_LIST_ARGS, type OpenPullRequest } from "./cardClaimWarning.mts";
import { isUnreadable, type Unreadable } from "./shiftDigest.mts";

/**
 * Thirty seconds. Three pages of a hundred comments is well under a second on
 * this repository; the number is here so a hung call costs a wait a shift can
 * sit through rather than a session, the same bar `OPEN_PR_READ_TIMEOUT_MS` sets
 * one module along.
 */
export const CARD_COMMENT_READ_TIMEOUT_MS = 30_000;

/**
 * The comment window, DERIVED from the reader his page uses rather than typed
 * again — two windows would mean a shift and his page disagreeing about whether
 * a claim exists, which is the one thing this card is about.
 *
 * ⚠ **THE SAME STATED LIMIT APPLIES HERE AND IS NOT NEW: a claim or a refusal
 * older than this window is not seen.** A live claim is capped at twelve hours
 * by `CREW_CLAIM_LIVE_MS` anyway, so the window only ever bounds how far back a
 * REFUSAL can be read — and an unseen refusal leaves a card on offer with no
 * phrase, which is the direction this is built to fail in.
 */
export const CARD_COMMENT_WINDOW_HOURS = CARD_ACTIVITY_BOOT_HOURS;

/**
 * THE CARD COMMENTS, from `gh api` or from a fixture — `null` when the answer
 * could not be read at all.
 *
 * ⚠ **`gh api` AND NOT `fetch`, WHICH IS THE CARD'S OWN WORD** (*"through `gh
 * api` REST calls only"*). A script has `gh`'s credential and no
 * `GITHUB_READ_TOKEN`; `server/crew/cardActivity.ts` has the opposite. The row
 * shape and the parser are shared, so only the transport differs.
 *
 * `{owner}`/`{repo}` are `gh api`'s own placeholders, resolved from the
 * repository the call runs in — so this reader cannot name another repository's
 * comments beside this one's cards, and the `cwd` parameter is what makes that
 * true for a caller given a `--root`.
 *
 * `fixturePath` exists so every branch is drivable without a network, a token
 * or a live board — the same reason `readOpenPullRequests` takes one.
 */
export function readCardComments(
  fixturePath?: string | null,
  cwd?: string | null,
  nowMs: number = Date.now(),
): CrewCardCommentFact[] | null {
  if (fixturePath) {
    try {
      const rows = JSON.parse(readFileSync(resolve(fixturePath), "utf8"));
      if (!Array.isArray(rows)) return null;
      return factsFromRows(rows);
    } catch {
      return null;
    }
  }
  return readCardCommentsWith(
    (args) => execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: CARD_COMMENT_READ_TIMEOUT_MS,
      /* Three pages of a hundred comment bodies is comfortably past the 1 MB
         default, and an exceeded buffer is a THROW — i.e. an unread board. */
      maxBuffer: 32 * 1024 * 1024,
      ...(cwd ? { cwd } : {}),
    }),
    nowMs,
  );
}

/**
 * THE CALL, AS AN ARRAY — `gh api`'s own `{owner}`/`{repo}` placeholders, so the
 * reader cannot name another repository's comments beside this one's cards.
 */
export function cardCommentArgs(sinceIso: string, page: number): string[] {
  return [
    "api",
    `repos/{owner}/{repo}/issues/comments?since=${sinceIso}&per_page=${CARD_ACTIVITY_PAGE}`
    + `&sort=created&direction=desc&page=${page}`,
  ];
}

/**
 * THE SAME READ THROUGH AN INJECTED `gh` — for the caller that takes its
 * transport as a parameter (`crewQueueCount.mts`, so his switch counts stay
 * drivable without a network). One args list, one parser, two transports.
 */
export function readCardCommentsWith(
  gh: (args: string[]) => string,
  nowMs: number = Date.now(),
): CrewCardCommentFact[] | null {
  const since = activitySince(nowMs - CARD_COMMENT_WINDOW_HOURS * 3_600_000);
  const rows: unknown[] = [];
  try {
    for (let page = 1; page <= CARD_ACTIVITY_MAX_PAGES; page += 1) {
      const parsed = JSON.parse(gh(cardCommentArgs(since, page)));
      if (!Array.isArray(parsed)) return null;
      rows.push(...parsed);
      /* A short page is the last page — no Link header parsing needed. */
      if (parsed.length < CARD_ACTIVITY_PAGE) break;
    }
  } catch {
    return null;
  }
  return factsFromRows(rows);
}

/**
 * THE OPEN PULL REQUESTS THROUGH AN INJECTED `gh`, for the same caller and the
 * same reason — through `OPEN_PR_LIST_ARGS`, never a second field list.
 */
export function readOpenPullRequestsWith(
  gh: (args: string[]) => string,
): OpenPullRequest[] | null {
  try {
    const rows = JSON.parse(gh([...OPEN_PR_LIST_ARGS]));
    return Array.isArray(rows) ? (rows as OpenPullRequest[]) : null;
  } catch {
    return null;
  }
}

/** Every row that IS a fact, in the order GitHub returned them. Exported for the arms. */
export function factsFromRows(rows: readonly unknown[]): CrewCardCommentFact[] {
  const facts: CrewCardCommentFact[] = [];
  for (const row of rows) {
    const fact = factFromCommentRow(row);
    if (fact !== null) facts.push(fact);
  }
  return facts;
}

/**
 * THE SAME MAPPING `openPullRequestsVerdict` MAKES, for the comment read — and
 * it lives here, beside the reader, for that function's own recorded reason: the
 * first shape of #1094 did this inline in a script and a sabotage collapsing a
 * failed read to an empty list broke no arm, because nothing in a script past
 * its `gh` call is reachable from a suite.
 *
 * The two `Unreadable` reasons are different facts and stay apart:
 * `--no-network` is a read NOBODY TOOK, a `null` is a read that was taken and
 * FAILED. Neither is a quiet board.
 */
export function cardCommentsVerdict(
  facts: CrewCardCommentFact[] | null,
  network: boolean,
): CrewCardCommentFact[] | Unreadable {
  if (!network) return { unreadable: "--no-network was passed; the claims and refusals were NOT read" };
  if (facts === null) {
    return {
      unreadable: "`gh api .../issues/comments` could not be read (absent, unauthenticated, offline or slow)",
    };
  }
  return facts;
}

/**
 * WHAT EVERY QUEUE READER ASKS OF A ROW — one object, built once per run from
 * the two reads.
 *
 * ⚠ **`unreadable` IS A LIST AND THE CALLER MUST PRINT IT.** A board built from
 * one half is not a clean board; it is a partial one, and every renderer in this
 * repository that treated those two as the same thing is on the record for it
 * (#504, #725, #772, #774, #1083). `partial` is the one-line question a caller
 * asks when it only needs to know whether to trust a silence.
 */
export type CardBuildBoard = {
  /** The judgement for one card, or `null` when nothing is happening to it. */
  readonly stateFor: (card: number) => CrewCardBuildState | null;
  /** The phrase his page draws, or `null` — the SAME words, from the same owner. */
  readonly phraseFor: (card: number) => string | null;
  /** `true` when this card must not be OFFERED to a shift as takeable work. */
  readonly holdsOffOffer: (card: number) => boolean;
  /** Why this board is less than the whole answer; empty when both reads landed. */
  readonly unreadable: readonly string[];
  /** `true` when either read failed or was skipped. */
  readonly partial: boolean;
};

/**
 * THE BOARD.
 *
 * ⚠ **AN UNREADABLE HALF NEVER WITHHOLDS A CARD.** With no pull requests and no
 * comments there is no evidence anybody is building anything, so every card is
 * still offered and the reasons travel out in `unreadable` for the renderer to
 * say out loud. A reader that hid work because `gh` hiccuped would have turned a
 * blip into an empty queue — the shape of #504, one question along.
 */
export function buildBoard(input: {
  readonly openPullRequests: readonly OpenPullRequest[] | Unreadable;
  readonly comments: readonly CrewCardCommentFact[] | Unreadable;
  readonly nowMs: number;
}): CardBuildBoard {
  const { openPullRequests, comments, nowMs } = input;
  const unreadable: string[] = [];
  if (isUnreadable(openPullRequests)) unreadable.push(`the open pull requests: ${openPullRequests.unreadable}`);
  if (isUnreadable(comments)) unreadable.push(`the claims and refusals: ${comments.unreadable}`);

  const facts = isUnreadable(comments) ? [] : comments;
  const pulls: CrewBuildPullRequest[] = isUnreadable(openPullRequests)
    ? []
    : openPullRequests.map((pr) => ({
      number: typeof pr.number === "number" ? pr.number : 0,
      title: pr.title ?? null,
      body: pr.body ?? null,
      headRefName: pr.headRefName ?? null,
      draft: pr.isDraft === true,
      /* `gh pr list`'s label rows are objects; an absent list means "no review
         label" and the stage reads `gate`. Said rather than assumed: a missing
         label cannot invent a hold. */
      labels: labelNames(pr),
      /* THE SAME VERDICT READING HIS PAGE MAKES, from the same two facts and the
         same owner — a shift and the founder must not read different words about
         one pull request, which is the whole of this card. */
      handVerdict: handVerdictForPullRequest({
        pullRequest: typeof pr.number === "number" ? pr.number : 0,
        updatedAt: pr.updatedAt ?? null,
        facts,
      }),
    }));

  const cache = new Map<number, CrewCardBuildState | null>();
  const stateFor = (card: number): CrewCardBuildState | null => {
    const held = cache.get(card);
    if (held !== undefined) return held;
    const state = crewCardBuildState({ card, openPullRequests: pulls, facts, nowMs });
    cache.set(card, state);
    return state;
  };
  return {
    stateFor,
    phraseFor: (card) => {
      const state = stateFor(card);
      return state === null ? null : crewCardBuildPhrase(state, nowMs);
    },
    holdsOffOffer: (card) => buildStateHoldsOffOffer(stateFor(card)),
    unreadable,
    partial: unreadable.length > 0,
  };
}

/** `gh pr list --json labels` hands back `[{ name }]`; a fixture may hand strings. */
function labelNames(pr: OpenPullRequest): string[] {
  const raw: unknown = pr.labels;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string"
      ? entry
      : (entry && typeof entry === "object" ? (entry as { name?: unknown }).name : undefined)))
    .filter((name): name is string => typeof name === "string");
}

/**
 * WHAT A RENDERER SAYS WHEN THE CLAIMS COULD NOT BE READ — one owner, because
 * both the digest and the band view say it and two hand-written copies is how
 * one of them quietly stops saying it.
 *
 * ⚠ **THE PULL-REQUEST HALF KEEPS ITS OWN WORDING AT EACH SITE ON PURPOSE**: both
 * of those blocks predate this card, both are pinned by arms, and both already
 * tell the three answers apart. This is the half that is new, and it fails in
 * the same direction — a card may look FREE while a shift is on it.
 */
export function commentsUnreadableLines(
  comments: readonly CrewCardCommentFact[] | Unreadable,
  indent = "  ",
): string[] {
  if (!isUnreadable(comments)) return [];
  return [
    `${indent}⚠ THE CLAIMS AND REFUSALS COULD NOT BE READ, so a card above may look FREE while a`,
    `${indent}  shift is already on it — ${comments.unreadable}`,
    `${indent}  Check the card's own comments for a \`CLAIMED —\` line before you cut a branch.`,
  ];
}
