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
 * two renders. Attribution between "the words" and "the engine" is unsettled and
 * is being decided by the cross-cast matrix, not asserted here.
 *
 * # PROVISIONAL, and the word is load-bearing
 *
 * `EYE_SHAPE_ENGINE` is this round's winner on ONE face. The founder's ruling is
 * that the row does not harden until the cross-cast matrix has run across four
 * to six casts spanning baseline, gender and ethnicity, judged on REALISM FOR
 * THE SUBJECT by eye rather than on the tilt number. A split verdict — one
 * engine for some face classes, another for others — is a legitimate outcome and
 * simply adds a column.
 */
import { alreadyUpswept } from "./canthalTilt";

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
 * PROVISIONAL routing for the class. Nano Banana Pro took this round on the one
 * face that has been tested; GPT Image 2 measured +0.52deg on the same face and
 * same prose, which is inside the instrument's noise.
 *
 * FLUX is not a candidate and never will be again — banned 0-for-4
 * (`BANNED_ENGINES` in `providers/falImages`), having decorated rather than
 * restructured when given a caged chance at the one thing it was reputed for.
 */
export const EYE_SHAPE_ENGINE = "nbp" as const;

/** Has the matrix run? Until it has, this row is not settled and says so. */
export const EYE_SHAPE_ROUTING_IS_PROVISIONAL = true;

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
export type AlreadyTrueReAsk = {
  /** What the face already is, said plainly and without jargon. */
  because: string;
  /** The offer, which is the only thing that would actually change the picture. */
  offer: string;
  /** The decline, which must be as easy as the accept. */
  decline: string;
};

export function upsweptReAsk(reading: { meanDeg: number }): AlreadyTrueReAsk | null {
  if (!alreadyUpswept(reading)) return null;
  return {
    because: "Her eyes already sweep up at the outer corners.",
    offer: "More tilt",
    decline: "Never mind",
  };
}
