/**
 * THE COMPLETENESS GUARD AT THE LIBRARY'S DOOR.
 *
 * The founder looked at a tile captioned *"her hairstyle"* and saw a **fringe**.
 * Nothing in the system was wrong in a way any check could see: the crop was
 * well-formed, it sat inside its own region, it stored and it loaded. It simply
 * contained 12.5% of the hair it claimed to be, and every render that carried it
 * afterwards carried a haircut nobody asked for.
 *
 * So a reference does not enter the library because it was produced. It enters
 * because a **second, independent read of its own region on its own frame**
 * confirms it contains its subject (§2.4, fable-164/173).
 *
 * # The four things this refuses, and why each is its own reason
 *
 *  - **`subjectAbsent`** (fable-181) — *a reference cut from a frame that lacks
 *    its subject is a fabrication, whatever the cutter's quality.* Caught live
 *    when a cell tried to cut per-ear earring crops from a master whose ears are
 *    bare. The region read finding nothing is the honest answer, and it must not
 *    be rounded into a small crop.
 *  - **`readDidNotSettle`** — the read failed rather than answered. D-235's
 *    asymmetry: an affirmative without a reading is not a pass, and this is the
 *    door where a failed reading would otherwise become a confident yes.
 *  - **`noSpecimen`** — this kind has no positive specimen, so it has no
 *    threshold. It REFUSES rather than borrowing hair's number. A provisional
 *    threshold is a number nobody measured, wearing the clothes of one that was.
 *  - **`underCaptured`** — the fringe itself. Refused loudly; never stored
 *    quietly.
 *
 * And one more that is about the KEY rather than the pixels: **`duplicateOfSlot`**
 * — a crop byte-identical to another slot's crop is two rows holding one fact
 * (D-242, one layer up). `marks` and `makeup` at `face skin` produced exactly
 * this in production, three times.
 *
 * # THE INSTRUMENT, AND WHAT LABELS ITS CONTROLS
 *
 * Coverage is `|crop ∩ region| / |region|`, measured against a fresh full read
 * of the region on the frame the crop claims to represent. The intersection is
 * in the numerator on purpose: a crop that spills outside its region is a
 * different defect and must not be allowed to inflate the number the guard
 * thresholds on.
 *
 * The controls are labelled by a **verified outcome**, never by the ask that
 * produced them — the campaign has one expensive lesson about exactly that, and
 * this is the door it would have walked through next:
 *
 *   identity control   a region scored as its own crop reads 100.0%   (14 of 14)
 *   negative           the founder's fringe — HE looked at it and called it a
 *                      fringe; the instrument then read 12.5%
 *   positive           the delivered-anchored cut of v#163 — the crop that was
 *                      looked at and found to contain the hair; read 94.6%
 *
 * The label in both cases is a human verdict on the artifact; the number is the
 * instrument's reading of it. That is what makes them controls rather than a
 * threshold fitted to its own assumption.
 */
import type { Mask } from "./maskedComposite";
import type { SegmentBox } from "./segmentCuts";

/**
 * The specimens a kind's threshold is derived from, with their provenance.
 *
 * **One kind has both.** Every other kind refuses until somebody measures one,
 * which is fable-173's ruling and D-235's asymmetry as a default: no provisional
 * number, and the safe direction is to refuse a crop rather than to store one
 * that quietly forgets a feature.
 */
export type CompletenessSpecimens = {
  /** Coverage the instrument read on a crop a human verdict called complete. */
  positive: number;
  /** Coverage it read on one a human verdict called incomplete. */
  negative: number;
  source: string;
};

export const COMPLETENESS_SPECIMENS: Readonly<Record<string, CompletenessSpecimens>> = {
  hair: {
    positive: 0.946,
    negative: 0.125,
    source: "D-243 store audit: the delivered-anchored cut of v#163 against row 13, the founder's fringe",
  },
};

/**
 * The bar for a kind: **the coverage of the one crop we have proven complete.**
 *
 * Not the midpoint of the two specimens. A midpoint is a number nobody
 * measured, and the two errors are not symmetric — a refused crop costs a
 * retry, an accepted fringe costs a feature the product then carries forward
 * as if it were hers. When more positive specimens exist the bar becomes the
 * worst of them, which is a widening backed by measurement rather than a
 * softening backed by inconvenience.
 */
export function thresholdFor(kind: string): number | null {
  const specimens = COMPLETENESS_SPECIMENS[kind];
  return specimens ? specimens.positive : null;
}

export type CoverageReading = {
  /** `|crop ∩ region| / |region|` — how much of the subject the crop contains. */
  coverage: number;
  /** `|crop \ region| / |crop|` — how much of the crop is not the subject. */
  spill: number;
  regionPixels: number;
  cropPixels: number;
};

/**
 * Score a crop's mask against a full-frame region read.
 *
 * The crop's mask is in its own box's coordinates; the region is the whole
 * frame. Walking the box and offsetting into the frame is the arithmetic, and
 * it is the arithmetic the identity control exists to check: a bbox error would
 * drive coverage down and spill up together.
 */
