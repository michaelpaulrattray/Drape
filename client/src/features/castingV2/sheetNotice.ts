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
  /**
   * WHICH PATH THIS ROLL WAS CAST ON — the two paths (design §6/§3.3).
   *
   * `null` is *cast before the paths existed, or outside the flag*, and it is
   * every roll in production today. The server sends the FACT — this comes
   * straight off `RollProjection.wardrobe?.path`, which is non-null only when
   * the roll really carries a path — and the sentences stay here.
   */
  wardrobePath: "wardrobe" | "basics" | null;
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
 * THE SAME NEWS ON THE BASICS PATH, WHERE IT IS TRUE FOR A DIFFERENT REASON
 * (the two paths, design §5).
 *
 * A Basics cast is *born and signed in plain black basics*, and the spec is not
 * negotiable by a brief: `bornWardrobeLine` ignores a named outfit on that
 * path, because *"a brief that also names a red apron has asked for the other
 * path"*. So her instruction really was set aside — but not for the studio tee
 * and not until Sign, which is what the sentence above says.
 *
 * Two clauses, and the second is the point: this is the one refusal in the
 * product whose remedy is a control the customer can see on the same screen.
 * The re-roll box's own switch is what "roll again on Wardrobe" names, so the
 * line points at a road that ACTS rather than at a road that exists.
 */
export const BASICS_WARDROBE_NOTICE =
  "Basics sheets are cast in plain black basics — roll again on Wardrobe to have the outfit you described.";

/**
 * The line, or nothing at all. Never two.
 *
 * ⚠ **THE STATED-WARDROBE RUNG IS NOW THREE CELLS, AND THE MIDDLE ONE IS
 * SILENCE** (the two paths, design §6/§3.3).
 *
 * ```
 * unpathed   today's product exactly: no outfit is rendered on any sheet, so
 *            "casting sheets keep the studio tee" is simply true
 * basics     true, for the reason above, in the path's own words
 * wardrobe   SUPPRESSED — her outfit WINS on this path (§4(a)), so the notice
 *            would be a confession about something that did not happen. What
 *            she gets instead is the sheet's wardrobe line, which describes
 *            the picture she is looking at (§3.3's own answer for this row)
 * ```
 *
 * ⚠ **AND THE SUPPRESSION HAS ONE KNOWN CELL IT COVERS IN SILENCE, STATED
 * RATHER THAN QUIETLY CLOSED.** A stated outfit can still be REJECTED on the
 * Wardrobe path — `wardrobeDoor` refuses props, weapons, headwear and printed
 * text on case (a) as well as case (b) — and `bornWardrobeLine` then falls back
 * to the house line. That sheet says nothing here, and the wardrobe line it
 * shows is the house default, which is the honest record of the picture but is
 * not news that her sword was dropped.
 *
 * It is left silent on purpose rather than given a fourth sentence: the cell
 * has no measured population, and a sentence invented for a case nobody has
 * met is a claim the copy audit cannot classify. What would answer it is a
 * server-side fact — *she stated clothes and the resolved line is the house
 * default* — computed where both terms live, not a client comparison against a
 * constant the client would have to be handed.
 */
export function sheetNotice(input: SheetNoticeInput): string | null {
  if (input.fellBack) return FELL_BACK_NOTICE;
  if (input.statedWardrobe) {
    if (input.wardrobePath === null) return STATED_WARDROBE_NOTICE;
    if (input.wardrobePath === "basics") return BASICS_WARDROBE_NOTICE;
  }
  return input.expiryNotice;
}
