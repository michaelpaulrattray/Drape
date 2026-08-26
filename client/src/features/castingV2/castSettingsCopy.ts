import { CAST_STYLE_NAMES, type CastStyle } from "@shared/castStyles";
import { IMAGINATION_NAMES, type Imagination } from "@shared/imagination";

/**
 * THE SETTINGS, SAID IN ONE LINE (#142) — on the gear before the roll
 * ("Photoreal · Low") and on the sheet's record line after it ("Photoreal ·
 * Low imagination"). One owner for both so the two surfaces cannot disagree
 * about what a setting is called (the copy module's own argument, one control
 * over in `castingPathCopy.ts`).
 *
 * The record form takes a NULL style on purpose: author rows written before
 * the style was recorded carry an imagination and no style, and the sheet says
 * what the row says rather than back-filling "Photoreal" onto a row that never
 * stated it (working law 1 — the row is the artifact).
 */
export function castSettingsSummary(style: CastStyle, imagination: Imagination): string {
  return `${CAST_STYLE_NAMES[style]} · ${IMAGINATION_NAMES[imagination]}`;
}

export function castSettingsRecord(style: CastStyle | null, imagination: Imagination): string {
  const parts = [style ? CAST_STYLE_NAMES[style] : null, `${IMAGINATION_NAMES[imagination]} imagination`];
  return parts.filter((part): part is string => part !== null).join(" · ");
}

/**
 * WHY THE AUTHOR SAT A SHEET OUT (#131's open item, the honest half).
 *
 * A follow or a chip-edited roll under the flag composes house — the studio's
 * own casting — because the author road cannot carry an anchor or a chip edit
 * yet (`CASTING_V2_AUTHOR_ROAD_FAMILY_CLAUSE_DESIGN.md`). The row has recorded
 * the reason since PR #132; these are the words the sheet and the dock say for
 * it, one owner for both. The vocabulary is the projection's
 * (`AUTHOR_SAT_OUT_REASONS`), so a reason the server adds and this map does
 * not know is a type error here rather than a blank line on his sheet.
 */
export type AuthorSatOutReason = "anchored" | "edited";

const AUTHOR_SAT_OUT_RECORD: Record<AuthorSatOutReason, string> = {
  anchored: "Sat this one out — a follow is cast the studio's own way for now, so there is no authored prompt to show.",
  edited: "Sat this one out — chip edits are cast the studio's own way for now, so there is no authored prompt to show.",
};

export function authorSatOutRecord(reason: AuthorSatOutReason): string {
  return AUTHOR_SAT_OUT_RECORD[reason];
}

/** The dock, in the gear's place, while a chip adjustment is queued. */
export const AUTHOR_SITS_OUT_CHIP_EDITS =
  "With chip edits queued, the next roll is cast the studio's own way — the author sits it out. Edit the sentence instead to keep the author.";
