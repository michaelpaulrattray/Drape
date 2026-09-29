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
 * 4. **The plate IS her, and it edits the master** (his ruling 2026-09-29,
 *    #1471: *"no the plate must reference the master image otherwise it
 *    wouldnt be able to invent the outfit correctly"*). Property 4 read the
 *    exact opposite for one day — *"it goes out with no references at all"* —
 *    so the arms below are written to redden if the words-only road ever comes
 *    back: the anchor must be IN the request, the identity sentence must be in
 *    the prompt, and the clause must stop calling the plate a stranger.
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
import {
  VIEW_IDENTITY_SENTENCE,
  castPackageView,
  referenceRuleFor,
} from "./castViewPackage";
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

/**
 * HER MASTER — the one reference every plate request carries since #1471.
 *
 * A real PNG rather than a stub, because `renderOutfitPlate` hands it to an
 * engine and an arm that asserts "the anchor went out" is worth nothing if the
 * bytes it compares are a sentinel no door would accept.
 */
const ANCHOR = {
  bytes: Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    + "1f15c4890000000d4944415478da6364f8cf000001030100b5e2e6b50000000049454e44ae426082",
    "hex",
  ),
  contentType: "image/png",
} as const;

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
    /*
      ⚠ THE NEGATIVE HALF IS ANCHORED ON THE LABEL'S OWN LINE, NOT ON THE
      SUBSTRING, AND #1471 IS WHY. `not.toContain("DESCRIPTION:")` was honest
      while the plate opened on its layout sentence; the prompt now opens with
      the reference rule, and the UNDESCRIBED form of that rule begins *"THE
      REFERENCE PHOTOGRAPH IS THE DESCRIPTION: there is no written description
      of this person"*. So the loose assertion reddens on a prompt that is
      perfectly correct — the `negation contains the token` class, one prompt
      down. What the arm actually means is "no `DESCRIPTION: <brief>` line", and
      that is what it now reads.
    */
    const labelled = (text: string) =>
      text.split(/\n/).filter((line) => line.startsWith("DESCRIPTION: "));

    expect(labelled(prompt)).toEqual(["DESCRIPTION: a street-level futurist, stylish and a little worn"]);
    expect(labelled(composeOutfitPlatePrompt(null, null))).toEqual([]);
    expect(labelled(composeOutfitPlatePrompt(null, "   "))).toEqual([]);
    /* And the positive control the loose form never had: the undescribed prompt
       really does carry the sentence that made the old assertion red. */
    expect(composeOutfitPlatePrompt(null, null)).toContain("THE REFERENCE PHOTOGRAPH IS THE DESCRIPTION:");
  });

  it("opens with the identity sentence, because the plate HAS her photograph now", () => {
    /*
      ⚠ THIS ARM READ `not.toContain` UNTIL #1471 and it was right about the
      road it was written for: a plate drawn from words has no reference
      photograph, so that sentence would have denied its own inputs. His ruling
      gave the plate the master, so the sentence is true and the absence is the
      defect. Both directions matter, which is why the arm asserts the identity
      pair and the WARDROBE paragraph that names the same reference.
    */
    expect(prompt).toContain(VIEW_IDENTITY_SENTENCE);
    expect(prompt).toContain(referenceRuleFor("a street-level futurist, stylish and a little worn"));
    expect(prompt).toContain("the SAME outfit the reference photograph shows");
  });

  it("reads both sentences from castViewPackage rather than carrying a copy", () => {
    /*
      Working law 4, driven rather than trusted: the two sentences are compared
      against the module that declares them, so a retyped copy here — the drift
      the export exists to prevent — reddens on the first word that differs.
    */
    const described = composeOutfitPlatePrompt(null, "a street-level futurist");
    const undescribed = composeOutfitPlatePrompt(null, null);
    expect(described).toContain(referenceRuleFor("a street-level futurist"));
    expect(undescribed).toContain(referenceRuleFor(null));
    expect(referenceRuleFor(null)).not.toBe(referenceRuleFor("a street-level futurist"));
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
    expect(withInk).toContain("reference 5 settles only the clothes");
    expect(outfitPlateClause({ ordinal: 2, side: "front", pronouns })).toContain("reference 2");
  });

  it("says which half it is", () => {
    expect(outfitPlateClause({ ordinal: 2, side: "front", pronouns })).toContain("from the front");
    expect(outfitPlateClause({ ordinal: 2, side: "back", pronouns })).toContain("from behind");
  });

  it("says the plate IS her, and still makes reference 1 the record for the likeness", () => {
    /*
      ⚠ THIS ARM ASSERTED THE OPPOSITE UNTIL #1471 — *"It is NOT a photograph
      of her"* — and that sentence was true only while the plate was drawn from
      words. A plate edited from the master IS her, so the old wording would
      have a paid view told something false about its own reference. The
      negative half is the arm that matters: it reddens if the stranger sentence
      ever returns.
    */
    const clause = outfitPlateClause({ ordinal: 2, side: "front", pronouns });
    expect(clause).toContain("the same person as reference 1");
    expect(clause).not.toContain("is not her");
    expect(clause).not.toContain("NOT a photograph of her");
    /* The part of the old clause that survives: one source for identity. */
    expect(clause).toContain("Reference 1 is the record for her face, hair and build");
    expect(clause).toContain("reference 1 wins");
  });

  it("covers a cast with no garments at all — his second point on #1471", () => {
    /*
      There is no "no wardrobe, no plate" gate and there should not be one: a
      creature, a loincloth, bare skin gets a plate too, and for those the plate
      IS the lower-body continuation. A clause naming only garments would have
      that plate contribute nothing to the two views it was rendered for.
    */
    const clause = outfitPlateClause({ ordinal: 2, side: "back", pronouns });
    expect(clause).toContain("Where there are no garments");
    expect(clause).toMatch(/skin, hide, fur, scales, markings and feet/);
  });

  it("hands frontFull the front panel and backFull the back one", () => {
    expect(PLATE_ANGLES).toEqual(["frontFull", "backFull"]);
    expect(plateSideFor("frontFull")).toBe("front");
    expect(plateSideFor("backFull")).toBe("back");
  });
});

