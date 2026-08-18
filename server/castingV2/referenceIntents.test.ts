/**
 * The intent vocabulary and its ingestion map, driven directly.
 *
 * The map is a FOUNDER RULING (fable-933) rather than an implementation choice,
 * so what this file mostly does is pin it: each feature travels by the form he
 * ruled, and the mannequin is reserved for on-skin graphics. A quiet edit here
 * would be a quiet edit to the real-person fence, because the fence is met by
 * the FORM — a person cannot ride along a plate, a segmented cut, or a sentence.
 */
import { describe, expect, it } from "vitest";

import {
  REFERENCE_INTENTS,
  isReferenceIntent,
  openReferenceIntents,
  referenceIntentEntry,
  referenceIntentIsOpen,
  referenceIntentNotOpen,
} from "../../shared/referenceIntents";

describe("the ingestion map — his words, pinned", () => {
  it("routes each feature by the form he ruled", () => {
    /* fable-933: "only thing that needs to go on a manequinn is tattoos … copy
       her makeup the image is looked at it describes her makeup in words. to
       carry through , eye color can be cropped etc" */
    expect(referenceIntentEntry("tattoo").form).toBe("mannequinPlate");
    expect(referenceIntentEntry("hair").form).toBe("crop");
    expect(referenceIntentEntry("makeup").form).toBe("words");
    expect(referenceIntentEntry("eyeColour").form).toBe("crop");
  });

  it("reserves the mannequin for on-skin graphics, and nothing else", () => {
    /* The plate exists to peel a design off skin. Anything else sent through it
       would be a photograph of a person rendered onto a body — which is the one
       thing the fence forbids by construction. */
    const plated = REFERENCE_INTENTS.filter((key) => referenceIntentEntry(key).form === "mannequinPlate");
    expect(plated).toEqual(["tattoo"]);
  });

  it("knows what is BUILT, which is a different question from what is ruled", () => {
    expect(openReferenceIntents()).toEqual(["tattoo"]);
    expect(referenceIntentIsOpen("tattoo")).toBe(true);
    for (const key of ["hair", "makeup", "eyeColour"] as const) {
      expect(referenceIntentIsOpen(key)).toBe(false);
    }
  });

  it("derives the open list rather than keeping a second one", () => {
    /* Law 4. A form that ships flips one flag on its entry and this follows —
       there is no list to remember to edit. */
    const derived = REFERENCE_INTENTS.filter((key) => referenceIntentEntry(key).open);
    expect(openReferenceIntents()).toEqual(derived);
  });

  it("names the feature when it turns one down, and promises the money", () => {
    const said = referenceIntentNotOpen("hair");
    expect(said).toContain("her hair");
    expect(said).toContain("Nothing was charged");
    /* And it does not blame the reference: the picture is fine, the road is
       not built. */
    expect(said).not.toMatch(/invalid|unsupported|error/i);
  });

  it("has a door of its own for strings from outside", () => {
    expect(isReferenceIntent("tattoo")).toBe(true);
    expect(isReferenceIntent("freckles")).toBe(false);
    expect(isReferenceIntent("")).toBe(false);
  });
});
