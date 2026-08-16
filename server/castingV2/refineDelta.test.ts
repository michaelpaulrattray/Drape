import { describe, expect, it } from "vitest";

import { INK_NEEDS_DOCUMENT_MESSAGE } from "./inkPlacement";

import {
  applyDelta,
  composeDeltas,
  composeEditPrompt,
  composeRenderPrompt,
  contradictedFacets,
  identityDetailsOf,
  presentationOf,
  readDelta,
  saysNothingNew,
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

  /*
    THE OPEN LANE'S CARRY IS THIS SPREAD AND NOTHING ELSE
    (`OPEN_LANE_DESIGN_NOTE.md` §8 step 4).

    `openKindDeparture()` answers `dropTheCarry` — *named as a value rather than
    a boolean so the step-4 build cannot satisfy it by reaching for the closed
    lane's vacate machinery, which would write an absence phrase about a thing
    her master never had.* These three arms are that answer as arithmetic: it is
    carried because this line carries it, it survives later edits because
    `clearFacets` is keyed by facet and an open kind has none, and it LEAVES by a
    recomposition that does not include the step — the same road the horns
    removal court measured at 3/3 gone and 3/3 clean.
  */
  const catEars = { "cat-ears": { noun: "cat ears", words: "soft grey cat ears" } };

  it("carries an open kind through every later edit that never mentions it", () => {
    const composed = composeDeltas([{ open: catEars }, { eyeColour: "green" }, { hairColour: "copper" }]);
    expect(composed.open).toEqual(catEars);
  });

  it("supersedes per KIND, so two kinds coexist and two asks about one do not", () => {
    const composed = composeDeltas([
      { open: catEars },
      { open: { "cat-ears": { noun: "cat ears", words: "long black cat ears" } } },
      { open: { tail: { noun: "tail", words: "a long tufted tail" } } },
    ]);
    expect(composed.open).toEqual({
      "cat-ears": { noun: "cat ears", words: "long black cat ears" },
      tail: { noun: "tail", words: "a long tufted tail" },
    });
  });

  it("and a chain recomposed WITHOUT the step carries nothing — the departure", () => {
    const stack = [{ open: catEars }, { hairColour: "copper" as const }];
    expect(composeDeltas(stack.slice(1)).open).toBeUndefined();
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

  /*
    The preservation clause LEFT this function (D-166). It was static, so it
    said "the same hair" on a prompt that changed the hair — measured at 19 of
    the 25 most recent production variants — and the model sided with the tail.
    It is now composed per render by subtraction, and `refinePreservation.test`
    is where it is proved. What stays here is that the edits lane is edits only,
    which is what lets `missingFromPrompt` run against it without finding a
    filed value in the protection and rubber-stamping the prompt.
  */
  it("keeps the edits lane free of the preservation clause", () => {
    const prompt = composeEditPrompt({ eyeColour: "green" }, prose);
    expect(prompt).toContain("changing ONLY what is listed");
    expect(prompt).toContain(IRIS_RENDER.green);
    expect(prompt).not.toContain("must be identical to the reference");
  });

  it("names what must NOT change, minus what it changes", () => {
    const composed = composeRenderPrompt({ eyeColour: "green" }, prose, {});
    for (const preserved of ["bone", "skin", "hair", "clothing", "lighting", "framing", "background"]) {
      expect(composed.full, preserved).toContain(preserved);
    }
    expect(composed.full).toContain("not a new photograph of a similar person");
    /* The eye colour is the one thing it must NOT promise to keep. */
    expect(composed.full).not.toContain("the same eye colour");
    expect(composed.full).not.toContain("the same eyes");
    expect(contradictedFacets(composed, { eyeColour: "green" })).toEqual([]);
  });

  /*
    THE CAPTION WALL, PINNED AT THE WIRE (2026-08-09).

    Measured on run-15's own face: with its caption in the ask, `marks` was
    delivered 0 of 16 across five wordings and both placements; without it, 11
    of 16. The same two arms on `hair.colour` read 4/4 and 4/4. So the rule is
    scoped by amplitude, and both directions are asserted here — a test that
    only proved the caption absent would pass just as well if the caption
    machinery were deleted outright, and the caption is doing real work on every
    facet the painter can tell apart from the master.

    Asserted on the composed STRING rather than on `captionedFacets`, because
    the string is what the painter receives and the whole defect was a fact that
    reached the prompt in a shape nobody had read.
  */
  describe("a realization caption in the ask", () => {
    const CAPTION = "a light scattering of small freckles, faint and sparse";

    it("is DROPPED for a surface facet — it reads as a report and the render does nothing", () => {
      const composed = composeRenderPrompt(
        { free: { marks: "freckles" } }, prose, { marks: CAPTION },
      );
      expect(composed.full).toContain("MARKS: freckles");
      expect(composed.full).not.toContain(CAPTION);
      expect(composed.full).not.toContain("rendered exactly as this");
      /* And it is dropped, not relocated: the already-true lane is where it
         lived before D-152 and it contradicts the ask from there. */
      expect(composed.captionedFacets).not.toContain("marks");
      /* The qualifier and the delivery floor still govern the ask itself. */
      expect(composed.full).toContain("as real marks on this person's own skin");
      expect(composed.full).toContain("a change that does not appear at all is a failed render");
    });

    it("is KEPT for a replacement facet — the painter can tell the caption from the master", () => {
      const kept = "warm coppery red through the whole length";
      const composed = composeRenderPrompt({ hairColour: "copper" }, prose, { "hair.colour": kept });
      expect(composed.full).toContain(kept);
      expect(composed.full).toContain("rendered exactly as this");
    });

    it("still carries an UNASKED surface facet's caption — this rule is about the ask", () => {
      const composed = composeRenderPrompt({ eyeColour: "green" }, prose, { marks: CAPTION });
      expect(composed.full).toContain(CAPTION);
      expect(composed.captionedFacets).toContain("marks");
    });
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

/**
 * ADORNMENT IS THE PERSON, NOT THE STAGE (D-160).
 *
 * "Small gold hoops" was refused as wardrobe or set, contradicting a standing
 * founder ruling and the roll pipeline's own behaviour — `statedAccessories` has
 * been an intent axis with failure-to-appear teeth since the D-116 family.
 */
describe("accessories are refinable; garments and headwear are not", () => {
  const check = (instruction: string): FreeLaneCheck => ({ instruction });

  it("files worn adornment, including when it is described as worn", () => {
    for (const ask of [
      "small gold hoops",
      "wearing small gold hoops",
      "a thin silver chain",
      "a tiny nose stud",
    ]) {
      const c = check(ask);
      const delta = readDelta({ free: { statedAccessories: ask } }, c);
      expect(delta?.free?.statedAccessories, ask).toEqual([ask]);
      expect(c.wall, ask).toBeUndefined();
    }
  });

  /* The wall NARROWED — it did not fall. A garment smuggled into the
     accessories subject still hits it, and so does headwear. */
  it("still refuses a garment or headwear routed through accessories", () => {
    for (const ask of ["wearing a red coat", "a wide brimmed hat"]) {
      const c = check(ask);
      expect(readDelta({ free: { statedAccessories: ask } }, c), ask).toBeNull();
      expect(c.wall?.reason, ask).toBe("wall_stage");
    }
  });

  it("carries the failure-to-appear licence into the prompt", () => {
    /*
      D-160's licence is unchanged in substance and now comes from the FLOOR
      rather than from this one class's own wording — the accessory clause said
      "a failed candidate" while twenty-two other classes said nothing at all.
      Asserted on the promise rather than on the phrase, because the phrase is
      now shared and tuning it in one place must not fail a test about another.
    */
    const prompt = composeEditPrompt({ free: { statedAccessories: "small gold hoops" } }, prose);
    expect(prompt).toContain("ACCESSORIES: small gold hoops");
    expect(prompt).toMatch(/does not appear at all is a failed render/);
    /* And the part that is still the accessory class's own. */
    expect(prompt).toContain("Nothing else is added");
  });
});

describe("the free lane composes under its registered headings", () => {
  it("emits each subject under the heading the sweep looks for", () => {
    const prompt = composeEditPrompt(
      { free: { brows: "thick and straight", ink: "a small rose on her neck" } },
      prose,
    );
    /*
      THE HEADING AND THE USER'S OWN WORDS STILL LEAD, and the qualifier follows
      them. This test used to pin `BROWS: thick and straight.` — the BARE clause
      — which is exactly the defect: nineteen subjects shipped with the heading,
      the user's words and nothing else, while the model was told for accessories
      that a thing failing to appear is a failure. Pinning the bare form is how a
      test comes to defend a defect.
    */
    expect(prompt).toContain("BROWS: thick and straight,");
    expect(prompt).toMatch(/BROWS: thick and straight,[^.]*does not appear at all is a failed render/);
    /* Ink is the declared exemption: its items carry their own placement
       clauses, so its heading is still followed by the words alone. */
    expect(prompt).toContain("INK: a small rose on her neck.");
  });

  /*
    A PAIR MEANS BOTH EARS, IN THE PROMPT SHE PAYS FOR (fable-118 ruling (b)).

    The founder asked for "gold hoop earrings" and got one, with the other ear
    bare and fully visible — then the same single hoop on the other ear on the
    next render. His prompt never said a pair is two, so the painter chose an
    ear. Laterality is a fact about the OBJECT, so it comes from the accessory
    kinds table rather than from the subject's qualifier.
  */
  it("says a pair means both ears, and only for the things worn in twos", () => {
    const earrings = composeEditPrompt(
      { free: { statedAccessories: "gold hoop earrings" } },
      prose,
    );
    expect(earrings).toContain("ACCESSORIES: gold hoop earrings, one on each ear, a matching pair,");

    /* Glasses are one object across two eyes; a nose stud is one thing in one
       place. Neither gets a pair clause, and asserting that is what keeps this
       from becoming "every accessory is two things". */
    const glasses = composeEditPrompt(
      { free: { statedAccessories: "round wire-frame glasses" } },
      prose,
    );
    expect(glasses).not.toContain("each ear");
    const stud = composeEditPrompt(
      { free: { statedAccessories: "a small nose stud" } },
      prose,
    );
    expect(stud).not.toContain("each ear");
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
      expect(delta?.free?.ink, ask).toEqual([ask]);
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
    D-158: the visibility rule is about the RELATION, not about a phrasing.

    D-153 shipped it as a list of hidden phrases and the founder's very next
    tattoo went through it — they typed "behind ear" rather than "behind her
    ear", so nothing matched and `\bear\b` let it render. Every one of these
    must gate, and the point of the row is that no list of surface forms would
    have contained all of them.
  */
  it("gates ink that is BEHIND something, however it is phrased", () => {
    for (const ask of [
      "a tiny star behind her ear",
      "a tiny star behind ear",
      "a tiny star behind the left ear",
      "a tiny star behind one ear",
      "a small design behind both ears",
      "a word tattooed on the back of her neck",
      "a small moon on the nape",
      "a tiny cross under her hair",
    ]) {
      const c = check(ask);
      expect(readDelta({ free: { ink: ask } }, c), ask).toBeNull();
      expect(c.wall?.reason, ask).toBe("gate_ink_document");
    }
  });

  /*
    THE GATE FOLLOWS THE DESIGN, NOT THE DRAWER (D-158).

    Found by driving the real interpreter, which the unit tests structurally
    could not: "a small star behind her ear" carries no word "tattoo", so it came
    back filed as a MARK — and marks have no placement law, so it rendered. The
    gate was bypassed by filing.
  */
  it("gates a design filed as a mark", () => {
    const ask = "a small star behind her ear";
    const c = check(ask);
    expect(readDelta({ free: { marks: ask } }, c)).toBeNull();
    expect(c.wall?.reason).toBe("gate_ink_document");
  });

  /* Skin's own marks are not designs and keep their own rules. */
  it("leaves real marks alone", () => {
    for (const ask of ["freckles across her nose", "a small scar through her eyebrow"]) {
      const c = check(ask);
      expect(readDelta({ free: { marks: ask } }, c)?.free?.marks, ask).toEqual([ask]);
    }
  });

  /*
    A KNOWN SUBJECT AT THE TOP LEVEL IS A SHAPE SLIP, NOT A REFUSAL.

    The guaranteed axes are top-level and the free ones are nested, so the
    interpreter replied `{"ink": "…"}` — which left an empty delta with no wall
    and surfaced to the user as "that didn't come through clearly". Its own habit,
    reported as their mistake, which is what `stripFence` already exists to stop.
  */
  it("hoists a free subject the interpreter put at the top level", () => {
    const ask = "a small rose tattoo on her cheekbone";
    expect(readDelta({ ink: ask }, check(ask))?.free?.ink).toEqual([ask]);
  });

  it("still applies every guard to a hoisted value", () => {
    const ask = "a small star behind her ear";
    const c = check(ask);
    expect(readDelta({ ink: ask }, c)).toBeNull();
    expect(c.wall?.reason).toBe("gate_ink_document");
  });

  /* And the narrowness is load-bearing in the other direction: "under" hides
     things only when hair is what is over them. An eye is still front-visible. */
  it("keeps under-the-eye ink renderable", () => {
    const ask = "a tiny star tattoo under her eye";
    expect(readDelta({ free: { ink: ask } }, check(ask))?.free?.ink).toEqual([ask]);
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

/**
 * AN ASK THAT FILES NOTHING OF ITSELF IS REFUSED, NEVER ABSORBED.
 *
 * Containment guards one direction — an item in neither her sentence nor the
 * record is an invention. Nothing guarded the other: asked to restate every
 * item of a plural subject, the interpreter sometimes returns the restatement
 * and DROPS the ask. Measured at three of nineteen readings of "give her
 * freckles" against a record holding `marks: ["lightly freckled"]`.
 *
 * What that costs if it is not refused is the whole reason it is a guard rather
 * than a note: the delta files, the render is dispatched, it changes nothing
 * because there is nothing to change, the customer is charged — and the
 * verification net checks `facetsWrittenBy(composed)`, which has NO ROW for the
 * thing she actually asked about. A false pass built at the parse, invisible to
 * a zero-false-pass bar because the check it would have failed was never
 * written down.
 */
/**
 * THE ASK SUPERSEDES — a replacement files the CURRENT set, not the accumulation.
 *
 * The specimen is the five-ask walk's own step 2, paid for on 2026-08-12: a face
 * wearing hoops, an ask for **dangly cross earrings**, and a delta that came back
 * holding both because that is precisely what the interpreter is instructed to
 * do. The recipe then asked one pair of ears for hoops AND crosses; the painter
 * kept the hoops; the presence gate found earrings and passed it. 25 credits for
 * a picture nobody asked for, with the shortfall written into the verdict's own
 * `saw`.
 *
 * The negative controls are the load-bearing half, because a supersession rule
 * that fires too eagerly DELETES something a person asked for — the annihilation
 * D-171 was written to end. Three of them are below, and each names the ask it
 * protects.
 */
describe("a replacement within a set supersedes rather than accumulates", () => {
  const check = (instruction: string, prior?: Record<string, string[]>): FreeLaneCheck => ({
    instruction,
    prior: prior as FreeLaneCheck["prior"],
  });

  it("files the crosses ALONE when the hoops were only restated (the walk's step 2)", () => {
    const c = check("dangly cross earrings", { statedAccessories: ["gold hoop earrings"] });
    const delta = readDelta(
      { free: { statedAccessories: ["gold hoop earrings", "dangly cross earrings"] } },
      c,
    );
    expect(delta?.free?.statedAccessories).toEqual(["dangly cross earrings"]);
    expect(c.wall).toBeUndefined();
  });

  it("keeps a DIFFERENT kind of thing, which is what the restatement is for", () => {
    /* The ask is about her ears. Superseding the glasses here would take them
       off her face — D-238's own counterexample, one lane over. */
    const c = check("small gold hoops", { statedAccessories: ["thin wire glasses"] });
    const delta = readDelta(
      { free: { statedAccessories: ["thin wire glasses", "small gold hoops"] } },
      c,
    );
    expect(delta?.free?.statedAccessories).toEqual(["thin wire glasses", "small gold hoops"]);
  });

  it("keeps a mismatched pair the person asked for IN ONE BREATH", () => {
    /* Their own sentence warrants both, so neither is a restatement and neither
       supersedes the other. The founder's mismatched freedom, protected by the
       source of the warrant rather than by a special case. */
    const c = check("keep the gold hoops and add dangly cross earrings", {
      statedAccessories: ["gold hoops"],
    });
    const delta = readDelta(
      { free: { statedAccessories: ["gold hoops", "dangly cross earrings"] } },
      c,
    );
    expect(delta?.free?.statedAccessories).toEqual(["gold hoops", "dangly cross earrings"]);
  });

  it("leaves marks accumulating, because a scar does not name freckles", () => {
    /* The plural class is wider than accessories and only accessories have a
       kind table. Containment answers the rest, and its answer here is "these
       are different things" — so "add freckles" keeps the scar. */
    const c = check("add freckles", { marks: ["a scar on her cheek"] });
    const delta = readDelta({ free: { marks: ["a scar on her cheek", "freckles"] } }, c);
    expect(delta?.free?.marks).toEqual(["a scar on her cheek", "freckles"]);
  });

  it("supersedes nothing when the whole set is a restatement", () => {
    /* No fresh item, nothing to replace. This delta is the absorbed shape and
       `saysNothingNew` is the guard that owns it — this rule must not quietly
       turn it into something that looks like an edit. */
    const c = check("make them nicer", { statedAccessories: ["gold hoop earrings"] });
    const delta = readDelta({ free: { statedAccessories: ["gold hoop earrings"] } }, c);
    expect(delta?.free?.statedAccessories).toEqual(["gold hoop earrings"]);
  });

  it("supersedes nothing when there is no prior to have restated from", () => {
    /* Both items are theirs, first time. A set asked for in one sentence is the
       set they wanted. */
    const c = check("give her gold hoops and a tiny nose stud");
    const delta = readDelta(
      { free: { statedAccessories: ["gold hoops", "a tiny nose stud"] } },
      c,
    );
    expect(delta?.free?.statedAccessories).toEqual(["gold hoops", "a tiny nose stud"]);
  });

  it("re-describing the same thing replaces it — 'make the hoops silver'", () => {
    /* The shape D-171 named as the reason composition stays restate-absolutely.
       One pair of ears cannot wear the gold pair and the silver pair. */
    const c = check("make the hoops silver", { statedAccessories: ["small gold hoops"] });
    const delta = readDelta(
      { free: { statedAccessories: ["small gold hoops", "silver hoops"] } },
      c,
    );
    expect(delta?.free?.statedAccessories).toEqual(["silver hoops"]);
  });
});

describe("an ask absorbed into a restatement is refused before the charge", () => {
  const FRECKLED = {
    ...ORIGINAL,
    realized: { ...(ORIGINAL as { realized: object }).realized, skinCharacter: "lightly freckled" },
  } as unknown as ResolvedIdentity;

  it("catches the reading that lost her sentence", () => {
    /* The observed failure, verbatim: her record's own two words back, and
       nothing of the three she typed. */
    const verdict = saysNothingNew({
      delta: { free: { marks: ["lightly freckled"] } },
      prior: { marks: ["lightly freckled"] },
      identity: FRECKLED,
    });
    expect(verdict.absorbed).toBe(true);
    expect(verdict.absorbed && verdict.alreadyTrue).toBe("lightly freckled");
  });

  it("lets the SAME reading through the moment her ask survives beside it", () => {
    /* Sixteen of the nineteen came back like this, and they are correct: the
       prior restated AND her word kept. One new item is enough. */
    const verdict = saysNothingNew({
      delta: { free: { marks: ["lightly freckled", "freckles"] } },
      prior: { marks: ["lightly freckled"] },
      identity: FRECKLED,
    });
    expect(verdict.absorbed).toBe(false);
  });

  it("cannot refuse her for the model's eloquence — only for losing her", () => {
    /*
      THE DIRECTION, pinned. A richer phrasing than she typed still differs from
      what she already was, so it passes here. That asymmetry is the whole
      argument for checking our filing rather than her sentence: containment
      pointed the other way is how a guard starts refusing honest instructions
      (D-157, D-171), and this one structurally cannot.
    */
    const verdict = saysNothingNew({
      delta: { free: { marks: ["a scattering of freckles across her nose and cheeks"] } },
      prior: { marks: ["lightly freckled"] },
      identity: FRECKLED,
    });
    expect(verdict.absorbed).toBe(false);
  });

  it("sees a labelled axis echoed back as itself", () => {
    /* The free lane is where it was measured; the same shape exists one lane
       over, and a guard that only knows the lane it was born in is half a
       guard. She is brown-eyed; "brown" changes nothing. */
    expect(saysNothingNew({ delta: { eyeColour: "brown" }, prior: {}, identity: ORIGINAL }).absorbed)
      .toBe(true);
    expect(saysNothingNew({ delta: { eyeColour: "green" }, prior: {}, identity: ORIGINAL }).absorbed)
      .toBe(false);
  });

  it("never claims a DEPARTURE, which is new by definition", () => {
    /* She was wearing them a moment ago. A removal filed beside a restatement
       is still a change, and refusing it would undo the thing this campaign
       just shipped. */
    const verdict = saysNothingNew({
      delta: { free: { marks: ["lightly freckled"] }, absent: { statedAccessories: ["glasses"] } },
      prior: { marks: ["lightly freckled"] },
      identity: FRECKLED,
    });
    expect(verdict.absorbed).toBe(false);
  });

  it("leaves an EMPTY delta to the paths that own it", () => {
    /* Nothing filed is not this refusal's business — the free question and the
       rule-3 re-read both hand back empty deltas on their way to an answer,
       and claiming them here would take a sentence away from a path that has
       one. */
    expect(saysNothingNew({ delta: {}, prior: {}, identity: ORIGINAL }).absorbed).toBe(false);
    expect(saysNothingNew({ delta: { free: {} }, prior: {}, identity: ORIGINAL }).absorbed).toBe(false);
  });

  it("does not fire when the record is silent about the subject", () => {
    /* A first freckle on a plain-skinned face has no prior to echo, so there is
       nothing for this guard to be about. `skinCharacter: "plain"` is the
       registry's own silent value and reads as absence (D-167). */
    const verdict = saysNothingNew({
      delta: { free: { marks: ["freckles"] } },
      prior: {},
      identity: ORIGINAL,
    });
    expect(verdict.absorbed).toBe(false);
  });
});

/**
 * A DEPARTURE THAT HAS ALREADY LEFT IS NOT NEW (fable-480 §2).
 *
 * The exemption at the top of this guard — *"a departure is new by definition
 * — she was wearing it a moment ago"* — was true until the thing had already
 * gone, and that was the hole the founder's 25 credits went through: a reading
 * that echoed a standing departure skipped the whole function, and everything
 * downstream worked perfectly on it (opus-363).
 */
describe("a removal of something already gone says nothing new", () => {
  it("lets a FIRST removal through — she is wearing them", () => {
    /* The protection this must not break, and the reason `priorAbsent` is
       optional: no record of a departure means the departure is new. */
    const verdict = saysNothingNew({
      delta: { absent: { statedAccessories: ["glasses"] } },
      prior: {},
      priorAbsent: {},
      identity: ORIGINAL,
    });
    expect(verdict.absorbed).toBe(false);
  });

  it("refuses a SECOND removal of the same thing", () => {
    const verdict = saysNothingNew({
      delta: { absent: { statedAccessories: ["glasses"] } },
      prior: {},
      priorAbsent: { statedAccessories: ["glasses"] },
      identity: ORIGINAL,
    });
    expect(verdict.absorbed).toBe(true);
    expect(verdict.absorbed && verdict.alreadyTrue).toBe("glasses");
    /* Its own sentence: "she already has no glasses" is not English. */
    expect(verdict.absorbed && verdict.departed).toBe(true);
  });

  it("still lets a departure through when only its SIBLING has gone", () => {
    /* One genuinely new departure makes the whole delta new — the earrings are
       gone, the glasses are not, and she is asking about the glasses. */
    const verdict = saysNothingNew({
      delta: { absent: { statedAccessories: ["glasses"] } },
      prior: {},
      priorAbsent: { statedAccessories: ["earrings"] },
      identity: ORIGINAL,
    });
    expect(verdict.absorbed).toBe(false);
  });

  it("behaves exactly as before when nobody supplies the departures", () => {
    /* The compatibility arm: a caller with no `priorAbsent` gets the old rule —
       a departure is new — rather than a silent change of behaviour. */
    const verdict = saysNothingNew({
      delta: { absent: { statedAccessories: ["glasses"] } },
      prior: {},
      identity: ORIGINAL,
    });
    expect(verdict.absorbed).toBe(false);
  });

  it("describes the delta by its POSITIVE half when it echoes both", () => {
    const verdict = saysNothingNew({
      delta: {
        absent: { statedAccessories: ["glasses"] },
        free: { marks: ["lightly freckled"] },
      },
      prior: { marks: ["lightly freckled"] },
      priorAbsent: { statedAccessories: ["glasses"] },
      identity: ORIGINAL,
    });
    expect(verdict.absorbed).toBe(true);
    expect(verdict.absorbed && verdict.alreadyTrue).toBe("lightly freckled");
    expect(verdict.absorbed && verdict.departed).toBeUndefined();
  });
});

/**
 * A REFUSAL THAT CARRIES WHAT THE MODEL SAID.
 *
 * Run-11 met `wall_unfileable` on three plain words and the reply was
 * unrecoverable an hour later — not because logs expire (they reach back to
 * container start) but because the refusal path wrote nothing. The wall now
 * carries the value that failed to file, so the line the service writes has
 * something in it worth reading.
 */
describe("an unfileable item names itself", () => {
  it("carries the value the guard refused, not only the subject", () => {
    const check: FreeLaneCheck = { instruction: "give her freckles", prior: {} };
    readDelta({ free: { marks: ["a scar she never mentioned"] } }, check);
    expect(check.wall?.reason).toBe("wall_unfileable");
    expect(check.wall && "asked" in check.wall && check.wall.asked).toBe("marks");
    expect(check.wall && "value" in check.wall && check.wall.value)
      .toBe("a scar she never mentioned");
  });
});
