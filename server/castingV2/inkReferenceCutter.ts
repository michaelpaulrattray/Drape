/**
 * TAKING THE DESIGN OUT OF THE PICTURE SHE UPLOADED — build 3a's ORCHESTRATION
 * (design `V3B_INK_AND_MARKS_DESIGN_NOTE.md` §7.12, ruled fable-1127/1129/1130;
 * the geometry and the routing table it composes through are
 * `inkReferenceCrop.ts`).
 *
 * The split is `hairReferenceCrop` / `hairReferenceCutter`'s, on purpose: the
 * one road in this product that has already been through a court of its own.
 * Everything MEASURED lives in the pure half and drives in a suite that costs
 * nothing. **This file is the part that spends money and can go wrong**: which
 * questions are asked, of which picture, what is refused, and what comes back.
 *
 * # ⚠ THIS MODULE HAS NO CALLER, AND THAT IS THE STAGING RATHER THAN AN OMISSION
 *
 * 3a.1 is the cutter and its court, DARK. Nothing imports this yet, so it lands
 * dark BY CONSTRUCTION rather than behind a flag — there is no switch to set
 * wrong. The wire that makes a design row's bytes the cut is 3a.3, and it
 * carries a **founder gate that is not an executor's to close** (fable-919 §3):
 * a face-bearing reference must produce a plate with zero person content, at
 * the frames, in front of him. Law 9 — no reader's word closes it.
 *
 * **So the widening tripwire stays armed and §7.12's retirement paragraph stays
 * a plan.** Its arm — the one proving the mint's input IS the cut and not the
 * photograph — belongs to the build that makes it TRUE. Written here it would
 * assert something no code path yet does, which is a green test about a fiction.
 *
 * # THE ORDER, and every step of it was decided somewhere else
 *
 *   1. DECODE — her picture as RGBA at its own resolution. The cut needs pixels.
 *   2. THE TWO QUESTIONS, both with `absentIsAnswer`, of the whole frame.
 *   3. SPACE — a mask that is not in her picture's space is refused, never
 *      resampled (`maskedRefine`'s house rule).
 *   4. EXTENT — count and box in one pass, per mask.
 *   5. ROUTE — `routeInkUpload`, on COUNTS. Fail-closed; the licence to send a
 *      frame whole comes from a positive *nobody is in it*, never from
 *      no-tattoo-found.
 *   6. GUARD — the cut's shortest edge clears the upload door's own floor.
 *   7. CUT — masked cutout, extracted to the ink's box, encoded PNG.
 *
 * # WHAT IT COSTS, stated rather than discovered later
 *
 * **Two segmenter calls per uploaded design** — one `tattooed skin`, one
 * `human skin` — asked together. House money, and the second one is not
 * optional: it IS the licence, and without it a photograph of a person whose
 * ink the reader missed rides whole to an engine.
 *
 * # NOTHING IS STORED HERE, AND THAT IS WHY THERE IS NO MINT IN THIS FILE
 *
 * The hair road cuts a carrier that has no row of its own, so its cutter mints
 * one. A tattoo's cut has a row already and it is the row the mint reads:
 * `casting_ink_designs.storageKey` (ruled fable-1130 §1). 3a changes what those
 * bytes ARE, not where they live — so this returns bytes and the upload's own
 * step 3 writes them, with `digest`, `byteSize`, `width` and `height` all
 * describing whatever object is there.
 *
 * # EVERY REFUSAL IS FREE, AND THEY DO NOT SHARE A SENTINEL
 *
 * The codes are ours and the messages are hers. The distinction that has to
 * hold is between *the reader answered and the answer is nothing* and *the
 * reader did not answer at all* — one sentinel meaning both is the defect
 * `negative-arm-cannot-find-yes-defects` names. It is kept apart structurally:
 * both questions are asked with `absentIsAnswer`, so an empty mask is a reading
 * and a thrown error is a failure, and the two can never arrive as one value.
 *
 * Note what is NOT a refusal: an empty ink mask on a picture with nobody in it.
 * That is population (i) — flash on paper, a stencil, a flat sheet — and the
 * frame IS the design. It rides whole.
 */
import sharp from "sharp";

import type { InkCutRoute } from "../../shared/inkCutRoute";
import { createModuleLogger } from "../logging/logger";
import {
  INK_REGION,
  PERSON_REGION,
  type CropBox,
  cropClearsMinimumEdge,
  cutOutPixels,
  extentOf,
  routeInkUpload,
  scopeInkMask,
} from "./inkReferenceCrop";
import type { PictureHalf } from "./sidePhrasing";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

