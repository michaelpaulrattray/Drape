/**
 * THE FRAMING TRIM'S STEP — the arithmetic put on the roll road's bytes.
 * (Build `CASTING_FRAMING_TRIM_BUILD.md` §5, countersigned fable-1576.)
 *
 * `framingTrim.ts` decides WHERE to cut; this buys the two reads, applies the
 * cut, downscales to the delivered frame, and — above everything else it does —
 * **never fails the candidate.** The trim is a courtesy on top of a frame the
 * customer has already paid for and received: every path returns bytes, and a
 * path that cannot trim returns the frame it was given, downscaled to the same
 * delivered size, with a reason attached.
 *
 * # EVERY FRAME LEAVES HERE AT THE DELIVERED SIZE — trimmed or not
 *
 * Declining to trim used to return the RENDER bytes, so a sheet could ship six
 * frames at 1024x1536 and two at 1536x2304. That happened, in production, on
 * the founder's first flagged sheet (roll 209). The `untouched` closure below
 * carries the incident; the invariant is stated here because it is the thing a
 * caller is entitled to assume, and `framingTrimStep.test.ts`'s sheet arm is
 * what keeps it true.
 *
 * That is not politeness, it is the money. A roll is billed per slice and
 * refunded per slice; a trim that could throw would turn a segmenter hiccup into
 * a refund and a missing face, which is a worse product than a frame that is
 * merely not in the common frame.
 *
 * # THE TWO READS, and why there is no cheaper version
 *
 * `share` and `headroom` are FACE-box quantities and `gap` needs the HEAD box,
 * so the trim needs both — $0.005 each, $0.01 a slice, $0.08 a roll. The roll
 * road buys ZERO region reads today (`detectRenderFault` is a `sharp` greyscale
 * analysis and imports nothing else), so there is nothing to piggyback on. The
 * reads ride the shared courtesy pool (`FAL_CONCURRENCY`), declaring no new fal
 * allowance, which is what keeps `assertFalBudget`'s sum at the account ceiling.
 *
 * # WHAT IT RETURNS, AND WHY THE REASON TRAVELS
 *
 * The untrimmed reasons are counted, not merely logged: the rate of
 * `share-above-target` is what moves `T`, and it moves it on STRIPS rather than
 * on this arithmetic. A caller that drops the reason drops the only measurement
 * the dark rolls exist to take.
 */
import sharp from "sharp";

import { createModuleLogger } from "../logging/logger";

import { planFramingTrim, type TrimBox, type TrimTarget, type UntrimmedReason } from "./framingTrim";

const log = createModuleLogger("castingV2/framingTrim");

/** The frame a roll delivers today, and the one the trim downscales to. */
export const FRAMING_TRIM_DELIVERED = { width: 1024, height: 1536 } as const;
/** The frame a trimmed roll RENDERS at. Larger, so the cut is never an upscale. */
export const FRAMING_TRIM_RENDER = { width: 1536, height: 2304 } as const;

/**
 * The house target.
 *
 * `headShare` is the value the strips the founder chose were cut to — `T_min`
 * across the court's clause cells, i.e. the loosest common frame those fifteen
 * frames could all reach. His eye is the entire argument for it, and it moves
 * only the same way (build §4a).
 *
 * `clearance` is the smallest air above the hair that reads as deliberate rather
 * than as a near miss. A build constant, arbitrary within a range, and the range
 * is wide: 0.088 face-heights of slack on the tightest frame ever measured.
 */
export const FRAMING_TRIM_TARGET: TrimTarget = {
  headShare: 0.227,
  houseHeadroom: 0.35,
  clearance: 0.05,
};

