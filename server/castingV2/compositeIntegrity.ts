/**
 * DID OUR OWN COMPOSITOR TEAR THE FRAME?
 *
 * # The paid failure nothing looked at
 *
 * Run-6's first render — "give her freckles", charged 25 — was delivered with a
 * hard-edged slab of background punched through her hair and neck, and the
 * verification net scored it `delivered_compliant`. The net only ever asks
 * about facets: it asked "freckles?" (yes) and "hair worn?" (yes), and both
 * were true **of a picture with a hole in it**. There is no question in it whose
 * answer is *"the image is intact"*, so a torn frame scores a clean sheet by
 * construction.
 *
 * `renderFault` did not miss this. It is a contact-sheet grid detector, it says
 * so in its own doc, and it never had this class. This is its sibling, not a
 * patch to it: that one asks *did the provider succeed at producing garbage*,
 * this one asks *did WE cut up something the provider got right*.
 *
 * # Why this can be exact where `renderFault` has to be heuristic
 *
 * `renderFault` sees bytes and nothing else. This runs where the master, the
 * composite AND the applied mask are all in hand, and it exploits the
 * guarantee the compositor already proves: **outside the applied mask the
 * composite is byte-identical to the master.** So for any two neighbouring
 * pixels straddling that boundary, the OUTSIDE value is the same in both
 * images, and the step across the boundary changes only because of what was
 * delivered inside it:
 *
 *     excess = |delivered_in − delivered_out| − |master_in − master_out|
 *
 * A surface edit moves a few levels, so its excess is small. A tear replaces
 * one material with another across the boundary — background over hair — and
 * the feather cannot hide it.
 *
 * # Sized on the specimen, not on a number somebody liked
 *
 * `scripts/calibration/composite-seam.mts`, run over run-6's own production
 * renders — the torn one and two clean ones from the SAME face and the same
 * chain, so the gap between them is the whole discriminating power available:
 *
 *     frame          boundary    p50   p90    p99     max   >20  >40  >80
 *     01-freckles      113,376   -0.9   7.3   22.8   210.8  1464  584  455   ← TORN
 *     02-lipgloss      144,556   -0.9   5.7   16.8    73.7   891   79    0
 *     03-earrings      145,918   -1.0   5.5   16.5    83.7   865  104    2
 *     master vs self       none — no applied region, so no boundary at all
 *
 * At an excess of 80 levels the torn frame has **455** boundary pixels and the
 * clean ones have **0 and 2**. That is the threshold, and the margin is roughly
 * 200×. At 40 they overlap in kind (584 against 79 and 104), which is why the
 * bar is not there.
 *
 * The null — the master against itself — produces no boundary at all rather
 * than a small number, which is the control that matters most: an instrument
 * that invents a seam where nothing was composited would be measuring its own
 * noise (working law 2).
 *
 * # ENFORCING for surface edits, SHADOW for the rest — and why the split
 *
 * A false positive destroys an image the customer paid for and the refund does
 * not give them the face back, so the posture is `renderFault`'s: every
 * uncertainty resolves to deliver.
 *
 * For an edit that cannot move an edge — freckles, a tan, lipstick — a material
 * step at the mask boundary is never legitimate, and that is the case the
 * measurement above covers. For a cut, a removal or a shrink the silhouette is
 * *supposed* to change, and I have exactly one clean specimen of that kind
 * (`03-earrings`, an addition, which sits comfortably below the bar). One
 * specimen is not a calibration. So those record their verdict and never
 * refuse, until a specimen set exists — which is how `renderFault` itself
 * shipped, and it was flipped on a number rather than on a feeling.
 *
 * The verdict is returned either way, so a shadow period produces the evidence
 * its own flip needs.
 */
import type { Mask, Raster } from "./maskedComposite";

/**
 * Excess step, in luma levels, above which a boundary pixel is torn.
 *
 * 80: the torn specimen has 455 pixels above it, the clean ones 0 and 2.
 */
export const SEAM_EXCESS_LEVELS = 80;

/**
 * How many torn pixels before it is a tear rather than a speck.
 *
 * A clean frame produced 2. Fifty is far above the noise and far below the
 * 455 the real defect produced, so neither bound is close to the specimen.
 */
export const SEAM_MIN_PIXELS = 50;

/**
 * And as a share of the boundary, so the bar does not assume a resolution.
 *
 * The torn frame is 0.40% of its boundary; the clean ones are 0.0014%.
 */
export const SEAM_MIN_SHARE = 0.001;

