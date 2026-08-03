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
  /**
   * Hair that the 36-cut catalogue cannot name — a mullet, a specific fade.
   *
   * Deliberately NOT called `hairStyle`: that name belongs to the guaranteed
   * lane and the type-level carve-out below would reject it. A value the
   * catalogue DOES know is promoted out of here into `hairStyle`, so naming a
   * real cut still buys its family, its worn state and its teeth.
   */
  hair: "HAIR",
  /**
   * Eyes the palettes cannot name — "seafoam", "the colour of weak tea".
   *
   * Named `eyes` rather than `eyeColour` for the same reason `hair` is not
   * `hairStyle`: the guaranteed names are reserved, and the type carve-out
   * below would reject a collision. A value the palette DOES hold is promoted
   * back out into `eyeColour`, so "green" never loses its iris prose.
   */
  eyes: "EYES",
  brows: "BROWS",
  lashes: "LASHES",
  nose: "NOSE",
  lips: "LIPS",
  teeth: "TEETH",
  cheekbones: "CHEEKBONES",
  jaw: "JAW",
  chin: "CHIN",
  ears: "EARS",
  skin: "SKIN",
  /** Visible marks: scars, freckling, birthmarks, vitiligo. NOT ink. */
  marks: "MARKS",
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
