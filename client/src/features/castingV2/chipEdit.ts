import { sameBrief } from "./briefDraft";

/**
 * THE "edited below, not cast yet" MARK — all that is left of #534's chip
 * edit, and the reason the rest of it is not.
 *
 * The founder, Crew reply #134, 2026-09-05, verbatim and entire:
 *
 *   > The record half is right, keep it. Drop "Changed on this roll"; I made
 *   > the change, I don't need it repeated. What's missing is the half that
 *   > matters: a chip edit writes straight into the prompt box, the box is the
 *   > next brief, and the only note about a difference is the small "edited
 *   > below, not cast yet" mark when the box no longer matches the sheet above
 *   > it. Chips and box can never disagree, and the guard must prove that
 *   > before it merges. Card stays open until I've seen it.
 *
 * ⚠ **AND THE DAY AFTER HE WROTE THAT HE REMOVED THE CHIPS — #535, 2026-09-06,
 * verbatim: *"make the top sentence read-only with no pickers at all, and make
 * the prompt box the only place I edit"*.** With no picker on the reading
 * sentence there is no chip to click, so `chipEditOutcome` — the function that
 * turned a click into new box text — has had no way to run since that ruling
 * shipped. The same ruling took `rollAdjustments` and `pendingAdjustments` with
 * it: both existed to decide what a QUEUED adjustment sends and shows, and
 * nothing can queue one.
 *
 * ⚠ **THEY WERE DELETED IN #1444 (slice 3 of the old-lane retirement), AND THE
 * DISTINCTION MATTERS: the flag's removal EXPOSED them, it did not kill them.**
 * Each one branched on `authorRoad`, fed from `config.authorRoadEnabled`, and
 * `CASTING_V2_SCOPE` has stood at `all` since the V2 rollout — so every
 * production call took the author-road arm, which is the arm that returns
 * "nothing to send" and "nothing pending". Removing the flag left three
 * functions whose whole body was a constant and whose only caller was a
 * control nobody can reach. Read them in git at this file's parent commit.
 *
 * **What his condition became, and it is stronger than the guard he asked
 * for.** §19 the same day: *"A chip is a view of the box, never a store. If a
 * chip and the box can disagree, the design is wrong; this is the guard's
 * arm."* There is now exactly one channel to the engine — `briefText`, the box
 * — so chips and box cannot disagree because there are no chips and the box is
 * all there is. `readOnlyEcho.test.ts` holds that structurally: the reading
 * sentence carries no picker, no button and no write channel at all.
 *
 * ⚠ **WHAT IS NOT REMOVED HERE**: the sheet store's `overrides`/`unlocked`
 * slice and `createRoll`'s matching inputs. The page stops reading them in this
 * slice; a store slice and a wire input are each their own deploy-skew act.
 */

/**
 * Whether the box has been edited away from the brief this sheet was cast
 * from — the one difference his ruling allows the sheet to mention, and the
 * condition under which it says so.
 *
 * It CALLS the draft's own `sameBrief` rather than restating it. Two notions of
 * "the same sentence" is exactly how a mark and a box come to disagree about
 * whether anything happened — and the first draft of this function wrote its
 * own `.trim()` comparison, which already differed: `sameBrief` collapses
 * internal whitespace, so re-typing the brief with a double space would have
 * left the mark up over an unchanged sentence.
 */
export function boxDiffersFromSheet(box: string, sheetBrief: string): boolean {
  return !sameBrief(box, sheetBrief);
}

/** The mark itself, in his words. One string, one owner, so it cannot be reworded twice. */
export const BOX_EDITED_MARK = "edited below, not cast yet";
