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

/**
 * A category the brief named must reach the sheet, even when the interpreter
 * dropped it.
 *
 * Same both-halves shape as the heritage repair above, and it exists for a
 * measured failure. The founder's roll — "female mid 20's high-fashion
 * editorial model" — persisted `role: null` with `archetype: "raw editorial"`:
 * the category was routed into the closed direction vocabulary and the user's
 * own words for it were dropped. The sheet then read as generic women, because
 * `role` is the only thing that produces the CASTING CATEGORY block, and gate
 * B5's category-owns-physique rule never fired.
 *
 * The instruction that caused it has been rewritten, but a prompt is a
 * probability, not a guarantee — the same brief returns a role 25 times out of
 * 25 locally and still came back null in production. So the miss is also
 * repaired deterministically.
 *
 * **Narrow on purpose.** It fires only when the interpreter demonstrably
 * recognised a casting context — it set a direction, or it decided the eight
 * should differ by look — and still left the category empty. That combination
 * is evidence a category existed in the sentence. A brief with no such signal
 * keeps its null role, which matters: a null role is what lets build vary, so
 * backfilling every null would quietly stop physique varying on exactly the
 * briefs that have no category to own it.
 */
export function promoteStatedRole(intent: CastingIntent, briefText: string): CastingIntent {
  if (intent.role) return intent;
  const recognisedACastingContext = intent.archetype !== null || intent.variationAxis === "look";
  if (!recognisedACastingContext) return intent;
  const words = briefText.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!words) return intent;
  return { ...intent, role: words };
}
