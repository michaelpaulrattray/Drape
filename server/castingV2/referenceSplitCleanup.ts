/**
 * HIS OWED CLEAN-UP ON THE SPLIT — #14 slice 3a, the spotlight's geometry half.
 *
 * **His obligation, verbatim** (recorded in the build design's §0, 2026-10-31):
 * *"Whoever builds slice 3 owes that clean-up as part of the split, measured on
 * the court's fixtures."* It is the no-extra-call post-process his own
 * prototype carries, and it answered his question at the frame — **why did the
 * jacket light part of the scarf?** The spotlight court's own eye note says what
 * it is fixing: *"Its pieces are noisier, though. The jacket piece carries red
 * blotches out onto the scarf, the background splits into speckles."* The raw
 * masks speckle on textured knits, and one grid point's mask leaks onto the
 * neighbouring piece.
 *
 * # WHAT IT IS, IN HIS THREE RULES AND NOTHING MORE
 *
 * Quoted from §0 so a later reader can see the spec rather than infer it from
 * the code: *"keep each piece's main body (components of at least 10% of its
 * largest); give a pixel two pieces claim to the one it sits deeper inside;
 * fill holes under 2% of the piece"*.
 *
 * Three rules, three numbers, and **no fourth rule invented here**. The hover
 * set's other two drops — a piece too tiny to be a thing, and the whole-person
 * piece — are §6's and the caller's: the face rule needs detected face boxes,
 * which is a provider reading and not geometry, so it lives with the
 * orchestrator and `subtractFaces` rather than in this module. What this module
 * owns is pure: masks in, masks out, no network, no provider, no clock.
 *
 * # ⚠ THE ORDER IS LOAD-BEARING, AND IT WAS MEASURED WRONG ONCE
 *
 * Main body → fill holes → the face rule → arbitrate contested pixels → drop
 * what is left empty.
 *
 * ⚠ **THE FACE RULE MUST RUN BEFORE THE CONTEST, AND THE FIRST BUILD HAD IT
 * AFTER — the court's own fixtures caught it (#14 slice 3a, 2026-10-31).**
 * Replaying the saved split of the WORN photograph through an arbitration that
 * ran before the whole-person piece was dropped: **the tank top went from IoU
 * 0.992 to 0.358 and the hair from 0.935 to 0.207**, and garment-level coverage
 * over the three fixtures fell from 7 of 9 to 5 of 9. The cause is structural
 * rather than a tuning accident — **the whole-person piece CONTAINS the
 * garment, so at every pixel of the tank top it is the deeper of the two** and
 * wins the contest outright. A spotlight built that way would light a person
 * and erase the garment on exactly the kind of photograph a customer uploads
 * most. §6 says the whole-person piece is dropped from the hover set entirely;
 * dropping it FIRST is what stops it taking the garment with it, and the rule
 * lives inside this function rather than in the caller so the order cannot be
 * got wrong from outside.
 *
 * ⚠ **AND THE HOLES MUST BE FILLED BEFORE THE FACE IS SUBTRACTED, WHICH IS A
 * FENCE AND NOT A PREFERENCE.** Subtracting a face box out of the middle of a
 * piece can leave an enclosed hole where the face was; a fill running after
 * that would put the face BACK, under a rule whose whole purpose is that a face
 * never lights. Filling first means nothing the face rule removes can be
 * restored by it.
 *
 * The middle pair is the next one worth explaining, because the obvious order
 * is wrong there too:
 *
 * **Filling a hole can swallow a neighbour.** If the scarf sits in a gap in the
 * jacket's mask, that gap is an enclosed hole to the jacket — so a fill that
 * ran AFTER arbitration would hand the jacket pixels the scarf had already
 * won, with nothing left to take them back. Filling FIRST and arbitrating
 * AFTER makes the arbitration the safety net: wherever a filled hole now
 * overlaps a real neighbour, the neighbour keeps the pixels it is deeper
 * inside. {@link SPLIT_HOLE_SHARE} bounds the damage either way — only holes
 * under 2% of the piece are filled at all — but the ordering is what makes
 * that bound a floor rather than a hope.
 *
 * ⚠ **Main body runs FIRST for the mirror reason**: a leaked blotch is a small
 * component of the piece that leaked, and arbitrating before it is dropped
 * would make the blotch contest pixels it has no business claiming — the
 * neighbour would usually win, but a blotch sitting in the middle of a thin
 * neighbour can be the deeper of the two. Dropping it first means the contest
 * is only ever between two pieces' real bodies.
 *
 * # "DEEPER INSIDE" IS A DISTANCE TO THE PIECE'S OWN EDGE
 *
 * A pixel's depth in a piece is its distance to that piece's boundary, by a
 * two-pass chamfer transform — the same measure the court used to pick a point
 * to tap, so the split and the tap agree about what "inside" means. A pixel two
 * pieces claim goes to whichever piece it is deeper inside; a tie keeps it in
 * the LARGER piece, because the alternative on a tie is to drop it from both
 * and punch a hole in a garment nobody asked about.
 *
 * ⚠ **Depth is computed per piece inside its own bounding box, and the running
 * best is kept in two frame-sized arrays rather than one map per piece.** A
 * 32-piece split of a 1536x1024 photograph is 201 MB of `Float32Array` if every
 * piece keeps its own full-frame depth map, which is the shape a first draft
 * reaches for; the running best-depth / winner pair is 9 MB whatever the piece
 * count.
 *
 * # WHAT IT MEASURES AT, ON HIS THREE FIXTURES — and the one thing it COSTS
 *
 * Replayed against the court's own saved split masks (zero provider calls for
 * the geometry; one `detect` per fixture for the face boxes), 121–502 ms per
 * photograph:
 *
 * - ✅ **His question at the frame is answered.** The jacket's leak onto the
 *   scarf — *"why did the jacket light part of the scarf"* — goes from **25,449
 *   px, 30.8% of the scarf, to 29 px (0.0%)**, and the jacket's own agreement
 *   with its true cut rises **0.909 → 0.992**. On the product shot the
 *   sneaker's leak onto the belt goes 63 px → 0.
 * - ✅ **The whole-person leak is gone outright**: the piece that used to light
 *   the tank top, the hair, the earring and the necklace together held **100%
 *   of the tank top**; it now holds none of it, because it is not in the hover
 *   set at all.
 * - ✅ Garment-level coverage (IoU ≥ 0.75 against the true cut) over the nine
 *   things is **7 before → 6 after**, and the one it loses is named next.
 * - ⚠ **THE COST, STATED RATHER THAN BURIED: the HAIR's hover region shrinks,
 *   0.935 → 0.503.** Hair frames a face, so a rectangular face box subtracted
 *   out of the hair piece takes the hair inside that rectangle with it — what
 *   lights on hover is the hair OUTSIDE the box. **This is §6 working as
 *   written, not a defect in it** (*"every split piece has detected face boxes
 *   subtracted in its mask"*, and the same subtraction is what kills the skin
 *   specks the court saw at that piece's edge). It is recorded here because it
 *   is a surface decision for slice 3b and his eye, and because the tempting
 *   repair — exempting hair from the subtraction, or trimming the box to the
 *   face's mask — is a change to the likeness fence and is **his**, never a
 *   builder's.
 * - The small jewellery is unchanged and still absent from the split (the
 *   necklace has no piece of its own at all now that the person piece is gone),
 *   which is §0's hazard 1: a tap finds it, hover cannot.
 */
