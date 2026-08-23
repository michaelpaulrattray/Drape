/**
 * WHAT THE HOLD-TO-COMPARE HOLDS UP AGAINST THE PICTURE.
 *
 * The gesture's whole meaning is before/after of ONE edit, so its "before" must
 * be the version that edit was actually applied to.
 *
 * ⚠ **IT USED TO BE THE VERSION NEXT TO IT ON THE RAIL** — the strip index one
 * to the left — and rail adjacency is a display accident. The founder found it
 * (fable-1437,
 * his words): *"only shows the previous thumbnail version before it not
 * necesarily the version you edited from which could have been 2 versions ago
 * which you forked from."* Fork from two versions back and the compare showed a
 * frame that was never this edit's before, silently mis-answering the one
 * question the gesture exists to answer.
 *
 * The record has always held the right answer: `parentVariantId` on every
 * variant row. This reads it.
 *
 * # THE THREE ANSWERS, and the third is the one worth defending
 *
 *   no parent          the master. The honest before for a first edit, and the
 *                      shape the old code already got right at `position === 0`.
 *   parent on the rail its frame, wherever it sits — adjacent or five back.
 *   parent NOT on the  **NO COMPARE.** The frame exists and is not shown (a
 *   rail               superseded take, a pruned version), and there is no
 *                      honest picture to hold up. Substituting a neighbour is
 *                      precisely the defect; substituting the MASTER would be a
 *                      different lie — it would say this edit was made from the
 *                      original when it was not. The old code already reasons
 *                      this way one case over: *"No previous is the honest
 *                      answer, not the head of a list it is not in."*
 *
 * Pure and exported so it can be driven directly: the derivation used to live
 * inline in `CastingSheet.tsx`, where nothing could reach it.
 */

export type CompareRow = {
  readonly variantId: string;
  readonly imageUrl: string | null;
  /** Null on a first edit, and on every row landed before the field existed. */
  readonly parentVariantId?: string | null;
};

export type ViewerCompareChoice = {
  readonly url: string;
  readonly label: string;
};

export function viewerCompareFor(input: {
  readonly rail: readonly CompareRow[];
  readonly shownVariantId: string | null;
  readonly originalImageUrl: string | null;
}): ViewerCompareChoice | null {
  const { rail, shownVariantId, originalImageUrl } = input;
  if (shownVariantId === null) return null;

  const shown = rail.find((row) => row.variantId === shownVariantId);
  /* Not in the list at all: a version that landed since this payload, or one
     already pruned. No before is the honest answer. */
  if (!shown) return null;

  const parent = shown.parentVariantId ?? null;
  if (parent === null) {
    return originalImageUrl ? { url: originalImageUrl, label: "Original" } : null;
  }

  const from = rail.find((row) => row.variantId === parent);
  /* THE THIRD ANSWER. A parent that is named and not on the rail has a frame we
     cannot show, and neither the neighbour nor the master is that frame. */
  if (!from?.imageUrl) return null;
  return { url: from.imageUrl, label: "Before this edit" };
}
