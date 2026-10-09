/**
 * REGENERATE — the words on the one button (#1903 slice 2; renamed #2090).
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
 *    plate, not the word *package*, not *redo*. **Regenerate** is his own word
 *    for it (#2090, below) and is already the customer's verb one panel over:
 *    the refine panel's version button says *Regenerate* and has since before
 *    this row existed.
 */
import { displayPrice, formatCredits } from "@shared/creditDisplay";

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
 *
 * ⚠ **THE WORDS WERE "Ask for all views again" UNTIL #2090.** His word,
 * 2026-10-08 (terminal), verbatim: *"also the wording "Ask for all views
 * again · 650 credits" is way too long just call it Regenerate ~ 350
 * credits"*, then, asked to confirm the price: *"Call it Regnerated ~ 650
 * credits yes"*. The price is unchanged and stays derived below; his "~" is
 * read as this row's separator, the same " · " every other paid button wears.
 */
export const PACKAGE_REDO_LINK = "Regenerate";

/** The separator between the words and the price. Aria-hidden in the row. */
export const PACKAGE_REDO_SEPARATOR = "·";

/**
 * The whole label, as one string, from the LEDGER price on the wire.
 *
 * `credits` is spelled out rather than abbreviated to `CR` — #1908's rule, and
 * the same reasoning: an abbreviation is the product's shorthand, not the
 * customer's word.
 *
 * ⚠ **IT TAKES THE LEDGER NUMBER AND CONVERTS HERE, AND THE FIRST DRAFT TOOK
 * AN ALREADY-FORMATTED STRING.** Both satisfy #1600's rule that
 * `shared/creditDisplay.ts` is the only thing allowed to turn one into the
 * other — but a `formattedDisplayCredits: string` parameter puts the
 * conversion in the component and leaves this function holding a number it
 * cannot vouch for, and **`creditDisplayGuard.test.ts` said so the first time
 * it ran**: its census reader sees a credit figure beside the word *credits*
 * and cannot tell, from here, that anything routed it. Taking the ledger value
 * makes the routing visible at the only place it happens.
 *
 * `displayPrice` and not `displayBalance`: a price rounds UP, so a customer is
 * never quoted less than the till will take.
 */
export function packageRedoLabel(priceCredits: number): string {
  /* INLINE, not via a local named `credits`: `creditDisplayGuard.test.ts`
     reads the expression that sits beside the word, and a variable—however
     honestly assigned one line above—is a figure it cannot see routed. The
     reader is right to refuse it; a census that trusted a good name would not
     be a census. */
  return `${PACKAGE_REDO_LINK} ${PACKAGE_REDO_SEPARATOR} ${formatCredits(displayPrice(priceCredits))} credits`;
}

/**
 * What the room says while the new set is being made.
 *
 * Present tense and about HER pictures, never about the machine: the five tiles
 * beside it are already drawing their own working state, so this only has to
 * say that the thing she pressed is happening.
 */
export const PACKAGE_REDO_WORKING = "Making a new set of views…";
