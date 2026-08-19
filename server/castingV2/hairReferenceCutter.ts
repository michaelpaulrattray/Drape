/**
 * CUTTING THE CARRIER OUT OF THE PICTURE SHE ATTACHED — the crop road's
 * ORCHESTRATION (design `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.10 as ruled in
 * fable-1093/1094; the geometry it composes through is `hairReferenceCrop.ts`).
 *
 * The geometry module holds every rule that was measured on his own specimens —
 * the seam, the panels, the redacted form, the scale floor — and holds no
 * segmenter call, no storage and no refusal, so all of it drives in a suite that
 * costs nothing. **This file is the part that spends money and can go wrong**:
 * which questions are asked, of which picture, in which order, what is refused,
 * and what is written.
 *
 * # THE ORDER, and every step of it is a decision that was made somewhere else
 *
 *   1. DECODE — one greyscale read of her picture, for the seam alone.
 *   2. THE SEAM — deterministic, no model. `findSeam` / `panelsOf`.
 *   3. HAIR, ONCE PER PANEL — and this is the step that fixes the silent pick.
 *      Asked of the whole frame, the segmenter picks ONE panel and tells nobody
 *      (§9.10: 424px of a 1309px frame, confirmed by cutting the box out and
 *      looking at it). Asked per panel, both heads are read deliberately.
 *   4. THE CARRY — the panel with the most hair carries, which is a measurement
 *      rather than a judgement (ruled fable-1093 §1), and the second view's
 *      non-use is SAID rather than silently dropped.
 *   5. THE SCALE REGION — `face`, on the carrying panel only, because the head
 *      answer IS the hair (99,677px against 99,220px) and a carrier built on it
 *      had 1,043px of form and no scale at all.
 *   6. COMPOSE and GUARD — `composeCarrierPixels`, then `carrierPicturesScale`,
 *      which is consulted HERE, on the request path, rather than existing as a
 *      function nothing calls (invariant 7, named in advance by fable-1095 §2).
 *   7. MINT — manifest, then bytes, in that order.
 *
 * # WHAT IT COSTS, stated rather than discovered later
 *
 * **Two segmenter calls for one photograph, three for a composite** — hair per
 * panel plus one face on the winner. House money on a paid path, and the extra
 * call is what buys a deliberate answer instead of a model's private choice.
 *
 * # EVERY REFUSAL IS FREE, AND THEY DO NOT SHARE A SENTINEL
 *
 * Nothing here is reached after a claim, so a refusal costs her nothing. The
 * codes are ours and the messages are hers. The distinction that matters is
 * between `noHair` (the reader answered, and the answer is *there is none*) and
 * `couldNotRead` (the reader did not answer at all) — one sentinel meaning both
 * is the defect `negative-arm-cannot-find-yes-defects` names, and the way it is
 * kept apart here is structural: the hair questions are asked with
 * `absentIsAnswer`, so an empty mask is a reading and a thrown `MaskError` is a
 * failure, and the two can never arrive as the same value.
 *
 * # THE MASK IS NEVER RESIZED TO FIT
 *
 * A segmenter answers at its own resolution, and a mask a row out of step with
 * its picture produces a carrier that is confidently wrong with nothing to show
 * for it. The house rule is `maskedRefine`'s: refuse, never resample (a
 * resample inside the one path that promises not to have one). So a mask that
 * is not in its panel's space is `wrongSpace` — our error, her free refusal.
 *
 * # WHAT IS MINTED, AND HOW LONG IT LIVES
 *
 * The carrier goes to a key under a cleanup manifest that is born HELD, and
 * **nothing here discharges it** — so unless a caller records a row naming that
 * key, the worker collects the object when the hold lapses. That is the right
 * life for an ask-scoped artifact and it is deliberate rather than unfinished:
 * the candidate purge collects by ROW, so an object with no row would otherwise
 * outlive the Cast it was cut from. A caller that needs the carrier to survive
 * its render — a regenerate re-sending the original reference (§9.8) — records
 * the row and inherits the purge with it.
 *
 * That makes this the one manifest writer in the product that registers bytes
 * before they exist and MEANS them to be collected, and the classification is
 * pinned rather than implied: `storageManifestReceipt.test.ts` files it under
 * COLLECTORS, and moving it to KEEPERS is the edit that day forces.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { withTransaction } from "../db/connection";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import { createModuleLogger } from "../logging/logger";
import { storagePut } from "../storage";
import {
  carrierPicturesScale,
  composeCarrierPixels,
  encodeCarrier,
  findSeam,
  panelsOf,
  unionBox,
  type CropMask,
  type Panel,
  type Seam,
} from "./hairReferenceCrop";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

const log = createModuleLogger("castingV2/hairReferenceCutter");

/** One prefix, so an operator can see every carrier this road cut in one place. */
export const HAIR_CARRIER_KEY_PREFIX = "casting-v2/reference-carrier";

