/**
 * THE COMPOSITE, AND THE ARITHMETIC THAT REPLACES THE JUDGE.
 *
 * # Why this module is the workstream's foundation
 *
 * Everything this program has fought for a week — drift, unreliable readers,
 * retries, second opinions, majorities of three — exists because we could only
 * ever ASK whether the picture changed outside the region we meant to edit. A
 * vision model was the only instrument, and D-199 and D-203 measured what that
 * instrument is worth: it disagrees with itself, and it cannot tell a clarity
 * pass from a repaint.
 *
 * **Once our code owns the composite, outside-the-mask consistency stops being
 * a judgement and becomes subtraction.** The model returns a whole frame; we
 * take only the pixels inside the mask and put them into an otherwise untouched
 * master. What happened outside is then not a question for a reader — it is
 * `Buffer.compare`, and it answers in bytes.
 *
 * # Why the model's own mask is not enough
 *
 * OpenAI's own documentation, quoted in the founder's research
 * (`docs/specs/masked-editing/RESEARCH_repeated-refinement-editors_manus_2026-08-05.md`):
 *
 *   > "Masking with GPT Image is entirely prompt-based. The model uses the mask
 *   > as guidance, but may not follow its exact shape with complete precision."
 *
 * A model mask is documented GUIDANCE. A boundary that the other side is free to
 * cross is not a boundary, and building on one would be invariant 7's failure in
 * a new costume: a control that looks invoked and is not. So the mask is sent to
 * the model to shape its attention, and enforced HERE, where it is arithmetic.
 *
 * # The feather, and the one place the guarantee is exact
 *
 * A hard mask edge reads as a cut-out. The mask is therefore feathered, and
 * inside the feathered band the output is a blend — which by definition is not
 * byte-identical to the master. So the promise is stated precisely:
 *
 *   **Where the feathered mask is fully zero, the output is byte-identical to
 *   the master.** Not approximately, not perceptually — identical.
 *
 * The band between is where seam honesty lives, and it is measured rather than
 * asserted (`seamBand`). Calling the whole frame "unchanged" while a blend band
 * exists would be exactly the overclaim D-202 named.
 */
import sharp from "sharp";

export type Raster = {
  /** Raw RGB, three bytes per pixel, no alpha — the master is opaque. */
  data: Buffer;
  width: number;
  height: number;
};

/** A mask is one byte per pixel: 0 keeps the master, 255 takes the patch. */
export type Mask = {
  data: Buffer;
  width: number;
  height: number;
};

export class CompositeError extends Error {}

/**
 * Read a PNG into raw RGB at its own resolution.
 *
 * **No resizing, ever.** §5 of the research is explicit that repeated resolution
 * conversion adds resampling loss on top of the model's own errors, and a
 * silent resample here would put a lossy step inside the one path that promises
 * to be lossless.
 */
export async function readRaster(bytes: Buffer): Promise<Raster> {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Write raw RGB back out as lossless PNG at the same size. */
export async function writePng(raster: Raster): Promise<Buffer> {
  return sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Feather a hard mask into a blend ramp.
 *
 * Gaussian rather than a box blur because a box blur leaves a visible straight
 * shoulder on curved edges — a jaw or a lens rim is exactly where that shows.
 */
export async function featherMask(mask: Mask, radius: number): Promise<Mask> {
  if (radius <= 0) return mask;
  const { data, info } = await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .blur(radius)
    /*
      ONE CHANNEL OUT, EXPLICITLY — sharp promoted the blurred mask to three,
      and the loops that walk `mask.data` one byte per pixel then ran three
      times too far, reading past the raster into `undefined`. Every comparison
      against `undefined` is false, so the outside-the-mask check reported
      byte-identity for two thirds of a buffer it had never looked at.

      **A guarantee that passes by reading nothing is worse than no guarantee**,
      and this is precisely the class D-202 named: a claim that looked verified
      and was not. Forced here, and re-checked in `assertSameShape` so the same
      mistake cannot arrive from a different direction.
    */
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Depth inside a mask, in pixels from its own boundary. `-1` outside.
 *
 * Repeated erosion rather than a distance transform: the bands this module
 * needs are a handful of pixels wide, and a loop anyone can read beats a
 * cleverer thing nobody checks.
 */
function depthInside(mask: Mask, maxDepth: number): Int32Array {
  const { width, height } = mask;
  const depth = new Int32Array(width * height).fill(-1);
  let current = new Uint8Array(width * height);
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) current[pixel] = mask.data[pixel] > 0 ? 1 : 0;
  for (let layer = 0; layer <= maxDepth; layer += 1) {
    const next = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        if (!current[pixel]) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
          || !current[pixel - 1] || !current[pixel + 1]
          || !current[pixel - width] || !current[pixel + width];
        if (edge) { if (depth[pixel] < 0) depth[pixel] = layer; } else next[pixel] = 1;
      }
    }
    current = next;
  }
  return depth;
}

