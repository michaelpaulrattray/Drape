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
 *
 * **Headwear is a deliberate omission, not an oversight.** A hat is not in the
 * carve-out's enumeration and is probably dropped silently today — but
 * "probably" is not good enough for a line that asserts what happened. Adding
 * it needs a measurement of what the interpreter actually does with "wearing a
 * cap" first, because a wrong guess here makes the sentence lie in the other
 * direction.
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
  // Lower body. "pants" is American English for exactly what "trousers"
  // covers, and leaving it out would make the line fire for half the people
  // who write the same brief.
  "trouser", "trousers", "pants", "jeans", "skirt", "shorts", "leggings",
  "chinos", "sweatpants", "tracksuit",
  // Whole garments
  "dress", "gown", "suit", "overalls", "jumpsuit", "robe", "kimono", "sari",
  "uniform", "costume", "apron",
  // Footwear — invisible on a chest-up sheet, and still theirs after Sign
  "shoes", "boots", "heels", "sneakers", "trainers", "sandals",
  // The category words themselves
  "outfit", "outfits", "clothing", "clothes", "wardrobe", "garment", "garments",
] as const;

/**
 * Does this text name worn clothing?
 *
 * The predicate the list above was written for, exported so the ACCESSORY
 * carve-out can share it rather than reach for `mentionsGarments` — the reuse
 * this file's own header warns against, and which shipped anyway.
 *
 * It cost the founder a measurement to find: a brief stating *"small gold hoop
 * earrings"* reached `parseStatedAccessories` intact, from a model that had
 * filed it perfectly, and was deleted because `GARMENT_WORDS` bans the word
 * "earrings" — correctly, for a composed direction, and catastrophically for
 * the one field whose whole purpose is to carry it. Same brief, same reply:
 * *"a bold red lip and heavy makeup"* kept the lip and lost the makeup, on a
 * field whose description says "Makeup counts" in that word. (opus-280,
 * fable-337.)
 *
 * One list, two callers, no second copy to drift — the boundary is defined
 * once, here, beside the reasoning for where it falls.
 */
export function mentionsWornClothing(text: string | null): boolean {
  if (!text) return false;
  const words = new Set(text.toLowerCase().split(/[^a-z]+/));
  return WORN_CLOTHING_WORDS.some((word) => words.has(word));
}

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
  return mentionsWornClothing(briefText);
}

/*
 * The SENTENCE this file used to declare lives in the client, beside the
 * precedence that decides whether it is shown at all
 * (`client/src/features/castingV2/sheetNotice.ts`). It was declared here too —
 * byte-identical, imported by nothing, not even a test — which is law 4's own
 * shape waiting to drift. The boundary that survived is the right one: the
 * server sends the FACT (`statedWardrobe`, from `statesWardrobe` above) and the
 * client owns the VOICE. Removed by the cleanup milestone, 2026-08-18; the
 * reasoning that stood over it moved with it rather than being deleted.
 */
