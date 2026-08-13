/**
 * WHICH REFINE OUTCOMES GET TO SAY SOMETHING — and the answer is all of them.
 *
 * # The defect this module exists to stop happening twice
 *
 * The server sets `note` on two kinds of outcome. A FREE one — undoing, or
 * removing a step that lands back on a picture they already have — says so
 * because silence would leave someone assuming they had just spent 25 credits
 * (D-163 rule 4). And a PAID one that could only be served in PART says which
 * part was left out, because a product that quietly serves half an instruction
 * and says nothing has decided something on the user's behalf without telling
 * them (D-181, and fable-386 §2 for the out-of-frame half).
 *
 * The panel read `kind === "selected" && note`. So the free half worked, and
 * **the paid half had never once reached a screen**: D-181's dropped-reference
 * confession has been composed, spread into the result and serialized on every
 * likeness ask since it shipped, and the only reader of the field threw it away
 * because the outcome was a render. Written, shipped, ruled, and inert on
 * arrival — the field's own reader was the wall.
 *
 * So the rule is a property of the note rather than of the outcome, which is
 * what makes it un-droppable by the next confession somebody adds: **if the
 * server said something happened, the panel says it.** A question is the one
 * exception, and only because the question IS the line — it has its own field
 * and its own chips, and it is handled before this is ever asked.
 */

/** Only what this decision reads. The rest of the result is none of its business. */
export type RefineOutcomeLike = {
  kind?: "rendered" | "selected" | "asked";
  note?: string;
};

/**
 * The sentence the panel should show for this outcome, or nothing.
 *
 * Deliberately NOT keyed on `kind`: every kind that can carry a note has a
 * reason to say it, and the next one added inherits that without an edit here.
 */
export function refineOutcomeNote(result: RefineOutcomeLike | null | undefined): string | null {
  if (!result) return null;
  /* A question is not an outcome (D-180) — `reask.question` is its line, and it
     is set before this is consulted. A note riding one would be a second
     sentence competing with the thing the user has to answer. */
  if (result.kind === "asked") return null;
  const note = result.note?.trim();
  return note ? note : null;
}