import { closeHoles } from "./cutQuality";
import { keepPiecesWhere } from "./falRegionReader";
import type { Mask } from "./maskedComposite";
import type { PointerBox } from "./maskedRefine";
import { subtractFaces } from "./referenceTake";

/**
 * A COMPONENT IS PART OF THE PIECE'S MAIN BODY AT A TENTH OF ITS LARGEST.
 *
 * His number, from §0 — *"components of at least 10% of its largest"*. It is
 * his and is not re-derived here; what the measurement on the court's fixtures
 * reports is what it COSTS and what it saves, never a tuned replacement.
 */
export const SPLIT_MAIN_BODY_SHARE = 0.1;

/**
 * A HOLE UNDER A FIFTIETH OF THE PIECE IS FILLED, AND A BIGGER ONE IS LEFT.
 *
 * His number, from §0 — *"fill holes under 2% of the piece"*. The asymmetry is
 * the point: an anti-aliasing stipple is noise and a torn middle is a fact
 * about the cut, and `closeHoles`' own docblock already says those are
 * different defects.
 */
export const SPLIT_HOLE_SHARE = 0.02;

/**
 * A PIECE HOLDING THIS MUCH OF A DETECTED FACE IS THE PERSON, AND A PERSON IS
 * NOT A TAKEABLE THING (§6's hover-set rule).
 *
 * ⚠ **MEASURED ON THE COURT'S WORN FIXTURE, NOT CHOSEN** (#14 slice 3a,
 * 2026-10-31; the cell is `scripts/_14-split-cleanup-measure-disposable.mts`,
 * and the face box is the production `TAKE_FACE_NOUN` detect on the real
 * photograph — one box, `287,164 302x416`).
 *
 * Of the 18 pieces the split returned, **eight hold any of the face box at
 * all**, and this is their whole distribution:
 *
 *     99.7%  65.6%  64.1%  58.5%  |  34.0%  31.2%  0.1%  0.1%
 *
 * **The widest gap in it is between 58.5% and 34.0% — 24.5 points — and a half
 * sits inside that gap.** Four pieces are the person at some crop (whole body,
 * head and shoulders, upper body) and leave the hover set; the two at 34.0% and
 * 31.2% are the hair and the tank top, which stay and have the box subtracted
 * out of them instead.
 *
 * ⚠ **AN EARLIER DRAFT OF THIS BLOCK CLAIMED A 78-POINT GAP BETWEEN 99.9% AND
 * 22.0%, AND THAT WAS WRITTEN BEFORE THE DETECT WAS BOUGHT.** It was wrong in
 * the direction that flatters the rule — a clean two-cluster split where the
 * real reading is a gradient with four pieces in the 58–100 band. The bar still
 * lands in the widest gap, so the number did not move; what moved is whether
 * anybody could check it. **The distribution above is the thing to re-read if
 * this ever misfires, not the constant.**
 */
