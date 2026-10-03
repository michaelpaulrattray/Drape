/**
 * A SHIFT THAT CLOSES AS `shipped` IS TOLD TO HAND ITS CARD BACK (#1829).
 *
 * # What was wrong, and it was one condition
 *
 * `scripts/crew-shift-close.mts` printed the handback instruction on every
 * outcome EXCEPT `shipped` — which is the outcome nearly every shift uses. So
 * #1701's repair, correct in itself, reached almost nobody: a shift that
 * shipped closed with no reminder to write `RELEASED`, and its claim read live
 * for the full twelve hours.
 *
 * Measured 2026-10-03 at the rows rather than inferred from the counter: his
 * Housekeeping switch read *"1 being built"* truly (#1826, run #546 open), and
 * his Security switch read it FALSELY — #1807's claim was written by
 * `foreman-20261003-0840`, whose row (#535) had closed **8 h 38 m earlier**
 * with outcome `shipped`, after working the card to a correctly HELD state.
 *
 * # Why the `shipped` exemption looked sound, and was not
 *
 * A shipped card is usually CLOSED, and a closed card cannot be held. The case
 * it misses is the one that happened: a shift that works a card to a held
 * state, ships its edition, and closes — so the card is correctly `blocked`,
 * correctly still open, and nothing on any road retires the claim.
 *
 * **The outcome was never the question.** What decides whether a handback is
 * owed is whether the CARD is still open.
 *
 * # The controls, and what each is for
 *
 * **1 · The rule is driven over its WHOLE cross-product**, outcomes derived
 * from `CREW_SHIFT_OUTCOMES` rather than typed, so a fourth outcome cannot
 * join the product without an answer here.
 *
 * **2 · THE OLD PREDICATE IS ENCODED AND SHOWN TO DISAGREE.** An arm that only
 * asserts the new rule's answers would pass just as happily on the old code, if
 * the old code happened to agree. So the condition this card replaces is
 * written out, and the arm names the exact cases where the two part — one of
 * which is the measured one (law 2: an instrument that cannot fail proves
 * nothing).
 *
 * **3 · The reader is driven with an injected `gh`**, including the throw and
 * the unparseable answer, because the direction it must fail in is not
 * symmetric: reading `closed` wrongly SILENCES the instruction, which is this
 * card's defect; reading `open` wrongly costs one line of output.
 *
 * **4 · The caller is read at the source with a positive control**, the shape
 * `server/cardWaitsOnHisEye.test.ts` uses on the same script — a control with
 * no caller does not exist (invariant 7).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  closeShouldPrintHandback,
  type CrewClosingCardState,
} from "../shared/crewCardBuildState";
import { CREW_SHIFT_OUTCOMES } from "../shared/crewShiftState";
import {
  closingCardStateArgs,
  closingCardStateFromJson,
  readClosingCardState,
} from "../scripts/lib/crewClosingCardState.mts";

const REPO = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");

const CARD_STATES: readonly CrewClosingCardState[] = ["open", "closed", "unknown", "none"];

/**
 * THE CONDITION THIS CARD REPLACES, written out so the arms can show the two
 * rules parting company. It is the line that stood in the close until today.
 */
const theOldCondition = (outcome: string): boolean => outcome !== "shipped";

