import sharp from "sharp";

/**
 * The smoke alarm for a render that succeeded at producing garbage.
 *
 * # STATUS: SHADOW MODE (founder condition, 2026-08-03)
 *
 * `rollService` calls this on every landing. It classifies, persists its
 * verdict on the generation audit row and alarms — and **does not auto-fail or
 * refund**. The flip to enforcing is the D-93 gate itself, and the founder
 * ruled it happens on a false-positive rate measured against real founder
 * traffic, never on a green suite.
 *
 * **That number now exists — 0 in 1,016** (see below). The flip itself remains
 * the founder's, because enabling it turns this into a control that destroys
 * paid work.
 *
 * Where it stands, measured (`scripts/measure-render-fault.mts`):
 *
 *   - **the real specimen: CAUGHT.** `docs/specs/references/nine-tile-sheet.png`
 *     is the actual candidate the founder paid for, and the verdict names its
 *     structure exactly — three horizontal seams at the quarters, one vertical
 *     down the middle. It is a 2x4 sheet of eight faces; D-93's prose calls it
 *     nine, written from memory in the moment.
 *   - **0 false positives across 1,017 REAL PRODUCTION CANDIDATES** — the
 *     founder's entire cast history, every brief he has ever run. The detector
 *     fired exactly ONCE in that sweep, on roll index 2 of "a kpop idol", tile
 *     01: D-93's incident itself, found by the detector rather than by being
 *     told where to look. One fire, and it was the right one.
 *   - **false positives: 0 of 47** dev candidates as well, including four
 *     adversarial sheets cast for this purpose (stated glasses, a wool beanie,
 *     West African heritage, and an East Asian idol — the last being the
 *     closest thing to the conditions that produced the failure).
 *   - **synthetic recall: 7 of 8**, across varied arity, gutter width, gutter
 *     colour and deliberate misalignment, re-encoded at provider-typical JPEG
 *     quality so the seams are not laboratory-clean.
 *
 * The one miss is an edge-to-edge grid with no gutter at all, which has no seam
 * to find. Catching that needs a different signal (repeated blocks); fail-open
 * tolerates it, and the limit is pinned by test rather than left as folklore.
 *
 * # The incident (D-93)
 *
 * On a k-pop verification roll, tile 01 came back as a **nine-face grid inside
 * a single tile** — a contact sheet where a portrait should be. It landed as a
 * successful paid candidate: `ready`, an image key, a charge, no refund, no
 * detection, and no way for the user to say otherwise short of discarding it
 * and paying again.
 *
 * Every failure taxonomy in the roll domain answers *did the provider fail*.
 * None answers *did the provider succeed at producing garbage*. A transport
 * error, a content refusal and a capability refusal all refund honestly; a
 * returned image that is not a photograph of one person refunds nothing,
 * because nothing ever looks at it. **That is the only class of paid failure
 * the product cannot see.**
 *
 * # What this is, and firmly is not
 *
 * A smoke alarm. It answers one structural question — *is this image built out
 * of tiles* — and nothing else. It has no opinion about the person in the
 * frame, the prompt, the pose, or the quality.
 *
 * **It is deliberately deterministic and offline.** D-93 names "face count and
 * grid detection", and face counting means a vision model at the landing site,
 * which is the prompt-compliance anti-pattern its own next sentence forbids —
 * a quality judge on the paid path, eight calls per roll, latency on every
 * landing. Grid detection catches the actual incident with arithmetic, for
 * free. **So this tier implements the second half of that sentence and not the
 * first: multi-face without tile structure is an explicit non-goal here** —
 * two people standing in one frame is a different and much harder problem, and
 * a worse one to be wrong about.
 *
 * # Fail open, always
 *
 * A false positive destroys an image the customer paid for, and the refund does
 * not give them the face back. So every uncertainty resolves to *deliver*:
 * unreadable bytes, a timeout, an unexpected shape, an error inside sharp — all
 * of them return "no fault found".
 *
 * That is the opposite of the invariant-7 posture ("a control must refuse, not
 * allow, when a dependency is missing"), and deliberately: invariant 7 governs
 * SECURITY controls, where allowing on failure is a breach. Here allowing on
 * failure is exactly the behaviour the product already shipped with, and the
 * asymmetry runs the other way. A miss is recoverable through D-113's
 * correction precedent; a false positive is not recoverable at all.
 */