export function measureCoverage(
  crop: { mask: Mask; box: SegmentBox },
  region: Mask,
): CoverageReading {
  let intersect = 0;
  let cropPixels = 0;
  for (let y = 0; y < crop.box.height; y += 1) {
    for (let x = 0; x < crop.box.width; x += 1) {
      if (crop.mask.data[y * crop.mask.width + x] === 0) continue;
      cropPixels += 1;
      const frameX = crop.box.x + x;
      const frameY = crop.box.y + y;
      if (frameX < 0 || frameY < 0 || frameX >= region.width || frameY >= region.height) continue;
      if (region.data[frameY * region.width + frameX]! > 0) intersect += 1;
    }
  }
  let regionPixels = 0;
  for (let index = 0; index < region.width * region.height; index += 1) {
    if (region.data[index]! > 0) regionPixels += 1;
  }
  return {
    coverage: regionPixels === 0 ? 0 : intersect / regionPixels,
    spill: cropPixels === 0 ? 0 : (cropPixels - intersect) / cropPixels,
    regionPixels,
    cropPixels,
  };
}

export type GuardPass = {
  ok: true;
  kind: string;
  reading: CoverageReading;
  threshold: number;
};

export type GuardRefusal = {
  ok: false;
  reason: "subjectAbsent" | "readDidNotSettle" | "noSpecimen" | "underCaptured" | "duplicateOfSlot";
  kind: string;
  detail: string;
  /** Present when a reading happened — a refusal nobody can diagnose is a
   *  refusal somebody will disable. */
  reading?: CoverageReading;
};

export type GuardVerdict = GuardPass | GuardRefusal;

export type GuardInput = {
  /** The specimen family whose threshold applies — `hair`, `lips`, `earring`. */
  kind: string;
  /** The proposed crop, as cut. */
  crop: { mask: Mask; box: SegmentBox };
  /** Digest of the crop's bytes, for the duplicate check. */
  digest: string;
  /**
   * A SECOND, INDEPENDENT full read of this crop's region on the frame the crop
   * claims to represent.
   *
   * The guard performs it through {@link mintGuardedReference}'s injected reader
   * rather than accepting one from the caller, because a guard handed its
   * subject's own read is the checker that cannot fail (fable-173). `null` means
   * the read did not settle, which is not the same as finding nothing.
   */
  guardRead: Mask | null;
  /** Digests already in the library, by slot. Two rows may not hold one fact. */
  mintedDigests?: ReadonlyMap<string, string>;
};

export function guardReference(input: GuardInput): GuardVerdict {
  if (input.guardRead === null) {
    return {
      ok: false, reason: "readDidNotSettle", kind: input.kind,
      detail: `the guard's read of ${input.kind} did not settle, so nothing here is evidence either way`,
    };
  }

  const reading = measureCoverage(input.crop, input.guardRead);

  if (reading.regionPixels === 0) {
    /*
      fable-181. The frame does not wear the thing, so any crop of it is a
      picture of where the thing would have been — which is a fabrication with a
      well-formed bounding box.
    */
    return {
      ok: false, reason: "subjectAbsent", kind: input.kind, reading,
      detail: `the frame carries no ${input.kind}, so a crop of it would be a reference to nothing`,
    };
  }

  const duplicate = Array.from(input.mintedDigests?.entries() ?? [])
    .find(([, digest]) => digest === input.digest);
  if (duplicate) {
    return {
      ok: false, reason: "duplicateOfSlot", kind: input.kind, reading,
      detail: `this crop is byte-identical to ${duplicate[0]}'s, and two slots may not hold one fact`,
    };
  }

  const threshold = thresholdFor(input.kind);
  if (threshold === null) {
    /*
      No positive specimen for this kind. The guard cannot say what complete
      looks like here, and borrowing hair's number would be a measurement about
      hair adjudicating a lip. So it refuses — visibly, with the reading
      attached, so the refusal is also the thing that produces the specimen.
    */
    return {
      ok: false, reason: "noSpecimen", kind: input.kind, reading,
      detail: `${input.kind} has no completeness specimen yet; it read ${(reading.coverage * 100).toFixed(1)}% and no number here is earned`,
    };
  }

  if (reading.coverage < threshold) {
    return {
      ok: false, reason: "underCaptured", kind: input.kind, reading,
      detail: `${input.kind} crop covers ${(reading.coverage * 100).toFixed(1)}% of its own region, under the ${(threshold * 100).toFixed(1)}% proven complete`,
    };
  }

  return { ok: true, kind: input.kind, reading, threshold };
}

/** Reads a region on a frame. `null` when the reading did not settle. */
export type RegionReader = (input: { frame: Buffer; question: string }) => Promise<Mask | null>;

export type MintInput = {
  kind: string;
  /** The segmentation question that names this kind's region. */
  question: string;
  /** The frame the crop claims to represent — the one the guard reads. */
  frame: Buffer;
  crop: { mask: Mask; box: SegmentBox };
  digest: string;
  mintedDigests?: ReadonlyMap<string, string>;
};

/**
 * Mint a reference, or refuse it — with the guard's read taken HERE.
 *
 * The independence is structural rather than promised: the caller supplies a
 * reader, not a read, so it cannot hand the guard the same mask that cut the
 * crop. **It costs one vision call per reference minted**, and that is the
 * declared price of the fringe never entering the library again.
 */
export async function mintGuardedReference(
  input: MintInput,
  read: RegionReader,
): Promise<GuardVerdict> {
  let guardRead: Mask | null = null;
  try {
    guardRead = await read({ frame: input.frame, question: input.question });
  } catch {
    guardRead = null; /* a throw is a reading that did not happen, not a no */
  }
  return guardReference({
    kind: input.kind,
    crop: input.crop,
    digest: input.digest,
    guardRead,
    mintedDigests: input.mintedDigests,
  });
}