/**
 * HARMONISE THE SEAM — the founder's forehead line, closed.
 *
 * A destination zone whose edge crosses skin leaves a faint tonal boundary:
 * repainted skin sits a whisper off master skin, and **feathering cannot hide a
 * tonal mismatch** — opacity blending between two slightly different tones
 * still lands on a visible line, it just makes it a soft one.
 *
 * So the band blends TONE, not only opacity. A single per-channel offset is
 * measured between the ring just inside the boundary and the ring just outside
 * it, then applied to the patch with a weight that fades to nothing as you move
 * inward — the boundary matches, the interior keeps whatever the edit intended.
 *
 * **The self-limit is the important part.** At a hair silhouette the master is
 * background and the patch is hair; they are SUPPOSED to differ, and dragging
 * one toward the other would grey the hairline. So the correction is scaled down
 * where master and patch already disagree strongly: a whisper is corrected, a
 * genuine content change is left alone. `TONE_MATCH_LIMIT` is where that judgement
 * sits, and it is a measured constant rather than a taste one — above it, the two
 * sides are different things rather than the same thing lit differently.
 */
const TONE_MATCH_LIMIT = 40;

export function harmonizeSeam(input: {
  master: Raster;
  patch: Raster;
  mask: Mask;
  bandPx?: number;
}): Raster {
  const { master, patch, mask } = input;
  const band = input.bandPx ?? 12;
  assertSameShape(master, patch, mask);

  const depth = depthInside(mask, band);
  /* The offset is read at the boundary itself, where the two sides should agree. */
  const totals = [0, 0, 0];
  let counted = 0;
  for (let pixel = 0; pixel < depth.length; pixel += 1) {
    if (depth[pixel] < 0 || depth[pixel] > 2) continue;
    const at = pixel * 3;
    const spread = Math.abs(master.data[at] - patch.data[at])
      + Math.abs(master.data[at + 1] - patch.data[at + 1])
      + Math.abs(master.data[at + 2] - patch.data[at + 2]);
    /* Only pixels where the two sides are the same KIND of thing inform the
       offset — a hairline in the ring must not drag the skin correction. */
    if (spread > TONE_MATCH_LIMIT * 3) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      totals[channel] += master.data[at + channel] - patch.data[at + channel];
    }
    counted += 1;
  }
  const out = Buffer.from(patch.data);
  if (counted === 0) return { data: out, width: patch.width, height: patch.height };
  const offset = totals.map((total) => total / counted);

  for (let pixel = 0; pixel < depth.length; pixel += 1) {
    if (depth[pixel] < 0) continue;
    const fade = 1 - Math.min(1, depth[pixel] / band);
    if (fade <= 0) continue;
    const at = pixel * 3;
    const spread = Math.abs(master.data[at] - patch.data[at])
      + Math.abs(master.data[at + 1] - patch.data[at + 1])
      + Math.abs(master.data[at + 2] - patch.data[at + 2]);
    /* Same self-limit, per pixel: correct a whisper, never a content change. */
    const trust = spread > TONE_MATCH_LIMIT * 3 ? 0 : 1;
    if (!trust) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      const index = at + channel;
      out[index] = Math.max(0, Math.min(255, Math.round(patch.data[index] + offset[channel] * fade)));
    }
  }
  return { data: out, width: patch.width, height: patch.height };
}

