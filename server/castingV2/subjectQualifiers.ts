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
import { tableOf } from "./subjectCards";

/**
 * The floor. Two promises: it belongs to THIS person, and not appearing at all
 * is a failure rather than a style choice.
 *
 * **It enforces EXISTENCE, never PROMINENCE, and the difference is the whole
 * point** (founder ruling, 2026-08-07). This constant shipped saying "plainly
 * visible at a normal viewing distance", which is an amplitude instruction: a
 * user asking for *light* freckles would have had the qualifier arguing against
 * her own adjective, and the render inflated past what she asked for. Her words
 * are the spec — the floor may insist the thing is THERE and may not decide how
 * much of it there is.
 *
 * Kept as one constant so a class can never be armed with weaker teeth than its
 * neighbour — the difference between classes should be description, never how
 * seriously the ask is taken.
 */
export const TEETH =
  ", rendered on this person's own face and present exactly as asked — at the "
  + "strength their own words describe, neither weaker nor stronger — and a change "
  + "that does not appear at all is a failed render";

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
export const SUBJECT_QUALIFIER: Record<FreeSubject, SubjectQualifier> =
  tableOf((card) => card.qualifier);

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
