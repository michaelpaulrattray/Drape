/**
 * THE FRAME A VISION JUDGE IS HANDED — bounded before it is posted (#1408).
 *
 * # The defect this closes, measured rather than reasoned about
 *
 * `viewConformance.ts` posted the signed anchor and the delivered view at full
 * resolution, as PNG, base64-encoded into one JSON body. Read at the real
 * production objects on 2026-09-27:
 *
 * | | pixels | as base64 |
 * |---|---|---|
 * | the anchor (`frontClose`, 1K) | 1024x1536 | 3.09 - 3.36 MB |
 * | a delivered view (2K) | 1696x2528 | 6.24 - 9.74 MB |
 * | **the PAIR, which is what one call carries** | | **11.98 - 13.10 MB** |
 *
 * **WHAT IS BROKEN IS THE BIG FRAME, AND IT IS MEASURED.** The Sign engine court
 * (#1394) rendered every arm at full size and **every 4K frame and every
 * Sunburst frame failed to be judged at all**; today's 2K read fine against the
 * small anchor (8.5 s) and **could not be reached against the larger one — 149 s
 * against a 75 s deadline.** D-246 then DELIVERS such a view and CHARGES for it
 * with nobody having looked. So a tier or engine change to the Sign views —
 * #1373 and #1394, both live — would deliver every view unjudged and charged,
 * which is why #1408's own body says it *"must land BEFORE any tier or engine
 * change"*.
 *
 * ⚠ **AND WHAT IS *NOT* BROKEN IS TODAY'S 2K ROAD — READ AT THE ROWS, WHICH
 * CORRECTS THIS MODULE'S FIRST DRAFT.** It opened by attributing production's
 * three `unavailable` views to this payload. **They are not this defect's.** All
 * three landed on 2026-09-25 (assets 317, 322, 324) and they are #1220's three —
 * the judge spending its whole token ceiling on reasoning before it could write
 * an answer, fixed the same day by `reasoning: "off"` and a 75 s deadline. **The
 * eleven views made since all carry a real verdict from a named judge.**
 *
 * ⚠ **The card's threshold is not true either, and it was driven rather than
 * repeated.** #1408 says *"above roughly 8-9 MB of payload no answer comes back
 * inside the judge's 75 s deadline"*. Against the real model with the real
 * 13.10 MB pair, three reads: **it answered every time — 8.3 s, 6.7 s, 6.6 s.**
 *
 * **So this is a PREREQUISITE, not a repair of something bleeding today**, and
 * saying otherwise would be borrowing #1220's incident to justify this one. What
 * it buys: a 4K view goes to the judge at **3.02 MB instead of 53.51 MB** (17x),
 * which is the difference between judged and not; and today's road gets **4x
 * less to deliver** (13.10 MB to 3.19 MB) as headroom on a population of eleven
 * — far too few views to call the payload road safe. It costs the check nothing,
 * which was driven rather than assumed: see the court below.
 *
 * # It was proven not to blind the judge
 *
 * `scripts/_1408-judge-court-disposable.mts`, through the real judge on real
 * production frames, controls first (working law 2):
 *
 * - **Positive control** — cast 56's anchor against cast 55's view. Identity
 *   must FAIL, and it does: *"Hair color/length, and light skin tone with heavy
 *   freckling differ from reference's dark hair and unfreckled skin."*
 * - **Negative control** — her own anchor against her own view. Identity must
 *   MATCH, and it does, naming the detail this bound was designed to protect:
 *   *"Same face shape, grey hair, makeup, ear piercings, neck tattoo, and
 *   matching arm tattoo sleeve visible in both images."*
 * - **The 4K frame** — judged in 8.5 s at 3.02 MB, identity matching, where
 *   #1394 could not get a reading at all.
 *
 * Verdicts are a pointer and never the answer (law 9); what they establish here
 * is only that the axes still move in both directions at this size.
 *
 * # What is bounded, and why each half
 *
 * **1 · The long edge, at the judge model's own maximum image resolution.**
 * The judge is `anthropic/claude-sonnet-5` (`signEngine.ts`, and
 * `SIGN_JUDGE_MODEL` is unset on the production service — read at the variable
 * listing, not assumed). That model reads images up to **2576 pixels on the
 * long edge**, up to ~4784 visual tokens; beyond that edge there is nothing for
 * it to use. So this is not a quality tradeoff at either end: under the edge
 * nothing is touched, over it we stop sending detail the reader cannot see.
 *
 * ⚠ **AND THAT IS WHY IT IS 2576 AND NOT THE COURT'S 1,568.** #1394's rejudge
 * phase bounded at 1,568 on the stated ground that it was *"the largest edge
 * the served model uses before it resizes for itself"*. **That was true of
 * Sonnet 4.6 and is false of Sonnet 5**, which is the model actually serving
 * this judge — 1,568 was the previous generation's cap. Bounding there would
 * throw away 38% of each view's linear resolution on the one axis that needs it
 * most: `viewConformance`'s identity axis reads *tattoos and ink, piercings,
 * scars, birthmarks and freckling, and the makeup she is wearing* (#1221).
 * Measured, it would also buy nothing — the pair is already well under the
 * deadline at 2576.
 *
 * **2 · JPEG at quality 95 with NO chroma subsampling**, and this is the half
 * that actually moves the number, because today's frames are already inside the
 * pixel bound. The same four production frames, bounded at 2576:
 *
 * | encoding | worst view | worst pair |
 * |---|---|---|
 * | PNG (today) | 9.74 MB | **13.10 MB** |
 * | PNG re-encoded through sharp | 13.34 MB | **17.44 MB** — *worse* |
 * | JPEG q92, default 4:2:0 | 1.59 MB | 2.05 MB |
 * | **JPEG q95, 4:4:4** | **2.48 MB** | **3.19 MB** |
 * | JPEG q98, 4:4:4 | 3.69 MB | 4.81 MB |
 *
 * ⚠ **Re-encoding as PNG makes it WORSE**, which is the trap inside "just
 * resize it": a pipeline that resized and kept the format would have shipped a
 * 33% heavier payload and read as a fix.
 *
 * **4:4:4 rather than the default 4:2:0** because ink, freckles and makeup are
 * fine CHROMA detail and subsampling is precisely what discards it — half the
 * colour resolution to save 0.9 MB is the wrong side of this trade. **q95
 * rather than q98** because q95 keeps a ~3x margin under the measured edge
 * where q98 keeps ~2x, and the difference between them sits far below what a
 * model that tokenizes into 28x28 patches can resolve.
 *
 * # What this does NOT change, said plainly
 *
 * - **The customer's picture is untouched.** `packageOrchestrator` stores the
 *   provider's own bytes BEFORE it judges and delivers those; this bounds only
 *   the copy that goes to the reader. Nothing that lands in her room, in
 *   storage, or on the character sheet passes through here.
 * - **The judge sees the same picture at the same resolution**, so its VISUAL
 *   TOKEN cost is unchanged — what shrinks is the number of bytes that have to
 *   reach the provider before it can start. The deadline and its `retries: 1`
 *   are therefore left exactly as they were, sized against the same reading
 *   they were sized against.
 *
 * # It fails OPEN, on purpose
 *
 * Bytes sharp cannot read are returned untouched rather than thrown. A resizer
 * that refused would turn a perfectly readable frame into an `unavailable`
 * verdict — a delivered, charged, unchecked view — which is the exact defect
 * this module exists to remove, arriving through a new door. The caller's
 * existing failure paths stay the only roads to `unjudged`.
 */