export const SPLIT_FACE_COVER_SHARE = 0.5;

/** Why a piece is not in the cleaned split, for the log and the measurement. */
export type SplitDropReason = "empty" | "lost-to-neighbours" | "covers-a-face";

/** One piece that did not survive, with the number that decided it. */
export type DroppedSplitPiece = { at: number; reason: SplitDropReason };

/** What the clean-up did, carrying every number it used. */
export type CleanedSplit = {
  /** The surviving pieces, in the order they arrived. */
  pieces: Mask[];
  /** Which arriving pieces did not survive, and why. */
  dropped: DroppedSplitPiece[];
  /** Components dropped as not-the-main-body, summed over every piece. */
  fragmentsDropped: number;
  /** Pixels those components held. */
  fragmentPixels: number;
  /** Holes filled, summed over every piece. */
  holesFilled: number;
  /** Pixels those holes held. */
  holePixels: number;
  /** Pixels that two or more pieces claimed. */
  contestedPixels: number;
  /** Pixels taken off a piece because a neighbour sat deeper under them. */
  reassignedPixels: number;
  /** Pieces dropped as the person themself — §6's whole-person rule. */
  personPiecesDropped: number;
  /** Pixels zeroed inside a detected face box on a piece that was KEPT. */
  facePixelsRemoved: number;
};

/** Live pixels in a mask — `> 127` is the threshold every reader here shares. */
function pixelsOf(mask: Mask): number {
  let n = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at]! > 127) n += 1;
  return n;
}

/** The smallest rectangle holding every live pixel, or null for an empty mask. */
function boundsOf(mask: Mask): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width, height, data } = mask;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x]! <= 127) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * HOW DEEP EVERY PIXEL OF ONE PIECE SITS INSIDE IT — a two-pass chamfer
 * transform over the piece's own bounding box.
 *
 * The piece's edge is where it stops being claimed, and the bounding box's own
 * border is such an edge by construction: outside the box the piece holds
 * nothing. So a garment running off the side of the photograph is not thereby
 * infinitely deep, which would otherwise let a cropped piece win every contest
 * along that border.
 *
 * Returned in the bounding box's own coordinates, so the caller reads
 * `depth[(y - y0) * boxWidth + (x - x0)]`.
 */