/**
 * The region the HAIR question is asked under.
 *
 * The plain noun, which is what the whole workstream's phrasing table already
 * answers for (`askedAs`) — named here rather than typed at the call site so
 * the two questions this file asks are declared side by side.
 */
export const HAIR_REGION = "hair";

/**
 * The region the SCALE comes from — `face`, and it is MEASURED rather than
 * preferred.
 *
 * Asked for `head` on his own panel the segmenter returned 99,677px against the
 * hair's 99,220px: the head answer IS the hair, and a carrier built on it had
 * 1,043px of redacted form — a picture that looks like a carrier and does the
 * job of a bare cutout, which is the shape the length court convicted.
 */
export const SCALE_REGION = "face";

/**
 * What she is told when her reference held two views and one of them carried.
 *
 * Said plainly rather than dropped in silence (ruled fable-1093 §1, the
 * ship-and-tell pattern): a customer who attached a two-view sheet chose both
 * views on purpose, and a product that quietly uses half of what she gave it
 * reads as *that is everything we saw*.
 */
export const SECOND_VIEW_UNUSED_NOTE =
  "That picture holds two views — I worked from the one showing the most hair.";

export type HairCarrierRefusalCode =
  /** The bytes would not decode at all. */
  | "unreadable"
  /** The reader answered, and the answer is that there is no hair in it. */
  | "noHair"
  /** The reader did not answer — a provider failure, not a fact about her picture. */
  | "couldNotRead"
  /** A mask came back in a space that is not its panel's. Ours, never hers. */
  | "wrongSpace"
  /** The carrier pictures no scale, so it would lose the length it was cut for. */
  | "noScale";

export type HairCarrierRefusal = {
  readonly code: HairCarrierRefusalCode;
  /** Her sentence, not a code the client re-words. */
  readonly message: string;
};

export type HairCarrier = {
  /** The composed PNG: her hair in its own pixels, the rest of the head flat. */
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
  readonly hairPixels: number;
  readonly formPixels: number;
  /** How many panels her picture was cut into — 1, or 2 when a seam was found. */
  readonly panels: number;
  /** Which panel carried, in reading order (top/left first). */
  readonly carriedPanel: number;
  /** Whether a second view existed and was not used — the thing she is told. */
  readonly secondViewUnused: boolean;
  /** The seam, for the record: what was measured, not what was assumed. */
  readonly seam: Seam | null;
};

export type CutHairCarrierResult =
  | { ok: true; carrier: HairCarrier }
  | { ok: false; refusal: HairCarrierRefusal };

export type MintedHairCarrier = {
  readonly key: string;
  readonly sha: string;
  readonly contentType: string;
  readonly carrier: HairCarrier;
};

