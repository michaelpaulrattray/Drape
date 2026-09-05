import { rewriteBrief, type BriefFactOverrides } from "@shared/briefRewrite";

import { sameBrief } from "./briefDraft";
import type { LockOverrides, OverridableField, UnlockableField } from "./sheetState";

/**
 * WHAT A CHIP EDIT DOES, AND WHAT RIDES THE ROLL (#534).
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
 * And his design decisions the same day, §19: *"A chip is a view of the box,
 * never a store. If a chip and the box can disagree, the design is wrong; this
 * is the guard's arm."*
 *
 * ## Why this is a module and not four lines inside the page
 *
 * His condition is a claim about the WIRE — that nothing can reach the engine
 * carrying a fact the box disagrees with. Enforcement invariant 5 says a
 * contract about what gets sent is proven on the outgoing request, not on a
 * constant near it. Both halves of the rule therefore live in one place a test
 * can drive directly, rather than inline in a 3,400-line page where the only
 * available guard would be a grep.
 *
 * ## The two halves
 *
 * **`chipEditOutcome` — what a chip click produces.** On the AUTHOR ROAD it
 * produces new BOX TEXT: the same `rewriteBrief` the compiler used to run at
 * dispatch, run at the click instead, so the customer watches their own words
 * change. Off that road it produces an OVERRIDE exactly as before, because the
 * house road composes per-candidate prose from the intent (`applyOverrides`)
 * and never read the brief's text for these facts at all — rewriting a house
 * sheet's box would change what the customer reads and nothing the engine
 * receives, which is the disagreement in the mirror.
 *
 * **`rollAdjustments` — what rides the roll.** On the author road: nothing.
 * The box IS the brief, and `briefText` already carries every chip edit, so an
 * `overrides` field beside it could only ever restate or contradict it. That
 * absence is the structural half of his condition — not a promise that the two
 * agree, but a wire with only one channel on it, so disagreement has nowhere to
 * live. The follow branch has sent nothing since #177 Row A for a different
 * reason (facts change at the roll, never at the follow); this makes the plain
 * roll agree with it, and both now ask ONE function rather than each carrying
 * its own copy of the rule (working law 4).
 *
 * ⚠ **A chip whose fact the rewriter cannot place in the sentence still lands**
 * — `rewriteBrief` appends a plain sentence rather than dropping it (its own
 * two declared limits). What it never does is return `null` while the caller
 * believes an edit happened: `null` means there was nothing to write, and the
 * box is left exactly as it was.
 */

/** A chip click, resolved to the one thing it changes. */
export type ChipEditOutcome =
  /** Author road: the box text the click produces. Never null — see `chipEditOutcome`. */
  | { kind: "box"; text: string }
  /** House road: the pre-dispatch store, as before this card. */
  | { kind: "override"; field: OverridableField; value: string }
  /** The rewriter had nothing to write. The box is untouched and nothing is stored. */
  | { kind: "none" };

export function chipEditOutcome(args: {
  authorRoad: boolean;
  /** What the box says right now — the draft if there is one, else the sheet's brief. */
  brief: string;
  field: OverridableField;
  value: string;
}): ChipEditOutcome {
  const { authorRoad, brief, field, value } = args;
  if (!authorRoad) return { kind: "override", field, value };
  const rewritten = rewriteBrief(brief, { [field]: value } as BriefFactOverrides);
  return rewritten ? { kind: "box", text: rewritten.text } : { kind: "none" };
}

/**
 * The adjustment fields a roll sends — empty on the author road, where the
 * brief text is the only channel.
 */
export function rollAdjustments(args: {
  authorRoad: boolean;
  unlocked: readonly UnlockableField[];
  overrides: LockOverrides;
}): { unlock?: UnlockableField[]; overrides?: LockOverrides } {
  const { authorRoad, unlocked, overrides } = args;
  if (authorRoad) return {};
  return {
    unlock: unlocked.length > 0 ? [...unlocked] : undefined,
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  };
}

/**
 * WHAT THE ECHO MAY DRAW AS QUEUED — derived from `rollAdjustments`, never
 * from the store directly.
 *
 * ⚠ **Finding 1 of the review of PR #567, and it is the fix's own class coming
 * back through the display.** The wire half was made empty on the author road
 * and the echo went on reading the STORE, which can legitimately be non-empty
 * there: a chip queued on the house road, then the flag widened while the tab
 * is open (the config query refetches on focus), or a slice left over from
 * before this shipped. In exactly those states the echo drew *"30s → 40s ·
 * next roll"* over a roll that sends nothing — a chip promising a change the
 * wire will never carry, which is the disagreement reply #134 bans, wearing
 * the other half's clothes.
 *
 * So the arrow shows precisely what the roll will carry and cannot show more.
 * Deriving it from the wire function rather than adding a second `authorRoad`
 * check is the point: two places deciding the same thing is how these two
 * halves came apart in the first place (working law 4).
 */
export function pendingAdjustments(args: {
  authorRoad: boolean;
  unlocked: readonly UnlockableField[];
  overrides: LockOverrides;
}): { overrides: LockOverrides; unlocked: readonly UnlockableField[] } {
  const sent = rollAdjustments(args);
  return { overrides: sent.overrides ?? {}, unlocked: sent.unlock ?? [] };
}

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
