/**
 * KEEPING THE TATTOO AS IT LANDED — clause (a)'s spending half (design report
 * opus-886 §3, countersigned fable-1194 §2). The arithmetic it composes through
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
 * over (candidateId, designId, slot) means a second mint writes nothing,
 * whatever a caller believes.
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
import { cutDeliveredInk } from "./inkDeliveryCrop";
import { INK_REGION } from "./inkReferenceCrop";
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
  /** This design already has its delivery crop — MINTED ONCE, working. */
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
  /** The design this render put on her, and where it went. */
  design: { publicId: string; slot: string };
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
  const slot = input.design.slot;
  const about = {
    userId: input.userId,
    candidate: input.candidatePublicId,
    variant: input.variantPublicId,
    design: input.design.publicId,
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
    const mask = await reader.region({ image: input.frame, name: INK_REGION, absentIsAnswer: true });
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
        LOUD ON EVERY ONE OF THEM, and `cutDidNotCut` loudest.

        `noInk` and `tooSmall` are facts about a frame and the carry simply goes
        on riding the artwork. `cutDidNotCut` is a DEFECT IN THIS FILE that has
        landed twice on this road already, and the whole reason the count is
        taken from the produced bytes is so it can never again be silent.
      */
      log.warn({ ...about, reason: cut.refusal, maskPixels: cut.maskPixels },
        cut.refusal === "cutDidNotCut"
          ? "[inkDeliveryMint] THE CUT DID NOT CUT — the produced bytes keep pixels the mask did not; nothing stored"
          : "[inkDeliveryMint] the delivered frame yielded no usable crop — the next carry rides the design's own artwork");
      return { outcome: "no-cut", slot, reason: cut.refusal, maskPixels: cut.maskPixels };
    }

    /* Extracted to the tattoo's own box, so the stored object is the crop and
       not a full frame carrying a mostly-transparent picture of a person. */
    const bytes = await sharp(cut.cut.rgba, {
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

    const key = `${INK_DELIVERY_KEY_PREFIX}/${randomUUID()}.png`;
    const cleanupBatchId = randomUUID();
    await manifest({ id: cleanupBatchId, userId: input.userId, storageKeys: [key] });
    await store({ key, bytes, contentType: "image/png" });

    const written = await record({
      userId: input.userId,
      candidatePublicId: input.candidatePublicId,
      designPublicId: input.design.publicId,
      variantPublicId: input.variantPublicId,
      slot,
      region: INK_REGION,
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
      keptPixels: cut.cut.keptPixels,
      cleanupBatchId,
    });
    if (written.outcome === "already") {
      /* MINTED ONCE, working. The bytes just written have no row and stay the
         cleanup worker's — the manifest is deliberately not discharged. */
      log.info(about, "[inkDeliveryMint] this design already has its delivery crop — the first one stands");
      return { outcome: "already", slot };
    }

    log.info({ ...about, maskPixels: cut.cut.maskPixels, keptPixels: cut.cut.keptPixels, key },
      "[inkDeliveryMint] the tattoo as it landed on her is kept — the next carry rides this rather than her artwork");
    return { outcome: "minted", slot, maskPixels: cut.cut.maskPixels, keptPixels: cut.cut.keptPixels };
  } catch (error) {
    log.error({ ...about, err: error },
      "[inkDeliveryMint] the delivered tattoo could not be kept — the picture stands and the next carry rides the artwork");
    return { outcome: "failed", slot, reason: "threw" };
  }
}
