/**
 * IS SOMEBODY ALREADY BUILDING THIS CARD? — the open-PR read the shift-start
 * sequence never had (#1083).
 *
 * `shared/crewShiftState.ts`'s `findCardCollisions` reads open shift ROWS and
 * REFUSES; `findCardPullRequests` beside it reads open PULL REQUESTS and this
 * file WARNS. The docblock on the second carries the measurement and the reason
 * the two answers differ in kind — read it before changing the shape here.
 *
 * It lives in a lib rather than inside `crew-shift-start.mts` for one reason:
 * the script's warning is unreachable from a unit test (the block sits past a
 * live database connection, and `vitest.setup.ts` strips `DATABASE_URL` so no
 * suite can ever get there). A warning nothing can drive is a warning nobody
 * knows the shape of — `server/crewShiftCardClaim.test.ts` drives every branch
 * of this file directly, including the one that matters most, which is an
 * unreadable answer.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cardNumberOf,
  findCardPullRequests,
  PR_CONFLICT_NOTE,
  readPullRequestConflict,
  type PullRequestMergeability,
} from "../../shared/crewShiftState.js";

/**
 * Twenty seconds. `gh pr list` on this repository is well under a second, and
 * the number is here so a hung call costs a wait a shift can sit through rather
 * than a session — the only failure this read may cause is a slow start.
 */
export const OPEN_PR_READ_TIMEOUT_MS = 20_000;

/**
 * The shape the `--json` list below gives back.
 *
 * ⚠ **`mergeable`/`mergeStateStatus` are INHERITED, not declared here** (#1099).
 * `shiftDigest.mts` keeps its own structural copy of this shape on purpose (its
 * docblock says why), so two hand-written copies of those two field names would
 * be working law 4 in miniature — a mirror that drifts, on the one pair of
 * fields this warning now depends on. Both shapes extend the one declaration in
 * `shared/crewShiftState.ts`, beside the reader that judges them.
 */
export interface OpenPullRequest extends PullRequestMergeability {
  readonly number?: number;
  readonly title?: string;
  readonly body?: string;
  readonly url?: string;
  readonly isDraft?: boolean;
  readonly headRefName?: string;
  /**
   * The labels, as `gh pr list --json labels` gives them (#1281). Added so the
   * seat-batch cutter and the pass digest can ask whether a pull request is
   * held for the relay's hand verdict (`CREW_REVIEW_PR_LABELS`) without a
   * SECOND reader of the open pull requests — one more `--json` field costs
   * nothing and a second reader of the same list is working law 4 in miniature.
   * Absent from a fixture written before this existed, which is why it is
   * optional rather than required.
   */
  readonly labels?: readonly { readonly name?: string }[];
}

/**
 * The open pull requests, from `gh` or from a fixture — `null` when the answer
 * could not be read at all.
 *
 * ⚠ **THE THREE OUTCOMES ARE KEPT DISTINCT AND THAT IS THE WHOLE POINT.**
 * "No open PRs" and "the read failed" are the same picture to a caller that
 * collapses them, and the second one is a board nobody looked at. A `gh` that
 * is absent, unauthenticated, offline or slow returns `null` here and the
 * renderer says so in words.
 *
 * `fixturePath` exists so the suite can drive every branch without a network, a
 * token or a live queue — the same reason `next-up-escalation.mts` takes
 * `--queue` and `patrol-clocks.mts` takes `--dir`.
 *
 * `cwd` exists because this reader has a SECOND caller since #1094 — the shift
 * digest, which is given a `--root` and must ask about that repository rather
 * than whichever directory it was launched from. It is a parameter and not a
 * second reader on purpose: a copied `--json` field list
 * in the digest would be a mirror of the field list this file's
 * matcher depends on, and a mirror drifts (working law 4). One field list, one
 * `gh` call shape, two callers.
 */
