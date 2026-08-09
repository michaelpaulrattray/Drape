/**
 * Three-source assembly — the compositor half of segment permanence.
 *
 * Spec: fable-088. A delivered frame is built from three sources, in a fixed
 * order that is the whole design:
 *
 *   1. **the master**, full frame, always the base;
 *   2. **carried segments** — every live segment for this face whose facet the
 *      current edit does NOT write, oldest first;
 *   3. **the fresh paint**, last, because the current ask outranks every
 *      memory.
 *
 * One rule governs every intersection: **later wins, and every resolution is
 * recorded.** Paint over segment, segment over segment — the same rule, no
 * special cases. Recency is the user's own edit order, and a recorded
 * resolution can be audited where a silent one cannot.
 *
 * # No new feathering, deliberately
 *
 * A segment's stored mask carries the feather it was delivered with, and it
 * re-applies against the SAME master pixels at the same boundary. It is not a
 * new seam — it is the seam that already passed when it was delivered, which is
 * the argument that lets the seam instrument's calibration transfer unchanged.
 *
 * # The two failures are not the same failure
 *
 * One segment's object missing degrades that facet alone: the render proceeds,
 * loudly, and permanence is lost for one thing rather than for her whole edit.
 * A store that cannot be read at all is the opposite — a face composited from a
 * partial list looks exactly like a correct render, which is the silently-short
 * paste, and that never ships. That refusal lives at the call site, because
 * this module is only ever given a list it can trust.
 */
import type { Mask, Raster } from "./maskedComposite";
import type { SegmentBox } from "./segmentCuts";

export type CarriedSegment = {
  id: number;
  facet: string;
  version: number;
  /** Cropped to `box`, one byte per pixel — used as the paste's alpha. */
  mask: Mask;
  /** Cropped to `box`, the delivered pixels this segment owns. */
  content: Raster;
  box: SegmentBox;
  /** The frame these were cut from. Never resampled to fit another. */
  frame: { width: number; height: number };
};

export type SegmentExclusion = {
  id: number;
  facet: string;
  /**
   * Why this kept thing is not in her picture.
   *
   * `objectMissing` is raised by the loader rather than here, and it lives in
   * the same union on purpose: one list of what did not make it into the
   * frame, whatever the reason. Two lists would be two places to forget to
   * read, and a degradation nobody reads is a silent one.
   */
  reason: "frameMismatch" | "boxOutsideFrame" | "shapeMismatch" | "objectMissing";
  detail: string;
};

export type AssemblyEvidence = {
  /**
   * Where the assembled frame is allowed to differ from the master: the fresh
   * paint's own region UNION every carried segment's mask.
   *
   * The union rather than the paint's mask alone, because the verification
   * step's whole argument is "outside this, the picture IS the master" — and a
   * carried segment moves pixels the paint never touched. Leaving them out
   * would let the composite claim byte-identity over pixels it had changed,
   * which is the overclaim class.
   */
  applied: Mask;
  segmentsApplied: Array<{ id: number; facet: string; version: number; pixels: number }>;
  segmentsExcluded: SegmentExclusion[];
  /** Every place two sources wanted the same pixels, and who won. */
  intersections: Array<{ winner: string; loser: string; pixels: number }>;
  /**
   * A kept thing being painted over — more than half its mask claimed by the
   * fresh paint. Not an error and not acted on here: it is the signal that a
   * later edit is superseding an earlier one, which the report needs to see.
   */
  supersededCandidates: Array<{ id: number; facet: string; coverage: number }>;
};

export type AssemblyResult = {
  raster: Raster;
  evidence: AssemblyEvidence;
  /** Which facets are in the picture because a segment was pasted. */
  carriedFacets: string[];
};

function emptyMask(width: number, height: number): Mask {
  return { data: Buffer.alloc(width * height), width, height };
}

function boxFits(box: SegmentBox, frame: { width: number; height: number }): boolean {
  return box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0
    && box.x + box.width <= frame.width && box.y + box.height <= frame.height;
}

/**
 * Build the delivered frame.
 *
 * With no carried segments and a fresh paint, the output is **byte-identical to
 * the paint's own composite** — the regression anchor the spec asks for.
 * Nothing about a segmentless render may change, and the way that is guaranteed
 * is structural rather than tested-into-place: the fresh layer is a copy of
 * `painted` wherever `applied` claims anything, and `painted` is already the
 * master everywhere else.
 */
