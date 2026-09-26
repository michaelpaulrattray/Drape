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
 *      followed. It is about this sheet, and it is news exactly once. ⚠ Only
 *      on the HOUSE road — the author road wears what she named (#1262).
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
  /**
   * DID THIS ROLL COMPOSE ON THE AUTHOR ROAD — `RollProjection.authorRoad`.
   *
   * It decides whether the stated-outfit rung may speak at all: on the author
   * road the brief reaches the engine verbatim, so a stated outfit is WORN by
   * the eight, and the studio-tee sentence would contradict the picture above
   * it. See the rung's own paragraph on `sheetNotice`.
   */
  authorRoad: boolean;
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

/**
 * The line, and it says what happens rather than apologising for it.
 *
 * "Keep" not "ignore": the tee is a deliberate property of a casting sheet, and
 * naming where clothes DO belong turns a refusal into a direction.
 *
 * This sentence was declared twice — here and in `server/castingV2/statedWardrobe.ts`
 * — byte-identical, with only this copy ever read. The server's went in the
 * cleanup milestone and its reasoning came here, where the sentence is.
 */
export const STATED_WARDROBE_NOTICE =
  "Casting sheets keep the studio tee — outfits come after Sign, in takes.";

/**
 * The line, or nothing at all. Never two.
 *
 * ⚠ **THE STATED-WARDROBE RUNG IS ONE CELL AGAIN — THE PATHS ARE RETIRED**
 * (#203 slice 2 step c).
 *
 * It was three, and the two that are gone were the path's: a Basics sentence in
 * the path's own words, and SILENCE on Wardrobe because her outfit was what she
 * was looking at. Both were reached through `RollProjection.wardrobe?.path`,
 * which has answered `null` for every roll a customer can open since slice 1
 * wrote the column a constant `null` — so **neither cell has ever been shown to
 * anybody**, and the retired sentence named a product nobody can buy.
 *
 * ⚠ **WHAT SURVIVES IS THE LIVE ONE, AND IT IS THE `null` BRANCH RATHER THAN A
 * PATH BRANCH.** That inversion is the whole trap of this step: a sweep that
 * deleted "the path branches" by their names would have taken the sentence
 * every stated-outfit sheet in production actually shows, and left a dead one
 * standing. The rung is now simply *she stated clothes → say where clothes
 * belong*, which is what it has always done in practice.
 *
 * ⚠ **AND THE KNOWN SILENT CELL SURVIVES TOO, STATED RATHER THAN QUIETLY
 * CLOSED.** A stated outfit can be rejected and `bornWardrobeLine` fall back to
 * the house line; that sheet says this same sentence, which is true, rather
 * than news that her sword was dropped. It is left that way for the reason it
 * always was: the cell has no measured population, and a sentence invented for
 * a case nobody has met is a claim the copy audit cannot classify.
 *
 * ⚠ **AND THE STATED-OUTFIT RUNG IS SILENT ON THE AUTHOR ROAD — #1262,
 * 2026-09-26. THE SENTENCE WAS TRUE OF A ROAD NOBODY IS ON ANY MORE.**
 *
 * It was written as a companion to the HOUSE road, where the eight really were
 * composed into the studio tee whatever the brief said. On the author road the
 * brief reaches the engine verbatim (`briefCompiler.ts` — the stated outfit is
 * deliberately NOT restated into the eight prompts *because it is already in
 * the request*), so the eight come back WEARING what she named, and #1222
 * records that outfit on the roll for Sign and the five views. Every account
 * has been on the author road since the switch sitting of 2026-09-24, so from
 * that day the sentence told every stated-outfit customer the opposite of what
 * her own sheet showed her.
 *
 * **Nothing replaces it, and that is the decision rather than an omission.**
 * The picture already answers the question the sentence was written to answer —
 * the same reasoning his #230 ruling gave for deleting the differ-by clause
 * (*"The sheet already proves whether the faces are different"*). A sentence
 * saying *your outfit was kept* would be narrating what the customer can see.
 *
 * The house branch is KEPT rather than deleted: the sentence is still true
 * there, and a road with no accounts on it is not a reason to lose the only
 * copy of a rule that still governs it (#1204).
 */
export function sheetNotice(input: SheetNoticeInput): string | null {
  if (input.fellBack) return FELL_BACK_NOTICE;
  if (input.statedWardrobe && !input.authorRoad) return STATED_WARDROBE_NOTICE;
  return input.expiryNotice;
}
