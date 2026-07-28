/**
 * Merge a deliberate Cast preference patch with the cross-field invalidation
 * rules shared by Canvas Recast and the client-held "Fork to edit" draft.
 *
 * This is pure data shaping. Durable authority remains server-side.
 */
export function mergeCastingPreferenceChanges(
  current: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, ...changes };

  if (changes.gender && changes.gender !== current.gender) {
    for (const field of ["hairStyle", "hairFade", "facialHair"]) {
      if (!(field in changes)) merged[field] = "";
    }
  }

  if (changes.hairStyle && changes.hairStyle !== current.hairStyle) {
    for (const field of [
      "hairLength",
      "hairTexture",
      "hairFringe",
      "hairParting",
      "hairVolume",
      "hairTuck",
      "hairFlyaways",
      "hairFade",
    ]) {
      if (!(field in changes)) merged[field] = "";
    }
  }

  const blend = changes.ethnicityBlend as
    | Array<{ name: string; pct: number }>
    | undefined;
  if (blend && blend.length > 0) {
    merged.ethnicity = blend.map((entry) => entry.name).join(", ");
  } else if (
    typeof changes.ethnicity === "string"
    && changes.ethnicity
    && !blend
  ) {
    const names = changes.ethnicity
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 2);
    const pct = names.length === 2 ? 50 : 100;
    merged.ethnicityBlend = names.map((name) => ({ name, pct }));
  }

  return merged;
}
