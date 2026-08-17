/**
 * EYE SHAPE — the class's own routing row, and the one place its prose lives.
 *
 * # Why this is a module rather than a line in the composer
 *
 * `eye.shape` is the only class this program has ever failed to deliver, and the
 * reason turned out not to be any of the four things it was blamed on. It was
 * not prompt strength (D-237 measured that), not the reader (exonerated twice),
 * not occlusion (the bare-faced probe), and not — the founder's catch — a
 * capability limit at all:
 *
 * **every fox-eyes test ever run used faces with a high baseline canthal tilt,**
 * so the ask was for a property those faces already had. Measured afterwards,
 * the two arms of my own "decisive" probe sat at 7.71 and 7.2 degrees. An engine
 * changing nothing and an engine rendering that ask perfectly are the same
 * picture. Every prior verdict is annulled.
 *
 * On a face measured FLAT (-0.76deg) the class delivers. So the row exists, and
 * everything it needs — the words, the engine, the free refusal — lives here
 * rather than being spread across the composer, the router and a probe script
 * that will drift from all of them.
 *
 * # THE WORDS ARE THE LEVER, AND THE TREND TERM IS THE TRAP
 *
 * *"Fox eyes"* in a training set is a MAKEUP LOOK — liner and lift on an
 * unchanged eye — which is precisely the behaviour that was photographed and
 * misread as non-compliance. The engine was arguably succeeding at a definition
 * nobody meant. `ANATOMICAL_UPSWEPT_EDIT` therefore describes the geometry and
 * never says the words, and it forbids the makeup reading explicitly.
 *
 * **Honest limit on that claim:** the trend arm has never once yielded a tilt
 * reading (four attempts, the segmenter could not find an eye on any of them),
 * so the vocabulary comparison has zero measurements on one side. What IS
 * measured is that the anatomical arm restructures — +4.84 and +3.99 degrees on
 * one face, then +6.35 and +7.61 across the matrix. Attribution between "the
 * words" and "the engine" remains UNSETTLED and is not asserted here; the row
 * was decided on realism, which does not depend on settling it.
 *
 * # RATIFIED, after a deliberately provisional interval
 *
 * The row was held provisional while exactly one face had been tested, and only
 * hardened once the cross-cast matrix had run over six casts spanning baseline,
 * gender and ethnicity — judged on REALISM FOR THE SUBJECT by the founder's eye
 * rather than on the tilt number, which could not read both engines fairly.
 * NBP took it: the same person, with genuinely restructured eyes.
 */
import { alreadyUpswept, cornersFromMask, readingFrom } from "./canthalTilt";
import type { EyeShape } from "../../shared/castingRealization";
import type { Mask } from "./maskedComposite";

/**
 * THE PROSE, in one place, because the alternative is a probe measuring one
 * sentence while production sends another.
 *
 * That is not hypothetical: D-237's first run compared a bare term against
 * engineered prose while believing it was testing the product's own
 * instruction, and drew a conclusion about the wrong thing. The calibration
 * matrix imports this constant for exactly that reason.
 *
 * Every clause earns its place:
 *   - the corners are described RELATIVE TO EACH OTHER, per eye, because that is
 *     what canthal tilt is and what the instrument measures
 *   - the lower lash line is named, because lifting only the corner produces a
 *     pulled look rather than a shape
 *   - makeup is forbidden by name, because the trend reading is the failure mode
 *   - identity, bone structure and everything else are pinned, because this
 *     rides the masked path and the harvest is not a licence to be careless
 *     about what the engine is asked for
 */
export const ANATOMICAL_UPSWEPT_EDIT =
  "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + "Reposition the outer corner of each eye so it sits clearly HIGHER than the inner corner "
  + "of that same eye — raise the lateral corners upward toward the temples, and let the lower "
  + "lash line rise to meet them, so each eye opening becomes longer and narrower and slants "
  + "upward from the nose. This is the underlying position of the eyelid corners and the shape "
  + "of the eye opening itself. Do not add or change any makeup, eyeliner, eyeshadow or lashes. "
  + "Keep her identity, bone structure, skin, hair, expression, pose, clothing and background "
  + "exactly as they are.";

