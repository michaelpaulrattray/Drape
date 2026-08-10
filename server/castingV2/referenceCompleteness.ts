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
 *  - **`disputedDelivery`** (fable-220 §3) — the ask WROTE this slot's facet and
 *    the render's own reader then said the change is not in the picture. Nothing
 *    is wrong with the crop as a crop; what is unsettled is whether the painter
 *    failed or the reader did. It may not enter the library — the previous
 *    version stays newest and stays good — and its pixels are the only artifact
 *    that can settle which of the two was wrong.
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
import type { Instance } from "./referenceSlots";
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

/**
 * Every way the door says no, in one list.
 *
 * Named rather than inlined because the library row now RECORDS the reason
 * (migration 0029), and a stored string whose legal values live only inside a
 * type annotation is a column nobody can validate at the write.
 */
export const GUARD_REFUSAL_REASONS = [
  "subjectAbsent",
  "readDidNotSettle",
  "noSpecimen",
  "underCaptured",
  "duplicateOfSlot",
  "disputedDelivery",
] as const;

export type GuardRefusalReason = typeof GUARD_REFUSAL_REASONS[number];

/**
 * The refusals whose PIXELS are kept (fable-214 option (ii), fable-220 §3).
 *
 * Both are refusals that exist **in order to be settled by a human looking at
 * the picture**, and neither is a judgement that the crop is bad:
 *
 *   `noSpecimen`        the kind has no measured positive, so the guard cannot
 *                       say what complete looks like here. The crop is the only
 *                       thing that can teach it.
 *   `disputedDelivery`  the ask wrote this facet and the reader said it did not
 *                       land. The crop is the only thing that can say which of
 *                       the two was wrong.
 *
 * The other four refuse a picture that must not be adopted: `subjectAbsent` is a
 * crop of where the thing would have been, `duplicateOfSlot` already has its
 * bytes at another slot, `underCaptured` was measured against a real bar and
 * refused correctly, and `readDidNotSettle` scored nothing at all. Keeping any
 * of those would build a gallery of exactly the crops the guard exists to keep
 * out, and put it in front of the one person able to adopt them.
 */
export const REFUSALS_THAT_KEEP_THEIR_CROP: readonly GuardRefusalReason[] = [
  "noSpecimen",
  "disputedDelivery",
];

export function refusalKeepsItsCrop(reason: GuardRefusalReason): boolean {
  return REFUSALS_THAT_KEEP_THEIR_CROP.includes(reason);
}

/**
 * THE REFUSAL WHOSE ROW IS EVIDENCE AND NOT A VERSION (`referenceLibrary`'s fold).
 *
 * Every other row this table holds is an account of what a feature IS, and the
 * newest one per (slot, role) is the branch's answer. A `disputedDelivery` row
 * is not that. It is a question — *did the ask land?* — parked beside the
 * pixels that answer it, and the render that raised it delivered no verified
 * account of the feature at all.
 *
 * So the fold skips it, and the consequence is the point: **the slot's previous
 * version stays newest and stays good.** Without this the row would be the
 * newest carry row, it carries no `storageKey`, and the crop that was riding
 * into every prompt would silently stop — a disputed ask quietly changing what
 * the painter sees on the NEXT paid render. That is delivery, and fable-220 §3
 * ruled delivery untouched: only the pixels gain an afterlife.
 *
 * Named separately from {@link REFUSALS_THAT_KEEP_THEIR_CROP} because it is a
 * different property that happens to coincide on one reason today. `noSpecimen`
 * IS a version — that render earned its slot, the words moved on, and a crop
 * nobody could certify is honestly reported as a slot with words and no picture.
 */
export const REFUSAL_THAT_IS_EVIDENCE_ONLY: GuardRefusalReason = "disputedDelivery";

export type GuardRefusal = {
  ok: false;
  reason: GuardRefusalReason;
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
  /**
   * THIS ASK WROTE THE FACET AND THE RENDER'S OWN READER DISPUTED IT.
   *
   * Not a property of the crop — a property of the render behind it. It arrives
   * here rather than being applied to the verdict afterwards so that the whole
   * precedence lives in one function: the three refusals ABOVE it are about
   * whether this is a real, unique picture of the subject at all, and they win,
   * because a crop of nothing settles nothing. Everything BELOW it is a
   * completeness judgement, and no completeness number can decide a question
   * about delivery.
   */
  disputed?: boolean;
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

  /*
    AND HERE, BEFORE ANY THRESHOLD IS CONSULTED (fable-220 §3).

    A disputed crop is refused however well it measures, because the question it
    fails is not a question about the crop. The ask wrote this facet; the render's
    own reader looked at the delivered frame and said the change is not there. Two
    things follow, and they are the whole design:

      the library does not move    an unverified delivery may not become what the
                                   next render KNOWS this feature is. The previous
                                   version stays newest and stays good — D-235's
                                   asymmetry, which the `earned` gate has always
                                   applied one layer up by filing nothing at all.
      the pixels stay              because "the reader was wrong" and "the painter
                                   was wrong" are indistinguishable from the row,
                                   and identical from every instrument we have.
                                   The crop is the artifact that separates them,
                                   and a human is the instrument.

    D-246 disarmed subtle-quality detectors as gates on money. This is the same
    class one layer down, gating PIXELS: billing and delivery are untouched
    (D-187/D-246 — the ask stayed delivered and charged), and all that changes is
    that a disputed facet's crop now has an afterlife for human eyes.
  */
  if (input.disputed) {
    return {
      ok: false, reason: "disputedDelivery", kind: input.kind, reading,
      detail: `this render's reader disputed that the ask landed on ${input.kind}; the crop reads ${(reading.coverage * 100).toFixed(1)}% and is kept for a human rather than adopted`,
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

/**
 * Reads a region on a frame. `null` when the reading did not settle.
 *
 * `side` narrows the question to one instance of a bilateral region, and it is
 * not decoration: a crop of `earring@left` scored against a read of BOTH hoops
 * measures about half of a region it fully contains, and the guard would file
 * that number as the kind's first specimen. A reader that cannot scope to a
 * side must return `null` when asked for one — `readDidNotSettle` is the honest
 * outcome, and it is the one refusal that records no number at all.
 */
export type RegionReader = (
  input: { frame: Buffer; question: string; side?: Instance },
) => Promise<Mask | null>;

export type MintInput = {
  kind: string;
  /** The segmentation question that names this kind's region. */
  question: string;
  /** Which instance of it, for a slot that is one of a pair. */
  side?: Instance;
  /** The frame the crop claims to represent — the one the guard reads. */
  frame: Buffer;
  crop: { mask: Mask; box: SegmentBox };
  digest: string;
  mintedDigests?: ReadonlyMap<string, string>;
  /** This ask wrote the facet and the render's reader disputed the delivery. */
  disputed?: boolean;
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
    guardRead = await read({ frame: input.frame, question: input.question, side: input.side });
  } catch {
    guardRead = null; /* a throw is a reading that did not happen, not a no */
  }
  return guardReference({
    kind: input.kind,
    crop: input.crop,
    digest: input.digest,
    guardRead,
    mintedDigests: input.mintedDigests,
    disputed: input.disputed,
  });
}
