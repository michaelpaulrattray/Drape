/**
 * What a refinement is allowed to be ABOUT — the free lane's closed subjects
 * (D-131).
 *
 * # Subjects are code-owned. Only values are free.
 *
 * The tempting shape is a model-authored `{ axis, text }`, and it is wrong for
 * D-89's reason: it hands the composition key to the model. "Her brows" comes
 * back as `brows` one time, `brow shape` the next and `eyebrows` the third, so
 * last-writer-wins silently becomes accumulation and "thin" and "thick" end up
 * in one prompt arguing with each other. A closed subject list makes the
 * overwrite mechanical again.
 *
 * # This list IS wall (b)
 *
 * Person, never stage. There is no subject for a red coat, a backdrop or a
 * prop — so the wall is a **missing slot** rather than an instruction the model
 * is asked to respect. A wardrobe ask cannot be filed, and wall (d) says
 * anything that cannot be filed refuses.
 *
 * # And the guarantee lane is carved out of it by TYPE
 *
 * Anything with an engineered vocabulary is deliberately absent here, and
 * `GuaranteedSubjectsAreExcluded` below fails the build if one creeps in. That
 * is what stops "green eyes" quietly losing its iris prose and its
 * failed-candidate teeth by taking the free lane instead.
 */
import type { RefinableAxis } from "./refineDelta";

/**
 * The free-lane subjects, each with the heading its prose is composed under.
 *
 * Headings matter: the D-87 sweep's footprint check looks for `SUBJECT: value`
 * in the composed prompt, so a subject without a stable heading is a subject
 * the sweep cannot see.
 */
export const FREE_SUBJECTS = {
  /*
    HAIR IS FOUR FACETS, NOT ONE (D-142).

    It shipped as a single `hair` slot and the founder's first real stack broke
    on it: "change hair to mullet", then "copper hair", then "actually black
    hair" — every instruction kept in the record, and NO mullet in the picture,
    because last-writer-wins on one coarse slot let a colour edit annihilate a
    cut. The eyes were already right ("seafoam" and "hooded" coexist), and the
    difference was only that eyes had been split and hair had not.

    A subject is one FACET a person can change independently. Two things that
    can be true at once need two slots, or the second silently deletes the
    first.
  */
  hairCut: "HAIR CUT",
  hairShade: "HAIR COLOUR",
  hairPattern: "HAIR TEXTURE",
  hairFinish: "HAIR FINISH",
  /*
    HOW it is worn, which is not WHAT it is cut into. "Hair worn down" has
    nothing to do with the cut and everything to do with the styling, and with
    no slot for it the instruction had nowhere to land at all — the third time
    a real facet turned out to be nobody's.
  */
  hairWorn: "HAIR WORN",
  /*
    Eyes were ALREADY split, and that is why they worked: "seafoam" and
    "hooded" coexisted on the founder's stack while the mullet died. Kept split
    here, named apart from the guaranteed `eyeColour`/`eyeShape` so the
    type-level carve-out still holds.
  */
  eyeColourFree: "EYE COLOUR",
  eyeShapeFree: "EYE SHAPE",
  brows: "BROWS",
  lashes: "LASHES",
  nose: "NOSE",
  lips: "LIPS",
  teeth: "TEETH",
  cheekbones: "CHEEKBONES",
  jaw: "JAW",
  chin: "CHIN",
  ears: "EARS",
  skinTone: "SKIN TONE",
  skinCharacter: "SKIN CHARACTER",
  /** Visible marks: scars, freckling, birthmarks, vitiligo. NOT ink. */
  marks: "MARKS",
  /*
    ADORNMENT IS THE PERSON, NOT THE STAGE (D-160).

    "Small gold hoops" was refused as "wardrobe or set", which contradicts a
    standing founder ruling: earrings, glasses and piercings are legitimate
    refine instructions, because adornment never arrives unbidden and Refine is
    the stated channel for asking. The roll pipeline has honoured exactly this
    since the D-116 family — `statedAccessories` is already an intent axis and
    the cohort constant already gives it failure-to-appear teeth — so the wall
    was refusing on one surface what the other surface promised.

    The wall narrows rather than falls: garments, headwear, the backdrop, props
    and the scene are still the stage, and still refuse.
  */
  statedAccessories: "ACCESSORIES",
  /** Ink is its own subject because D-133 gives it its own law. */
  ink: "INK",
  facialHair: "FACIAL HAIR",
  /**
   * Presentation state, and the ONLY subject that does not file as identity
   * (D-136). Follow must never inherit a smile.
   */
  expression: "EXPRESSION",
} as const;

export type FreeSubject = keyof typeof FREE_SUBJECTS;

export const FREE_SUBJECT_KEYS = Object.keys(FREE_SUBJECTS) as FreeSubject[];

/**
 * The one subject that files somewhere else.
 *
 * `readResolvedIdentity` passes unknown fields through whole, so an expression
 * filed into the identity blob would be inherited by every follow by default —
 * a momentary choice made permanent for eight strangers. It is separated here,
 * once, rather than remembered at each write site.
 */
export const PRESENTATION_SUBJECTS: readonly FreeSubject[] = ["expression"];

export function isPresentationSubject(subject: FreeSubject): boolean {
  return PRESENTATION_SUBJECTS.includes(subject);
}

/**
 * Subjects that are PLURAL — one slot holding a whole set.
 *
 * "a scar on her cheek and freckles across her nose" is one marks value, and a
 * later marks instruction restates the whole set absolutely rather than adding
 * to it. That keeps last-writer-wins honest: removal stays arithmetic, because
 * the value is always the complete current answer rather than an increment.
 */
export const PLURAL_SUBJECTS: readonly FreeSubject[] = ["marks", "ink"];

/*
  THE GUARANTEE-LANE CARVE-OUT, at compile time.

  Every axis with an engineered vocabulary must be ABSENT from the free
  subjects. Adding `eyeColour` here would stop the build rather than quietly
  costing every future "green eyes" its iris prose and its teeth.
*/
type GuaranteedSubjectsAreExcluded = Extract<FreeSubject, RefinableAxis> extends never ? true : never;
const _guaranteedSubjectsAreExcluded: GuaranteedSubjectsAreExcluded = true;
void _guaranteedSubjectsAreExcluded;

/**
 * The instruction the interpreter is given about where each free ask belongs.
 *
 * Built from the same constant the parser validates against, so the prompt and
 * the checker cannot drift — the failure that would otherwise show up as a
 * model dutifully using a subject the code has never heard of.
 */
export function freeSubjectGuidance(): string {
  return FREE_SUBJECT_KEYS.join(", ");
}
