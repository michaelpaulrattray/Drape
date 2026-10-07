/**
 * ASK FOR ALL HER VIEWS AGAIN — the words on the one button (#1903 slice 2).
 *
 * **His ruling, verbatim (2026-10-07):** *"maybe we should allow retry by
 * default incase they didnt like the outfit that was invented or whatever but
 * it costs per retry and regens all views not just one"*.
 *
 * **Why a module and not two literals in the component**, which is
 * `viewRetryRow.ts`'s reason and `retryFace.ts`'s before it: a rule tested
 * through a substring search of the component is a test that agrees with
 * whoever wrote it. These can be held against his own sentence, and the price
 * can be held against the server's number.
 *
 * # The disappearing-technology gate (law 5, clause 7), answered here
 *
 * 1. **What must the customer learn to use this?** Nothing. A button that says
 *    what it does and what it costs, under the pictures it would replace.
 * 2. **What decision does it put in front of them, and on what basis?** *Do I
 *    like these?* — judged on the pictures themselves, which is their own taste
 *    and the only basis it needs. No eligibility, no verdict, no axis.
 * 3. **Where does the technology show?** Nowhere. Not the engine, not the
 *    plate, not the word *package*, not *redo* — the customer's noun is the one
 *    the strip already uses, which is **views**.
 */

/**
 * The press, and the PRICE RIDES ON IT — his standing rule, prices on paid
 * buttons.
 *
 * ⚠ **THIS IS NOT IN TENSION WITH HIS 2026-09-26 RULING THAT TOOK THE NUMBER
 * OFF THE TRY AGAIN ROW** (*"No credit count in the row"*). That row is a muted
 * caption under one picture, and it had become louder than the broken tile
 * beside it. This is a deliberate purchase of a whole new set of views. A
 * caption and a button are not the same object, and the earlier rule — prices
 * on paid buttons — is the one that governs a button.
 */
export const PACKAGE_REDO_LINK = "Ask for all views again";

/** The separator between the words and the price. Aria-hidden in the row. */
export const PACKAGE_REDO_SEPARATOR = "·";

/**
 * The whole label, as one string.
 *
 * `credits` is spelled out rather than abbreviated to `CR` — #1908's rule, and
 * the same reasoning: an abbreviation is the product's shorthand, not the
 * customer's word.
 *
 * It takes the DISPLAY figure already formatted, never a ledger number and
 * never a raw integer: `shared/creditDisplay.ts` is the only thing in this
 * product allowed to turn one into the other (#1600), and a component that did
 * its own division is how a button comes to quote a price the till does not
 * charge.
 */
export function packageRedoLabel(formattedDisplayCredits: string): string {
  return `${PACKAGE_REDO_LINK} ${PACKAGE_REDO_SEPARATOR} ${formattedDisplayCredits} credits`;
}

/**
 * What the room says while the new set is being made.
 *
 * Present tense and about HER pictures, never about the machine: the five tiles
 * beside it are already drawing their own working state, so this only has to
 * say that the thing she pressed is happening.
 */
export const PACKAGE_REDO_WORKING = "Making a new set of views…";
