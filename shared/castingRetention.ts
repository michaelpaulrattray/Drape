/**
 * HOW LONG AN UNSIGNED SHEET IS KEPT — declared once, for every surface that
 * states it.
 *
 * **His word, 2026-09-27 (terminal), verbatim and entire:**
 *
 * > *"id like to keep casting sheets for 30 days also not 7 days"*
 *
 * It is an IDLE clock, never an age. `expiresAt` is pushed out every time the
 * session is touched, so a sheet somebody comes back to weekly never expires —
 * which is why the copy says *quiet* days and why that word is load-bearing.
 * An expired sheet is still GONE rather than reachable; his earlier ruling on
 * that half is untouched by this one.
 *
 * ⚠ **IT LIVES IN `shared/` BECAUSE THE WINDOW WAS STATED IN FOUR PLACES AND
 * HIS RULING MOVED ONE OF THEM.** #1464 said no customer copy named the window;
 * read at the code the day it was built, three surfaces did — the empty state
 * (`client/src/features/castingV2/retentionCopy.ts:114`), the lobby's
 * unsigned-sheets aside (`client/src/pages/CastingV2.tsx:1047`), and the
 * design law that asserts the aside is there at all
 * (`scripts/lib/designLaws.mts:712`, a literal `/7 quiet days/i`) — each
 * carrying its own `7`. Moving the server constant alone would have left the
 * product enforcing thirty days while telling the customer seven, and reddened
 * the one instrument that reads the sentence. Working law 4: derive, never
 * mirror. Every one of those four now reads this file.
 *
 * NOT this constant: `CASTING_DISCARD_RETENTION_MS` (a discarded candidate's
 * own undo window, 24 h) and fal's seven-day object retention are different
 * clocks answering different questions.
 */
export const CASTING_SESSION_IDLE_DAYS = 30;

/** The same window as milliseconds — what the writers stamp onto `expiresAt`. */
export const CASTING_SESSION_IDLE_MS = CASTING_SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;

/**
 * The words the product uses for the window, so the number and the register
 * travel together.
 *
 * *quiet* rather than *idle* or *old*: the customer-facing register is a quiet
 * statement of a rule, and "old" would describe a clock this product does not
 * run. Every customer sentence about retention is built from this.
 */
export const CASTING_SESSION_IDLE_PHRASE = `${CASTING_SESSION_IDLE_DAYS} quiet days`;
