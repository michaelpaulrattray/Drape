/**
 * The upload's doors, driven directly.
 *
 * Every rule here is a refusal, and a refusal proved only by handing it legal
 * input is not proved at all (working law 3). So each door gets both arms: the
 * input it must refuse, and the closest input to it that must pass.
 *
 * The two doors that CANNOT fire on today's data are declared rather than
 * discovered — the framing gate (all three placements are in frame on the
 * master) and the released gate (which is not here at all, ruled fable-932 §2).
 * Both are driven where a refusal IS reachable.
 */
import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { INK_SIDES, everyInkTuple } from "../../shared/inkReleasedPlacements";
import {
  INK_DESIGNS_PER_CANDIDATE,
  INK_DESIGN_FORMATS,
  INK_DESIGN_MAX_BYTES,
  INK_DESIGN_MIN_EDGE,
  inkDesignBytesRefusal,
  inkDesignContentType,
  inkDesignKey,
  inkPlacementRefusal,
} from "./inkUploadDoor";

describe("where a design may be attached", () => {
  it("admits every tuple the vocabulary can express, on the frame a Cast has", () => {
    for (const tuple of everyInkTuple()) {
      expect(inkPlacementRefusal({ ...tuple, framing: "master" })).toBeNull();
    }
  });

  it("refuses a side the placement does not have — in both directions", () => {
    /* An upper arm is a PAIR, so it is never `centre`; a neck is one thing, so
       it is never left or right. Both halves, because a rule that only refuses
       the absent side would let the other one through. */
    expect(inkPlacementRefusal({ placement: "upperArm", side: "centre", framing: "master" }))
      .toMatchObject({ code: "sideNotOnPlacement" });
    expect(inkPlacementRefusal({ placement: "neck", side: "left", framing: "master" }))
      .toMatchObject({ code: "sideNotOnPlacement" });
    expect(inkPlacementRefusal({ placement: "upperChest", side: "right", framing: "master" }))
      .toMatchObject({ code: "sideNotOnPlacement" });

    expect(inkPlacementRefusal({ placement: "upperArm", side: "left", framing: "master" })).toBeNull();
    expect(inkPlacementRefusal({ placement: "neck", side: "centre", framing: "master" })).toBeNull();
  });

  it("admits the covered case rather than refusing it (fable-932 §3)", () => {
    /* `upperChest` is `dependsOnGarment`, and at upload nobody knows the
       garment: the design is a fact about the CAST, the garment a fact about a
       FRAME. Refusing here would refuse the scoop-neck case the reading
       measured as available. The occlusion door answers it per render. */
    expect(inkPlacementRefusal({ placement: "upperChest", side: "centre", framing: "master" })).toBeNull();
  });

  it("refuses a placement the camera did not take — where the refusal is reachable", () => {
    /*
      THE FRAMING GATE REFUSES NOTHING TODAY on the master, exactly as the
      vocabulary module's header declares. Its refusal is reachable on other
      framings the product can produce, and that is where it is driven — both
      arms on ONE framing, so the control is the gate and not the picture:
      `frontClose` is a head-and-shoulders portrait, so her neck is in it and
      her upper arm is not.
    */
    expect(inkPlacementRefusal({ placement: "neck", side: "centre", framing: "frontClose" })).toBeNull();
    expect(inkPlacementRefusal({ placement: "upperArm", side: "left", framing: "frontClose" }))
      .toMatchObject({ code: "outOfFrame" });
  });

  it("has a vocabulary and a side list it does not restate", () => {
    /* Law 4: the door reads the shared tables rather than keeping copies. If a
       fourth placement is ever measured into the vocabulary, this test starts
       covering it without being edited. */
    expect(INK_PLACEMENTS.length).toBeGreaterThan(0);
    expect(everyInkTuple().length).toBe(
      INK_PLACEMENTS.reduce((total, placement) => total + (placement === "upperArm" ? 2 : 1), 0),
    );
    expect(INK_SIDES).toContain("centre");
  });
});

describe("what may be uploaded as a design", () => {
  const good = { byteSize: 40_000, decoded: { format: "png", width: 1024, height: 1024 } };

  it("admits an ordinary picture", () => {
    expect(inkDesignBytesRefusal(good)).toBeNull();
  });

  it("refuses bytes that are not a picture at all", () => {
    expect(inkDesignBytesRefusal({ byteSize: 40_000, decoded: null }))
      .toMatchObject({ code: "unreadable" });
  });

  it("judges the format by what the BYTES are, never by what was claimed", () => {
    /* The only format field this function has is the DECODED one — the caller
       has no way to hand it a claim. That is the door: a `.png` filename over
       a PDF is a PDF here. */
    expect(inkDesignBytesRefusal({ ...good, decoded: { ...good.decoded, format: "pdf" } }))
      .toMatchObject({ code: "unsupportedFormat" });
    for (const format of INK_DESIGN_FORMATS) {
      expect(inkDesignBytesRefusal({ ...good, decoded: { ...good.decoded, format } })).toBeNull();
    }
  });

  it("refuses a picture with no dimensions read", () => {
    expect(inkDesignBytesRefusal({ ...good, decoded: { format: "png", width: 0, height: 0 } }))
      .toMatchObject({ code: "tooSmall" });
  });

  it("holds its size bounds at the boundary, not near it", () => {
    expect(inkDesignBytesRefusal({ ...good, byteSize: INK_DESIGN_MAX_BYTES })).toBeNull();
    expect(inkDesignBytesRefusal({ ...good, byteSize: INK_DESIGN_MAX_BYTES + 1 }))
      .toMatchObject({ code: "tooLarge" });

    const edge = { format: "png", width: INK_DESIGN_MIN_EDGE, height: INK_DESIGN_MIN_EDGE };
    expect(inkDesignBytesRefusal({ ...good, decoded: edge })).toBeNull();
    expect(inkDesignBytesRefusal({ ...good, decoded: { ...edge, height: INK_DESIGN_MIN_EDGE - 1 } }))
      .toMatchObject({ code: "tooSmall" });
  });

  it("names an object under one prefix, with a name nothing can guess", () => {
    const first = inkDesignKey("png");
    const second = inkDesignKey("png");
    expect(first).toMatch(/^casting-v2\/ink\/[0-9a-f-]{36}\.png$/);
    expect(second).not.toBe(first);
    expect(inkDesignKey("jpeg")).toMatch(/\.jpg$/);
    expect(inkDesignContentType("webp")).toBe("image/webp");
  });
});

describe("the cap", () => {
  it("is a named number, small, and stated once", () => {
    expect(INK_DESIGNS_PER_CANDIDATE).toBe(8);
  });
});