export type SeamVerdict = {
  /** Whether this frame carries our compositor's seam. */
  torn: boolean;
  /** Boundary pixels examined. Zero means nothing was composited. */
  boundaryPixels: number;
  /** Boundary pixels whose step exceeds the master's by more than the bar. */
  tornPixels: number;
  share: number;
  /** The worst excess seen, for a log line that can be acted on. */
  worstExcess: number;
  /**
   * THE STATISTIC A TEAR DETECTOR CANNOT EXPRESS — shadow only, for now.
   *
   * The founder traced a visible tonal seam along the expanded ground's edge on
   * a render he had paid for, and this detector said `torn: false` about that
   * exact frame. It was not a threshold set too high. Measured on his own
   * artifacts, in the band he marked:
   *
   *     pixels over the tear bar (80 levels)        0
   *     signed excess along the boundary     -10.31 +/- 9.22   |mean|/sd 1.118
   *     the same statistic, whole boundary   +0.39 +/- 19.76   |mean|/sd 0.020
   *
   * **A tear is an amplitude and a blend seam is a COHERENCE.** One material
   * replacing another reads in the hundreds and is local; a painted shirt-grey
   * meeting a master shirt-grey reads at ten, CONSISTENTLY, along the whole
   * edge — and the eye integrates along an edge where a threshold does not. No
   * bar on |step| can be lowered far enough to find it without drowning in
   * texture: his band's median excess is 1.9 and the whole boundary's p90 is
   * 14.7.
   *
   * So it is recorded and nothing acts on it. It has ONE specimen, and one
   * specimen is not a calibration — the same rule `renderFault` and the seam
   * bar itself were held to. What it needs is a table, which is what persisting
   * it on every render buys.
   */
  signedMean: number;
  signedSpread: number;
  /** `|mean| / sd` — how much of the step is a consistent offset rather than noise. */
  coherence: number;
  detail: string;
};

const luma = (frame: Raster, pixel: number): number => {
  const at = pixel * 3;
  return (frame.data[at]! * 299 + frame.data[at + 1]! * 587 + frame.data[at + 2]! * 114) / 1000;
};

/**
 * The seam verdict for one composite.
 *
 * Fails open on every uncertainty: a shape mismatch, an empty mask, a boundary
 * with nothing on it. All of those return `torn: false` with a reason, because
 * the cost of being wrong here is a destroyed paid picture.
 */
export function compositeSeam(input: {
  master: Raster;
  composite: Raster;
  /** The region the composite actually changed — `outsideMaskUnchanged`'s own. */
  applied: Mask;
}): SeamVerdict {
  const { master, composite, applied } = input;
  const nothing = (detail: string): SeamVerdict => ({
    torn: false, boundaryPixels: 0, tornPixels: 0, share: 0, worstExcess: 0,
    signedMean: 0, signedSpread: 0, coherence: 0, detail,
  });

  if (master.width !== composite.width || master.height !== composite.height
    || applied.width !== master.width || applied.height !== master.height) {
    return nothing("frames and mask disagree about size — delivering");
  }
  const { width, height } = master;
  if (applied.data.length !== width * height) return nothing("mask is not single-channel — delivering");

  let boundaryPixels = 0;
  let tornPixels = 0;
  let worstExcess = 0;
  /* The SIGNED excess, accumulated for the coherence statistic below. */
  let signedTotal = 0;
  let signedSquares = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (applied.data[pixel] === 0) continue;
      for (const neighbour of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
        if (applied.data[neighbour] !== 0) continue;
        boundaryPixels += 1;
        /*
          The outside pixel is the same in both images by the compositor's own
          guarantee, so this difference is entirely about what was delivered.
        */
        const deliveredStep = luma(composite, pixel) - luma(composite, neighbour);
        const masterStep = luma(master, pixel) - luma(master, neighbour);
        const excess = Math.abs(deliveredStep) - Math.abs(masterStep);
        if (excess > worstExcess) worstExcess = excess;
        if (excess > SEAM_EXCESS_LEVELS) tornPixels += 1;
        const signed = deliveredStep - masterStep;
        signedTotal += signed;
        signedSquares += signed * signed;
      }
    }
  }

  if (boundaryPixels === 0) return nothing("nothing was composited — delivering");
  const share = tornPixels / boundaryPixels;
  const torn = tornPixels >= SEAM_MIN_PIXELS && share >= SEAM_MIN_SHARE;
  const signedMean = signedTotal / boundaryPixels;
  const variance = Math.max(0, signedSquares / boundaryPixels - signedMean * signedMean);
  const signedSpread = Math.sqrt(variance);
  return {
    torn,
    boundaryPixels,
    tornPixels,
    share,
    worstExcess,
    signedMean,
    signedSpread,
    /*
      A FLOOR ON THE DENOMINATOR, BECAUSE PERFECT COHERENCE IS THE LOUDEST CASE.

      The first version read `spread === 0 ? 0 : |mean|/spread`, so a boundary
      with a dead-consistent offset — the strongest possible reading of exactly
      the defect this measures — scored ZERO. Its own positive control caught
      it. Half a luma level is below what eight-bit pixels can express, so
      anything under it is not a smaller spread, it is no spread; and a floor
      keeps the number finite, which a row of JSON requires (`Infinity`
      serialises to `null`).
    */
    coherence: Math.abs(signedMean) / Math.max(signedSpread, 0.5),
    detail: `${tornPixels} of ${boundaryPixels} boundary px step more than `
      + `${SEAM_EXCESS_LEVELS} levels past the master (${(share * 100).toFixed(3)}%, worst `
      + `${worstExcess.toFixed(1)}); signed mean ${signedMean.toFixed(2)} +/- ${signedSpread.toFixed(2)}`,
  };
}
