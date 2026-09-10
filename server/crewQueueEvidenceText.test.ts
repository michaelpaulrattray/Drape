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
  NON_CARD_SEQUENCE_WORDS,
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

  it("⚠ A MISMATCHED MARKER DOES NOT CLOSE A FENCE — the parity shape from PR #736's review", () => {
    /*
      Note 1 of the review, driven. Toggling on EITHER marker meant a bare
      `~~~` pasted inside a ``` block closed it early and inverted the parity of
      every later marker, so the prose line below was stripped while GitHub
      renders it as prose — a real reference silently un-flagged, which is the
      one direction this card forbids. A fence now closes only on its own
      character, which is CommonMark's rule.
    */
    const body = [
      "```",
      "~~~",
      "pasted output",
      "```",
      "prose that names #404",
      "```",
      "more pasted output",
      "```",
    ].join("\n");
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

describe("⚠ THE DECLINED REMAINDER — the specimens this strip does NOT catch, and #737 ruled it should not", () => {
  /*
    Written as SURVIVING arms rather than left out. The card's recommendation
    was the fenced/table strip alone, with the phrase vocabulary — *"filed as"*,
    *"logged, not done here"*, *"none taken"* — as a judgement about wording
    that belongs on its own card.

    ⚠ THAT CARD WAS #737 AND IT WAS DRIVEN AND DECLINED (2026-09-11). Over 57
    open cards and 326 merged pull requests the rule fired TEN times with ONE
    true naming among them, and the candidate vocabulary reached THREE of the
    nine false ones — the other six being ordinary English with no shared shape,
    in bodies where a true naming speaks the same way. The full reading is in
    `shared/crewQueuePossiblyDone.ts`'s header.

    So these arms are no longer "what will go red when that card is built".
    They are the DECLINED population, pinned where the work happens: if a later
    change makes one of them stop naming its card as evidence, that is a
    wording judgement having crept in, and it should be argued rather than
    absorbed.
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

  /*
    ⚠ THE FOURTH SPECIMEN LEFT THIS BLOCK — IT WAS NOT DECLINED, IT WAS BUILT
    (#776). It was pinned here by #737's close as a surviving arm, and turning
    it red was the receipt asked for; it is now the first arm of the block
    below, asserting the opposite. It was of a different KIND to the three
    above, which is why it was separable at all: those three need a judgement
    about whether an English sentence claims a fix, and this one only needs to
    know whether the token names a card.
  */
});

/**
 * A `#N` THAT NAMES A DIFFERENT NUMBERING SPACE (#776).
 *
 * The live specimen: card `#105` read as *possibly fixed* because merged PR
 * #468 wrote *"His order, Crew reply #105"*. The words are the measured two —
 * `reply` (60 mentions across 328 merged pull requests) and `run` (2, both in
 * PR #346, while card #26 is open) — and `edition` is deliberately absent at
 * zero measured instances.
 *
 * ⚠ **EVERY EXCLUDING ARM HAS ITS NEGATIVE CONTROL BESIDE IT**, because an
 * exclusion that is too wide silently un-flags real findings, which is the one
 * direction #776 forbids.
 */
describe("a #N naming another sequence is not a card reference (#776)", () => {
  it("PR #468's sentence no longer names #105 — the specimen that carded it", () => {
    const sentence = "**His order, Crew reply #105, 2026-09-02, verbatim and entire:** *\"Also run the AUTHOR half\"*";
    expect(namedAsEvidenceIn(sentence, 468)).not.toContain(105);
  });

  it("PR #346's sentence no longer names #26 — a shift RUN number, and #26 is an open card", () => {
    const sentence = "- **the reader**: named run #26, `last check-in 9s ago`, `⚠ LOOKS LIVE`";
    expect(namedAsEvidenceIn(sentence, 346)).not.toContain(26);
  });

  it("the excluded words are exactly the two that were measured", () => {
    expect([...NON_CARD_SEQUENCE_WORDS]).toEqual(["reply", "run"]);
  });

  /* ⚠ THE NEGATIVE CONTROLS — one per word, and they are what make the two
     arms above mean anything. Only the token IMMEDIATELY before the `#` is
     consulted, so the same word elsewhere in the sentence changes nothing. */
  it("`the run that landed #105` still names the card", () => {
    expect(cardNumbersIn("the run that landed #105 last night")).toContain(105);
  });

  it("`his reply settled #105` still names the card", () => {
    expect(cardNumbersIn("his reply settled #105 for good")).toContain(105);
  });

  it("a bare `see #105` still names the card", () => {
    expect(cardNumbersIn("see #105")).toContain(105);
  });

  it("a word merely ENDING in one of them still names the card", () => {
    expect(cardNumbersIn("overrun #26")).toContain(26);
    expect(cardNumbersIn("a prerun #26 check")).toContain(26);
  });

  it("a word at the end of a line cannot claim a #N on the next one", () => {
    expect(cardNumbersIn("the run\n#26 is the card")).toContain(26);
  });

  /*
    ⚠ THE CHARACTER IN FRONT OF THE WORD — PR #780's review asked why the
    boundary admits punctuation, and the corpus answers: of the 62 mentions
    where one of these words precedes a `#N`, 60 are whitespace-separated and
    TWO are an opening parenthesis — `(reply #114` in PR #537 and `(reply #72`
    in PR #369, both genuine reply numbers. Narrowing this to whitespace would
    re-break both, so the arm quotes the real one.
  */
  it("`(reply #114` is excluded too — the two parenthesised specimens in the corpus", () => {
    expect(namedAsEvidenceIn("His word on the shape (reply #114) settled it", 537)).not.toContain(114);
  });

  /*
    ⚠ THE THREE SHAPES THE REVIEWER NAMED, ALL MEASURED AT ZERO INSTANCES, ALL
    PINNED — this module's own idiom for making an absence a decision rather
    than a gap (the `edition #12` arm above).

    The two hyphenated ones are run numbers anyway: a re-run of run 26. The
    third is the honest leak — `run` as ordinary English — and nothing
    mechanical separates it from a run number, which is the wording judgement
    #737 measured and declined. It is pinned as it BEHAVES, not as one might
    wish, so the next reader finds a decision instead of a surprise.
  */
  it("`re-run #26` and `dry-run #26` are excluded — a re-run of run 26 is still a run number", () => {
    expect(cardNumbersIn("re-run #26 to confirm")).not.toContain(26);
    expect(cardNumbersIn("a dry-run #26 first")).not.toContain(26);
  });

  it("⚠ THE KNOWN LEAK, PINNED: `in the long run #26` loses its reference, and no measurement objects", () => {
    /* Zero instances across 328 merged pull requests. If this arm ever has to
       change, the cost was one flag and the reason is in the docblock. */
    expect(cardNumbersIn("in the long run #26 will need the same treatment")).not.toContain(26);
  });

  /* ⚠ `edition` WAS MEASURED AT ZERO AND LEFT OUT, and this arm is what keeps
     that a decision rather than an oversight: adding it should redden here and
     send whoever adds it back for the measurement first. */
  it("`edition #12` still names the card — the sequence measured at zero instances", () => {
    expect(cardNumbersIn("briefing edition #12 shipped")).toContain(12);
  });

  /* The same body naming a reply number AND the card in prose keeps the card:
     the exclusion is per MENTION, never per body. */
  it("a body that names a reply number and the card separately still names the card", () => {
    const body = "His order, Crew reply #105, was clear.\nThat is why #105 is still open.";
    expect(namedAsEvidenceIn(body, 468)).toContain(105);
  });
});
