import { describe, expect, it } from "vitest";

import {
  ANATOMICAL_UPSWEPT_EDIT,
  EYE_SHAPE_ENGINE,
  EYE_SHAPE_ROUTING_IS_PROVISIONAL,
  upsweptReAsk,
} from "./eyeShapeRouting";
import { UPSWEPT_ALREADY } from "./canthalTilt";
import { BANNED_ENGINES } from "../providers/falImages";

describe("the prose never says the trend word", () => {
  it("describes geometry, not a look", () => {
    /*
      "Fox eyes" in a training set is a MAKEUP TREND — liner and lift on an
      unchanged eye — which is the behaviour that was photographed and misread
      as non-compliance for months. The words are the suspected lever, so the
      words are pinned.
    */
    const said = ANATOMICAL_UPSWEPT_EDIT.toLowerCase();
    for (const trend of ["fox", "cat eye", "cat-eye", "siren", "almond"]) {
      expect(said, `"${trend}" invites the makeup reading`).not.toContain(trend);
    }
  });

  it("forbids the makeup reading out loud, rather than hoping", () => {
    const said = ANATOMICAL_UPSWEPT_EDIT.toLowerCase();
    expect(said).toContain("eyeliner");
    expect(said).toMatch(/do not add or change any makeup/);
  });

  it("names the corners RELATIVE to each other, which is what tilt is", () => {
    expect(ANATOMICAL_UPSWEPT_EDIT).toMatch(/outer corner.*higher than the inner corner/is);
  });

  it("names the lower lash line, so a corner lift is a shape and not a pull", () => {
    expect(ANATOMICAL_UPSWEPT_EDIT.toLowerCase()).toContain("lower lash line");
  });
});

describe("the routing row, and its honesty about being unfinished", () => {
  it("routes to this round's winner", () => {
    expect(EYE_SHAPE_ENGINE).toBe("nbp");
  });

  it("is RATIFIED — the matrix closed it, and only the matrix could", () => {
    /* It was provisional while one face had been tested. Six casts spanning
       baseline, gender and ethnicity, judged on realism for the subject, closed
       it: NBP is the same person with restructured eyes; GPT2 was near-invisible
       and once went backwards. The flag stays as a named constant so the next
       class to earn a row remembers this one went through a provisional state
       on purpose. */
    expect(EYE_SHAPE_ROUTING_IS_PROVISIONAL).toBe(false);
  });

  it("can never route to a banned engine", () => {
    /* FLUX, 0-for-4, banned permanently. A ban that only lives in prose is a
       note to someone already looking. */
    expect(BANNED_ENGINES.some((engine) => engine.includes(EYE_SHAPE_ENGINE))).toBe(false);
    expect(BANNED_ENGINES).toContain("fal-ai/flux-2-pro/edit");
  });
});

describe("the already-true gate applies to this class from birth", () => {
  it("asks rather than spends when her eyes already sweep", () => {
    /*
      THE WALK CANDIDATE HERSELF measures 7.2deg. "Fox eyes" on her is a request
      for something she has, and the correct product behaviour is a free
      question. That is not the walk failing — it is the walk meeting the right
      answer.
    */
    const reAsk = upsweptReAsk({ meanDeg: 7.2 });
    expect(reAsk).not.toBeNull();
    expect(reAsk!.because).toMatch(/already/i);
    expect(reAsk!.offer, "the only thing that would change the picture").toBe("More tilt");
    expect(reAsk!.decline, "declining must be as easy as accepting").toBeTruthy();
  });

  it("stays out of the way of the ask it exists for", () => {
    /* A flat face asking to be upswept is the real edit, and a gate that fires
       there would be the false refusal this program has shipped once. */
    expect(upsweptReAsk({ meanDeg: -0.8 })).toBeNull();
    expect(upsweptReAsk({ meanDeg: 0 })).toBeNull();
    expect(upsweptReAsk({ meanDeg: UPSWEPT_ALREADY - 0.1 })).toBeNull();
  });

  it("speaks like a person, not like a measurement", () => {
    /* The user is never shown degrees. The number decides; the sentence is what
       a stylist would actually say. */
    const reAsk = upsweptReAsk({ meanDeg: 9 })!;
    expect(reAsk.because).not.toMatch(/deg|°|canthal|tilt|[0-9]/);
  });
});