/**
 * THE ROUTING ROW IS RETIRED — founder ruling, 2026-08-17 (fable-848 §1-2).
 *
 * `EYE_SHAPE_ENGINE = "nbp"` and `EYE_SHAPE_ROUTING_IS_PROVISIONAL` stood here
 * from 2026-08-07 to 2026-08-17. **Both are deleted, and nothing changes at
 * runtime, because nothing ever read them** — the constant had no call site for
 * its whole life (found opus-596 §5, ruled fable-807 §3), while three tests
 * asserted it against its own literal. Every eye.shape refine this product has
 * ever painted went to GPT Image 2.
 *
 * His words, closing it:
 *
 * > *"our entire processs runs on gpt image 2 so yes retire it , and if things
 * > genuinely start failing we can look at NBP later - i honestly think the
 * > only difference between gpt image 2 and NBP on the original sheets was NBP
 * > had a more severe drawing han gpt image 2 which was the same for ther lips
 * > tests where NPB went a bit overboard"*
 *
 * So the 2026-08-07 matrix is not overturned — it is **re-read**: one fact
 * about engine temperament, seen twice (eyes and lips), rather than two
 * verdicts pointing opposite ways. The specimens and the sheet stay on record.
 *
 * The evidence that the surviving road delivers this class is his own, in
 * production: *"give her fox eyes"* on 2026-08-16 at 23:48:12Z, painted by GPT
 * Image 2, charged and delivered — invisible at full frame and unmistakable at
 * 3× (doctrine entry 20).
 *
 * **The re-open condition is his and it is written here so it is not folklore:**
 * *"if things genuinely start failing we can look at NBP later."* Until then
 * there is no per-class engine row, and a future one is a new decision rather
 * than a restoration.
 *
 * FLUX remains banned 0-for-4, and that ban is a CONTROL rather than a constant:
 * `assertEngineNotBanned` runs at both image dispatch seams
 * (`providers/bannedEngines`). It never depended on this row.
 */

/**
 * THE ALREADY-TRUE GATE, fourth member of the refuse-before-dispatch family.
 *
 *   absent        you cannot segment a thing that is not there (D-213)
 *   silhouette    you cannot segment a shape that has not been made yet (D-218)
 *   occluded      you cannot edit what nothing can see (D-226)
 *   already-true  there is nothing to do
 *
 * One shape, four doors, all free, all derived from what is already in hand. An
 * ask for a property the face measurably HAS is not a render — it is a question,
 * and asking it costs nothing while charging for it costs a customer a picture
 * identical to the one they had.
 *
 * **It applies to this class from birth**, which means it fires on the walk
 * candidate herself: she measures 7.2 degrees, so *"fox eyes"* on her is
 * already-true, and the correct product behaviour is to ask rather than to
 * spend. That is not the walk failing — it is the walk meeting the right answer.
 *
 * The re-ask resolves as a RELATIVE intensification against the measured
 * baseline, through the machinery relative asks already use — "more tilt" is not
 * a second attempt at the same absolute ask.
 */
/**
 * WHICH EYE-SHAPE ASKS ARE ABOUT AN UPWARD TILT — and it is a short list on
 * purpose.
 *
 * The already-true gate must fire on a request for an upswept eye and never on
 * one of the other eight shapes. "Hooded" and "monolid" describe the lid, not
 * the corners; "downturned" asks for the OPPOSITE tilt, and a gate that fired
 * there would refuse the one ask a high-baseline face most needs. So the
 * mapping is enumerated rather than inferred from the prose.
 */
const UPSWEPT_ASKS: readonly EyeShape[] = ["fox eyes", "upturned"];

export function isUpsweptAsk(shape: EyeShape | null | undefined): boolean {
  return shape != null && UPSWEPT_ASKS.includes(shape);
}

/**
 * The same question asked of RAW TEXT, for re-deriving an outstanding question.
 *
 * The client sends back which sentence is outstanding, never the question
 * itself, so the server has to rebuild it — and rebuilding this one cannot use
 * `isUpsweptAsk`, which needs a parsed shape and therefore an interpreter call
 * the answer path has not made yet. Deriving both from `UPSWEPT_ASKS` is what
 * stops the text door and the parsed door drifting apart (law 4).
 *
 * Forging it buys nothing: the answer resolves to an instruction the user could
 * have typed unaided, which is the property every option in `refineReask` has.
 */
export function mentionsUpsweptAsk(text: string): boolean {
  const said = text.toLowerCase();
  return UPSWEPT_ASKS.some((shape) => said.includes(shape));
}

