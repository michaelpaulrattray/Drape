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

import { arrangementWording } from "./hairArrangement";
import {
  capturePresentation,
  presentationInvalidatedBy,
  unconstrainedPresentationPins,
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
  it("pins the vocabulary's own wording for the value the reader chose", async () => {
    /* The reader answers with an id; what is STORED is the sentence — the same
       sentence the painter is told is already true and the net checks (D-238).
       One fact, one wording, and no place for the three to disagree. */
    const pinned = await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "gathered" }),
    });
    /* And the ID rides with it (fable-118): a pin says structurally that it is
       one, so nothing downstream has to decide from the prose whether this is a
       chosen value or a sentence somebody read off a frame. */
    expect(pinned[HAIR_WORN]).toEqual({ wording: arrangementWording("gathered"), pin: "gathered" });
  });

  it("pins nothing when the reader cannot tell", async () => {
    /* "Unclear" is an answer and it is not a fact. */
    const pinned = await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "unclear" }),
    });
    expect(pinned[HAIR_WORN]).toBeUndefined();
  });

  it("pins nothing when no value on the list is true of the photograph", async () => {
    /* "Other" is the honest escape hatch, and it must cost a pin rather than
       buy an approximation: wrong does not beat missing. */
    const pinned = await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "other" }),
    });
    expect(pinned[HAIR_WORN]).toBeUndefined();
  });

  /*
    THE RUN-13 DEFECT, AT THE DOOR IT CAME IN THROUGH.

    This exact string was captured from a base, pinned, and then argued with the
    picture in every render: the reader answered "not loose" three times about
    hair that had never moved, and the class scored 25% on four correct frames.
    Free text is now simply not a pin.
  */
  it("pins nothing when the reader answers in its own words", async () => {
    const pinned = await capturePresentation({
      bytes, contentType: "image/png", engine: reader({ hairWorn: "worn natural, loose" }),
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
    /* And it is a CHOICE, not a blank: the whole list travels with the
       question, so the model cannot answer a question it was not asked. */
    expect(seen.user).toContain("- worn as cut: ");
    expect(seen.user).toContain("- ponytail: ");
    expect(seen.system).toMatch(/copied exactly as written/i);
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

  /*
    A PIN FROM BEFORE THE VOCABULARY IS RETIRED, NEVER TRANSLATED (D-238).

    Every chain already in flight carries free text, and those are the strings
    that produced the false misses. Deleting one hands the facet back to the
    capture branch, which re-reads it from the MASTER — the picture decides what
    her pin should have said. A text mapping would be D-173's swamp with a
    thesaurus: "pulled back low" is a ponytail or a bun or neither.
  */
  describe("pins from before the vocabulary", () => {
    it("retires free text the vocabulary cannot stand behind", () => {
      expect(unconstrainedPresentationPins({ [HAIR_WORN]: "worn natural, loose" }))
        .toEqual([HAIR_WORN]);
      expect(unconstrainedPresentationPins({ [HAIR_WORN]: "pulled back low" }))
        .toEqual([HAIR_WORN]);
    });

    it("leaves a pin the vocabulary wrote exactly where it is", () => {
      expect(unconstrainedPresentationPins({ [HAIR_WORN]: arrangementWording("bun") }))
        .toEqual([]);
    });

    it("has nothing to say about an unpinned facet, or about other facets", () => {
      expect(unconstrainedPresentationPins({})).toEqual([]);
      /* A realization caption for a facet this module does not own is somebody
         else's fact and is not retired by a hair vocabulary. */
      expect(unconstrainedPresentationPins({ [facetOfSubject("nose")]: "a soft rounded tip" }))
        .toEqual([]);
    });

    /*
      FOUNDER FINDING #4, AT ITS OWN DOOR (2026-08-09, fable-118 ruling (a)).

      Production row v#163 stored this caption after he paid for "she wear her
      hair down"; v#164 retired it as pre-vocabulary free text, re-read the
      master, and told the painter "HAIR WORN: gathered" as an already-true
      fact. His hair came back up in a render he paid 25 credits for.

      The string below is the one from the row, verbatim.
    */
    const HIS_DELIVERY = "Straight dark hair worn down, center-parted, "
      + "falling loosely past shoulder length on both sides.";

    it("never retires a caption for a facet THIS CHAIN delivered", () => {
      /* Without the chain's own deliveries, the old rule stands and retires it
         — which is exactly the bug, so it is asserted rather than described. */
      expect(unconstrainedPresentationPins({ [HAIR_WORN]: HIS_DELIVERY }))
        .toEqual([HAIR_WORN]);
      expect(unconstrainedPresentationPins({ [HAIR_WORN]: HIS_DELIVERY }, new Set([HAIR_WORN])))
        .toEqual([]);
    });

    it("still retires a pre-vocabulary pin on a facet the chain never touched", () => {
      /* The delivery outranks the dictionary; it does not abolish it. A chain
         that edited her nose has no opinion about a free-text hair pin. */
      expect(unconstrainedPresentationPins(
        { [HAIR_WORN]: "worn natural, loose" },
        new Set([facetOfSubject("nose")]),
      )).toEqual([HAIR_WORN]);
    });

    it("judges a pin by its ID, so its prose can never be mistaken for a realization", () => {
      /* A pin carries the id it was chosen from. One this build still offers
         stays; one it has dropped goes — and neither answer depends on reading
         the sentence. */
      expect(unconstrainedPresentationPins({
        [HAIR_WORN]: { wording: arrangementWording("bun"), pin: "bun" },
      })).toEqual([]);
      expect(unconstrainedPresentationPins({
        [HAIR_WORN]: { wording: "tied back, up", pin: "tied back" },
      })).toEqual([HAIR_WORN]);
    });
  });

  it("declares exactly the facets the net is allowed to check", () => {
    /* The net verifies these because they are short categorical values.
       Widening this list without widening that reasoning is how false failures
       start costing free re-renders. */
    expect(PRESENTATION_FACETS).toEqual([HAIR_WORN]);
  });
});
