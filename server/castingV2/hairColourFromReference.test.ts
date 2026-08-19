/**
 * THE COLOUR TAKE'S WORDS ROAD — the fence, the join, the budget, and the one
 * arm that drives the DESTINATION rather than a copy of its number.
 *
 * The constraint under test is fable-1079 §2: the words must carry WHERE each
 * tone sits, and *"copper, blonde and black"* is a wrong answer that passes a
 * flatness bar. So the arms below are written against the STRUCTURE that makes
 * that answer impossible, not against the prose that asks for it.
 */
import { describe, expect, it } from "vitest";

import { pictureSideAskLines, pictureSideClause } from "./sidePhrasing";
import {
  HAIR_COLOUR_READ_REFUSAL_CODES,
  HAIR_SECTION_SEPARATOR,
  HAIR_TONE_MAX_LENGTH,
  HAIR_WHERE_MAX_LENGTH,
  MAX_HAIR_COLOUR_LENGTH,
  composeHairColourSentence,
  hairColourReadOutcomeFor,
  readHairColourFromReference,
  readHairColourField,
  readHairColourSections,
  readPictureSide,
  type HairColourSection,
} from "./hairColourFromReference";
import { MAX_FREE_LENGTH, readDelta } from "./refineDelta";
import type { TextEngine } from "../providers/types";

/** A transport that answers with exactly these words, and records what it was asked. */
function engineSaying(reply: string): { engine: TextEngine; sent: { user?: string; images?: number } } {
  const sent: { user?: string; images?: number } = {};
  const engine = {
    async complete(request: any) {
      sent.user = request.user;
      sent.images = request.images?.length ?? 0;
      return { text: reply };
    },
  } as unknown as TextEngine;
  return { engine, sent };
}

const BYTES = { bytes: Buffer.from("not really a png"), contentType: "image/png" };

/**
 * HIS OWN SPECIMEN, as it was read at the frame (law 9, and
 * `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.2): one photograph, four blocked
 * tones. Every arm about a real head uses these words rather than invented
 * ones, because the whole difficulty of this road is his difficulty.
 */
const HIS_SPECIMEN: HairColourSection[] = [
  { tone: "orange-copper", where: "at the fringe", side: "right" },
  { tone: "platinum blonde", where: "at the fringe", side: "left" },
  /* The roots are not a side, and `null` is the ordinary answer for that. */
  { tone: "near-black", where: "at the roots", side: null },
  { tone: "silver-white", where: "at the lengths", side: "right" },
];

describe("the fence: no field a tone can arrive in without a place", () => {
  it("drops a section that names a tone and no place — the flattened answer", () => {
    /* THE ANSWER §9.2 EXISTS TO CATCH. It is not repaired into "all over": that
       would be this module telling her a four-block head is one colour. */
    expect(readHairColourSections([{ tone: "copper, blonde and black" }])).toEqual([]);
    expect(readHairColourSections([{ tone: "copper", where: null }])).toEqual([]);
    expect(readHairColourSections([{ tone: "copper", where: "" }])).toEqual([]);
  });

  it("drops a place with no tone, and keeps the sections either side of a bad one", () => {
    expect(readHairColourSections([
      { tone: "copper", where: "at the fringe" },
      { where: "at the roots" },
      { tone: "near-black", where: "at the ends" },
    ])).toEqual([
      { tone: "copper", where: "at the fringe", side: null },
      { tone: "near-black", where: "at the ends", side: null },
    ]);
  });

  it("keeps the reader's own order, which is the order it saw them in", () => {
    expect(readHairColourSections(HIS_SPECIMEN)).toEqual(HIS_SPECIMEN);
  });

  it("survives the shapes a model actually sends instead of a list", () => {
    expect(readHairColourSections(undefined)).toEqual([]);
    expect(readHairColourSections("copper")).toEqual([]);
    expect(readHairColourSections([null, "copper", 7, []])).toEqual([]);
  });
});

