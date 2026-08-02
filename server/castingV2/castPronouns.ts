/**
 * How the product refers to a Cast.
 *
 * The room called every Cast "she". Jericho is male, and the Siblings card told
 * him to open the sheet *she* came from — a small thing that reads as the
 * product not having looked at the person it is describing.
 *
 * **Derived, then projected — never the record itself.** The sex lives in
 * `technicalSchema`, which is one third of the recipe for reproducing a Cast
 * and never leaves the owning account (founder ruling, 2026-07-25). So the
 * server derives three words from it and projects those. Pronouns are not
 * identity documents; the schema they came from is.
 *
 * **`they` is the fallback, not the exception.** A Cast whose record predates
 * the axis, or whose sex was never stated, gets `they` — which is correct
 * English for a person whose pronouns you do not know, and is also what
 * `nonbinary` resolves to. Guessing from a name or a face is not on the table.
 */

export type CastPronouns = {
  /** he · she · they */
  subject: string;
  /** him · her · them */
  object: string;
  /** his · her · their */
  possessive: string;
  /**
   * TRUE when the verb agrees with a plural — "they were", "they have".
   *
   * Carried rather than inferred at each call site, because "they is signed" is
   * exactly the sentence that ships when three call sites each remember the
   * rule separately.
   */
  plural: boolean;
};

const HE: CastPronouns = { subject: "he", object: "him", possessive: "his", plural: false };
const SHE: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };
const THEY: CastPronouns = { subject: "they", object: "them", possessive: "their", plural: true };

/**
 * Reads the sex out of a Cast's technical schema, defensively.
 *
 * The schema is an unstructured JSON column written across several eras, so
 * anything unexpected resolves to `they` rather than throwing — a room that
 * fails to render because a pronoun could not be decided would be a far worse
 * bug than the one this fixes.
 */
export function castPronouns(technicalSchema: unknown): CastPronouns {
  const subject = (technicalSchema as { subject?: { sex?: unknown } } | null)?.subject;
  const sex = typeof subject?.sex === "string" ? subject.sex.toLowerCase() : null;
  if (sex === "male") return HE;
  if (sex === "female") return SHE;
  return THEY;
}

/** Capitalised for sentence-initial use: "He came from this sheet." */
export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
