/**
 * A REMOVAL HAS TO SAY SO (D-189).
 *
 * # The sentence that caused it
 *
 * The calibration trial asked for `"small gold hoop earrings"` — a plain
 * addition, the same words that had worked on the chain before it — and the
 * product answered:
 *
 *   > "I can't find any earrings on this face — there's nothing to take off."
 *
 * The interpreter had classified an ADD as a REMOVE. D-167's absent-everywhere
 * confession then did its job perfectly on a premise that was wrong, and the
 * user was told there was nothing to take off something they were trying to put
 * on. It cost nothing — the confession is free — and it is still the product
 * saying something false about what it was asked.
 *
 * Measured afterwards: twelve samplings of that sentence all classified it as
 * an edit. So it is a rare mis-sampling rather than a rule, which is precisely
 * the class a backstop exists for — a prompt is a instruction to a sampler, and
 * a sampler is wrong sometimes.
 *
 * # The rule, and why it is a word list
 *
 * **Subtraction is stated.** Every legitimate removal in this program's history
 * carries a word for going away: remove, take off, lose, drop, get rid of, no,
 * without, undo. A bare noun phrase is somebody naming a thing they want.
 *
 * A word list is crude, and it is the right kind of crude here: it can only
 * ever reclassify a removal DOWN to an edit, and an edit is what an unadorned
 * noun phrase means in every other corner of this surface. The failure mode it
 * introduces — a removal phrased with no removal word — is a phrasing nobody
 * has yet produced in a year of drivers and corpora, and it degrades to
 * "the product added what you named" rather than to a false confession.
 */

/**
 * # AND THEN ONE ADJECTIVE TURNED THE BACKSTOP OFF (fable-473/481)
 *
 * The founder typed **"her glasses — gentle monster style glasses CLEAR
 * rims"**. A sampling classified it as a removal — the rare mis-parse this
 * whole file exists to catch — and the backstop did not fire, because "clear"
 * was in the list below. The base-worn departure path then authored
 * `absent: { statedAccessories: ["glasses"] }`, the painter took her glasses
 * off, the verifier verified the absence it had been handed, and he was
 * charged 25 credits for the opposite of his ask. It is the only wrong charge
 * in the campaign's history.
 *
 * "Clear rims" is not the only one. Read the old list as a stylist:
 *
 * ```
 * clear    clear rims · a clear complexion
 * back     hair swept back · brushed back
 * out      grown out · blown out
 * drop     DROP EARRINGS — a style in this product's own catalogue
 * off      off-white · off-the-shoulder · an off-centre parting
 * away     swept away from the face
 * ```
 *
 * So the list splits by whether the word can mean anything else HERE.
 */

/**
 * Words that can only mean *make this go away*.
 *
 * Still deliberately generous: a false positive on THIS list costs nothing —
 * the removal branch has to find the thing before it acts, and confesses
 * honestly when it cannot.
 */
const STATED_REMOVAL_WORDS = [
  "remove", "removed", "removing", "delete", "deleted",
  "lose", "lost", "ditch", "ditched", "scrap", "erase", "erased",
  "undo", "undone", "revert", "previous", "nevermind", "nvm",
  "without", "rid", "stop", "cancel", "unfiled", "minus",
];

/**
 * Words that mean removal in one sentence and describe a look in the next.
 *
 * They are NOT evidence on their own. A parse that calls such a sentence a
 * removal gets the ordinary re-read, and the code then decides between the two
 * readings by what the edit reading files for the removal's own subject — a
 * positive value means the sentence named a thing to have ("glasses clear
 * rims", "drop earrings"), an empty subject leaves the removal standing ("no
 * glasses", "hair back").
 */
const AMBIGUOUS_REMOVAL_WORDS = [
  "clear", "back", "out", "drop", "dropped", "away", "gone",
  "less", "no", "not", "none",
];

/**
 * `off` STAYS STATED, and the suite is why.
 *
 * It looks like a sibling of "clear" — off-white, an off-centre parting — but
 * *"take her earrings off"* is how people phrase a removal when the verb and
 * the particle are not adjacent, which no phrase list can catch. Moving it
 * reddened three driven removals immediately. The harm is asymmetric and it
 * runs the other way for this one word: a missed removal is a paid render of
 * the thing they asked to lose.
 */
const STATED_PARTICLES = ["off"];

/**
 * Does this value SAY THE THING IS GONE, in the user's own words?
 *
 * The edit re-read of *"take her earrings off"* files
 * `statedAccessories: ["no earrings"]` — a positive lane holding a negation.
 * Read as "she named a thing to have", it would cancel a real removal, which
 * is exactly the mistake this whole split exists to prevent, mirrored.
 *
 * A negation is a negator followed by nothing the sentence adds: "no earrings",
 * "without glasses". *"A no-makeup makeup look"* is NOT one — it carries words
 * beyond the noun, and it is a look somebody is asking for.
 */
const NEGATORS = ["no", "not", "none", "without", "nothing"];

export function readsAsNegation(value: string, match: string): boolean {
  const words = value.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length === 0) return false;
  if (!NEGATORS.includes(words[0]!)) return false;
  const nounWords = new Set(match.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  /* Articles carry no content: "no more of the glasses" is still a negation. */
  const filler = new Set(["the", "a", "an", "her", "his", "their", "any", "more", "of", "on"]);
  return words.slice(1).every((word) => nounWords.has(word) || filler.has(word));
}

/** Two-word forms that only mean removal together. */
const REMOVAL_PHRASES = [
  "take off", "takes off", "took off", "taking off",
  "take out", "took out", "take away", "took away",
  "get rid", "got rid", "getting rid",
  "no more", "go back", "put back",
];

/** The words this module knows, for a corpus that must not miss one. */
export const AMBIGUOUS_WORDS_FOR_CORPUS: readonly string[] = AMBIGUOUS_REMOVAL_WORDS;

/**
 * How strongly the user's own sentence says *subtraction*.
 *
 * `stated`    — a word or phrase that can only mean going away. Trust the parse.
 * `ambiguous` — only a word that also describes looks in this product. Not
 *               evidence: the re-read runs and the code decides.
 * `none`      — nothing at all. The re-read runs and wins, as it always has.
 *
 * Checked against the USER's words, never against the parse — the parse is the
 * thing being second-guessed.
 */
export type RemovalEvidence = "stated" | "ambiguous" | "none";

export function removalEvidence(instruction: string): RemovalEvidence {
  const lowered = instruction.toLowerCase();
  if (REMOVAL_PHRASES.some((phrase) => lowered.includes(phrase))) return "stated";
  const words = lowered.split(/[^a-z]+/).filter(Boolean);
  if (words.some((word) => STATED_REMOVAL_WORDS.includes(word))) return "stated";
  if (words.some((word) => STATED_PARTICLES.includes(word))) return "stated";
  if (words.some((word) => AMBIGUOUS_REMOVAL_WORDS.includes(word))) return "ambiguous";
  return "none";
}

/**
 * Does this sentence ask for something to go away?
 *
 * Kept as the coarse question for callers that only need one bit. The service's
 * backstop uses `removalEvidence`, because "said it plainly" and "used a word
 * that can also describe rims" are the two cases it now has to tell apart.
 */
export function namesRemoval(instruction: string): boolean {
  return removalEvidence(instruction) !== "none";
}
