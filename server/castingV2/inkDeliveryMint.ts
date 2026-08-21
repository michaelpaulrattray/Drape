/**
 * KEEPING THE TATTOO AS IT LANDED — clause (a)'s spending half (design report
 * opus-886 §3, countersigned fable-1194 §2; extended to the words road by
 * migration 0050, ruled fable-1197 §1). The arithmetic it composes through
 * is `inkDeliveryCrop.ts`, which costs nothing and drives directly.
 *
 * This is the step that turns a delivered tattoo from the customer's ARTWORK
 * into a picture of the ink on HER. It runs AFTER the variant has landed, and
 * it is deliberately the least important thing in the request: the picture is
 * already delivered and already paid for, so **nothing here may take it back.**
 * Every failure returns an outcome and logs; none of them throws to the caller.
 *
 * # WHEN IT RUNS, and the condition is a ruling rather than an optimisation
 *
 * On the render that DELIVERS a design, and never on a carry. fable-1193 §3b:
 * *minted ONCE, from the frame that FIRST delivered the design, never re-cut
 * from a later carry* — the chained-anchor trap, where a crop taken from a
 * frame that was itself carried is a copy of a copy and the drift compounds
 * with nothing going red.
 *
 * The caller decides that by passing only the slots this render EDITED. The
 * database decides it again, and that is the one that holds: the unique index
 * over (candidateId, variantId, slot) means a second mint writes nothing,
 * whatever a caller believes.
 *
 * # IT RUNS FOR A TATTOO WITH NO DESIGN, AND THAT IS THE POINT OF 0050
 *
 * D-137's road paints ink from the customer's own sentence. There is no design
 * row, so nothing could record the delivery and the tattoo vanished on her next
 * unrelated edit. The crop needs no design — the picture of the ink on her neck
 * IS the carrier — so `designPublicId` is optional here and NULL in the row,
 * meaning *painted from words* and never *we lost track*.
 *
 * # WHAT IT COSTS, stated rather than discovered later
 *
 * **One segmenter call per delivered design** — `tattooed skin` on the frame
 * that just landed, the same word the upload cutter asks of a customer's
 * picture, riding the shared `FAL_CONCURRENCY` courtesy pool. House money and
 * never a customer's credits, like every other read on the delivery path. It
 * declares no allowance of its own, so `assertFalBudget`'s arithmetic is
 * untouched.
 *
 * # THE ORDER IS MANIFEST → BYTES → ROW, and it is not negotiable here
 *
 * The keeper-receipt pattern, and on this road the litter would be **a crop of
 * a real person's neck at a permanently public URL with no row pointing at
 * it**. The manifest is born HELD so the worker cannot claim the batch while
 * the bytes are still uploading, and the row insert discharges it as its last
 * act. A duplicate insert deliberately does NOT discharge: nothing points at
 * those bytes, so they stay the worker's.
 */
import { createHash, randomUUID } from "node:crypto";

import sharp from "sharp";

import { createFalRegionReader } from "./falRegionReader";
import { countKeptPixels, cutDeliveredInk, deliveryRegionWord } from "./inkDeliveryCrop";
import { defaultManifest } from "./inkUploadService";
import { refusingRegionReader, type RegionReader } from "./maskedRefine";
import { createModuleLogger } from "../logging/logger";
import { recordInkDeliveryCrop } from "../db/castingV2InkDeliveryCrops";
import { storagePut } from "../storage";

const log = createModuleLogger("castingV2/inkDeliveryMint");

/** One prefix, so an operator can see every delivered-tattoo crop in one place. */
export const INK_DELIVERY_KEY_PREFIX = "casting-v2/ink-delivery";

export type InkDeliveryMintOutcome =
  /** The crop is a row's and the next carry will ride it. */
  | { outcome: "minted"; slot: string; maskPixels: number; keptPixels: number }
  /** This frame already has its crop at this placement — MINTED ONCE, working. */
  | { outcome: "already"; slot: string }
  /** The frame said no: no ink found, the whole picture, or too small a piece. */
  | { outcome: "no-cut"; slot: string; reason: string; maskPixels: number }
  /** Ours: a reader that did not answer, a mask in the wrong space, a failed
   *  write. The picture stands and the next carry rides the artwork. */
  | { outcome: "failed"; slot: string; reason: string };

export type InkDeliveryMintDependencies = {
  /** Who answers `tattooed skin`. Injected, so the suite never calls fal. */
  reader?: Pick<RegionReader, "region">;
  store?: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string }>;
  manifest?: typeof defaultManifest;
  record?: typeof recordInkDeliveryCrop;
};

