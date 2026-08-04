import { describe, expect, it } from "vitest";

import {
  composeDeltas,
  composeEditPrompt,
  currentValueOfFacet,
  facetsWrittenBy,
  readDelta,
  type RefineDelta,
} from "./refineDelta";
import { allFacets, facetOfAxis, facetOfSubject, facetHeading } from "./refineFacets";
import { captionClause, dropFacets, staleCaptions } from "./realizationCaption";

const prose = {
  eyeColour: (v: string) => `<eye ${v}>`,
  eyeShape: (v: string) => `<shape ${v}>`,
  hairStyle: (v: string) => `<cut ${v}>`,
  hairColour: (v: string) => `<colour ${v}>`,
  hairTexture: (v: string) => `<texture ${v}>`,
} as never as Parameters<typeof composeEditPrompt>[1];

/**
 * THE FACET IS THE UNIT (D-159).
 *
 * The founder's round-3 evidence, made mechanical: "copper hair" promotes into
 * the guaranteed lane, "pastel pink hair" cannot and stays free, and per-KEY
 * composition left both in one prompt to fight — where the heavier engineered
 * prose won and the render stayed copper while the record said pink.
 */
describe("one facet, one answer — across both lanes", () => {
  it("lets a free colour supersede a guaranteed one", () => {
    const composed = composeDeltas([
      { hairColour: "copper" },
      { free: { hairShade: "pastel pink" } },
    ]);
    expect(composed.hairColour).toBeUndefined();
    expect(composed.free?.hairShade).toBe("pastel pink");
  });

  it("lets a guaranteed colour supersede a free one", () => {
    const composed = composeDeltas([
      { free: { hairShade: "pastel pink" } },
      { hairColour: "copper" },
    ]);
    expect(composed.free?.hairShade).toBeUndefined();
    expect(composed.hairColour).toBe("copper");
  });

  /* The founder's render, as an assertion: exactly one colour may reach the
     model, because two is a question with two answers. */
  it("puts only ONE colour in the prompt", () => {
    const prompt = composeEditPrompt(
      composeDeltas([{ hairColour: "copper" }, { free: { hairShade: "pastel pink" } }]),
      prose,
    );
    expect(prompt).toContain("pastel pink");
    expect(prompt).not.toContain("copper");
  });

  it("supersedes every shared pair, not just hair colour", () => {
    for (const [axis, subject, value] of [
      ["eyeColour", "eyeColourFree", "seafoam"],
      ["eyeShape", "eyeShapeFree", "fox eyes"],
      ["hairStyle", "hairCut", "a mullet"],
      ["hairTexture", "hairPattern", "beachy waves"],
    ] as const) {
      const composed = composeDeltas([
        { [axis]: "anything" } as RefineDelta,
        { free: { [subject]: value } } as RefineDelta,
      ]);
      expect(composed[axis], axis).toBeUndefined();
      expect(composed.free?.[subject], subject).toBe(value);
    }
  });

  /* And the other half of D-142: things that CAN both be true still coexist. */
  it("leaves unrelated facets alone", () => {
    const composed = composeDeltas([
      { free: { brows: "thick and straight" } },
      { free: { nose: "a small bump on the bridge" } },
      { hairColour: "copper" },
    ]);
    expect(composed.free?.brows).toBe("thick and straight");
    expect(composed.free?.nose).toBe("a small bump on the bridge");
    expect(composed.hairColour).toBe("copper");
  });

  /*
    LEGACY ROWS. Deltas persisted before this law can hold both lanes of one
    facet with no ordering left to recover. Guaranteed wins, because that is
    what the pixels did — the engineered prose beat the bare clause in every
    such render, so the convention agrees with the picture the user kept.
  */
  /*
    A FRESH PARSE resolves the other way, and this is the bug that kept pink
    copper (D-166). The interpreter echoes the CURRENT value into the guaranteed
    slot beside the new one in the free slot; promotion has already moved
    anything the vocabulary can hold, so what remains in the free lane is the
    new ask and the guaranteed value beside it is an echo.
  */
  it("lets the free lane win when ONE reply answers a facet twice", () => {
    const parsed = readDelta({ hairColour: "copper", free: { hairShade: "pastel pink" } });
    expect(parsed?.hairColour).toBeUndefined();
    expect(parsed?.free?.hairShade).toBe("pastel pink");
  });

  /*
    THE WRONG LANE IS NOT AN INVENTION (D-166).

    "Pastel pink hair" came back as `{hairColour: "pastel pink"}` — the right
    ask in a slot whose closed vocabulary cannot hold it — and the whole reply
    was discarded, so a perfectly clear instruction was reported as unclear. It
    never worked as a first instruction, which is most of why it behaved
    differently on different faces.
  */
  it("demotes an out-of-vocabulary guaranteed value into the free lane", () => {
    const parsed = readDelta({ hairColour: "pastel pink" }, { instruction: "pastel pink hair" });
    expect(parsed?.hairColour).toBeUndefined();
    expect(parsed?.free?.hairShade).toBe("pastel pink");
  });

  /* And the vocabulary stays CLOSED: without the user's sentence there is no
     way to tell an honest ask from a hallucination, so the answer stays no. */
  it("still rejects an invented value when it cannot check the words", () => {
    expect(readDelta({ eyeColour: "violet" })).toBeNull();
  });

  it("still refuses a demoted value the user never said", () => {
    const check = { instruction: "make her eyes nicer" } as Parameters<typeof readDelta>[1];
    expect(readDelta({ eyeColour: "violet" }, check)).toBeNull();
    expect(check?.wall?.reason).toBe("wall_unfileable");
  });

  it("still promotes a free value the vocabulary CAN hold", () => {
    const parsed = readDelta({ free: { hairShade: "copper" } });
    expect(parsed?.hairColour).toBe("copper");
    expect(parsed?.free?.hairShade).toBeUndefined();
  });

  it("resolves a legacy row that answers one facet twice", () => {
    const composed = composeDeltas([
      { hairColour: "copper", free: { hairShade: "pastel pink" } },
    ]);
    expect(composed.hairColour).toBe("copper");
    expect(composed.free?.hairShade).toBeUndefined();
  });

  it("heals a legacy row the next time anything writes that facet", () => {
    const composed = composeDeltas([
      { hairColour: "copper", free: { hairShade: "pastel pink" } },
      { free: { hairShade: "silver" } },
    ]);
    expect(composed.hairColour).toBeUndefined();
    expect(composed.free?.hairShade).toBe("silver");
  });
});

