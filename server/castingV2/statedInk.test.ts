import { describe, expect, it } from "vitest";

import { parseStatedInk } from "./castingIntent";

/**
 * INK THE BRIEF ITSELF NAMED — 7b(a)'s reading half (designed opus-1031/1040,
 * countersigned fable-1381 ruling 2 and fable-1396 §1).
 *
 * # The specimen is real and it is the only one
 *
 * Production has TWO rolls whose brief names ink, fifteen minutes apart, with
 * the same text. Every arm below that uses a brief uses THAT brief, verbatim,
 * because the population this field serves is that sentence and a reworded one
 * is a different specimen.
 *
 * # What these arms are for
 *
 * The field is filled by a model, so the parser is the only thing standing
 * between a reply and a record. Three ways it can be wrong, and each has a
 * control here: it can invent words she never typed, it can invent a REGION,
 * and it can fall back to `wholeBody` without saying that it did.
 */

/** Roll 129's own sentence, from production. */
const BRIEF = "Editorial fashion portrait of an ethnically ambiguous adult male model. "
  + "Bare-chested, displaying extensive black-and-grey ornamental tattoos covering most of "
  + "his chest, shoulders, upper arms, and lower neck. The tattoos feature dense geometric "
  + "patterns, circular motifs, intricate linework, and large symmetrical areas of dark ink.";

describe("the brief's own ink", () => {
  it("reads her words and the SET of regions the sentence covers", () => {
    const read = parseStatedInk({
      words: ["extensive black-and-grey ornamental tattoos"],
      regions: ["torso", "arms", "neck"],
    }, BRIEF);
    expect(read).not.toBeNull();
    expect(read!.words).toEqual(["extensive black-and-grey ornamental tattoos"]);
    /* Three regions from one sentence. A single region would have to choose,
       and choosing is a fact about her body invented by us. */
    expect(read!.regions).toEqual(["torso", "arms", "neck"]);
    expect(read!.readFailed).toBe(false);
  });

  it("NEGATIVE CONTROL — a brief that names no ink reads as nothing", () => {
    expect(parseStatedInk(null, BRIEF)).toBeNull();
    expect(parseStatedInk(undefined, BRIEF)).toBeNull();
    expect(parseStatedInk({}, BRIEF)).toBeNull();
    expect(parseStatedInk({ words: [], regions: ["torso"] }, BRIEF)).toBeNull();
  });

  it("REGIONS WITHOUT WORDS ARE NOT A READING — no words, no row", () => {
    /* A regions array on its own is a claim about her body with nothing she
       said underneath it. The whole field is *what the brief said*. */
    expect(parseStatedInk({ regions: ["torso", "arms"] }, BRIEF)).toBeNull();
  });

  it("drops a phrase containing a word she never typed", () => {
    /* Source containment (D-172), the same rule `statedHair` and
       `statedAccessories` carry: a paraphrase read back to her as her own
       sentence is worse than an empty list. */
    const read = parseStatedInk({
      words: ["a sprawling japanese sleeve", "extensive black-and-grey ornamental tattoos"],
      regions: ["arms"],
    }, BRIEF);
    expect(read!.words).toEqual(["extensive black-and-grey ornamental tattoos"]);
  });

  it("refuses a region the vocabulary does not hold, and does not fall to wholeBody for it", () => {
    /* An invented region is the one answer that is worse than none: it is
       geometry, and every later reader treats it as measured. */
    const read = parseStatedInk({
      words: ["ornamental tattoos"],
      regions: ["forearm", "ribcage", "torso"],
    }, BRIEF);
    expect(read!.regions).toEqual(["torso"]);
    expect(read!.readFailed).toBe(false);
  });

  it("⚠ NAMED INK WITH NO USABLE REGION FALLS TO wholeBody AND SAYS SO", () => {
    /* Ruling 2's own condition. Over-inclusive is never WRONG about where the
       ink is; a silent fallback is how a bad reader hides for six months, so
       the provenance travels beside the answer it explains. */
    const read = parseStatedInk({ words: ["ornamental tattoos"], regions: [] }, BRIEF);
    expect(read!.regions).toEqual(["wholeBody"]);
    expect(read!.readFailed).toBe(true);

    const missing = parseStatedInk({ words: ["ornamental tattoos"] }, BRIEF);
    expect(missing!.regions).toEqual(["wholeBody"]);
    expect(missing!.readFailed).toBe(true);

    const rubbish = parseStatedInk({ words: ["ornamental tattoos"], regions: ["everywhere"] }, BRIEF);
    expect(rubbish!.regions).toEqual(["wholeBody"]);
    expect(rubbish!.readFailed).toBe(true);
  });

  it("⚠ AND A REAL wholeBody IS NOT A FAILURE — the two are told apart", () => {
    /* The reading that says *this ink spans her* is a genuine answer and must
       not be filed as a broken one, or the provenance stops meaning anything
       the day somebody counts it. */
    const read = parseStatedInk({
      words: ["ornamental tattoos"],
      regions: ["wholeBody"],
    }, BRIEF);
    expect(read!.regions).toEqual(["wholeBody"]);
    expect(read!.readFailed).toBe(false);
  });

  it("wholeBody SWALLOWS the narrower regions rather than sitting beside them", () => {
    /* A set holding both is a contradiction the reader may produce and we may
       not store: every consumer downstream would have to choose, and they would
       not all choose the same way. */
    const read = parseStatedInk({
      words: ["ornamental tattoos"],
      regions: ["torso", "wholeBody", "arms"],
    }, BRIEF);
    expect(read!.regions).toEqual(["wholeBody"]);
    expect(read!.readFailed).toBe(false);
  });

  it("deduplicates both halves and caps the phrases", () => {
    const read = parseStatedInk({
      words: [
        "ornamental tattoos", "Ornamental Tattoos", "dense geometric patterns",
        "circular motifs", "intricate linework",
      ],
      regions: ["torso", "torso", "arms"],
    }, BRIEF);
    expect(read!.words).toHaveLength(3);
    expect(read!.regions).toEqual(["torso", "arms"]);
  });

  it("refuses digits, as every free field here does", () => {
    /* They render as text artefacts in the picture and mean the model answered
       with a measurement rather than a description. */
    const read = parseStatedInk({
      words: ["3 ornamental tattoos", "ornamental tattoos"],
      regions: ["torso"],
    }, BRIEF);
    expect(read!.words).toEqual(["ornamental tattoos"]);
  });

  it("⚠ does NOT apply the clothing filter its neighbours apply", () => {
    /*
      Every parser beside this one drops a phrase mentioning worn clothing,
      because for a FACE field a clothing word means the model answered the
      wrong question. This field's own specimen opens *"Bare-chested,
      displaying extensive … tattoos"* — a clothing filter here would drop the
      sentence that names the ink for saying where the skin is.
    */
    const read = parseStatedInk({
      words: ["Bare-chested, displaying extensive black-and-grey ornamental tattoos"],
      regions: ["torso"],
    }, BRIEF);
    expect(read!.words).toHaveLength(1);
    expect(read!.words[0]).toContain("Bare-chested");
  });

  it("survives a reply that is not the shape at all", () => {
    /* Never throws: this runs inside a paid roll's interpretation, and a throw
       here costs somebody their sheet for a field that is not the picture. */
    for (const rubbish of ["", 0, [], "tattoos", { words: "not an array" }]) {
      expect(() => parseStatedInk(rubbish, BRIEF)).not.toThrow();
    }
    expect(parseStatedInk({ words: "not an array" }, BRIEF)).toBeNull();
  });
});
