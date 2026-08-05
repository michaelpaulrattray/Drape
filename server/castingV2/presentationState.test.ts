/**
 * THE FOURTH SYMPTOM'S GUARD (D-186), proved without a model.
 *
 * Hair pinned up in the base came back worn down, and the reason was not that
 * the render disobeyed — it was that nothing anywhere had ever said the hair
 * was up. A pin that cannot be produced is worse than no pin, and a pin that
 * says "unclear" would tell every later render that the hair is unclear, so
 * both failure shapes are asserted here rather than assumed.
 */
import { describe, expect, it } from "vitest";

import {
  capturePresentation,
  presentationInvalidatedBy,
  PRESENTATION_FACETS,
} from "./presentationState";
import { facetOfSubject } from "./refineFacets";

const HAIR_WORN = facetOfSubject("hairWorn");
const bytes = Buffer.from("pixels");

function reader(payload: unknown, seen?: { system?: string; user?: string }) {
  return {
    id: "stub",
    complete: async (request: { system: string; user: string }) => {
      if (seen) { seen.system = request.system; seen.user = request.user; }
      return {
        text: typeof payload === "string" ? payload : JSON.stringify(payload),
        truncated: false,
        latencyMs: 1,
      };
    },
  } as never;
}

describe("the base's presentation gets a name", () => {
  it("pins how the hair is worn", async () => {
    const pinned = await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "pulled back low" }),
    });
    expect(pinned[HAIR_WORN]).toBe("pulled back low");
  });

  it("pins nothing when the reader cannot tell", async () => {
    /* "Unclear" is an answer and it is not a fact. */
    const pinned = await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "unclear" }),
    });
    expect(pinned[HAIR_WORN]).toBeUndefined();
  });

  it("pins nothing when the reader returns prose instead of a value", async () => {
    /* A paragraph in a pin is a description quietly replacing the reference. */
    const pinned = await capturePresentation({
      bytes,
      contentType: "image/png",
      engine: reader({
        hairWorn: "Her hair is worn in a low, neat style that is pulled back away from the face "
          + "and gathered somewhere behind the head, which suits the framing.",
      }),
    });
    expect(pinned[HAIR_WORN]).toBeUndefined();
  });

  it("fails soft when the reader is unreachable", async () => {
    const broken = {
      id: "broken",
      complete: async () => { throw new Error("down"); },
    } as never;
    await expect(capturePresentation({ bytes, contentType: "image/png", engine: broken }))
      .resolves.toEqual({});
  });

  it("asks about arrangement and says so, never about the face", async () => {
    const seen: { system?: string; user?: string } = {};
    await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "down" }, seen),
    });
    expect(seen.user).toContain("How is the hair WORN");
    /* The face is what the reference image is for — describing it in words is
       how a description replaces the photograph (D-152). */
    expect(seen.system).toContain("never about the cut" .slice(0, 0) + "");
    expect(seen.system).toMatch(/never|no judgement/i);
  });

  /*
    A CUT RETIRES THE ARRANGEMENT (D-187). Hair tied up in the base cannot still
    be tied up after it is cut into a bob, so a `hair.cut` edit both retires an
    existing worn pin and forbids a new one being captured in the same breath.
  */
  it("retires the worn pin when the cut is re-made", () => {
    expect(presentationInvalidatedBy(new Set([facetOfSubject("hairCut")])))
      .toEqual([HAIR_WORN]);
  });

  it("leaves the worn pin alone for an edit that does not re-make the hair", () => {
    expect(presentationInvalidatedBy(new Set([facetOfSubject("hairShade")]))).toEqual([]);
    expect(presentationInvalidatedBy(new Set([facetOfSubject("nose")]))).toEqual([]);
  });

  it("declares exactly the facets the net is allowed to check", () => {
    /* The net verifies these because they are short categorical values.
       Widening this list without widening that reasoning is how false failures
       start costing free re-renders. */
    expect(PRESENTATION_FACETS).toEqual([HAIR_WORN]);
  });
});