export function readOpenPullRequests(
  fixturePath?: string | null,
  cwd?: string | null,
): OpenPullRequest[] | null {
  if (fixturePath) {
    try {
      const rows = JSON.parse(readFileSync(resolve(fixturePath), "utf8"));
      return Array.isArray(rows) ? (rows as OpenPullRequest[]) : null;
    } catch {
      return null;
    }
  }
  try {
    /* `gh` with no shell — it is an .exe, and the shell form emits DEP0190. */
    const out = execFileSync(
      "gh",
      ["pr", "list", "--state", "open", "--limit", "100", "--json", "number,title,body,url,isDraft,headRefName,labels,mergeable,mergeStateStatus"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: OPEN_PR_READ_TIMEOUT_MS,
        ...(cwd ? { cwd } : {}),
      },
    );
    const rows = JSON.parse(out);
    return Array.isArray(rows) ? (rows as OpenPullRequest[]) : null;
  } catch {
    return null;
  }
}

/**
 * What the shift should read before it cuts a branch — `null` when there is
 * genuinely nothing to say.
 *
 * ⚠ **THIS NEVER REFUSES, AND #1083 RULED THAT BEFORE IT WAS BUILT.** A refusal
 * keyed on a card number fires on a legitimate follow-up PR naming the same
 * card, and a guard that stops a shift finishing its own card's second half has
 * cost more than the duplicate it prevents. So: name the PR, say WHERE the
 * number was found, and let the shift decide.
 *
 * A free-text card ref (a founder reply rather than a `#NNN`) returns `null`:
 * there is no number to search for, and inventing a substring search over prose
 * would report noise as diligence.
 */
export function renderCardClaimWarning(
  cardRef: string | null | undefined,
  openPrs: readonly OpenPullRequest[] | null,
): string | null {
  if (cardNumberOf(cardRef) === null) return null;
  if (openPrs === null) {
    return `\n⚠ could not read the open pull requests, so nobody checked whether ${cardRef} is already`
      + "\n  being built. That is not a clean board — it is an unread one (`gh auth status`).";
  }
  const claimed = findCardPullRequests(openPrs, cardRef);
  if (claimed.length === 0) return null;
  const one = claimed.length === 1;
  const rows = claimed
    .map(({ pr, where }) =>
      `   #${pr.number ?? "?"}${pr.isDraft ? " (draft)" : ""} ${pr.url ?? ""}`
      + `\n     ${String(pr.title ?? "").slice(0, 110)}`
      + `\n     the number is in its ${where.join(" and ")}`
      /* ⚠ Only a CONFLICT is spoken (#1099). `null` — GitHub still computing,
         or the fields absent — prints nothing rather than vouching for a PR this
         reader has not been told about; `false` needs no line at all. */
      + (readPullRequestConflict(pr) === true ? `\n     ⚠ ${PR_CONFLICT_NOTE}` : ""))
    .join("\n");
  return `\n⚠ ${claimed.length} OPEN pull request${one ? "" : "s"} already name${one ? "s" : ""} ${cardRef}:\n${rows}\n`
    + "\n  This is a WARNING and the run is opening anyway — an open PR may be your own"
    + "\n  follow-up, a finished piece, or somebody else mid-build. READ IT before you"
    + "\n  cut a branch: #1083 is thirty-five minutes spent rebuilding something that had"
    + "\n  merged seven minutes earlier, and this is the artifact that knew.";
}

/**
 * THE SAME READ, AS THE SHIFT DIGEST NEEDS IT (#1094) — pure, so it can be
 * driven.
 *
 * ⚠ **THIS FUNCTION EXISTS BECAUSE A SABOTAGE STAYED GREEN.** The first shape
 * of #1094 did this mapping inline inside `shift-digest.mts`, and collapsing
 * `null` to `[]` there — a failed `gh pr list` rendering as a clean board, the
 * one outcome this whole file is about — broke no arm at all, because nothing
 * in that script past its `gh` call is reachable from a suite. That is the
 * warning-nothing-can-drive shape in this file's own header, one module along.
 *
 * So the judgement is here, beside the reader it judges, and the script keeps
 * only the call. The two `Unreadable` reasons are kept apart because they are
 * different facts: `--no-network` is a read NOBODY TOOK, and a `null` is a read
 * that was taken and FAILED. Neither is an empty board.
 */
export function openPullRequestsVerdict(
  rows: OpenPullRequest[] | null,
  network: boolean,
): OpenPullRequest[] | { readonly unreadable: string } {
  if (!network) return { unreadable: "--no-network was passed; NOT a clean board" };
  if (rows === null) {
    return {
      unreadable: "`gh pr list` could not be read (absent, unauthenticated, offline or slow)",
    };
  }
  return rows;
}
