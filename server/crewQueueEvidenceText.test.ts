/**
 * WHAT A CARD REFERENCE COUNTS AS EVIDENCE IN (#728).
 *
 * The finding this drives: the possibly-fixed flag fired hardest on the pull
 * requests whose bodies say, in words, that the work was NOT done — five for
 * five when they were read at the artifact on 2026-09-09.
 *
 * ⚠ **EVERY FIXTURE BELOW IS QUOTED FROM THE REAL PULL REQUEST BODY**, fetched
 * with `gh pr view --json body` and pasted, rather than approximated. An
 * invented body shaped like PR #716 would prove that the strip handles the
 * shape I imagined, which is the one thing already known.
 *
 * ⚠ **AND THE HONEST RESULT IS THAT ONE OF THE FOUR SPECIMENS STOPS AND THREE
 * DO NOT.** That is what the card recommended — *"start with the
 * fenced-block/table strip alone ... add the phrase list only if the four
 * filing-citations survive it"* — and they do survive it. The three surviving
 * arms are written down as SURVIVING rather than deleted, so the remainder is
 * visible in the suite instead of only in a card nobody opens.
 */
import { describe, expect, it } from "vitest";

import {
  cardNumbersIn,
  evidenceTextOf,
  namedAsEvidenceIn,
} from "../shared/crewQueuePossiblyDone";

/**
 * PR #716, verbatim — the priority view's own sample output pasted into the
 * body. `#711` is one row of it, and this is the shape that put the card on his
 * panel as *possibly fixed*.
 */
const PR_716_BODY = [
  "HIS ORDERED BAND — taken FIRST: before the focus, before patrols (PROGRAM.md)",
  "```",
  " 1. #26  2026-08-25  (15d)  The inspired EDIT is capped at a tenth of the inspired BRIEF",
  "      labels: debt, roadmap, small-fix",
  "...",
  "THE URGENT BAND — standing exception 1",
  " 1. #711  2026-09-09  (0d)  An upgrade's credit grant lands on the Stripe update...",
  "```",
  "",
  "And tonight's live negative arm, from the real script:",
].join("\n");

/** PR #456, verbatim from the body — the prose shape. */
const PR_456_SENTENCE =
  "- **Class B — a label naming a period its timer does not use.** ⚠ **Three siblings found, all filed as #455, none taken**";

/** PR #698, verbatim from the body — the POSITIVE CONTROL. */
const PR_698_SENTENCE =
  "Card: **#697** — this is its first and worst file. **#697 stays OPEN**: eleven files remain on that card.";

describe("evidenceTextOf — what a reference is allowed to count in", () => {
  it("⚠ THE SPECIMEN: PR #716 names #711 only inside a fence, and it stops being evidence", () => {
    /* The raw reader still sees it — this is a change to what counts, not to
       what the regex can find, and asserting both is what tells those apart. */
    expect(cardNumbersIn(PR_716_BODY, 716)).toContain(711);
    expect(namedAsEvidenceIn(PR_716_BODY, 716)).not.toContain(711);
  });

  it("the fenced block takes ALL of its rows, not only the flagged one", () => {
    expect(namedAsEvidenceIn(PR_716_BODY, 716)).toEqual([]);
  });

  it("⚠ POSITIVE CONTROL — PR #698 names #697 in prose, and keeps naming it", () => {
    /* #697 is the card the instrument got RIGHT: PRs #698 and #701 genuinely
       worked it file by file. A strip that silenced this one would have removed
       the instrument's only true positive to remove its false ones. */
    expect(namedAsEvidenceIn(PR_698_SENTENCE, 698)).toEqual([697]);
  });

  it("a table row is not evidence — the shape a triage or patrol report files in", () => {
    const body = [
      "| card | flagged by | what that PR's body actually says |",
      "|---|---|---|",
      "| **#455** | PR #456 | *\"Three siblings found, all filed as #455, none taken\"* |",
      "",
      "Prose naming #999 survives.",
    ].join("\n");
    expect(namedAsEvidenceIn(body, 728)).toEqual([999]);
  });

  it("a line beginning with a pipe but holding only one is prose, not a table", () => {
    /* The second pipe is the discriminator. Without it, an ordinary sentence
       that happens to open with a pipe would lose its references. */
    expect(namedAsEvidenceIn("| this is not a table row about #321", 0)).toEqual([321]);
  });

  it("⚠ AN UNTERMINATED FENCE STRIPS NOTHING — the direction the card required", () => {
    /*
      The card's bar: *"It must keep failing toward FLAGGING."* Reading an
      unclosed opener as "everything after this is code" would delete every
      reference in the rest of a malformed body and silently un-flag real
      findings. A false flag costs one re-read; a missed one costs him a card
      that is already done.
    */
    const body = ["Opening a fence and never closing it:", "```", "#404 is named in here."].join("\n");
    expect(namedAsEvidenceIn(body, 0)).toEqual([404]);
  });

  it("two closed fences are both stripped, and the prose between them survives", () => {
    const body = ["```", "#1", "```", "prose names #2", "```", "#3", "```"].join("\n");
    expect(namedAsEvidenceIn(body, 0)).toEqual([2]);
  });

  it("leaves an ordinary body byte-identical", () => {
    /* A strip that rewrote whitespace or dropped a trailing line would change
       what every other reader of this text sees. */
    const body = "Closes #123.\n\nAlso touches #45.\n";
    expect(evidenceTextOf(body)).toBe(body);
  });

  it("handles the empty and the absent body the way cardNumbersIn does", () => {
    expect(evidenceTextOf("")).toBe("");
    expect(namedAsEvidenceIn(undefined as unknown as string, 1)).toEqual([]);
  });
});

describe("⚠ THE REMAINDER — the three specimens this strip deliberately does NOT catch", () => {
  /*
    Written as SURVIVING arms rather than left out. The card's recommendation
    was the fenced/table strip alone, with the phrase vocabulary — *"filed as"*,
    *"logged, not done here"*, *"none taken"* — as a judgement about wording
    that belongs on its own card. These arms are what will go red, informatively,
    on the day that card is built.
  */
  it("PR #456's prose still names #455 as evidence", () => {
    expect(namedAsEvidenceIn(PR_456_SENTENCE, 456)).toContain(455);
  });

  it("PR #717's shape still names #481 as evidence", () => {
    const sentence = "Promoting `shortDate` out of a component file is the promotion pass's shape (#481/#482) — logged, not done here";
    expect(namedAsEvidenceIn(sentence, 717)).toContain(481);
  });

  it("PR #656's shape still names #655 as evidence", () => {
    const sentence = "Filed as #655 with the measurement and a recommendation, rather than presented as findings";
    expect(namedAsEvidenceIn(sentence, 656)).toContain(655);
  });
});
