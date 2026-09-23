/**
 * WHAT A SHEET THAT WAS CAST ON A PATH IS CALLED — what is left of the two
 * paths' copy after the road was RETIRED (#203, founder ruling 2026-08-28,
 * verbatim: *"yeah we will retire the wardrobe/basics path obviously"*).
 *
 * # This module is now a READER of old rows, not a control's vocabulary
 *
 * The toggle that chose a path is gone from both surfaces it stood on, and the
 * two promise lines and the plan/label note went with it — a sentence telling
 * a customer what choosing Basics would do has no customer who can choose it.
 *
 * What survives is the SHEET'S OWN RECORD: the rows written while the road ran
 * still carry a path and a wardrobe line, and the sheet still draws them. That
 * is §6's own rule pointed backwards — *"a fact that decides what a cast can
 * and cannot do later must be visible on the cast"* — and it is the reason the
 * retirement takes the entrance rather than the record.
 *
 * The vocabulary itself is NOT re-spelled here: {@link CastingPath} in
 * `shared/castingPaths.ts` is the closed list and this module is keyed by it.
 */
import { type CastingPath } from "@shared/castingPaths";

/**
 * How each path is named where a person reads it.
 *
 * Title case rather than the code's lowercase: these are the words on a
 * sheet's record line, and `basics` is a column value.
 */
export const CASTING_PATH_NAMES: Readonly<Record<CastingPath, string>> = {
  wardrobe: "Wardrobe",
  basics: "Basics",
};

/**
 * THE SHEET'S OWN RECORD OF WHAT IT IS WEARING — §3.3's row for the sheet, and
 * §6's *"the path is shown after the roll too."*
 *
 * ⚠ **The engine-pick label is a PROMISE, not decoration** (§4.1(1)): an
 * outfit the picker invented is the product's own free value, and *she is never
 * told she asked for it*. The server derives `enginePicked` from three
 * conditions it can see and this composes the label from that answer — the
 * client never decides it, because two of the three terms (the house line, her
 * sentence) are not on this side of the wire.
 *
 * The path name is NOT folded into this string. It is drawn beside it in the
 * chrome register, where a machine fact belongs, so a sentence about clothes
 * never gets set in mono.
 */
export function wardrobeLineText(input: { line: string; enginePicked: boolean }): string {
  return input.enginePicked ? `${input.line} · engine's pick` : input.line;
}
