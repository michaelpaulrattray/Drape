/**
 * THE WARDROBE PLATE — driven (#1278 path E, his ruling 2026-09-29).
 *
 * Four properties are worth a suite, and each of them is a defect this road
 * would otherwise ship quietly:
 *
 * 1. **The cut is made on the bytes that ARRIVED.** This door is measured to
 *    clamp an ask, so a split computed from `OUTFIT_PLATE_SIZE` hands each view
 *    a sliver of the other panel — and a plausible picture comes back either
 *    way, so nothing downstream would ever disagree. The arms cut plates the
 *    constant does not describe, and assert WHICH PIXELS landed where.
 * 2. **The panels copy the product's own cameras** (his rule, 2026-09-27). The
 *    arm takes the two directives out of `castViewPackage` and requires them in
 *    the prompt verbatim, so a hand-typed camera sentence reddens rather than
 *    shipping a framing he cannot judge.
 * 3. **No fault of the plate's ever fails the Sign.** Every way a render can go
 *    wrong ends in `null`, and the one exception — a cancellation — is the arm
 *    that matters most, because swallowing it would leave two paid views
 *    rendering against a dead operation.
 * 4. **The plate is not of her.** It goes out with no references at all and its
 *    clause says so, because a plate carrying the anchor would put a second
 *    engine's opinion of her face along the edge of every garment.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  composeOutfitPlatePrompt,
  outfitPlateClause,
  plateSideFor,
  renderOutfitPlate,
  splitOutfitPlate,
  PLATE_ANGLES,
  type OutfitPlateEngine,
} from "./outfitPlate";
import { castPackageView } from "./castViewPackage";
import { pronounsForSex } from "./castPronouns";
import { OUTFIT_PLATE_SIZE } from "../providers/falImages";

/**
 * A two-panel plate whose halves are TELLABLE APART, at a size the asked-for
 * constant does not describe.
 *
 * Both halves of that sentence are load-bearing. Distinct colours are what make
 * "the front panel is the left half" an assertion rather than a shape check;
 * and a size that is not `OUTFIT_PLATE_SIZE` is what makes a reader that
 * computed from the constant fail instead of coincidentally agreeing.
 */
async function twoPanelPlate(width: number, height: number): Promise<Buffer> {
  const half = Math.ceil(width / 2);
  const left = await sharp({
    create: { width: half, height, channels: 3, background: { r: 220, g: 20, b: 20 } },
  }).png().toBuffer();
  const right = await sharp({
    create: { width: width - half, height, channels: 3, background: { r: 20, g: 20, b: 220 } },
  }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: half, top: 0 },
    ])
    .png()
    .toBuffer();
}

/** What colour a panel is, read at its middle pixel rather than asserted. */
async function middlePixel(bytes: Buffer): Promise<{ r: number; g: number; b: number }> {
  const meta = await sharp(bytes).metadata();
  const raw = await sharp(bytes)
    .extract({
      left: Math.floor((meta.width ?? 2) / 2),
      top: Math.floor((meta.height ?? 2) / 2),
      width: 1,
      height: 1,
    })
    .raw()
    .toBuffer();
  return { r: raw[0], g: raw[1], b: raw[2] };
}

function engineReturning(bytes: Buffer): OutfitPlateEngine {
  return {
    editWithReferences: async () => ({ bytes, contentType: "image/png", latencyMs: 1 }),
  };
}

