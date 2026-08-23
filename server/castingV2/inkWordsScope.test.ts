/**
 * `CASTING_INK_WORDS_SCOPE` — the words road's second step, ARMED DARK ahead of
 * its own court (built opus-957 §3(ii), approved fable-1298 §3).
 *
 * The flag exists before the court because the court cannot drive a walled road
 * without it, and proving the road in a locally-widened configuration that has
 * never existed is the harness-supplied-argument trap with money attached.
 *
 * What these arms hold it to:
 *
 *   1. the LADDER — off by default, absent means off, and it cannot be armed
 *      over a user `CASTING_V2_SCOPE` does not cover;
 *   2. the GATE, BOTH SIDES — off is today's product byte for byte, and on is
 *      the whole measured vocabulary. One argument's difference, because a flag
 *      whose two sides are never asserted together is a flag nobody has read;
 *   3. what it does NOT move — the face retirement is ungated, and the mark
 *      lane is not a capability question.
 */
import { describe, expect, it } from "vitest";

import {
  CastingInkWordsCoverageError,
  CastingInkWordsScopeConfigurationError,
  parseCastingInkWordsScope,
  validateCastingInkWordsEnvironment,
} from "./castingV2Scope";
import { classifyInkPlacement, inkNeedsDocumentMessage } from "./inkPlacement";

