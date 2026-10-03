/**
 * IS THE CARD A CLOSING RUN NAMES STILL OPEN? — the reading behind #1829.
 *
 * # Why the close needs it
 *
 * `scripts/crew-shift-close.mts` printed the handback instruction on every
 * outcome except `shipped`, so the outcome nearly every shift uses was the one
 * that never told a seat to write `RELEASED` — and a shift that works a card to
 * a HELD state and ships its edition left a claim reading live for twelve
 * hours. {@link closeShouldPrintHandback} is the rule that replaces that
 * condition, and this is the one fact it needs that the close does not already
 * hold.
 *
 * # ⚠ IT CANNOT FAIL THE CLOSE, AND THAT IS THIS MODULE'S WHOLE CONTRACT
 *
 * A close that dies leaves the run row open, which his page renders as a shift
 * still running (#288) — the incident that set this script's standing rule. So
 * **nothing here throws**: every road a `gh` read can take comes back as one of
 * {@link CrewClosingCardState}, the reason is REPORTED rather than swallowed,
 * and the caller's rule treats `unknown` exactly as it treats `open`.
 *
 * It is also why this runs through the counts' own `gh` seam
 * ({@link crewGhReader}) instead of its own `execFileSync`: that seam carries
 * the timeout, and a `gh` that BLOCKS forever is the one road a `catch` cannot
 * rescue — `refreshQueueCountsQuietly`'s own finding (PR #669's review).
 *
 * # ⚠ AND AN ANSWER IT CANNOT PARSE IS `unknown`, NEVER `closed`
 *
 * The directions are not symmetric. Reading `closed` wrongly SILENCES the
 * instruction, which is the defect #1829 was filed about; reading `open`
 * wrongly costs one line of output. So only the literal states GitHub spells
 * are believed, and everything else — an empty answer, a field that moved, a
 * `state` this reader has never seen — is `unknown`.
 *
 * ⚠ **`state` COMES BACK IN TWO CASINGS AND THAT IS NOT A STYLE POINT.** REST
 * answers `open`, GraphQL answers `OPEN` (`scripts/lib/ghQueueTransport.mts`
 * says so in its own words: *"that is the one field whose VALUE differs between
 * the two roads rather than only its name"*). A reader comparing against one
 * spelling would call every card on the other road `unknown`, so the close
 * would print the instruction on every shipped close and a shift would learn to
 * ignore it. It is lower-cased before it is judged.
 */
import {
  type CrewClosingCardState,
} from "../../shared/crewCardBuildState.js";
import { crewGhReader, type QueueGhReader } from "./crewQueueCount.mts";

/** What `gh issue view <n> --json state` is asked for, in one place. */
export function closingCardStateArgs(issueNumber: number): string[] {
  return ["issue", "view", String(issueNumber), "--json", "state"];
}

/**
 * One `gh` answer → one state, or `unknown`.
 *
 * Exported so the arms drive the PARSE without a network, which is the half of
 * this reading a fake `gh` cannot prove on its own.
 */
export function closingCardStateFromJson(text: string): CrewClosingCardState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return "unknown";
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "unknown";
  const state = (parsed as Record<string, unknown>).state;
  if (typeof state !== "string") return "unknown";
  const lowered = state.trim().toLowerCase();
  if (lowered === "open") return "open";
  if (lowered === "closed") return "closed";
  return "unknown";
}

/**
 * Read the state of the card a closing run names.
 *
 * `issueNumber === null` is `none` — a row that names no card has no claim to
 * hand back — and it costs no `gh` call. Every other road reports what it did
 * through `report` and comes back with a state.
 */
export function readClosingCardState(
  issueNumber: number | null,
  report: (line: string) => void,
  gh: QueueGhReader = crewGhReader,
): CrewClosingCardState {
  if (issueNumber === null) return "none";
  try {
    const state = closingCardStateFromJson(gh(closingCardStateArgs(issueNumber)));
    if (state === "unknown") {
      report(
        `\n⚠ #${issueNumber}'s state could not be understood from \`gh\`'s answer, so whether a`
        + "\n  claim on it is still holding a seat off is UNKNOWN — not \"nothing is holding\".",
      );
    }
    return state;
  } catch (cause) {
    /* ⚠ EVERY throw, not a chosen family — the same rule
       `refreshQueueCountsQuietly` runs on, and for the same reason: the caller
       is the close. A `gh` that is not installed, an unauthenticated one, a
       repo that cannot be resolved, a timeout, a driver error nobody has seen
       yet: none of them may reach the caller. */
    const reason = cause instanceof Error ? cause.message : String(cause);
    report(
      `\n⚠ #${issueNumber}'s state could not be read: ${reason.split(/\r?\n/)[0]}`
      + "\n  Whether a claim on it is still holding a seat off is UNKNOWN, so the handback"
      + "\n  instruction below is printed rather than skipped.",
    );
    return "unknown";
  }
}
