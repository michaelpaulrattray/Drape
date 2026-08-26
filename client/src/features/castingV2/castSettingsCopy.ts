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
 * WHY THE AUTHOR SAT A SHEET OUT — rows written before the family clause.
 *
 * Until 2026-08-27 a follow or a chip-edited roll under the flag composed
 * house because the author road could not carry an anchor or a chip edit;
 * since #154 (`CASTING_V2_AUTHOR_ROAD_FAMILY_CLAUSE_DESIGN.md`) it carries
 * both as words and no new row records a reason. The rows already written do,
 * and the sheet still says so for them, in the past tense — the row is the
 * artifact. The vocabulary is the projection's (`AUTHOR_SAT_OUT_REASONS`), so
 * a reason this map does not know is a type error here rather than a blank
 * line on his sheet.
 */
export type AuthorSatOutReason = "anchored" | "edited";

const AUTHOR_SAT_OUT_RECORD: Record<AuthorSatOutReason, string> = {
  anchored: "Sat this one out — this follow was cast the studio's own way, before the author could carry a family, so there is no authored prompt to show.",
  edited: "Sat this one out — these chip edits were cast the studio's own way, before the author could carry them, so there is no authored prompt to show.",
};

export function authorSatOutRecord(reason: AuthorSatOutReason): string {
  return AUTHOR_SAT_OUT_RECORD[reason];
}

/**
 * READ-ONLY CHIPS ON AN AUTHORED SHEET (#154, his answer (2): *"read-only chips
 * with the sentence"*). On the author road the brief goes to the engine word
 * for word, so a pinned fact read out of the sentence cannot be let vary by
 * removing it — the echo offers no "let it vary" there, and this line, drawn
 * once under the echo, says why. (On a standing FOLLOW the three anchored axes
 * — sex, age, heritage — can still be let vary, because there the anchor is
 * what supplies them.)
 */
export const AUTHOR_CHIPS_ARE_A_RECORD =
  "These are what the studio read in your words — edit the sentence to change them.";
