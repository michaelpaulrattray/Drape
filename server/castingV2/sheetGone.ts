/**
 * AN EXPIRED SHEET IS GONE, NOT A PAGE (#890, his word 13 Sep).
 *
 * # His ruling
 *
 * Verbatim: *"I would rather if the sheet is expired its not reachable its
 * gone."* — said after asking how anyone reaches an expired sheet at all
 * (*"i thought they are deleted?"*), and the honest answer at the code was:
 * the retention sweep marks the session `expired`, hands the pictures to the
 * cleanup worker and deletes their rows, the sheets list shows only `open`
 * sessions — **but the sheet page loaded any session its owner asked for,
 * whatever its status.** So a bookmark, a week-old tab or the back button
 * still opened the words and the dock.
 *
 * **This OVERTURNS the closed-sheet dock of PR #864** (`closedSheet.ts`, his
 * earlier "A" on #854). That dock was the right answer to the question #854
 * asked; his eye on the frames answered a different one, and this is it: an
 * expired sheet is not a place a customer can stand. The dock's code and copy
 * are gone with this commit, because dead copy is a lie waiting to be read.
 *
 * # Why the door is here and not on the client
 *
 * A client-side check is one a stale bundle skips, and the stale bundle is
 * precisely the road this closes — a tab left open for a week is running last
 * week's JavaScript. The refusal is raised beside the owner-scoped read, before
 * any projection of the sheet is built, so there is nothing for a client of any
 * age to render.
 *
 * # `abandoned` rides along, and it was CHECKED rather than assumed
 *
 * `abandonCastingSession` releases the sheet's candidates **inline, in the same
 * transaction as the status change** (`db/castingV2.ts`) — so a sheet closed by
 * their own *Start over* has had its pictures taken exactly as an expired one
 * has. It is the same "gone", and it gets the same door with its own sentence,
 * because "expired" would be inventing an event that did not happen.
 *
 * # What "gone" means, and what it does not
 *
 * The session ROW stays. It carries the money record of that sheet — which
 * slices were delivered, refunded, retained — and the ledger's arithmetic reads
 * it. Unreachable from every product surface IS the deletion he means; a row
 * `DELETE` on a money table is a different decision and was not ordered.
 */
import type { CastingSessionStatus } from "../../drizzle/schema";

/** The two closed states a sheet can be in. `open` is, by construction, not one. */
export type GoneSheetStatus = Exclude<CastingSessionStatus, "open">;

/** Is this sheet gone — unreachable by any road? */
export function sheetIsGone(status: CastingSessionStatus): status is GoneSheetStatus {
  return status !== "open";
}

/**
 * The sentence the customer reads on the casting page after being sent there.
 *
 * Authored server-side and relayed by the client (`readableFailure`), which is
 * the same road PR #859's expiry sentence takes: the reader refuses before it
 * knows enough to project anything, so the status cannot reach the client as
 * data — only as the sentence written about it.
 *
 * His own wording on the card is the expired one. Two facts and a way forward,
 * in the customer's vocabulary: what happened to the sheet, that it was
 * cleared, and the one thing left to do. No price, no dock, and their words are
 * NOT carried — the sheet is gone, and offering its brief back would be the
 * dock wearing a different coat.
 */
export function sheetGoneSentence(status: GoneSheetStatus): string {
  return status === "expired"
    ? "That sheet expired and was cleared. Start a new one."
    : "That sheet was closed and cleared. Start a new one.";
}
