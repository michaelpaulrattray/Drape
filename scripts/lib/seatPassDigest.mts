/**
 * ONE DIGEST PER PASS — what N seats did, in one artifact, one line per card
 * (#1281 requirement 3).
 *
 * Its reader is the RELAY, not the founder: the relay merges serially and needs
 * to know, in one place, which cards became pull requests, which were put back
 * and why, and how many pull requests are now waiting on its verdict. The
 * founder's own view of the same work is his Desk — every seat opens a row in
 * the crew shift table, so *Happening now* names each one while it runs. This
 * file does not duplicate that; it is the pass's receipt.
 *
 * # ⚠ THE OUTCOME LINES ARE DERIVED FROM GITHUB, NEVER FROM A SEAT'S REPORT
 *
 * Working law 1: reports are claims, artifacts are facts. A seat's final message
 * says what it believes it did; the open pull requests and the card's own
 * comments say what happened. So every outcome here comes from
 * `crewCardBuildState` — the same fact-grade reader his Desk draws from — over a
 * pull-request list read AFTER the seats have finished. A card with no artifact
 * of any kind reads *"nothing recorded"*, which is the honest sentence and the
 * one a relay should go and look at.
 *
 * Pure: readings in, markdown out. `server/seatPassDigest.test.ts` drives it.
 */
import {
  crewCardBuildPhrase,
  crewCardBuildState,
  type CrewBuildPullRequest,
  type CrewCardCommentFact,
} from "../../shared/crewCardBuildState.js";

/** One card as the pass handed it out. */
export interface PassCardHandout {
  readonly number: number;
  readonly title: string;
  readonly seat: number;
  readonly area: string | null;
}

/** One card the pass did NOT hand out, with the sentence the cut wrote. */
export interface PassCardSkipped {
  readonly number: number;
  readonly title: string;
  readonly why: string;
}

/** One Jev answer, recorded so the relay can audit it. */
export interface PassJevReading {
  readonly card: number;
  readonly question: string;
  readonly answer: string;
  readonly confidence: number;
  readonly used: boolean;
  readonly note: string;
}

export interface PassDigestInput {
  readonly passStartedAt: string;
  readonly finishedAt: string;
  readonly seatCount: number;
  /** The card the focus shift held this pass, so the two lanes are readable together. */
  readonly focusCard: { readonly number: number; readonly title: string } | null;
  readonly handout: readonly PassCardHandout[];
  readonly skipped: readonly PassCardSkipped[];
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  /** Open pull requests held for the relay's verdict, by number. */
  readonly awaitingVerdict: readonly number[];
  readonly jev: {
    readonly asked: boolean;
    readonly failure: string | null;
    readonly readings: readonly PassJevReading[];
    readonly spendUsd: number;
  };
  readonly nowMs: number;
  /** Seats whose session exited non-zero or wrote nothing, named rather than hidden. */
  readonly seatFailures?: readonly { readonly seat: number; readonly why: string }[];
}

/** One card's outcome, as the artifacts say it. */
export function passCardOutcome(input: {
  readonly card: number;
  readonly openPullRequests: readonly CrewBuildPullRequest[];
  readonly facts: readonly CrewCardCommentFact[];
  readonly nowMs: number;
}): string {
  const state = crewCardBuildState({
    card: input.card,
    openPullRequests: input.openPullRequests,
    facts: input.facts,
    nowMs: input.nowMs,
  });
  if (state === null) return "nothing recorded — no PR, no claim, no refusal";
  return crewCardBuildPhrase(state, input.nowMs);
}

function line(card: PassCardHandout, outcome: string): string {
  const where = card.area === null ? `seat ${card.seat}` : `seat ${card.seat}, ${card.area}`;
  return `- #${card.number} (${where}) → ${outcome}`;
}

/**
 * THE DIGEST. Markdown, because it lands in the mailbox beside every other
 * receipt and the relay reads it there.
 */
export function renderPassDigest(input: PassDigestInput): string {
  const out: string[] = [];
  out.push(`# PASS DIGEST — ${input.finishedAt} · ${input.seatCount} seat${input.seatCount === 1 ? "" : "s"}`);
  out.push("");
  out.push(`Pass started ${input.passStartedAt}. The focus lane ran beside these seats: ${
    input.focusCard === null
      ? "no takeable card at the top of NEXT UP this pass."
      : `#${input.focusCard.number} — ${input.focusCard.title}.`
  }`);
  out.push("");

  out.push("## One line per card handed out");
  out.push("");
  if (input.handout.length === 0) {
    out.push("- nothing was handed out this pass.");
  } else {
    for (const card of [...input.handout].sort((a, b) => a.seat - b.seat || a.number - b.number)) {
      out.push(line(card, passCardOutcome({
        card: card.number,
        openPullRequests: input.openPullRequests,
        facts: input.facts,
        nowMs: input.nowMs,
      })));
    }
  }
  out.push("");

  out.push("## Not handed out, and why");
  out.push("");
  if (input.skipped.length === 0) {
    out.push("- every card on offer was handed out.");
  } else {
    for (const card of [...input.skipped].sort((a, b) => a.number - b.number)) {
      out.push(`- #${card.number} — ${card.why}`);
    }
  }
  out.push("");

  out.push("## Waiting on the relay");
  out.push("");
  out.push(
    input.awaitingVerdict.length === 0
      ? "No open pull request is held for a verdict."
      : `${input.awaitingVerdict.length} open pull request${input.awaitingVerdict.length === 1 ? " is" : "s are"} held for the relay's verdict: ${
        [...input.awaitingVerdict].sort((a, b) => a - b).map((n) => `#${n}`).join(", ")
      }.`,
  );
  out.push("");

  if ((input.seatFailures ?? []).length > 0) {
    out.push("## Seats that did not finish cleanly");
    out.push("");
    for (const failure of input.seatFailures ?? []) out.push(`- seat ${failure.seat} — ${failure.why}`);
    out.push("");
  }

  out.push("## The tie-breaker");
  out.push("");
  if (!input.jev.asked) {
    out.push("Jev was not asked this pass — every card's area and independence was read mechanically.");
  } else if (input.jev.failure !== null) {
    out.push(`Jev was unreachable (${input.jev.failure}), so the cut ran on the mechanical facts alone.`);
  } else if (input.jev.readings.length === 0) {
    out.push("Jev was available and not needed — the mechanical reading answered every card.");
  } else {
    out.push(`${input.jev.readings.length} ask${input.jev.readings.length === 1 ? "" : "s"}, $${input.jev.spendUsd.toFixed(4)}:`);
    out.push("");
    for (const reading of input.jev.readings) {
      out.push(
        `- #${reading.card} ${reading.question}: "${reading.answer}" at ${reading.confidence.toFixed(2)} — ${
          reading.used ? "used" : "not used"
        }, ${reading.note}`,
      );
    }
  }
  out.push("");
  return `${out.join("\n")}\n`;
}