const log = createModuleLogger("castingV2/inkReferenceCutter");

export type InkCutRefusalCode =
  /** The bytes would not decode at all. Hers, and she can fix it. */
  | "unreadable"
  /** A reader did not answer — a provider failure, never a fact about her picture. */
  | "couldNotRead"
  /** A mask came back in a space that is not her picture's. Ours, never hers. */
  | "wrongSpace"
  /**
   * ⚠ THE ROW THE WHOLE ROAD IS FOR — a photographed person, and no design the
   * reader could isolate. Population (iv): a sleeve on a photorealistic arm,
   * where the limb reads as skin and no PATCH of inked skin exists because the
   * whole limb is one.
   */
  | "personWithoutDesign"
  /** The cut is real but smaller than a design — forty pixels of ink is not one. */
  | "cutTooSmall";

export type InkCutRefusal = {
  readonly code: InkCutRefusalCode;
  /** Her sentence, not a code the client re-words. */
  readonly message: string;
};

/**
 * WHAT HAPPENED TO HER PICTURE, and the two outcomes are told apart rather than
 * both arriving as "here are some bytes".
 *
 * `cut` — the design was isolated and the bytes are the cutout.
 * `rideWhole` — there is nobody in the picture, so the frame IS the design and
 * the bytes are hers exactly as given.
 *
 * A caller that could not tell them apart could not show her the right sentence,
 * and the shown-cut offer (fable-1127 §2) is the thing that makes this road's
 * two measured bounds survivable rather than defects.
 */
/*
  THE VOCABULARY MOVED TO `shared/` WITH MIGRATION 0047, and this is the same
  list rather than a second one: the disposition is now a column, and
  `drizzle/schema.ts` cannot import from `server/`. Re-exported here so every
  caller that already names this module goes on working, and so there is
  exactly one place the two members are written down (working law 4).
*/
export type { InkCutRoute };

export type InkCut = {
  readonly route: InkCutRoute;
  /** What the design row should store: the cutout, or her frame unchanged. */
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
  /**
   * The two readings, kept for the log and the record. PIXEL COUNTS, never
   * coverages — a real design is a fraction of a percent of a portrait and on a
   * percentage scale it is indistinguishable from noise (§7.12's opening scar).
   */
  readonly inkPixels: number;
  readonly personPixels: number;
  /** Where the design sat in her frame, or `null` when the frame rode whole. */
  readonly box: CropBox | null;
  /**
   * WHAT THE CUT WAS NARROWED TO, so the sentence she reads can say it.
   *
   * `null` when nothing narrowed anything — no scope was asked for, or the
   * region found nothing in her picture and the whole ink mask was kept. A
   * caller that showed a half in that case would be telling her something the
   * cut does not depend on.
   */
  readonly focus: InkCutFocus | null;
};

/**
 * THE NARROWING, described for the customer's own sentence (ruled fable-1172
 * §2a: *"the offer's sentence NAMES the geometry for a sided source take"*).
 *
 * `half` is a half of HER PICTURE and never an anatomical side — the type says
 * so, and that is the whole safety of it. `fellBack` is the §2b arithmetic
 * having fired: the half her word pointed at held no design and the other one
 * did, so what she is looking at is NOT the side she named and the sentence has
 * to say which one it is.
 */
/**
 * WHERE IN HER PICTURE TO LOOK — the ASK, named so that everything forwarding
 * it references one shape rather than re-listing two fields (law 4; the Atlas
 * flags the copy mechanically).
 *
 * Deliberately NOT the same type as {@link InkCutFocus} below, which is the
 * ANSWER: both fields here may be null because a caller may have no region word
 * and no side, and the answer carries a third field this cannot — whether the
 * fallback fired. A shared type would have to make every field optional and
 * would stop saying either thing.
 */
export type InkCutScope = {
  readonly region: string | null;
  readonly half: PictureHalf | null;
};

export type InkCutFocus = {
  readonly region: string;
  readonly half: PictureHalf | null;
  readonly fellBack: boolean;
};

export type CutInkDesignResult =
  | { ok: true; cut: InkCut }
  | { ok: false; refusal: InkCutRefusal };

/**
 * Her sentences.
 *
 * `personWithoutDesign` NAMES THE ROAD THAT WORKS rather than describing the one
 * that closed (ruled fable-1129 §3, D-180's spirit at a refusal): the artist who
 * made the mannequin mock-up HAS the flat design, and telling her the door that
 * opens is worth more than an accurate account of the door that shut.
 */
