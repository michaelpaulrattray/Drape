import {
  AGE_BANDS,
  ARCHETYPE_KEYS,
  BUILDS,
  ENERGY_KEYS,
  HERITAGES,
  LOOK_KEYS,
  SEXES,
} from "./castingIntent";

/**
 * Does this text name someone or something we cannot vouch for?
 *
 * Its own module because of the direction of the dependencies: `castingIntent`
 * imports `brandScrub`, so the vocabulary-aware half cannot live there without
 * a cycle — one that fails at module-eval time, silently spreading a
 * "not iterable" across two hundred unrelated suites.
 *
 * **Listless by ruling.** No list of directors, films, houses or people exists
 * here, or is wanted: the test is a SHAPE — capitalized, and absent from our
 * own closed vocabularies. That catches whatever a person happens to name
 * without anyone having to maintain a culture dictionary and defend its edges.
 */

/**
 * Every word in our closed vocabularies, so a stated FACT never reads as a
 * name. "A Mediterranean man" names a heritage we already model.
 */
const VOCABULARY_WORDS: ReadonlySet<string> = new Set(
  [...HERITAGES, ...ARCHETYPE_KEYS, ...LOOK_KEYS, ...BUILDS, ...ENERGY_KEYS, ...SEXES, ...AGE_BANDS]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean),
);

/**
 * Articles are not names. Stripping one is not a culture list.
 *
 * `"An East Asian model"` is a category a founder typed, and its leading
 * article is capitalized only because it starts the phrase. Without this the
 * guard read "An" as an unknown name and nulled the category — the exact
 * over-reach that would have put the category-drop bug straight back.
 */
const LEADING_ARTICLES = new Set(["a", "an", "the"]);

/**
 * Two callers, with genuinely different text, which is why the mode is a
 * parameter rather than one baked-in rule:
 *
 *   - `"sentence"` — the interpreter's aesthetic RETRY, on a brief. Every brief
 *     starts with a capital, so token 0 says nothing and is skipped wholesale.
 *     A false positive costs one cheap re-interpretation, so it may be sloppy.
 *   - `"phrase"` — the role GUARD, on a role. A role is not a sentence:
 *     "Zendaya lookalike" leads with the name, so token 0 must be read. Only a
 *     leading article is dropped first. A false negative here puts a real
 *     person's name in a paid prompt, so it may not be sloppy at all.
 */
export function namesUnknownProperNoun(text: string, options: { mode: "sentence" | "phrase" }): boolean {
  let tokens = text.trim().split(/\s+/);
  if (options.mode === "phrase" && LEADING_ARTICLES.has(tokens[0]?.toLowerCase() ?? "")) {
    tokens = tokens.slice(1);
  }
  return tokens.some((token, index) => {
    if (options.mode === "sentence" && index === 0) return false;
    const word = token.replace(/[^A-Za-z'-]/g, "");
    if (word.length < 2) return false;
    const first = word[0];
    // Caseless scripts have no capitals to read; they are not evidence.
    if (first !== first.toUpperCase() || first === first.toLowerCase()) return false;
    return !VOCABULARY_WORDS.has(word.toLowerCase());
  });
}
