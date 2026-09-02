/**
 * `T_min` — THE LOOSEST COMMON FRAME A SET OF FRAMES CAN BE CUT TO, and the one
 * copy of that arithmetic.
 *
 * It was written twice before this file existed: once in
 * `_framing-tmin-disposable.mts`, reading arm 0's log, and again in the arm M
 * harness, reading its own freshly rendered frames. **Two implementations of a
 * court's HEADLINE MEASURE is working law 4 with the stakes turned up** — the
 * number a verdict is read off drifting quietly between the design that quotes
 * it and the arm that produces it. So both callers import this.
 *
 * # The measure
 *
 * A frame can only be cropped IN. So for a common head share `T` and a common
 * headroom `R`, a frame is REACHABLE only if all three hold:
 *
 *   share    <= T                the head is not already bigger than the target
 *   headroom >= R                there is room above the head to place it
 *   below    >= 1/T - R - 1      there is torso below the chin to fill the frame
 *
 * `T_min` is the smallest `T` every frame can reach. **It is a property of the
 * RAW frames and the cut cannot move it**, which is why the court's bar is
 * written on it — a predecessor's bar turned out to be the transformation
 * restating its own definition.
 *
 * # `below` is DERIVED, and the caller is told so rather than trusted to know
 *
 *   below = 1/share - headroom - 1
 *
 * holds identically. So `belowChin` is not a second estimator beside head size
 * and head placement; it is those two rearranged. `identityHolds` evaluates it
 * on every frame, because a stated identity nobody evaluates is an assumption
 * wearing a proof's clothes.
 */

/** One raw frame, in the units the whole court is measured in. */
export type FramingFrame = {
  /** Whatever names the population this frame belongs to. */
  group: string;
  /** Whatever names the frame inside its group. */
  pos: string;
  /** Face-box height as a fraction of frame height. */
  share: number;
  /** Distance from the frame's top edge to the face box, in face-heights. */
  headroom: number;
  /** Distance from the chin to the frame's bottom edge, in face-heights. */
  below: number;
};

export type TminReading = {
  n: number;
  /**
   * The largest common headroom the set can take. It can be no larger than the
   * TIGHTEST headroom present, or that frame would have to be cropped above its
   * own top edge. Floored to two decimals so the figure is stable to quote.
   */
  usableR: number;
  tMin: number;
  /** The frame that `T_min` is set by — the one the court has to argue about. */
  binding: FramingFrame;
  /**
   * ⚠ THE CEILING `tMin` DOES NOT KNOW ABOUT — added 2026-08-24, ruled
   * fable-1649, after a correct `T_min` turned out to be unreachable.
   *
   * `tMin` is the LOWER bound: the smallest `T` every frame can reach, from
   * `share <= T`. There is a second bound in the opposite direction. The crop
   * is `faceH / T` tall and a crop shorter than the delivered height would have
   * to be UPSCALED, which the product refused (`framingTrim.ts`'s
   * `would-upscale` — that module was DELETED 2026-09-03 AEST with the trim itself,
   * card #11, on the founder's *"11 heads look fine."*; this library outlives it
   * because it measures COURT frames and never ran on the roll road). So each
   * frame also requires `T <= renderRatio × share`,
   * where `renderRatio` is render height ÷ delivered height.
   *
   * **A bound is not a value.** `tMax` is the largest `T` every frame can
   * reach, and when `tMin > tMax` NO single `T` serves the whole population —
   * which is the state of the no-clause cells, and is invisible if you read
   * `tMin` alone.
   */
  tMax: number;
  /** True when `tMin <= tMax` — i.e. a common `T` exists at all. */
  commonFeasible: boolean;
  /** How many frames a given `T` would trim. `null` when no `T` was supplied. */
  trimsAtT: number | null;
  shareMedian: number;
  shareMin: number;
  shareMax: number;
  shareSpread: number;
  headroomMedian: number;
  belowMedian: number;
};

