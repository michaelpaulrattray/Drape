/**
 * TAKE A NAMED THING OUT OF AN ATTACHED PICTURE — #2736's slice 2 producer,
 * under his word of 2026-10-29 (chat, verbatim and entire: *"BUILD IT"*).
 *
 * What a customer does: attaches a photograph of a jacket, types *"wear this
 * jacket"*. What this module does: finds the jacket in that photograph, cuts it
 * out, takes the person out of the bytes, and hands back a person-free PNG that
 * the repaint recipe carries as a `source`. The photograph itself never reaches
 * a paint engine — only the cut does, which is the whole of the design's §4
 * likeness fence and the same fence the hair and ink roads already pay for.
 *
 * # THE ROAD, AND EVERY STEP OF IT ALREADY EXISTED
 *
 *   1. the noun       the CUSTOMER'S OWN WORD for the one thing they filed,
 *                     resolved by `theirNounForTheOneThingFiled` — which this
 *                     road does NOT own and does not re-derive. It was already
 *                     on this request, already reading the delta the refine
 *                     parse produces, and already used to word the
 *                     unused-picture note. **No new text call is bought for
 *                     it**, which is the disappearing-technology law's clause 4
 *                     (read what the engine already gave you) rather than a
 *                     saving.
 *   2. the box        `pointer` (detect) with that bare noun. An EMPTY LIST is
 *                     the absence answer and is a refusal, never a retry.
 *   3. the mask       `regionInBox`, ONE box per call — #2532 measured that
 *                     several boxes do not combine, they switch which object
 *                     comes back, so the biggest box is chosen here and asked
 *                     alone.
 *   4. the judgement  `cleanCut` (#2565 slice 2) — judge the RAW cut against
 *                     the fill floor, then clean the one being kept.
 *   5. the person     every detected face box zeroed in the mask, then
 *                     `cutOutPixels`, which writes the RGB as well as the alpha.
 *   6. the crop       tight to what survived, so the carried reference is the
 *                     thing and not a rectangle of photograph around it.
 *
 * # ⚠ THIS IS `cleanCut`'S FIRST PRODUCTION CALLER, AND THAT IS DELIBERATE
 *
 * `cutQuality.ts` shipped on 2026-10-29 with `judgeCut` wired into the face
 * panel and `cleanCut` — the whole pipeline, judge then clean — called by
 * nothing but its own suite. Its shift said where it should land: *"In the PR
 * that first calls it. A module with no caller is this repository's
 * most-catalogued mistake."* This road is that caller. Nothing about the bar
 * moves to fit this road: `CUT_FILL_FLOOR` is a floor measured on one known-bad
 * specimen and is imported, never restated.
 *
 * ⚠ **AND SINCE #2831 THIS IS THE ONLY ROAD THAT TAKES THAT FLOOR.** The
 * face panel — `pointerCut`'s discovery cut and `falRegionReader`'s
 * `sideByDetector` — measures the fill and refuses on it no longer, because
 * fill was measured ordering a CORRECT cut below a WRONG one (a 17.0% tail
 * thrown away, a 21.64% sword kept). The floor is a per-caller argument now,
 * required with no default, so this road states it at the call; the reasoning
 * for the split is at that call and in `cutQuality.ts`'s header.
 *
 * # ⚠ WHAT THE FACE SUBTRACTION DOES NOT DO, SAID RATHER THAN GLOSSED
 *
 * The court that ran on 2026-10-28 measured this exact fence and found its
 * limit: *"face-box subtraction alone does not make a worn-garment cut
 * person-free"* — the jacket cut carried a patch of bare chest framed by the
 * garment's own opening, because the segmenter's boundary includes it and no
 * face box covers it. **No delivered frame carried any of it** (0 of 7,248
 * sampled transparent pixels held the photograph's RGB), and it was in the
 * stored cut. So what this module guarantees is narrow and exact: **no face, and
 * no pixel outside the mask.** Skin framed by the garment's own opening is
 * inside the mask and is still in the cut. The design's §4 leak measure is the
 * instrument for that and it is NOT built here — it is named on the card as
 * what is still owed, because measuring a leak is a court and not a line of
 * code.
 *
 * # WHAT IS NOT HERE
 *
 * No whole-outfit take (several cuts from one picture), and no ask-back when a
 * photograph holds several pieces and the sentence names none — both are §6 of
 * the design and both are named on the card as owed. Today a sentence this road
 * cannot serve falls through to exactly the behaviour that shipped before it:
 * the picture is confessed as unused and the edit rides on words.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { CUT_FILL_FLOOR, cleanCut, type CutVerdict } from "./cutQuality";
import { cutOutPixels } from "./inkReferenceCrop";
import { createModuleLogger } from "../logging/logger";
import { createStorageCleanupManifestIn, storageCleanupManifestHeldUntil } from "../db/storageCleanup";
import { segmenterAccountRefused } from "./readerDown";
import { storagePut } from "../storage";
import { withTransaction } from "../db/connection";
import type { CastPronouns } from "./castPronouns";
import type { Mask } from "./maskedComposite";
import type { PointerBox, RegionReader } from "./maskedRefine";

const log = createModuleLogger("castingV2/referenceTake");

/** Where a take's cut lives. Its own prefix, so a sweep can see the road. */
export const TAKE_CUT_KEY_PREFIX = "casting-v2/reference-take";

