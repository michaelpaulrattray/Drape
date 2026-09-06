import { CAST_STYLE_NAMES, type CastStyle } from "@shared/castStyles";

/**
 * THE SETTINGS, SAID IN ONE LINE (#142) — on the gear before the roll
 * ("Photoreal") and on the sheet's record line after it. One owner for both
 * so the two surfaces cannot disagree about what a setting is called (the
 * copy module's own argument, one control over in `castingPathCopy.ts`).
 *
 * ⚠ **The imagination half is GONE (#535, his decision 1: Style is the only
 * setting).** The record renders style alone; an author row that recorded a
 * level still holds it in its register (the row is the artifact) — the sheet
 * simply stops saying so, the way it already handles any fact a row does not
 * carry. And the sat-out sentence family retired with the level: nothing can
 * sit a sheet out silently any more, because the author is a visible press
 * whose "nothing to offer" is said in the box, in the moment.
 */
export function castSettingsSummary(style: CastStyle): string {
  return CAST_STYLE_NAMES[style];
}

/** The sheet's record form — null style (an old row that never stated one) renders nothing. */
export function castSettingsRecord(style: CastStyle | null): string | null {
  return style ? CAST_STYLE_NAMES[style] : null;
}