import sharp from "sharp";

import { createModuleLogger } from "../logging/logger";
import type { ReferenceImage } from "../providers/types";

const log = createModuleLogger("castingV2/judgeFrame");

/**
 * The judge model's own maximum image resolution, on its long edge.
 *
 * **Chosen 2026-09-27 for `anthropic/claude-sonnet-5`, and it has an expiry.**
 * The disappearing-technology law's first clause: a model choice carries a date
 * and a reason, and a rung that touches this road re-asks whether the engine —
 * and therefore this number — is still the right one. It has moved once already
 * (1568 on Sonnet 4.6, 2576 on Sonnet 5), so it will move again.
 */
export const JUDGE_FRAME_LONG_EDGE = 2576;

/** Measured in this module's header. The 4:4:4 beside it is the load-bearing half. */
export const JUDGE_FRAME_JPEG_QUALITY = 95;

/**
 * What the row records about the frame that was actually judged (#1408's
 * *"keyed so the row records the size judged"*).
 *
 * A short, human-readable pair rather than a structure, because its only
 * readers are a person looking at a `provenance` blob and a support question of
 * the form *"what did the checker actually see?"*. It is written BESIDE
 * `conformanceMethod` and never inside it — that key is matched for equality
 * against `"unavailable"` by `castProjection.wasDeliveredUnjudged`, and a key
 * carrying two facts is the drift `viewConformance`'s own docblock killed once
 * already.
 */
export type JudgedFrame = {
  /** `1696x2528` as judged, or `unreadable` when sharp could not measure it. */
  size: string;
  /** True when this frame was reduced, so a row says whether it was touched. */
  bounded: boolean;
};

