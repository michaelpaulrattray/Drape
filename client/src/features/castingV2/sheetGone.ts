/**
 * WHERE A CUSTOMER LANDS WHEN THE SHEET THEY ASKED FOR IS GONE (#890).
 *
 * # His word, 13 Sep, verbatim
 *
 * *"I would rather if the sheet is expired its not reachable its gone."*
 *
 * **This replaces `closedSheet.ts` and overturns the dock PR #864 built on his
 * earlier "A".** That dock kept an expired sheet as a place you could stand —
 * the words still in the box, a free *Start a new sheet with these words* where
 * Roll again had been. His eye on the frames ruled the other way: a sheet that
 * has been cleared is not a page. So the address lands on the casting page with
 * one sentence and nothing else — no price, no dock, and their words are not
 * carried, because carrying them would be the same dock in a different coat.
 *
 * # The refusal is the server's, and so is the sentence
 *
 * `getSession` refuses a gone sheet beside its owner-scoped read, before any
 * projection exists (`server/castingV2/sheetGone.ts`) — a client-side check is
 * the one thing a week-old tab skips, and a week-old tab is the road this
 * closes. The status therefore never reaches us as data, only as the sentence
 * written about it, which is why this module relays rather than authors.
 *
 * # Why the marker and not the code
 *
 * `NOT_FOUND` alone is not enough: the ownership refusal one line above the
 * door uses it too, deliberately. The discriminator is `spoken` — the server's
 * own flag for *a person wrote this sentence to be read* (`shared/spokenError`)
 * — and nothing else `getSession` can raise carries it. So the redirect cannot
 * fire on a rate limit, a flag refusal, an unknown id or a gateway's 404.
 */
import { errorIsSpoken } from "@shared/spokenError";

/**
 * Is this the door that says the sheet is gone?
 *
 * Both halves are required on purpose. `spoken` proves we wrote the sentence;
 * `NOT_FOUND` proves it is this door rather than some future authored refusal
 * on the same read — a redirect that fires on a sentence meant to be shown in
 * place would silently swallow it.
 */
export function sheetGoneRefusal(error: unknown): string | null {
  if (!errorIsSpoken(error)) return null;
  const shaped = error as { data?: { code?: unknown }; message?: unknown };
  if (shaped.data?.code !== "NOT_FOUND") return null;
  const message = typeof shaped.message === "string" ? shaped.message.trim() : "";
  return message.length > 0 ? message : null;
}

/** What the sheet hands the casting page. One field, imported by both so they cannot drift. */
export type SheetGoneCarry = { sheetGone: string };

/** Builds the history state the sheet redirects with. */
export function sheetGoneState(sentence: string): SheetGoneCarry {
  return { sheetGone: sentence };
}

/**
 * Reads the sentence back out of whatever the history holds.
 *
 * Defensive on purpose: history state is untyped, arrives as `null` on a plain
 * visit, and can be anything a browser extension or an older bundle left there.
 * Anything that is not our shape reads as no sentence — a casting page with
 * nothing extra on it, which is what a plain visit has always shown.
 */
export function readSheetGone(state: unknown): string {
  if (typeof state !== "object" || state === null) return "";
  const sentence = (state as { sheetGone?: unknown }).sheetGone;
  return typeof sentence === "string" ? sentence.trim() : "";
}
