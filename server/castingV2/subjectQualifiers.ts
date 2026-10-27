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
 *
 * # ⚠ NONE OF THIS REACHES AN ENGINE, AND SINCE #2596 THAT IS A MEASURED
 * DECISION RATHER THAN AN OVERSIGHT
 *
 * Everything above is written as though these clauses are what the painter is
 * sent. **They are not, and they have not been for about two months.**
 * `qualifierFor` has exactly one caller — `composeEditPrompt`
 * (`refineDelta.ts`) — and that composition is RECORDED on the variant row
 * (`refineService.ts`, `landVariant`'s `internalPrompt.prompt`) and dispatched
 * nowhere. What the engine is handed is `assembleRecipe`'s own `prompt`, and
 * neither `repaintAsks.ts` nor `recipeAssembler.ts` mentions this table.
 *
 * **Path three, and the commit is readable**: `2f4d02e8f` (#1577 slice 4b)
 * removed the two dispatch sites that sent the composed string. It went dark
 * earlier than that, though — those sites sat below `if (repaintEnabled)
 * return repaintOnce()` and `CASTING_REPAINT_SCOPE` stood at `all` on
 * production well before, so slice 4b deleted a road already serving nobody.
 *
 * ## It was courted on the road that renders, and the floor buys nothing
 *
 * Measured twice, both through the real `repaintAsksFor` -> `assembleRecipe`,
 * both on the repaint engine, each arm differing by exactly `qualifierFor`:
 *
 * ```
 * wardrobe  11 cells x 2 arms, 3 masters   no cell changed verdict, ratios
 *           (#2544 slice 0, $0.57)         moved within noise
 * marks     3 masters x 3 takes x 2 arms   gap 0.017 against a within-arm
 *           (#2596, 21 renders, ~$0.32-   spread of 0.158 — NO EFFECT
 *           $0.63 at the band below)
 * ```
 *
 * **`marks` is the case that matters, because `marks` is what bought this
 * table** — the 33%-against-100% in the defect note above. On the repaint road
 * the bare clause delivered freckles in **18 of 18 frames across both arms**,
 * read at the frames and not off a ratio (law 9). The eye-colour control added
 * no freckles on any master and read 0.89-0.91 against the marks arms'
 * 0.93-1.03, so the statistic was not blind to the difference — there was no
 * difference to see. **The 33% was a PASTE-ROAD number**: that road rendered,
 * harvested a region and pasted it back, and a painter putting too few freckles
 * there lost them in the harvest. A repaint restates the whole stack against
 * the master and does not.
 *
 * ## So why is the table still here
 *
 * Because `composeEditPrompt`'s output still has two live readers and they are
 * not renders: the pre-claim completeness check and the filed-row contradiction
 * check. Both read the composition ON PURPOSE. Deleting the table to tidy up a
 * clause nothing dispatches would change what those two verify and what the
 * variant row records, which is a second decision and nobody has asked for it.
 *
 * **What this note forbids is the quiet version of that decision**: tuning a
 * `describe` line in the belief that a painter will read it. None will. If the
 * floor is ever wanted on the road that renders, it belongs in `repaintAsks.ts`
 * derived from THIS table and never copied beside it (working law 4) — and
 * #2596's court is the evidence that it would buy nothing, so it needs a reason
 * of its own first.
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
