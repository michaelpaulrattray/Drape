/**
 * The dock on a sheet that can no longer be rolled on (#854, his A).
 *
 * # The defect
 *
 * Unsigned sheets are cleared after seven quiet days. Someone who opened one of
 * those old sheets saw the brief box, the price line and **Roll again** exactly
 * as on a live sheet — nothing on the page said it was closed — and the press
 * ran the paid brief reader for thirteen seconds before refusing with *"Casting
 * session not found"*. PR #859 made the refusal free and honest (the server
 * reads the sheet before the reader now, and the sentence names expiry). That
 * was the floor. What was left was the button itself: **a control that can only
 * ever refuse is a control that should not be offered**, and the one thing that
 * IS possible on an expired sheet — a fresh sheet from the same words — had no
 * button.
 *
 * # His word — Crew reply #178, 2026-09-12, verbatim and entire: "A"
 *
 * A was: *replace Roll again with 'Start a new sheet with these words' on an
 * expired sheet.* The card's own worked example fixed the shape — *the same road
 * Back to casting takes, one step shorter* — so the press is FREE: it carries
 * the words in the box to the casting page's own brief box, where **Cast** shows
 * its price as it always has. Two things follow and both are deliberate:
 *
 *   - **The one function that starts a paid roll stays one.** The lobby's
 *     `startCasting` is, by its own comment, *"exactly ONE function in the
 *     product that starts a roll"*. A second one on the sheet — same session
 *     mint, same latch, same charge — would be the mirror working law 4 warns
 *     about, on a money path.
 *   - **The money press stays on the surface that prices it.** A button that
 *     reads like navigation and charges 160 credits is the surprise this
 *     product does not do; the lobby's Cast carries the price on the line
 *     beside it (D-15), and that is where the spend happens.
 *
 * # The dock, on a closed sheet
 *
 * The button says what it does; the instruction line says why Roll again is
 * gone; the price line is absent because the press costs nothing — a price
 * beside a free button is a lie in the other direction. Nothing else on the
 * dock changes: the box still holds their words and still takes edits, and
 * Re-imagine still rewrites them, because the words are what travel.
 *
 * `abandoned` rides along on purpose (law 7 — the class, not the instance): a
 * sheet closed by their own *Start over* is the same shape, a page whose Roll
 * again can only refuse, and the server refuses it with the same door
 * (`session_closed`, `rollService.ts`). It gets its own sentence because
 * "expired" would be inventing an event that did not happen.
 *
 * # The carry
 *
 * The words ride in the browser's own history state (`navigate(to, { state })`,
 * wouter's road), never in the address bar — a customer should see `/casting`,
 * not their brief URL-encoded after a question mark. It survives a reload,
 * which a store handoff would not. The lobby reads it ONCE, as the box's
 * initial value; typing over it is theirs from then on.
 */

/** The two closed states the sheet can be in. `open` is, by construction, not one. */
export type ClosedSheetStatus = "expired" | "abandoned";

/**
 * Narrows a session's status to the closed ones, or `null` for a sheet that can
 * still be rolled on (or one the page has not loaded yet — absent is open, so a
 * sheet never flashes the closed dock while its session is in flight).
 */
export function closedSheetStatus(status: string | null | undefined): ClosedSheetStatus | null {
  if (status === "expired" || status === "abandoned") return status;
  return null;
}

/** The button, and it names the one thing the page can still do. */
export const START_NEW_SHEET_LABEL = "Start a new sheet with these words";

/**
 * The instruction line — where "Keep the ones worth a second look" sits on a
 * live sheet. States the fact and stops: no alarm, no apology, the retention
 * confession's own register (`retentionCopy.ts`).
 */
export function closedSheetLine(status: ClosedSheetStatus): string {
  return status === "expired" ? "This sheet has expired" : "This sheet was closed";
}

/**
 * What the sheet hands the lobby. One field, so the two pages agree on the
 * shape by importing it rather than by remembering it.
 */
export type CarriedBrief = { brief: string };

/** Builds the history state the sheet navigates with. Trimmed: a carried brief of whitespace is nothing. */
export function carriedBriefState(brief: string): CarriedBrief {
  return { brief: brief.trim() };
}

/**
 * Reads the carried words back out of whatever the history holds.
 *
 * Defensive on purpose: history state is untyped, arrives as `null` on a plain
 * visit, and can be anything a browser extension or an older bundle left there.
 * Anything that is not our shape reads as no carry — an empty box, which is
 * what the lobby always showed.
 */
export function readCarriedBrief(state: unknown): string {
  if (typeof state !== "object" || state === null) return "";
  const brief = (state as { brief?: unknown }).brief;
  return typeof brief === "string" ? brief.trim() : "";
}
