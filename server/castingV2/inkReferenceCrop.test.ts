/**
 * THE CUTTER'S GEOMETRY AND ROUTING, DRIVEN DIRECTLY.
 *
 * Every arm here runs without a segmenter, so the routing table — the thing the
 * widening tripwire's retirement rests on — is proven by a test that CAN fail
 * rather than by a model that usually behaves (working law 3).
 *
 * The arms that matter most are the negative ones: `negative-arm-cannot-find-yes-defects`
 * is banked in this house because both control arms have each caught a different
 * bug. So the licence row gets a test that would go red if a percentage floor
 * were ever introduced, and the cutout gets one that would go red if the masking
 * silently became a bounding-box crop — which it DID, four times, during this
 * build's own reading.
 */
import { resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import {
  INK_REGION,
  PERSON_REGION,
  cropClearsMinimumEdge,
  cutOutPixels,
  extentOf,
  FACE_REGION,
  intersectMasks,
  overlapPixels,
  subtractMask,
  maskOfHalf,
  paddedLicenceCanvas,
  routeInkUpload,
  scopeInkMask,
} from "./inkReferenceCrop";
import type { Mask } from "./maskedComposite";
import { imageHalfClause, imageHalfOf, pictureHalfPhrase } from "./sidePhrasing";

/** A mask with a solid rectangle lit in it. */
function maskWithBox(
  width: number,
  height: number,
  box: { left: number; top: number; width: number; height: number } | null,
): Mask {
  const data = Buffer.alloc(width * height, 0);
  if (box) {
    for (let y = box.top; y < box.top + box.height; y += 1) {
      for (let x = box.left; x < box.left + box.width; x += 1) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

describe("the two question words are the measured ones", () => {
  /*
    Pinned as VALUES, because the whole road rests on them and a well-meaning
    tidy to `tattoo` or `person` is exactly the edit this reading was bought to
    prevent. `tattoo` returns one star of a four-object design; `person` cannot
    tell a drawn person from a photographed one.
  */
  it("asks `tattooed skin` and not `tattoo`", () => {
    expect(INK_REGION).toBe("tattooed skin");
  });

  it("asks `human skin` and not `person`", () => {
    expect(PERSON_REGION).toBe("human skin");
  });
});

describe("the routing table", () => {
  it("CUTS when there is ink, whoever else is in the picture", () => {
    expect(routeInkUpload({ inkPixels: 6256, personPixels: 344538 })).toBe("cut");
    expect(routeInkUpload({ inkPixels: 6256, personPixels: 0 })).toBe("cut");
  });

  it("lets the frame ride whole ONLY on a positive nobody-in-it", () => {
    expect(routeInkUpload({ inkPixels: 0, personPixels: 0 })).toBe("rideWhole");
  });

  /*
    THE ROW THE WHOLE DESIGN IS FOR. A photograph of a person whose ink the
    reader missed is precisely the object the widening tripwire exists to keep
    out of an engine, and "no tattoo found" must never buy the whole frame.
  */
  it("REFUSES a photographed person the cutter found no ink on", () => {
    expect(routeInkUpload({ inkPixels: 0, personPixels: 344538 })).toBe("refuse");
  });

  /*
    THE GHOST-MANNEQUIN ROW, at its measured numbers (population (iv)). A full
    sleeve on a photorealistic grey arm: the licence word reads the limb as skin
    with total confidence and the cut word finds no PATCH of tattooed skin,
    because the whole limb is one. It refuses, the row does not soften, and this
    arm is here so that a later "fix" for that customer cost has to delete a
    test rather than quietly widen a branch.
  */
  it("REFUSES the ghost-mannequin sleeve, at the numbers it actually read", () => {
    expect(routeInkUpload({ inkPixels: 0, personPixels: 232061 })).toBe("refuse");
  });

  it("lets a plastic mannequin ride whole — nobody is in it", () => {
    expect(routeInkUpload({ inkPixels: 0, personPixels: 0 })).toBe("rideWhole");
  });

  /*
    THE LICENCE LAW, AS AN ARM THAT CAN FAIL (ratified fable-1129 §1).

    17,407 px is 1.80% of the frame it came from — a cloaked, armoured man whose
    face was the only skin showing — and read as a percentage that sits BELOW
    the 3.2% a different word scored on a sheet of paper. If anyone ever adds a
    floor to "ignore noise", THIS is the arm that goes red.
  */
  it("refuses on ONE pixel of skin — there is no percentage floor to hide under", () => {
    expect(routeInkUpload({ inkPixels: 0, personPixels: 17407 })).toBe("refuse");
    expect(routeInkUpload({ inkPixels: 0, personPixels: 1 })).toBe("refuse");
  });

  it("cuts on ONE pixel of ink, for the same reason", () => {
    expect(routeInkUpload({ inkPixels: 1, personPixels: 344538 })).toBe("cut");
  });

  /* Our own arithmetic gone wrong must not be able to resolve to a licence. */
  it("throws rather than routing on a count that is not a count", () => {
    expect(() => routeInkUpload({ inkPixels: -1, personPixels: 0 })).toThrow(/non-negative/);
    expect(() => routeInkUpload({ inkPixels: 0, personPixels: -1 })).toThrow(/non-negative/);
    expect(() => routeInkUpload({ inkPixels: 0.5, personPixels: 0 })).toThrow(/non-negative/);
    expect(() => routeInkUpload({ inkPixels: Number.NaN, personPixels: 0 })).toThrow(/non-negative/);
  });
});

describe("extentOf", () => {
  it("counts the lit pixels and bounds them in one pass", () => {
    const mask = maskWithBox(100, 80, { left: 10, top: 20, width: 30, height: 40 });
    const { pixels, box } = extentOf(mask);
    expect(pixels).toBe(30 * 40);
    expect(box).toEqual({ left: 10, top: 20, width: 30, height: 40 });
  });

  /* An empty mask is a READING — `absentIsAnswer`'s whole point — so it comes
     back as zero and null rather than as a throw. */
  it("reports an empty mask as zero pixels and no box", () => {
    expect(extentOf(maskWithBox(50, 50, null))).toEqual({ pixels: 0, box: null });
  });

  it("finds a single lit pixel, which is the licence's own edge case", () => {
    const mask = maskWithBox(64, 64, { left: 63, top: 0, width: 1, height: 1 });
    const { pixels, box } = extentOf(mask);
    expect(pixels).toBe(1);
    expect(box).toEqual({ left: 63, top: 0, width: 1, height: 1 });
  });

  it("ignores half-lit edge pixels — a partial pixel is not a pixel of design", () => {
    const data = Buffer.alloc(4 * 4, 120);
    expect(extentOf({ data, width: 4, height: 4 })).toEqual({ pixels: 0, box: null });
  });

  /* D-210's door: sharp promotes buffers to three channels behind your back,
     and a loop walking one byte per pixel then reads past the end and compares
     against `undefined`, which is false — so a guarantee reports success for
     two thirds of a buffer it never looked at. */
  it("refuses a buffer that is not one byte per pixel rather than indexing into it", () => {
    const promoted = { data: Buffer.alloc(10 * 10 * 3, 255), width: 10, height: 10 };
    expect(() => extentOf(promoted)).toThrow(/not one byte per pixel/);
  });
});

describe("the completeness guard", () => {
  it("passes a crop whose shortest edge clears the door's own floor", () => {
    expect(cropClearsMinimumEdge({ left: 0, top: 0, width: INK_DESIGN_MIN_EDGE, height: 400 })).toBe(true);
  });

  it("refuses forty pixels of ink", () => {
    expect(cropClearsMinimumEdge({ left: 0, top: 0, width: 40, height: 40 })).toBe(false);
  });

  /* The SHORTEST edge, so a long thin strip cannot pass on its length. */
  it("judges the shortest edge, never the longest", () => {
    expect(cropClearsMinimumEdge({ left: 0, top: 0, width: 2000, height: 12 })).toBe(false);
  });

  /*
    The floor is the upload door's own constant, imported rather than restated
    (law 4). If somebody gives this road a second number, this arm goes red.
  */
  it("sits exactly on the door's constant, with no second number of its own", () => {
    expect(cropClearsMinimumEdge({ left: 0, top: 0, width: INK_DESIGN_MIN_EDGE, height: INK_DESIGN_MIN_EDGE })).toBe(true);
    expect(cropClearsMinimumEdge({ left: 0, top: 0, width: INK_DESIGN_MIN_EDGE - 1, height: 9000 })).toBe(false);
  });
});

describe("cutOutPixels — a masked cutout, never a bounding rectangle", () => {
  const width = 8;
  const height = 8;
  /** A frame of solid opaque red. */
  function frame(): Buffer {
    const rgba = Buffer.alloc(width * height * 4);
    for (let at = 0; at < width * height; at += 1) {
      rgba[at * 4] = 200;
      rgba[at * 4 + 1] = 30;
      rgba[at * 4 + 2] = 30;
      rgba[at * 4 + 3] = 255;
    }
    return rgba;
  }

  /*
    THE ARM THAT WOULD HAVE CAUGHT THE BUG THIS BUILD ACTUALLY SHIPPED INTO ITS
    OWN READING. `composite({ blend: "dest-in" })` with a single-channel mask is
    a silent no-op, and four "cutouts" came back as plain crops with every pixel
    opaque. A test asserting the cut's SIZE would have passed on all four.
  */
  it("clears the alpha everywhere the mask is dark", () => {
    const mask = maskWithBox(width, height, { left: 2, top: 2, width: 3, height: 3 });
    const out = cutOutPixels({ rgba: frame(), width, height, mask });

    let opaque = 0;
    for (let at = 0; at < width * height; at += 1) if (out[at * 4 + 3] > 127) opaque += 1;
    expect(opaque).toBe(9);

    /* inside the mask, kept whole — colour untouched, alpha full */
    const inside = (2 + 2 * width) * 4;
    expect([out[inside], out[inside + 1], out[inside + 2], out[inside + 3]]).toEqual([200, 30, 30, 255]);

    /* one pixel outside it, in the same bounding box's row — this is the pixel a
       rectangle crop would have kept */
    const outside = (5 + 2 * width) * 4;
    expect(out[outside + 3]).toBe(0);
  });

  /*
    ⚠ THE ARM FOR THE DEFECT THE ONE ABOVE COULD NOT SEE (found opus-909 §2,
    ordered fable-1216 §1).

    Everything above tests the ALPHA. The loop used to write the alpha byte and
    nothing else, over a copy of the whole picture — so a cut was the customer's
    photograph with a mask laid on top of it, and 41% of a real stored cut was
    fully transparent pixels still holding a photograph of a man's arm. Every
    arm here passed the whole time.

    So this asserts the COLOUR of a cleared pixel, at the bytes, and the real
    photograph below is the same assertion on a picture nobody constructed.
  */
  it("ZEROES the colour of every cleared pixel — the person leaves the bytes, not just the view", () => {
    const mask = maskWithBox(width, height, { left: 2, top: 2, width: 3, height: 3 });
    const out = cutOutPixels({ rgba: frame(), width, height, mask });

    for (let at = 0; at < width * height; at += 1) {
      if (out[at * 4 + 3] !== 0) continue;
      expect(
        [out[at * 4], out[at * 4 + 1], out[at * 4 + 2]],
        `pixel ${at} is transparent but still carries its source colour`,
      ).toEqual([0, 0, 0]);
    }
  });

  it("leaves the source buffer alone", () => {
    const rgba = frame();
    const before = Buffer.from(rgba);
    cutOutPixels({ rgba, width, height, mask: maskWithBox(width, height, { left: 0, top: 0, width: 2, height: 2 }) });
    expect(rgba.equals(before)).toBe(true);
  });

  /* NEVER RESIZE A MASK TO FIT — `maskedRefine`'s house rule, and a resample
     inside the one path that promises not to have one. */
  it("refuses a mask that is not in its picture's space rather than resampling", () => {
    expect(() =>
      cutOutPixels({ rgba: frame(), width, height, mask: maskWithBox(width * 2, height, null) }),
    ).toThrow(/refusing rather than resampling/);
  });

  it("refuses a picture buffer that is not RGBA", () => {
    expect(() =>
      cutOutPixels({ rgba: Buffer.alloc(width * height * 3), width, height, mask: maskWithBox(width, height, null) }),
    ).toThrow(/expected/);
  });

  /*
    AND THE SAME THING ON A REAL PHOTOGRAPH OF A REAL PERSON (ordered
    fable-1216 §1), because the fixture family is the trap this defect was
    hiding in — twice now.

    The floor court's ladder was three opaque rungs, so it could not see an
    upscaler dropping transparency. Every arm above is a synthetic frame of one
    flat colour, so none of them could see a photograph surviving under an
    alpha. A fixture whose cleared pixels were already black would pass this
    test while the code did nothing, which is why the POSITIVE CONTROL runs
    first: the same pixels are proven non-black in the source before they are
    required to be black in the cut.

    It reads one committed photograph off disk — his own specimen, the man whose
    arm this whole road was measured on.
  */
  it("takes the photograph out of a REAL picture's cleared pixels — with the control that proves it could have failed", async () => {
    const source = await sharp(resolve("docs/specs/references/build-two-founder-specimens/tattoo-patchwork-man-selective-take.png"))
      /* Small enough to be a unit test, large enough to be a photograph. */
      .resize({ width: 120, height: 160, fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const w = 120;
    const h = 160;
    /* The mask keeps a small box; everything outside it is his photograph. */
    const mask = maskWithBox(w, h, { left: 40, top: 60, width: 30, height: 30 });

    let couldHaveFailed = 0;
    for (let at = 0; at < w * h; at += 1) {
      if (mask.data[at] > 127) continue;
      if (source[at * 4] !== 0 || source[at * 4 + 1] !== 0 || source[at * 4 + 2] !== 0) couldHaveFailed += 1;
    }
    expect(
      couldHaveFailed,
      "a photograph whose cleared pixels are already black would pass this arm while the code did nothing",
    ).toBeGreaterThan(w * h * 0.5);

    const out = cutOutPixels({ rgba: source, width: w, height: h, mask });
    let leaked = 0;
    for (let at = 0; at < w * h; at += 1) {
      if (out[at * 4 + 3] !== 0) continue;
      if (out[at * 4] !== 0 || out[at * 4 + 1] !== 0 || out[at * 4 + 2] !== 0) leaked += 1;
    }
    expect(leaked, "a cut of his photograph is carrying his photograph").toBe(0);
  });
});

/*
  THE REGION-SCOPED CUT — the arithmetic, driven directly (ruled fable-1158
  §2a, roads and conditions ruled fable-1172).

  **EVERY PER-SIDE ARM RUNS MIRRORED TOO, and that is not thoroughness — it is
  fable-1172 §2c, from this campaign's own measured trap.** A per-side claim
  that only ever runs one way round passes on a road that favours the picture's
  right (`image-half-not-anatomy`, `per-side-paint-favours-image-right`), and
  the failure looks exactly like a pass. So the fixtures are built by a helper
  that can flip the whole world, and each arm asserts the mirrored expectation
  rather than the same one twice.
*/
describe("the face comes out of the surface — the region road's fence", () => {
  /*
    fable-1183 §2b, countersigned fable-1201 §4. The region road carries a
    SURFACE of a stranger's photograph, and a surface box is a rectangle over a
    body: it can climb far enough to take the face with it. This is the
    arithmetic that stops that, driven directly.

    ⚠ The geometry below is AUTHORED and not traced from a specimen. This
    comment cited *"the S2 torso specimen… climbs to y=80"* until 2026-08-21;
    measured at the real reader that surface starts at y=210 and `face ∩ upper
    chest` is 0 px on both founder photographs, so no real upload we hold
    exercises this. `V3B_FRAMES_GATE_WALK.md` §5(b).
  */
  const W = 400;
  const H = 400;

  it("takes every face pixel out and leaves every other one", () => {
    const surface = maskWithBox(W, H, { left: 50, top: 50, width: 200, height: 200 });
    const face = maskWithBox(W, H, { left: 100, top: 100, width: 60, height: 60 });
    const kept = subtractMask(surface, face);
    /* Counted, not sampled — 200x200 minus a 60x60 hole. */
    expect(extentOf(kept).pixels).toBe(200 * 200 - 60 * 60);
    /* THE PROPERTY, said as the fence says it: nothing of the face survives. */
    expect(overlapPixels(kept, face)).toBe(0);
  });

  it("leaves a HOLE rather than a smaller rectangle — the box does not shrink", () => {
    /*
      A face inside the surface must not be answered by cropping around it: the
      alternative to a hole is either refusing the ordinary shoulders-and-chest
      photograph or carrying the face. The extent's BOX is unchanged and only
      its COUNT moves.
    */
    const surface = maskWithBox(W, H, { left: 50, top: 50, width: 200, height: 200 });
    const kept = subtractMask(surface, maskWithBox(W, H, { left: 100, top: 100, width: 60, height: 60 }));
    expect(extentOf(kept).box).toEqual({ left: 50, top: 50, width: 200, height: 200 });
  });

  it("NEGATIVE CONTROL: a face that does not touch the surface takes NOTHING", () => {
    /*
      Without this, a subtractor that blanked everything would pass the arm
      above — and the S1 arm case is exactly this shape: `face` answers on the
      frame and the surface box does not reach it, so the crop must be whole.
    */
    const surface = maskWithBox(W, H, { left: 200, top: 200, width: 150, height: 150 });
    const face = maskWithBox(W, H, { left: 10, top: 10, width: 60, height: 60 });
    const kept = subtractMask(surface, face);
    expect(extentOf(kept).pixels).toBe(150 * 150);
    expect(extentOf(kept).box).toEqual(extentOf(surface).box);
  });

  it("answers an EMPTY mask when the surface is entirely face", () => {
    /* Reachable and handled rather than declared impossible: a tight head-and-
       shoulders crop where the named surface is all jaw. The caller drops the
       region road and the ink cut stands. */
    const surface = maskWithBox(W, H, { left: 50, top: 50, width: 100, height: 100 });
    expect(extentOf(subtractMask(surface, surface)).box).toBeNull();
  });

  it("REFUSES two masks that are not in one space — never resamples", () => {
    /* `maskedRefine`'s house rule, at the second site that has to keep it. */
    expect(() => subtractMask(maskWithBox(4, 4, null), maskWithBox(5, 4, null)))
      .toThrow(/refusing rather than resampling/);
    expect(() => overlapPixels(maskWithBox(4, 4, null), maskWithBox(5, 4, null)))
      .toThrow(/refusing rather than resampling/);
  });

  it("counts overlap rather than answering yes or no", () => {
    /* One stray pixel is a rounding edge and ten thousand is a face — the two
       read differently and a boolean would make them one fact. */
    const a = maskWithBox(W, H, { left: 0, top: 0, width: 100, height: 100 });
    expect(overlapPixels(a, maskWithBox(W, H, { left: 99, top: 99, width: 50, height: 50 }))).toBe(1);
    expect(overlapPixels(a, maskWithBox(W, H, { left: 0, top: 0, width: 100, height: 100 }))).toBe(100 * 100);
    expect(overlapPixels(a, maskWithBox(W, H, null))).toBe(0);
  });

  it("the face word is the measured one, and it is NOT the licence's", () => {
    /*
      Two questions about a person on one road, and they are opposites in one
      respect: the licence is a COUNT and may be asked of a padded copy; this is
      ONLY geometry and must be asked of her own frame. Pinned so a later edit
      cannot quietly point one at the other's picture.
    */
    expect(FACE_REGION).toBe("face");
    expect(FACE_REGION).not.toBe(PERSON_REGION);
    expect(FACE_REGION).not.toBe(INK_REGION);
  });
});

describe("the region-scoped cut, by arithmetic and never by a reader", () => {
  /* Big enough that the DESIGN FLOOR is never accidentally the subject: a
     design must clear `INK_DESIGN_MIN_EDGE` on its shortest side, so a toy
     frame would make every arm here a test of the floor instead. */
  const W = 1200;
  const H = 700;

  /** A box, and the same box mirrored about the frame's vertical midline. */
  const flipBox = (box: { left: number; top: number; width: number; height: number }) => ({
    ...box,
    left: W - box.left - box.width,
  });

  /** A design big enough to BE a design, so the floor is never the subject. */
  const bigEnough = { width: INK_DESIGN_MIN_EDGE + 40, height: INK_DESIGN_MIN_EDGE + 40 };

  const onTheLeftOfThePicture = { left: 40, top: 40, ...bigEnough };
  const onTheRightOfThePicture = flipBox(onTheLeftOfThePicture);

  /** The whole frame — a region that holds everything, i.e. narrows nothing. */
  const everywhere = maskWithBox(W, H, { left: 0, top: 0, width: W, height: H });

  it("HALVES A FRAME BY COLUMN, and the middle column belongs to neither on an odd width", () => {
    const left = maskOfHalf({ width: 5, height: 1, half: "left" });
    const right = maskOfHalf({ width: 5, height: 1, half: "right" });
    expect([...left.data].map((one) => (one > 127 ? 1 : 0))).toEqual([1, 1, 0, 0, 0]);
    expect([...right.data].map((one) => (one > 127 ? 1 : 0))).toEqual([0, 0, 0, 1, 1]);
    /* No pixel is in both — the fallback below compares the two counts, so an
       overlapping midline would be a thumb on the scale of that comparison. */
    for (let at = 0; at < 5; at += 1) {
      expect(left.data[at]! > 127 && right.data[at]! > 127, `column ${at} is in both halves`).toBe(false);
    }
  });

  it("REFUSES TO INTERSECT MASKS THAT ARE NOT IN ONE SPACE — never resamples", () => {
    expect(() => intersectMasks(maskWithBox(4, 4, null), maskWithBox(5, 4, null)))
      .toThrow(/refusing rather than resampling/);
  });

  it("takes the design in the half her word points at — BOTH WAYS ROUND", () => {
    /*
      Two designs, one in each half of the picture, and a region that holds
      both. The half is the ONLY thing that separates them, so an arm that
      passed for another reason could not pass this one.
    */
    const ink = maskWithBox(W, H, onTheLeftOfThePicture);
    const alsoOnTheRight = maskWithBox(W, H, onTheRightOfThePicture);
    for (let at = 0; at < ink.data.length; at += 1) {
      if (alsoOnTheRight.data[at]! > 127) ink.data[at] = 255;
    }

    const left = scopeInkMask({ ink, region: everywhere, half: "left" });
    expect(left.half).toBe("left");
    expect(left.fellBack).toBe(false);
    expect(left.box).toEqual(onTheLeftOfThePicture);

    /* MIRRORED — the same world, the other word. */
    const right = scopeInkMask({ ink, region: everywhere, half: "right" });
    expect(right.half).toBe("right");
    expect(right.fellBack).toBe(false);
    expect(right.box).toEqual(onTheRightOfThePicture);
  });

  it("FALLS BACK to the inked half when the named one holds nothing — BOTH WAYS ROUND", () => {
    /*
      §2b's free fallback: *"an empty offer where a design plainly exists would
      be a wall wearing a shrug"*. One arm is inked, she named the other, and
      the answer is the inked one WITH `fellBack` set — because the sentence
      she reads has to say which half it came out of, and this is the case
      where that sentence differs from her own word.
    */
    const inkOnTheRight = maskWithBox(W, H, onTheRightOfThePicture);
    const asked = scopeInkMask({ ink: inkOnTheRight, region: everywhere, half: "left" });
    expect(asked.fellBack, "the named half was empty and the fallback did not fire").toBe(true);
    expect(asked.half).toBe("right");
    expect(asked.box).toEqual(onTheRightOfThePicture);

    /* MIRRORED. */
    const inkOnTheLeft = maskWithBox(W, H, onTheLeftOfThePicture);
    const mirrored = scopeInkMask({ ink: inkOnTheLeft, region: everywhere, half: "right" });
    expect(mirrored.fellBack).toBe(true);
    expect(mirrored.half).toBe("left");
    expect(mirrored.box).toEqual(onTheLeftOfThePicture);
  });

  it("does not fall back for a FEW STRAY PIXELS across the midline — BOTH WAYS ROUND", () => {
    /*
      THE NUMBER IS NOT A NEW NUMBER. `~empty` in the ruling is spelled as *the
      piece in that half does not clear the upload door's own floor* — so a
      smear of the far arm's ink bleeding over the midline is not a sleeve, and
      the product says that with the sentence it already had rather than with a
      threshold somebody picked.

      Here the named half holds a REAL design and the other holds three pixels:
      the answer must be the named half, un-fallen-back. Without the floor the
      three pixels would be "the other half holds ink" and this would still
      pass — which is why the arm below is its mirror rather than its repeat.
    */
    const ink = maskWithBox(W, H, onTheLeftOfThePicture);
    for (const at of [W - 1, W + W - 1, W * 2 + W - 1]) ink.data[at] = 255;

    const asked = scopeInkMask({ ink, region: everywhere, half: "left" });
    expect(asked.half).toBe("left");
    expect(asked.fellBack).toBe(false);
    expect(asked.box).toEqual(onTheLeftOfThePicture);

    /* MIRRORED: the stray pixels are now what she named, and the real design is
       in the other half — so the fallback SHOULD fire. */
    const mirroredInk = maskWithBox(W, H, onTheRightOfThePicture);
    for (const at of [0, W, W * 2]) mirroredInk.data[at] = 255;
    const mirrored = scopeInkMask({ ink: mirroredInk, region: everywhere, half: "left" });
    expect(mirrored.fellBack, "a design in the other half was not reached over three pixels").toBe(true);
    expect(mirrored.half).toBe("right");
    expect(mirrored.box).toEqual(onTheRightOfThePicture);
  });

  it("KEEPS THE WHOLE MASK when the region finds nothing — a flash sheet has no arm in it", () => {
    /*
      THE ROW THAT MATTERS MOST HERE. The scope narrows where it can and never
      refuses on its own: an ask that names a place on HER, applied to a
      photograph of a piece of paper, finds no arm — and walling the most
      ordinary upload a tattoo customer makes on the strength of a region word
      would be the region scope deciding something `routeInkUpload` owns.
    */
    const ink = maskWithBox(W, H, onTheLeftOfThePicture);
    const noArmInThisPicture = maskWithBox(W, H, null);

    const scoped = scopeInkMask({ ink, region: noArmInThisPicture, half: "left" });
    expect(scoped.regionHeld, "an empty region narrowed the cut").toBe(false);
    expect(scoped.half, "an empty region still named a half").toBeNull();
    expect(scoped.box).toEqual(onTheLeftOfThePicture);
    expect(scoped.pixels).toBe(bigEnough.width * bigEnough.height);
  });

  it("NARROWS TO THE REGION when no side is named", () => {
    /* Two designs, and a region that holds only one of them. No side word, so
       nothing is halved — the region alone is the scope. */
    const ink = maskWithBox(W, H, onTheLeftOfThePicture);
    for (let y = onTheRightOfThePicture.top; y < onTheRightOfThePicture.top + onTheRightOfThePicture.height; y += 1) {
      for (let x = onTheRightOfThePicture.left; x < onTheRightOfThePicture.left + onTheRightOfThePicture.width; x += 1) {
        ink.data[y * W + x] = 255;
      }
    }
    const region = maskWithBox(W, H, { ...onTheLeftOfThePicture, width: onTheLeftOfThePicture.width + 2 });

    const scoped = scopeInkMask({ ink, region, half: null });
    expect(scoped.regionHeld).toBe(true);
    expect(scoped.half).toBeNull();
    expect(scoped.fellBack).toBe(false);
    expect(scoped.box).toEqual(onTheLeftOfThePicture);
  });

  it("keeps a design that STRADDLES THE MIDLINE rather than halving it", () => {
    /*
      Neither half holds a design-sized piece on its own, and the thing plainly
      exists. Halving it here would hand her one side of her own tattoo; the
      honest answer is the region's whole intersection, and the guard
      downstream decides whether that is big enough to be a design.
    */
    const across = { left: W / 2 - 100, top: 10, width: 200, height: INK_DESIGN_MIN_EDGE + 40 };
    const ink = maskWithBox(W, H, across);

    for (const half of ["left", "right"] as const) {
      const scoped = scopeInkMask({ ink, region: everywhere, half });
      expect(scoped.half, `the ${half} arm halved a design that straddles the midline`).toBeNull();
      expect(scoped.fellBack).toBe(false);
      expect(scoped.box).toEqual(across);
    }
  });
});

describe("one owner of the flip, and it inverts", () => {
  /*
    HER LEFT IS THE PICTURE'S RIGHT. Both directions asserted, because a flip
    written as an identity passes any arm that only ever checks one side —
    `image-half-not-anatomy` is this campaign's own scar and it was bought on
    exactly that shape.
  */
  it("puts her left on the picture's right, and her right on the picture's left", () => {
    expect(imageHalfOf("left")).toBe("right");
    expect(imageHalfOf("right")).toBe("left");
  });

  it("DERIVES the painting clause from the flip rather than spelling it twice", () => {
    for (const side of ["left", "right"] as const) {
      expect(imageHalfClause(side)).toBe(` (${pictureHalfPhrase(imageHalfOf(side))})`);
    }
    /* And the words themselves, pinned once — the clause is measured prose
       (`V4_SIDE_INFERENCE_COURT`) and a tidy of it is a change to a court's
       own subject. */
    expect(imageHalfClause("left")).toBe(" (on the right of the picture as you look at it)");
    expect(imageHalfClause("right")).toBe(" (on the left of the picture as you look at it)");
  });
});

describe("the padded licence canvas — the arithmetic under the pad fix", () => {
  /*
    The MEASUREMENT lives on `LICENCE_PAD_FACTOR`'s docblock; these are the two
    things arithmetic can be wrong about, and both would arrive silently.
  */
  it("doubles each edge and centres her picture in it", () => {
    expect(paddedLicenceCanvas({ width: 400, height: 300 })).toEqual({
      width: 800, height: 600, left: 200, top: 150,
    });
    /* Not square, and the two edges are not interchangeable — a transposed
       canvas would pass a square-only fixture. */
    expect(paddedLicenceCanvas({ width: 909, height: 1333 })).toEqual({
      width: 1818, height: 2666, left: 455, top: 667,
    });
  });

  it("is INTEGER everywhere, on an odd picture as well as an even one", () => {
    for (const size of [{ width: 1, height: 1 }, { width: 737, height: 981 }, { width: 3, height: 5 }]) {
      const canvas = paddedLicenceCanvas(size);
      for (const value of [canvas.width, canvas.height, canvas.left, canvas.top]) {
        expect(Number.isInteger(value)).toBe(true);
      }
      /* And her picture actually FITS with the offsets given — a canvas she
         hangs off the edge of is a licence read of a cropped person. */
      expect(canvas.left + size.width).toBeLessThanOrEqual(canvas.width);
      expect(canvas.top + size.height).toBeLessThanOrEqual(canvas.height);
    }
  });

  it("refuses a size that is not a real picture rather than inventing one", () => {
    for (const bad of [{ width: 0, height: 10 }, { width: 10, height: -1 }, { width: 1.5, height: 10 }]) {
      expect(() => paddedLicenceCanvas(bad)).toThrow(/real size/);
    }
  });
});