function depthWithin(
  mask: Mask,
  bounds: { x0: number; y0: number; x1: number; y1: number },
): { depth: Float32Array; boxWidth: number } {
  const { width, data } = mask;
  const { x0, y0, x1, y1 } = bounds;
  const boxWidth = x1 - x0 + 1;
  const boxHeight = y1 - y0 + 1;
  const depth = new Float32Array(boxWidth * boxHeight);
  const FAR = 1e9;
  for (let by = 0; by < boxHeight; by += 1) {
    for (let bx = 0; bx < boxWidth; bx += 1) {
      depth[by * boxWidth + bx] = data[(by + y0) * width + bx + x0]! > 127 ? FAR : 0;
    }
  }
  const touch = (at: number, from: number, step: number): void => {
    const candidate = depth[from]! + step;
    if (candidate < depth[at]!) depth[at] = candidate;
  };
  for (let by = 0; by < boxHeight; by += 1) {
    for (let bx = 0; bx < boxWidth; bx += 1) {
      const at = by * boxWidth + bx;
      if (depth[at] === 0) continue;
      if (bx === 0 || by === 0) depth[at] = Math.min(depth[at]!, 1);
      if (bx > 0) touch(at, at - 1, 1);
      if (by > 0) touch(at, at - boxWidth, 1);
      if (bx > 0 && by > 0) touch(at, at - boxWidth - 1, 1.414);
      if (bx < boxWidth - 1 && by > 0) touch(at, at - boxWidth + 1, 1.414);
    }
  }
  for (let by = boxHeight - 1; by >= 0; by -= 1) {
    for (let bx = boxWidth - 1; bx >= 0; bx -= 1) {
      const at = by * boxWidth + bx;
      if (depth[at] === 0) continue;
      if (bx === boxWidth - 1 || by === boxHeight - 1) depth[at] = Math.min(depth[at]!, 1);
      if (bx < boxWidth - 1) touch(at, at + 1, 1);
      if (by < boxHeight - 1) touch(at, at + boxWidth, 1);
      if (bx < boxWidth - 1 && by < boxHeight - 1) touch(at, at + boxWidth + 1, 1.414);
      if (bx > 0 && by < boxHeight - 1) touch(at, at + boxWidth - 1, 1.414);
    }
  }
  return { depth, boxWidth };
}

/**
 * HIS CLEAN-UP, THE WHOLE OF IT, ON ONE SPLIT'S PIECES.
 *
 * Every piece must be the frame's own size — a split's pieces are masks of ONE
 * photograph, and a mismatch is a bug upstream rather than something to
 * resample, which is `cutOutPixels`' rule applied one road along. The caller's
 * masks are never mutated.
 */
