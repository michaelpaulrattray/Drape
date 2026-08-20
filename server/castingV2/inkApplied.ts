/**
 * WHICH OF HER DESIGNS ARE ACTUALLY ON HER — the reader for `RefineDelta`'s
 * `inkApplied`, and the one owner of what that field may contain.
 *
 * # Why the field exists at all
 *
 * A delivered tattoo did not survive the next unrelated edit. Step one painted
 * a chest piece; step two — *"give him green eyes"* — dispatched the master and
 * a hair crop, with no ink reference and no ink clause anywhere in the outgoing
 * prompt (read off the dispatch record, opus-864 §1). The chain still held the
 * customer's ink WORDS. What it did not hold was WHICH DESIGN, and a tattoo
 * repainted from words alone is D-137's forbidden render.
 *
 * So the step that applies a design records the design, keyed by the slot it
 * went on, and every later render composes that forward exactly as it composes
 * everything else she has asked for (shape A, ruled fable-1167 §2).
 *
 * # THE STRICT READER MUST NEVER SEE THIS FIELD
 *
 * The open lane's rule with a sharper edge. `readDelta` guards the boundary
 * where a MODEL'S REPLY enters the record, and a reply free to name a design id
 * would be a model choosing which of a customer's eight designs gets painted
 * onto her body — the decision `inkDesignForAsk` exists to own, taken by the
 * one participant with no stake in getting it right. This field enters the
 * record only from the service that resolved the design itself, and comes back
 * out through `readStoredDelta`, which guards our own past.
 *
 * `deltaCarriesAppliedInk` is that fence made mechanical: the strict reader's
 * arms use it to prove a planted reply carrying the field is REFUSED rather
 * than quietly accepted.
 *
 * # It is strict about the key and about the id, and generous about nothing
 *
 * A key that is not an ink slot is dropped: the recipe's carry loop refuses one
 * (`inkCarryNotInkSlot`), and a refusal after the money has moved is worse than
 * a drop before it. An id that is not the shape this product mints is dropped
 * for the same reason one door along — `readInkDesign` would answer nothing to
 * it, and a lookup that cannot succeed is a render that cannot carry.
 *
 * **Dropping is safe HERE and would not be safe at the recipe.** What is lost
 * by a drop is a carry; what would be lost by trusting a malformed entry is a
 * refused render the customer paid for. The row itself is still re-read,
 * owner-scoped and digest-checked, before one pixel of it rides — the id
 * points, the row decides.
 */
import { isInkSlot } from "./referenceSlots";
import type { RefineDelta } from "./refineDelta";

/**
 * The shape this product mints for a design's public name — `randomUUID`, and
 * nothing else has ever been written into that column.
 *
 * Checked rather than assumed because the value crosses a JSON boundary: a
 * stored delta is bytes on disk, and *"it can only have come from us"* is the
 * sentence that precedes every input-validation incident.
 */
const DESIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The applied designs a stored delta names, or null when it names none.
 *
 * Null rather than an empty object so a caller can leave the field off
 * entirely — `readOpenKinds`' own convention, and the reason is the same: an
 * empty object written into every delta is a field that looks written.
 */
export function readAppliedInk(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { inkApplied?: unknown }).inkApplied;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const applied: Record<string, string> = {};
  for (const [slot, id] of Object.entries(raw as Record<string, unknown>)) {
    if (!isInkSlot(slot)) continue;
    if (typeof id !== "string" || !DESIGN_ID.test(id.trim())) continue;
    applied[slot] = id.trim();
  }
  return Object.keys(applied).length === 0 ? null : applied;
}

/**
 * DOES THIS OBJECT CARRY THE FIELD AT ALL — the fence's own instrument.
 *
 * Deliberately NOT `readAppliedInk(value) !== null`: that answers *is there
 * anything usable here*, and the question the strict reader's arms must ask is
 * *did this reply try to name a design at all*, whether or not the attempt was
 * well-formed. A model that sent `inkApplied: {"ink:neck": "the first one"}`
 * has done the thing the fence forbids, and an instrument that reported the
 * malformed attempt as absence would certify the fence over a hole.
 *
 * It is the false-pass guard in miniature: the affirmative and the negative
 * cannot be allowed to share an answer.
 */
export function deltaCarriesAppliedInk(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return "inkApplied" in (value as Record<string, unknown>);
}

/**
 * THE SAME DELTA WITH ONE DESIGN RECORDED AGAINST ITS SLOT.
 *
 * A copy, never a mutation. The step delta and the composed delta are both
 * already built and already read by a dozen consumers by the time the design is
 * resolved, and reaching back to mutate an object those consumers are holding
 * is how two callers come to disagree about what a render asked for.
 */
export function withAppliedInk(
  delta: RefineDelta,
  slot: string,
  designId: string,
): RefineDelta {
  return { ...delta, inkApplied: { ...(delta.inkApplied ?? {}), [slot]: designId } };
}
