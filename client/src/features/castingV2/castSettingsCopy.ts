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