export type BoundJudgeFrame = {
  image: ReferenceImage;
  record: JudgedFrame;
};

/**
 * Bound one frame for a vision judge.
 *
 * Never throws, never enlarges, and returns the original bytes whenever it
 * cannot do better than them.
 */
export async function boundForJudge(image: ReferenceImage): Promise<BoundJudgeFrame> {
  try {
    const source = sharp(image.bytes, { failOn: "none" });
    const meta = await source.metadata();
    if (!meta.width || !meta.height) {
      return { image, record: { size: "unreadable", bounded: false } };
    }

    const bytes = await source
      .resize({
        width: JUDGE_FRAME_LONG_EDGE,
        height: JUDGE_FRAME_LONG_EDGE,
        fit: "inside",
        /* Never enlarge. A frame under the edge gains no detail from being
           stretched and costs bytes for the pretence. */
        withoutEnlargement: true,
      })
      .jpeg({ quality: JUDGE_FRAME_JPEG_QUALITY, chromaSubsampling: "4:4:4" })
      .toBuffer();

    /*
      AND IT KEEPS WHICHEVER IS SMALLER, which is not belt-and-braces: a frame
      that is already a small JPEG re-encodes LARGER, and this module's whole
      subject is payload weight. Measured on the real population the bound
      always wins, because every frame there is a PNG — so this arm is for the
      frame we do not have yet: a provider that starts returning JPEG, or an
      anchor copied from a customer's own photograph.

      It only applies when the pixels did not need reducing. A frame OVER the
      edge is bounded whatever the byte count does, because the pixels beyond
      the edge are the thing the reader cannot use.
    */
    const longEdge = Math.max(meta.width, meta.height);
    if (longEdge <= JUDGE_FRAME_LONG_EDGE && bytes.length >= image.bytes.length) {
      return { image, record: { size: `${meta.width}x${meta.height}`, bounded: false } };
    }

    const bounded = await sharp(bytes).metadata();
    const size = bounded.width && bounded.height
      ? `${bounded.width}x${bounded.height}`
      : `${meta.width}x${meta.height}`;
    return { image: { bytes, contentType: "image/jpeg" }, record: { size, bounded: true } };
  } catch (error) {
    /* Fail open — see the header. The frame travels as it arrived. */
    log.warn(
      { err: error, bytes: image.bytes.length, contentType: image.contentType },
      "[judgeFrame] could not bound this frame — posting it as it arrived",
    );
    return { image, record: { size: "unreadable", bounded: false } };
  }
}

/* --------------------------------------------------------------------------
   IS THE FRAME ITSELF BROKEN? — a reading that needs no model (#1903 repair)
   -------------------------------------------------------------------------- */

/**
 * ⚠ **WHY A SECOND, STRICTER DECODE LIVES BESIDE A BOUNDER THAT FAILS OPEN.**
 *
 * Read the two together or this file reads as contradicting itself.
 * {@link boundForJudge} fails OPEN by design — a resizer that refused would turn
 * a readable frame into an `unavailable` verdict, which is the defect it exists
 * to remove. **This asks a different question**: not *can I shrink it* but *is
 * this a picture at all*, and the honest answer to that one is allowed to be no.
 * They decode the same bytes under opposite settings on purpose, which is why
 * neither inherits the other's blind spot.
 *
 * ## The hole it closes, named rather than reasoned about
 *
 * Catastrophe 2 of his three — *the picture came out broken* — was answered
 * **only** by the vision judge. So a frame the judge could not be asked about at
 * all fell through to `unjudged`, and D-246 DELIVERS an `unjudged` view and
 * CHARGES for it. A blank or truncated render therefore reached a paying
 * customer by the one road designed to protect a view nobody could look at.
 * Working law 3 is the rule it breaks: *a backstop needs a test the model cannot
 * rescue* — and here the model was the whole backstop.
 */
export type FrameIntegrity =
  | { intact: true }
  /** `damaged` — the bytes are not a whole picture. `blank` — they are a picture of nothing. */
  | { intact: false; fault: "damaged" | "blank"; note: string };

