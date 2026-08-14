/**
 * HOW BIG A CHANGE THIS CLASS ACTUALLY MAKES — per subject, derived.
 *
 * # The defect this exists to end
 *
 * Every band table in this program counts pixels that moved more than **25
 * levels**, and that constant was calibrated on the only defects it had ever
 * been pointed at: a hem, a haircut, a pair of glasses. Those replace pixels
 * wholesale.
 *
 * A freckle is worth about **four**. Measured at 25 it does not exist — the
 * instrument reports "the painter did nothing" about a face visibly covered in
 * them, which is exactly what happened until `freckles-layers.mts` was made to
 * count at several amplitudes and the delivery turned out to have been there all
 * along. The class sweep is about to measure skin, makeup and brows; a single
 * threshold calibrated on haircuts would report those classes as broken and the
 * table would be worse than no table.
 *
 * # Why a derived record and not a lookup with a default
 *
 * A default is how the qualifier table came to arm three subjects of
 * twenty-three: everything nobody had thought about fell into the same quiet
 * bucket and nothing said so. `Record<FreeSubject, …>` means a new subject
 * **does not compile** without a decision here, and the test closes the other
 * direction.
 *
 * # Every entry states where its number came from — and most are REASONED
 *
 * Only `marks` is measured. Saying so at each entry is the point: a reasoned
 * threshold is a declared shortcut and can be improved by pointing a control at
 * it, while a reasoned threshold wearing a measured one's clothes is how a
 * constant survives four years of being wrong. `MEASURED` entries carry the
 * fixture that produced them.
 */
import { FREE_SUBJECT_KEYS, type FreeSubject } from "./refineSubjects";
import { tableOf } from "./subjectCards";
import { subjectsOfFacet, type Facet } from "./refineFacets";

export type AmplitudeBasis =
  /** A control was run and this is what it read. */
  | { readonly measured: string }
  /** No control yet — the number follows from what the class does to pixels. */
  | { readonly reasoned: string };

export type ChangeAmplitude = {
  /**
   * Mean per-channel delta, in levels, above which a pixel counts as MOVED for
   * an edit of this class.
   */
  readonly levels: number;
  readonly basis: AmplitudeBasis;
};

/**
 * The three bands these fall into, named so the reasoning is legible:
 *
 *   REPLACEMENT (25)  the class puts different content where the old content
 *                     was — an accessory, a haircut, a removal. A pixel either
 *                     belongs to the new thing or it does not.
 *   RESTRUCTURE (10)  the class moves an edge or a contour a little. The
 *                     interior barely changes; the delta lives at boundaries.
 *   SURFACE (4)       the class changes the skin's own tone or texture by a few
 *                     levels over a wide area. Measured on freckles.
 */
const REPLACEMENT = 25;
const RESTRUCTURE = 10;
const SURFACE = 4;

export const CHANGE_AMPLITUDE: Record<FreeSubject, ChangeAmplitude> =
  tableOf((card) => card.amplitude);

/** The threshold an instrument should count at when measuring this class. */
export function amplitudeFor(subject: FreeSubject): number {
  return CHANGE_AMPLITUDE[subject].levels;
}

/** Subjects whose threshold is reasoned rather than measured — the work list. */
export function unmeasuredAmplitudes(): FreeSubject[] {
  return FREE_SUBJECT_KEYS.filter((subject) => "reasoned" in CHANGE_AMPLITUDE[subject].basis);
}

/**
 * IS THIS FACET'S CHANGE ONLY A FEW LEVELS DEEP?
 *
 * # Why a prompt lane asks a pixel-amplitude question
 *
 * Measured on run-15's own face and prompts, 32 paints, composites read ten
 * times each with her bare master as a negative control in the sitting:
 *
 *     marks (SURFACE)        caption in the ask   0/16      no caption   11/16
 *     hair.colour (REPLACEMENT)  caption in the ask   4/4    no caption    4/4
 *
 * The marks column is not a rate difference, it is a wall — five wordings, two
 * placements, both framings, always zero. And the hair column says the caption
 * is not the problem in general, so the boundary is real and this is where it
 * runs.
 *
 * **The mechanism the two columns imply.** A caption states what a facet looked
 * like when it last rendered, and the painter is holding the master while it
 * reads that. For a REPLACEMENT facet the caption is manifestly false of the
 * picture in hand — her hair is grey and the caption says warm copper — so it
 * cannot be read as a report and the ask survives. For a SURFACE facet the
 * described state is *indistinguishable from her master at the amplitude it
 * describes*: "a light scattering of small freckles, faint and sparse" is
 * exactly what unfreckled skin could plausibly look like to a reader of a
 * 1024x1536 portrait. So the ask is absorbed into a restatement of the prior,
 * and the correct response to being told the picture already has the thing is
 * to change nothing.
 *
 * That is not a new class. `refineDelta.ts` already refuses the same shape one
 * layer up, where the INTERPRETER returns an ask that came back as a
 * restatement of what is already filed — for the same reason, in the same
 * words. This closes the door the prompt composer was holding open.
 *
 * # The boundary is amplitude, and it is this table's own
 *
 * `marks` is the measured member; `skinTone`, `skinCharacter` and `cheekbones`
 * are here because they are the same few-levels-over-a-wide-area change, which
 * is the reasoning this table exists to make explicit rather than to hide. Each
 * of them is one fixture away from being measured, and the fixture is written.
 */
export function isSurfaceFacet(facet: Facet): boolean {
  const subjects = subjectsOfFacet(facet);
  /* A facet no free subject answers is an AXIS facet — hair colour, eye
     colour — and every one of those is a replacement. `every` on an empty list
     is `true`, which would quietly make the whole axis lane surface. */
  return subjects.length > 0 && subjects.every((subject) => CHANGE_AMPLITUDE[subject].levels === SURFACE);
}