const REFUSALS: Readonly<Record<InkCutRefusalCode, string>> = Object.freeze({
  unreadable: "That picture won't open — attach it again and I'll take another look. Nothing was charged.",
  couldNotRead: "I couldn't read that picture just now — try again in a moment. Nothing was charged.",
  wrongSpace: "Something went wrong reading that picture — try again in a moment. Nothing was charged.",
  personWithoutDesign:
    "That looks like a design on a model's arm — I can't safely take it from there. "
    + "A flat photo of the design itself works. Nothing was charged.",
  cutTooSmall:
    "I found the design in that picture, but it's too small a piece to draw from — "
    + `${INK_DESIGN_MIN_EDGE}px across, at least. A closer photo of the design works better. `
    + "Nothing was charged.",
});

function refuse(code: InkCutRefusalCode): CutInkDesignResult {
  return { ok: false, refusal: { code, message: REFUSALS[code] } };
}

/**
 * Her picture as RGBA, one row after another.
 *
 * `ensureAlpha` so the cutout has a channel to write into, and the channel count
 * and the length are both PROVEN rather than trusted — sharp promotes buffers
 * behind your back, and a loop walking four bytes per pixel over a three-channel
 * buffer reads past the end and compares against `undefined`, which is false.
 * D-210 landed three times in one session through this door.
 *
 * Deliberately NOT `.rotate()`: the upload door measured her width and height
 * off an unrotated `metadata()` read, and a cutter that silently worked in a
 * different space from the row would be the wrong-frame class. If a reader
 * auto-rotates and this does not, the masks arrive in a space that is not this
 * one and the step below refuses — fail-closed, which is the right direction.
 */
async function rgbaOf(bytes: Buffer): Promise<{ rgba: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4 || data.length !== info.width * info.height * 4) {
      log.warn(
        { channels: info.channels, bytes: data.length, width: info.width, height: info.height },
        "[inkReferenceCutter] her picture did not decode to four bytes per pixel — refusing rather than indexing into it",
      );
      return null;
    }
    return { rgba: data, width: info.width, height: info.height };
  } catch (error) {
    log.warn({ err: error }, "[inkReferenceCutter] her picture would not decode");
    return null;
  }
}

/** A mask is in her picture's space, and is one byte per pixel of it. */
function inHerSpace(mask: Mask, width: number, height: number): boolean {
  return mask.width === width && mask.height === height && mask.data.length === width * height;
}

export type CutInkDesignInput = {
  /** Her picture, exactly as she uploaded it. */
  bytes: Buffer;
  /**
   * Who answers the two questions. Injected, so the suite never calls fal.
   *
   * NARROWED TO THE ONE METHOD THIS ASKS, like the hair cutter's: a reader is
   * four capabilities and this road uses one. Taking the whole interface would
   * let a later edit reach for `subject` or `landmark` without anybody deciding
   * that a cut may cost a matte.
   */
  reader: Pick<RegionReader, "region">;
  /**
   * WHERE IN HER PICTURE TO LOOK — optional, and absent is exactly the road
   * this file drove yesterday (ruled fable-1158 §2a, roads ruled fable-1172).
   *
   * `region` is a question word that has already been through
   * `sourceRegionWord`, which is what makes *"the segmenter is never asked a
   * lateral question"* mechanical rather than remembered. `half` is a half of
   * the PICTURE, already flipped from her anatomy by `sidePhrasing.imageHalfOf`
   * — the one owner of that inversion.
   *
   * **A scope narrows and never refuses.** If the region finds nothing, the
   * whole ink mask is kept: an ask that names a place on HER, applied to a
   * photograph of a piece of paper, must not wall the most ordinary upload a
   * tattoo customer makes.
   */
  scope?: InkCutScope;
  /** For the log line, so a cut can be traced to the upload that bought it. */
  about?: { userId?: number; candidatePublicId?: string };
};

/**
 * CUT ONE DESIGN OUT OF ONE PICTURE, or say why not.
 *
 * Returns a refusal rather than throwing: every failure here is a customer's to
 * read and none of them is an exception to swallow. The caller answers with the
 * sentence and charges nothing.
 */