/** What a caller needs to know afterwards, whichever way it went. */
export type FramingTrimOutcome = {
  /**
   * Always present, and ALWAYS at `FRAMING_TRIM_DELIVERED` — trimmed, or the
   * frame as rendered and downscaled to the same box. The only exception is a
   * resize that throws, which is logged and hands back what it was given
   * rather than failing a candidate.
   */
  bytes: Buffer;
  trimmed: boolean;
  /** Set when `trimmed` is false. Counted by the caller; it moves `T`. */
  why?: UntrimmedReason | "read-failed" | "trim-failed" | "no-dimensions";
  /** Set when `trimmed` is true — the headroom this frame actually received. */
  headroom?: number;
  /** True when this frame needed more air than the house floor gives. */
  ownHeadroom?: boolean;
};

/** The reader this step needs, named as a port so a test can drive it. */
export type FramingRegionReader = {
  region: (input: { image: Buffer; name: string; absentIsAnswer?: boolean }) => Promise<unknown>;
};

export type FramingTrimDependencies = {
  reader: FramingRegionReader;
  /** `extentOf` from the ink crop module — mask in, box out. */
  extentOf: (mask: unknown) => { box: TrimBox | null };
};

/**
 * Trim one delivered frame, or hand it back untouched with a reason.
 *
 * ⚠ **It cannot throw.** Every await is inside a catch, and the catch returns
 * the original bytes. A candidate is never failed by this step.
 */
export async function applyFramingTrim(
  dependencies: FramingTrimDependencies,
  input: { bytes: Buffer; target?: TrimTarget },
): Promise<FramingTrimOutcome> {
  const target = input.target ?? FRAMING_TRIM_TARGET;
  /*
    ⚠ AN UNTRIMMED FRAME IS STILL DELIVERED AT THE DELIVERED SIZE (ordered
    fable-1592 §1, from the defect read at his own first flagged sheet).

    This returned `input.bytes` — the 1536x2304 RENDER — so declining to trim
    silently changed what the product ships. Roll 209 is the specimen and it is
    production: six frames delivered at 1024x1536 and **two at 1536x2304, on one
    sheet**, read at the bytes rather than at a log line
    (`output/framing-live-roll-209/STRIP-B-true-scale-roll-209.png` is the
    picture — the two stand a head proud of their own row).

    That is the feature's own failure mode wearing its clothes: the whole point
    is a sheet that reads as framed alike, and a frame at 2.25x the area is the
    most visible way to break that. Everything downstream inherited it too —
    the thumbnail is built from these bytes.

    **The content is honest either way**: a frame is untrimmed because its own
    composition already sits at or tighter than the target, so a downscale of
    the large render IS its delivery — the frame at its own framing, at the
    size every other frame arrives in.

    It still cannot fail the candidate. A resize that throws returns the bytes
    it was given, which is the old behaviour as the LAST resort rather than the
    first.

    The `resize` call is the SAME shape the trimmed path uses two branches down,
    deliberately: both boxes are exactly 2:3, so this is a pure downscale and
    never a crop. A frame that came back at some other aspect would be covered
    to fit — the same thing the trimmed path would do to it — rather than
    shipping at an odd size, which is the defect this block exists to end.
  */
  const untouched = async (why: FramingTrimOutcome["why"]): Promise<FramingTrimOutcome> => {
    try {
      const bytes = await sharp(input.bytes)
        .resize({ width: FRAMING_TRIM_DELIVERED.width, height: FRAMING_TRIM_DELIVERED.height })
        .png()
        .toBuffer();
      return { bytes, trimmed: false, why };
    } catch (error) {
      log.warn(
        { err: String(error).slice(0, 160), why },
        "[framingTrim] an untrimmed frame could not be resized to the delivered size — "
        + "it is delivered as rendered, which is a frame of a different size on the sheet",
      );
      return { bytes: input.bytes, trimmed: false, why };
    }
  };

  let width: number;
  let height: number;
  try {
    const meta = await sharp(input.bytes).metadata();
    if (!meta.width || !meta.height) return await untouched("no-dimensions");
    width = meta.width;
    height = meta.height;
  } catch {
    return await untouched("no-dimensions");
  }

  let face: TrimBox | null;
  let head: TrimBox | null;
  try {
    /* Serial rather than parallel: two reads of one frame against a five-wide
       shared pool, and a roll already has eight slices in flight. Parallelism
       here buys a little latency per slice and spends it on everyone else's. */
    face = dependencies.extentOf(
      await dependencies.reader.region({ image: input.bytes, name: "face", absentIsAnswer: true }),
    ).box;
    head = dependencies.extentOf(
      await dependencies.reader.region({ image: input.bytes, name: "head", absentIsAnswer: true }),
    ).box;
  } catch (error) {
    /* OUR problem, not hers. */
    log.warn(
      { err: String(error).slice(0, 160) },
      "[framingTrim] a region read failed — the frame is delivered as rendered",
    );
    return await untouched("read-failed");
  }

  const plan = planFramingTrim({
    frame: { width, height },
    deliver: FRAMING_TRIM_DELIVERED,
    face, head, target,
  });
  if (!plan.trim) return await untouched(plan.why);

  try {
    const bytes = await sharp(input.bytes)
      .extract({
        left: plan.crop.left, top: plan.crop.top,
        width: plan.crop.width, height: plan.crop.height,
      })
      .resize({ width: FRAMING_TRIM_DELIVERED.width, height: FRAMING_TRIM_DELIVERED.height })
      .png()
      .toBuffer();
    return { bytes, trimmed: true, headroom: plan.headroom, ownHeadroom: plan.ownHeadroom };
  } catch (error) {
    log.warn(
      { err: String(error).slice(0, 160) },
      "[framingTrim] the cut itself failed — the frame is delivered as rendered",
    );
    return await untouched("trim-failed");
  }
}

