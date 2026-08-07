/**
 * WHAT EVERY EDIT CLAUSE PROMISES — one floor, derived, impossible to omit.
 *
 * # The defect this replaces
 *
 * `qualifierFor` was a chain of `if (subject === …)` returning a qualifier for
 * **three** subjects out of twenty-three and `""` for the rest. So `MARKS: a
 * beauty mark, freckles.` was the entire instruction the model received for a
 * freckle edit, while an accessory edit arrived carrying *"plainly visible…
 * an accessory that fails to appear is a failed candidate"*.
 *
 * Measured on the founder's own walk: `statedAccessories`, the armed class,
 * delivered **100%**. `marks`, a bare one, delivered **33%** — and the two
 * misses were not the compositor throwing freckles away (the layer check
 * exonerated it) but the painter putting so few there that the verification
 * reader called them absent. One master, one compositor, two sets of words:
 * the bare clause moved 17.6% of her face skin at freckle amplitude, the
 * qualified one **26.1%**, and the pictures agree — the bare clause sits right
 * at the reader's detection threshold and the qualifier clears it.
 *
 * # Why this is a table and not nineteen new `if`s
 *
 * Hand-written coverage is exactly how three-of-twenty-three happened: each
 * qualifier was written the day a class burned someone, and nobody ever swept
 * the rest. Nineteen artisanal patches would fix the instance and leave the
 * class — the twentieth subject would ship bare and silent, the same way these
 * did.
 *
 * So the map is a `Record<FreeSubject, …>` over the subject vocabulary itself,
 * the way `zoneScope` derives from `allFacets()`. **A new subject without an
 * entry does not compile**, and `subjectQualifiers.test.ts` closes the other
 * direction — an entry for a subject that no longer exists fails too.
 *
 * # The floor, and what sits on top of it
 *
 * Every subject carries `TEETH`: this person's own face, plainly visible, and a
 * change that fails to appear is a failed render. That is the part that cannot
 * be absent. The `describe` line on top is per-class wording, tuned freely —
 * the floor is what stops a class being silently unarmed while it is tuned.
 *
 * An `exempt` entry must say WHY. A shortcut that is declared is engineering; a
 * shortcut that falls through a default is the thing this module exists to end.
 */
import { FREE_SUBJECT_KEYS, type FreeSubject } from "./refineSubjects";

/**
 * The floor. Two promises, both of which the accessory clause already made and
 * the other twenty-two did not: it belongs to THIS person, and failing to
 * appear is a failure rather than a style choice.
 *
 * Kept as one constant so a class can never be armed with weaker teeth than
 * its neighbour — the difference between classes should be description, never
 * how seriously the ask is taken.
 */
export const TEETH =
  ", rendered on this person's own face and plainly visible at a normal viewing "
  + "distance — a change that fails to appear is a failed render";

export type SubjectQualifier =
  /** Wording specific to the class, which the floor is appended to. */
  | { readonly describe: string }
  /** Deliberately unqualified, with the reason stated at the entry. */
  | { readonly exempt: string };

/**
 * Every subject, and what its clause promises.
 *
 * `describe` is additive prose in the clause's own voice. It must not restate
 * the floor: two sentences of teeth read as nagging and dilute both.
 */
export const SUBJECT_QUALIFIER: Record<FreeSubject, SubjectQualifier> = {
  hairCut: { describe: ", cut and dressed as a real haircut on this person's own hair density and hairline" },
  hairShade: {
    describe: ", rendered as natural hair — dimensional rather than flat, with a "
      + "slightly deeper root shadow and the tone reading as grown rather than dyed",
  },
  hairPattern: { describe: ", as the hair's own growth pattern through its whole length, not a styling of the ends" },
  hairFinish: { describe: ", as the way this hair takes light, not a change of colour or cut" },
  hairWorn: { describe: ", as the same hair restyled, not cut and not a different head of hair" },
  eyeColourFree: { describe: ", as the iris's own colour with its natural variation, never a flat contact lens" },
  eyeShapeFree: {
    describe: ", as the eye's own structure — the lid, the corners and the lash line — "
      + "and never drawn on with makeup or liner",
  },
  brows: { describe: ", as brow hair growing from this person's own brow bone, not pencilled on" },
  lashes: { describe: ", as lashes on this person's own lash line" },
  nose: { describe: ", as the nose's own structure, with the rest of the face unchanged" },
  lips: { describe: ", as the lips' own shape and surface, distinct from any lip colour" },
  teeth: { describe: ", visible in the mouth as it is already held, without changing the expression" },
  cheekbones: { describe: ", as the face's own bone structure under its own skin" },
  jaw: { describe: ", as the jaw's own contour, with the neck and chin left alone" },
  chin: { describe: ", as the chin's own contour, with the jaw left alone" },
  ears: { describe: ", on both sides and matching one another" },
  skinTone: { describe: ", across all of this person's visible skin, evenly and consistently" },
  skinCharacter: { describe: ", as the skin's own surface — texture that follows the form of the face rather than sitting flat on it" },
  marks: {
    describe: ", as real marks on this person's own skin, following the form of the "
      + "face rather than painted flat, and dense enough to read as theirs",
  },
  statedAccessories: {
    /* The licence, carried (D-160). The cohort constant gives stated accessories
       failure-to-appear teeth on the ROLL; the floor now says it here. What is
       left is the part unique to accessories: nothing ELSE arrives with it. */
    describe: ", worn by this person and rendered accurately as described and as "
      + "their own. Nothing else is added: no other jewellery, no headwear, no props",
  },
  ink: {
    exempt: "each item carries its own placement clause (D-171), built per item in "
      + "composeEditPrompt — a shared qualifier would address the first design's "
      + "placement to all of them",
  },
  facialHair: { describe: ", growing as this person's own hair, with the hairline and skin beneath unchanged" },
  expression: { describe: ", as this person's own face doing it, with their features unchanged" },
};

/**
 * The clause's qualifier — floor included, or empty for a declared exemption.
 *
 * Callers append this to the items they have already listed, exactly as before;
 * the change is what comes back for the nineteen subjects that used to get
 * nothing.
 */
export function qualifierFor(subject: FreeSubject): string {
  const entry = SUBJECT_QUALIFIER[subject];
  if ("exempt" in entry) return "";
  return `${entry.describe}${TEETH}`;
}

/** Subjects that deliberately carry no qualifier, with their stated reasons. */
export function exemptSubjects(): Array<{ subject: FreeSubject; because: string }> {
  return FREE_SUBJECT_KEYS.flatMap((subject) => {
    const entry = SUBJECT_QUALIFIER[subject];
    return "exempt" in entry ? [{ subject, because: entry.exempt }] : [];
  });
}
