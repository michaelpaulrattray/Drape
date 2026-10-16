import { describe, expect, it } from "vitest";

import {
  INK_PLACEMENT_MAX_LENGTH,
  INK_PLACEMENT_TALLY_MAX_LENGTH,
  INK_PLACEMENT_TALLY_UNKEPT,
  inkPlacementColumnValue,
  inkPlacementTallyValue,
  resolveInkPlacement,
} from "./inkPlacementResolve";
import { INK_PLACEMENTS, inkPlacementEntry } from "../../shared/inkPlacementVocabulary";
import { classifyInkPlacement } from "./inkPlacement";

describe("the measured surfaces are found however she spells them", () => {
  /*
    THE CAMELCASE TRAP, FIRST AND BY NAME.

    A resolver that lowercased before asking the vocabulary turns `upperArm`
    into `upperarm` and files HIS OLDEST MEASURED PLACEMENT as an open phantom
    — five of the seven design rows in the dev database are `upperArm`. This
    arm is the one that reddens if anybody ever "simplifies" the match.
  */
  it("finds upperArm from the key itself, camelCase intact", () => {
    expect(resolveInkPlacement("upperArm")).toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("finds the same surface from the reader's word and the customer's noun", () => {
    expect(resolveInkPlacement("upper arm")).toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("her upper arm")).toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("is not thrown by casing or spacing, which are transport and not meaning", () => {
    expect(resolveInkPlacement("  Upper   Arm  ")).toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("NECK")).toEqual({ kind: "measured", placement: "neck" });
  });

  it("matches EVERY member by all three of its spellings, so a fourth joins by existing", () => {
    /* The derivation asserted rather than the three cases spot-checked: a
       placement added to the vocabulary is matchable the moment it is added,
       and this arm is what says so. */
    for (const key of INK_PLACEMENTS) {
      const entry = inkPlacementEntry(key);
      for (const spelling of [key, entry.readerWord, entry.noun]) {
        expect(resolveInkPlacement(spelling), `${key} via "${spelling}"`)
          .toEqual({ kind: "measured", placement: key });
      }
    }
  });
});

describe("a word the vocabulary never measured is HERS, not a refusal", () => {
  it("files a sleeve as an open phrase", () => {
    expect(resolveInkPlacement("sleeve")).toEqual({ kind: "open", phrase: "sleeve" });
  });

  it("collapses casing and spacing into one signal", () => {
    for (const raw of ["Sleeve", " sleeve ", "SLEEVE", "sleeve"]) {
      expect(resolveInkPlacement(raw)).toEqual({ kind: "open", phrase: "sleeve" });
    }
  });

  it("DOES NOT merge a full sleeve into a sleeve — the meaning line", () => {
    /*
      The line this resolver will not cross, asserted so a later convenience
      cannot cross it quietly. A full sleeve and a half sleeve are different
      pieces of work; merging them hands the founder a number a machine has
      already applied a judgement to. The synonym judgement belongs to the human
      reading the tally.
    */
    const sleeve = resolveInkPlacement("sleeve");
    const full = resolveInkPlacement("full sleeve");
    expect(full).toEqual({ kind: "open", phrase: "full sleeve" });
    expect(full).not.toEqual(sleeve);
  });

  it("never strips an article, because that is inference", () => {
    expect(resolveInkPlacement("the ribs")).toEqual({ kind: "open", phrase: "the ribs" });
    expect(resolveInkPlacement("my ribs")).toEqual({ kind: "open", phrase: "my ribs" });
    /* And the two are not merged with each other, for the same reason. */
    expect(resolveInkPlacement("the ribs")).not.toEqual(resolveInkPlacement("ribs"));
  });
});

describe("the two answers that are questions, never refusals", () => {
  it("says ABSENT for a place nobody named", () => {
    for (const raw of ["", "   ", "\t\n "]) {
      expect(resolveInkPlacement(raw)).toEqual({ kind: "absent" });
    }
  });

  it("says TOO LONG for a sentence, with the length so the caller can say it", () => {
    const sentence = "x".repeat(INK_PLACEMENT_MAX_LENGTH + 1);
    expect(resolveInkPlacement(sentence)).toEqual({
      kind: "tooLong",
      length: INK_PLACEMENT_MAX_LENGTH + 1,
    });
  });

  it("admits a phrase of exactly the cap — the boundary, from the storable side", () => {
    const exact = "x".repeat(INK_PLACEMENT_MAX_LENGTH);
    expect(resolveInkPlacement(exact)).toEqual({ kind: "open", phrase: exact });
  });

  it("asks the MEASURED question before the length one", () => {
    /*
      Order, asserted rather than assumed. A measured spelling is short by
      construction so this can never bite today — which is exactly why it is
      pinned: a cap written for open prose must never become a gate on the
      vocabulary as well.
    */
    expect(INK_PLACEMENT_MAX_LENGTH).toBeGreaterThan("her upper chest".length);
    expect(resolveInkPlacement("her upper chest")).toEqual({ kind: "measured", placement: "upperChest" });
  });
});

describe("what each row stores", () => {
  it("the design row keeps the key for a measured surface and her phrase otherwise", () => {
    expect(inkPlacementColumnValue(resolveInkPlacement("her neck"))).toBe("neck");
    expect(inkPlacementColumnValue(resolveInkPlacement("sleeve"))).toBe("sleeve");
  });

  it("stores nothing for the two questions, because there is no ask yet", () => {
    expect(inkPlacementColumnValue(resolveInkPlacement(""))).toBeNull();
    expect(inkPlacementColumnValue(resolveInkPlacement("x".repeat(200)))).toBeNull();
  });

  it("every storable value fits the column, on every branch", () => {
    for (const raw of ["upperArm", "her upper chest", "sleeve", "x".repeat(INK_PLACEMENT_MAX_LENGTH)]) {
      const value = inkPlacementColumnValue(resolveInkPlacement(raw));
      expect(value === null || value.length <= INK_PLACEMENT_MAX_LENGTH, `"${raw.slice(0, 20)}"`).toBe(true);
    }
  });
});

describe("the tally keeps place names and refuses to keep sentences", () => {
  it("derives its bound from the vocabulary rather than from a feel", () => {
    /* Twice the longest thing this vocabulary has ever needed to say — `her
       upper chest`, 15 characters. Asserted as the DERIVATION so a fourth
       placement moves it without anybody editing a number. */
    const longest = Math.max(...INK_PLACEMENTS.flatMap((key) => {
      const entry = inkPlacementEntry(key);
      return [key.length, entry.readerWord.length, entry.noun.length];
    }));
    expect(longest).toBe("her upper chest".length);
    expect(INK_PLACEMENT_TALLY_MAX_LENGTH).toBe(2 * longest);
  });

  it("keeps a place-name-sized phrase exactly as the design row has it", () => {
    expect(inkPlacementTallyValue(resolveInkPlacement("sleeve"))).toBe("sleeve");
    expect(inkPlacementTallyValue(resolveInkPlacement("upperArm"))).toBe("upperArm");
  });

  it("replaces a longer phrase with a sentinel rather than truncating it", () => {
    /*
      THE PRIVACY BOUNDARY AT ITS EXACT EDGE. `casting_ink_form_demand` exists
      as its own table because its columns cannot be traced to a person. A
      truncation is a phrase somebody could still read; a sentinel is not.
    */
    const long = "my right arm where my son's name is already tattooed";
    expect(long.length).toBeGreaterThan(INK_PLACEMENT_TALLY_MAX_LENGTH);
    expect(long.length).toBeLessThanOrEqual(INK_PLACEMENT_MAX_LENGTH);

    const resolved = resolveInkPlacement(long);
    expect(resolved.kind).toBe("open");
    /* It is HERS on her own row… */
    expect(inkPlacementColumnValue(resolved)).toBe(long);
    /* …and it is nobody's on the unattributed one. */
    expect(inkPlacementTallyValue(resolved)).toBe(INK_PLACEMENT_TALLY_UNKEPT);
  });

  it("uses a sentinel no customer phrase can forge", () => {
    /*
      Uppercase, and the normaliser lowercases — so the sentinel is unreachable
      from any input rather than merely unlikely. A sentinel a customer could
      type is one that eventually means two things.
    */
    expect(INK_PLACEMENT_TALLY_UNKEPT).toBe(INK_PLACEMENT_TALLY_UNKEPT.toUpperCase());
    expect(INK_PLACEMENT_TALLY_UNKEPT).not.toBe(INK_PLACEMENT_TALLY_UNKEPT.toLowerCase());
    const forged = resolveInkPlacement(INK_PLACEMENT_TALLY_UNKEPT);
    expect(forged).toEqual({ kind: "open", phrase: "open" });
    expect(inkPlacementTallyValue(forged)).toBe("open");
    expect(inkPlacementTallyValue(forged)).not.toBe(INK_PLACEMENT_TALLY_UNKEPT);
  });

  it("keeps a MEASURED key whatever its length, because a key is not prose", () => {
    /* The tally bound is about free text. A vocabulary key is a value we chose
       and it identifies nobody, so it is never sentinelled — a distinction that
       only shows itself if a long placement is ever measured. */
    for (const key of INK_PLACEMENTS) {
      expect(inkPlacementTallyValue({ kind: "measured", placement: key })).toBe(key);
    }
  });
});

/**
 * DECOMPOSITION — her side word, taken out of the place name it was sitting
 * inside (ruled fable-1163 §3, found by driving the surface 2026-08-20).
 *
 * *"use this tattoo design on her left upper arm"* is the phrasing a person
 * actually types, and before this it read back as the OPEN phrase `left upper
 * arm` and was refused as an unmeasured surface — in a sentence that said
 * *"her left left upper arm is more than I can place yet"*. `upperArm` is one
 * of the three measured surfaces; the ask was always serveable.
 *
 * The line this must not cross is 1115 §3's: a side is never DERIVED from a
 * placement word. Nothing is derived here — the side is one she typed and the
 * containment guard already admitted; this only stops it being counted twice.
 */
describe("her own side word inside the place name", () => {
  it("resolves the natural phrasing to the measured surface", () => {
    expect(resolveInkPlacement("left upper arm", "left"))
      .toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("right upper arm", "right"))
      .toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("takes it off either end, as a WHOLE word", () => {
    expect(resolveInkPlacement("upper arm left", "left"))
      .toEqual({ kind: "measured", placement: "upperArm" });
    /* "leftover" is not her side word with a suffix; it is a different word. */
    expect(resolveInkPlacement("leftover shoulder", "left").kind).toBe("open");
  });

  it("CONSUMES ONLY THE SIDE SHE STATED — never any side word it finds", () => {
    /*
      The condition that keeps this out of 1115 §3's territory. A sentence that
      captured "right" may not have "left" stripped out of a phrase: that would
      be the resolver editing a place name on the strength of a word she used
      about something else.
    */
    expect(resolveInkPlacement("left upper arm", "right").kind).toBe("open");
    expect(resolveInkPlacement("left upper arm", null).kind).toBe("open");
    /* `centre` is the vocabulary's answer for a single surface and is never a
       word she states, so it consumes nothing either. */
    expect(resolveInkPlacement("left upper arm", "centre").kind).toBe("open");
  });

  it("LEAVES AN UNMEASURED SURFACE OPEN, with her whole phrase intact", () => {
    /*
      The negative that matters most. "sleeve" is unmeasured, so stripping the
      side gets no closer to a measured surface — and the phrase kept is HER
      phrase, because an open phrase is the demand tally's evidence and is
      never edited (1114 §2's founding sentence).
    */
    expect(resolveInkPlacement("left sleeve", "left"))
      .toEqual({ kind: "open", phrase: "left sleeve" });
    expect(resolveInkPlacement("left forearm", "left"))
      .toEqual({ kind: "open", phrase: "left forearm" });
  });

  it("cannot strip a phrase down to nothing", () => {
    /* A phrase that IS the side word alone names no surface, and a remainder of
       "" must never be offered to the vocabulary as if it were one. */
    expect(resolveInkPlacement("left", "left")).toEqual({ kind: "open", phrase: "left" });
  });

  it("changes nothing for every measured spelling that never carried a side", () => {
    /* The unchanged control, swept over the vocabulary rather than sampled: a
       decomposition that altered a direct match would be a fix that broke the
       thing it was extending. */
    for (const key of INK_PLACEMENTS) {
      const entry = inkPlacementEntry(key);
      for (const spelling of [key, entry.readerWord, entry.noun]) {
        expect(resolveInkPlacement(spelling, "left"))
          .toEqual({ kind: "measured", placement: key });
        expect(resolveInkPlacement(spelling, null))
          .toEqual({ kind: "measured", placement: key });
      }
    }
  });
});

/**
 * HER DETERMINER, AND THE LINE IT DOES NOT CROSS (#2572).
 *
 * The vocabulary's noun hard-codes ONE possessive, so the neck was recognised
 * as `neck` and `her neck` and filed as an open phantom as *"their neck"* —
 * which is the phrasing this product uses itself, under the standing order that
 * nothing it writes is gender-specific about anybody. The founder's own court on
 * #2565 met it: the ask was asked WHERE, answered *"their neck"*, and the
 * answer was not understood.
 *
 * Driven over 25 phrasings before the fix: 13 read `open` here while
 * `classifyInkPlacement` called the same words `in_frame` on the measured
 * surface. These arms pin the 8 the fix moves AND the ones it deliberately
 * leaves alone, because a determiner strip that kept going would be the
 * meaning judgement the module's header reserves to a person.
 */
describe("a determiner is not a surface (#2572)", () => {
  const DETERMINERS = ["the", "her", "his", "their", "its", "my", "our", "your"];

  it("every determiner in front of every measured surface resolves to that surface", () => {
    for (const key of INK_PLACEMENTS) {
      const entry = inkPlacementEntry(key);
      /* The bare noun, so the possessive under test is the only one present:
         `entry.noun` already carries "her". */
      const bare = entry.noun.replace(/^her\s+/, "");
      for (const determiner of DETERMINERS) {
        expect(
          resolveInkPlacement(`${determiner} ${bare}`),
          `"${determiner} ${bare}" is ${key}, and reading it as an unmeasured phrase files a false demand row`,
        ).toEqual({ kind: "measured", placement: key });
      }
    }
  });

  it("the product's own word for a person is read — \"their neck\", the court's phrase", () => {
    expect(resolveInkPlacement("their neck")).toEqual({ kind: "measured", placement: "neck" });
    expect(resolveInkPlacement("their upper arm")).toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("their upper chest")).toEqual({ kind: "measured", placement: "upperChest" });
  });

  it("a determiner AND the side she stated both come off, composed", () => {
    /* `withoutStatedSide` anchors at the ends, so it cannot see `left` with
       `their` in front of it — the two strips have to compose or the most
       natural phrasing of a per-side surface stays open. */
    expect(resolveInkPlacement("their left upper arm", "left"))
      .toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("the right upper arm", "right"))
      .toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("⚠ A SPATIAL QUALIFIER HE DID NOT RULE ON keeps the customer's phrase and stays open", () => {
    /* `side of` and `front of` were ruled (option A, the describe below);
       `top of` was not, and the classifier reading the upper arm in it is not a
       licence to read it here. */
    for (const phrase of ["top of the upper arm", "below the neck", "around the neck"]) {
      expect(resolveInkPlacement(phrase), `"${phrase}" must keep the customer's words`)
        .toEqual({ kind: "open", phrase });
    }
  });

  it("CONTROL — an unmeasured surface stays open with every determiner, and is never merged", () => {
    /* `sleeve` and `throat` are the header's own examples of words this
       vocabulary has not measured. A determiner strip must not turn either into
       a measured surface, and must not edit the phrase on the way out. */
    for (const phrase of ["the sleeve", "their throat", "my inner forearm", "the wrist"]) {
      expect(resolveInkPlacement(phrase), `"${phrase}" names nothing measured`)
        .toEqual({ kind: "open", phrase });
    }
  });

  it("CONTROL — a determiner ALONE is not stripped into nothing", () => {
    /* `stripped === ""` is why the guard is there: "the" on its own must stay
       her phrase rather than becoming an empty match attempt. */
    expect(resolveInkPlacement("the")).toEqual({ kind: "open", phrase: "the" });
    expect(resolveInkPlacement("their")).toEqual({ kind: "open", phrase: "their" });
  });

  it("CONTROL — ONLY a determiner comes off, never just any leading word", () => {
    /* The discriminating shape: a two-word phrase whose first word is NOT a
       determiner and whose remainder IS measured. A strip of `^\S+\s+` would
       read every one of these as the bare surface — driven, it does — and the
       header's own example is why that is wrong: *"a full sleeve and a half
       sleeve are different pieces of work"*, so `full neck` is not `neck` by
       machine either. The other arms here did not catch this (the over-reach
       was caught by the side-word arm instead), which is why it has its own. */
    for (const phrase of ["full neck", "entire neck", "whole upper arm", "half upper arm"]) {
      expect(resolveInkPlacement(phrase), `"${phrase}" is not a determiner in front of a surface`)
        .toEqual({ kind: "open", phrase });
    }
  });

  it("CONTROL — a determiner INSIDE the phrase is left where it is", () => {
    /* Whole word, at the FRONT, once. Anything else is the meaning judgement. */
    expect(resolveInkPlacement("theatre mask on the neck"))
      .toEqual({ kind: "open", phrase: "theatre mask on the neck" });
  });
});

/**
 * "SIDE OF THE NECK" IS THE NECK — the founder's option A on #2572, verbatim:
 * *"A less friction if someone says side of the next the image engine can
 * reliably decide that itself"*.
 *
 * Every phrase is driven through BOTH readers of the question — this resolver
 * and `classifyInkPlacement`, the ink gate one module over — because two
 * readers of one question disagreeing is exactly what the card measured.
 */
describe("a side or front of a measured surface is that surface (#2572, option A)", () => {
  const RULED_NECK = [
    "side of the neck", "side of her neck", "side of his neck", "side of their neck",
    "side of my neck", "side of neck", "the side of the neck", "the side of their neck",
    "front of the neck", "front of their neck", "the front of the neck",
    "left side of the neck", "right side of the neck", "left side of their neck",
    "the left side of the neck", "Side Of  The Neck",
  ];

  it("every ruled neck phrasing resolves to the neck in one step — and the classifier agrees", () => {
    for (const phrase of RULED_NECK) {
      expect(resolveInkPlacement(phrase), `"${phrase}" is the neck`)
        .toEqual({ kind: "measured", placement: "neck" });
      expect(classifyInkPlacement(phrase, "ink"), `the ink gate reads "${phrase}" as the neck too`)
        .toEqual({ kind: "in_frame", place: "neck" });
    }
  });

  it("composes with the side the customer stated, which is still the only side it consumes", () => {
    expect(resolveInkPlacement("left side of the neck", "left"))
      .toEqual({ kind: "measured", placement: "neck" });
    expect(resolveInkPlacement("side of the upper arm"))
      .toEqual({ kind: "measured", placement: "upperArm" });
    expect(resolveInkPlacement("left side of the upper arm", "left"))
      .toEqual({ kind: "measured", placement: "upperArm" });
  });

  it("CONTROL — a side word on a PAIRED surface is never consumed unless the customer stated it", () => {
    /* `upperArm` comes in pairs: reading "right side of the upper arm" with no
       stated side as the upper arm would let a strip pick an arm, which is the
       side machinery's job (fable-1115 §3). */
    expect(resolveInkPlacement("right side of the upper arm"))
      .toEqual({ kind: "open", phrase: "right side of the upper arm" });
    expect(resolveInkPlacement("right side of the upper arm", "left"))
      .toEqual({ kind: "open", phrase: "right side of the upper arm" });
  });

  it("REFUSAL ARM — back and nape stay refused by both readers", () => {
    for (const phrase of [
      "back of the neck", "back of her neck", "the back of the neck", "nape of the neck",
      "side of the nape", "front of the back of the neck", "side of the back of the neck",
    ]) {
      expect(resolveInkPlacement(phrase), `"${phrase}" is hidden`).toEqual({ kind: "open", phrase });
      expect(classifyInkPlacement(phrase, "ink"), `the ink gate still refuses "${phrase}"`)
        .toEqual({ kind: "needs_document" });
    }
  });

  it("CONTROL — a qualifier in front of something unmeasured is never made measured", () => {
    for (const phrase of ["side of the throat", "front of the wrist", "side of the sleeve", "side of", "side of the"]) {
      expect(resolveInkPlacement(phrase), `"${phrase}" names nothing measured`)
        .toEqual({ kind: "open", phrase });
    }
  });

  it("CONTROL — the qualifier is read at the FRONT only, never anywhere in the phrase", () => {
    expect(resolveInkPlacement("a rose by the side of the neck"))
      .toEqual({ kind: "open", phrase: "a rose by the side of the neck" });
  });

  it("CONTROL — every phrase this resolver measures, the classifier reads on the same surface", () => {
    /* The one-direction agreement the construction promises, over the whole
       grid: a resolver that measured a place the gate reads differently is the
       card's defect run backwards. */
    const qualifiers = ["side of", "front of", "left side of", "right side of", "top of", "back of"];
    const determiners = ["", "the ", "their ", "her "];
    let measuredCount = 0;
    for (const key of INK_PLACEMENTS) {
      const bare = inkPlacementEntry(key).noun.replace(/^her\s+/, "");
      for (const qualifier of qualifiers) {
        for (const determiner of determiners) {
          const phrase = `${qualifier} ${determiner}${bare}`;
          const resolved = resolveInkPlacement(phrase);
          if (resolved.kind !== "measured") continue;
          const gate = classifyInkPlacement(phrase, "ink");
          const gateSurface = gate.kind === "in_frame"
            ? INK_PLACEMENTS.find((one) => inkPlacementEntry(one).readerWord === gate.place) ?? null
            : "surface" in gate ? gate.surface : null;
          expect(gateSurface, `the ink gate reads "${phrase}" (${gate.kind}) on another surface`)
            .toBe(resolved.placement);
          measuredCount += 1;
        }
      }
    }
    /* Positive control: the grid is not vacuous — side/front of each surface
       (with each determiner) measures, and the one-direction check ran on it. */
    expect(measuredCount).toBeGreaterThanOrEqual(INK_PLACEMENTS.length * 2 * 4);
  });
});