/**
 * THE NOUN THE FACE DETECTOR IS ASKED, and it is deliberately the court's own.
 *
 * Written once here rather than at the call site: the fence is this module's
 * promise, so the question it rests on belongs with it.
 */
export const TAKE_FACE_NOUN = "the person's face and head";

/**
 * WHY A TAKE DID NOT HAPPEN — one word each, for the log and for the sentence.
 *
 * `unreadable` and `reader-failed` are OUR failures and the others are findings
 * about the picture. They are kept apart for the hair road's reason: conflating
 * them tells a customer their photograph has no jacket in it because fal had a
 * bad minute.
 */
export type TakeRefusal =
  /** The attachment could not be decoded at all. */
  | "unreadable"
  /** The detector or the segmenter did not answer — ours, not theirs. */
  | "reader-failed"
  /** This reader cannot point at a thing it has no word for. */
  | "no-pointer"
  /** The detector found nothing of that noun. An empty list is an answer. */
  | "not-found"
  /** The segmenter returned no mask for that rectangle. */
  | "no-mask"
  /** The cut had no pixels, missed the rectangle that asked, or — on this
   *  road, which keeps the floor — filled too little of it. */
  | "cut-refused"
  /** Nothing survived taking the person out. */
  | "nothing-left";

export type TakenThing = {
  /** The cut, tight to itself, as a PNG carrying its own alpha. */
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
  /** The customer's own word for it, carried so the sentence can say it. */
  readonly noun: string;
  /** What the judgement read — kept so a refusal rate has a basis later. */
  readonly verdict: CutVerdict;
  /** How many face boxes were subtracted. Evidence, never a gate. */
  readonly facesRemoved: number;
};

export type TakeResult =
  | { readonly ok: true; readonly thing: TakenThing }
  | { readonly ok: false; readonly why: TakeRefusal; readonly verdict: CutVerdict | null };

export type CutThingFromPictureInput = {
  /** The attachment's own bytes, exactly as stored. */
  readonly bytes: Buffer;
  /** The customer's own word for the thing to take. */
  readonly noun: string;
  readonly reader: RegionReader;
  /** For the log alone — never part of any question asked of a provider. */
  readonly about: { userId: number; candidatePublicId: string };
};