describe("the cut is made on the bytes that arrived, never on the size we asked for", () => {
  it("halves a plate the door SCALED, and the panels are the real halves", async () => {
    /*
      The clamp this arm stands for is measured, not imagined: #1394's sheet
      arm asked 4688x1760 and was answered 3840x1440 every time. Here the ask
      is `OUTFIT_PLATE_SIZE` and the answer is a quarter of it — a reader that
      trusted the constant would try to extract 1752px out of an 876px frame.
    */
    const returned = { width: 876, height: 584 };
    expect(returned.width).not.toBe(OUTFIT_PLATE_SIZE.width);

    const plate = await splitOutfitPlate(
      await twoPanelPlate(returned.width, returned.height),
      "image/png",
    );

    expect(plate.source).toEqual(returned);
    const front = await sharp(plate.front.bytes).metadata();
    const back = await sharp(plate.back.bytes).metadata();
    expect(front.width).toBe(438);
    expect(back.width).toBe(438);
    expect(front.height).toBe(584);
  });

  it("puts the LEFT half in front and the RIGHT half in back — read at the pixels", async () => {
    const plate = await splitOutfitPlate(await twoPanelPlate(876, 584), "image/png");

    const front = await middlePixel(plate.front.bytes);
    const back = await middlePixel(plate.back.bytes);

    /* Red left, blue right. A reader that swapped the two, or that cut at the
       wrong column, cannot satisfy both of these. */
    expect(front.r).toBeGreaterThan(200);
    expect(front.b).toBeLessThan(60);
    expect(back.b).toBeGreaterThan(200);
    expect(back.r).toBeLessThan(60);
  });

  it("covers an ODD width completely — no column falls between the two panels", async () => {
    const plate = await splitOutfitPlate(await twoPanelPlate(877, 100), "image/png");

    const front = await sharp(plate.front.bytes).metadata();
    const back = await sharp(plate.back.bytes).metadata();

    /* 439 + 439 = 878 over an 877px frame: one duplicated column, which a
       generator cannot see, rather than a dropped one, which is a seam. */
    expect(front.width).toBe(439);
    expect(back.width).toBe(439);
    expect((front.width ?? 0) + (back.width ?? 0)).toBeGreaterThanOrEqual(877);
  });

  it("refuses a frame too narrow to have two halves", async () => {
    const oneColumn = await sharp({
      create: { width: 1, height: 10, channels: 3, background: { r: 1, g: 1, b: 1 } },
    }).png().toBuffer();

    await expect(splitOutfitPlate(oneColumn, "image/png")).rejects.toThrow(/splittable/);
  });
});

describe("the panels copy the product's own cameras — his rule, never a retyped one", () => {
  const prompt = composeOutfitPlatePrompt(null, "a street-level futurist, stylish and a little worn");

  it("sends frontFull's and backFull's OWN directives, taken from the view table", () => {
    /*
      Derived from the source of truth rather than restated here. His rule of
      2026-09-27 — *"the sheet should copy the exact angles and camera views the
      current views use not invent new ones"* — is only enforceable if the arm
      reads the same constant the product does; a retyped expectation would go
      on passing after somebody edited the directive.
    */
    expect(prompt).toContain(castPackageView("frontFull").directive);
    expect(prompt).toContain(castPackageView("backFull").directive);
  });

  it("puts the front camera in the LEFT panel and the back camera in the RIGHT one", () => {
    const left = prompt.indexOf("LEFT PANEL");
    const right = prompt.indexOf("RIGHT PANEL");
    expect(left).toBeGreaterThan(-1);
    expect(right).toBeGreaterThan(left);
    expect(prompt.indexOf(castPackageView("frontFull").directive)).toBeGreaterThan(left);
    expect(prompt.indexOf(castPackageView("frontFull").directive)).toBeLessThan(right);
    expect(prompt.indexOf(castPackageView("backFull").directive)).toBeGreaterThan(right);
  });

  it("carries the cast's own brief, and composes no DESCRIPTION label when there is none", () => {
    expect(prompt).toContain("DESCRIPTION: a street-level futurist, stylish and a little worn");
    expect(composeOutfitPlatePrompt(null, null)).not.toContain("DESCRIPTION:");
    expect(composeOutfitPlatePrompt(null, "   ")).not.toContain("DESCRIPTION:");
  });

  it("never tells a plate to keep a face it was never shown", () => {
    /* The view's opening sentence. A plate has no reference photograph, so
       sending it would be a prompt denying its own inputs. */
    expect(prompt).not.toContain("Keep this exact person unchanged");
  });

  it("asks for two panels of one scale, and bans the furniture of a contact sheet", () => {
    expect(prompt).toContain("TWO PANELS SIDE BY SIDE");
    expect(prompt).toMatch(/no gutter, border, caption, label, arrow or number/);
    expect(prompt).toContain("the same height in both");
  });
});