export type InkDeliveryMintInput = {
  userId: number;
  candidatePublicId: string;
  /** The frame that delivered it, by the name the ledger carries. */
  variantPublicId: string;
  /** The delivered frame's own bytes — the picture the customer is looking at. */
  frame: Buffer;
  /**
   * WHAT THIS RENDER PUT ON HER, and where it went.
   *
   * `cropPublicId` is the name the CHAIN ALREADY GAVE this crop, minted at
   * claim time and handed down (ruled fable-1199 §1) — the delta is written
   * before the render and nothing amends it afterwards, so the name has to
   * travel forwards rather than back.
   *
   * `designPublicId` is ABSENT on D-137's words road, where the ink came out of
   * the customer's own sentence and there is no design row anywhere. That
   * delivery is as real as any other and carries identically; what it lacks is
   * a design to be remembered by, which is precisely why the crop's own name is
   * what the chain holds.
   */
  delivered: { cropPublicId: string; slot: string; designPublicId?: string };
  operationId?: string;
  dependencies?: InkDeliveryMintDependencies;
};

/**
 * The real reader, built PER MINT rather than shared — `createFalRegionReader`
 * proves a frame's URL against the bytes in hand once per reader, so one reader
 * per frame is one proof per frame.
 *
 * `refusingRegionReader` with no key, so a keyless deployment reports `failed`
 * and keeps the artwork carry, rather than storing something nobody looked at.
 */
function defaultReader(): Pick<RegionReader, "region"> {
  const apiKey = process.env.FAL_KEY;
  return apiKey ? createFalRegionReader({ apiKey }) : refusingRegionReader;
}

/**
 * Keep the crop one delivered design earned, or say why not.
 *
 * Never throws. The caller is a landed, paid render.
 */