describe("one field, cleaned", () => {
  it("reads the word 'none' as an absence rather than as a colour", () => {
    /* D-172's scar: `makeup: "none — a bare face"` reached a paid prompt once. */
    for (const said of ["none", "null", "n/a", "unknown", "unclear", "nothing"]) {
      expect(readHairColourField(said, HAIR_TONE_MAX_LENGTH)).toBeNull();
    }
  });

  it("refuses a field longer than its cap rather than truncating it", () => {
    const long = "a".repeat(HAIR_TONE_MAX_LENGTH + 1);
    expect(readHairColourField(long, HAIR_TONE_MAX_LENGTH)).toBeNull();
    expect(readHairColourField("a".repeat(HAIR_TONE_MAX_LENGTH), HAIR_TONE_MAX_LENGTH))
      .toBe("a".repeat(HAIR_TONE_MAX_LENGTH));
  });

  it("tidies without changing the words, and lower-cases", () => {
    expect(readHairColourField("  Orange-Copper  ", HAIR_TONE_MAX_LENGTH)).toBe("orange-copper");
    expect(readHairColourField("at the  fringe.", HAIR_WHERE_MAX_LENGTH)).toBe("at the fringe");
  });

  it("every field of his own specimen clears its cap", () => {
    /* The caps are priced off this frame; an arm that did not check them
       against it would be a number chosen rather than measured. */
    for (const section of HIS_SPECIMEN) {
      expect(readHairColourField(section.tone, HAIR_TONE_MAX_LENGTH)).toBe(section.tone);
      expect(readHairColourField(section.where, HAIR_WHERE_MAX_LENGTH)).toBe(section.where);
    }
  });
});

describe("the join — one line for both shapes", () => {
  it("composes the ordinary one-colour head with no special path", () => {
    expect(composeHairColourSentence([
      { tone: "chestnut brown", where: "all over", side: null },
    ]).sentence).toBe("chestnut brown all over");
  });

  it("composes his four-block head so the words carry WHERE each tone sits", () => {
    /*
      HIS WHOLE HEAD, AND IT TOOK TWO CORRECTIONS TO GET HERE — worth the note,
      because the number under this arm moved twice in one sitting and both
      moves were forced by a measurement rather than by taste.

      These four composed to 118 of a 120 budget while the sides were unspoken.
      The ruled side spelling (fable-1084 §2) is fifteen characters a block and
      pushed them to 157, so the fourth was dropped. The per-subject cap
      (fable-1088 §2) then sized `hairShade`'s drawer to what a real blocked
      head actually needs, and all four ride:

        orange-copper at the fringe (picture right)          42
        platinum blonde at the fringe (picture left)     +46 = 88
        near-black at the roots                          +25 = 113
        silver-white at the lengths (picture right)      +44 = 157   of 200
    */
    const { sentence, used, dropped } = composeHairColourSentence(HIS_SPECIMEN);
    expect(sentence).toBe(
      "orange-copper at the fringe (picture right), platinum blonde at the fringe (picture left), "
      + "near-black at the roots, silver-white at the lengths (picture right)",
    );
    expect(used).toEqual(HIS_SPECIMEN);
    expect(dropped).toEqual([]);
    expect(sentence.length).toBeLessThanOrEqual(MAX_HAIR_COLOUR_LENGTH);
    /* The bar that matters: each tone appears with its place, so the sentence
       could not be mistaken for a different head with the same four tones. */
    for (const section of HIS_SPECIMEN) {
      expect(sentence).toContain(`${section.tone} ${section.where}`);
    }
  });

  it("TWO SIDED BLOCKS IN ONE SENTENCE ARE DISTINGUISHABLE — the ruled property", () => {
    /*
      fable-1084 §2, and it is the defect the first court found rather than a
      hypothetical. That reader answered *"down one side"* for one tone and
      *"down the other side"* for another on the same head: both true of the
      frame, neither usable by anything that paints by position, and read
      together they are a contradiction.

      The side is now an ENUM spelled by `sidePhrasing`, so two sided blocks
      differ BY CONSTRUCTION rather than by the reader having phrased them well.
    */
    const { sentence } = composeHairColourSentence([
      { tone: "copper", where: "at the fringe", side: "left" },
      { tone: "platinum", where: "at the fringe", side: "right" },
    ]);
    expect(sentence).toBe(
      "copper at the fringe (picture left), platinum at the fringe (picture right)",
    );
    /* Same place, same shape of phrase — and still two different answers. */
    const [first, second] = sentence.split(HAIR_SECTION_SEPARATOR);
    expect(first).not.toBe(second);
  });

  it("the side is spelled by the OWNER, never by this module", () => {
    /* One place knows how to say a side safely; a second copy would drift on
       exactly the fact it exists to hold still. */
    const { sentence } = composeHairColourSentence([
      { tone: "copper", where: "at the fringe", side: "left" },
    ]);
    expect(sentence).toBe(`copper at the fringe${pictureSideClause("left")}`);
  });

  it("a block with no side says nothing about sides", () => {
    const { sentence } = composeHairColourSentence([
      { tone: "near-black", where: "at the roots", side: null },
    ]);
    expect(sentence).toBe("near-black at the roots");
    expect(sentence).not.toContain("picture");
  });

  it("degrades gracefully when the reader answers a bare place", () => {
    /* Still English, and still carries the place — which is the property that
       made a two-field section worth more than one capped string. */
    expect(composeHairColourSentence([
      { tone: "copper", where: "fringe", side: null },
    ]).sentence).toBe("copper fringe");
  });
});

