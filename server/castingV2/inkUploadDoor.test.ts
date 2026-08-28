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
import { REFERENCE_INTENTS } from "../../shared/referenceIntents";
import {
  INK_DESIGNS_PER_CANDIDATE,
  INK_DESIGN_FORMATS,
  INK_DESIGN_MAX_BYTES,
  INK_DESIGN_MIN_EDGE,
  inkDesignBytesRefusal,
  inkDesignContentType,
  inkDesignKey,
  inkIntentRefusal,
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

  it("the sentence she READS names every format the door takes", () => {
    /*
      THE THIRD COPY OF THE LIST, AND THE ONLY ONE A CUSTOMER EVER SEES (#27).

      "Designs come as PNG, JPEG or WebP." is prose, so it cannot derive — the
      alternative is a machine-composed sentence, and copy this product writes
      by hand should stay written by hand. What it must not do is go stale: add
      a fourth format at the vocabulary and the refusal keeps naming three, so
      the one person who needs the list is told the old one. This arm is the
      cheap half of that — it does not write the sentence, it refuses to let the
      sentence forget a format.

      `jpeg`→JPEG, `webp`→WebP: the spelling is the copy's own and only the
      LETTERS are compared, case-insensitively, so a rewrite is free.
    */
    const refusal = inkDesignBytesRefusal({
      ...good,
      decoded: { ...good.decoded, format: "pdf" },
    });
    expect(refusal?.code).toBe("unsupportedFormat");
    for (const format of INK_DESIGN_FORMATS) {
      expect(
        refusal?.message.toLowerCase(),
        `the refusal does not name ${format} — a format was added and the sentence was not`,
      ).toContain(format.toLowerCase());
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

describe("what this reference is being taken FOR", () => {
  it("admits a tattoo declaration — the one form that is built", () => {
    expect(inkIntentRefusal(["tattoo"])).toBeNull();
  });

  it("turns down a feature whose form is ruled but not built, by name", () => {
    /*
      His catch (fable-937): a reference may be uploaded for the HAIR while the
      person in it happens to have tattoos. Hair's form is ruled — a segmented
      crop — and it is not built, so the honest answer names the feature and
      promises the money rather than accepting a declaration nothing acts on.
    */
    expect(inkIntentRefusal(["hair"])).toMatchObject({ code: "intentNotOpen" });
    expect(inkIntentRefusal(["hair"])!.message).toContain("her hair");
    expect(inkIntentRefusal(["eyeColour"])).toMatchObject({ code: "intentNotOpen" });
  });

  it("turns down an OPEN feature this door does not serve by naming its road, never by asking again", () => {
    /*
      Makeup shipped 2026-08-18 (fable-940/941) and it is a WORDS form: the
      picture is read once and dropped, so there is nothing for this door — which
      exists to keep bytes — to attach.

      The distinction is the whole point of the refusal. Before it existed, an
      open-but-elsewhere feature fell through to "Say what you're taking from
      this picture", which is the product failing to understand a correct answer.
    */
    const refusal = inkIntentRefusal(["makeup"]);
    expect(refusal).toMatchObject({ code: "intentNotThisDoor" });
    expect(refusal!.message).toContain("Her makeup");
    expect(refusal!.message).toContain("Nothing was charged");
    /* And it is NOT the sentence that reads as "you did not answer". */
    expect(refusal!.message).not.toContain("Say what you're taking");
  });

  it("turns down a mixed declaration whose other half is served elsewhere", () => {
    /* `[tattoo, makeup]` taken here would deliver the tattoo and silently drop
       the makeup — the same partial take the closed check refuses, arriving by a
       different route. */
    const refusal = inkIntentRefusal(["tattoo", "makeup"]);
    expect(refusal).toMatchObject({ code: "intentNotThisDoor" });
    expect(refusal!.message).toContain("Her makeup");
  });

  it("turns down a mixed declaration on the unbuilt half, not on the built one", () => {
    /* Multi-intent is legal and each form runs independently, so a declaration
       is only as open as its least-open member. Naming the closed one is what
       stops "we took part of it" being a silent outcome. */
    const refusal = inkIntentRefusal(["tattoo", "hair"]);
    expect(refusal).toMatchObject({ code: "intentNotOpen" });
    expect(refusal!.message).toContain("her hair");
  });

  it("refuses a declaration that is empty — no intent is the amendment's own line", () => {
    /* Every declaration with something recognisable in it is now answered above,
       by name and by road. What is left for this refusal is the genuinely empty
       one, which is the only case where "say what you're taking" is true. */
    expect(inkIntentRefusal([])).toMatchObject({ code: "intentMissing" });
  });

  it("refuses the same feature declared twice", () => {
    /* A set, not a list. Two of the same intent would be counted twice by the
       demand tally this field exists to feed. */
    expect(inkIntentRefusal(["tattoo", "tattoo"])).toMatchObject({ code: "intentRepeated" });
  });

  it("reads the vocabulary rather than keeping a copy of it", () => {
    /* Law 4 again: every member of the shared vocabulary is answerable here,
       with no list in this file to fall behind. */
    for (const intent of REFERENCE_INTENTS) {
      expect(() => inkIntentRefusal([intent])).not.toThrow();
    }
  });
});

describe("the cap", () => {
  it("is a named number, small, and stated once", () => {
    expect(INK_DESIGNS_PER_CANDIDATE).toBe(8);
  });
});