export function cleanSplit(pieces: readonly Mask[], faces: readonly PointerBox[] = []): CleanedSplit {
  const out: CleanedSplit = {
    personPiecesDropped: 0,
    facePixelsRemoved: 0,
    pieces: [],
    dropped: [],
    fragmentsDropped: 0,
    fragmentPixels: 0,
    holesFilled: 0,
    holePixels: 0,
    contestedPixels: 0,
    reassignedPixels: 0,
  };
  if (pieces.length === 0) return out;
  const { width, height } = pieces[0]!;
  for (const piece of pieces) {
    if (piece.width !== width || piece.height !== height) {
      throw new Error(
        `a split's pieces must all be the frame's size — got ${piece.width}x${piece.height} beside ${width}x${height}`,
      );
    }
  }

  /* ---- RULE 1: each piece's main body ---- */
  type Kept = { at: number; mask: Mask };
  const bodies: Kept[] = [];
  pieces.forEach((piece, at) => {
    /* ONE walk per piece: `largestPixels` arrives from the labelling itself,
       which is why the predicate was widened rather than a second walk added
       to measure the largest component first. */
    const { kept, dropped } = keepPiecesWhere(
      piece,
      (component, all) => component.pixels >= all.largestPixels * SPLIT_MAIN_BODY_SHARE,
    );
    out.fragmentsDropped += dropped.length;
    for (const fragment of dropped) out.fragmentPixels += fragment.pixels;
    if (kept === null) {
      out.dropped.push({ at, reason: "empty" });
      return;
    }
    bodies.push({ at, mask: kept });
  });

  /* ---- RULE 3: fill the small holes, BEFORE the contest (see the header) ---- */
  const filled: Kept[] = bodies.map(({ at, mask }) => {
    const ceiling = Math.floor(pixelsOf(mask) * SPLIT_HOLE_SHARE);
    const closed = closeHoles(mask, { maxHolePixels: ceiling });
    out.holesFilled += closed.filledCount;
    out.holePixels += closed.filledPixels;
    return { at, mask: closed.mask };
  });

  /* ---- §6: A FACE NEVER LIGHTS, AND A PERSON IS NOT A TAKEABLE THING ----

     Before the contest, for the reason the header carries: the whole-person
     piece contains the garment, so left in the contest it is deeper at every
     one of the garment's pixels and takes the lot.

     Two acts, and they are not the same rule. A piece that HOLDS the face — the
     person — leaves the hover set entirely. Every piece that stays has the face
     boxes zeroed out of it, which is what kills the skin specks the court saw
     at the hair piece's edge. `subtractFaces` is imported and never rewritten
     (#2736 slice 2's road). */
  const faceArea = faces.reduce((sum, box) => sum + Math.max(0, box.width) * Math.max(0, box.height), 0);
  const hoverable: Kept[] = [];
  for (const { at, mask } of filled) {
    if (faces.length > 0 && faceArea > 0) {
      let held = 0;
      for (const box of faces) {
        const top = Math.max(0, box.y);
        const bottom = Math.min(height, box.y + box.height);
        const left = Math.max(0, box.x);
        const right = Math.min(width, box.x + box.width);
        for (let y = top; y < bottom; y += 1) {
          for (let x = left; x < right; x += 1) if (mask.data[y * width + x]! > 127) held += 1;
        }
      }
      if (held / faceArea >= SPLIT_FACE_COVER_SHARE) {
        out.personPiecesDropped += 1;
        out.dropped.push({ at, reason: "covers-a-face" });
        continue;
      }
      if (held > 0) {
        out.facePixelsRemoved += held;
        const bare = subtractFaces(mask, faces);
        if (pixelsOf(bare) === 0) {
          out.dropped.push({ at, reason: "empty" });
          continue;
        }
        hoverable.push({ at, mask: bare });
        continue;
      }
    }
    hoverable.push({ at, mask });
  }

  /* ---- RULE 2: a contested pixel goes to the piece it sits deeper inside ---- */
  const size = width * height;
  const claims = new Uint8Array(size);
  for (const { mask } of hoverable) {
    for (let at = 0; at < size; at += 1) if (mask.data[at]! > 127 && claims[at]! < 255) claims[at] += 1;
  }
  for (let at = 0; at < size; at += 1) if (claims[at]! > 1) out.contestedPixels += 1;

  let winners: Int32Array | null = null;
  if (out.contestedPixels > 0) {
    const bestDepth = new Float32Array(size);
    const held = new Int32Array(size).fill(-1);
    const areas = hoverable.map(({ mask }) => pixelsOf(mask));
    hoverable.forEach(({ mask }, index) => {
      const bounds = boundsOf(mask);
      if (bounds === null) return;
      const { depth, boxWidth } = depthWithin(mask, bounds);
      for (let y = bounds.y0; y <= bounds.y1; y += 1) {
        for (let x = bounds.x0; x <= bounds.x1; x += 1) {
          const at = y * width + x;
          if (claims[at]! <= 1 || mask.data[at]! <= 127) continue;
          const mine = depth[(y - bounds.y0) * boxWidth + (x - bounds.x0)]!;
          const standing = held[at]!;
          if (standing === -1 || mine > bestDepth[at]!) {
            bestDepth[at] = mine;
            held[at] = index;
            continue;
          }
          /* A TIE KEEPS IT IN THE LARGER PIECE — dropping it from both would
             punch a hole in a garment nobody asked about. */
          if (mine === bestDepth[at]! && areas[index]! > areas[standing]!) held[at] = index;
        }
      }
    });
    winners = held;
  }

  hoverable.forEach(({ at, mask }, index) => {
    let final = mask;
    if (winners !== null) {
      let lost = 0;
      const data = Buffer.from(mask.data);
      for (let p = 0; p < size; p += 1) {
        if (claims[p]! <= 1 || data[p]! <= 127) continue;
        if (winners[p] === index) continue;
        data[p] = 0;
        lost += 1;
      }
      if (lost > 0) {
        out.reassignedPixels += lost;
        final = { data, width, height };
      }
    }
    if (pixelsOf(final) === 0) {
      out.dropped.push({ at, reason: "lost-to-neighbours" });
      return;
    }
    out.pieces.push(final);
  });

  out.dropped.sort((a, b) => a.at - b.at);
  return out;
}
