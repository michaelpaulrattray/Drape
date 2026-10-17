/**
 * EVERY EDIT MUST FIT THE CAST — #2626, his rule 2026-10-17, verbatim:
 * *"every edit must fit to the cast otherwise it just wouldnt make sense"*.
 *
 * Two pieces of the refine repaint prompt live here, both courted before they
 * were built (relay scratch `relay-fangs/fit.html`, n=3 per cell):
 *
 * 1. **The fit sentence (P1)**, said once at the end of every repaint prompt
 *    that changes something. It turned a scar from a drawn red line into an
 *    integrated one and fangs from pasted to borderline, hurt nothing on horns,
 *    a tattoo, a piercing or hair, and kept every named colour. It names no
 *    pronoun — "this cast … their own" — so it reads the same for every cast.
 *
 * 2. **The fang growth wording (P2)**, which replaces the costume word
 *    "vampire" with what a fang actually is: the cast's own canines, grown.
 *    5 of 6 natural on people. Its fixed "same colour and finish as their own
 *    teeth" OVERRODE "black fangs" 3 of 3, so that clause is said ONLY when the
 *    customer named no colour or material; when they did, their words stand in
 *    the sentence and the clause is absent.
 *
 * The growth wording is PROMPT text only. The customer's own words stay in the
 * word stack and in the change facts the description writer reads — the
 * records say what they said, the painter is told how to draw it.
 *
 * What was not courted, and is therefore declared rather than shipped quietly:
 * a SIZE the customer names ("long fangs") drops the courted "short and subtle"
 * phrase rather than contradicting it; words after the fang word ride after it.
 * A creature's dark teeth and "black fangs" blackening the whole tooth row are
 * filed separately on the card.
 */

/** P1, word for word as courted. */
export const CAST_FIT_SENTENCE =
  "Every change is made to belong to this cast — their own colouring, finish and anatomy, in this frame's light, as if it had always been there; any colour or material named above is kept.";

const FANG_WORD = /\bfang(?:s|ed)?\b/i;
const TEETH_NOUN = /\b(?:teeth|tooth|fangs?|canines?)\b/i;
/** The costume word the court replaced. Never sent on the change clause. */
const COSTUME_WORDS = /\b(?:vampire|vampiric|vampyre|vamp)\b/gi;
const SIZE_WORDS = /\b(?:long|longer|big|bigger|large|larger|huge|giant|massive|prominent|extended|elongated|oversized)\b/i;

/**
 * Words that name a colour or a material for a tooth. Inclusive on purpose:
 * a false hit only drops the own-teeth clause (the fit sentence still says
 * "their own colouring"), while a miss paints over the customer's colour —
 * the 3-of-3 failure the court measured.
 */
const COLOUR_OR_MATERIAL = new Set([
  // colours
  "black", "white", "ivory", "cream", "yellow", "yellowed", "red", "crimson", "scarlet", "blood",
  "bloody", "orange", "amber", "green", "emerald", "blue", "sapphire", "navy", "teal", "turquoise",
  "cyan", "purple", "violet", "lilac", "lavender", "pink", "rose", "magenta", "brown", "tan",
  "grey", "gray", "silver", "gold", "golden", "bronze", "copper", "brass", "platinum", "rainbow",
  "dark", "pale", "jet", "onyx", "obsidian", "ruby", "jade", "pearl", "pearly", "opal",
  "colour", "color", "coloured", "colored", "stained", "rotten", "blackened",
  // materials and finishes
  "metal", "metallic", "steel", "iron", "chrome", "chromed", "titanium", "silvered", "gilded",
  "crystal", "crystalline", "glass", "glassy", "diamond", "gem", "gemstone", "jewelled", "jeweled",
  "bone", "stone", "wooden", "wood", "ice", "icy", "translucent", "transparent", "clear",
  "glowing", "glow", "luminous", "iridescent", "enamel", "porcelain", "ceramic", "plastic",
  "grillz", "grill", "capped",
]);

/** Whether this ask is a fang ask: an ask about the teeth whose words (or noun) say fangs. */
export function isFangAsk(noun: string, words: string): boolean {
  if (!TEETH_NOUN.test(noun)) return false;
  return FANG_WORD.test(words) || FANG_WORD.test(noun);
}

/** Whether the customer's words name a colour or material for the fangs. */
export function namesColourOrMaterial(words: string): boolean {
  return words
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((token) => token !== "" && COLOUR_OR_MATERIAL.has(token));
}

/**
 * The courted growth description for a fang ask, in the cast's own possessive.
 *
 * "vampire fangs" → "her upper canines elongated into slightly pointed fangs,
 * just beside the front teeth, short and subtle — the tips stop at the lower lip
 * line, not over it; the same colour and finish as her own teeth; tapering
 * naturally from the gum, coming down from under the upper lip, the lips parted
 * slightly to show them". "black fangs" → the same with "slightly pointed black
 * fangs" and no own-teeth clause.
 */
export function fangGrowthWords(words: string, possessive: string): string {
  const said = words.replace(COSTUME_WORDS, " ").replace(/\s+/g, " ").trim();
  const match = FANG_WORD.exec(said);
  const before = (match ? said.slice(0, match.index) : said)
    .replace(/^(?:a pair of|a set of|pair of|set of|some|a|an|the)\s+/i, "")
    .replace(/[\s,;]+$/, "")
    .trim();
  const after = match ? said.slice(match.index + match[0].length).replace(/^[\s,;]+/, "").trim() : "";
  const fangs = `slightly pointed ${before === "" ? "" : `${before} `}fangs${after === "" ? "" : ` ${after}`}`;
  const size = SIZE_WORDS.test(said)
    ? ""
    : ", short and subtle — the tips stop at the lower lip line, not over it";
  const colour = namesColourOrMaterial(said)
    ? ""
    : `; the same colour and finish as ${possessive} own teeth`;
  return [
    `${possessive} upper canines elongated into ${fangs}, just beside the front teeth${size}`,
    colour,
    "; tapering naturally from the gum, coming down from under the upper lip, the lips parted slightly to show them",
  ].join("");
}
