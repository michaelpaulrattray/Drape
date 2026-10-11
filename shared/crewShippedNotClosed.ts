/**
 * A FINISHED CARD THAT READS AS OPEN WORK — the question nothing asked (#2265).
 *
 * A seat finishes a card, merges its pull request, closes its Desk row as
 * `shipped` — and never writes the handback word. The card then reads **CLAIMED
 * for twelve hours**, because `crewCardBuildState` believes a live claim
 * comment; and after twelve hours it falls through to nothing at all, which is
 * the reading *ordinary untouched work*. Either way it sits on the board with
 * nothing left in it to build.
 *
 * **Measured, with two instances, 2026-10-11.** `#2247` and `#2248` shipped at
 * 05:30–05:31Z (pull requests `#2255` and `#2254`), went live in build
 * `ceb1165f1`, discharged every done-when they carried — and were still open at
 * 07:20Z. `foreman-20261011-1721` found them by reading the board for something
 * to take, and they were the only takeable thing on a board of fifty: that
 * shift paid a whole session to discover its work was already done.
 *
 * # ⚠ WHY NO EXISTING READER CATCHES IT, READ AT EACH ONE RATHER THAN ASSUMED
 *
 *  - `crewCardBuildState` is handed `openPullRequests` ONLY, so a MERGED pull
 *    request produces no state at all. That is correct for its own question —
 *    *is somebody building this right now* — and it is exactly why it cannot
 *    answer this one.
 *  - `crew-work-switches` counted **Process: 0 open** while both cards were
 *    open, because a claimed card is excluded from the offered count. The
 *    switch panel structurally cannot show this.
 *  - The seat cut skipped them with *"claimed by seat1-…, 2 h ago"* — correct,
 *    and it hides them for twelve hours.
 *  - `crew-desk-sweep`'s own stale-row pass reports a NEXT UP row that already
 *    has somebody on it, but only over the **founder-ordered band**. Neither
 *    card carried that label, so the sweep was blind to them **by population,
 *    not by logic** — which is why this planner's population is EVERY open
 *    card.
 *
 * `crewCardHandbackInstruction` already prints the rule to every seat. **The
 * rule is not the gap; nothing re-read whether it was obeyed.**
 *
 * # ⚠ IT REPORTS. IT NEVER CLOSES A CARD, AND THAT IS THE CARD'S OWN RULING
 *
 * *Finished* and *partly shipped* are different answers and **only a read at
 * the code tells them apart** — a merged pull request is one slice of a card as
 * often as it is the whole of it. So this names candidates for a person to
 * read, in the sweep's standing posture (#1439, #2165). A reader that closed
 * cards would retire a card of his on a regex.
 *
 * # ⚠ THE BRANCH LIMB IS WITHHELD, AND IT IS WITHHELD STRUCTURALLY
 *
 * `pullRequestBuildsCard` reads three limbs: the title, `card #N` in the body,
 * and the head branch's digit RUNS. That third limb is sound for an open pull
 * request on a `team/<slug>-<card>` branch and is **measured noise here**: a
 * merged-pull-request window is full of dependabot branches carrying semver.
 *
 * Driven over the real 200 merged pull requests (back to 2026-10-03) the hour
 * this was written: **3 are `dependabot/*`**, and one of them —
 * `dependabot/npm_and_yarn/dotenv-18.0.5`, *"Bump dotenv from 17.2.3 to
 * 18.0.5"* — has the digit run `18`, so it read as building **card #18**
 * (*"Takes — founder-endorsed design direction"*, `design-unbuilt`). That was
 * this planner's one false positive before the limb came off, and it would have
 * put a design card nobody has touched since August on his board as finished
 * work.
 *
 * **It is withheld by the TYPE rather than by a filter**:
 * {@link ShippedNotClosedPullRequest} has no branch field, so a caller cannot
 * supply the limb and a later edit cannot forget to strip it. The Desk's own
 * reading of the same function is narrow in exactly this way and for a related
 * reason — GitHub's search API returns no head ref — so this is the
 * repository's existing width, not a new one.
 *
 * **What that costs is stated rather than hidden:** a pull request that names
 * its card ONLY in its branch is not read here. The convention makes that
 * cheap — **191 of those same 200 merged titles carry `(Card: #N)`**, which is
 * the squash title every merge of this repository is given.
 *
 * # ⚠ A CARD THAT SAYS IT IS UNFINISHED IS NOT A CANDIDATE
 *
 * Three cards on the live board have merged pull requests and are **correctly
 * open**: `#1882`, `#1952` and `#2155`. Each carries `blocked` with a written
 * reason, which is this repository's mechanism for *this card is waiting on
 * something the card names*. A label is the honest mechanical proxy for a
 * remainder, and it is the one a filer is instructed to apply.
 *
 * ⚠ **THE HOLD SET IS DERIVED FROM `CREW_HOLD_LABELS`, NOT RETYPED** — a fourth
 * hold label joins this reader with no edit here (working law 4). `parked` is
 * added because it is his own ruling that work is STOPPED, and it is taken from
 * the exclusions table's own row rather than spelled again.
 *
 * ⚠ **AND IT IS DELIBERATELY *NOT* `workHoldExclusionFor`, WHICH ANSWERS A
 * DIFFERENT QUESTION.** That predicate answers *may a seat take this card* and
 * so includes `founder-ordered` (the focus lane's) and *being built*. Deriving
 * from it would have silently skipped **every founder-ordered card** — the
 * exact population a rung's cards sit in — so it would have missed the next
 * instance of this fault on the focus lane while looking like a derivation. A
 * set that answers a neighbouring question is not a source of truth for this
 * one.
 */