describe("the budget is the destination's, and nothing is cut silently", () => {
  const fat = (n: number): HairColourSection => ({
    tone: `tone${n}`.padEnd(HAIR_TONE_MAX_LENGTH, "x"),
    where: `where${n}`.padEnd(HAIR_WHERE_MAX_LENGTH, "y"),
    side: null,
  });

  it("stops before the cap rather than cutting through it", () => {
    const { sentence } = composeHairColourSentence([fat(1), fat(2), fat(3), fat(4)]);
    expect(sentence.length).toBeLessThanOrEqual(MAX_HAIR_COLOUR_LENGTH);
  });

  it("THE REAL READER'S OWN FIVE-BLOCK ANSWER RIDES WHOLE — the cap's own case", () => {
    /*
      REPORT VERSUS ARTIFACT, and this arm exists because the report was mine.
      `HIS_SPECIMEN` above is MY transcription; these five are what the real
      reader returned on run 1 of the court after the side field landed, and
      they are the exact sections `FREE_SUBJECT_MAX_LENGTH.hairShade` was
      priced against.

      At 120 this head arrived as TWO blocks of five, with the near-black roots
      — the dominant tone — handed back as leftovers. The arm now asserts the
      whole head, which is the promise the cap was raised to keep.
    */
    const asRead: HairColourSection[] = [
      { tone: "dark brown", where: "at the roots", side: null },
      { tone: "platinum blonde", where: "at the fringe", side: "left" },
      { tone: "copper orange", where: "at the fringe", side: "right" },
      { tone: "copper orange", where: "at the ends", side: "left" },
      { tone: "platinum blonde", where: "at the ends", side: "right" },
    ];
    const { sentence, used, dropped } = composeHairColourSentence(asRead);
    expect(used).toEqual(asRead);
    expect(dropped).toEqual([]);
    /*
      201, AND THE THREE CHARACTERS MATTER. The cap was first set to 200 off a
      hand-added table that summed the block lengths to 198 — so the derivation
      was three short, and the last block of his head was dropped by ONE
      character. This arm asserts the composed length rather than the sum,
      which is the only figure that could have caught it.
    */
    expect(sentence.length).toBe(201);
    expect(sentence.length).toBeLessThanOrEqual(MAX_HAIR_COLOUR_LENGTH);
  });

  it("AND AN EIGHT-BLOCK MONSTER STILL DROPS AND STILL RETURNS — bound (b)", () => {
    /*
      The cap is sized for the observed head, never for infinity (fable-1088
      §2b). The relief valve stays, and this arm is what keeps it honest: the
      day somebody reads 200 as "every head fits", the leftovers are still
      returned and still countable.

      THE STATED RULE for which blocks are spoken for (fable-1080 §2): the
      reader's own prominence order, which the ask asks for. What goes back to
      her is the tail it named last, never a block this code chose.
    */
    const monster: HairColourSection[] = Array.from({ length: 8 }, (_, index) => ({
      tone: `tone${index}`.padEnd(HAIR_TONE_MAX_LENGTH, "x"),
      where: `where${index}`.padEnd(HAIR_WHERE_MAX_LENGTH, "y"),
      side: null,
    }));
    const { sentence, used, dropped } = composeHairColourSentence(monster);
    expect(sentence.length).toBeLessThanOrEqual(MAX_HAIR_COLOUR_LENGTH);
    expect(dropped.length).toBeGreaterThan(0);
    expect([...used, ...dropped]).toEqual(monster);
    expect(used).toEqual(monster.slice(0, used.length));
  });

  it("THE DESTINATION ITSELF ACCEPTS THE LONGEST SENTENCE THIS CAN PRODUCE", () => {
    /*
      DRIVEN, NOT COMPARED (law 2, and the credit-velocity caps' own defect: a
      suite comparing local constants to themselves cannot go red when its
      subject moves). The sentence is fed to `readDelta` — the guard that
      actually caps a free value — with the containment instruction it will
      really arrive with.
    */
    const { sentence } = composeHairColourSentence(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => fat(n)),
    );
    const instruction = `make her hair ${sentence}`;
    expect(readDelta({ free: { hairShade: sentence } }, { instruction }))
      .toEqual({ free: { hairShade: sentence } });

    /* THE POSITIVE CONTROL: one character over this subject's own cap and the
       same guard refuses it. Without this arm the pass above proves only that
       this happens to fit today — it cannot tell a working cap from a deleted
       one. Containment is satisfied on purpose, so the refusal can only be the
       length. */
    const overlong = `${sentence} ${"y".repeat(MAX_HAIR_COLOUR_LENGTH - sentence.length)}`;
    expect(overlong.length).toBe(MAX_HAIR_COLOUR_LENGTH + 1);
    expect(readDelta(
      { free: { hairShade: overlong } },
      { instruction: `make her hair ${overlong}` },
    )).toBeNull();

    /*
      AND EVERY OTHER DRAWER IS BYTE-UNCHANGED AT 120 — bound (c), and the arm
      that makes the table a table rather than a raise.

      A value that `hairShade` now carries must still be refused for a subject
      that did not earn a bigger cap. Driven on the real guard with containment
      satisfied, so the refusal is the length and nothing else.
    */
    const past120 = "y".repeat(MAX_FREE_LENGTH + 1);
    expect(readDelta({ free: { teeth: past120 } }, { instruction: `her teeth ${past120}` }))
      .toBeNull();
    expect(readDelta(
      { free: { teeth: "y".repeat(MAX_FREE_LENGTH) } },
      { instruction: `her teeth ${"y".repeat(MAX_FREE_LENGTH)}` },
    )).toEqual({ free: { teeth: "y".repeat(MAX_FREE_LENGTH) } });
  });
});

