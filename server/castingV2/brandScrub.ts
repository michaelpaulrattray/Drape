/**
 * Brand names never reach the image engine.
 *
 * Founder gate 21. A roll of "a young male Mediterranean model inspired by
 * versace editorial" lost five of eight candidates. The interpreter had put the
 * house name straight into `role` — `"male fashion model, Versace editorial
 * style"` — and `role` is composed into the prompt verbatim as
 * `CASTING CATEGORY (ABSOLUTE)`. So a trademark went to the provider on every
 * candidate of that roll, and the provider refused most of them.
 *
 * The archetype layer was already careful about this: `ARCHETYPES` uses
 * descriptive names and never real houses, by ruling. But being careful in the
 * layer that *maps* brands does nothing about the two free-text fields that
 * travel beside it. The rule has to be about what reaches the engine, not about
 * one layer's vocabulary.
 *
 * Two halves, because either alone leaves it reachable:
 *   1. The interpreter is told to translate a house into aesthetic direction
 *      rather than repeat its name (see `interpreter.ts`).
 *   2. This scrub runs over the composed free text regardless, because the
 *      interpreter is a language model and instruction-following is a tendency,
 *      not a guarantee.
 *
 * It removes the name and keeps the sentence: "Versace editorial style" becomes
 * "editorial style", not a hole. The aesthetic the user asked for survives in
 * the archetype and in the rest of their words; only the trademark goes.
 */

/**
 * Houses and marks whose names have no business in a generation prompt.
 *
 * Deliberately a list of *fashion and luxury* marks rather than an attempt at
 * every trademark in the world — this is the vocabulary that shows up in
 * casting briefs, and a list that tried to be exhaustive would start eating
 * ordinary words. Matched case-insensitively on word boundaries.
 */
const BRAND_TOKENS = [
  "versace", "gucci", "prada", "chanel", "dior", "balenciaga", "givenchy",
  "valentino", "armani", "burberry", "fendi", "hermes", "hermès", "celine",
  "céline", "loewe", "bottega veneta", "bottega", "saint laurent", "ysl",
  "alexander mcqueen", "mcqueen", "miu miu", "jacquemus", "marni", "margiela",
  "maison margiela", "comme des garcons", "comme des garçons", "rick owens",
  "tom ford", "calvin klein", "ralph lauren", "tommy hilfiger", "vuitton",
  "louis vuitton", "supreme", "off-white", "acne studios", "the row",
  "nike", "adidas", "zara", "h&m", "uniqlo", "shein", "vogue", "elle",
  "harper's bazaar", "vanity fair",
];

/** Longest first, so "louis vuitton" is removed before "vuitton" can match. */
const BRAND_PATTERN = new RegExp(
  `\\b(?:${[...BRAND_TOKENS]
    .sort((a, b) => b.length - a.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "gi",
);

/**
 * Strip brand names, then repair the punctuation they leave behind.
 *
 * Returns `null` when nothing survives — a role that was only a house name is
 * not a casting category, and passing an empty string on would put
 * `cast as — .` into a paid prompt.
 */
export function scrubBrands(text: string | null): string | null {
  if (!text) return text;
  const stripped = text
    .replace(BRAND_PATTERN, " ")
    // Collapse the wreckage: doubled spaces, orphaned commas, a trailing "and".
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;:])\s*([,.;:])/g, "$1")
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, "")
    .replace(/\b(and|of|by|in|for|inspired by)\s*$/i, "")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

/**
 * Words that mean a direction is describing CLOTHES rather than a person.
 *
 * The garment guard, and it REJECTS rather than edits (founder ruling): a
 * composed direction that mentions clothing was written against the wrong
 * brief, and half of it is not salvageable. Two standing rules behind that —
 * never patch a language model's output with code, and never fail a roll over
 * it. A rejected direction falls back to shelf behaviour and the roll runs.
 *
 * It matters because the frame forbids all of this: a plain grey tee on
 * seamless paper, no props, no accessories. A direction describing a coat is a
 * direction that will be ignored at best and fought at worst — and because
 * brand identity in fashion lives in objects, it is also the likeliest way a
 * house sneaks back in without its name.
 */
const GARMENT_WORDS = [
  "jacket", "coat", "dress", "suit", "shirt", "blouse", "trouser", "trousers",
  "skirt", "denim", "leather", "knit", "knitwear", "tailoring", "silhouette",
  "heel", "heels", "boot", "boots", "shoe", "shoes", "bag", "handbag",
  "jewellery", "jewelry", "necklace", "earring", "earrings", "logo", "monogram",
  "print", "fabric", "hem", "collar", "lapel", "buckle", "hardware", "garment",
  "clothing", "outfit", "wardrobe", "accessory", "accessories", "makeup",
];

export function mentionsGarments(text: string | null): boolean {
  if (!text) return false;
  const words = new Set(text.toLowerCase().split(/[^a-z]+/));
  return GARMENT_WORDS.some((word) => words.has(word));
}

/** True when the text still carries a mark — for tests and for the guard. */
export function containsBrand(text: string | null): boolean {
  if (!text) return false;
  BRAND_PATTERN.lastIndex = 0;
  return BRAND_PATTERN.test(text);
}
