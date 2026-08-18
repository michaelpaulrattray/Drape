/**
 * THE MAKEUP SLOTS AND THE TWO CAPS THAT GOVERN THEM — one place, because the
 * second number is DERIVED from the first and a derivation cannot live in two
 * files (law 4: derive, never mirror).
 *
 * This module exists because the two caps were judged in two places and nothing
 * anywhere checked that one could fit inside the other. `refineDelta` owned the
 * sentence cap (80, chosen for a world where makeup meant one typed
 * adjustment); `makeupFromReference` owned the slot cap (40, measured off a
 * frame). Four legal slot answers needed **121 characters of an 80-character
 * budget**, so surfaces three and four were routinely lost — and the founder
 * caught it by looking at a specimen and asking where the blusher went
 * (fable-950 §1: *"for 2) specimen 1 did it get the blusher/highlight and
 * bronzer? everything else is right"*).
 *
 * # WHY ONE NUMBER DERIVES FROM THE OTHER
 *
 * The composer may speak for every surface the reader valued. If the sentence
 * budget is smaller than what the slot contract permits, the composer must drop
 * a surface for ROOM — which is a cap deciding what a customer's copied look
 * contains. So the budget is the contract's own worst case, and dropping
 * retreats to what it should always have been: the emergency path for a reading
 * that broke its own contract, never the routine fate of surfaces three and
 * four (ruled fable-953 §2).
 *
 * # AND WHY THE USER-TYPED GUARD RISES WITH IT
 *
 * There is exactly one door. The composed sentence is SHOWN to the customer,
 * adopted or edited, and rides as HER instruction — so it comes back through
 * `refineDelta`'s parse, which judges `raw.makeup` against the same cap as text
 * she typed herself. There is no provenance on the delta yet, and taking a
 * wider cap from a client-supplied flag would be authority from input.
 *
 * **The parse cap therefore cannot be smaller than what the composer can
 * produce.** The fence that keeps a PERSON out of this slot was never length —
 * it is the named slots, the brand scrub, the hair guard and the containment
 * check. Length only stops an instruction becoming a second brief, and
 * {@link MAX_MAKEUP_LENGTH} characters is still one line.
 */

/**
 * The cosmetic surfaces this reader may ask about, in the order they compose.
 *
 * The order is a makeup artist's, not an alphabet's: the eye is what a look is
 * usually named for, the lip is what changes it most, and complexion is the
 * one a casting note drops first when it runs out of room.
 */
export const MAKEUP_SLOTS = ["eyes", "lips", "brows", "complexion"] as const;
export type MakeupSlot = (typeof MAKEUP_SLOTS)[number];

/** What the composer puts between two surfaces. */
export const MAKEUP_SLOT_SEPARATOR = ", ";

/**
 * The longest a slot answer may be before it has stopped obeying the ask.
 *
 * **Fifty-two, and every step of that number is measured.** It was 32 until the
 * first positive-control specimen convicted it — a black winged smoky eye read
 * as `"smoky shadow, winged liner, lashes"` (34 characters) and the loudest
 * makeup in the frame vanished. It became 40. Four fresh reads of that same
 * frame then convicted 40:
 *
 * ```
 * run   eyes                                             lips brows complexion
 *  1    "smoky black shadow, winged liner, false lashes"  18   20     37   ← 46, REFUSED
 *  2-4  "smoky black shadow, winged liner, lashes"        18   20   30-37  ← exactly 40
 * ```
 *
 * Two facts in one table. The eye wanted 46 and was refused, losing the loudest
 * surface in the picture for six characters. And on the other three reads it
 * answered **exactly 40** — because the ask STATES the cap, so the model
 * composes down to it and pays for the fit by dropping the word *false*.
 *
 * **A cap the ask announces is not a filter, it is a brief**: it shapes the
 * content before anything grades it. That is why the number is set above the
 * measured need rather than at it, and why the eye is the surface that sets it
 * — an eye carries shadow, liner and lashes at once where a lip carries one
 * thing.
 */
export const MAKEUP_SLOT_MAX_LENGTH = 52;

/**
 * One adjustment, not a paragraph — the brief box is where prose belongs.
 *
 * **DERIVED, so a surface can never be dropped for room the slot contract had
 * already promised it**: every slot at its maximum, joined the way the composer
 * joins them. Read the module header for why this is also the cap on what a
 * customer types.
 */
export const MAX_MAKEUP_LENGTH =
  MAKEUP_SLOTS.length * MAKEUP_SLOT_MAX_LENGTH
  + (MAKEUP_SLOTS.length - 1) * MAKEUP_SLOT_SEPARATOR.length;