describe("the rule: should the close print the handback instruction", () => {
  it("the ONE silence is `shipped` over a card known to be CLOSED", () => {
    /* A closed card cannot hold a seat off, so the instruction would be noise
       on the one road where it is reliably not needed. */
    expect(closeShouldPrintHandback({ outcome: "shipped", cardState: "closed" })).toBe(false);
  });

  it("#1807's case prints — `shipped` over a card still OPEN", () => {
    expect(closeShouldPrintHandback({ outcome: "shipped", cardState: "open" })).toBe(true);
  });

  it("an UNREADABLE card state prints — it fails toward printing", () => {
    /* A `gh` that could not answer is not evidence the card is finished, and an
       unreadable signal must never be the thing that silences the instruction. */
    expect(closeShouldPrintHandback({ outcome: "shipped", cardState: "unknown" })).toBe(true);
  });

  it("a row naming no card prints too — one line of output is the cheap error", () => {
    expect(closeShouldPrintHandback({ outcome: "shipped", cardState: "none" })).toBe(true);
  });

  it("every other outcome prints whatever the card is — today's behaviour, unchanged", () => {
    for (const outcome of CREW_SHIFT_OUTCOMES.filter((candidate) => candidate !== "shipped")) {
      for (const cardState of CARD_STATES) {
        expect(
          closeShouldPrintHandback({ outcome, cardState }),
          `${outcome} + ${cardState} must still print`,
        ).toBe(true);
      }
    }
  });

  it("the whole cross-product is answered, and the population is DERIVED", () => {
    /* A fourth outcome added to `CREW_SHIFT_OUTCOMES` lands in this product
       automatically; it cannot arrive unanswered. */
    const answers = CREW_SHIFT_OUTCOMES.flatMap((outcome) => CARD_STATES.map((cardState) => ({
      outcome,
      cardState,
      print: closeShouldPrintHandback({ outcome, cardState }),
    })));
    expect(answers).toHaveLength(CREW_SHIFT_OUTCOMES.length * CARD_STATES.length);
    expect(answers.filter((answer) => !answer.print)).toEqual([
      { outcome: "shipped", cardState: "closed", print: false },
    ]);
  });

  it("POSITIVE CONTROL — the old condition and the new rule disagree, and the measured case is among them", () => {
    /* The arm that makes the rest of this file an instrument. If the new rule
       agreed with the old one everywhere, every assertion above would pass
       against the code this card is replacing. */
    const parted = CREW_SHIFT_OUTCOMES
      .flatMap((outcome) => CARD_STATES.map((cardState) => ({ outcome, cardState })))
      .filter(({ outcome, cardState }) => theOldCondition(outcome)
        !== closeShouldPrintHandback({ outcome, cardState }));

    expect(parted).toEqual([
      { outcome: "shipped", cardState: "open" },
      { outcome: "shipped", cardState: "unknown" },
      { outcome: "shipped", cardState: "none" },
    ]);
    /* And the old condition is silent on #1807's case, which is the defect. */
    expect(theOldCondition("shipped")).toBe(false);
  });
});

describe("the reading: what `gh` said about the card", () => {
  it("asks for exactly one field, on the single-object road #1399 measured as answering", () => {
    /* Asserted at the wire rather than at a constant beside it (invariant 5). */
    expect(closingCardStateArgs(1807)).toEqual(["issue", "view", "1807", "--json", "state"]);
  });

  it("believes both casings, because REST and GraphQL spell `state` differently", () => {
    /* `ghQueueTransport.mts`: *"that is the one field whose VALUE differs
       between the two roads rather than only its name"*. A reader that knew one
       spelling would call every card on the other road unknown, so the close
       would print on every shipped close and a shift would learn to ignore it. */
    expect(closingCardStateFromJson('{"state":"OPEN"}')).toBe("open");
    expect(closingCardStateFromJson('{"state":"open"}')).toBe("open");
    expect(closingCardStateFromJson('{"state":"CLOSED"}')).toBe("closed");
    expect(closingCardStateFromJson('{"state":"closed"}')).toBe("closed");
  });

  it("every answer it cannot read is `unknown`, and never `closed`", () => {
    /* The asymmetry: `closed` silences the instruction, `unknown` prints it. */
    const unreadable = [
      "",
      "   ",
      "not json",
      "[]",
      "null",
      "{}",
      '{"state":null}',
      '{"state":42}',
      '{"state":"MERGED"}',
    ];
    for (const text of unreadable) {
      expect(closingCardStateFromJson(text), `${JSON.stringify(text)} must be unknown`).toBe("unknown");
    }
  });

  it("a row that names no card is `none`, and costs no `gh` call at all", () => {
    const calls: string[][] = [];
    const notes: string[] = [];
    const state = readClosingCardState(null, (line) => notes.push(line), (args) => {
      calls.push([...args]);
      return '{"state":"OPEN"}';
    });
    expect(state).toBe("none");
    expect(calls, "a null card must not reach `gh`").toEqual([]);
    expect(notes).toEqual([]);
  });

  it("a `gh` that THROWS is `unknown`, reports its reason, and does not throw on", () => {
    const notes: string[] = [];
    const state = readClosingCardState(1807, (line) => notes.push(line), () => {
      throw new Error("gh: command not found\nsecond line nobody needs");
    });
    expect(state).toBe("unknown");
    expect(notes.join("\n")).toContain("#1807");
    expect(notes.join("\n")).toContain("gh: command not found");
    expect(notes.join("\n"), "the second line of a refusal is noise in a close's output")
      .not.toContain("second line nobody needs");
  });

  it("a thrown NON-Error is swallowed too — every throw, not a chosen family", () => {
    const notes: string[] = [];
    const thrower = () => {
      throw "a string";
    };
    expect(readClosingCardState(1807, (line) => notes.push(line), thrower)).toBe("unknown");
    expect(notes.join("\n")).toContain("a string");
  });

  it("an answer it could not understand says so rather than passing quietly", () => {
    const notes: string[] = [];
    expect(readClosingCardState(1807, (line) => notes.push(line), () => "{}")).toBe("unknown");
    expect(notes.join("\n")).toContain("UNKNOWN");
  });

  it("a state it CAN read is silent — a reader that always warns is a reader nobody reads", () => {
    const notes: string[] = [];
    expect(readClosingCardState(1807, (line) => notes.push(line), () => '{"state":"OPEN"}')).toBe("open");
    expect(readClosingCardState(1807, (line) => notes.push(line), () => '{"state":"CLOSED"}')).toBe("closed");
    expect(notes).toEqual([]);
  });
});