export function assembleComposite(input: {
  master: Raster;
  /** The harvest's composite: the master outside `applied`, the paint inside. */
  painted?: Raster | null;
  applied?: Mask | null;
  carried: readonly CarriedSegment[];
}): AssemblyResult {
  const frame = { width: input.master.width, height: input.master.height };
  const out: Raster = {
    data: Buffer.from(input.master.data),
    width: frame.width,
    height: frame.height,
  };

  const appliedUnion = emptyMask(frame.width, frame.height);
  /** Which source currently owns each pixel, for recording resolutions. */
  const owner = new Array<string | null>(frame.width * frame.height).fill(null);
  const evidence: AssemblyEvidence = {
    applied: appliedUnion,
    segmentsApplied: [],
    segmentsExcluded: [],
    intersections: [],
    supersededCandidates: [],
  };
  const carriedFacets: string[] = [];
  const contested = new Map<string, number>();

  const claim = (pixel: number, by: string): void => {
    const held = owner[pixel];
    if (held && held !== by) {
      /* Later wins — the paste has already happened by the time this runs, so
         the record is of who lost rather than of a decision still to make. */
      const key = `${by}	${held}`;
      contested.set(key, (contested.get(key) ?? 0) + 1);
    }
    owner[pixel] = by;
    appliedUnion.data[pixel] = 255;
  };

  for (const segment of input.carried) {
    if (segment.frame.width !== frame.width || segment.frame.height !== frame.height) {
      /*
        NEVER SCALED. Resampling a kept edit is resampling the exact signal
        permanence exists to protect, and a paste onto a differently-sized frame
        does not fail — it lands her freckles somewhere else on her face.
      */
      evidence.segmentsExcluded.push({
        id: segment.id,
        facet: segment.facet,
        reason: "frameMismatch",
        detail: `${segment.frame.width}×${segment.frame.height} against ${frame.width}×${frame.height}`,
      });
      continue;
    }
    if (!boxFits(segment.box, frame)) {
      evidence.segmentsExcluded.push({
        id: segment.id,
        facet: segment.facet,
        reason: "boxOutsideFrame",
        detail: `${segment.box.x},${segment.box.y} ${segment.box.width}×${segment.box.height}`,
      });
      continue;
    }
    if (
      segment.mask.width !== segment.box.width || segment.mask.height !== segment.box.height
      || segment.content.width !== segment.box.width || segment.content.height !== segment.box.height
    ) {
      evidence.segmentsExcluded.push({
        id: segment.id,
        facet: segment.facet,
        reason: "shapeMismatch",
        detail: `mask ${segment.mask.width}×${segment.mask.height}, content ${segment.content.width}×${segment.content.height}`,
      });
      continue;
    }

    const source = `${segment.facet}@v${segment.version}`;
    let pixels = 0;
    for (let y = 0; y < segment.box.height; y += 1) {
      for (let x = 0; x < segment.box.width; x += 1) {
        const local = y * segment.box.width + x;
        const alpha = segment.mask.data[local];
        if (alpha === 0) continue;
        const pixel = (segment.box.y + y) * frame.width + (segment.box.x + x);
        const at = pixel * 3;
        const from = local * 3;
        if (alpha === 255) {
          out.data[at] = segment.content.data[from];
          out.data[at + 1] = segment.content.data[from + 1];
          out.data[at + 2] = segment.content.data[from + 2];
        } else {
          /* A stored mask may carry the feather it was delivered with; blending
             against the master reproduces the boundary it already passed. */
          for (let channel = 0; channel < 3; channel += 1) {
            out.data[at + channel] = Math.round(
              (segment.content.data[from + channel] * alpha + out.data[at + channel] * (255 - alpha)) / 255,
            );
          }
        }
        claim(pixel, source);
        pixels += 1;
      }
    }

    evidence.segmentsApplied.push({
      id: segment.id,
      facet: segment.facet,
      version: segment.version,
      pixels,
    });
    if (!carriedFacets.includes(segment.facet)) carriedFacets.push(segment.facet);
  }

  if (input.painted && input.applied) {
    const applied = input.applied;
    if (applied.width !== frame.width || applied.height !== frame.height) {
      throw new Error("the applied mask does not match the frame being assembled");
    }
    if (input.painted.width !== frame.width || input.painted.height !== frame.height) {
      throw new Error("the painted frame does not match the master being assembled");
    }
    /*
      A COPY, not a blend — and that is what makes the zero-segment case
      byte-identical. `painted` already carries the harvest's own feather inside
      `applied`; re-blending it here would apply that ramp twice.
    */
    for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
      if (applied.data[pixel] === 0) continue;
      const at = pixel * 3;
      out.data[at] = input.painted.data[at];
      out.data[at + 1] = input.painted.data[at + 1];
      out.data[at + 2] = input.painted.data[at + 2];
      claim(pixel, "fresh paint");
    }

    for (const applied_ of evidence.segmentsApplied) {
      const segment = input.carried.find((candidate) => candidate.id === applied_.id)!;
      let covered = 0;
      for (let y = 0; y < segment.box.height; y += 1) {
        for (let x = 0; x < segment.box.width; x += 1) {
          if (segment.mask.data[y * segment.box.width + x] === 0) continue;
          const pixel = (segment.box.y + y) * frame.width + (segment.box.x + x);
          if (applied.data[pixel] > 0) covered += 1;
        }
      }
      const coverage = applied_.pixels === 0 ? 0 : covered / applied_.pixels;
      if (coverage > 0.5) {
        evidence.supersededCandidates.push({
          id: applied_.id,
          facet: applied_.facet,
          coverage: Math.round(coverage * 1000) / 1000,
        });
      }
    }
  }

  for (const [key, pixels] of Array.from(contested.entries())) {
    const [winner, loser] = key.split("	");
    evidence.intersections.push({ winner, loser, pixels });
  }

  return { raster: out, evidence, carriedFacets };
}