/**
 * ⚠ **THE LINE UNDER WHICH A FRAME IS A PICTURE OF NOTHING — MEASURED ON THE
 * WHOLE DELIVERED POPULATION, NOT CHOSEN.**
 *
 * Read 2026-10-07 against production: every landed view this product has ever
 * handed a customer that still has bytes — **93 frames** (8 more had been swept
 * from storage) — scored by its LOWEST per-channel standard deviation.
 *
 * | frame | lowest per-channel stdev |
 * |---|---|
 * | the real population's FLOOR (asset 302, a `frontFull`) | **24.57** |
 * | the next four real frames | 26.94 · 27.35 · 28.35 · 29.24 |
 * | a soft 110-130 gradient — the most picture-like blank | **5.79** |
 * | a flat field with one 80x80 patch on it | 3.40 |
 * | solid grey, solid black | **0.00** |
 *
 * **12 sits almost exactly halfway between the two in ratio** — 2.1x above the
 * most picture-like blank and 2.0x under the lowest real view — so it is a gap
 * rather than a boundary, and nothing has to be right about the edge.
 *
 * ⚠ **ALPHA IS EXCLUDED AND THAT IS LOAD-BEARING, NOT TIDYING.** A fully opaque
 * RGBA frame has an alpha channel of stdev 0.00, so a reader taking the minimum
 * over ALL channels would score every opaque picture at zero and refuse the
 * entire product. Only the first three are read.
 */
export const BLANK_FRAME_MIN_STDEV = 12;

/**
 * Is this frame a real, complete picture? Answered from the bytes alone.
 *
 * ⚠ **TWO ARMS, AND THE MEASUREMENT SAYS NEITHER WOULD DO ON ITS OWN** — which
 * is the only reason there are two. Driven on real production frames the day it
 * was written:
 *
 *  - **A TRUNCATED FRAME IS NOT QUIET, IT IS LOUD.** A real view cut to half its
 *    bytes paints down to the cut and is solid black below — and that black
 *    against the picture above scores **96.50**, the HIGHEST reading of anything
 *    measured, real frames included. A variance test does not merely miss it; it
 *    reads it as the most picture-like thing in the set. Only the strict decode
 *    sees it (`vipspng: libpng read error`), at every cut tried — 50%, 20%, 5%,
 *    2%.
 *  - **A BLANK FRAME IS PERFECTLY WELL-FORMED.** Solid grey is a valid PNG and
 *    every decoder in the world accepts it. Only the variance test sees it.
 *
 * **Its positive control is the arm that matters**, and it is the whole
 * population rather than a fixture: `failOn: "truncated"` refused **0 of 93**
 * real delivered frames, and the lowest-variance real frame cleared the line by
 * 2x. A gate on a money path that is wrong in the refusing direction costs a
 * customer a picture they paid for, so that number is the one to re-read if this
 * ever moves.
 *
 * ⚠ **IT ANSWERS ABOUT THE CANDIDATE'S OWN BYTES — the ones the customer would
 * be handed — never the bounded copy the judge is posted.** The bound is made
 * with `failOn: "none"` precisely so it cannot refuse, so asking it this
 * question would be asking the one reader built not to answer it.
 *
 * ⚠ **AND IT NEVER RUNS ON THE ANCHOR, which is a scope line rather than an
 * oversight.** A damaged anchor is a different failure with a different owner,
 * and it is already fail-closed by a different road: the judge handed an
 * unreadable reference answers `unsure` on identity, and identity refuses on
 * `unsure`. Widening this to the anchor would refund a customer for a view that
 * is fine.
 */
export async function readFrameIntegrity(image: ReferenceImage): Promise<FrameIntegrity> {
  let channels: { stdev: number }[];
  try {
    /*
      `truncated` and not `warning`: the stricter setting refuses on metadata
      complaints a perfectly good photograph can carry, and this reader's
      refusals cost a customer money. Measured either way on the 93 — both
      refused 0 — and the looser of two settings that measure the same is the
      one to take on a money path.
    */
    ({ channels } = await sharp(image.bytes, { failOn: "truncated" }).stats());
  } catch (error) {
    return {
      intact: false,
      fault: "damaged",
      note: `the frame could not be decoded: ${String((error as Error).message).split("\n")[0].slice(0, 120)}`,
    };
  }

  /* No channels at all is not a picture either, and a `Math.min` of nothing is
     `Infinity` — which would pass. Answered rather than left to the spread. */
  const read = channels.slice(0, 3);
  if (read.length === 0) {
    return { intact: false, fault: "damaged", note: "the frame decoded to no colour channels at all" };
  }

  const lowest = Math.min(...read.map((channel) => channel.stdev));
  if (lowest < BLANK_FRAME_MIN_STDEV) {
    return {
      intact: false,
      fault: "blank",
      note: `the frame is near-uniform — lowest channel variation ${lowest.toFixed(2)}, under ${BLANK_FRAME_MIN_STDEV}`,
    };
  }

  return { intact: true };
}
