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
  /*
    A CONDITION OF THE SKIN, WHICH IS NOT A MARK ON IT (fable-363 ruling 2,
    executing the founder's taxonomy in fable-361 §3).

    The taxonomy is the founder's: only enumerable FEATURES ever get a picture,
    and everything diffuse carries as words. The interpreter did not know it —
    measured on the real transport, *"acne on her face"* filed under `marks`
    four times in five, and the fifth found this slot on its own. Acne is not a
    thing you can point to; it is what her skin is doing, so it belongs here
    beside weathering, ruddiness and being freckly in general.

    The split this pair now holds: **one thing you could point at is a MARK; a
    quality spread over her with no one place is a CHARACTER.**
  */
  skinCharacter: "SKIN CHARACTER",
  /** One sited thing on the skin: a mole, a scar, a birthmark, freckles across
      her nose. NOT ink, and NOT a diffuse condition — see `skinCharacter`. */
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
  /*
    HER BUILD — ONE ROW, FIVE FACETS, AND THE SPLIT IS PLUMBING (fable-381 §A.3,
    narrowed by the founder in fable-382 §3).

    His ask: *"We need body shape/build — larger bust, smaller waist, bigger
    arms, bigger chest etc — this would need a row."* His correction a day
    later: *"their body should just be a single thing like body type or body
    shape it doesnt need individal pieces like hips chest etc thats too much and
    over complicated."*

    Both are honoured because a ROW is not a FACET. The panel draws ONE row and
    the ask box takes one holistic sentence; underneath, D-142 still applies —
    *"broader shoulders"* and *"a slimmer build"* can both be true at once, so
    filed to one slot the second would silently delete the first, which is the
    mullet-under-copper defect rebuilt in a new place. `skin` is the precedent
    that makes this ordinary rather than clever: three facets, one row, per-facet
    supersession, and nobody has ever seen the seam.

    **No `hips`, by founder ruling** — and `waist` is here not because it can be
    rendered but because it must be DECLINED BY NAME. It is below the crop line
    of every frame this product makes (`castingFrame.ts`), and a vocabulary that
    could not recognise the word would send the ask to the stage wall, where the
    honest answer is "the photograph does not contain her waist".
  */
  bust: "BUST",
  waist: "WAIST",
  shoulders: "SHOULDERS",
  arms: "ARMS",
  build: "BUILD",
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
 * PRESENCE OR DEGREE — the split that decides whether an ask can REFUSE.
 *
 * # Why this table exists, and what it cost to learn
 *
 * `refineService` bound exactly one facet — `statedAccessories` — and every
 * other free subject was advisory, so a render could come back with NONE of
 * what the user typed, be correctly reported as such by the reader, and still
 * be charged for. Run 1 of the replay walk (2026-08-11, production, the
 * founder's own account) is the specimen: *"wear her hair down"* delivered a
 * high bun, the reader said **"hair pulled up into a high curly bun, not
 * down"** verbatim on both renders, the live reference library independently
 * refused the crop as `disputedDelivery` — and 25 credits were charged, twice.
 * The identical failure on the identical facet had already been refunded once
 * as a correction on 2026-08-07 (operation `92e327ab`, *"tie her hair up"*);
 * the response then was to make the READER re-read affirmatives (D-235), which
 * worked perfectly and changed nothing, because nothing consulted what it saw.
 *
 * D-246 class (c) — *"the asked thing COMPLETELY absent"* — is a founder ruling
 * and it is a runtime gate. The gate existed for accessories only because the
 * specimens arrived there first, and the old comment set the condition in as
 * many words: *"Each widening comes with its own specimens."* Run 1 is those
 * specimens.
 *
 * # The split, and why it is not "bind everything"
 *
 * D-187 is real and stays: asking a reader whether greenish-hazel is
 * *distinctly* "seafoam green" refunded six legitimate renders in eighteen.
 * The distinction the product can hold a reader to is the one already written
 * beside the old flag — **presence binds; degree advises**:
 *
 *   - **presence** — either the thing is in the picture or it is not. "Are
 *     there dangly cross earrings on her." "Is her hair down." A photograph
 *     answers it and two honest people agree on the answer.
 *   - **degree** — a matter of shade, amount, or quality nobody has defined.
 *     "Is this green *distinctly* seafoam." "Are these lips *fuller*." A
 *     photograph cannot settle it and a reader asked to try invents a verdict.
 *
 * # What actually makes the widening safe
 *
 * Not the shortness of the presence list — the ABSENCE GATE beside it. A
 * presence miss refuses only when the reader says the asked thing is *entirely
 * absent* (`FacetCheck.absent`), never when it merely quibbles with how the
 * thing was done. The must-not-fire specimen is run-10's: she asked for gold
 * hoop earrings, got gold hoop earrings, and the reader marked it unverified
 * because they were *"thin and understated, not bold hoops"* — an adjective she
 * never used. The hoops are IN the picture, so that is not an absence, so it
 * cannot refuse. See `renderVerification.FacetCheck.absent`.
 *
 * A subject classified `degree` here can never refuse however loudly a reader
 * complains; a subject classified `presence` refuses only on a worded absence.
 */
export const FREE_SUBJECT_KIND: Record<FreeSubject, "presence" | "degree"> = {
  /*
    ── PRESENCE ──────────────────────────────────────────────────────────────
    Four, and each is a whole thing that is either on her or not.
  */
  /** THE SPECIMEN'D ONE. Hair is down or it is not; the vocabulary is closed
      (`presentationState`'s arrangement list) and the reader answers it from
      the photograph. Two production specimens plus a prior refund. */
  hairWorn: "presence",
  /** Already binding before this table existed — D-160's ruling that adornment
      is the person, and the fix that gave the free lane its first teeth. */
  statedAccessories: "presence",
  /** D-133 gives ink its own law, and its own law is about WHERE a design sits.
      A tattoo asked for and not drawn is an absence, not a shade dispute. */
  ink: "presence",
  /** A beard asked for and not grown is an absence. "Stubble rather than the
      full beard she asked for" is a quibble and the absence gate declines it. */
  facialHair: "presence",

  /*
    ── DEGREE ────────────────────────────────────────────────────────────────
    Nineteen, and every one of them is a continuum somebody would have to
    arbitrate. None of these may ever spend a refusal.
  */
  /** The founding D-187 case, in both lanes. */
  eyeColourFree: "degree",
  eyeShapeFree: "degree",
  /** A cut is a described SHAPE. The gap between "a bob" and "a long bob" is
      the seafoam problem wearing a haircut, and D-187's live trial refused two
      renders in this neighbourhood already. */
  hairCut: "degree",
  hairShade: "degree",
  hairPattern: "degree",
  hairFinish: "degree",
  /** Explicitly ruled advisory when accessories were bound: the marks reader
      sits at a measured floor and BYTE ADJUDICATION is its honest instrument.
      Presence-binding it would refund provably delivered freckles. */
  marks: "degree",
  brows: "degree",
  lashes: "degree",
  nose: "degree",
  lips: "degree",
  teeth: "degree",
  cheekbones: "degree",
  jaw: "degree",
  chin: "degree",
  ears: "degree",
  /*
    EVERY BODY FACET IS A DEGREE ASK, and that is the row's weakest column said
    out loud rather than discovered in a refund. Larger, smaller, bigger,
    broader — a photograph cannot settle any of them, and fable-349 proved the
    reader blind to subtle degree on a real paid render (delivered fuller lips
    read back as "naturally thin, not fuller"). So a body ask can never refuse
    on the reader's word, exactly as the lips row cannot.
  */
  bust: "degree",
  waist: "degree",
  shoulders: "degree",
  arms: "degree",
  build: "degree",
  skinTone: "degree",
  skinCharacter: "degree",
  /** A continuum — "softer", "warmer", "more serious" — of which the one crisp
      case (smiling or not) is a subset. Classified honestly rather than
      optimistically; it can be promoted when it has a specimen of its own. */
  expression: "degree",
};

/** Whether an ask on this subject is one the product may refuse over. */
export function bindsOnPresence(subject: FreeSubject): boolean {
  return FREE_SUBJECT_KIND[subject] === "presence";
}

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
export const PLURAL_SUBJECTS: readonly FreeSubject[] = ["marks", "ink", "statedAccessories"];

export function isPluralSubject(subject: FreeSubject): boolean {
  return PLURAL_SUBJECTS.includes(subject);
}

/**
 * Subjects whose things sit ON her and can therefore LEAVE (law 8).
 *
 * A departure is only the right shape where absence is a state a person can
 * actually be in. Glasses come off, a tattoo is removed, freckles clear, a beard
 * is shaved — for each of those "she is not wearing it" is a picture anyone can
 * imagine, and it is what the user means.
 *
 * **The fringe is why this list is short.** "Remove her fringe" is not a face
 * with a fringe-shaped hole in it; it is a HAIRCUT, and the founder's own ruling
 * is that a fringe is part of a cut rather than strands painted on a forehead.
 * A departed clause there — "no her fringe, it has been taken off" — is the
 * maths-class answer to a stylist's ask, and it would render as exactly the
 * absurdity it describes. Same for a nose, a jaw, an expression: those change,
 * they do not depart.
 *
 * So everything outside this list keeps the older road — the removal is re-read
 * as an ordinary edit, and the stylist's own answer ("a cut with no fringe") is
 * what reaches the painter. This is a deliberate boundary, not an oversight, and
 * it grows only with a named case.
 */
export const DEPARTABLE_SUBJECTS: readonly FreeSubject[] = [
  "statedAccessories", "ink", "marks", "facialHair",
];

export function isDepartableSubject(subject: FreeSubject): boolean {
  return DEPARTABLE_SUBJECTS.includes(subject);
}

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
