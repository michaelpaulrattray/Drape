/**
 * The two questions, proved WITHOUT the model (D-178, D-179, D-180).
 *
 * The founder's standard, set after the D-177 backstop turned out to be
 * structurally inert while every test around it passed: *if the only test goes
 * through the interpreter, the backstop is untested*. So every assertion here
 * calls the pure function directly. Nothing in this file can be rescued by a
 * well-behaved model.
 */
import { describe, expect, it } from "vitest";

import { readDelta } from "./refineDelta";
import {
  colourFacetLabel,
  colourFacetOf,
  didYouMeanReask,
  nearMiss,
  needsColourReferent,
  pendingReaskFor,
  redirectColourTo,
  resolveAnswer,
  whichFacetReask,
} from "./refineReask";

describe("needsColourReferent — the ask with nothing attached (D-178)", () => {
  it("is true for a bare comparative or a bare colour", () => {
    expect(needsColourReferent("pinker")).toBe(true);
    expect(needsColourReferent("a bit more pink")).toBe(true);
    expect(needsColourReferent("lighter")).toBe(true);
    expect(needsColourReferent("make it warmer")).toBe(true);
  });

  it("is false the moment the sentence names a feature", () => {
    /* They said which part. There is nothing to ask. */
    expect(needsColourReferent("make her hair pinker")).toBe(false);
    expect(needsColourReferent("lighter eyes")).toBe(false);
    expect(needsColourReferent("pink lips")).toBe(false);
    expect(needsColourReferent("warmer skin")).toBe(false);
  });

  it("is false for asks that are not about colour at all", () => {
    expect(needsColourReferent("give her a scar")).toBe(false);
    expect(needsColourReferent("remove the earrings")).toBe(false);
    expect(needsColourReferent("shorter")).toBe(false);
  });

  it("leaves a colour ask that names ANYTHING else to the parser and its walls", () => {
    /* The stage ask must meet its wall, not a question about her hair. */
    expect(needsColourReferent("make the lighting warmer")).toBe(false);
    expect(needsColourReferent("a darker background")).toBe(false);
    expect(needsColourReferent("pinker dress")).toBe(false);
  });
});

describe("colourFacetOf — the history that answers silently (D-178)", () => {
  it("finds the facet a guaranteed colour edit wrote", () => {
    const hair = colourFacetOf(readDelta({ hairColour: "copper" }));
    expect(hair).not.toBeNull();
    expect(colourFacetLabel(hair!)).toBe("the hair");

    const makeup = colourFacetOf(readDelta({ makeup: "a smoky eye" }));
    expect(makeup).not.toBeNull();
    expect(colourFacetLabel(makeup!)).toBe("makeup");
  });

  it("finds it in the free lane too", () => {
    const facet = colourFacetOf(readDelta({ free: { hairShade: "dyed pastel pink" } }));
    expect(facet).not.toBeNull();
    expect(colourFacetLabel(facet!)).toBe("the hair");
  });

  it("is null when nothing coloured has been touched", () => {
    expect(colourFacetOf(readDelta({ free: { marks: ["a small scar"] } }))).toBeNull();
    expect(colourFacetOf(null)).toBeNull();
    expect(colourFacetOf(undefined)).toBeNull();
  });
});

describe("nearMiss — one slip, never two (D-179)", () => {
  it("catches a single-slip typo of a word the product knows", () => {
    expect(nearMiss("piink hair")).toEqual({ typed: "piink", meant: "pink" });
    expect(nearMiss("make her hair coppr")).toEqual({ typed: "coppr", meant: "copper" });
  });

  it("catches a transposition, which is one slip and not two", () => {
    /* Two fingers out of order — the commonest typo there is, and plain
       Levenshtein scores it as a different word. */
    expect(nearMiss("pink hiar")).toEqual({ typed: "hiar", meant: "hair" });
  });

  it("questions a slip in the word that names the DRAWER, not only the value", () => {
    /* "Pink hiar" buys exactly as wrong a render as "piink hair". */
    expect(nearMiss("pink hiar")?.meant).toBe("hair");
  });

  it("leaves correctly spelled asks alone", () => {
    expect(nearMiss("pink hair")).toBeNull();
    expect(nearMiss("copper hair")).toBeNull();
  });

  it("does not guess at words that are simply not colours", () => {
    /* Two slips is a different word, and offering one would be the guessing
       this exists to avoid. */
    expect(nearMiss("give her a scarf")).toBeNull();
    expect(nearMiss("remove the earrings")).toBeNull();
  });
});

