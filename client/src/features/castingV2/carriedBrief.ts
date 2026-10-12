/**
 * THE WORDS A CUSTOMER TYPED, CARRIED BETWEEN THE CASTING PAGE AND THE SHEET
 * (#2385).
 *
 * The casting page moves to the new sheet the moment `createSession` answers,
 * before the roll is read — so a brief the reader then REFUSES (a likeness, not
 * a being, too long) was refused after the page holding the words had already
 * unmounted. The sheet's box is drawn from the roll, and a refused lobby roll
 * never made one, so the box was empty; and "Edit the brief" went back to the
 * casting page carrying nothing, so that box was empty too. The button meant to
 * let them fix the brief made them type up to 4,000 characters again from
 * memory.
 *
 * So the words ride the browser's history state in both directions — the same
 * channel `sheetGone` uses, and for the same reason: never the address bar,
 * where a brief could end up in a link someone shares.
 *
 * ⚠ **This is not #890's carry, and does not reverse it.** #890 ruled that a
 * GONE sheet's words are not handed back (`sheetGone.ts`): those were the words
 * of a sheet that existed and expired. These are words that were never cast at
 * all, and the only door they use is the one whose label promises them —
 * "Edit the brief" — plus the hop onto the sheet that the refusal arrives on.
 *
 * One field, imported by both pages so the writer and the reader cannot drift.
 */
export type CarriedBrief = { carriedBrief: string };

/** Builds the history state that carries the words. */
export function carriedBriefState(text: string): CarriedBrief {
  return { carriedBrief: text };
}

/**
 * Reads the words back out of whatever the history holds.
 *
 * Defensive for the same reasons `readSheetGone` is: history state is untyped,
 * is `null` on a plain visit, and can be anything an extension or an older
 * bundle left there. Anything that is not our shape reads as no words.
 */
export function readCarriedBrief(state: unknown): string {
  if (typeof state !== "object" || state === null) return "";
  const text = (state as { carriedBrief?: unknown }).carriedBrief;
  return typeof text === "string" ? text.trim() : "";
}

/**
 * What the sheet's brief box starts from, before the customer types.
 *
 * The roll's own sentence whenever the sheet has one. Until the sheet has a
 * roll of its own — a lobby roll still being read, or one the reader refused,
 * which never made a roll — the words the casting page sent. Once any roll is
 * active the arrival is spent: a sheet that has cast something never falls back
 * to words from before it.
 */
export function sheetBoxStart(input: {
  shownBrief: string;
  activeRollId: string | null;
  arrived: string;
}): string {
  if (input.shownBrief) return input.shownBrief;
  return input.activeRollId === null ? input.arrived : "";
}
