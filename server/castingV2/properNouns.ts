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
 * **Listless about PEOPLE, by ruling.** No list of directors, films, houses or
 * people exists here, or is wanted: the test is a SHAPE — capitalized, and
 * absent from our own closed vocabularies. That catches whatever a person
 * happens to name without anyone maintaining a culture dictionary.
 *
 * It was never listless in general, and that distinction is what makes the
 * vouched set below legal rather than a breach: `VOCABULARY_WORDS` is a list,
 * and `scrubBrands` is a ratified list of houses. What D-82 forbids is a list
 * of PEOPLE — the thing nobody can enumerate or defend the edges of.
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
 * Capitalized words that are NOT people — platforms, institutions, industries.
 *
 * # The defect this closes, measured rather than guessed
 *
 * "a twitch streamer" returned `role: null` on **12 of 120 live samples
 * (10.0%, 95% CI 5.8–16.7%)**, and 11 of those 12 were this guard firing on a
 * role the interpreter had written correctly. The captured strings say it
 * plainly: dropped `"a Twitch streamer"`, kept `"a twitch streamer"` and
 * `"twitch streamer"`. The interpreter normalizes to correct English — Twitch
 * IS a proper noun — and the guard, which cannot tell a platform from a person,
 * threw the category away. The user then paid for a sheet cast with no
 * category at all.
 *
 * It was never twitch-specific. The same shape reaches "a YouTube creator",
 * "a TikTok dancer", "a K-pop idol", "an Olympic swimmer".
 *
 * # Why a vouched list and not a cleverer test
 *
 * There is no shape that separates "Twitch" from "Zendaya": both are a single
 * capitalized token outside our vocabularies. Personhood is knowledge, and
 * knowledge is either a list or a model call — and a model call inside a
 * fail-closed guard is the anti-pattern this guard was built to end.
 *
 * The case-provenance test I proposed first was worse than useless: forgiving
 * a capital the INTERPRETER invented would forgive it on "a wes anderson
 * casting" typed lowercase, which is how people type. It discriminates who
 * authored the capital, not whether it names a person, and it fails in the
 * loosening direction — straight back into D-82.
 *
 * # The doctrine, because this list can only be safe while it is boring
 *
 * **Platforms, institutions and industries only. Never a person, ever — not a
 * stage name, not a house, not a character.** Every gap fails CLOSED: an
 * unlisted "Kick streamer" still nulls, which is today's behaviour and not a
 * regression. That asymmetry is the whole licence for the list existing, and it
 * is why adding a row is reviewed like adding a public endpoint rather than
 * treated as a convenience.
 *
 * A vouched word does not vouch for its neighbours: "a Twitch streamer called
 * Ninja" still fires, because every token is tested independently.
 */
const VOUCHED_NON_PEOPLE: ReadonlySet<string> = new Set([
  // Streaming and social platforms — where a casting category most often
  // borrows a proper noun.
  "twitch", "youtube", "tiktok", "instagram", "snapchat", "twitter", "onlyfans",
  // Music and screen industries named as a casting register, not as a person.
  "k-pop", "kpop", "j-pop", "jpop", "bollywood", "hollywood", "broadway",
  // Institutions that qualify a profession rather than name anybody.
  "olympic", "olympics", "paralympic", "michelin", "nasa", "nhs",
  // Leagues, for the athlete registers.
  "nba", "nfl", "mlb", "nhl", "ufc", "mma", "wwe",
]);

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
    /*
      A HYPHENATED COMPOUND IS ITS PARTS.

      "Michelin-starred chef" is one token carrying a vouched institution and an
      ordinary adjective, and testing the whole string meant vouching every
      compound separately — a row for "michelin-starred", another for
      "michelin-trained", forever. Splitting means the list holds the NOUN and
      the language can do what it likes around it.

      It cannot loosen anything: "Wes-Anderson" splits into two unvouched
      capitals and still fires, and the rules below are applied to each part
      exactly as they were to the whole.
    */
    return word.split("-").filter(Boolean).some((part) => namesUnknownPart(part));
  });
}

/** One word, or one side of a hyphen. Capitalized and unaccounted for? */
function namesUnknownPart(word: string): boolean {
  if (word.length < 2) return false;
  const first = word[0];
  // Caseless scripts have no capitals to read; they are not evidence.
  if (first !== first.toUpperCase() || first === first.toLowerCase()) return false;
  const lower = word.toLowerCase();
  // A word we can vouch for is not a name — see `VOUCHED_NON_PEOPLE` for why
  // this is a list and why it may only ever hold things that are not people.
  if (VOUCHED_NON_PEOPLE.has(lower)) return false;
  return !VOCABULARY_WORDS.has(lower);
}