describe("redirectColourTo — the referent is enforced, not instructed (D-178)", () => {
  const hair = colourFacetOf(readDelta({ hairColour: "copper" }))!;
  const eyes = colourFacetOf(readDelta({ eyeColour: "green" }))!;

  it("moves a bare colour the model filed as makeup into the remembered drawer", () => {
    /* The exact miss the corpus caught: "pinker" after a hair edit came back
       as {makeup: "pinker"} on one run and hair on the next. */
    const moved = redirectColourTo(readDelta({ makeup: "pinker" })!, hair);
    expect(moved.makeup).toBeUndefined();
    expect(moved.free?.hairShade).toBe("pinker");
  });

  it("promotes into the closed vocabulary when it can hold the value", () => {
    const moved = redirectColourTo(readDelta({ makeup: "auburn" })!, hair);
    expect(moved.hairColour).toBe("auburn");
    expect(moved.free?.hairShade).toBeUndefined();
  });

  it("moves it to the eyes when the eyes are what was last coloured", () => {
    const moved = redirectColourTo(readDelta({ free: { hairShade: "green" } })!, eyes);
    expect(moved.eyeColour).toBe("green");
    expect(moved.free?.hairShade).toBeUndefined();
  });

  it("leaves a delta that already writes the remembered facet alone", () => {
    const delta = readDelta({ hairColour: "copper" })!;
    expect(redirectColourTo(delta, hair)).toBe(delta);
  });

  it("moves nothing when there is no colour in the delta at all", () => {
    const delta = readDelta({ free: { marks: ["a small scar"] } })!;
    expect(redirectColourTo(delta, hair)).toBe(delta);
  });
});

describe("resolveAnswer — the sentence never dead-ends (D-180)", () => {
  const which = whichFacetReask("pinker");

  it("takes the chip's words typed by hand", () => {
    expect(resolveAnswer(which, "the hair")).toBe("pinker — the hair");
    expect(resolveAnswer(which, "hair")).toBe("pinker — the hair");
    expect(resolveAnswer(which, "makeup")).toBe("pinker — makeup");
  });

  it("takes the feature named inside an ordinary reply", () => {
    expect(resolveAnswer(which, "the eyes please")).toBe("pinker — the eyes");
    expect(resolveAnswer(which, "do the hair")).toBe("pinker — the hair");
  });

  it("returns null for anything that is not an answer, so it runs as a new instruction", () => {
    /* THE POINT OF THE WHOLE FUNCTION. A question that rejects everything but
       its own two answers is a dead end wearing a sentence. */
    expect(resolveAnswer(which, "actually give her a fringe")).toBeNull();
    expect(resolveAnswer(which, "hair and eyes")).toBeNull();
    expect(resolveAnswer(which, "yes")).toBeNull();
  });

  it("takes yes and no on the typo question, and keeps their word on no", () => {
    const miss = nearMiss("piink hair")!;
    const typo = didYouMeanReask("piink hair", miss);
    expect(typo.question).toBe("Did you mean pink?");
    /* The answers live in the chips now, so the sentence stops naming them —
       but typing them must still work, which is the rest of this block. */
    expect(typo.question).not.toContain("Say yes");
    expect(resolveAnswer(typo, "yes")).toBe("pink hair");
    expect(resolveAnswer(typo, "yeah")).toBe("pink hair");
    expect(resolveAnswer(typo, "pink")).toBe("pink hair");
    /* Their word survives a "no" — the record keeps what they wrote (D-172). */
    expect(resolveAnswer(typo, "no")).toContain("piink hair");
  });
});

describe("pendingReaskFor — the question is re-derived, never trusted", () => {
  it("rebuilds the typo question from the sentence alone", () => {
    expect(pendingReaskFor("piink hair", false)?.kind).toBe("did-you-mean");
  });

  it("rebuilds the cold-start question only when there is no colour history", () => {
    expect(pendingReaskFor("pinker", false)?.kind).toBe("which-facet");
    /* With a colour edit behind it, history answers silently and there was
       never a question to reopen. */
    expect(pendingReaskFor("pinker", true)).toBeNull();
  });

  it("is null for an ordinary instruction", () => {
    expect(pendingReaskFor("give her a fringe", false)).toBeNull();
  });
});