const REFUSALS: Readonly<Record<HairCarrierRefusalCode, string>> = Object.freeze({
  unreadable: "That picture won't open — attach it again and I'll take another look. Nothing was charged.",
  noHair: "I couldn't find any hair in that picture — try one where the hair is clearly in view. Nothing was charged.",
  couldNotRead: "I couldn't read that picture just now — try again in a moment. Nothing was charged.",
  wrongSpace: "Something went wrong reading that picture — try again in a moment. Nothing was charged.",
  noScale:
    "I can see the hair in that picture, but not enough of the head around it to tell how long it is — "
    + "a picture showing more of the head works better. Nothing was charged.",
});

function refuse(code: HairCarrierRefusalCode): CutHairCarrierResult {
  return { ok: false, refusal: { code, message: REFUSALS[code] } };
}

/**
 * Her picture as one byte per pixel, for the seam alone.
 *
 * `removeAlpha` before the colourspace, and both stated rather than chained
 * hopefully: a PNG with transparency comes out of `toColourspace("b-w")` with
 * its alpha still attached, and a two-channel buffer read one byte per pixel is
 * the class that has now landed four times through this door. The length is
 * asserted rather than trusted for the same reason — sharp promotes, silently,
 * and every loop downstream would read past the end and compare against
 * `undefined`, which is false.
 */
async function greyscaleOf(bytes: Buffer): Promise<{ grey: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await sharp(bytes)
      .removeAlpha()
      .toColourspace("b-w")
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (data.length !== info.width * info.height) {
      log.warn(
        { bytes: data.length, width: info.width, height: info.height },
        "[hairReferenceCutter] the greyscale read is not one byte per pixel — refusing rather than indexing into it",
      );
      return null;
    }
    return { grey: data, width: info.width, height: info.height };
  } catch (error) {
    log.warn({ err: error }, "[hairReferenceCutter] her picture would not decode");
    return null;
  }
}

/** How many pixels a mask covers. */
function coveredBy(mask: Mask): number {
  let set = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] !== 0) set += 1;
  return set;
}

/**
 * One mask, brought into `box` and carrying its own channel count.
 *
 * The channel count travels with the buffer rather than being assumed to be
 * one: a raw single-channel input comes back out of `extract` promoted to
 * three, and an interleave that indexed as though it had not returned a whole
 * FACE in a carrier meant to hold hair — three times, silently, which is the
 * scar `composeCarrierPixels` is written as a loop for.
 */