/**
 * MATCH THE GRAIN — the other half of the invisible-boundary requirement.
 *
 * A generated patch is smoother than a photograph. Even with tone matched, the
 * eye finds the boundary because one side has sensor noise and the other does
 * not, so both sides must share one texture.
 *
 * **The master's noise is measured, never copied.** Copying the master's
 * high-frequency content into the mask would drag the OLD content's edges in
 * with it — old strands ghosting through new hair, which is the record-lies
 * class arriving as pixels. So we measure the master's noise amplitude in a ring
 * just OUTSIDE the mask, measure the patch's inside, and if the patch is
 * smoother, add deterministic noise to close the gap. Nothing structural
 * crosses the boundary; only an amplitude.
 *
 * Deterministic by pixel index, so the same edit twice produces the same bytes —
 * a composite that varies run to run would make byte-identity untestable.
 *
 * # NOT ON THE CRITICAL PATH — measured off it, 2026-08-06
 *
 * **This function lays visible 64px tiles into textured content, and it is off
 * the finish path for that reason.** Reserve, not default.
 *
 * The finish ladder (`scripts/calibration/ear-routing.mts`) composited one
 * routed zone three ways — bare, tone, tone-and-grain — and the seam did not
 * move: 2.92, 2.91, 2.92 levels across the whole boundary. Neither step bought
 * anything, because the two changes UPSTREAM of them had already removed the
 * seam they were written for: the placement law took the boundary off open skin,
 * and the harvest matte took the visible edge from the paint rather than from a
 * geometric construct. A fix earns its place against the defect as it stands
 * now, not as it stood when the fix was written.
 *
 * Grain was worse than neutral. It moved **7.19% of the frame, up to 30 levels**,
 * and what that bought was a straight-edged rectangle inside a head of hair —
 * neighbouring tiles resolving to different amplitudes, with the tile boundary
 * showing as a hard line in a region that contains no hard lines
 * (`CROP-grain-in-hair.png`). Localising the amplitude fixed the speckled-skin
 * defect and minted a tiling one; the local version is not the global version
 * with the flaw removed, it is a different flaw.
 *
 * **If a genuine seam ever needs grain, the approach of record is the NOISE-PLATE
 * TRANSPLANT** — master minus blurred master, sampled from the same surface and
 * laid down as real grain — not another round of synthesis. Three rounds of
 * synthesis have now failed in three different ways, which indicts the approach
 * rather than the tuning.
 */