import { pullRequestBuildsCard } from "./crewCardBuildState";
import { CREW_HOLD_LABELS } from "./crewNextUpHold";
import { QUEUE_EXCLUSION_REASONS } from "./crewQueueExclusions";

/**
 * The `parked` label, read off the exclusions table's own row so that this
 * reader cannot spell it differently. A missing row contributes nothing, and
 * `server/crewShippedNotClosed.test.ts` pins the whole set, so that absence
 * reddens there rather than quietly narrowing the hold.
 */
const PARKED_ROW = QUEUE_EXCLUSION_REASONS.find((reason) => reason.key === "parked");
const PARKED_LABEL: readonly string[] =
  typeof PARKED_ROW?.queueLabel === "string" ? [PARKED_ROW.queueLabel] : [];

/** A label that says the card itself is not finished. */
export const SHIPPED_NOT_CLOSED_HOLD_LABELS: readonly string[] = [
  ...Object.values(CREW_HOLD_LABELS),
  ...PARKED_LABEL,
];

/** One open card, as the sweep's whole-queue read already has it. */
export type ShippedNotClosedCard = {
  readonly issueNumber: number;
  readonly labels: readonly string[];
};

/**
 * One pull request. ⚠ **NO BRANCH FIELD, ON PURPOSE** — see the header: the
 * digit-run limb fires on dependabot semver, and withholding it in the type is
 * what stops a later caller re-supplying it.
 */
export type ShippedNotClosedPullRequest = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
};

/** A card that looks finished and is still open. */
export type ShippedNotClosedFinding = {
  readonly issueNumber: number;
  /** Ascending, so the sentence is stable between runs. */
  readonly mergedPullRequests: readonly number[];
};

/** Does this pull request say it builds this card, on the two limbs read here? */
function buildsCard(pr: ShippedNotClosedPullRequest, card: number): boolean {
  return pullRequestBuildsCard(
    { number: pr.number, title: pr.title, body: pr.body },
    card,
  ).length > 0;
}

/**
 * EVERY OPEN CARD WHOSE PULL REQUEST HAS ALREADY MERGED, and that says nothing
 * about being unfinished.
 *
 * ⚠ **AN OPEN PULL REQUEST SUPPRESSES THE FINDING** — work in flight means the
 * merged one was an earlier slice, which is the common and correct shape of a
 * multi-slice card.
 *
 * ⚠ **A LIVE CLAIM DOES NOT SUPPRESS IT**, which is the whole point: the claim
 * is what hid both measured instances for twelve hours. This reader is the one
 * place on the board where a claim is not taken as evidence that work remains.
 */
export function planShippedNotClosed(input: {
  readonly open: readonly ShippedNotClosedCard[];
  readonly merged: readonly ShippedNotClosedPullRequest[];
  readonly openPullRequests: readonly ShippedNotClosedPullRequest[];
}): readonly ShippedNotClosedFinding[] {
  const holds = new Set(SHIPPED_NOT_CLOSED_HOLD_LABELS);
  const findings: ShippedNotClosedFinding[] = [];
  for (const card of input.open) {
    const number = card.issueNumber;
    if (!Number.isSafeInteger(number) || number <= 0) continue;
    if (card.labels.some((label) => holds.has(label))) continue;
    const merged = input.merged
      .filter((pr) => buildsCard(pr, number))
      .map((pr) => pr.number)
      .sort((a, b) => a - b);
    if (merged.length === 0) continue;
    if (input.openPullRequests.some((pr) => buildsCard(pr, number))) continue;
    findings.push({ issueNumber: number, mergedPullRequests: merged });
  }
  return findings.sort((a, b) => a.issueNumber - b.issueNumber);
}

/**
 * The lines the sweep prints. Plain, and they say what to DO — the handback
 * word is the thing that was missed, so the remedy names it.
 */
export function shippedNotClosedLines(
  findings: readonly ShippedNotClosedFinding[],
): readonly string[] {
  if (findings.length === 0) return [];
  const lines: string[] = [
    `SHIPPED BUT STILL OPEN: ${findings.length} card(s) have a MERGED pull request, no open one,`,
    "  and no label saying they are waiting on anything. Read each at the code: if nothing in the",
    "  body is left unbuilt, close it with the merge as its receipt; if a slice remains, say so on",
    "  the card. A seat that shipped one and closed its row owed it a `RELEASED` line (#1701).",
  ];
  for (const finding of findings) {
    const prs = finding.mergedPullRequests.map((pr) => `#${pr}`).join(", ");
    lines.push(`  #${finding.issueNumber} — merged in ${prs}`);
  }
  return lines;
}