export async function cutInkDesign(input: CutInkDesignInput): Promise<CutInkDesignResult> {
  const decoded = await rgbaOf(input.bytes);
  if (!decoded) return refuse("unreadable");

  /*
    BOTH QUESTIONS, TOGETHER, BOTH WITH `absentIsAnswer`.

    An empty `tattooed skin` mask is the reader saying *there is no isolable
    design in this picture*, which is the correct and expected answer about a
    flash sheet — the frame is the design. An empty `human skin` mask is the
    reader saying *there is nobody in this picture*, and that answer IS the
    licence. A thrown error is neither: it is the reader not answering.

    `allSettled` rather than `all`, so a second rejection cannot escape as an
    unhandled one while the first is being reported.
  */
  const [ink, person] = await Promise.allSettled([
    input.reader.region({ image: input.bytes, name: INK_REGION, absentIsAnswer: true }),
    input.reader.region({ image: input.bytes, name: PERSON_REGION, absentIsAnswer: true }),
  ]);
  if (ink.status === "rejected" || person.status === "rejected") {
    const failed = ink.status === "rejected" ? ink.reason : (person as PromiseRejectedResult).reason;
    log.warn(
      {
        ...input.about,
        which: ink.status === "rejected" ? INK_REGION : PERSON_REGION,
        err: failed instanceof Error ? failed.message : String(failed),
      },
      "[inkReferenceCutter] a reader did not answer — a failure, not a finding about her picture",
    );
    return refuse("couldNotRead");
  }

  /*
    EACH MASK IN HER PICTURE'S SPACE, AND ONE BYTE PER PIXEL — both proven.

    `maskedRefine`'s house rule: a mask not in its picture's space is our error
    and her free refusal, never a resample. And a promoted buffer read one byte
    per pixel does not fail — it silently reads a third of a picture and reports
    success, which is the scar `extentOf`'s own door was written for.
  */
  for (const [what, mask] of [[INK_REGION, ink.value], [PERSON_REGION, person.value]] as const) {
    if (!inHerSpace(mask, decoded.width, decoded.height)) {
      log.warn(
        {
          ...input.about,
          what,
          mask: `${mask.width}x${mask.height}`,
          picture: `${decoded.width}x${decoded.height}`,
          bytes: mask.data.length,
        },
        "[inkReferenceCutter] a mask is not in her picture's space — refusing rather than resampling",
      );
      return refuse("wrongSpace");
    }
  }

  const inkExtent = extentOf(ink.value);
  const personExtent = extentOf(person.value);
  const route = routeInkUpload({ inkPixels: inkExtent.pixels, personPixels: personExtent.pixels });

  if (route === "refuse") {
    log.info(
      { ...input.about, ink: inkExtent.pixels, person: personExtent.pixels },
      "[inkReferenceCutter] somebody is photographed in that picture and no design could be isolated — refused free",
    );
    return refuse("personWithoutDesign");
  }

  if (route === "rideWhole") {
    /* Population (i) and (iii): flash on paper, a stencil, a plastic torso.
       Nothing to cut, and the licence is the positive zero beside it — `human
       skin` is exactly zero on a picture with no skin in it. Her bytes go on
       unchanged, which is also what makes the digest mean byte identity. */
    log.info(
      { ...input.about, size: `${decoded.width}x${decoded.height}` },
      "[inkReferenceCutter] nobody is in that picture — the frame is the design and rides whole",
    );
    return {
      ok: true,
      cut: {
        route: "rideWhole",
        bytes: input.bytes,
        width: decoded.width,
        height: decoded.height,
        inkPixels: 0,
        personPixels: 0,
        box: null,
        focus: null,
      },
    };
  }

  /*
    THE THIRD QUESTION — WHERE IN HER PICTURE, asked only now (ruled fable-1158
    §2a, conditions fable-1172 §2).

    **After the routing rather than beside the other two, and that is a money
    decision made once.** A picture that rides whole has no region to narrow and
    a refused one is not being cut at all, so asking three questions in the
    first breath would spend a third of this road's house money on the two
    outcomes that cannot use the answer. The cost is one serial round trip on
    the road that CAN use it.

    Never a lateral word — `sourceRegionWord` is the guard and it has already
    run at the caller, so a `region` arriving here is a question this product is
    allowed to ask. The half is arithmetic and asks nobody anything.

    A reader that does not answer is NOT a refusal here, unlike the two above:
    the narrowing is an improvement on a cut this file already knows how to
    make, and turning her picture away because an optional question timed out
    would be a wall bought with a nicety. The scope is dropped and the whole ink
    mask is cut, which is this road's own behaviour one commit ago.
  */
  const scoped = await (async () => {
    const word = input.scope?.region ?? null;
    if (word === null) return scopeInkMask({ ink: ink.value, region: null, half: null });
    const region = await input.reader
      .region({ image: input.bytes, name: word, absentIsAnswer: true })
      .catch((error: unknown) => {
        log.warn(
          { ...input.about, region: word, err: error instanceof Error ? error.message : String(error) },
          "[inkReferenceCutter] the region question went unanswered — cutting the whole design rather than refusing",
        );
        return null;
      });
    if (region !== null && !inHerSpace(region, decoded.width, decoded.height)) {
      log.warn(
        {
          ...input.about,
          region: word,
          mask: `${region.width}x${region.height}`,
          picture: `${decoded.width}x${decoded.height}`,
        },
        "[inkReferenceCutter] the region mask is not in her picture's space — dropping the scope rather than resampling",
      );
      return scopeInkMask({ ink: ink.value, region: null, half: null });
    }
    const choice = scopeInkMask({ ink: ink.value, region, half: input.scope?.half ?? null });
    log.info(
      {
        ...input.about,
        region: word,
        asked: input.scope?.half ?? null,
        took: choice.half,
        fellBack: choice.fellBack,
        narrowed: choice.regionHeld,
        pixels: choice.pixels,
        of: inkExtent.pixels,
      },
      "[inkReferenceCutter] the cut was scoped to a region of her picture",
    );
    return choice;
  })();

  /* `cut` implies `inkPixels > 0`, and a positive count implies a box — but the
     one thing a corner marked "cannot happen" reliably does is happen, so it is
     answered rather than asserted. */
  const box = scoped.box;
  if (!box) return refuse("cutTooSmall");

  /*
    THE GUARD, ON THE PATH THAT ACTUALLY RUNS (invariant 7), and BEFORE the
    pixels are touched — a cut that will be refused should not first be built.

    The floor is the upload door's own `INK_DESIGN_MIN_EDGE`, imported rather
    than restated (law 4: derive, never mirror). A design too small to draw from
    is refused identically whether the smallness arrived as a whole picture or
    as the cut taken out of one.
  */
  if (!cropClearsMinimumEdge(box)) {
    log.info(
      { ...input.about, box: `${box.width}x${box.height}`, floor: INK_DESIGN_MIN_EDGE, ink: inkExtent.pixels },
      "[inkReferenceCutter] the design in that picture is smaller than a design — refused free",
    );
    return refuse("cutTooSmall");
  }

  /*
    THE MASKED CUTOUT, AND NEVER A BOUNDING RECTANGLE (ruled twice, fable-1052):
    a rectangle "is not an interim, it is 3a done badly, in the one place he said
    cropped means the design". So the alpha is written across the WHOLE frame
    first and the box is extracted after — extracting first would hand the loop a
    mask in the frame's space and a picture in the box's, which is the resample
    this road promises not to have.
  */
  const cutRgba = cutOutPixels({
    rgba: decoded.rgba,
    width: decoded.width,
    height: decoded.height,
    /* THE SCOPED MASK, which is the whole ink mask when nothing narrowed it —
       so an unscoped cut is byte-identical to the one this file made before the
       region question existed. */
    mask: scoped.mask,
  });
  const bytes = await sharp(cutRgba, { raw: { width: decoded.width, height: decoded.height, channels: 4 } })
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .png()
    .toBuffer();

  log.info(
    {
      ...input.about,
      size: `${box.width}x${box.height}`,
      at: `${box.left},${box.top}`,
      ink: scoped.pixels,
      ofWholeMask: inkExtent.pixels,
      person: personExtent.pixels,
      bytes: bytes.byteLength,
    },
    "[inkReferenceCutter] cut the design out of her picture — the person is not in the crop",
  );

  return {
    ok: true,
    cut: {
      route: "cut",
      bytes,
      width: box.width,
      height: box.height,
      /* THE COUNT DESCRIBES THE PIXELS THAT WERE CUT, not the ones the reader
         found — a scoped cut of a two-sleeved man is a fraction of the ink in
         his photograph, and a number describing the wrong set is worse in a
         log than no number at all. */
      inkPixels: scoped.pixels,
      personPixels: personExtent.pixels,
      box,
      focus: input.scope?.region && scoped.regionHeld
        ? { region: input.scope.region, half: scoped.half, fellBack: scoped.fellBack }
        : null,
    },
  };
}
