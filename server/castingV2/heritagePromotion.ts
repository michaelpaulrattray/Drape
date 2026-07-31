import { HERITAGES, type CastingIntent, type Heritage } from "./castingIntent";

/**
 * A heritage the brief stated must be a LOCK, not a word in the role.
 *
 * The interpreter is a language model and it is not perfectly consistent about
 * where a stated heritage lands. Measured on the founder's own brief — "a young
 * male Mediterranean model inspired by versace editorial" — five identical
 * runs: four captured `heritage: [Mediterranean]` and one folded the word into
 * `role` and left the lock empty.
 *
 * That one run is the sheet the founder reported. With no lock, the resolver
 * varies heritage across all eight, so the prompt says "Mediterranean" in the
 * casting category while the subject line says Nordic, or East Asian — a
 * contradiction the image model resolves however it likes. Eight men, most of
 * them not Mediterranean, under a sentence promising they were.
 *
 * So the miss is repaired deterministically. If the brief's own words carry a
 * heritage we recognise and the lock came back empty, the lock is filled from
 * them. Code disposes; this is the same both-halves shape as every other fix in
 * this family — the interpreter is told, and then it is checked.
 *
 * Deliberately narrow: it only ever ADDS a lock the brief plainly supports, and
 * never overrides one the interpreter did capture. A promotion that could
 * contradict the interpreter would be a second opinion, not a backstop.
 */

/** Demonyms and common phrasings that map onto a closed heritage value. */
const HERITAGE_WORDS: Array<[Heritage, string[]]> = [
  ["Mediterranean", ["mediterranean", "italian", "greek", "spanish", "portuguese", "sicilian"]],
  ["Nordic", ["nordic", "scandinavian", "swedish", "norwegian", "danish", "finnish", "icelandic"]],
  ["British Isles", ["british", "english", "irish", "scottish", "welsh"]],
  ["Western European", ["french", "german", "dutch", "belgian", "austrian", "swiss"]],
  ["Slavic", ["slavic", "polish", "russian", "ukrainian", "czech", "serbian", "croatian"]],
  ["East Asian", ["asian", "chinese", "japanese", "korean", "taiwanese"]],
  ["South Asian", ["indian", "pakistani", "bangladeshi", "sri", "nepali"]],
  ["West African", ["nigerian", "ghanaian", "senegalese", "ivorian", "malian"]],
  ["Afro-Caribbean", ["caribbean", "jamaican", "haitian", "trinidadian", "bajan"]],
  ["Middle Eastern", ["arab", "lebanese", "persian", "iranian", "turkish", "egyptian", "syrian"]],
  ["Latino", ["latino", "latina", "hispanic", "mexican", "colombian", "brazilian", "argentine"]],
  ["Polynesian", ["polynesian", "samoan", "tongan", "maori", "hawaiian"]],
];

/**
 * Fill an empty heritage lock from the brief's own words.
 *
 * Returns the intent unchanged when the interpreter already captured one, when
 * the brief names none, or when it names more than one — an ambiguous mention
 * is not a statement, and guessing between two would be inventing rather than
 * recovering.
 */
export function promoteStatedHeritage(intent: CastingIntent, briefText: string): CastingIntent {
  if (intent.heritage.length > 0) return intent;

  const words = new Set(briefText.toLowerCase().split(/[^a-z]+/));
  const found = HERITAGE_WORDS.filter(([, tokens]) => tokens.some((token) => words.has(token)));
  if (found.length !== 1) return intent;

  return { ...intent, heritage: [{ heritage: found[0][0], pct: 100 }] };
}

/** Exported for the test's own table, so the two cannot drift apart. */
export { HERITAGE_WORDS, HERITAGES };
