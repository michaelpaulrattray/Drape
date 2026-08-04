import { describe, expect, it } from "vitest";

import { INK_NEEDS_DOCUMENT_MESSAGE } from "./inkPlacement";

import {
  applyDelta,
  composeDeltas,
  composeEditPrompt,
  identityDetailsOf,
  presentationOf,
  readDelta,
  type FreeLaneCheck,
} from "./refineDelta";
import {
  EYE_SHAPE_RENDER,
  HAIR_COLOUR_RENDER,
  HAIR_TEXTURE_RENDER,
  IRIS_RENDER,
} from "./realizedAxes";
import type { ResolvedIdentity } from "./castingIntent";

const prose = {
  eyeColour: (value: keyof typeof IRIS_RENDER) => IRIS_RENDER[value],
  eyeShape: (value: keyof typeof EYE_SHAPE_RENDER) => EYE_SHAPE_RENDER[value],
  hairStyle: (value: string) => `a ${value}`,
  hairColour: (value: keyof typeof HAIR_COLOUR_RENDER) => HAIR_COLOUR_RENDER[value],
  hairTexture: (value: keyof typeof HAIR_TEXTURE_RENDER) => HAIR_TEXTURE_RENDER[value],
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

/**
 * THE FREE LANE, and the four walls (D-131).
 *
 * The lane exists so every person-touching instruction gets an honest attempt.
 * These are the things that must remain impossible while it does.
 */
describe("the free lane files, or it refuses", () => {
  const check = (instruction: string): FreeLaneCheck => ({ instruction });

  it("files a free subject in the user's own words", () => {
    const delta = readDelta({ free: { brows: "thick and straight" } }, check("thick and straight brows"));
    expect(delta?.free).toEqual({ brows: "thick and straight" });
  });

  /*
    WALL (b), primary form. A subject the code does not own cannot be filed, and
    wall (d) says an ask that cannot be filed refuses. This is also what stops a
    model-authored key from becoming a composition key.
  */
  it("refuses a subject the code does not own", () => {
    expect(readDelta({ free: { coat: "red" } }, check("put her in a red coat"))).toBeNull();
    expect(readDelta({ free: { backdrop: "blue" } }, check("blue backdrop"))).toBeNull();
  });

  it("refuses scenery smuggled into a person subject", () => {
    const c = check("photograph her skin against a red backdrop");
    expect(readDelta({ free: { skinTone: "against a red backdrop" } }, c)).toBeNull();
    expect(c.wall?.reason).toBe("wall_stage");
  });

  /*
    SOURCE CONTAINMENT — wall (d)'s teeth. A model elaborating a scar into a
    knife-fight scar is inventing biography, and the record would then carry a
    fact the user never gave. Refusing is the only honest answer.
  */
  it("refuses a value the user did not actually say", () => {
    const c = check("give her a scar on her cheek");
    expect(readDelta({ free: { marks: "a long knife scar from a bar fight" } }, c)).toBeNull();
    expect(c.wall?.reason).toBe("wall_unfileable");
  });

  it("refuses a likeness ask", () => {
    const c = check("make her look like Scarlett Johansson");
    expect(readDelta({ free: { nose: "like Scarlett Johansson" } }, c)).toBeNull();
    expect(c.wall?.reason).toBe("wall_likeness");
  });

  /*
    THE SABOTEUR. An over-eager interpreter routing a guaranteed value into the
    free lane would silently cost it its engineered prose and its
    failed-candidate teeth — a regression nothing would report, because the edit
    still happens and still looks reasonable. Promotion is mechanical, so it
    holds regardless of what the interpreter was told.
  */
  it("promotes a guaranteed value out of the free lane rather than losing it", () => {
    const promoted = readDelta({ free: { hairShade: "auburn" } }, check("auburn"));
    expect(promoted?.hairColour).toBe("auburn");
    expect(promoted?.free?.hairShade).toBeUndefined();
  });

  /*
    THE MULLET DEFECT (D-142). A cut and a colour are two facets, so a colour
    edit must not be able to overwrite a cut. It could, when both lived in one
    coarse  slot, and the record kept every instruction while the picture
    kept none of the first.
  */
  it("never lets a hair colour annihilate a hair cut", () => {
    const cut = readDelta({ free: { hairCut: "a mullet" } }, check("change hair to a mullet"))!;
    const copper = readDelta({ hairColour: "copper" }, check("copper hair"))!;
    const black = readDelta({ hairColour: "black" }, check("actually black hair"))!;
    const composed = composeDeltas([cut, copper, black]);
    expect(composed.free?.hairCut).toBe("a mullet");
    expect(composed.hairColour).toBe("black");
  });

  it("caps a free value, so an instruction cannot become a second brief", () => {
    const long = "a ".repeat(200);
    expect(readDelta({ free: { brows: long } }, check(long))).toBeNull();
  });
});

describe("free-lane filing keeps expression out of identity (D-136)", () => {
  it("files ordinary subjects as identity and expression as presentation", () => {
    const delta = { free: { brows: "thick", expression: "a warm open smile" } };
    expect(identityDetailsOf(delta)).toEqual({ brows: "thick" });
    expect(presentationOf(delta)).toEqual({ expression: "a warm open smile" });
  });

  /*
    The whole reason expression is separated. `readResolvedIdentity` passes
    unknown fields through whole, so a smile filed into the identity would be
    inherited by every follow — a momentary choice made permanent for eight
    strangers.
  */
  it("never writes expression into the identity record", () => {
    const refined = applyDelta(ORIGINAL, { free: { expression: "a warm open smile" } });
    expect(JSON.stringify(refined)).not.toContain("smile");
  });

  it("writes the other subjects into the identity record, under their subject", () => {
    const refined = applyDelta(ORIGINAL, { free: { brows: "thick and straight" } });
    expect(refined.realized.statedDetails).toEqual({ brows: "thick and straight" });
  });
});

describe("the free lane composes under its registered headings", () => {
  it("emits each subject under the heading the sweep looks for", () => {
    const prompt = composeEditPrompt(
      { free: { brows: "thick and straight", ink: "a small rose on her neck" } },
      prose,
    );
    expect(prompt).toContain("BROWS: thick and straight.");
    expect(prompt).toContain("INK: a small rose on her neck.");
  });
});

/**
 * THE INK GATE (D-137).
 *
 * Only pixels render a design (D-132), and the single case where words suffice
 * is ink the anchor itself documents. Everything else waits for the body-art
 * studio rather than being rendered from a sentence — which would be a
 * different tattoo in every frame, which is a person who does not have one.
 */
describe("ink renders only where the anchor is the document", () => {
  const check = (instruction: string): FreeLaneCheck => ({ instruction });

  it("lets face and neck ink through — D-133(a)", () => {
    for (const ask of [
      "a small rose tattoo on her neck",
      "a tiny star tattoo under her eye",
      "a line tattoo along her jaw",
    ]) {
      const delta = readDelta({ free: { ink: ask } }, check(ask));
      expect(delta?.free?.ink, ask).toBe(ask);
    }
  });

  it("gates a sleeve, a chest piece and a back piece", () => {
    for (const ask of [
      "a full sleeve tattoo on her left arm",
      "a chest tattoo",
      "a large back piece",
      "a tattoo on her hand",
    ]) {
      const c = check(ask);
      expect(readDelta({ free: { ink: ask } }, c), ask).toBeNull();
      expect(c.wall?.reason, ask).toBe("gate_ink_document");
    }
  });

  /*
    Unplaced ink gates too, and deliberately: "a small rose tattoo" could land
    anywhere, and rendering it somewhere and hoping is the drift the law exists
    to prevent.
  */
  it("gates ink with no placement at all", () => {
    const c = check("give her a rose tattoo");
    expect(readDelta({ free: { ink: "a rose tattoo" } }, c)).toBeNull();
    expect(c.wall?.reason).toBe("gate_ink_document");
  });

  it("names what DOES work, so the refusal points somewhere", () => {
    /* It INVITES the missing fact rather than only closing a door (D-137 as
       amended): the user's next move is to say where. */
    expect(INK_NEEDS_DOCUMENT_MESSAGE).toContain("Tell me where");
    expect(INK_NEEDS_DOCUMENT_MESSAGE).toContain("face and neck");
    expect(INK_NEEDS_DOCUMENT_MESSAGE).toContain("body-art studio is coming");
    expect(INK_NEEDS_DOCUMENT_MESSAGE).toContain("Nothing was charged");
  });
});
