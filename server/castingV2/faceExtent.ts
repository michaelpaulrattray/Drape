/**
 * THE FACE AS ITS OWN MEASURE — one statement of "is this thing on the face",
 * shared by the two roads that ask it.
 *
 * # Why this is a module and not a helper in either caller
 *
 * Two roads ask the same question about different measuring sticks:
 *
 *   THE READER   `falRegionReader` asks it of one connected piece of a
 *                segmenter's answer, against the face read SAM 3 returned
 *                (#2844, his eye round 10: an eye on an arm tattoo is not the
 *                cast's eye).
 *   THE PANEL    `facePanel` asks it of a found body part, against the extent
 *                of the face rows the scan actually drew (#2840 / #2807 part 1:
 *                a collarbone is not a Face row).
 *
 * The construction is the same sentence in both, and a second statement of it
 * would be working law 4 exactly — a copy that drifts from its source. So it
 * lives once, here.
 *
 * ⚠ **CHANGING THIS RULE CHANGES WHAT A SCAN CUTS, SO IT OWES A VERSION BUMP —
 * `FACE_CUT_RULES_VERSION` in `server/db/castingV2FaceScans.ts` (#2890).**
 * Without it the new rule reaches every future scan and not one face that has
 * already been read: a kept reading is served back verbatim, and until #2890
 * the only thing that could ever invalidate one was the picture's own bytes
 * moving. That is not theoretical — it is how seven production readings came to
 * be serving an eye cut this very rule had already learnt to drop, two of them
 * on signed casts, for a day after the repair shipped. **The bump is owed by
 * hand and nothing can enforce it**: a fingerprint over this file's bytes would
 * re-scan every face on a comment edit, which is the tax #1307 removed from the
 * architecture map, so what guards it is this sentence and the constant's own.
 *
 * ⚠ **This module imports NOTHING, deliberately.** `facePanel` is a pure
 * projection — *"rows in, rows out: no database, no storage, no clock"* — and
 * the reader's own home pulls `sharp`, the fal transport and the census. A
 * rule both can share has to be reachable without dragging either one's world
 * behind it, which is why it is not in `maskGeometry` (sharp) and no longer in
 * `falRegionReader` (the provider).
 */

/**
 * A FACE'S OWN SPAN — its edges, and the middle of each axis.
 *
 * `midline` and `middle` are given rather than derived from the edges because
 * the reader's come off the face read that the side-splitting already used,
 * and that is not always the box's centre. A caller measuring from a plain
 * rectangle passes its centre for both, which is the same thing said of a
 * shape that has no better answer.
 */
export type FaceExtent = {
  midline: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  middle: number;
};

/**
 * IS A THING CENTRED HERE ON THE FACE (#2844) — no farther outside the face
 * read's extent, on either axis, than that axis's middle is inside it.
 *
 * Read across, that is `atTheSide`'s own construction turned outward (it lives
 * in `falRegionReader`, which is the other caller): a piece beyond the face's
 * edge is still the face's when it is no farther past that edge than the edge
 * is from the face's middle. Read down, the same sentence with the face's top,
 * bottom and middle row. A tie is kept, for `atTheSide`'s reason. Both bounds
 * come off the one face read, so nothing here is tuned: the face is its own
 * measure.
 */
export function onTheFace(centreX: number, centreY: number, face: FaceExtent): boolean {
  const across = centreX < face.left
    ? face.left - centreX <= face.midline - face.left
    : centreX > face.right
      ? centreX - face.right <= face.right - face.midline
      : true;
  const down = centreY < face.top
    ? face.top - centreY <= face.middle - face.top
    : centreY > face.bottom
      ? centreY - face.bottom <= face.bottom - face.middle
      : true;
  return across && down;
}