export function matchGrain(input: {
  master: Raster;
  patch: Raster;
  mask: Mask;
  ringPx?: number;
}): Raster {
  const { master, patch, mask } = input;
  const ring = input.ringPx ?? 6;
  assertSameShape(master, patch, mask);
  const { width, height } = mask;

  /** Local high-frequency energy: how far a pixel sits from its neighbours. */
  const highFrequency = (raster: Raster, pixel: number): number => {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return 0;
    const at = pixel * 3;
    let total = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const centre = raster.data[at + channel];
      total += Math.abs(4 * centre
        - raster.data[at - 3 + channel] - raster.data[at + 3 + channel]
        - raster.data[at - width * 3 + channel] - raster.data[at + width * 3 + channel]) / 4;
    }
    return total / 3;
  };

  /*
    LOCALLY, NOT GLOBALLY — and the global version was a real defect.

    One amplitude for a zone containing both smooth forehead and a hair edge
    over-serves whichever of the two it did not measure. It measured the hair
    edge, which is far busier, and then speckled the skin: visible at 100% zoom
    on the founder's own exhibit, which is what a failed acceptance criterion
    looks like when you write the number down honestly.

    So the frame is tiled, and each tile gets the amplitude ITS neighbourhood
    needs: the grain skin wants where the boundary crosses skin, the grain a hair
    edge wants at the edge. A tile with no master samples of its own — deep
    inside the zone, where there is no untouched neighbour to learn from —
    borrows from the nearest tile that has them rather than inventing a figure.
  */
  const TILE = 64;
  const tilesX = Math.ceil(width / TILE);
  const tilesY = Math.ceil(height / TILE);
  const masterSum = new Float64Array(tilesX * tilesY);
  const masterCount = new Int32Array(tilesX * tilesY);
  const patchSum = new Float64Array(tilesX * tilesY);
  const patchCount = new Int32Array(tilesX * tilesY);

  /*
    The tile's own patch tone, needed before the master is sampled at all —
    because a neighbourhood has to be local in CONTENT, not merely in space.

    Tiling alone was not enough and the picture said so: a tile straddling the
    hairline contains smooth forehead on the patch side and dark curls on the
    master side, so it measured HAIR grain and laid it on SKIN. Speckle, in
    exactly the place the acceptance criterion is about.

    So a master pixel only teaches a tile if it is the same KIND of surface as
    what the patch put there. Same reflex as `harmonizeSeam`'s self-limit: match
    like to like, and decline to learn from a neighbour that is a different
    thing.
  */
  const tileTone = new Float64Array(tilesX * tilesY);
  const tileToneCount = new Int32Array(tilesX * tilesY);
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (mask.data[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const tile = Math.floor(y / TILE) * tilesX + Math.floor(x / TILE);
    const at = pixel * 3;
    tileTone[tile] += (patch.data[at] + patch.data[at + 1] + patch.data[at + 2]) / 3;
    tileToneCount[tile] += 1;
  }

  const SAME_SURFACE = 42;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const tile = Math.floor(y / TILE) * tilesX + Math.floor(x / TILE);
    if (mask.data[pixel] === 0) {
      if (tileToneCount[tile] === 0) continue;
      const at = pixel * 3;
      const tone = (master.data[at] + master.data[at + 1] + master.data[at + 2]) / 3;
      /* Different surface — this pixel has nothing to teach about that one. */
      if (Math.abs(tone - tileTone[tile] / tileToneCount[tile]) > SAME_SURFACE) continue;
      masterSum[tile] += highFrequency(master, pixel);
      masterCount[tile] += 1;
    } else {
      patchSum[tile] += highFrequency(patch, pixel);
      patchCount[tile] += 1;
    }
  }

  const out = Buffer.from(patch.data);
  const amplitude = new Float64Array(tilesX * tilesY).fill(-1);
  for (let tile = 0; tile < amplitude.length; tile += 1) {
    if (masterCount[tile] < 16 || patchCount[tile] < 16) continue;
    const gap = masterSum[tile] / masterCount[tile] - patchSum[tile] / patchCount[tile];
    /* Only ever ADD grain. Smoothing a patch already grainier than the master
       would invent a cleanliness the photograph does not have. */
    amplitude[tile] = Math.max(0, Math.min(12, gap));
  }
  /* Borrow from the nearest measured tile rather than guessing. */
  const resolved = new Float64Array(amplitude.length);
  for (let tile = 0; tile < amplitude.length; tile += 1) {
    if (amplitude[tile] >= 0) { resolved[tile] = amplitude[tile]; continue; }
    const tx = tile % tilesX;
    const ty = Math.floor(tile / tilesX);
    let best = -1;
    let bestDistance = Infinity;
    for (let other = 0; other < amplitude.length; other += 1) {
      if (amplitude[other] < 0) continue;
      const distance = Math.abs((other % tilesX) - tx) + Math.abs(Math.floor(other / tilesX) - ty);
      if (distance < bestDistance) { bestDistance = distance; best = amplitude[other]; }
    }
    resolved[tile] = best < 0 ? 0 : best;
  }

  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (mask.data[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const local = resolved[Math.floor(y / TILE) * tilesX + Math.floor(x / TILE)];
    if (local <= 0) continue;
    /* A cheap deterministic hash — same pixel, same noise, every run. */
    let hash = (pixel * 2654435761) % 4294967296;
    hash ^= hash >>> 13;
    const jitter = ((hash % 2000) / 1000 - 1) * local;
    const at = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      const index = at + channel;
      out[index] = Math.max(0, Math.min(255, Math.round(patch.data[index] + jitter)));
    }
  }
  return { data: out, width: patch.width, height: patch.height };
}

