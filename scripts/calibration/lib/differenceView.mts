/**
 * THE DIFFERENCE VIEW — binding rider, 2026-08-06. No before/after pair ships bare.
 *
 * Born from my own D-202: I reported a visual difference between two forehead
 * regions that were byte-for-byte identical, then spent three rounds of grain
 * engineering chasing it. A diff panel beside the pair would have ended that in
 * one look — the panel is black, the conversation is over.
 *
 * Law #1 turned on one's own eyes: **before claiming a visual difference, diff
 * the bytes.** The founder's research doc named the technique; the phantom is
 * why it is now law rather than a suggestion.
 *
 * The panel is AMPLIFIED, because an honest diff of a real seam is nearly black
 * too and would be indistinguishable from a phantom at a glance. The
 * amplification factor is printed onto nothing and returned instead, so a
 * caption can state it — an unlabelled amplified diff is its own way of lying.
 *
 * # The sibling law: read your own instruments before your own inferences
 *
 * **When a guard prints its own firing, that line outranks any statistic derived
 * beside it.** The hem diagnostic printed *"columns where the paint actually
 * touches the zone edge: 351 of 738"* — the boundary-contact rider firing, in
 * plain words — and a correlation coefficient computed two lines above won the
 * argument anyway. The correlation was answering a different question (does the
 * hem track the zone's SHAPE) and answered it correctly; the guard was answering
 * the one that mattered (is the paint pressed against the edge) and was ignored.
 *
 * Two more passes and two wrong diagnoses followed. Same family as look-at-the-
 * file: a derived number is a claim about the artifact, and a guard's own output
 * is the artifact. **Prefer the thing that fired over the thing you computed.**
 */
import sharp from "sharp";

export type DifferenceResult = {
  /** The panel: black where nothing moved, bright where it did. */
  panel: Buffer;
  /** How many pixels differ at all. Zero means the two are identical. */
  changedPixels: number;
  /** Share of the frame that moved. */
  changedShare: number;
  /** Largest single-channel delta, before amplification. */
  maxDelta: number;
  /** What the panel multiplies by, so a caption can say so. */
  gain: number;
};

/**
 * Byte difference between two images of identical dimensions.
 *
 * Refuses a size mismatch rather than resizing: a diff between two things that
 * were never the same shape is not a diff, and scaling one to fit would invent
 * differences at every edge — which is the failure this exists to prevent.
 */
export async function differenceView(
  aBytes: Buffer,
  bBytes: Buffer,
  options: { gain?: number } = {},
): Promise<DifferenceResult> {
  const a = await sharp(aBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(bBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    throw new Error(
      `cannot diff ${a.info.width}x${a.info.height} against ${b.info.width}x${b.info.height} — `
      + "resizing one to fit would invent a difference at every edge",
    );
  }
  const { width, height } = a.info;
  const gain = options.gain ?? 8;
  const out = Buffer.alloc(width * height * 3);
  let changedPixels = 0;
  let maxDelta = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * 3;
    let moved = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(a.data[at + channel] - b.data[at + channel]);
      if (delta > 0) moved = true;
      if (delta > maxDelta) maxDelta = delta;
      out[at + channel] = Math.min(255, delta * gain);
    }
    if (moved) changedPixels += 1;
  }
  return {
    panel: await sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer(),
    changedPixels,
    changedShare: changedPixels / (width * height),
    maxDelta,
    gain,
  };
}

/**
 * A finished exhibit: before, after, and the diff that makes the claim checkable.
 *
 * Returns the caption line as well as the image, because the gain and the
 * changed share belong beside the picture rather than in someone's memory.
 */
export async function exhibitWithDifference(input: {
  before: Buffer;
  after: Buffer;
  cellWidth?: number;
  gain?: number;
}): Promise<{ image: Buffer; caption: string; result: DifferenceResult }> {
  const result = await differenceView(input.before, input.after, { gain: input.gain });
  const width = input.cellWidth ?? 420;
  const cells: Buffer[] = [];
  for (const bytes of [input.before, input.after, result.panel]) {
    cells.push(await sharp(bytes).resize(width).jpeg({ quality: 95 }).toBuffer());
  }
  const height = (await sharp(cells[0]).metadata()).height!;
  const image = await sharp({
    create: { width: width * 3 + 16, height, channels: 3, background: "#0A0A0A" },
  })
    .composite(cells.map((cell, index) => ({ input: cell, left: index * (width + 8), top: 0 })))
    .jpeg({ quality: 95 })
    .toBuffer();

  const caption = result.changedPixels === 0
    ? "difference: BLACK — the two are byte-identical, any perceived change is not there"
    : `difference: ${(result.changedShare * 100).toFixed(2)}% of pixels moved, `
      + `max ${result.maxDelta} levels, panel amplified ${result.gain}x`;
  return { image, caption, result };
}
