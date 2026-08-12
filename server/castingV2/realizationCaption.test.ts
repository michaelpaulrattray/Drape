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

import sharp from "sharp";

import { captionRealization, captionSlot } from "./realizationCaption";
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

/**
 * THE READER IS HANDED A THUMBNAIL AND ASKED TO SEE (opus-239, fable-295).
 *
 * `captionSlot` had no tests at all until this block — the words fix shipped
 * with a prompt-shape test and mint-wiring tests, and the reader itself was
 * never driven. What that cost is on the founder's own panel: an earring crop
 * is cut 1:1 from the frame at 24–36 px wide, and at that size the reader
 * described a hoop with a CROSS HANGING FROM IT as "Thin gold hoop earring,
 * smooth and continuous" — four times out of four, under two wordings. The
 * same file enlarged names the cross every time. These words are what a
 * repaint asks the painter for, so the omission is a deletion.
 *
 * Every case here drives a stub engine and counts the pictures it was shown,
 * because the claim is about WHAT WAS SENT, not about what a reader returned.
 */
describe("captionSlot reads twice: the small crop decides IF, the enlarged one decides WHAT", () => {
  const cutOf = async (width: number, height: number) => await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 140, b: 60 } },
  }).png().toBuffer();

  /** Answers in order, and keeps every image it was shown. */
  function engineSaying(replies: Array<Record<string, unknown>>) {
    const shown: Buffer[] = [];
    return {
      engine: {
        id: "stub",
        complete: async (request: { images?: Array<{ bytes: Buffer }> }) => {
          shown.push(request.images![0]!.bytes);
          const payload = replies[Math.min(shown.length - 1, replies.length - 1)]!;
          return { text: JSON.stringify(payload), truncated: false, latencyMs: 1 };
        },
      } as never,
      shown,
    };
  }

  it("enlarges a 27x74 cut and files the SECOND reading", async () => {
    const { engine, shown } = engineSaying([
      { caption: "Thin gold hoop earring", visible: true },
      { caption: "Gold hoop earring with a dangling cross charm", visible: true },
    ]);

    const said = await captionSlot({
      noun: "right earring", view: "cut", contentType: "image/png",
      bytes: await cutOf(27, 74), engine,
    });

    expect(said).toBe("Gold hoop earring with a dangling cross charm");
    expect(shown).toHaveLength(2);
    /* Asserted at the wire: the second picture is BIGGER, and it is the same
       aspect. A test on the returned sentence alone would pass with the
       enlargement deleted, since the stub answers in order regardless. */
    const first = await sharp(shown[0]!).metadata();
    const second = await sharp(shown[1]!).metadata();
    expect(first.width).toBe(27);
    expect(second.width).toBe(187);
    expect(second.height).toBe(512);
  });

  it("does NOT ask twice when the gate says it cannot see the thing", async () => {
    /* The occluded hoop: enlarging it made the reader stop declining and invent
       a different answer each time. The gate is the read trusted to say no, so
       nothing is spent past it. */
    const { engine, shown } = engineSaying([
      { caption: "Cutout too dark to distinguish any earring", visible: false },
      { caption: "Small silver-tone stud earring", visible: true },
    ]);

    const said = await captionSlot({
      noun: "right earring", view: "cut", contentType: "image/png",
      bytes: await cutOf(33, 59), engine,
    });

    expect(said).toBeNull();
    expect(shown).toHaveLength(1);
  });

  it("asks once for a cut already big enough to read — the price control", async () => {
    /* A hair crop is 463–823 px in the same run and has never lost a detail.
       Paying a second vision call for it would be spending on nothing. */
    const { engine, shown } = engineSaying([
      { caption: "Long wavy auburn-red hair, wet-look with a centre part", visible: true },
    ]);

    const said = await captionSlot({
      noun: "hair", view: "cut", contentType: "image/png",
      bytes: await cutOf(600, 800), engine,
    });

    expect(said).toBe("Long wavy auburn-red hair, wet-look with a centre part");
    expect(shown).toHaveLength(1);
  });

  it("asks once for a FRAME view, whatever its size", async () => {
    const { engine, shown } = engineSaying([{ caption: "A square jaw", visible: true }]);

    await captionSlot({
      noun: "jaw", view: "frame", contentType: "image/png",
      bytes: await cutOf(64, 64), engine,
    });

    expect(shown).toHaveLength(1);
  });

  it("keeps the gate's own sentence when the enlarged read declines or is empty", async () => {
    /* Never worse than the single read it replaces: the second call is trusted
       to describe, not to retract, and the gate has already ruled the thing
       visible. */
    const { engine } = engineSaying([
      { caption: "Thin gold hoop earring", visible: true },
      { caption: "", visible: false },
    ]);

    const said = await captionSlot({
      noun: "right earring", view: "cut", contentType: "image/png",
      bytes: await cutOf(27, 74), engine,
    });

    expect(said).toBe("Thin gold hoop earring");
  });
});