/**
 * READ HER TILT THE WAY THE MEASUREMENT LAW SAYS TO — both rungs, master-anchored.
 *
 * A single rung is BIASED, not merely incomplete: segmenting a whole frame goes
 * blind exactly on narrowed eyes, so full-frame-only reads systematically miss
 * the strongest cases. Measured, blind renders averaged +5.11 degrees of change
 * against +1.40 for readable ones.
 *
 * **The crop comes from the master, never from the render, so the measurement
 * cannot wander to where the answer is convenient.** That is assert-at-the-wire's
 * sibling for instruments, and it is the reason this takes one image and crops
 * it against its own eyes rather than against anything downstream.
 *
 * Returns null when neither rung reads. **A no-read must never fire the gate**:
 * the gate refuses a render, and a false "she already has it" costs a customer
 * the picture they asked for — which is the one failure this program has shipped
 * before and does not get to ship again. Silence resolves toward spending.
 */
export async function readCanthalTilt(input: {
  image: Buffer;
  reader: { region(input: { image: Buffer; name: string }): Promise<Mask> };
}): Promise<{ meanDeg: number; asymmetryDeg: number } | null> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(input.image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return null;

  /*
    THE SIDE-NAMING RUNG IS GONE (D-238, ruled fable-132).

    This used to ask `region({ name: "right eye" })` and `"left eye"` first and
    pair the two answers by which prompt produced them. Those names are not in
    the reader's bilateral set, so they went to SAM 3 verbatim — and `"right eye"`
    returns ZERO masks on real frames, measured on the founder's own. So the rung
    threw on every face tried, spent four provider calls doing it (twice: once
    full-frame, once inside the crop), and its only lasting effect was to STARVE
    the rung below it: the bilateral `eyes` union it fell through to was one eye,
    which `cornersFromMask` correctly refuses.

    **Annotation for the pack, and it is not a re-score:** tilt NO-READs recorded
    before 2026-08-10 conflate two mechanisms — genuinely narrowed apertures AND
    a laterality-blind region call that starved this ladder. The fox-eyes
    matrix's annulment already stands on its own grounds; no historical number is
    re-scored here. Where the old path DID read, the fixed reader returns the
    identical number (v#165: 2.29° both ways), which is why this is a recovery of
    coverage rather than a change of instrument.

    What remains is the rung the module's own header always called
    interchangeable: one bilateral `eyes` read, split into two eyes by connected
    components.
  */
  const corners = async (image: Buffer, w: number, h: number) => {
    try {
      const eyes = await input.reader.region({ image, name: "eyes" });
      const pair = cornersFromMask(eyes);
      return readingFrom(pair.outers, pair.inners, w, h);
    } catch {
      return null;
    }
  };

  const full = await corners(input.image, width, height);
  if (full) return { meanDeg: full.meanDeg, asymmetryDeg: full.asymmetryDeg };

  /* Rung two: crop to her own eyes and ask again, where they fill the frame. */
  try {
    const eyes = await input.reader.region({ image: input.image, name: "eyes" });
    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let index = 0; index < eyes.data.length; index += 1) {
      if (eyes.data[index] <= 127) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0) return null;
    const padX = Math.round((maxX - minX) * 0.45);
    const padY = Math.round((maxY - minY) * 2.2);
    const left = Math.max(0, minX - padX);
    const top = Math.max(0, minY - padY);
    const box = {
      left,
      top,
      width: Math.min(width - left, (maxX - minX) + padX * 2),
      height: Math.min(height - top, (maxY - minY) + padY * 2),
    };
    const crop = await sharp(input.image).extract(box).png().toBuffer();
    const zoned = await corners(crop, box.width, box.height);
    return zoned ? { meanDeg: zoned.meanDeg, asymmetryDeg: zoned.asymmetryDeg } : null;
  } catch {
    return null;
  }
}

/**
 * THE QUESTION ITSELF LIVES IN `refineReask`, and that move is the fix.
 *
 * This module used to build its own `{ because, offer, decline }` and the call
 * site interpolated **only `because`** into a thrown error sentence — so the
 * offer and the decline were constructed on every firing and never reached a
 * screen, and the question could be read but not answered. A question with no
 * answer path is a dead end, which is the one thing D-180 says a question may
 * never be; the module's own doc above had already specified the resolution
 * ("resolves as a RELATIVE intensification") and nothing implemented it.
 *
 * So the shape is now the same one the other two free questions use — a
 * `Reask` with chips, returned as `kind: "asked"`, resolvable by typing — and
 * it is built in exactly one place: `alreadyUpsweptReask` in `refineReask.ts`.
 * What stays here is the part that is about eyes: the vocabulary
 * (`UPSWEPT_ASKS`), the instrument (`readCanthalTilt`) and the threshold
 * (`alreadyUpswept`, in `canthalTilt`).
 */
