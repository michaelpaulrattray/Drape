/**
 * What the brief box shows.
 *
 * # The defect this exists to delete
 *
 * The box used to be a seeded string: `useState("")` plus an effect that wrote
 * the roll's sentence into it ONCE per roll, and only `if (brief === "")`. That
 * one-shot seed could latch onto the WRONG roll, and then never let go.
 *
 * Two ways in, both remounts, both ordinary:
 *
 *   1. **Reload or navigate back during the compile window.** A roll's rows
 *      commit only after the interpreter answers, so for several seconds the
 *      session still reports the PREVIOUS roll as active. A remount in that
 *      window seeded roll N−1's sentence into the empty box and spent the
 *      one-shot. Roll N then landed, found the box non-empty, and left it
 *      alone — permanently.
 *   2. **Remount against a warm query cache.** Leave the sheet before the 2.5s
 *      poll notices roll N and come back: the cached `activeRollId` renders
 *      synchronously as N−1, and the same seed-and-burn happens.
 *
 * The founder's report was the visible half: after an edited re-roll the box
 * displayed the previous roll's text while the roll had correctly used the
 * edit. **A paid action whose input you cannot verify on screen.** The invisible
 * half was worse — a follow reads the box, by design, so a stated "chunky
 * glasses" silently never reached the compile and the whole family lost it.
 *
 * The fix is not a better seed. It is DERIVATION, the same move that fixed the
 * banner that would not go away (`dispatchFailure.afterRollId`): the box reads
 * what the sheet reads. There is no second copy of the sentence to fall out of
 * step, so neither entry path above has anything left to latch onto.
 *
 * # The rule
 *
 * A draft is the user's own unspent typing, or nothing at all. With no draft
 * the box simply displays the viewed roll's sentence — so a reload, a history
 * walk and a landing roll are all automatically right, because none of them is
 * a case anybody had to remember to handle.
 *
 * When the viewed roll changes, a draft meets one of three fates:
 *
 *   - **Spent.** It says what the new roll's brief says — the roll caught up to
 *     the edit. Dropping it is invisible (the text is identical) and it stops a
 *     stale draft riding along into a later history walk.
 *   - **Killed.** It is empty. Clearing the box is a real intent and it holds
 *     while you stay on the roll you cleared it on — that is the backspace
 *     defect, and it stays fixed. But an empty draft has no WORDS to protect,
 *     so walking somewhere new restores that roll's sentence rather than
 *     following you around as a blank.
 *   - **Survived.** It has words the roll does not. "Arriving somewhere new
 *     should never overwrite words the user has already typed" is the older
 *     ruling and it still governs: typing during the ~66-82s a roll takes to
 *     land must not be swallowed when it lands.
 *
 * Pure on purpose. The bug lived in page wiring, so the rule lives somewhere a
 * test can drive the exact sequence that produced it.
 */

/** The user's unspent typing, or nothing. `""` is a draft; absence is not. */
export type BriefDraft = string | null;

/**
 * Two sentences the compiler would not tell apart.
 *
 * Mirrors the server's own `normalizeBrief` (`briefCompiler.ts`), so "the same
 * sentence" means the same thing on both sides of the wire. The stored
 * `briefText` is the raw string the client sent — nothing normalizes it on the
 * way in — so this is the only place the two notions could ever drift.
 */
export function sameBrief(left: string, right: string): boolean {
  return left.replace(/\s+/g, " ").trim() === right.replace(/\s+/g, " ").trim();
}

/** A keystroke. Always yields a draft — including the empty one. */
export function typed(text: string): BriefDraft {
  return text;
}

/**
 * The sheet is now looking at a different roll — a new one landed, or the user
 * walked the history rail. One event for both, because the rule is the same.
 */
export function shownRollChanged(draft: BriefDraft, nextBrief: string): BriefDraft {
  if (draft === null) return null;
  if (draft === "") return null;
  if (sameBrief(draft, nextBrief)) return null;
  return draft;
}

/**
 * What the box shows, and what a roll or a follow therefore spends.
 *
 * The single reader. `dispatchRoll` must send THIS rather than a private copy
 * of the sentence — sending anything else is how the follow got poisoned.
 */
export function displayText(draft: BriefDraft, shownBrief: string): string {
  return draft ?? shownBrief;
}
