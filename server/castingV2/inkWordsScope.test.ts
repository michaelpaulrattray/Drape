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
import { classifyInkPlacement, INK_NEEDS_DOCUMENT_MESSAGE } from "./inkPlacement";

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

  it("⚠ OFF is today's product — her neck alone", () => {
    expect(closed("a small rose tattoo on her neck").kind).toBe("in_frame");
    expect(closed("a band tattoo on her left upper arm").kind).toBe("needs_document");
    /* The chest is a place we can SEE and cannot KEEP, on either side of the
       flag — see the court arm below. That is a different refusal from "the
       road does not reach here yet", and it says so. */
    expect(closed("a swallow tattoo on her upper chest").kind).toBe("not_carried");
  });

  it("⚠ ON opens the ARM and NOT the chest — the court's own split", () => {
    /*
      ⚠ THIS ARM ASSERTED THE WHOLE VOCABULARY for one commit, and the court
      narrowed it (opus-960, ratified fable-1301 §1): `upperArm` rendered on the
      correct anatomical side and minted a clean crop; `upperChest` rendered a
      defensible frame and minted NOTHING, because the reader is asked about a
      chest under a t-shirt and D-226 says you cannot segment what is hidden.

      A tattoo delivered and not carried is the one-frame loss the founder's own
      condition forbids — *"as long as the engine can find and crop them"* — so
      the chest stays shut with the flag wide open, which is what this pair
      proves.
    */
    expect(open("a small rose tattoo on her neck").kind).toBe("in_frame");
    expect(open("a band tattoo on her left upper arm").kind).toBe("in_frame");
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

  it("keeps the refusal sentence the one the closed road earns", () => {
    /* The message is not per-account, so it describes the CLOSED road — which
       is right while the flag is dark everywhere. The day it is not, this arm
       is where somebody has to decide what an opened account is told. */
    expect(INK_NEEDS_DOCUMENT_MESSAGE).toContain("neck tattoo");
    expect(INK_NEEDS_DOCUMENT_MESSAGE.toLowerCase()).not.toContain("face");
  });
});
