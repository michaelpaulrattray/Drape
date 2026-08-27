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
 * `headShare` is `T_min` across the court's NO-CLAUSE control cells — the
 * loosest common frame those sixteen frames can all reach. **A crop only ever
 * crops IN**, so a frame whose own share already exceeds `T` cannot be trimmed
 * to it and is delivered untrimmed instead; `T` is therefore the smallest value
 * every frame in the population can reach, not an average of them.
 *
 * ⚠ **IT WAS 0.227 UNTIL 2026-08-24, AND THE MOVE IS THE RETARGET, NOT A TUNING**
 * (ruled fable-1648). 22.7% was `T_min` across the court's CLAUSE cells — a
 * population that no longer exists, because the founder retired the margin
 * clause on his own eye (*painted detail follows composition, not resolution*).
 * A constant chosen at the geometry of a population the product no longer
 * produces is a constant measuring the wrong thing.
 *
 * Re-derived from rows already on disk — no new frames and no spend — by
 * `scripts/_framing-tmin-noclause-disposable.mts`, which imports the court's own
 * `tMinOf` rather than re-deriving the arithmetic and **reproduces the court's
 * published table cell for cell, binding frames included**, before asking anyone
 * to believe its new row:
 *
 *   suit-control-b   n=8   share med 28.9%   T_min 34.3%   binding pos5
 *   basics-control   n=8   share med 23.7%   T_min 29.4%   binding pos6
 *   BOTH CONTROLS    n=16  share med 25.7%   T_min 34.3%   binding suit-b/pos5
 *
 * ⚠ **Sixteen frames is not a population and the binding frame is ONE
 * position.** What makes that acceptable rather than sloppy is the kept
 * original (`sourceKey`, migration 0053): `T` is a SLIDER over bytes we already
 * hold, so being slightly wrong costs a re-trim rather than a re-cast — instant,
 * free, and the same faces. The first dark rolls' untrimmed rate is what
 * confirms it, and at a HIGHER `T` that rate can only be lower than the clause
 * era's, since raising `T` admits more frames rather than fewer.
 *
 * ⚠ **The `PASS ≤ 26.0%` margin bar this figure fails is RETIRED**, on the
 * record and with its premise named (fable-1648): it measured the clause era's
 * COST, where tightening was the price of consistency. The founder reversed the
 * goal — closeness is now the point, not the price — so it is not a failed bar,
 * it is the wrong instrument. What replaces it is his own surviving condition,
 * *"just need to make sure the hair is fully in the image"*, encoded as the
 * per-frame headroom rule below, plus his eye on strips from his own rolls.
 *
 * `clearance` is the smallest air above the hair that reads as deliberate rather
 * than as a near miss. A build constant, arbitrary within a range, and the range
 * is wide: the tightest slack on the no-clause population is 0.111 face-heights
 * (it was 0.088 on the clause cells, so the retarget loosens this too).
 *
 * ⚠ **IT WAS 0.316 UNTIL 2026-08-27, AND THE MOVE IS THE FOUNDER'S SECOND
 * RETARGET — the mid-torso framing (#182,
 * `docs/specs/FRAMING_COURT_2_2026-08-27.md`).** His word, verbatim: *"chest
 * up is far too tight we need to see the outfit more. run it"*, with his own
 * 2:3 reference measuring **22.0%** face share. The house sentence
 * (`AUTHOR_ROAD_FRAMING`) now asks for mid-torso, and its courted population
 * is **20.7–28.1% (median 23.0%, n=10)** — nearly all of it BELOW the old
 * `T`, so leaving 0.316 in place would have quietly cropped every sheet back
 * to the chest-up look the founder just refused (the interplay the card named
 * rather than discovered). `T = 0.230` is the population's own median and the
 * closest reachable value to his reference's 22.0% — a crop only tightens, so
 * `T` can never sit below what the engine paints. It serves 6/10 of the
 * courted frames; the 4 untrimmed (24.7–28.1%) were looked at by eye and all
 * show the outfit — the spread his eye reads on strips (#11) is what moves
 * `T` next, exactly as before. The alternative, `T = 0.251` (serves 9/10),
 * was weighed and declined: it normalizes 3 points TIGHTER than the reference
 * he sent, and tightness is the thing he refused.
 */
export const FRAMING_TRIM_TARGET: TrimTarget = {
  headShare: 0.230,
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
 * ⚠ THE MARGIN CLAUSE LIVED HERE AND IS RETIRED — 2026-08-24, ruled fable-1648.
 *
 * `FRAMING_CLAUSE_FROM`, `FRAMING_CLAUSE_TO` and `applyFramingClause` are
 * DELETED, with their call site in `rollService` and their arms. This paragraph
 * is what stands in their place, because a control that stops being reachable
 * otherwise leaves no failing test and no error — only a green suite and a
 * document that still describes it.
 *
 * **What it was:** a post-composition swap that asked the engine for more room
 * below and at the sides, so a wide render could be trimmed to a common head
 * size. It shipped, served exactly one production sheet (roll 209), and the
 * founder retired it on his own eye the same day.
 *
 * **Why it died, in his finding rather than ours: PAINTED DETAIL FOLLOWS
 * COMPOSITION, NOT RESOLUTION.** The engine paints fine facial texture where
 * the face fills the frame, and no later crop recovers what a wide composition
 * never painted. The clause bought room and spent detail.
 *
 * **And it was the geometry breaker too.** The empty feasible-`R` interval that
 * forced `R` to float per frame was measured on CLAUSE cells only; every
 * no-clause control cell was feasible, 16 of 16, with more slack than the
 * clause cells ever had.
 *
 * **What survives is the whole of the feature that his eye liked:** the large
 * render, the trim, the per-frame headroom rule, and the kept original — with
 * `T` re-chosen at the no-clause population's own geometry. The feature is now
 * a crop of a bigger picture rather than an ask of the engine, so the prompt a
 * flagged roll sends is byte-identical to an unflagged one. **That is the
 * strongest property this build has ever had** and it has its own arm.
 */
