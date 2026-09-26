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
 * **The defect is measured and it is not hypothetical: 3 of the 27 views that
 * reached the judged road on production landed `unavailable` — 11.1% delivered
 * unchecked and CHARGED (D-246)** — and the heaviest pair in the population,
 * 13.10 MB, is one of them (asset 317). The Sign engine court (#1394) hit the
 * same wall from the other side: every 4K and every Sunburst frame it rendered
 * failed to be judged at all, and its larger anchor took 149 s against a 75 s
 * deadline.
 *
 * ⚠ **AND WHAT IS *NOT* TRUE IS A THRESHOLD, WHICH IS WORTH MORE THAN THE FIX.**
 * #1408's own body says *"above roughly 8-9 MB of payload no answer comes back
 * inside the judge's 75 s deadline"*. That was driven on 2026-09-27 against the
 * real model with the real 13.10 MB pair, three reads: **it answered every
 * time, in 8.3 s, 6.7 s and 6.6 s.** So a big payload is not deterministically
 * fatal and this module must not be read as having removed a wall.
 *
 * **What it removes is EXPOSURE, and that is the honest claim.** The failures
 * are intermittent — 3 in 27 is exactly the shape a single sample cannot see —
 * and every judge call now has **4x less to deliver before the reader can
 * start** (13.10 MB to 3.19 MB on that same pair), **17x less on the frame
 * #1373 wants to ship** (53.51 MB to 3.02 MB for a 4K view, where 50 MB for one
 * frame is not a marginal call at all). It costs the check nothing, which was
 * driven rather than assumed: see the court below.
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