async function croppedMask(mask: Mask, box: Panel): Promise<CropMask> {
  const { data, info } = await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

export type CutHairCarrierInput = {
  /** Her picture, exactly as she attached it. */
  bytes: Buffer;
  /**
   * Who answers the two questions. Injected, so the suite never calls fal.
   *
   * NARROWED TO THE ONE METHOD THIS ASKS. A reader is four capabilities and
   * this road uses one of them; taking the whole interface would let a later
   * edit reach for `subject` or `landmark` without anybody deciding that a
   * carrier may cost a matte, and it would make every fixture implement three
   * methods it never answers.
   */
  reader: Pick<RegionReader, "region">;
  /** For the log line, so a cut can be traced to the ask that bought it. */
  about?: { userId?: number; candidatePublicId?: string };
};

/**
 * CUT ONE CARRIER, or say why not.
 *
 * Returns a refusal rather than throwing, for `askReference`'s reason: every
 * failure here is a customer's to read and none of them is an exception to
 * swallow. The caller answers with the sentence and charges nothing.
 */
export async function cutHairCarrier(input: CutHairCarrierInput): Promise<CutHairCarrierResult> {
  const decoded = await greyscaleOf(input.bytes);
  if (!decoded) return refuse("unreadable");

  const seam = findSeam(decoded.grey, decoded.width, decoded.height);
  const panels = panelsOf(seam, decoded.width, decoded.height);

  /*
    HAIR, ONCE PER PANEL — asked with `absentIsAnswer`, which is what keeps a
    reading apart from a failure.

    An empty mask here is the reader saying *there is no hair in this panel*,
    which is a perfectly good answer about a mood board's caption strip. A
    thrown MaskError is the reader not answering at all. Conflating them would
    tell a customer her photograph has no hair in it because fal had a bad
    minute.
  */
  let cuts: Array<{ at: number; panel: Panel; bytes: Buffer; hair: Mask; pixels: number }>;
  try {
    cuts = await Promise.all(panels.map(async (panel, at) => {
      const bytes = await sharp(input.bytes).extract(panel).png().toBuffer();
      const hair = await input.reader.region({ image: bytes, name: HAIR_REGION, absentIsAnswer: true });
      return { at, panel, bytes, hair, pixels: coveredBy(hair) };
    }));
  } catch (error) {
    log.warn(
      { ...input.about, err: error instanceof Error ? error.message : String(error) },
      "[hairReferenceCutter] the reader did not answer — a failure, not a finding about her picture",
    );
    return refuse("couldNotRead");
  }

  for (const cut of cuts) {
    if (cut.hair.width !== cut.panel.width || cut.hair.height !== cut.panel.height) {
      log.warn(
        {
          ...input.about,
          mask: `${cut.hair.width}x${cut.hair.height}`,
          panel: `${cut.panel.width}x${cut.panel.height}`,
        },
        "[hairReferenceCutter] a hair mask came back in a space that is not its panel's — refusing rather than resampling",
      );
      return refuse("wrongSpace");
    }
  }

  /*
    THE CARRY RULE, and it is one line because it was ruled rather than
    invented here: the panel holding the most hair carries (fable-1093 §1).

    `>` and not `>=`, so a tie keeps the first panel in reading order — a
    deterministic answer to a question that has no better one, rather than
    whichever way a sort happened to fall.
  */
  const carrying = cuts.reduce((best, cut) => (cut.pixels > best.pixels ? cut : best), cuts[0]);
  if (!carrying || carrying.pixels === 0) {
    log.info(
      { ...input.about, panels: panels.length },
      "[hairReferenceCutter] no panel of her picture holds any hair — refused free",
    );
    return refuse("noHair");
  }

  /* THE SCALE, on the carrying panel alone. `absentIsAnswer` again: a picture
     with hair and no readable face is a real reading, and it fails at the scale
     floor below rather than as an exception. */
  let form: Mask;
  try {
    form = await input.reader.region({ image: carrying.bytes, name: SCALE_REGION, absentIsAnswer: true });
  } catch (error) {
    log.warn(
      { ...input.about, err: error instanceof Error ? error.message : String(error) },
      "[hairReferenceCutter] the scale question went unanswered",
    );
    return refuse("couldNotRead");
  }
  if (form.width !== carrying.panel.width || form.height !== carrying.panel.height) {
    log.warn(
      {
        ...input.about,
        mask: `${form.width}x${form.height}`,
        panel: `${carrying.panel.width}x${carrying.panel.height}`,
      },
      "[hairReferenceCutter] the scale mask came back in a space that is not its panel's — refusing rather than resampling",
    );
    return refuse("wrongSpace");
  }

  /*
    AND EACH MASK IS ONE BYTE PER PIXEL, PROVEN RATHER THAN DECLARED.

    `channels: 1` below is an assertion about somebody else's buffer, and the
    whole reason `CropMask` carries a channel count is that this exact
    assumption has been wrong three times in one sitting. A promoted buffer read
    one byte per pixel does not fail — it silently reads a third of a picture
    and reports success.
  */
  for (const [what, mask] of [["hair", carrying.hair], ["scale", form]] as const) {
    if (mask.data.length !== mask.width * mask.height) {
      log.warn(
        { ...input.about, what, bytes: mask.data.length, size: `${mask.width}x${mask.height}` },
        "[hairReferenceCutter] a mask is not one byte per pixel — refusing rather than indexing into it",
      );
      return refuse("wrongSpace");
    }
  }
  const hairMask: CropMask = { ...carrying.hair, channels: 1 };
  const formMask: CropMask = { ...form, channels: 1 };
  const box = unionBox(hairMask, formMask);
  /* Unreachable while `carrying.pixels > 0` — a union that covers nothing has no
     hair in it either — and it is answered rather than asserted, because the one
     thing a corner marked "cannot happen" reliably does is happen. */
  if (!box) return refuse("noHair");

  const content = await sharp(carrying.bytes)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const composed = composeCarrierPixels({
    content: {
      data: content.data,
      width: content.info.width,
      height: content.info.height,
      channels: content.info.channels,
    },
    hair: await croppedMask(carrying.hair, box),
    form: await croppedMask(form, box),
    box,
  });

  /*
    THE GUARD, ON THE PATH THAT ACTUALLY RUNS.

    A carrier whose form is a rounding error is a silent regression to the bare
    cutout the length court convicted — it looks like a carrier and does the job
    of nothing. Consulted here rather than declared and admired: a control that
    is not invoked does not exist (invariant 7).
  */
  if (!carrierPicturesScale(composed.hairPixels, composed.formPixels)) {
    log.info(
      { ...input.about, hair: composed.hairPixels, form: composed.formPixels },
      "[hairReferenceCutter] the carrier pictures no scale — refused free rather than sent",
    );
    return refuse("noScale");
  }

  const bytes = await encodeCarrier(composed.rgba, box);
  log.info(
    {
      ...input.about,
      panels: panels.length,
      carried: carrying.at,
      seam: seam ? `${seam.axis}@${seam.at} (${seam.ratio.toFixed(1)}x)` : null,
      size: `${box.width}x${box.height}`,
      hair: composed.hairPixels,
      form: composed.formPixels,
    },
    "[hairReferenceCutter] cut a carrier that pictures its own scale and no person",
  );

  return {
    ok: true,
    carrier: {
      bytes,
      width: box.width,
      height: box.height,
      hairPixels: composed.hairPixels,
      formPixels: composed.formPixels,
      panels: panels.length,
      carriedPanel: carrying.at,
      secondViewUnused: panels.length > 1,
      seam,
    },
  };
}

export type MintHairCarrierDependencies = {
  manifest: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  store: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string; url: string }>;
};

