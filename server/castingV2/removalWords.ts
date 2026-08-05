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
 * Words that mean *make this go away*.
 *
 * Deliberately generous. A false positive here costs nothing — the removal
 * branch still has to find the thing before it acts, and confesses honestly
 * when it cannot.
 */
const REMOVAL_WORDS = [
  "remove", "removed", "removing", "delete", "deleted", "drop", "dropped",
  "lose", "lost", "ditch", "ditched", "scrap", "erase", "erased", "clear",
  "undo", "undone", "revert", "back", "previous", "nevermind", "nvm",
  "no", "not", "none", "without", "off", "out", "away", "gone", "rid",
  "less", "stop", "cancel", "unfiled", "minus",
];

/** Two-word forms that only mean removal together. */
const REMOVAL_PHRASES = [
  "take off", "takes off", "took off", "taking off",
  "take out", "took out", "take away", "took away",
  "get rid", "got rid", "getting rid",
  "no more", "go back", "put back",
];

/**
 * Does this sentence ask for something to go away?
 *
 * Checked against the USER's words, never against the parse — the parse is the
 * thing being second-guessed.
 */
export function namesRemoval(instruction: string): boolean {
  const lowered = instruction.toLowerCase();
  if (REMOVAL_PHRASES.some((phrase) => lowered.includes(phrase))) return true;
  const words = lowered.split(/[^a-z]+/).filter(Boolean);
  return words.some((word) => REMOVAL_WORDS.includes(word));
}
