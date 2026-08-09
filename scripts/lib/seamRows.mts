/**
 * THE SEAM VERDICT ON A ROW, READ IN ONE PLACE.
 *
 * `sweep-seam-rows-disposable.mts` had the mapping and its two synthetic control
 * rows inline, which was correct while it was the only reader. The finding-replay
 * walk's control C needs the same reading — *can this instrument express the
 * founder's defect at all?* — and a second copy of a control is a control that
 * drifts from the thing it is checking (law 4). So the mapping, the two control
 * rows and the two rates live here, and both callers ask this module.
 *
 * # The two numbers, and why one of them exists
 *
 * - **amplitude** — `worstExcess`, the biggest step across the boundary; a TEAR,
 *   thresholded at 80 levels by the detector.
 * - **coherence** — `|signedMean| / signedSpread`; a BLEND SEAM, the small
 *   consistent offset the eye integrates along an edge. The founder's own
 *   complaint scored **zero pixels over the tear bar** and 1.118 coherence in his
 *   band against 0.020 for the whole boundary. The amplitude instrument cannot
 *   express his defect at any threshold, which is the whole reason coherence is
 *   recorded.
 */

export type SeamRow = {
  id: number;
  requestText: string;
  landed: boolean;
  torn: boolean;
  enforced: boolean;
  boundaryPixels: number;
  tornPixels: number;
  share: number;
  worstExcess: number;
  signedMean?: number;
  signedSpread?: number;
  coherence?: number;
};

/**
 * TWO ROWS THE READER MUST BE ABLE TO TELL APART.
 *
 * An ordinary clean boundary, and the founder's shirt seam — his numbers, from
 * the boundary he called *"like it was pasted there"*. A reader whose only output
 * for weeks is "nothing yet" has not been shown able to print anything, so its
 * silence is worth nothing until it has passed these two.
 */
export const SEAM_CONTROL_ROWS = [
  {
    id: 1,
    requestText: "[control] a clean boundary",
    status: "ready",
    internalPrompt: {
      seam: {
        torn: false, enforced: false, boundaryPixels: 38_592, tornPixels: 0,
        share: 0, worstExcess: 41.2, signedMean: 0.39, signedSpread: 19.76, coherence: 0.020,
      },
    },
  },
  {
    id: 2,
    requestText: "[control] the founder's shirt seam",
    status: "ready",
    internalPrompt: {
      seam: {
        torn: false, enforced: false, boundaryPixels: 3_080, tornPixels: 0,
        share: 0, worstExcess: 73.1, signedMean: -10.31, signedSpread: 9.22, coherence: 1.118,
      },
    },
  },
] as const;

/** The band the founder's own seam sits in — the number a control must reproduce. */
export const FOUNDER_SEAM_COHERENCE = 1.118;
/** And the whole-boundary reading of the same frame, which expressed nothing. */
export const CLEAN_BOUNDARY_COHERENCE = 0.020;

function parseJson(value: unknown): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return value;
}

/**
 * A variant row's seam verdict, or null where the row carries none.
 *
 * Null is not "clean". Every render before `acc5b4f1` has no seam key at all, so
 * the caller must report the denominator rather than counting absences as passes.
 */
export function readSeamRow(row: {
  id: number;
  requestText?: string | null;
  status?: string | null;
  internalPrompt?: unknown;
}): SeamRow | null {
  const seam = parseJson(row.internalPrompt)?.seam;
  if (!seam) return null;
  return {
    id: row.id,
    requestText: row.requestText ?? "",
    landed: row.status === "ready",
    torn: Boolean(seam.torn),
    enforced: Boolean(seam.enforced),
    boundaryPixels: Number(seam.boundaryPixels ?? 0),
    tornPixels: Number(seam.tornPixels ?? 0),
    share: Number(seam.share ?? 0),
    worstExcess: Number(seam.worstExcess ?? 0),
    ...(seam.signedMean === undefined ? {} : { signedMean: Number(seam.signedMean) }),
    ...(seam.signedSpread === undefined ? {} : { signedSpread: Number(seam.signedSpread) }),
    ...(seam.coherence === undefined ? {} : { coherence: Number(seam.coherence) }),
  };
}

/** The two rates, each against its own denominator. */
export function seamRates(seams: readonly SeamRow[]): {
  torn: number;
  total: number;
  coherence: { n: number; mean: number; median: number; max: number } | null;
} {
  const values = seams
    .map((seam) => seam.coherence)
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b);
  return {
    torn: seams.filter((seam) => seam.torn).length,
    total: seams.length,
    coherence: values.length === 0 ? null : {
      n: values.length,
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: values[Math.floor(values.length / 2)],
      max: values[values.length - 1],
    },
  };
}
