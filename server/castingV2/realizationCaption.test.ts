/**
 * A CAPTION MAY NOT PIN A FAILED EDIT (D-183).
 *
 * Every assertion here drives a stub engine, so the rule is proved by the code
 * rather than by a well-behaved reader — the standard set after the D-177
 * backstop turned out to be inert while everything around it passed.
 *
 * The defect: a caption is handed to every later render as ALREADY TRUE. The
 * founder's face carried "EYE COLOUR: pinker" in the edits lane and "ALREADY
 * TRUE … Deep brown irises" in the pins, in the same prompt, because the read-
 * back faithfully described a render where the edit had not taken. The model
 * resolved that contradiction differently every time — pink eyeshadow on one
 * render, nothing on the next.
 */
import { describe, expect, it } from "vitest";

import { captionRealization } from "./realizationCaption";
import { facetOfSubject } from "./refineFacets";

const EYES = facetOfSubject("eyeColourFree");

function engineReturning(payload: Record<string, unknown>, seen?: { user?: string }) {
  return {
    id: "stub",
    complete: async (request: { user: string }) => {
      if (seen) seen.user = request.user;
      return { text: JSON.stringify(payload), truncated: false, latencyMs: 1 };
    },
  } as never;
}

const bytes = Buffer.from("pixels");

describe("the read-back is checked against what was asked", () => {
  it("pins a caption the render corroborates", async () => {
    const caption = await captionRealization({
      facet: EYES,
      bytes,
      contentType: "image/png",
      asked: "pinker",
      engine: engineReturning({ caption: "Soft rose-pink irises, evenly toned.", matches: true }),
    });
    expect(caption).toBe("Soft rose-pink irises, evenly toned.");
  });

  /* THE FOUNDER'S ROW, exactly: the ask was "pinker" and the render came back
     deep brown. Recording that would make brown ground truth forever. */
  it("refuses to pin what is there when the ask is not visible", async () => {
    const caption = await captionRealization({
      facet: EYES,
      bytes,
      contentType: "image/png",
      asked: "pinker",
      engine: engineReturning({
        caption: "Deep brown irises with a slight reddish glare behind the lenses.",
        matches: false,
      }),
    });
    expect(caption).toBeNull();
  });

  /*
    CONSERVATIVE WHEN UNSURE. A missing `matches` is a schema wobble, and the
    two failure modes are not symmetric: no caption costs precision on the next
    render and decays; a wrong caption argues with the instruction in every
    render from here on and does not.
  */
  it("does not pin when corroboration is missing altogether", async () => {
    const caption = await captionRealization({
      facet: EYES,
      bytes,
      contentType: "image/png",
      asked: "pinker",
      engine: engineReturning({ caption: "Deep brown irises." }),
    });
    expect(caption).toBeNull();
  });

  it("takes the caption as written when there was no ask to check", async () => {
    /* A facet nobody instructed has nothing to corroborate against. */
    const caption = await captionRealization({
      facet: EYES,
      bytes,
      contentType: "image/png",
      engine: engineReturning({ caption: "Deep brown irises." }),
    });
    expect(caption).toBe("Deep brown irises.");
  });

  it("tells the reader what the edit asked for", async () => {
    const seen: { user?: string } = {};
    await captionRealization({
      facet: EYES,
      bytes,
      contentType: "image/png",
      asked: "pinker",
      engine: engineReturning({ caption: "Rose-pink irises.", matches: true }, seen),
    });
    expect(seen.user).toContain("The edit asked for: pinker");
  });
});
