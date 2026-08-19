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
import { describe, expect, it } from "vitest";

import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import {
  INK_REGION,
  PERSON_REGION,
  cropClearsMinimumEdge,
  cutOutPixels,
  extentOf,
  routeInkUpload,
} from "./inkReferenceCrop";
import type { Mask } from "./maskedComposite";

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
});
