/**
 * THE BYTES DOOR, DRIVEN DIRECTLY.
 *
 * Every rule here is a refusal, and a refusal proved only by handing it legal
 * input is not proved at all (working law 3). So each door gets both arms: the
 * input it must refuse, and the closest input to it that must pass.
 *
 * ⚠ **TWO WHOLE describes LEFT WITH THEIR SUBJECTS** (#1158 slice 4e) — the
 * placement door and the intent door were the retired studio upload's, and
 * arms kept after their function is deleted are the
 * `directory-population-loses-promoted-subject` shape: green, and checking
 * nothing. §8c's question was asked of each first — *which of these were
 * proving LIVE code through a dead function?* — and the answer was none: the
 * two law-4 arms drove the door's reading of the shared vocabularies, and both
 * vocabularies keep their own suites (`inkPlacementVocabulary.test.ts`,
 * `referenceIntents.test.ts`), so nothing live lost its only cover.
 *
 * What is left drives the door the LIVE reference road still calls:
 * `referenceAttachDoor` asks `inkDesignBytesRefusal`, `inkReferenceMint` asks
 * `inkDesignKey`, and the cap arm pins the number three surviving consumers
 * read from here.
 */
import { describe, expect, it } from "vitest";

import {
  INK_DESIGNS_PER_CANDIDATE,
  INK_DESIGN_FORMATS,
  INK_DESIGN_MAX_BYTES,
  INK_DESIGN_MIN_EDGE,
  inkDesignBytesRefusal,
  inkDesignContentType,
  inkDesignKey,
} from "./inkUploadDoor";

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

  it("admits no format that can carry a script — the sentence two SERVING routes rest on", () => {
    /*
      THE ONE THING THE MOVE CHANGED THAT IS NOT ABOUT CONVENIENCE (#27, review
      of PR #189, finding 2).

      Before the vocabulary was shared, `referenceDelivery.ts` — the route that
      hands a customer back her OWN photograph — kept its own typed list of what
      it would serve, so adding a format at the door did not widen it until
      somebody consciously edited that line. Deriving it is the correct law-4
      shape and it is what the PR did, but it means the route's own surviving
      sentence — "there is no script-in-an-image question to answer here because
      none of the three can carry one" — stopped being a claim about three named
      mimes and became a claim about WHATEVER THIS LIST HOLDS, with nothing
      arming it.

      This is that arm, and it lives with the vocabulary rather than in either
      route, because both routes derive from here and a guard in one of them
      would leave the other resting on prose. `svg` is the specimen: an SVG is a
      document that executes, and it is the format a well-meaning "customers
      keep asking for it" commit would add without meeting this sentence.

      A format arriving here needs a decoder to learn it too, so the risk today
      is nil — that is exactly why this is worth pinning now rather than after.
    */
    const CAN_CARRY_A_SCRIPT = ["svg", "svg+xml", "xml", "html"];
    for (const format of INK_DESIGN_FORMATS) {
      expect(
        CAN_CARRY_A_SCRIPT,
        `${format} executes — two delivery routes serve this list under a sentence saying nothing here can`,
      ).not.toContain(format);
    }
    /* The control: the ban is asked of a list that has instances to ban. */
    expect(INK_DESIGN_FORMATS.length).toBeGreaterThan(0);
    expect(CAN_CARRY_A_SCRIPT).toContain("svg");
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

describe("the cap", () => {
  it("is a named number, small, and stated once", () => {
    expect(INK_DESIGNS_PER_CANDIDATE).toBe(8);
  });
});