/** The biggest box the detector drew. One box per call — see the header. */
function biggestOf(boxes: readonly PointerBox[]): PointerBox | null {
  return [...boxes].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

/**
 * EVERY FACE OUT OF THE MASK, in the mask's own bytes.
 *
 * The caller's mask is never mutated — the subtraction lands in a copy, the way
 * `closeHoles` does it, so a caller holding the raw mask for a log still has it.
 */
export function subtractFaces(mask: Mask, faces: readonly PointerBox[]): Mask {
  if (faces.length === 0) return mask;
  const data = Buffer.from(mask.data);
  for (const face of faces) {
    const top = Math.max(0, face.y);
    const bottom = Math.min(mask.height, face.y + face.height);
    const left = Math.max(0, face.x);
    const right = Math.min(mask.width, face.x + face.width);
    if (bottom <= top || right <= left) continue;
    for (let row = top; row < bottom; row += 1) {
      data.fill(0, row * mask.width + left, row * mask.width + right);
    }
  }
  return { data, width: mask.width, height: mask.height };
}

/** The box the surviving pixels occupy. `null` when none do. */
function tightBoundsOf(mask: Mask): PointerBox | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if ((mask.data[row + x] ?? 0) <= 127) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * THE CROP, ROW BY ROW, AS A PNG.
 *
 * The boring loop rather than `cropRaster`, and the reason is a measured trap:
 * that helper allocates `width * height * 3` because it is RGB by construction,
 * so handing it a 4-channel cut mis-strides every row silently. A cut that
 * carries its own alpha has to be copied at a 4-stride, and the stride is
 * written out here where it can be read.
 */
async function pngOf(
  cut: Buffer,
  raster: { width: number; height: number },
  bounds: PointerBox,
): Promise<Buffer> {
  const data = Buffer.alloc(bounds.width * bounds.height * 4);
  for (let y = 0; y < bounds.height; y += 1) {
    const from = ((bounds.y + y) * raster.width + bounds.x) * 4;
    cut.copy(data, y * bounds.width * 4, from, from + bounds.width * 4);
  }
  return sharp(data, { raw: { width: bounds.width, height: bounds.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * CUT ONE NAMED THING OUT OF ONE PICTURE.
 *
 * Every refusal returns rather than throwing, because every one of them has a
 * sentence a customer can act on and none of them is an exception. The one thing
 * that does throw is a provider that did not answer, and that is caught here and
 * reported as ours (`reader-failed`) — the hair road's distinction, kept.
 */
export async function cutThingFromPicture(input: CutThingFromPictureInput): Promise<TakeResult> {
  const { pointer, regionInBox } = input.reader;
  if (pointer === undefined || regionInBox === undefined) {
    log.warn(input.about, "[referenceTake] this reader cannot point at a thing — no take");
    return { ok: false, why: "no-pointer", verdict: null };
  }

  /*
    THE PHOTOGRAPH IS FLATTENED FIRST, AND THE ALPHA IS DECLARED.

    The cut's transparency must come from the MASK and never from whatever alpha
    the attachment already carried, so the source is composited onto white
    before anything is read off it. `cutOutPixels` writes the alpha byte at a
    4-stride, so a 3-channel raster would be mis-strided silently — it is
    `ensureAlpha` plus an explicit channel check rather than a hope.
  */
  let flat: Buffer;
  let raster: { data: Buffer; width: number; height: number };
  try {
    flat = await sharp(input.bytes).flatten({ background: "#ffffff" }).png().toBuffer();
    const raw = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (raw.info.channels !== 4) {
      log.warn(
        { ...input.about, channels: raw.info.channels },
        "[referenceTake] the attachment did not decode to 4 channels — refusing rather than mis-striding",
      );
      return { ok: false, why: "unreadable", verdict: null };
    }
    raster = { data: raw.data, width: raw.info.width, height: raw.info.height };
  } catch (error) {
    log.warn(
      { ...input.about, err: error instanceof Error ? error.message : String(error) },
      "[referenceTake] the attachment could not be decoded",
    );
    return { ok: false, why: "unreadable", verdict: null };
  }

  try {
    const boxes = await pointer.call(input.reader, { image: flat, name: input.noun });
    if (boxes.length === 0) {
      /* An empty list is the detector ANSWERING, and the answer is *not in this
         picture*. It is a finding about the photograph, never a retry — and it
         is the cheap door, so no mask is ever paid for behind it. */
      log.info(
        { ...input.about, noun: input.noun },
        "[referenceTake] nothing of that noun is in the picture — no cut, nothing spent on a mask",
      );
      return { ok: false, why: "not-found", verdict: null };
    }
    const box = biggestOf(boxes);
    if (box === null) return { ok: false, why: "not-found", verdict: null };
    const mask = await regionInBox.call(input.reader, { image: flat, name: input.noun, box });
    if (mask === null) {
      log.info(
        { ...input.about, noun: input.noun, box },
        "[referenceTake] the segmenter returned no mask for that rectangle",
      );
      return { ok: false, why: "no-mask", verdict: null };
    }

    /*
      ⚠ THE JUDGEMENT IS ON THE RAW CUT AND THE CLEANING COMES AFTER — the order
      is load-bearing and `cleanCut` is what holds it. The bar was measured on
      raw segmenter output; cleaning widens a mask and raises its fill, so
      judging a cleaned mask would loosen the floor by however many pixels the
      widening added.

      ⚠ **AND THE FACE SUBTRACTION RUNS AFTER BOTH, which is the same reasoning
      inverted.** Subtracting first could drop a cut under the floor on territory
      the PERSON occupied rather than on a broken boundary — a different refusal
      wearing this one's name, and one that would read in the log as a bad cut
      when what actually happened is that the fence did its job.
    */
    /*
      ⚠ **AND THE FLOOR IS PASSED HERE BECAUSE IT IS THIS ROAD'S AND NOT THE
      PRODUCT'S — #2831, the relay's decision of 2026-10-30.** The face panel
      stopped refusing on fill the same day; this road did not, and that is not
      inconsistency. `CUT_FILL_FLOOR`'s only known-bad specimen — *"only the
      straps"*, 8.3% — belongs to THIS road, where a refused cut costs nothing
      (the edit rides on words) and a partial cut costs a paid render that
      nobody will see the cut behind. On the panel a cut is outlined on hover,
      so a wrong one is visible and a missing row is not.

      Its known limit is stated rather than fixed: *"wear this necklace"* is a
      ring-shaped cut at around 15% of its own bounding box, so it is refused
      and that edit rides on words. That is the safe direction here, and it is
      named on #2736.
    */
    const judged = await cleanCut({ mask, box, fillFloor: CUT_FILL_FLOOR });
    if (!judged.verdict.use || judged.mask === null) {
      log.info(
        {
          ...input.about,
          noun: input.noun,
          why: judged.verdict.why,
          fill: judged.verdict.fill,
          floor: CUT_FILL_FLOOR,
        },
        "[referenceTake] the cut was refused — the edit rides on words",
      );
      return { ok: false, why: "cut-refused", verdict: judged.verdict };
    }

    /*
      THE FENCE'S OWN READ, bought only once there is a cut worth keeping. A
      picture the detector found nothing in, a rectangle the segmenter could not
      cut, and a cut the floor refused all pay nothing for this call.
    */
    const faces = await pointer.call(input.reader, { image: flat, name: TAKE_FACE_NOUN });
    const faceless = subtractFaces(judged.mask, faces);
    const cut = cutOutPixels({
      rgba: raster.data,
      width: raster.width,
      height: raster.height,
      mask: faceless,
    });
    const bounds = tightBoundsOf(faceless);
    if (bounds === null) {
      log.info(
        { ...input.about, noun: input.noun, faces: faces.length },
        "[referenceTake] nothing survived taking the person out of the cut",
      );
      return { ok: false, why: "nothing-left", verdict: judged.verdict };
    }
    const bytes = await pngOf(cut, raster, bounds);
    log.info(
      {
        ...input.about,
        noun: input.noun,
        fill: judged.verdict.fill,
        faces: faces.length,
        width: bounds.width,
        height: bounds.height,
      },
      "[referenceTake] took the named thing out of the picture",
    );
    return {
      ok: true,
      thing: {
        bytes,
        width: bounds.width,
        height: bounds.height,
        noun: input.noun,
        verdict: judged.verdict,
        facesRemoved: faces.length,
      },
    };
  } catch (error) {
    /* Whose failure it was decides the sentence, never the retry advice alone —
       the hair cutter's own rule, through its own reader of the provider's 429. */
    const ours = segmenterAccountRefused(error);
    log.warn(
      {
        ...input.about,
        noun: input.noun,
        accountRefused: ours,
        err: error instanceof Error ? error.message : String(error),
      },
      "[referenceTake] the reader did not answer — a failure, not a finding about the picture",
    );
    return { ok: false, why: "reader-failed", verdict: null };
  }
}

/**
 * WHAT THIS PICTURE IS ALLOWED TO GIVE THE CAST — the recipe's REQUIRED `scope`
 * sentence, composed by the owner that knows the take.
 *
 * It lives here rather than in the assembler for the reason
 * {@link RecipeSource.scope}'s own docblock gives: that module splices, it does
 * not decide what a take claims, because the decision belongs beside the thing
 * it is derived from. `hairTakeSentence` is the precedent and this is its shape.
 *
 * Two clauses, and the second is the one that earns its keep. The first says
 * take this exact thing and names the properties that make a garment THAT
 * garment rather than one like it — the court measured this precisely: a take's
 * win over words-only *"scales with how specific the garment is"*, the jacket's
 * own wrap, lapel shape, buckle placement and sash transferring where words
 * produced a plausible but different coat. The second says **everything else
 * they wear stays as it is**, which is what keeps one named piece from becoming
 * a whole new outfit; the same court found the existing outfit held BETTER under
 * the take than under words (a prop the cast was holding survived the take and
 * was lost by the words-only arm).
 *
 * ⚠ **IT NAMES THE GARMENT AND NEVER THE SET.** The scenery wall is not this
 * road's to move — Refine changes the person, not the shoot — and a scope
 * sentence that said anything about the backdrop would be asking for exactly
 * the thing the wall refuses, from inside the recipe.
 */
export function takeScopeSentence(noun: string, pronouns: CastPronouns): string {
  return [
    `Dress ${pronouns.object} in this exact ${noun} — its cut, its colour and its material.`,
    `Everything else ${pronouns.subject} ${pronouns.plural ? "wear" : "wears"} stays as it is,`,
    "and nothing about the set, the backdrop or the props changes.",
  ].join(" ");
}

export type MintedTake = {
  readonly key: string;
  readonly sha: string;
  readonly contentType: string;
};

export type MintTakeDependencies = {
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
    /* A synthetic operation id, like the attach's and the hair carrier's: the
       column is unique and NOT NULL, and cutting a take is not a generation
       operation of its own. */
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

const REAL: MintTakeDependencies = {
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
};

/**
 * PUT THE CUT SOMEWHERE A RENDER CAN REACH IT — manifest first, then bytes.
 *
 * The hair carrier's road, clause for clause, and the order has been paid for
 * twice: bytes at a permanently public address with nothing naming them are
 * litter nobody will ever go looking for. The manifest is written before the
 * object exists, so a crash anywhere after it leaves the worker holding an
 * exact key.
 *
 * ⚠ **NO ROW IN `casting_reference_crops`, AND THAT IS READ AT THE CODE RATHER
 * THAN A SHORTCUT.** The step-0 design named that table as the mint, and it
 * cannot be: its `intent` column is a `mysqlEnum` DERIVED from
 * `REFERENCE_INTENTS` filtered to the crop form — `["hair","eyeColour"]` — so a
 * take's open noun has no value to be written as, and inventing a fifth
 * `REFERENCE_INTENTS` row is precisely what his *"nothing should be confined to
 * a set list"* forbids on this road. (Widening that enum is also a
 * `MODIFY COLUMN`, which the deploy rite refuses as non-additive.) Measured
 * beside that: **nothing has ever inserted into that table** — it has a purge
 * reader and no writer — so the live, proven retention road is the manifest's,
 * which is the one the hair carrier already takes and the storage cleanup worker
 * already sweeps.
 *
 * `randomUUID`, never `Math.random` — the name is the only thing between the
 * object and a stranger, and the repository-wide guard on storage writers says
 * so.
 */
export async function mintTakeCut(
  input: { userId: number; thing: TakenThing },
  dependencies: MintTakeDependencies = REAL,
): Promise<MintedTake> {
  const key = `${TAKE_CUT_KEY_PREFIX}/${randomUUID()}.png`;
  await dependencies.manifest({ id: randomUUID(), userId: input.userId, storageKeys: [key] });
  await dependencies.store({ key, bytes: input.thing.bytes, contentType: "image/png" });
  const { createHash } = await import("node:crypto");
  return {
    key,
    sha: createHash("sha256").update(input.thing.bytes).digest("hex"),
    contentType: "image/png",
  };
}