/**
 * The long-side cap, and why there is no aggressive downsample.
 *
 * The first version resized to 192px before measuring and **found nothing** —
 * 0 of 8 synthesised grids, including a plain 3x3. Measured at full resolution
 * the same gutters were unmistakable (standard deviation ~1 against ~40 for a
 * row of faces); at 192px a 10px gutter in a 1000px image becomes under two
 * pixels and area-averaging blends it into the faces on either side. The
 * detector was inert and would have shipped looking green, because a smoke
 * alarm that never fires passes every test you think to write.
 *
 * The rule it cost: **never blur the axis you are measuring along.** Rows are
 * measured at full height and subsampled across; columns at full width and
 * subsampled down. A seam is thin by nature, and thinness is the signal.
 *
 * The cap exists only to bound memory on a very large frame.
 */
const MAX_LONG_SIDE = 2048;

/**
 * Sample every Nth pixel ALONG a line — never across it.
 *
 * Cheap, and safe in the direction that matters: skipping columns cannot make
 * a flat row look textured, and cannot make a textured row look flat.
 */
const STRIDE = 6;

/**
 * How uniform a line has to be to count as a seam.
 *
 * On an 8-bit channel this is a standard deviation, so ~2 means "essentially
 * flat". A real gutter in a contact sheet is a solid colour; a smooth gradient
 * across a studio backdrop is not this flat over a whole line.
 */
const SEAM_FLATNESS = 3.0;

/**
 * How far the seam's own brightness must STEP away from its neighbours.
 *
 * This is the discriminator, and it replaced one that was wrong. The first
 * version asked "is there detail on both sides of this flat line", reasoning
 * that a seam separates two pictures. Measured against the real specimen, that
 * test rejected every genuine seam: these are **portraits on seamless paper**,
 * so both sides of a gutter are plain backdrop, and the texture there is 1-7
 * against a threshold of 12. The test excluded exactly the case it was written
 * to catch.
 *
 * What the specimen actually shows is a STEP. The seam rows sit at mean 249,
 * 250 and 251 against neighbours at 195-215 — a jump of 35 to 50 levels across
 * a single row. A backdrop gradient does not do that; a discontinuity is the
 * whole difference between "the picture continues" and "a new picture starts".
 */
const SEAM_STEP = 15;

/**
 * The outer margin ignored on every edge.
 *
 * A framed photograph is flat at its borders almost by definition — backdrop,
 * letterboxing, a plain wall. Only INTERIOR seams say anything about tiling.
 */
const MARGIN = 0.12;

/**
 * How far either side of a candidate seam to look for picture.
 *
 * In PIXELS, because seams are now measured at full resolution. Wide enough to
 * clear the soft edge a JPEG leaves around a hard boundary, narrow enough that
 * it is still asking about the seam's own neighbourhood.
 */
const CONTEXT = 12;

export type RenderFaultVerdict =
  | { fault: false; reason: "clean" | "undetermined"; detail?: string }
  | { fault: true; reason: "tiled"; detail: string };

/** Per-line standard deviation, and per-line texture, in one pass. */
function lineStats(
  data: Buffer,
  width: number,
  height: number,
  axis: "row" | "column",
): { flatness: number[]; means: number[] } {
  const outer = axis === "row" ? height : width;
  const inner = axis === "row" ? width : height;
  const flatness: number[] = [];
  const means: number[] = [];

  for (let i = 0; i < outer; i += 1) {
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let j = 0; j < inner; j += STRIDE) {
      const value = axis === "row" ? data[i * width + j] : data[j * width + i];
      sum += value;
      sumSquares += value * value;
      count += 1;
    }
    const mean = sum / count;
    flatness.push(Math.sqrt(Math.max(0, sumSquares / count - mean * mean)));
    means.push(mean);
  }
  return { flatness, means };
}

