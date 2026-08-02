/**
 * The brief said what they were wearing, and the sheet ignored it.
 *
 * That override is LAW and is not in question: a casting sheet photographs
 * eight people in the same plain studio tee on seamless paper, because a
 * candidate who only reads through costume failed the audition. Clothes arrive
 * after Sign, in takes.
 *
 * **The silence is the bug.** Someone who types "in a red leather jacket" and
 * gets eight grey tees has no way to learn whether the instruction was
 * misunderstood, refused, or quietly dropped — so they retype it, or they
 * conclude the box does not read what they write. One quiet line closes that.
 *
 * # Why a word list is allowed here, when elsewhere it is theatre
 *
 * `briefCompiler` records the standing criticism that a keyword list over prose
 * is a blunt instrument — "a barista mid-shift" legitimately describes a person
 * and smuggles a café, and no list separates those. That criticism is about
 * lists used as SPEND GUARDS, where a wrong answer changes what the user is
 * charged for or what the picture contains.
 *
 * Nothing here decides anything. The line this feeds is a fixed sentence that
 * is **unconditionally true** — casting sheets do keep the studio tee, always,
 * whatever the brief said. So the failure modes are asymmetric in the only way
 * that matters: a false positive costs a line of noise, a false negative
 * reproduces exactly today's silence, and neither can produce a false
 * statement. That asymmetry is the whole licence.
 *
 * # Why this is NOT `mentionsGarments`
 *
 * `brandScrub`'s `GARMENT_WORDS` guards composed DIRECTIONS, and it deliberately
 * includes accessories, materials and makeup — a direction has no business
 * naming any of them.
 *
 * Reusing it here would make the line lie. Stated accessories are the one
 * carve-out the framing law grants: glasses, a nose stud, a chain, a wedding
 * ring are facts about the person and DO reach the picture, by design. Telling
 * someone who asked for chunky glasses that "outfits come after Sign" would
 * confess to ignoring the one instruction that was actually honoured.
 *
 * So this list is clothing the sheet genuinely does not render, and nothing
 * else. Every word earns its place by being something a user would otherwise
 * wonder about. Materials ("leather", "denim" alone), abstractions
 * ("silhouette", "tailoring") and anything in the accessory carve-out stay out.
 */

/**
 * Worn clothing the studio tee replaces.
 *
 * Whole words only — the matcher splits on non-letters and compares exactly, so
 * "it suits her" does not match "suit" and "printed" does not match "print".
 * That is load-bearing, not incidental: a stemming matcher would fire this line
 * on ordinary English about a person.
 */
const WORN_CLOTHING_WORDS = [
  // Upper body
  "jacket", "jackets", "coat", "coats", "blazer", "hoodie", "hoodies",
  "sweater", "sweaters", "jumper", "cardigan", "shirt", "shirts", "blouse",
  "vest", "waistcoat", "tunic", "sweatshirt",
  // Lower body
  "trouser", "trousers", "jeans", "skirt", "shorts", "leggings", "chinos",
  // Whole garments
  "dress", "gown", "suit", "overalls", "jumpsuit", "robe", "kimono", "sari",
  "uniform", "costume", "apron",
  // Footwear — invisible on a chest-up sheet, and still theirs after Sign
  "shoes", "boots", "heels", "sneakers", "trainers", "sandals",
  // The category words themselves
  "outfit", "outfits", "clothing", "clothes", "wardrobe", "garment", "garments",
] as const;

/**
 * Did this brief state what they are wearing?
 *
 * Reads the USER'S OWN SENTENCE, never the interpreter's output — the same
 * shape as D-89's deference gate, and for the same reason. The interpreter is
 * instructed to IGNORE wardrobe, so asking it to report what it ignored would
 * be a new field whose only job is to describe an absence, with a new way to be
 * wrong. The raw brief cannot be wrong about what it says.
 */
export function statesWardrobe(briefText: string | null): boolean {
  if (!briefText) return false;
  const words = new Set(briefText.toLowerCase().split(/[^a-z]+/));
  return WORN_CLOTHING_WORDS.some((word) => words.has(word));
}

/**
 * The line, and it says what happens rather than apologising for it.
 *
 * "Keep" not "ignore": the tee is a deliberate property of a casting sheet, and
 * naming where clothes DO belong turns a refusal into a direction.
 */
export const STATED_WARDROBE_NOTICE =
  "Casting sheets keep the studio tee — outfits come after Sign, in takes.";