describe("the rule has a caller on the road every shift walks", () => {
  const CLOSE = "scripts/crew-shift-close.mts";

  /**
   * THE READING, as one function, so the arm and its control run the same one.
   *
   * The third limb is the one this card is about: the old condition must be
   * GONE, not merely joined by the new rule.
   */
  const consultsTheRule = (source: string): boolean => source.includes("readClosingCardState(")
    && source.includes("closeShouldPrintHandback({")
    && !/if\s*\(row\.outcome\s*!==\s*"shipped"\)\s*console\.log/.test(source);

  it("the close reads the card's state and asks the rule", () => {
    expect(
      consultsTheRule(read(CLOSE)),
      "the close does not consult the rule — a control with no caller does not exist",
    ).toBe(true);
  });

  it("POSITIVE CONTROL — that reading goes red on a copy carrying each defect", () => {
    const real = read(CLOSE);
    expect(consultsTheRule(real.replace(/readClosingCardState\(/g, "somethingElse("))).toBe(false);
    expect(consultsTheRule(real.replace(/closeShouldPrintHandback\(\{/g, "somethingElse({"))).toBe(false);
    /* And the arm that matters most: the code as it stood before this card. */
    const beforeThisCard = real.replace(
      /const closingCardState = readClosingCardState\([\s\S]*?\n {2}\}\n/,
      'if (row.outcome !== "shipped") console.log("handback");\n',
    );
    expect(
      beforeThisCard,
      "the doctored copy must actually carry the old line, or this control proves nothing",
    ).toContain('if (row.outcome !== "shipped") console.log');
    expect(consultsTheRule(beforeThisCard)).toBe(false);
  });

  it("the handback is printed AFTER the row is stamped, and never refuses", () => {
    const source = read(CLOSE);
    /* `refuse()` exits BEFORE the UPDATE. A handback reading that could refuse
       would cost a shift its close and leave a row open that his page reads as
       a shift still running (#288). */
    const update = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
    const handback = source.indexOf("readClosingCardState(");
    expect(update, "the close no longer writes — this arm is reading the wrong file").toBeGreaterThan(0);
    expect(handback, "the reading must come AFTER the row is stamped").toBeGreaterThan(update);
    expect(source.slice(handback, handback + 900)).not.toContain("refuse(");
  });

  it("the card's number is read ONCE and both consumers share it", () => {
    /* Two reads of `issueNumberOf(target.cardRef)` would be a second list
       shadowing a source of truth one line apart (working law 4). */
    expect((read(CLOSE).match(/issueNumberOf\(target\.cardRef\)/g) ?? []).length).toBe(1);
  });

  it("the reader runs on the counts' own `gh` seam, not a private child process", () => {
    /* A fifth `gh` caller with no timeout would re-open the one road a `catch`
       cannot rescue, and it would do it on the shift close.

       ⚠ Read at the IMPORT rather than at the word: the first draft of this arm
       asserted the file does not contain `execFileSync`, and it went red on the
       module's own docblock saying it does not use one. A negative arm a
       SENTENCE can satisfy, or break, is measuring prose. */
    const reader = read("scripts/lib/crewClosingCardState.mts");
    const spawns = (source: string): boolean => /from "node:child_process"/.test(source);
    expect(reader).toContain("crewGhReader");
    expect(spawns(reader), "a private child-process call here is the defect, not the fix").toBe(false);
    /* POSITIVE CONTROL — the reading can go red. */
    expect(spawns('import { execFileSync } from "node:child_process";')).toBe(true);
  });
});