describe("the read, end to end on a fake transport", () => {
  it("carries the whole contract to the wire", async () => {
    /* ASSERT AT THE WIRE (invariant 5): the fence is what the reader is
       actually sent, never a constant near the prompt. */
    const { engine, sent } = engineSaying(JSON.stringify({
      hair: "yes",
      sections: [{ tone: "chestnut brown", where: "all over" }],
    }));
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(true);
    expect(sent.images).toBe(1);
    /* The side is asked for BY THE OWNER'S OWN LINES, so the ask and the phrase
       cannot drift apart — asserted on the outgoing request rather than on a
       constant near it (invariant 5). */
    for (const line of pictureSideAskLines()) expect(sent.user).toContain(line);
    expect(sent.user).toContain('Do NOT put a side in "where"');
    /* The two halves that make the answer spatial: the pair is demanded, and
       the caps the fields are judged by are the caps the reader is told. */
    expect(sent.user).toContain("Never a tone on its own");
    expect(sent.user).toContain(`at most ${HAIR_TONE_MAX_LENGTH} characters`);
    expect(sent.user).toContain(`at most ${HAIR_WHERE_MAX_LENGTH}`);
    /* And the gate is anchored on the BODY PART, which is the thing that was
       measured to work where makeup's judgement-anchored one invented. */
    expect(sent.user).toContain("is there hair growing on this person's head?");
  });

  it("refuses when the presence gate says no, whatever the sections claim", async () => {
    const { engine } = engineSaying(JSON.stringify({
      hair: "no",
      sections: [{ tone: "golden", where: "all over" }],
    }));
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome).toEqual({
      ok: false,
      refusal: {
        code: "noHairVisible",
        message: "We couldn't see any hair on a head in that picture to take.",
      },
    });
  });

  it("a MISSING presence field is not a 'no'", async () => {
    /* `undefined` is not `no` — refusing on it would tell her that her own
       photograph has no hair in it because a reply came back shaped wrong. */
    const { engine } = engineSaying(JSON.stringify({
      sections: [{ tone: "chestnut brown", where: "all over" }],
    }));
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(true);
  });

  it("separates 'no hair here' from 'hair I could not put words to'", async () => {
    const { engine } = engineSaying(JSON.stringify({ hair: "yes", sections: [] }));
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.refusal.code).toBe("noColourReadable");
    /* One sentinel must never mean both, and the customer's two sentences
       differ as well — she is told which thing happened. */
    expect(outcome.refusal.message).not.toContain("couldn't see any hair");
  });

  it("a flattened answer refuses rather than filing a placeless colour", async () => {
    /* END TO END, the wrong answer from §9.2: every tone named, no place. */
    const { engine } = engineSaying(JSON.stringify({
      hair: "yes",
      sections: [{ tone: "copper, blonde and black" }],
    }));
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.refusal.code).toBe("noColourReadable");
  });

  it("refuses with no transport, and never guesses", async () => {
    const outcome = await readHairColourFromReference({ ...BYTES, engine: null });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.refusal.code).toBe("noTransport");
  });

  it("reads a reply that is not JSON as unreadable", async () => {
    const { engine } = engineSaying("I'm sorry, I can't help with that.");
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.refusal.code).toBe("unreadable");
  });

  it("reads a fenced JSON block, which is what the transport actually sends", async () => {
    const { engine } = engineSaying(
      "```json\n" + JSON.stringify({ hair: "yes", sections: HIS_SPECIMEN }) + "\n```",
    );
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    expect(outcome.used).toEqual(HIS_SPECIMEN);
    expect(outcome.dropped).toEqual([]);
  });

  it("a transport that throws is unreadable, not empty", async () => {
    const engine = {
      async complete() { throw new Error("socket"); },
    } as unknown as TextEngine;
    const outcome = await readHairColourFromReference({ ...BYTES, engine });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.refusal.code).toBe("unreadable");
  });
});

describe("the demand value is spelled mechanically", () => {
  it("turns every refusal code into its column spelling", () => {
    expect(hairColourReadOutcomeFor({ ok: true, sentence: "x", used: [], dropped: [] }))
      .toBe("delivered");
    /* Walked over the whole list rather than a chosen member, so a fifth code
       added without a migration is visible here rather than in a tally. */
    const spelled = HAIR_COLOUR_READ_REFUSAL_CODES.map((code) =>
      hairColourReadOutcomeFor({ ok: false, refusal: { code, message: "" } }));
    expect(spelled).toEqual([
      "no_transport",
      "unreadable",
      "no_hair_visible",
      "no_colour_readable",
    ]);
  });
});

describe("the caps and the separator are one story", () => {
  it("the separator is what the composer actually joins with", () => {
    const { sentence } = composeHairColourSentence([
      { tone: "copper", where: "at the fringe", side: null },
      { tone: "black", where: "at the roots", side: null },
    ]);
    expect(sentence).toBe(`copper at the fringe${HAIR_SECTION_SEPARATOR}black at the roots`);
  });
});