/**
 * ⚠ THE MARGIN CLAUSE — the one sentence, applied the way the court applied it.
 *
 * `FRAMING_FIXED`'s landmark sentence is REPLACED, not appended to. That is not
 * a stylistic choice: ROUND2's specimen was an ADDED framing sentence which
 * widened its own population's spread by 5.0 points, and *context is not
 * additive* is a measured lesson in this campaign.
 *
 * **It is a post-composition swap on the finished prompt rather than a flag
 * threaded through the composer, and that is deliberate.** The court's own arms
 * produced their prompts as `composed.replace(FROM, TO)` — so doing it here
 * reproduces the bytes the founder's eye accepted, exactly, instead of a
 * differently-assembled prompt that ought to be the same. It also leaves
 * `cohortConstantBlocks` and every pin that recomposes it completely untouched.
 *
 * ⚠ **THE `FROM` IS THE FIRST SENTENCE ONLY.** The constant reads *"Frame from
 * mid-torso up in a 2:3 portrait. Shoulders fully inside the frame with margin
 * at both sides."* and the court replaced only the first of those, leaving the
 * shoulders clause standing after the new text. A swap that took both would be
 * a prompt no court has ever rendered.
 *
 * ⚠ **AND IT REPORTS WHETHER IT FOUND ANYTHING.** A `String.replace` that matches
 * nothing returns its input and says nothing — so an edit to `FRAMING_FIXED`
 * could silently disable this clause and leave a flagged roll rendering large
 * with no margin ask, which arm R measured as a TIGHTER picture than today. The
 * caller logs the miss loudly and renders anyway (a customer does not lose a
 * roll because a constant moved), and a unit arm asserts the sentence still
 * exists in the composed constant so the drift is caught at build time instead.
 */
export const FRAMING_CLAUSE_FROM = "Frame from mid-torso up in a 2:3 portrait.";
export const FRAMING_CLAUSE_TO = "Frame from the hips up in a 2:3 portrait. If in doubt include MORE "
  + "of the body rather than less — a little extra room below and at the sides is correct.";

export function applyFramingClause(prompt: string): { prompt: string; applied: boolean } {
  if (!prompt.includes(FRAMING_CLAUSE_FROM)) return { prompt, applied: false };
  return { prompt: prompt.replace(FRAMING_CLAUSE_FROM, FRAMING_CLAUSE_TO), applied: true };
}
