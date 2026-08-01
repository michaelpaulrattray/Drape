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
  /*
    Bare "asian" is deliberately absent. It matched only East Asian, so "a South
    Asian model" on an interpreter miss was repaired into the WRONG heritage —
    a lock the user never wrote, on a fact they had actually stated correctly.
    An ambiguous demonym is not a statement, and this repair only ever adds
    locks the brief plainly supports; the same rule already drops multi-matches.
  */
  ["East Asian", ["chinese", "japanese", "korean", "taiwanese"]],
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
 * **Narrowed after review.** The trigger was originally "a direction was set OR
 * the eight differ by look", and the first half was too loose. An archetype is
 * set from VIBE as readily as from a category — a pure mood brief lands one —
 * so the repair was installing the whole sentence as a casting category on
 * briefs that named none. Three consequences stacked: build stopped varying
 * (gate B5 reads a non-null role), the sheet flipped into styling-bias mode
 * past the flavoured-archetype design, and the echo claimed a category the
 * user never wrote.
 *
 * The surviving signal is `variationAxis === "look"`, which the interpreter is
 * instructed to set only when the brief asks for a KIND OF FACE — a model,
 * editorial, fashion, runway, beauty or campaign casting. That is a statement
 * about the category, not about the mood, and it is exactly the signal present
 * on the roll that prompted this repair.
 */
export function promoteStatedRole(intent: CastingIntent, briefText: string): CastingIntent {
  if (intent.role) return intent;
  if (intent.variationAxis !== "look") return intent;
  const words = capAtWordBoundary(briefText.replace(/\s+/g, " ").trim(), 80);
  if (!words) return intent;
  return { ...intent, role: words };
}

/**
 * Cap without cutting a word in half.
 *
 * `slice(0, 80)` truncated mid-word, which reads as a typo in the CASTING
 * CATEGORY block and can sever a trailing stated fact into nonsense. Falls back
 * to the hard slice only when the first 80 characters contain no space at all.
 */
function capAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trim();
}
