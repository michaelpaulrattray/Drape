/**
 * DOES ONE CUT-OUT SHAPE COVER ANOTHER — one statement of the question his
 * amendment of 2026-10-30 asks about a garment and a face.
 *
 * # Why this is a module and not a helper in its caller
 *
 * His ruling (#2856, check 1) says a piece of an outfit earns its place only
 * when its box is *not over the face*, and his amendment the same hour says
 * which measurement that is, verbatim: *"im not worried about the box covering
 * the neck that sort of normal if its the outfit or whatever"*. So the
 * rectangle is never the question — a scarf, a high collar, a hood or a rag
 * cloth will all have a rectangle that reaches the chin, and all of them are
 * outfit. **What fails is a cut-out SHAPE lying over the face's own features**,
 * the skin a refine would then repaint.
 *
 * ⚠ **This is NOT a second copy of `onTheFace` and must not be collapsed into
 * one.** That rule asks *where is this thing's centre* against the face's
 * extent, and it is the right question for a found body part. This one asks
 * *how much of that cut is underneath this one*, which is a pixel fact and the
 * only thing that answers his amendment. Two sentences, two callers, neither
 * derivable from the other.
 *
 * ⚠ **It imports NOTHING, deliberately** — the same reason `faceExtent` does
 * not: its caller (`faceScanService`) already drags sharp, the fal transport
 * and the census behind it, and a rule that may later be wanted by the pure
 * panel has to be reachable without any of that. There is no image decoding
 * here; a `Mask` is already raw bytes by the time anybody can ask.
 */

/** One full-frame binary mask, exactly `maskedComposite`'s own shape. */
export type CoverageMask = {
  data: Buffer;
  width: number;
  height: number;
};

/**
 * HOW MUCH OF `under` LIES BENEATH `over` — a share of `under`'s own pixels,
 * from 0 to 1, and `0` when `under` has no pixels at all.
 *
 * Both masks are read at the SAME frame, which is checked rather than assumed:
 * two masks of different sizes are two pictures, and comparing them pixel for
 * pixel would silently answer about the wrong part of the body. A disagreement
 * returns 0 rather than throwing, because a panel row is not worth losing to
 * it and the caller logs — but it can never return a COVERING verdict from a
 * comparison it could not make.
 */
export function coveredShare(under: CoverageMask, over: CoverageMask): number {
  if (under.width !== over.width || under.height !== over.height) return 0;
  let beneath = 0;
  let total = 0;
  const end = Math.min(under.data.length, over.data.length);
  for (let at = 0; at < end; at += 1) {
    if (under.data[at] === 0) continue;
    total += 1;
    if (over.data[at] !== 0) beneath += 1;
  }
  return total === 0 ? 0 : beneath / total;
}

/**
 * IS THE FACE'S OWN CUT MOSTLY UNDERNEATH THIS SHAPE — the line, and there is
 * no tuned number in it.
 *
 * A majority: more of that face row's cut is under the garment than is not.
 * That is the same kind of line `onTheFace` draws — the face measured against
 * itself rather than against a constant somebody chose — and it is the one
 * threshold that cannot be argued down a percentage point at a time. A face
 * mask or a full-face wrap takes nearly all of the lips' cut; a high collar
 * grazing the chin takes a sliver of it. Nothing in between is a case anybody
 * has measured, so nothing in between is legislated for.
 *
 * ⚠ **It answers about ONE face row at a time on purpose.** Asked of the whole
 * face at once, a garment covering the mouth completely would still be a small
 * share of all the face's cuts together and would pass — which is the defect,
 * not the rule.
 */
export const COVERED_SHARE = 0.5;

/**
 * DOES THIS SHAPE COVER ANY OF THE FACE'S OWN CUTS (his amendment, #2856).
 *
 * `faceCuts` is every face-group row this scan actually cut — derived from the
 * catalogue's own `group`, never a list of nouns written here, so a face row
 * added to the catalogue is asked about on the day it is added.
 */
export function coversAFaceCut(
  shape: CoverageMask,
  faceCuts: readonly CoverageMask[],
): boolean {
  return faceCuts.some((cut) => coveredShare(cut, shape) > COVERED_SHARE);
}
