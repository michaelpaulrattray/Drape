/**
 * THE COMPARE'S "BEFORE" IS THE VERSION THE EDIT WAS APPLIED TO.
 *
 * The founder found the defect (fable-1437, his words): the hold-to-compare
 * *"only shows the previous thumbnail version before it not necesarily the
 * version you edited from which could have been 2 versions ago which you forked
 * from."*
 *
 * `rail[position - 1]` is a DISPLAY ACCIDENT. Fork from two versions back and
 * the compare holds up a frame that was never this edit's before — silently
 * mis-answering the one question the gesture exists to answer. The record has
 * always held the right answer on `parentVariantId`.
 *
 * The forked case is the arm that matters and it is written first: an edit
 * applied to v[n-2] must compare against v[n-2] and NOT v[n-1]. Both halves are
 * asserted, because a derivation that returned the right url for the wrong
 * reason — or that simply returned everything — would pass on one of them.
 */
import { describe, expect, it } from "vitest";

import { viewerCompareFor, type CompareRow } from "./viewerCompare";

const ORIGINAL = "https://example.test/master.png";

/** v1 ← v2, and v3 FORKED from v1 — the founder's own shape. */
const forked: CompareRow[] = [
  { variantId: "v1", imageUrl: "https://example.test/v1.png", parentVariantId: null },
  { variantId: "v2", imageUrl: "https://example.test/v2.png", parentVariantId: "v1" },
  { variantId: "v3", imageUrl: "https://example.test/v3.png", parentVariantId: "v1" },
];

describe("the compare's before", () => {
  it("⚠ a FORKED edit compares against the version it was made from, not its rail neighbour", () => {
    /* THE DEFECT, by its own shape. v3 sits next to v2 on the rail and was made
       from v1. Before this, the gesture held up v2 — a frame v3 never touched. */
    const compare = viewerCompareFor({
      rail: forked,
      shownVariantId: "v3",
      originalImageUrl: ORIGINAL,
    });

    expect(compare?.url, "the frame this edit was actually applied to").toBe(
      "https://example.test/v1.png",
    );
    expect(compare?.url, "NOT the rail neighbour").not.toBe("https://example.test/v2.png");
  });

  it("an ordinary in-line edit still compares against the one before it", () => {
    /* POSITIVE CONTROL for the common case: the fix must not change the answer
       where rail adjacency and parentage happen to agree, which is most of the
       time and is why the defect survived. */
    const compare = viewerCompareFor({
      rail: forked,
      shownVariantId: "v2",
      originalImageUrl: ORIGINAL,
    });
    expect(compare?.url).toBe("https://example.test/v1.png");
  });

  it("a first edit compares against the master", () => {
    const compare = viewerCompareFor({
      rail: forked,
      shownVariantId: "v1",
      originalImageUrl: ORIGINAL,
    });
    expect(compare).toEqual({ url: ORIGINAL, label: "Original" });
  });

  it("⚠ a parent that is NOT on the rail shows nothing — not a neighbour, not the master", () => {
    /*
      The third answer, and the one a careless fix gets wrong in two different
      directions. A superseded or pruned parent has a frame we cannot show;
      falling back to the neighbour is the original defect, and falling back to
      the MASTER is a different lie — it would say this edit was made from the
      original when it was not.
    */
    const compare = viewerCompareFor({
      rail: [
        { variantId: "v2", imageUrl: "https://example.test/v2.png", parentVariantId: "v1" },
        { variantId: "v3", imageUrl: "https://example.test/v3.png", parentVariantId: "gone" },
      ],
      shownVariantId: "v3",
      originalImageUrl: ORIGINAL,
    });
    expect(compare).toBeNull();
  });

  it("a row landed before the field existed carries no parent and reads as the master", () => {
    /* `parentVariantId` is optional on the type for exactly this: every row
       delivered before the column existed answers null, and null is the master.
       The alternative — treating absent as "unknown, show nothing" — would take
       the gesture away from every old version at once. */
    const compare = viewerCompareFor({
      rail: [{ variantId: "v9", imageUrl: "https://example.test/v9.png" }],
      shownVariantId: "v9",
      originalImageUrl: ORIGINAL,
    });
    expect(compare).toEqual({ url: ORIGINAL, label: "Original" });
  });

  it("shows nothing when the shown version is not in the payload at all", () => {
    expect(
      viewerCompareFor({ rail: forked, shownVariantId: "v99", originalImageUrl: ORIGINAL }),
    ).toBeNull();
    expect(
      viewerCompareFor({ rail: forked, shownVariantId: null, originalImageUrl: ORIGINAL }),
    ).toBeNull();
  });

  it("shows nothing for a first edit when there is no master frame to show", () => {
    /* NEGATIVE CONTROL for the master branch: a candidate whose own image key
       is missing must not produce a compare with an empty url. */
    expect(
      viewerCompareFor({
        rail: [{ variantId: "v1", imageUrl: "u", parentVariantId: null }],
        shownVariantId: "v1",
        originalImageUrl: null,
      }),
    ).toBeNull();
  });
});
