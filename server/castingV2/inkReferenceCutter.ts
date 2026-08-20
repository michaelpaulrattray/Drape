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
 *   2. THE TWO QUESTIONS, both with `absentIsAnswer`. The INK is asked of her
 *      own frame; the LICENCE is asked of a PADDED COPY of it, because the word
 *      reads zero on photographs of tattooed people and answers on the same
 *      pixels once they are not against the frame edge (the measurement court,
 *      2026-08-20, ruled fable-1183 §1 — `LICENCE_PAD_FACTOR` carries it).
 *   3. SPACE — a mask that is not in the space it was ASKED OF is refused, never
 *      resampled (`maskedRefine`'s house rule). Two spaces now, one per question.
 *   4. EXTENT — count and box in one pass, per mask.
 *   5. ROUTE — `routeInkUpload`, on COUNTS. Fail-closed; the licence to send a
 *      frame whole comes from a positive *nobody is in it*, never from
 *      no-tattoo-found.
 *   6. GUARD — the cut's shortest edge clears the upload door's own floor.
 *   7. CUT — masked cutout, extracted to the ink's box, encoded PNG.
 *
 * # WHAT IT COSTS, stated rather than discovered later
 *
 * **Two segmenter calls per uploaded design** — one `tattooed skin` of her
 * picture, one `human skin` of a padded copy of it — asked together. The pad
 * costs a bigger upload on that one call and not a third call. House money, and
 * the second one is not optional: it IS the licence, and without it a photograph
 * of a person whose ink the reader missed rides whole to an engine.
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
  FACE_REGION,
  cropClearsMinimumEdge,
  cutOutPixels,
  extentOf,
  paddedLicenceCanvas,
  routeInkUpload,
  scopeInkMask,
  subtractMask,
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
  | "cutTooSmall"
  /**
   * A PHOTOGRAPHED PERSON WHOSE INK IS SOMEWHERE ELSE — the region road's own
   * free door (fable-1183 §2, amended fable-1203 §1).
   *
   * She named a surface and the reader found her design outside it. Today that
   * cuts the tattoo it DID find and files it against the placement she named,
   * which is the wrong-boundary class with a picture attached. Refused free
   * instead, in a sentence that names what we could see.
   *
   * ⚠ **GATED ON THE LICENCE, and that gate is the difference between a door
   * and a wall.** A flash sheet reaches this line — `upper arm` finds nothing on
   * a photograph of a piece of paper, so the region holds no design there
   * either — and walling it would refuse THE MOST ORDINARY UPLOAD A TATTOO
   * CUSTOMER MAKES, which is exactly what fable-1172 §2's *"a scope narrows and
   * never refuses"* was written to prevent. So this fires only when the licence
   * says somebody is photographed: `personPixels > 0`.
   */
  | "inkNotOnThatSurface";

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
  /* Names what we COULD see, so she can tell whether we looked at the wrong
     place or she picked the wrong one — and names the road that works, the
     `personWithoutDesign` discipline (fable-1129 §3, D-180's spirit). */
  inkNotOnThatSurface:
    "I can see a tattoo in that picture, but not on the part of the body you picked. "
    + "Pick the placement it's actually on, or attach a photo of that spot. Nothing was charged.",
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
  /**
   * WHETHER THE CUT MAY BE THE SURFACE RATHER THAN THE PATCH INSIDE IT —
   * `CASTING_INK_REGION_CROP_SCOPE`, decided by the caller because the flag is
   * per user and this module knows nothing about users.
   *
   * Absent is off, which is the road this file drove yesterday: the region
   * NARROWS the ink mask and the ink inside it is what is stored.
   */
  regionCrop?: boolean;
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
  /*
    THE LICENCE IS ASKED OF A PADDED COPY, AND THE INK OF HER OWN PIXELS.

    The measurement and the reason live on `LICENCE_PAD_FACTOR` in the pure half,
    where the court that bought them can be found. What matters at this call
    site is the asymmetry, and it is deliberate: `person` is a COUNT and `ink` is
    GEOMETRY, so only one of them may be asked of a picture that is not hers.

    A padding failure REFUSES rather than falling back to her own bytes. The
    fallback is the tempting line and it is the wrong one — it would ask the
    question the court proved is blind, get a confident zero, and ride her
    photograph whole on the strength of it. Fail-closed, and she pays nothing.
  */
  const canvas = paddedLicenceCanvas({ width: decoded.width, height: decoded.height });
  let paddedBytes: Buffer;
  try {
    paddedBytes = await sharp({
      create: {
        width: canvas.width,
        height: canvas.height,
        channels: 3,
        background: { r: 245, g: 245, b: 245 },
      },
    })
      .composite([{ input: input.bytes, left: canvas.left, top: canvas.top }])
      .png()
      .toBuffer();
  } catch (error) {
    log.warn(
      { ...input.about, err: error instanceof Error ? error.message : String(error) },
      "[inkReferenceCutter] her picture would not pad — refusing rather than asking the licence blind",
    );
    return refuse("couldNotRead");
  }

  const [ink, person] = await Promise.allSettled([
    input.reader.region({ image: input.bytes, name: INK_REGION, absentIsAnswer: true }),
    input.reader.region({ image: paddedBytes, name: PERSON_REGION, absentIsAnswer: true }),
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
  for (const [what, mask, space] of [
    [INK_REGION, ink.value, decoded],
    /* The licence was asked of the padded canvas, so ITS space is the padded
       one. Checking it against her own size would refuse every upload — and
       checking nothing would be worse, because the count would then be taken
       from a buffer whose length nobody proved. */
    [PERSON_REGION, person.value, canvas],
  ] as const) {
    if (!inHerSpace(mask, space.width, space.height)) {
      log.warn(
        {
          ...input.about,
          what,
          mask: `${mask.width}x${mask.height}`,
          /* The space this mask was supposed to come back in — hers for the ink,
             the padded canvas for the licence. Printing her size for both is how
             a correct refusal reads as the wrong bug at 3am. */
          expected: `${space.width}x${space.height}`,
          picture: `${decoded.width}x${decoded.height}`,
          bytes: mask.data.length,
        },
        "[inkReferenceCutter] a mask is not in the space it was asked of — refusing rather than resampling",
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
    if (word === null) {
      return { ...scopeInkMask({ ink: ink.value, region: null, half: null }), region: null };
    }
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
      return { ...scopeInkMask({ ink: ink.value, region: null, half: null }), region: null };
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
    /* THE REGION'S OWN MASK TRAVELS OUT, because the region road below carries
       the SURFACE and not the ink inside it. It is the same mask the choice was
       made from — re-asking for it would be a second reading of one picture and
       a second answer to disagree with. */
    return { ...choice, region };
  })();

  /*
    ================================================================
    THE REGION ROAD — the cut is the SURFACE, not the patch inside it
    ================================================================

    `CASTING_INK_REGION_CROP_SCOPE`, approved fable-1183 §2, countersigned
    fable-1201, condition (c) amended fable-1203 §1.

    # Why it exists, in two numbers

    ```
    S1  tattooed skin  10,779 px  140x167   one piece of a thirty-piece body
    S1  upper arm      38,079 px  183x353   the thing she is pointing at
    ```

    On a heavily tattooed person the ink mask is ONE PATCH — the reader answers
    a class with an instance, `masks 1` every time, so nothing is being discarded
    and the reader is exonerated (opus-876 §2). Asking the ink question inside
    the region's own crop returns something SMALLER still. No word and no framing
    that court tested returns the work she is pointing at. **The surface does**,
    and a picture of an inked upper arm IS a picture of the sleeve
    (`crop-holds-the-region-it-depicts`).

    # IT IS AN ESCALATION OF `cut`, so four properties come free

    It is reached only here, after the routing has already decided to cut: a
    flash sheet that rides whole never arrives, a refused picture is not being
    cut at all, and every refusal inside it falls back to the cut this file
    already makes. The worst case of the whole road is the product behaving
    exactly as it does today.

    **It costs TWO new calls, not one** — the in-surface licence and, only once
    that licence is granted, `face`. The second is bought for a surface already
    known to carry ink, so a picture this road is about to leave alone pays for
    one extra question rather than two.

    # THE LICENCE IS THE IN-SURFACE READ, and it took two wrong answers to get

    Whether this road may carry a surface is decided by asking `tattooed skin`
    INSIDE that surface's own crop — the block below, and its docblock carries
    the court. Two earlier tests are on the record because each was defensible
    and each was wrong on the real pictures:

      BOX CONTAINMENT   `inkBox ⊆ regionBox`. Refuses the sleeve that straddles
                        a shoulder, which is what a sleeve DOES — a test that
                        refuses the road's own population is the defect wearing
                        a guard's name. Killed by reading the code (fable-1203).
      `regionHeld`      `|ink ∩ region| > 0`, per pixel and free. **EMPTY on
                        BOTH founder specimens**: the whole-frame read returns
                        one patch of a patchwork body and the surface read
                        outlines the limb, and the two do not touch. Killed by
                        driving the real reader (fable-1205), after 43 unit arms
                        agreed with it — every fixture put the ink inside the
                        surface, because that is what the design sentence said.

    ⚠ **NO THRESHOLD MAY EVER BE ADDED TO THE LICENCE** (fable-1203 §2, and it
    survives the move): `pixels > 0` is this house's own licence form — never a
    percentage. The known slack is survivable for ONE reason, **THE OFFER SHOWS
    HER THE CROP BEFORE ANYTHING RIDES**, so nobody may relax the offer while
    believing the licence stands alone, and if it ever annoys a real customer
    the fix is a better refusal sentence or his ruling, never a percentage.

    # AND THE FACE COMES OUT, unconditionally

    fable-1183 §2b. A surface box is a rectangle over a body and on a torso
    placement it climbs — the S2 specimen's box reaches y=80 and takes the face
    with it. `subtractMask` is the arithmetic and its own docblock carries the
    two-sites-two-questions rule: the LICENCE is a count and may be asked of a
    padded copy; this is ONLY geometry and is asked of her own frame.

    A reader that does not answer drops the ESCALATION rather than refusing her
    picture — the same posture the region question above takes, and for the same
    reason: this is an improvement on a cut we already know how to make.
  */
  /*
    ================================================================
    THE LICENCE, ASKED INSIDE THE SURFACE — and it is the only
    instrument that has ever answered this question correctly
    ================================================================

    Ruled fable-1205 §1, from a court on the founder's own two photographs
    (opus-898). **`ink ∩ region` was the licence for one commit and it is EMPTY
    on both specimens** — the reader returns ONE patch of a patchwork body,
    somewhere on the torso, and separately outlines the arm, and the two do not
    touch. So the road refused a man with two tattooed arms, in a sentence that
    said his tattoo was not on his arm. A false statement about her picture is
    not a refusal.

    The answer was already in the court that opened this road, filed under a
    hypothesis that had died:

    ```
    S1   upper arm        38,079 px          then, INSIDE that crop:
    S1     tattooed skin   2,393 px  73x54   2/2
    S2     tattooed skin  15,877 px 144x238  2/2
    ```

    **THE IN-REGION READ IS A LICENCE AND NEVER A CARRIER** (fable-1205 §1,
    verbatim). It died as a way of GETTING the sleeve — it returns something
    smaller than the whole-frame read, which is why opus-876 buried it. It is
    alive as a way of ASKING WHETHER THE SURFACE CARRIES INK, which is a
    different question and the only one it is being put here.

    ⚠ **THE RESIDUAL RISK, PRICED** (fable-1205 §2c): a reader that misses
    in-region ink on some future picture produces a FALSE REFUSAL — the same
    shape this court just caught, one instrument along. Two backstops, named
    where the refusal is composed rather than left to be remembered: the OFFER
    loop, where she sees what we made of her picture, and fable-919 §3's eyes
    gate before this road is flipped for anybody. And the sentence stays about
    HER PICTURE and never about her judgement, because 1052 forbids a reader's
    verdict that turns a customer away.

    Three outcomes and they do not share a sentinel — `null` is *the road was
    not taken*, `ok: false` is *the reader did not answer*, and `ok: true` with
    zero pixels is *the surface carries no ink*, which is a reading.
  */
  const regionInk = await (async () => {
    if (input.regionCrop !== true || scoped.region === null) return null;
    const box = extentOf(scoped.region).box;
    if (box === null) return null;
    let cropped: Buffer;
    try {
      cropped = await sharp(input.bytes)
        .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
        .png()
        .toBuffer();
    } catch (error) {
      log.warn(
        { ...input.about, err: error instanceof Error ? error.message : String(error) },
        "[inkReferenceCutter] the named surface would not crop — dropping the region road",
      );
      return { ok: false } as const;
    }
    const inside = await input.reader
      .region({ image: cropped, name: INK_REGION, absentIsAnswer: true })
      .catch((error: unknown) => {
        log.warn(
          { ...input.about, err: error instanceof Error ? error.message : String(error) },
          "[inkReferenceCutter] the in-surface ink question went unanswered — dropping the region road rather than refusing her picture",
        );
        return null;
      });
    if (inside === null) return { ok: false } as const;
    if (!inHerSpace(inside, box.width, box.height)) {
      log.warn(
        {
          ...input.about,
          mask: `${inside.width}x${inside.height}`,
          crop: `${box.width}x${box.height}`,
        },
        "[inkReferenceCutter] the in-surface ink mask is not in the crop's space — dropping the region road rather than resampling",
      );
      return { ok: false } as const;
    }
    const pixels = extentOf(inside).pixels;
    log.info(
      { ...input.about, region: input.scope?.region ?? null, inSurface: pixels, ofWholeFrame: inkExtent.pixels },
      "[inkReferenceCutter] the ink the named surface actually carries",
    );
    return { ok: true, box, pixels } as const;
  })();

  const surface = await (async () => {
    /* Licensed, and only licensed: the face call is bought for a surface we
       already know carries ink. A silent licence or an unanswered one drops the
       road rather than spending a second call on a picture we are about to
       leave alone. */
    if (regionInk === null || !regionInk.ok || regionInk.pixels === 0) return null;
    if (scoped.region === null) return null;
    const face = await input.reader
      .region({ image: input.bytes, name: FACE_REGION, absentIsAnswer: true })
      .catch((error: unknown) => {
        log.warn(
          { ...input.about, err: error instanceof Error ? error.message : String(error) },
          "[inkReferenceCutter] the face question went unanswered — dropping the region road rather than carrying a face",
        );
        return null;
      });
    if (face === null) return null;
    if (!inHerSpace(face, decoded.width, decoded.height)) {
      log.warn(
        {
          ...input.about,
          mask: `${face.width}x${face.height}`,
          picture: `${decoded.width}x${decoded.height}`,
        },
        "[inkReferenceCutter] the face mask is not in her picture's space — dropping the region road rather than resampling",
      );
      return null;
    }
    /* A HOLE IN THE MIDDLE OF THE CROP IS THE CORRECT OUTPUT where a face sits
       inside the surface — see `subtractMask`. Refusing the crop instead would
       turn the fence into a wall on the ordinary shoulders-and-chest photograph,
       and the alternative to THAT is carrying the face. */
    const kept = subtractMask(scoped.region, face);
    const extent = extentOf(kept);
    if (extent.box === null) {
      log.info(
        { ...input.about, face: extentOf(face).pixels },
        "[inkReferenceCutter] the named surface is entirely face — the region road carries nothing and the ink cut stands",
      );
      return null;
    }
    /*
      THE FLOOR, AND IT BLOCKS A PLACEMENT RATHER THAN THE ROAD.

      ⚠ This comment read *"today it refuses both founder specimens"* until
      2026-08-21, and that was the claim opus-899 falsified on the real reader
      and corrected in CLAUDE.md and the flag's own docblock — leaving the two
      CODE sites carrying the corrected sentence, which is law 7's sweep half
      missing its last two hits. Measured, both roads driven:

        S1 upper arm     183x353    REFUSED here
        S2 upper arm     229 short  REFUSED here
        S2 upper chest   720x390    CARRIED — the road's first real crop

      So an ARM placement is floor-blocked and a CHEST placement is not: armed,
      this road changes what is stored today. Declared rather than quiet — the
      flag's own docblock carries the floor as the first flip precondition, and
      no floor constant moves before the realism pass's frames (fable-1183 §3).
      Falling back to the ink cut here is what makes the blocked placement inert
      rather than harmful, and the fallback is inert TOTALLY rather than smaller:
      the scoped ink cut is `ink ∩ region` and therefore inside the region, so a
      surface under the floor guarantees the ink box is under it too.
    */
    if (!cropClearsMinimumEdge(extent.box)) {
      log.info(
        {
          ...input.about,
          box: `${extent.box.width}x${extent.box.height}`,
          floor: INK_DESIGN_MIN_EDGE,
        },
        "[inkReferenceCutter] the named surface is under the design floor — the ink cut stands, and this is the road's declared inert state",
      );
      return null;
    }
    log.info(
      {
        ...input.about,
        region: input.scope?.region ?? null,
        surface: extent.pixels,
        face: extentOf(face).pixels,
        ink: scoped.pixels,
        box: `${extent.box.width}x${extent.box.height}`,
      },
      "[inkReferenceCutter] the cut is the SURFACE she named with the face taken out of it — not the patch inside it",
    );
    return { mask: kept, pixels: extent.pixels, box: extent.box };
  })();

  /*
    AND THE DOOR THE REGION ROAD OPENS WHEN THE INK IS SOMEWHERE ELSE.

    She named a surface, somebody is photographed, and the design the reader
    found is not on it. Today that cuts the tattoo it DID find and files it
    against the placement she named — the wrong-boundary class with a picture
    attached.

    ⚠ **`personExtent.pixels > 0` IS LOAD-BEARING AND IS NOT A TIGHTENING.** A
    flash sheet reaches this line: `upper arm` finds nothing on a photograph of
    a piece of paper, so `regionHeld` is false there too. Without the licence
    gate this would refuse THE MOST ORDINARY UPLOAD A TATTOO CUSTOMER MAKES,
    which is precisely what fable-1172 §2's *"a scope narrows and never refuses"*
    exists to prevent. The licence is the one fact that tells the two apart, and
    it has already been read.
  */
  if (regionInk?.ok === true && regionInk.pixels === 0 && personExtent.pixels > 0) {
    log.info(
      {
        ...input.about,
        region: input.scope?.region ?? null,
        ink: inkExtent.pixels,
        person: personExtent.pixels,
      },
      "[inkReferenceCutter] the surface she named carries no ink — refused free rather than filed against the wrong placement",
    );
    return refuse("inkNotOnThatSurface");
  }

  /* `cut` implies `inkPixels > 0`, and a positive count implies a box — but the
     one thing a corner marked "cannot happen" reliably does is happen, so it is
     answered rather than asserted.

     The SURFACE's box when the region road carried, the scoped ink's otherwise —
     one expression, so the guard below and the extract below cannot end up
     looking at two different boxes. */
  const box = surface?.box ?? scoped.box;
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
    /* THE SURFACE when the region road carried, the SCOPED MASK otherwise —
       which is the whole ink mask when nothing narrowed it, so an unscoped cut
       is byte-identical to the one this file made before the region question
       existed. */
    mask: surface?.mask ?? scoped.mask,
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
      /* WHICH ROAD PRODUCED THESE BYTES, so a frame can be traced to the
         decision that made it rather than guessed at from its size. */
      carried: surface ? "surface" : "ink",
      surfacePixels: surface?.pixels ?? null,
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
