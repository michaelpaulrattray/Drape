/**
 * The sheet's one quiet line, and which of them gets to be it.
 *
 * Three things can want to say something above a sheet: the interpretation fell
 * back, the brief stated clothes the sheet does not render, and the sheet is
 * about to expire. Left independent they stack — three grey sentences over the
 * grid, which is how a quiet confession becomes a wall of small print nobody
 * reads, including the one that mattered.
 *
 * So there is ONE slot, and a precedence, mirroring the dock's own chain
 * (`cancelLine > parentGone > awaitingNewRoll > followLabel`). The order is by
 * how much the line changes what the user is looking at:
 *
 *   1. **It fell back.** This sheet is not the sheet they asked for — their
 *      stated facts were lost before a single face was cast, and they paid for
 *      it. Nothing else on the page competes with that.
 *   2. **The wardrobe was kept.** One stated instruction was deliberately not
 *      followed. It is about this sheet, and it is news exactly once.
 *   3. **It expires soon.** True, worth saying, and about the sheet's future
 *      rather than its content — so it yields to anything about the faces.
 *
 * Losing a lower line to a higher one is acceptable by construction: expiry is
 * repeated on the lobby card, and the wardrobe rule is permanent and will be
 * said again on the next roll. Neither is a one-shot.
 */

/** What the sheet needs to know to decide. Every field is server truth. */
export type SheetNoticeInput = {
  /** The viewed roll compiled from the raw sentence — nothing was pinned. */
  fellBack: boolean;
  /** The viewed roll's brief stated clothing. */
  statedWardrobe: boolean;
  /** The retention line, already composed — see `retentionCopy.ts`. */
  expiryNotice: string | null;
};

/**
 * The interpretation was unavailable.
 *
 * Says what happened and what it cost, and stops. It deliberately does NOT say
 * "roll again": that is a paid action, and pushing someone to spend again over
 * our own outage is the product charging for its bad day. Whether a fallback
 * roll should refund is a real question and a founder's to answer — this line
 * does not pre-empt it in either direction.
 */
export const FELL_BACK_NOTICE =
  "The brief reader was unavailable — this roll was cast from your sentence as written, with nothing pinned.";

export const STATED_WARDROBE_NOTICE =
  "Casting sheets keep the studio tee — outfits come after Sign, in takes.";

/** The line, or nothing at all. Never two. */
export function sheetNotice(input: SheetNoticeInput): string | null {
  if (input.fellBack) return FELL_BACK_NOTICE;
  if (input.statedWardrobe) return STATED_WARDROBE_NOTICE;
  return input.expiryNotice;
}