function assertSameShape(master: Raster, patch: Raster, mask: Mask): void {
  /*
    DIMENSIONS ARE PART OF THE PROMISE, not a detail. The acceptance test
    requires the image's dimensions and format to stay constant across a whole
    session, so a patch that came back at a different size is a failed edit
    rather than something to scale into place — scaling it would smuggle the
    resample this module exists to avoid.
  */
  if (patch.width !== master.width || patch.height !== master.height) {
    throw new CompositeError(
      `patch is ${patch.width}x${patch.height}, master is ${master.width}x${master.height}`,
    );
  }
  if (mask.width !== master.width || mask.height !== master.height) {
    throw new CompositeError("mask does not match the master's dimensions");
  }
  /*
    ONE BYTE PER PIXEL, PROVEN RATHER THAN ASSUMED. Every loop in this module
    walks the mask one byte at a time and indexes the raster at `pixel * 3`; a
    mask carrying three channels would run three times too far, read `undefined`
    past the end, and report byte-identity for pixels it never compared. That
    actually happened, silently, and the tests passed. It cannot happen again
    without this throwing first.
  */
  if (mask.data.length !== mask.width * mask.height) {
    throw new CompositeError(
      `mask must be single-channel: ${mask.data.length} bytes for `
      + `${mask.width}x${mask.height} pixels`,
    );
  }
  if (master.data.length !== master.width * master.height * 3) {
    throw new CompositeError("master must be three-channel RGB");
  }
}

/**
 * The master, with only the masked pixels taken from the patch.
 *
 * Returned alongside the mask actually used, because the caller needs the
 * FEATHERED mask to state the guarantee — the hard mask it passed in is not the
 * one the arithmetic ran on.
 */
export async function compositeMasked(input: {
  master: Raster;
  patch: Raster;
  mask: Mask;
  featherRadius?: number;
  /**
   * THE OUTPUT-SIDE MATTE — founder-set, and it closes two observations at once.
   *
   * A destination zone is a padded region: where paint MAY go. Blending on its
   * boundary means the silhouette fades out on a uniform opacity ramp sitting
   * wherever the padding happened to stop — which is why a grown afro came back
   * with a halo, and why hair edges elsewhere read as steps rather than strands.
   * Both are the same defect: **the visible edge was taken from a geometric
   * construct instead of from the hair.**
   *
   * So the edge comes from a matte of the PAINTED RESULT — segment the patch,
   * and blend by the paint's own strand-and-coil-textured alpha. The zone stops
   * being the edge and becomes only the outer bound.
   *
   *   where paint MAY go   the zone
   *   where paint WENT     this matte
   *   the visible edge     belongs to the second
   *
   * **The zone is still feathered, and the first version of this was wrong.**
   *
   * It originally REFUSED a feather radius alongside a matte, reasoning that
   * feathering the bound would put the uniform ramp back underneath the matte
   * brought in to replace it. Looking at the result killed that: a subject matte
   * is uniformly opaque across the person, so it carries edge information at the
   * OUTER silhouette and none at all where the zone's own boundary runs through
   * the subject — the face carve-out. With the feather refused, that inner
   * boundary composited HARD, and the afro fix arrived with a cut-out edge round
   * the forehead that the uniform feather had never produced.
   *
   * `min(feather(zone), matte)` gets both, because the two ramps live in
   * different places. At the hair's real edge the zone is deep inside itself and
   * still 255, so the matte's strand-textured ramp governs alone. At the face
   * carve-out the matte is 255, so the feather governs alone. The zone's own
   * feather ramp sits far outside the hair where the matte is already 0, so it
   * contributes nothing and no halo returns.
   *
   * Where paint MAY go is the zone; where paint WENT is the matte; the visible
   * edge belongs to whichever of them actually knows about that boundary.
   */
  edgeMatte?: Mask;
}): Promise<{ composite: Raster; applied: Mask }> {
  const { master, patch } = input;
  const feathered = await featherMask(input.mask, input.featherRadius ?? 0);
  let applied: Mask;
  if (input.edgeMatte) {
    assertSameShape(master, patch, input.edgeMatte);
    /* min: whichever side actually knows about this boundary supplies its ramp.
       See the note on `edgeMatte` for why both are needed and why refusing the
       feather was a defect rather than a discipline. */
    const data = Buffer.allocUnsafe(feathered.data.length);
    for (let pixel = 0; pixel < data.length; pixel += 1) {
      data[pixel] = Math.min(feathered.data[pixel], input.edgeMatte.data[pixel]);
    }
    applied = { data, width: feathered.width, height: feathered.height };
  } else {
    applied = feathered;
  }
  assertSameShape(master, patch, applied);

  const out = Buffer.allocUnsafe(master.data.length);
  for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
    const alpha = applied.data[pixel];
    const at = pixel * 3;
    if (alpha === 0) {
      /*
        THE EXACT PATH, and it is exact on purpose. A blend of alpha=0 would
        round-trip through arithmetic and could land a byte off; copying is what
        makes "byte-identical" true rather than nearly true.
      */
      out[at] = master.data[at];
      out[at + 1] = master.data[at + 1];
      out[at + 2] = master.data[at + 2];
      continue;
    }
    if (alpha === 255) {
      out[at] = patch.data[at];
      out[at + 1] = patch.data[at + 1];
      out[at + 2] = patch.data[at + 2];
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      const index = at + channel;
      out[index] = Math.round(
        (master.data[index] * (255 - alpha) + patch.data[index] * alpha) / 255,
      );
    }
  }
  return {
    composite: { data: out, width: master.width, height: master.height },
    applied,
  };
}