describe("the facet table is shared by everything that asks", () => {
  it("maps both lanes of a facet onto the same id", () => {
    expect(facetOfAxis("hairColour")).toBe(facetOfSubject("hairShade"));
    expect(facetOfAxis("eyeShape")).toBe(facetOfSubject("eyeShapeFree"));
    /* And a subject with no guaranteed twin is simply its own facet. */
    expect(facetOfSubject("brows")).toBe("brows");
  });

  it("names the facets an instruction writes, from either lane", () => {
    expect(Array.from(facetsWrittenBy({ eyeShape: "hooded" }))).toEqual(["eye.shape"]);
    /* The bug this replaces: `touchedSubjects` mapped BOTH eye axes onto the
       colour subject, so an eye-SHAPE edit captioned the eye COLOUR. */
    expect(Array.from(facetsWrittenBy({ eyeColour: "green" }))).toEqual(["eye.colour"]);
  });

  it("speaks each facet under the heading the D-87 sweep looks for", () => {
    expect(facetHeading("hair.colour")).toBe("HAIR COLOUR");
    expect(facetHeading("brows")).toBe("BROWS");
  });

  /*
    TOTALITY, and it caught a live hazard while this file was being written.

    Shared facets are dotted (`hair.colour`) and unshared ones are the free
    subject id (`hairWorn`), so a mistyped dotted id falls through to
    `toUpperCase()` and puts `HAIR.WORN:` into a paid prompt under a heading the
    D-87 sweep does not recognise. Every facet either lane can produce must have
    a real heading, which makes the fallback unreachable rather than merely
    unlikely.
  */
  it("has a real heading for every facet either lane can produce", () => {
    for (const facet of allFacets()) {
      const heading = facetHeading(facet);
      expect(heading, facet).not.toContain(".");
      expect(heading, facet).toBe(heading.toUpperCase());
      expect(heading.length, facet).toBeGreaterThan(1);
    }
  });
});

/**
 * CAPTIONS INHERIT THE FACET'S LIFECYCLE (D-159, the founder's own words).
 *
 * A caption is stated to the image model as ALREADY TRUE, so one that outlives
 * its facet is not stale information — it is a contradiction in which the
 * fact-shaped half wins.
 */
describe("a caption dies with the facet it describes", () => {
  const captions = {
    "hair.colour": "a warm copper, deeper at the roots",
    "hairWorn": "falling loose past the collarbone, centre-parted",
  };

  it("drops the caption for a facet being rewritten", () => {
    const carried = dropFacets(captions, facetsWrittenBy({ free: { hairShade: "pastel pink" } }));
    expect(carried["hair.colour"]).toBeUndefined();
    /* And carries the untouched one across the branch, which is the whole
       point — worn-down must survive a colour instruction. */
    expect(carried["hairWorn"]).toBe(captions["hairWorn"]);
  });

  it("drops across the lane boundary too", () => {
    const carried = dropFacets(captions, facetsWrittenBy({ hairColour: "copper" }));
    expect(carried["hair.colour"]).toBeUndefined();
  });

  /* Compose-completeness, pointed the other way: a superseded caption reaching
     the prompt is the same crime as a dropped instruction. */
  it("reports a caption that survived a facet it had no right to survive", () => {
    expect(staleCaptions(captions, facetsWrittenBy({ hairColour: "copper" })))
      .toEqual(["hair.colour"]);
    expect(staleCaptions(
      dropFacets(captions, facetsWrittenBy({ hairColour: "copper" })),
      facetsWrittenBy({ hairColour: "copper" }),
    )).toEqual([]);
  });

  it("states carried captions as already true, under their headings", () => {
    const clause = captionClause({ "hairWorn": "falling loose past the collarbone" });
    expect(clause).toContain("HAIR WORN: falling loose past the collarbone");
    expect(clause).toContain("ALREADY TRUE");
    expect(captionClause({})).toBe("");
  });
});

/**
 * THE READ FOLLOWS THE FACET (D-159).
 *
 * What a relative ask — "make it lighter" — resolves against. Supersession made
 * this a live hazard: once a free shade clears the guaranteed colour, the
 * guaranteed FIELD reverts to the original while the face on screen is pink.
 */
describe("the current value of a facet", () => {
  it("prefers the stated detail that currently owns the facet", () => {
    const identity = {
      hair: { colour: "black" },
      realized: { statedDetails: { hairShade: "pastel pink" } },
    } as never;
    expect(currentValueOfFacet(identity, "hair.colour")).toBe("pastel pink");
  });

  it("falls back to the guaranteed home when no stated detail owns it", () => {
    const identity = { hair: { colour: "copper" }, realized: {} } as never;
    expect(currentValueOfFacet(identity, "hair.colour")).toBe("copper");
  });

  it("is null rather than wrong when nothing has answered", () => {
    expect(currentValueOfFacet(null, "hair.colour")).toBeNull();
    expect(currentValueOfFacet({ realized: {} } as never, "eye.shape")).toBeNull();
  });
});
