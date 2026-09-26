/**
 * THE ONE MUTED LINE UNDER A VIEW'S NAME (#1347).
 *
 * The founder, looking at the real strip his own Cast draws (Desk reply 224,
 * 2026-09-26), verbatim and entire on the shape:
 *
 * > *"Too heavy — the good tiles have become louder than the broken one. Go
 * > more minimal, in our design language: one muted line under the name,
 * > nothing else.*
 * >
 * > *Under an unchecked view: "Unchecked · Try again" (Try again is the link).*
 * > *Under the view that never arrived: "Refunded · Try again" — same layout,
 * > same line. No credit count in the row.*
 * > *The three good views carry nothing, as now."*
 *
 * What it replaced: a sentence (*"We didn't get to check this one"*) plus a
 * priced button (*"Try again · 50 CR"*) — three lines under a picture the
 * customer had no complaint about, beside two lines under the one that failed.
 *
 * **Why the words live here and the reason lives on the server.** The server
 * decides WHETHER this view may be asked for again and what it costs, and it
 * hands back a road word with the offer (`retry.reason`) rather than the
 * customer's word — the same split the refine's stage words take (#55). So a
 * client cannot invent a friendlier version of a refund, and a copy change
 * cannot reach into the money reading.
 *
 * **Why a module rather than two literals in the component.** `retryFace.ts`'s
 * reason, unchanged: a rule tested through a substring search of the component
 * is a test that agrees with whoever wrote it. The map below can be held
 * against the server's own union, which is what stops a third reason shipping
 * with no word for it.
 */

/* A type-only reach across the boundary, erased at build — the same road
   `generationOperationProjection.ts` takes to the router's own types. It is
   what makes the map below keyed on the server's union rather than on a copy
   of it. */
import type { CastSlotRetry } from "../../../../server/castingV2/castProjection";

/**
 * His word per road, and there are exactly two because the server offers
 * exactly two reasons.
 *
 * Keyed on the offer's own union, so a third reason added server-side is a
 * TypeScript error here rather than a blank space on his page.
 */
export const VIEW_RETRY_WORDS: Record<CastSlotRetry["reason"], string> = {
  /** The picture is here and nobody looked at it (D-246). Asking again is free. */
  unchecked: "Unchecked",
  /**
   * The view never arrived and the money went back — the empty tile, and the
   * legacy stand-in that wears her Master in a portrait slot.
   */
  refunded: "Refunded",
};

/**
 * The link, and it is the only pressable thing in the row.
 *
 * ⚠ **NO PRICE ON IT — his ruling, and it supersedes #1208's "one price on the
 * button".** The entrance still charges 50 for a refunded view and nothing for
 * an unchecked one; what changed is that the row no longer says so. Kept as one
 * constant because the word appears in his ruling, in the row, and in the guard
 * that holds the row to it.
 */
export const VIEW_RETRY_LINK = "Try again";

/** The separator, drawn between the word and the link. Aria-hidden in the row. */
export const VIEW_RETRY_SEPARATOR = "·";

/**
 * The whole line, as one string, for a reader that wants to see what he sees.
 *
 * Not what the component renders — the link has to be a real button — so this
 * is deliberately NOT the render path: it exists so the guard can assert his
 * two sentences character for character without reassembling them itself.
 */
export function viewRetryLine(reason: CastSlotRetry["reason"]): string {
  return `${VIEW_RETRY_WORDS[reason]} ${VIEW_RETRY_SEPARATOR} ${VIEW_RETRY_LINK}`;
}
