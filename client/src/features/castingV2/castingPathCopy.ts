/**
 * WHAT THE TWO PATHS ARE CALLED, AND WHAT EACH ONE PROMISES — the toggle's
 * copy (design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §6, item 5's last
 * slice; founder ruling 2026-08-21, *"this is the way foward 100%"*).
 *
 * # Why the copy is a module rather than two strings in a page
 *
 * The same two sentences are read in two places — the lobby hero, where the
 * path is chosen for a new sheet, and the re-roll box, where it is shown and
 * may be switched (§6's "two surfaces, because there are two places a roll is
 * bought, and a toggle on only one of them is a path a customer can change by
 * accident"). Two copies of a promise about what a path DOES is working law 4
 * with a founder condition attached: *"as long as we make it clear before they
 * go to cast someone"*.
 *
 * The vocabulary itself is NOT re-spelled here — {@link CASTING_PATHS} in
 * `shared/castingPaths.ts` is the closed list, and this module is keyed by it,
 * so a third path would be a type error rather than a silently unlabelled pill.
 *
 * # ⚠ NEITHER LINE MAY SAY "ANYWHERE"
 *
 * §5.1, and it cost a court to learn: the roll frame is WAIST-UP, so "tattoos
 * anywhere" is a promise the picture cannot keep. What Basics actually opens is
 * the UPPER CHEST — a chest piece works on a scooped Basics top and does not on
 * the house crew tee — and the line below says exactly that and no more.
 *
 * The Basics line is the CORRECTED one, and it is corrected because the frame
 * is waist-up rather than because the shorter sentence read better.
 */
import { CASTING_PATHS, type CastingPath } from "@shared/castingPaths";

/**
 * How each path is named where a person reads it.
 *
 * Title case rather than the code's lowercase: these are the words on a
 * control, and `basics` is a column value.
 */
export const CASTING_PATH_NAMES: Readonly<Record<CastingPath, string>> = {
  wardrobe: "Wardrobe",
  basics: "Basics",
};

/**
 * THE ONE HONEST LINE EACH — §6's copy block, verbatim.
 *
 * Both name a capability and a bound in the same breath, which is the whole
 * point of telling the tradeoff before the roll rather than after it:
 *
 *   - Wardrobe's bound is where ink can land (*where the outfit shows skin*),
 *     which is the fact `gate_ink_uncarried` enforces one road over;
 *   - Basics' unlock is the chest piece, and it is stated as the chest rather
 *     than as the body, per §5.1.
 *
 * No marketing, no adjectives about quality, and nothing either path cannot do
 * today.
 */
export const CASTING_PATH_LINES: Readonly<Record<CastingPath, string>> = {
  wardrobe: "Born and signed dressed. Tattoos land where the outfit shows skin.",
  basics:
    "Born and signed in plain black basics. A clean body record — a chest piece "
    + "works here, and try-on starts from a clean base.",
};

/** The two paths in the order the control draws them: the default first. */
export const CASTING_PATH_ORDER: readonly CastingPath[] = CASTING_PATHS;

/**
 * WHAT THE NEXT ROLL WILL DO, when it will not do what this sheet did.
 *
 * The re-roll box preselects the sheet's own path, so the control resting on
 * `Basics` for a Basics sheet is a statement of fact and needs no sentence.
 * The moment the selection leaves the sheet's path it stops being a label and
 * becomes a plan — and a paid re-roll that quietly changes what all eight are
 * wearing is the kind of surprise the FOLLOWING chip's own note exists to
 * prevent (*"Roll again keeps this family"*).
 *
 * ⚠ **ON AN UNPATHED SHEET IT ALWAYS SPEAKS, AND THAT IS THE WHOLE OF THE
 * PLAN/RECORD DISTINCTION** (ruled fable-1483 ASK 1(b)).
 *
 * A sheet cast before the paths existed has no path for the pills to be a
 * LABEL of — so left silent they would read as a claim that these eight were
 * cast on one, which is the *absence becomes a member* error
 * `shared/castingPaths.ts` argues against at length. The distinction that
 * settles it: **that argument protects the ROLL'S RECORD, and this control is
 * a statement about the NEXT roll.** So the record line stays absent on such a
 * sheet and this note is never silent on one.
 *
 * The case is not hypothetical and it is day one: **every existing customer's
 * sheets are unpathed on the day the flag opens**, and without this the lobby
 * would be their only door to a path.
 *
 * `null` only when the sheet HAS a path and the control is resting on it.
 */
export function pathSwitchNote(input: {
  /** `null` — this sheet predates the paths. Not a third path; no path at all. */
  sheetPath: CastingPath | null;
  selected: CastingPath;
}): string | null {
  const plan = `Roll again casts on ${CASTING_PATH_NAMES[input.selected]}.`;
  /* Named first, because on this sheet the pills describe NOTHING and the
     sentence is the only thing that says so. */
  if (input.sheetPath === null) return `Nothing was chosen for these eight — ${plan}`;
  if (input.sheetPath === input.selected) return null;
  return plan;
}

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