describe("the boot guard", () => {
  it("refuses while casting itself is off — a words tattoo is painted by a refine", () => {
    expect(() => validateCastingInkWordsEnvironment({
      scope: "users:1",
      castingScope: undefined,
    })).toThrow(CastingInkWordsCoverageError);
  });

  it("refuses `all` while the parent is limited to named users", () => {
    expect(() => validateCastingInkWordsEnvironment({
      scope: "all",
      castingScope: "users:1",
    })).toThrow(CastingInkWordsCoverageError);
  });

  it("refuses a user the parent does not cover, and NAMES them", () => {
    expect(() => validateCastingInkWordsEnvironment({
      scope: "users:1,7",
      castingScope: "users:1",
    })).toThrow(/names users outside CASTING_V2_SCOPE: 7/);
  });

  it("admits a covered user, and `all` under an `all` parent", () => {
    expect(validateCastingInkWordsEnvironment({
      scope: "users:1",
      castingScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingInkWordsEnvironment({
      scope: "all",
      castingScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, whatever the parent is", () => {
    /* Nothing to cover, so nothing to refuse — and this is the state everywhere
       today, which is what makes the landing dark. */
    expect(validateCastingInkWordsEnvironment({ scope: undefined, castingScope: undefined }))
      .toEqual({ kind: "off" });
    expect(validateCastingInkWordsEnvironment({ scope: "off", castingScope: undefined }))
      .toEqual({ kind: "off" });
  });

  it("refuses a scope that is not the grammar", () => {
    for (const raw of ["yes", "users:", "users:0", "users:1,1", "users:-2", "everyone"]) {
      expect(() => parseCastingInkWordsScope(raw), raw)
        .toThrow(CastingInkWordsScopeConfigurationError);
    }
  });

  it("absent means off", () => {
    expect(parseCastingInkWordsScope(undefined)).toEqual({ kind: "off" });
  });
});

describe("the gate, both sides of the flag", () => {
  /*
    THE PAIR IS THE CLAIM. Each ask is asserted twice — the same sentence, the
    same lane, the flag the only variable — because a flag asserted on one side
    only is a flag whose other side nobody has read.
  */
  const closed = (said: string) => classifyInkPlacement(said, "ink", false);
  const open = (said: string) => classifyInkPlacement(said, "ink", true);

  it("⚠ OFF is her neck alone — and it is nobody's product any more", () => {
    /*
      ⚠ THE HEADING USED TO SAY "TODAY'S PRODUCT" AND IT STOPPED BEING TRUE
      BEFORE THIS ARM MOVED. `CASTING_INK_WORDS_SCOPE` went to `all` (fable-1400,
      the first Casting V2 capability to leave `users:1`), so no live account has
      been on this side of the flag for some time. It is asserted anyway — a flag
      asserted on one side only is a flag whose other side nobody has read — but
      it describes a state, not a customer.
    */
    expect(closed("a small rose tattoo on her neck").kind).toBe("in_frame");
    expect(closed("a band tattoo on her left upper arm").kind).toBe("needs_document");
    /*
      ⚠ AND THE CHEST MOVED HERE ON 2026-08-23, from `not_carried` to
      `needs_document`, when it joined the road at its most open.

      The old comment said the chest is a place we can SEE and cannot KEEP *on
      either side of the flag* — and the second half was the part the widening
      falsified. `uncarriedInkPlaces` is the whole vocabulary minus what the road
      serves AT ITS MOST OPEN, so the moment the chest was served that set went
      empty and a closed account's chest ask stopped meeting the coverage owner.

      **It is not the frozen apology this refusal's own file warns about.**
      `inkNeedsDocumentMessage` is composed from THIS account's served list, so a
      closed account is told *"a neck tattoo is the one I can do"* — true,
      actionable, naming what works. And the alternative was worse: making the
      uncarried set per-account would tell a closed account *"it would render and
      then be lost"* about a placement the road demonstrably keeps, which is a
      capability claim standing in for an admission gate.
    */
    expect(closed("a swallow tattoo on her upper chest").kind).toBe("needs_document");
  });

  it("⚠ ON opens all three — and the chest is opened by HER OUTFIT, not by the flag", () => {
    /*
      ⚠ THIS ARM HAS SAID THREE THINGS AND THE MIDDLE ONE WAS RIGHT FOR A YEAR'S
      WORTH OF REASONING ON A WRONG PREMISE.

        the whole vocabulary   for one commit, on the reading that the founder's
                               condition names every placement the mint can crop
        the arm and NOT the    the court narrowed it (opus-960, ratified
        chest                  fable-1301 §1): `upperChest` rendered a defensible
                               frame and minted NOTHING, because the reader is
                               asked about a chest under a t-shirt and D-226 says
                               you cannot segment what is hidden
        all three              2026-08-23. **That court measured a GARMENT and
                               was read as measuring a PLACEMENT.** Remove the
                               tee and the same word reads 12 of 12; then the
                               last cell was bought at the service, and a words
                               chest ask on a Basics cast rendered AND the
                               delivery mint wrote a crop

      **The flag does not open the chest — her outfit does.** With the flag ON
      and no line recorded (every cast in both worlds), a chest ask still meets
      `not_carried`: the house crew tee covers it, and the coverage owner is what
      says so. That is why this widening is dark in production and why the arm
      below asserts it.
    */
    expect(open("a small rose tattoo on her neck").kind).toBe("in_frame");
    expect(open("a band tattoo on her left upper arm").kind).toBe("in_frame");
    /* THE UNPATHED CAST — every roll in both worlds. Refused, and by the
       wardrobe, which is byte-identical to what this arm asserted before the
       widening. */
    expect(open("a swallow tattoo on her upper chest").kind).toBe("not_carried");
    /*
      AND NOT A PLACEMENT THE VOCABULARY HAS NEVER MEASURED. The founder's
      condition is that the mint can find and crop the result, and a surface with
      no `readerWord` fails it — so the flag may widen to the vocabulary and
      never past it.
    */
    expect(open("a full sleeve tattoo on her left arm").kind).toBe("needs_document");
    expect(open("a large back piece").kind).toBe("needs_document");
    expect(open("a rose tattoo on her thigh").kind).toBe("needs_document");
  });

  it("⚠ tells the two refusals apart — a place unmeasured vs one we cannot keep", () => {
    /*
      The pair that keeps `not_carried` honest. A thigh is a place nobody has
      measured and the product genuinely cannot name; an upper chest is a place
      it can see, on a customer who said exactly where. Collapsing them would
      tell somebody who named a real surface that they need a design document,
      which is neither true nor actionable — and it is what she got before the
      court.
    */
    expect(open("a rose tattoo on her thigh").kind).toBe("needs_document");
    const chest = open("a swallow tattoo on her upper chest");
    expect(chest.kind).toBe("not_carried");
    expect(chest.kind === "not_carried" ? chest.place : null, "the sentence needs the surface")
      .toContain("upper chest");
  });

  it("⚠ AND THE FLAG NEVER REACHES A HIDDEN PLACE, on either side", () => {
    /* Visibility beats the vocabulary: the nape is a neck word and the anchor
       cannot see it, so `neck` being served must not carry it in. */
    for (const said of ["a word tattooed on the nape of her neck", "a star behind her ear"]) {
      expect(closed(said).kind, said).toBe("needs_document");
      expect(open(said).kind, said).toBe("needs_document");
    }
  });

  it("⚠ AND IT DOES NOT MOVE THE MARK LANE — not a capability question", () => {
    /* The face retirement is ungated and the mark lane keeps its whole list;
       neither side of this flag touches either fact. */
    const said = "a lightning bolt scar on her forehead";
    expect(classifyInkPlacement(said, "mark", false).kind).toBe("in_frame");
    expect(classifyInkPlacement(said, "mark", true).kind).toBe("in_frame");
    /* And the face stays retired on the ink lane, flag or no flag — this is the
       arm that would go red if somebody "helpfully" widened the wrong list. */
    const ink = "a lightning bolt tattoo on her forehead";
    expect(classifyInkPlacement(ink, "ink", false).kind).toBe("needs_document");
    expect(classifyInkPlacement(ink, "ink", true).kind).toBe("needs_document");
  });

  it("keeps the refusal sentence the one the CLOSED road earns", () => {
    expect(inkNeedsDocumentMessage(false)).toContain("a neck tattoo");
    expect(inkNeedsDocumentMessage(false).toLowerCase()).not.toContain("face");
    /* And it does not offer the arm to somebody who cannot have it. */
    expect(inkNeedsDocumentMessage(false).toLowerCase()).not.toContain("upper arm");
  });

  /*
    ⚠ AND THE OPEN ROAD IS TOLD WHAT IT CAN ACTUALLY HAVE — census finding 4(c)
    (filed fable-1317, fixed 2026-08-22).
    
    The sentence above used to be the ONLY one: a hard-coded *"a neck tattoo is
    the one I can do"*, said to every account including the ones whose upper arm
    the words road serves. Nothing rendered differently and nothing was charged
    — she was simply talked out of an ask that would have worked, which is a
    refusal describing the product as smaller than it is.
    
    The arm below is the pair, and the pair is the point: one list decides the
    ROAD and the same list writes the SENTENCE, so a fourth surface cannot land
    in one and be left out of the other.
  */
  it("⚠ TELLS AN OPEN ACCOUNT ABOUT ITS ARM", () => {
    const said = inkNeedsDocumentMessage(true);
    expect(said).toContain("neck");
    expect(said).toContain("upper arm");
    /* "an upper arm", never "a upper arm" — the article agrees with the word
       after it, which is the kind of thing that makes a careful product look
       careless when it is wrong. */
    expect(said).toContain("an upper arm");
    expect(said).not.toContain("a upper arm");
  });

  it("CONTROL — the two sentences DIFFER, so neither can pass by never changing", () => {
    /*
      The arm that would go red if the derivation were quietly replaced by a
      constant again: a pair of assertions about one string is satisfied by a
      string that ignores its argument.
    */
    expect(inkNeedsDocumentMessage(true)).not.toBe(inkNeedsDocumentMessage(false));
    /* And both still say the two things every refusal on this road owes: what
       to do instead, and that nothing was charged. */
    for (const open of [true, false]) {
      expect(inkNeedsDocumentMessage(open), String(open)).toContain("body-art studio is coming");
      expect(inkNeedsDocumentMessage(open), String(open)).toContain("Nothing was charged");
    }
  });
});
