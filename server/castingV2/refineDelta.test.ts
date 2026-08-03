import { describe, expect, it } from "vitest";

import {
  applyDelta,
  composeDeltas,
  composeEditPrompt,
  readDelta,
} from "./refineDelta";
import { EYE_SHAPE_RENDER, IRIS_RENDER } from "./realizedAxes";
import type { ResolvedIdentity } from "./castingIntent";

const prose = {
  eyeColour: (value: keyof typeof IRIS_RENDER) => IRIS_RENDER[value],
  eyeShape: (value: keyof typeof EYE_SHAPE_RENDER) => EYE_SHAPE_RENDER[value],
};

describe("the vocabulary is closed, and something checks", () => {
  it("accepts values this build can render", () => {
    expect(readDelta({ eyeColour: "green" })).toEqual({ eyeColour: "green" });
    expect(readDelta({ eyeShape: "hooded" })).toEqual({ eyeShape: "hooded" });
    expect(readDelta({ eyeColour: "green", eyeShape: "almond" })).toEqual({
      eyeColour: "green",
      eyeShape: "almond",
    });
  });

  /*
    The model inventing a value is the failure that would persist an axis
    nothing composes — the unowned-axis collapse, arriving through a paid
    surface. Rejecting the whole reply rather than dropping the bad field is
    deliberate: a partially honoured instruction is worse than a refusal,
    because the user is charged for an edit that did only some of what they
    asked.
  */
  it("rejects a value invented outside the vocabulary", () => {
    expect(readDelta({ eyeColour: "violet" })).toBeNull();
    expect(readDelta({ eyeShape: "cat-like" })).toBeNull();
    expect(readDelta({ eyeColour: "green", eyeShape: "cat-like" })).toBeNull();
  });

  it("treats an empty delta as no delta", () => {
    /* Charging for a generation that changes nothing is the worst outcome of a
       misread instruction, so an empty reply must not become a paid render. */
    expect(readDelta({})).toBeNull();
    expect(readDelta(null)).toBeNull();
    expect(readDelta("green eyes")).toBeNull();
  });
});

describe("composition is mechanical, per-axis last-writer-wins", () => {
  it("lets a later instruction overwrite an earlier one on the same axis", () => {
    expect(composeDeltas([{ eyeColour: "green" }, { eyeColour: "blue" }])).toEqual({
      eyeColour: "blue",
    });
  });

  it("keeps axes independent, so one edit does not erase another", () => {
    expect(composeDeltas([{ eyeColour: "green" }, { eyeShape: "hooded" }])).toEqual({
      eyeColour: "green",
      eyeShape: "hooded",
    });
  });

  /*
    Removal is ARITHMETIC — the whole reason instructions are parsed at entry.
    Dropping instruction 1 and recomposing must give exactly what you would get
    if it had never been typed, with no model involved and nothing to re-read.
  */
  it("makes removing an instruction a recomposition, not a re-interpretation", () => {
    const stack = [{ eyeColour: "green" as const }, { eyeShape: "hooded" as const }];
    expect(composeDeltas(stack.slice(1))).toEqual({ eyeShape: "hooded" });
    expect(composeDeltas([])).toEqual({});
  });
});

const ORIGINAL = {
  sex: "female",
  ageBand: "30s",
  agePhase: "mid",
  heritage: [{ heritage: "Nordic", pct: 100 }],
  build: null,
  energy: "warm",
  look: null,
  hair: { family: "long", colour: "blonde" },
  realized: {
    eyeColour: "brown",
    eyeShape: null,
    hairStyle: { name: "low bun", family: "long", worn: "worn up" },
    facialHair: null,
    hairTexture: "straight",
    hairModifiers: null,
    wornState: "worn up",
    browStyle: "feathered",
    skinCharacter: "plain",
    beardGrey: null,
  },
} as unknown as ResolvedIdentity;

describe("the variant's record", () => {
  it("is the ORIGINAL with the composed edit applied, in full", () => {
    const refined = applyDelta(ORIGINAL, { eyeColour: "green" });
    expect(refined.realized.eyeColour).toBe("green");
    /* Full record, not a patch: Sign snapshots this and Follow inherits it
       whole, so everything untouched has to still be present and correct. */
    expect(refined.realized.hairStyle).toEqual(ORIGINAL.realized.hairStyle);
    expect(refined.heritage).toEqual(ORIGINAL.heritage);
    expect(refined.realized.browStyle).toBe("feathered");
  });

  it("never mutates the original it was derived from", () => {
    applyDelta(ORIGINAL, { eyeColour: "green", eyeShape: "hooded" });
    expect(ORIGINAL.realized.eyeColour).toBe("brown");
    expect(ORIGINAL.realized.eyeShape).toBeNull();
  });
});

describe("the edit prompt", () => {
  it("carries engineered prose, never the bare enum word", () => {
    const prompt = composeEditPrompt({ eyeShape: "hooded" }, prose);
    /* A single adjective loses to the portrait prior — the broken nose and the
       styled-not-worn hijab, both re-proved on paid renders (A9, D-124). */
    expect(prompt).toContain(EYE_SHAPE_RENDER.hooded);
    expect(prompt).toContain("hooded");
  });

  it("names what must NOT change, which is most of the picture", () => {
    const prompt = composeEditPrompt({ eyeColour: "green" }, prose);
    expect(prompt).toContain("changing ONLY what is listed");
    for (const preserved of ["bone", "skin", "hair", "expression", "clothing", "lighting", "framing", "background"]) {
      expect(prompt, preserved).toContain(preserved);
    }
    expect(prompt).toContain("not a new photograph of a similar person");
  });

  it("is built from the same deltas as the record, so the two cannot disagree", () => {
    const delta = { eyeColour: "green" as const, eyeShape: "almond" as const };
    const prompt = composeEditPrompt(delta, prose);
    const record = applyDelta(ORIGINAL, delta);
    expect(prompt).toContain(IRIS_RENDER.green);
    expect(record.realized.eyeColour).toBe("green");
    expect(record.realized.eyeShape).toBe("almond");
  });
});