export type OutsideVerdict = {
  /** True when every fully-unmasked pixel is byte-identical to the master. */
  identical: boolean;
  /** How many fully-unmasked pixels differ. Zero, or the edit is rejected. */
  changedPixels: number;
  /** Pixels in the feather band — blended by design, never counted as damage. */
  bandPixels: number;
};

/**
 * THE PROOF. Not a reader, not a score — a comparison.
 *
 * This is what the verification net's outside-the-mask half becomes. The net
 * still asks a vision model whether the EDIT happened (a presence question with
 * a real answer, per D-203's scope note), but whether anything else moved is
 * settled here, in bytes, for free, every time.
 */
export function outsideMaskUnchanged(
  master: Raster,
  composite: Raster,
  applied: Mask,
): OutsideVerdict {
  let changedPixels = 0;
  let bandPixels = 0;
  for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
    const alpha = applied.data[pixel];
    if (alpha === 255) continue;
    if (alpha !== 0) { bandPixels += 1; continue; }
    const at = pixel * 3;
    if (
      composite.data[at] !== master.data[at]
      || composite.data[at + 1] !== master.data[at + 1]
      || composite.data[at + 2] !== master.data[at + 2]
    ) changedPixels += 1;
  }
  return { identical: changedPixels === 0, changedPixels, bandPixels };
}

/**
 * How hard the seam works — the number the founder asked to score.
 *
 * Mean absolute difference between the composite and the master, measured ONLY
 * in the feather band. A low figure means the patch met the master already and
 * the feather merely tidied it; a high one means the feather is hiding a real
 * discontinuity, which is what a visible seam is. Reported per channel-byte on
 * the 0–255 scale so it reads as "how many levels does the blend have to move".
 */
export function seamBand(
  master: Raster,
  composite: Raster,
  applied: Mask,
): { meanDelta: number; maxDelta: number; pixels: number } {
  let total = 0;
  let max = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
    const alpha = applied.data[pixel];
    if (alpha === 0 || alpha === 255) continue;
    const at = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(composite.data[at + channel] - master.data[at + channel]);
      total += delta;
      if (delta > max) max = delta;
    }
    pixels += 1;
  }
  return { meanDelta: pixels ? total / (pixels * 3) : 0, maxDelta: max, pixels };
}
