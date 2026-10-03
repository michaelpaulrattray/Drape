/**
 * DOES THE PULL REQUEST A CLOSING RUN NAMES AGREE THAT IT SHIPPED? — #1859.
 *
 * # Why the close needs it
 *
 * The runner's close-stamp checks a shift's written claims against `gh` after
 * the process is gone, and it has **exactly one call site, on the focus-shift
 * path** — so a builder seat's claims have never been checked by anything, and
 * a seat is forbidden to write the mailbox entry a stamp would read. The
 * reasoning behind answering that with the CLOSE instead, and the two things
 * this deliberately does not check, are in
 * {@link closingPullRequestFinding}'s own docblock; this file is only the
 * reading it needs.
 *
 * # ⚠ IT CANNOT FAIL THE CLOSE, AND THAT IS THIS MODULE'S WHOLE CONTRACT
 *
 * A close that dies leaves the run row open, which his page renders as a shift
 * still running (#288) — the incident that set `crew-shift-close.mts`'s
 * standing rule. So **nothing here throws**: every road a `gh` read can take
 * comes back as a {@link ClosingPullRequestReading}, and the reason is REPORTED
 * rather than swallowed.
 *
 * It runs through the counts' own `gh` seam ({@link crewGhReader}) rather than
 * its own `execFileSync`, for the reason `crewClosingCardState.mts` states in
 * its own words: that seam carries the timeout, and a `gh` that BLOCKS forever
 * is the one road a `catch` cannot rescue.
 *
 * # ⚠ AND AN ANSWER IT CANNOT PARSE IS `unreadable`, NEVER A CLEAN BILL
 *
 * The directions are not symmetric. Calling a draft pull request `open` by
 * mistake SILENCES the finding, which is the whole defect; naming a readable
 * one unreadable costs one line of output and no exit code. So only the fields
 * GitHub actually spells are believed, and a missing or re-typed one makes the
 * whole reading `unreadable` with the reason printed.
 *
 * ⚠ **`state` COMES BACK IN TWO CASINGS and that is not a style point** —
 * `scripts/lib/ghQueueTransport.mts` says so in its own words: REST answers
 * `open`, GraphQL answers `OPEN`, *"the one field whose VALUE differs between
 * the two roads rather than only its name"*. It is lower-cased before it is
 * judged, and a value this reader has never seen is `"unknown"` rather than a
 * guess — which the rule then treats as no finding, the safe direction for a
 * field it could not understand.
 */
import {
  type ClosingPullRequestFacts,
  type ClosingPullRequestReading,
} from "../../shared/crewCardBuildState.js";
import { crewGhReader, type QueueGhReader } from "./crewQueueCount.mts";

/** What `gh pr view <n> --json …` is asked for, in one place. */
export function closingPullRequestArgs(prNumber: number): string[] {
  return ["pr", "view", String(prNumber), "--json", "number,isDraft,state"];
}

/** The states GitHub spells for a pull request, lower-cased. */
function stateOf(value: unknown): ClosingPullRequestFacts["state"] {
  if (typeof value !== "string") return "unknown";
  const lowered = value.trim().toLowerCase();
  if (lowered === "open" || lowered === "closed" || lowered === "merged") return lowered;
  return "unknown";
}

/**
 * One `gh` answer → the facts, or `null` when it could not be understood.
 *
 * Exported so the arms drive the PARSE without a network, which is the half of
 * this reading a fake `gh` cannot prove on its own.
 *
 * ⚠ `isDraft` must be a real boolean. A pull request whose draft flag is
 * absent, renamed or a string is NOT read as "not a draft" — that is the one
 * direction this reader may not fail in, so the whole answer is refused.
 */
export function closingPullRequestFromJson(text: string): ClosingPullRequestFacts | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  if (typeof row.isDraft !== "boolean") return null;
  const number = row.number;
  if (!Number.isSafeInteger(number)) return null;
  return { number: number as number, isDraft: row.isDraft, state: stateOf(row.state) };
}

/**
 * Read the pull request a closing run names.
 *
 * `prNumber === null` is `none` — a close that named no `--pr` makes no claim
 * about one — and it costs no `gh` call. Every other road reports what it did
 * through `report` and comes back with a reading.
 */
export function readClosingPullRequest(
  prNumber: number | null,
  report: (line: string) => void,
  gh: QueueGhReader = crewGhReader,
): ClosingPullRequestReading {
  if (prNumber === null) return { kind: "none" };
  let answer: string;
  try {
    answer = gh(closingPullRequestArgs(prNumber));
  } catch (cause) {
    /* ⚠ EVERY throw, not a chosen family — the same rule
       `readClosingCardState` runs on, and for the same reason: the caller is
       the close. A `gh` that is not installed, an unauthenticated one, a pull
       request that does not exist, a timeout, a driver error nobody has seen
       yet: none of them may reach the caller.

       ⚠ AND THE TWO ARE NOT TOLD APART ON PURPOSE. `gh pr view` throws both
       for a pull request that does not exist and for a `gh` that cannot
       answer, and separating them means matching GitHub's prose. So the
       sentence says UNKNOWN rather than implying either one. */
    const why = cause instanceof Error ? cause.message : String(cause);
    const firstLine = why.split(/\r?\n/)[0] ?? why;
    report(
      `\n\u26a0 PR #${prNumber} could not be read: ${firstLine}`
      + "\n  So whether this run's `shipped` claim agrees with its pull request is UNKNOWN —"
      + "\n  not \"the pull request is fine\". Nothing is reported below about it.",
    );
    return { kind: "unreadable", why: firstLine };
  }
  const facts = closingPullRequestFromJson(answer);
  if (facts === null) {
    report(
      `\n\u26a0 PR #${prNumber}'s answer from \`gh\` could not be understood, so whether this run's`
      + "\n  `shipped` claim agrees with its pull request is UNKNOWN — not \"the pull request is"
      + "\n  fine\". Nothing is reported below about it.",
    );
    return { kind: "unreadable", why: "the answer could not be understood" };
  }
  return { kind: "read", facts };
}
