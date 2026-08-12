/**
 * THE DECLARATIVE-STATE CONTRACT, in one place because two modules keep it
 * (fable-195, fable-307).
 *
 * A feature's word stack is *everything ever said about it*, and D-244 re-says
 * that stack in full on every later edit. Imperatives do not accumulate:
 * *"make it bigger"* twice says nothing a painter can paint, while *"a wide gold
 * hoop"* then *"noticeably bigger"* describes a state that can be. So the
 * interpreter owns converting an ask into a state phrase — fable-195 ruled that
 * verbatim, and called it "a job it was always going to need".
 *
 * # Why the list lives here rather than beside either of its readers
 *
 * There are exactly two, and they are on opposite sides of the same boundary:
 *
 *   `refineInterpreter` — TELLS the model, in the prompt, which openers are
 *     never a value. It is the module that owes the conversion.
 *   `recipeAssembler`   — REFUSES a stack or an ask that opens with one. The
 *     marker refusal fable-195 asked for, checked at the boundary the words
 *     cross rather than trusted at the boundary they came from.
 *
 * Two copies of this list would drift the day a word is added to one of them,
 * and the failure is silent in the worst direction: the interpreter keeps
 * emitting a word the assembler has started refusing, and the user's paid ask
 * refuses at the door with their credits handed back. Working law 4 — derive,
 * never mirror — so the regex and the prompt's sentence are both built from the
 * array below.
 *
 * # The conversion is a SUBTRACTION, and that is not a style preference
 *
 * The first cut of the rule taught the model to write *"worn down"* for *"wear
 * her hair down"*, which is the natural English state phrase and was refused by
 * the product's own source-containment guard (`stemmedContainment`, D-172):
 * every content word of a free value must appear in the sentence the user
 * typed, and `worn` does not stem to `wear`. The measured result was **worse
 * than the defect it fixed** — an echo re-ask followed by `wall_unfileable`,
 * where before there had at least been a paid render and an honest refusal at
 * the assembler's door.
 *
 * Two rules that were both right, colliding: anti-invention says use only their
 * words, and D-244 says the words must be a state. Both hold at once only if the
 * conversion REMOVES the command rather than replacing it — *"hair down"*, every
 * word of it typed by the user. So the rule below says drop, never rephrase, and
 * loosening containment was not taken: a guard that admits a word the user never
 * said is the invented-fact class returning through the one lane with no closed
 * vocabulary behind it.
 *
 * # It is deliberately SHORT
 *
 * A spelling check on our own module boundary, not a judgment about language. A
 * long list starts refusing legitimate participles — *"set in a low bun"*,
 * *"painted nails"* — which are states, correctly written, that happen to share
 * a stem with a command.
 */

/**
 * Unambiguous imperative openers: a value that begins with one of these is an
 * instruction wearing a value's clothes.
 *
 * `wear` is on the list because of the founder's own most-used sentence. *"Wear
 * her hair down"* reached the assembler verbatim on the repaint road's first
 * live walk and refused at the door — honestly, with the money back, and still a
 * sentence the product could not say (opus-251 §3).
 */
export const IMPERATIVE_OPENERS = [
  "make", "add", "give", "remove", "change", "turn", "put", "apply", "draw",
  "paint", "swap", "replace", "use", "lose", "delete", "erase", "increase",
  "decrease", "take", "wear",
] as const;

/**
 * The marker itself, derived from the list above and anchored at the start.
 *
 * `\b` rather than `\s` so "make-up" and "makeup" are told apart the way a word
 * boundary tells them apart, and case-insensitive because the model's casing is
 * not part of the contract.
 */
export const IMPERATIVE_OPENER = new RegExp(`^(?:${IMPERATIVE_OPENERS.join("|")})\\b`, "i");

/**
 * The opener this text starts with, or null when it reads as a state.
 *
 * Returns the WORD rather than a boolean so a refusal can quote what it saw:
 * "holds \"wear her hair down\"" tells whoever reads the log which module owes
 * the fix, and a bare `true` does not.
 */
export function imperativeOpenerIn(text: string): string | null {
  const match = IMPERATIVE_OPENER.exec(text.trim());
  return match ? match[0] : null;
}

/**
 * The sentence the interpreter's prompt says this rule with.
 *
 * Built here so the words the model is given and the words the assembler
 * enforces cannot come apart — the prompt names every opener, because a rule
 * stated in the abstract ("write a state") is advice, and a rule that names the
 * words is a contract.
 */
export function declarativeStateRule(): readonly string[] {
  return [
    "  - EVERY VALUE IS A STATE, NEVER AN INSTRUCTION. Write how the feature ENDS UP, not what to",
    "    do to it — and do it by DROPPING THE COMMAND, never by finding a new word for it. Their",
    "    own words, minus the verb that told you to act:",
    '      "wear her hair down"        -> hairWorn: "hair down"',
    '      "put a scar on her cheek"   -> marks: ["a scar on her cheek"]',
    '      "make her lips fuller"      -> lips: "fuller lips"',
    '      "give her freckles"         -> marks: ["freckles"]',
    "    Everything ever said about a feature is re-said IN FULL on every later edit, so an",
    '    instruction cannot accumulate: "make it bigger" twice says nothing that can be painted,',
    '    while "a wide gold hoop" then "noticeably bigger" describes something that can.',
    `    Never open a value with: ${IMPERATIVE_OPENERS.join(", ")}.`,
  ];
}