describe("no fault of the plate's ever fails the Sign", () => {
  const ask = { wardrobeLine: null, description: null, anchor: ANCHOR } as const;

  it("lands a plate and cuts it, on the happy road", async () => {
    const plate = await renderOutfitPlate({
      engine: engineReturning(await twoPanelPlate(876, 584)),
      ...ask,
    });

    expect(plate).not.toBeNull();
    expect(plate?.source).toEqual({ width: 876, height: 584 });
  });

  it("sends HER MASTER, and exactly one reference — his ruling on #1471", async () => {
    /*
      ⚠ THIS ARM ASSERTED `toEqual([])` UNTIL #1471. The words-only plate is
      the road his ruling closed, so the arm is written to redden if it comes
      back: the anchor's own bytes must be what went out, and the list must be
      exactly one long — her delivered ink crops belong to the VIEW, which is
      where they are named by position and judged.
    */
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

    expect(sent).toEqual([ANCHOR]);
  });

  it("⚠ a plate the door refuses for want of a reference is still only a missing plate", async () => {
    /*
      The engine refuses an empty reference list before dispatch (#1471), and
      that refusal must land exactly where every other plate fault lands: `null`,
      no throw, the Sign renders master-only. Driven through the real refusal's
      shape rather than a generic Error, because the whole point of moving the
      refusal earlier was that it must NOT become a failed Sign.
    */
    const plate = await renderOutfitPlate({
      engine: {
        editWithReferences: async () => {
          throw new Error("the outfit plate is edited from the master and needs at least one reference image");
        },
      },
      ...ask,
    });

    expect(plate).toBeNull();
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
