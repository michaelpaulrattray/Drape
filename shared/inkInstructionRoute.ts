/**
 * A routing hint only. The server's closed tattoo planner remains the
 * authorization boundary; this helper merely keeps ordinary refinements from
 * making an unnecessary planning request.
 */
const TATTOO_LANGUAGE =
  /\b(?:tattoos?|tattooed|ink|inking|inked|body\s+art|full\s+sleeves?|half\s+sleeves?|arm\s+sleeves?|leg\s+sleeves?)\b/i;

export function looksLikeTattooInstruction(value: unknown): boolean {
  return typeof value === "string" && TATTOO_LANGUAGE.test(value);
}