async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* A synthetic operation id, like the attach's and the mint's: the column is
       unique and NOT NULL, and cutting a carrier is not a generation operation
       of its own. */
    operationId: randomUUID(),
    /* BORN HELD, and the synthetic id above is why — the worker's in-flight
       fence tests a batch against a live operation row and a synthetic id
       matches none, so an unheld manifest would be claimable while the bytes it
       names are still being written. */
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
}

const REAL: MintHairCarrierDependencies = {
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
};

/**
 * PUT THE CARRIER SOMEWHERE A RENDER CAN REACH IT — manifest first, then bytes.
 *
 * The keeper-receipt order, and this road has paid for it twice: bytes at a
 * permanently public address with nothing naming them are litter nobody will
 * ever go looking for. The manifest is written before the object exists, so a
 * crash anywhere after it leaves the worker holding an exact key.
 *
 * `randomUUID`, never `Math.random` — the name is the only thing between the
 * object and a stranger, and the repository-wide guard on storage writers says
 * so.
 */
export async function mintHairCarrier(
  input: { userId: number; carrier: HairCarrier },
  dependencies: MintHairCarrierDependencies = REAL,
): Promise<MintedHairCarrier> {
  const key = `${HAIR_CARRIER_KEY_PREFIX}/${randomUUID()}.png`;
  await dependencies.manifest({ id: randomUUID(), userId: input.userId, storageKeys: [key] });
  await dependencies.store({ key, bytes: input.carrier.bytes, contentType: "image/png" });
  const { createHash } = await import("node:crypto");
  return {
    key,
    sha: createHash("sha256").update(input.carrier.bytes).digest("hex"),
    contentType: "image/png",
    carrier: input.carrier,
  };
}