const median = (values: readonly number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/**
 * The render-to-delivered height ratio the trim runs at (1536×2304 → 1024×1536).
 * It is what sets the width of every frame's feasible band, `[share, ratio ×
 * share]`, so a population whose max/min share exceeds it has no common `T`.
 */
export const FRAMING_RENDER_RATIO = 2304 / 1536;

export function tMinOf(
  frames: readonly FramingFrame[],
  options?: { renderRatio?: number; at?: number },
): TminReading {
  if (frames.length === 0) {
    /*
      A reader that comes up empty THROWS rather than returning a clean nothing:
      a caller whose population failed to load would otherwise report "no
      frames" as calmly as it reports a finding.
    */
    throw new Error("tMinOf: no frames — a T_min over an empty set is not a number");
  }
  const usableR = Math.floor(Math.min(...frames.map((frame) => frame.headroom)) * 100) / 100;
  const perFrame = frames.map((frame) => Math.max(frame.share, 1 / (frame.below + usableR + 1)));
  const tMin = Math.max(...perFrame);
  const shares = frames.map((frame) => frame.share);
  const ratio = options?.renderRatio ?? FRAMING_RENDER_RATIO;
  const tMax = Math.min(...shares.map((share) => share * ratio));
  const at = options?.at ?? null;
  return {
    n: frames.length,
    usableR,
    tMin,
    tMax,
    commonFeasible: tMin <= tMax,
    trimsAtT: at === null
      ? null
      : shares.filter((share) => share <= at && at <= share * ratio).length,
    binding: frames[perFrame.indexOf(tMin)]!,
    shareMedian: median(shares),
    shareMin: Math.min(...shares),
    shareMax: Math.max(...shares),
    shareSpread: Math.max(...shares) - Math.min(...shares),
    headroomMedian: median(frames.map((frame) => frame.headroom)),
    belowMedian: median(frames.map((frame) => frame.below)),
  };
}

/** How many frames satisfy `below = 1/share - headroom - 1`. */
export function identityHolds(frames: readonly FramingFrame[]): { held: number; of: number } {
  const broken = frames.filter(
    (frame) => Math.abs((1 / frame.share - frame.headroom - 1) - frame.below) > 1e-9,
  );
  return { held: frames.length - broken.length, of: frames.length };
}

/**
 * THE PAIRED SIZE DELTA — arm R's own measure, and the bar the court reads it
 * against (pre-registered opus-1195 §4, granted fable-1553 Q2).
 *
 * The same prompt is rendered at two sizes, so **the PAIR is the measurement**.
 * An unpaired comparison of two eight-frame spreads would drown a real size
 * effect in the very wobble this court exists to measure.
 *
 * ⚠ **This is a SECOND implementation of what arm R printed on its own face, and
 * that is deliberate rather than sloppy.** Arm R computed its verdict inline
 * while it held the frames; arm M re-derives it here from arm R's stored ROWS,
 * through different code, before it agrees to render at a size. Two
 * implementations agreeing on one set of rows is a second reader that does not
 * share the first one's resolver. If they ever disagree, the court has a defect
 * and not a reading.
 */
export type PairedSizeReading = {
  pairs: number;
  medianAbsShare: number;
  medianAbsHeadroom: number;
  medianSignedShare: number;
  medianSignedHeadroom: number;
  /** True when either median clears its bar — the clause must then be
   *  calibrated at the SHIP size and nowhere else. */
  moves: boolean;
};

export const PAIRED_SHARE_BAR_PT = 1.5;
export const PAIRED_HEADROOM_BAR = 0.10;

export function pairedSizeDelta(
  rows: ReadonlyArray<{ size: string; pos: number; share: number; headroom: number }>,
  fromSize: string,
  toSize: string,
): PairedSizeReading {
  const deltaShare: number[] = [];
  const deltaHeadroom: number[] = [];
  const positions = [...new Set(rows.map((row) => row.pos))].sort((a, b) => a - b);
  for (const pos of positions) {
    const from = rows.find((row) => row.size === fromSize && row.pos === pos);
    const to = rows.find((row) => row.size === toSize && row.pos === pos);
    if (!from || !to || !Number.isFinite(from.share) || !Number.isFinite(to.share)) continue;
    deltaShare.push((to.share - from.share) * 100);
    deltaHeadroom.push(to.headroom - from.headroom);
  }
  if (deltaShare.length === 0) {
    throw new Error(`pairedSizeDelta: no complete pair between "${fromSize}" and "${toSize}" — `
      + "there is no size verdict to act on");
  }
  const medianAbsShare = median(deltaShare.map(Math.abs));
  const medianAbsHeadroom = median(deltaHeadroom.map(Math.abs));
  return {
    pairs: deltaShare.length,
    medianAbsShare,
    medianAbsHeadroom,
    medianSignedShare: median(deltaShare),
    medianSignedHeadroom: median(deltaHeadroom),
    moves: medianAbsShare > PAIRED_SHARE_BAR_PT || medianAbsHeadroom > PAIRED_HEADROOM_BAR,
  };
}
