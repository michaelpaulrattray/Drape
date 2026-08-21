/**
 * AN INK ASK THIS ROAD CANNOT STATE YET — told, never asked (ordered
 * fable-1233 §2, from the founder's first live tattoo ask).
 *
 * # The specimen, and it is his
 *
 * His words, verbatim: *"add tattos to him inspired by the attached design"*,
 * with a dense flash COLLAGE attached — dozens of separate pieces laid out as
 * one full-body composition (`docs/specs/references/build-two-founder-specimens/
 * tattoo-flash-collage-inspired-by-full-body.png`, entry 9). What the product
 * said back was
 *
 *   > "I can put a tattoo on her, but I need to know where it goes — her neck,
 *   >  an upper arm, her upper chest."
 *
 * **That is a nonsense question for that ask.** He did not omit a placement; he
 * asked for something whose whole shape is *wherever it fits* — plural pieces,
 * a style rather than a copy, no one address. D-180's condition is that a
 * question this product asks must never dead-end, and a question whose PREMISE
 * the ask rejects is a dead end wearing a tap target.
 *
 * Today's road is one design, one measured placement (`neck`, `upperArm`,
 * `upperChest`), copied exactly. The ask above is none of those three, and the
 * road that serves it is the OPEN LANE (`OPEN_LANE_DESIGN_NOTE.md` §12), which
 * is designed and not built. So the honest answer names what works today and
 * says the rest is coming — and it is `cannotSayCopy`'s `inkBeyondToday`.
 *
 * # WHY THE TEST IS ON HER OWN SENTENCE, and why it is only ONE of the three
 * # signals fable-1233 §2 names
 *
 * The order names the shape as *inspired-by / plural / no-placement*. This
 * predicate reads the FIRST of those and deliberately not the second, and the
 * reason is measured rather than tidy: **his own ask spells it `tattos`.** A
 * plural test keyed on spelling would have missed the very sentence that
 * ordered this fix, and the repo has already paid once for a spelling gate that
 * owned a real word. Plurality is a judgement about meaning; *"inspired by"* is
 * a phrase she either typed or did not.
 *
 * That is the same source-containment discipline the side question runs on: the
 * rule sits on HER SENTENCE, so it cannot drift with a model's mood, and a
 * confident guess here costs an apology rather than a refund. An ask that is
 * plural but never says *"inspired by"* still meets the placement question —
 * a narrower door than the order's full shape, stated rather than pretended
 * away, and it widens the day plurality has an owner that reads meaning.
 *
 * # It is a NARROWING and never a refusal
 *
 * Both roads out of this predicate refuse for the same underlying fact — no
 * measured placement — and both are free, before the claim. All it decides is
 * WHICH honest sentence she reads. Nothing it can answer turns a customer away
 * who would otherwise have been served.
 */

/**
 * The phrases that say *take the feeling, not the drawing*.
 *
 * Kept to what a customer actually types and matched case-insensitively on the
 * raw sentence. No stemming, no fuzzy match, no model: a phrase test that can
 * only be right about words that are present is the point of putting the rule
 * on the sentence.
 */
const INSPIRED_BY_PHRASES = [
  "inspired by",
  "inspired from",
  "in the style of",
  "similar to these",
  "something like these",
] as const;

/** TRUE when her own sentence asks for a STYLE rather than a copy. */
export function asksInkBeyondToday(instruction: string | null | undefined): boolean {
  if (!instruction) return false;
  const said = instruction.toLowerCase();
  return INSPIRED_BY_PHRASES.some((phrase) => said.includes(phrase));
}