/**
 * Interior seams on one axis: flat lines with textured picture on both sides.
 *
 * Returns the seam positions as fractions of the axis, so the caller can talk
 * about them without knowing the sample size.
 */
function seamsOn(
  stats: { flatness: number[]; means: number[] },
  n: number,
): number[] {
  const lo = Math.floor(n * MARGIN);
  const hi = Math.ceil(n * (1 - MARGIN));
  const seams: number[] = [];

  let index = lo;
  while (index < hi) {
    if (stats.flatness[index] > SEAM_FLATNESS) {
      index += 1;
      continue;
    }
    // Walk the whole flat band, so a thick gutter counts once.
    const start = index;
    while (index < hi && stats.flatness[index] <= SEAM_FLATNESS) index += 1;
    const end = index - 1;

    /*
      A STEP ON BOTH SIDES. The band's own brightness must jump away from what
      surrounds it, in the same direction on both flanks — that is what makes
      it a boundary rather than a bright patch of one picture.
    */
    const before = stats.means.slice(Math.max(0, start - CONTEXT), start);
    const after = stats.means.slice(end + 1, Math.min(n, end + 1 + CONTEXT));
    if (before.length === 0 || after.length === 0) continue;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const band = avg(stats.means.slice(start, end + 1));
    const stepBefore = band - avg(before);
    const stepAfter = band - avg(after);
    if (Math.sign(stepBefore) === Math.sign(stepAfter)
      && Math.abs(stepBefore) >= SEAM_STEP && Math.abs(stepAfter) >= SEAM_STEP) {
      seams.push((start + end) / 2 / n);
    }
  }
  return seams;
}

/**
 * Is this image built out of tiles?
 *
 * Never throws. Every failure path returns `undetermined`, which the caller
 * treats as "deliver it".
 */
export async function detectRenderFault(bytes: Buffer): Promise<RenderFaultVerdict> {
  try {
    const image = sharp(bytes, { failOn: "none" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return { fault: false, reason: "undetermined", detail: "no dimensions" };

    /*
      Resized ONLY if it is enormous, and then by an integer-ish factor that
      keeps a thin seam thin. Everything below the cap is measured exactly as
      the provider sent it.
    */
    const longSide = Math.max(meta.width, meta.height);
    const pipeline = longSide > MAX_LONG_SIDE
      ? image.greyscale().resize({ width: Math.round((meta.width * MAX_LONG_SIDE) / longSide) })
      : image.greyscale();
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 1) return { fault: false, reason: "undetermined", detail: `channels=${info.channels}` };

    const rows = seamsOn(lineStats(data, info.width, info.height, "row"), info.height);
    const columns = seamsOn(lineStats(data, info.width, info.height, "column"), info.width);

    /*
      THE BAR, and it is deliberately high.

      A single interior seam is not a grid — a horizon, a table edge, a band of
      wall behind a head can all produce one, and failing a paid candidate over
      one flat line would be exactly the false positive this must not make.

      A contact sheet has structure in BOTH directions, or repeated structure in
      one. Requiring that costs some recall against a 1xN strip with a single
      divider, which fail-open tolerates, and buys a very quiet alarm.
    */
    const tiled = (rows.length >= 1 && columns.length >= 1) || rows.length >= 2 || columns.length >= 2;
    if (!tiled) return { fault: false, reason: "clean" };

    return {
      fault: true,
      reason: "tiled",
      detail:
        `interior seams — ${rows.length} horizontal at [${rows.map((r) => r.toFixed(2)).join(", ")}], `
        + `${columns.length} vertical at [${columns.map((c) => c.toFixed(2)).join(", ")}]`,
    };
  } catch (error) {
    return {
      fault: false,
      reason: "undetermined",
      detail: error instanceof Error ? error.message.slice(0, 120) : "unreadable",
    };
  }
}