export async function mintInkDeliveryCrop(
  input: InkDeliveryMintInput,
): Promise<InkDeliveryMintOutcome> {
  const slot = input.delivered.slot;
  const about = {
    userId: input.userId,
    candidate: input.candidatePublicId,
    variant: input.variantPublicId,
    crop: input.delivered.cropPublicId,
    /* `null` and not omitted: absent-because-words and absent-because-a-field-
       moved read identically in a log line, and only one of them is a fact. */
    design: input.delivered.designPublicId ?? null,
    slot,
    operationId: input.operationId,
  };
  try {
    const reader = input.dependencies?.reader ?? defaultReader();
    const store = input.dependencies?.store ?? ((one) => storagePut(one.key, one.bytes, one.contentType));
    const manifest = input.dependencies?.manifest ?? defaultManifest;
    const record = input.dependencies?.record ?? recordInkDeliveryCrop;

    /*
      THE DELIVERED FRAME AS RGBA, with the channel count PROVEN rather than
      trusted — sharp promotes buffers behind your back, and a loop walking four
      bytes per pixel over a three-channel one reads past the end and compares
      against `undefined`, which is false. D-210 landed three times in one
      session through this door.
    */
    const { data: rgba, info } = await sharp(input.frame)
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4 || rgba.length !== info.width * info.height * 4) {
      log.warn({ ...about, channels: info.channels, bytes: rgba.length },
        "[inkDeliveryMint] the delivered frame did not decode to four bytes per pixel — refusing rather than indexing into it");
      return { outcome: "failed", slot, reason: "frameChannels" };
    }

    /*
      `absentIsAnswer` on purpose. Asked of the DELIVERED frame, nothing found
      means the frame does not wear the thing — which is a fact about the render
      worth recording as `no-cut`. Refusing to answer instead would arrive as a
      provider failure and file "we could not tell" over a picture that told us
      plainly.
    */
    /*
      ⚠ THE SLOT'S OWN WORD, NEVER `tattooed skin` (courted opus-945, ruled
      fable-1273 §2 / fable-1284 §2).

      This line used to ask `tattooed skin` of the whole delivered frame. On a
      chest piece of seven separate marks it answered with ONE SWALLOW — 1 of 7,
      about a fifth of the ink — and that one swallow became the crop every
      later carry rode under the sentence *"the exact tattoo he already has …
      put it back exactly as it is here"*, leaving the engine to redraw the
      other six. The slot's own `readerWord` answered with the surface holding
      all seven, 16x the pixels, on the same frame in the same minute.

      Derived from the slot inside `deliveryRegionWord` so the word ASKED here
      and the word RECORDED on the row below are one read of one thing.
    */
    const regionWord = deliveryRegionWord(slot);
    const mask = await reader.region({ image: input.frame, name: regionWord, absentIsAnswer: true });
    /*
      A MASK NOT IN THE FRAME'S SPACE IS OUR ERROR, never something to resample
      (`maskedRefine`'s house rule). It is `failed` rather than `no-cut`: nothing
      was learned about the picture.
    */
    if (mask.width !== info.width || mask.height !== info.height
      || mask.data.length !== info.width * info.height) {
      log.warn({
        ...about,
        mask: `${mask.width}x${mask.height}`,
        frame: `${info.width}x${info.height}`,
        bytes: mask.data.length,
      }, "[inkDeliveryMint] the mask is not in the frame's space — refusing rather than resampling");
      return { outcome: "failed", slot, reason: "wrongSpace" };
    }

    const cut = cutDeliveredInk({ rgba, width: info.width, height: info.height, mask });
    if (!cut.ok) {
      /*
        LOUD ON BOTH, and both are facts about a FRAME rather than defects in
        this file: the reader found nothing on it, or what it found was the
        whole picture. Either way the carry goes on riding the design's own
        artwork, which is the road this product drove before crops existed.

        ⚠ `cutDidNotCut` used to be reported from here and is NOT any more —
        it is raised below, against the extracted bytes, because that is where
        the bytes now are. It is deliberately absent from this branch rather
        than left as an unreachable ternary saying otherwise.
      */
      log.warn(
        { ...about, region: regionWord, reason: cut.refusal, maskPixels: cut.maskPixels },
        "[inkDeliveryMint] the delivered frame yielded no usable crop — the next carry rides the design's own artwork",
      );
      return { outcome: "no-cut", slot, reason: cut.refusal, maskPixels: cut.maskPixels };
    }

    /*
      Extracted to the surface's own padded box, out of the DELIVERED FRAME'S
      OWN BYTES — there is no alpha-written copy any more, because there is no
      alpha. What is stored is a rectangle of him with the whole piece on it.
    */
    const bytes = await sharp(rgba, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({
        left: cut.cut.box.left,
        top: cut.cut.box.top,
        width: cut.cut.box.width,
        height: cut.cut.box.height,
      })
      .png()
      .toBuffer();

    /*
      ⚠ `cutDidNotCut`, FOLLOWING THE BYTES RATHER THAN DYING WITH THE ALPHA.

      The guard was `countKeptPixels` over the alpha-written frame, and its
      whole reason for existing is that this road has TWICE produced an uncut
      photograph of a man while every number beside it stayed correct. Retiring
      the alpha would have retired the guard silently — working law 7's second
      half, a control orphaned by a change aimed at something else — so it moves
      to where the produced bytes now are.

      Re-decoding the crop costs one sharp pass on an object the size of a
      tattoo, off the customer's paid wait entirely (this whole mint runs after
      the picture is delivered). It is asked of the ARTIFACT: the rectangle that
      came back has the dimensions we asked for, and every pixel in it is
      opaque. A `sharp.extract` that quietly returned the frame fails both.
    */
    const produced = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const keptPixels = countKeptPixels({
      rgba: produced.data,
      width: produced.info.width,
      height: produced.info.height,
    });
    if (
      produced.info.width !== cut.cut.box.width
      || produced.info.height !== cut.cut.box.height
      || keptPixels !== cut.cut.keptPixels
    ) {
      log.warn(
        {
          ...about,
          asked: `${cut.cut.box.width}x${cut.cut.box.height}`,
          came: `${produced.info.width}x${produced.info.height}`,
          keptPixels,
          expected: cut.cut.keptPixels,
        },
        "[inkDeliveryMint] THE CUT DID NOT CUT — the produced bytes are not the rectangle that was asked for; nothing stored",
      );
      return { outcome: "no-cut", slot, reason: "cutDidNotCut", maskPixels: cut.cut.maskPixels };
    }

    const key = `${INK_DELIVERY_KEY_PREFIX}/${randomUUID()}.png`;
    const cleanupBatchId = randomUUID();
    await manifest({ id: cleanupBatchId, userId: input.userId, storageKeys: [key] });
    await store({ key, bytes, contentType: "image/png" });

    const written = await record({
      userId: input.userId,
      candidatePublicId: input.candidatePublicId,
      publicId: input.delivered.cropPublicId,
      ...(input.delivered.designPublicId === undefined
        ? {}
        : { designPublicId: input.delivered.designPublicId }),
      variantPublicId: input.variantPublicId,
      slot,
      /* WHICH WORD PRODUCED THIS ROW, so a crop minted before the word changed
         is tellable from one minted after it — by reading the row, not by
         reading its timestamp against a deploy. */
      region: regionWord,
      storageKey: key,
      digest: createHash("sha256").update(bytes).digest("hex"),
      mime: "image/png",
      byteSize: bytes.byteLength,
      width: cut.cut.box.width,
      height: cut.cut.box.height,
      bboxX: cut.cut.box.left,
      bboxY: cut.cut.box.top,
      bboxW: cut.cut.box.width,
      bboxH: cut.cut.box.height,
      frameWidth: info.width,
      frameHeight: info.height,
      maskPixels: cut.cut.maskPixels,
      keptPixels,
      cleanupBatchId,
    });
    if (written.outcome === "already") {
      /* MINTED ONCE, working. The bytes just written have no row and stay the
         cleanup worker's — the manifest is deliberately not discharged. */
      log.info(about, "[inkDeliveryMint] this frame already has its delivery crop at this placement — the first one stands");
      return { outcome: "already", slot };
    }

    log.info({ ...about, region: regionWord, maskPixels: cut.cut.maskPixels, keptPixels, key },
      "[inkDeliveryMint] the tattoo as it landed on her is kept — the next carry rides this rather than her artwork");
    return { outcome: "minted", slot, maskPixels: cut.cut.maskPixels, keptPixels };
  } catch (error) {
    log.error({ ...about, err: error },
      "[inkDeliveryMint] the delivered tattoo could not be kept — the picture stands and the next carry rides the artwork");
    return { outcome: "failed", slot, reason: "threw" };
  }
}