describe("the clause that hands a view its panel", () => {
  const pronouns = pronounsForSex("female");

  it("names the ordinal it is GIVEN, so a cast with tattoos points at the right picture", () => {
    /* The plate rides after her ink crops. Three crops put it at reference 5,
       and a clause that counted for itself would name her elbow. */
    const withInk = outfitPlateClause({ ordinal: 5, side: "front", pronouns });
    expect(withInk).toContain("reference 5 is a wardrobe plate");
    expect(withInk).toContain("take only the clothes from reference 5");
    expect(outfitPlateClause({ ordinal: 2, side: "front", pronouns })).toContain("reference 2");
  });

  it("says which half it is", () => {
    expect(outfitPlateClause({ ordinal: 2, side: "front", pronouns })).toContain("from the front");
    expect(outfitPlateClause({ ordinal: 2, side: "back", pronouns })).toContain("from behind");
  });

  it("says the plate is NOT her, and points identity back at reference 1", () => {
    const clause = outfitPlateClause({ ordinal: 2, side: "front", pronouns });
    expect(clause).toContain("It is NOT a photograph of her");
    expect(clause).toContain("from reference 1 alone");
  });

  it("hands frontFull the front panel and backFull the back one", () => {
    expect(PLATE_ANGLES).toEqual(["frontFull", "backFull"]);
    expect(plateSideFor("frontFull")).toBe("front");
    expect(plateSideFor("backFull")).toBe("back");
  });
});

describe("no fault of the plate's ever fails the Sign", () => {
  const ask = { wardrobeLine: null, description: null } as const;

  it("lands a plate and cuts it, on the happy road", async () => {
    const plate = await renderOutfitPlate({
      engine: engineReturning(await twoPanelPlate(876, 584)),
      ...ask,
    });

    expect(plate).not.toBeNull();
    expect(plate?.source).toEqual({ width: 876, height: 584 });
  });

  it("sends NO references — the plate is of the outfit, not of her", async () => {
    let sent: unknown = "never called";
    await renderOutfitPlate({
      engine: {
        editWithReferences: async (request) => {
          sent = request.references;
          return { bytes: await twoPanelPlate(876, 584), contentType: "image/png" };
        },
      },
      ...ask,
    });

    expect(sent).toEqual([]);
  });

  it("answers null when the engine refuses", async () => {
    const plate = await renderOutfitPlate({
      engine: { editWithReferences: async () => { throw new Error("content policy"); } },
      ...ask,
    });

    expect(plate).toBeNull();
  });

  it("answers null when the plate comes back unsplittable", async () => {
    const plate = await renderOutfitPlate({
      engine: {
        editWithReferences: async () => ({
          bytes: Buffer.from("not an image at all"),
          contentType: "image/png",
        }),
      },
      ...ask,
    });

    expect(plate).toBeNull();
  });

  it("answers null when the credential is missing, rather than taking the Sign down", async () => {
    const plate = await renderOutfitPlate({
      engine: {
        editWithReferences: async () => { throw new Error("FAL_KEY is required to render a Sign's wardrobe plate"); },
      },
      ...ask,
    });

    expect(plate).toBeNull();
  });

  it("⚠ RE-THROWS A CANCELLATION — an abort is the Sign dying, not the plate failing", async () => {
    /*
      The one exception, and the reason it exists: swallowing this would answer
      `null` to a torn-down operation and have two paid views cheerfully start
      rendering against it. The Sign's own catch then decides, which is the only
      place that knows whether the operation is alive.
    */
    const controller = new AbortController();
    controller.abort();

    await expect(renderOutfitPlate({
      engine: { editWithReferences: async () => { throw new Error("aborted"); } },
      signal: controller.signal,
      ...ask,
    })).rejects.toThrow(/aborted/);
  });

  it("passes the signal through, so a live Sign can cancel a plate in flight", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    await renderOutfitPlate({
      engine: {
        editWithReferences: async (request) => {
          seen = request.signal;
          return { bytes: await twoPanelPlate(876, 584), contentType: "image/png" };
        },
      },
      signal: controller.signal,
      ...ask,
    });

    expect(seen).toBe(controller.signal);
  });
});
