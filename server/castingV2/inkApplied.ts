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
 * The shape this product mints for a public name — `randomUUID`, and nothing
 * else has ever been written into either of the columns these pointers name (a
 * design's `publicId`, a delivered crop's).
 *
 * Checked rather than assumed because the value crosses a JSON boundary: a
 * stored delta is bytes on disk, and *"it can only have come from us"* is the
 * sentence that precedes every input-validation incident.
 */
const MINTED_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The applied designs a stored delta names, or null when it names none.
 *
 * Null rather than an empty object so a caller can leave the field off
 * entirely — `readOpenKinds`' own convention, and the reason is the same: an
 * empty object written into every delta is a field that looks written.
 */
export function readAppliedInk(value: unknown): Record<string, string> | null {
  return readInkPointers(value, "inkApplied");
}

/**
 * THE ONE READING BOTH POINTER FIELDS GET, so the two cannot drift into
 * different ideas of what a well-formed entry is.
 *
 * `derive-never-mirror` at a boundary where a copy would be invisible: a second
 * hand-written loop that forgot the `isInkSlot` drop would admit a key the
 * recipe's carry refuses, and a refusal after the money has moved is worse than
 * a drop before it.
 */
function readInkPointers(
  value: unknown,
  field: "inkApplied" | "inkDelivered",
): Record<string, string> | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>)[field];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const read: Record<string, string> = {};
  for (const [slot, id] of Object.entries(raw as Record<string, unknown>)) {
    if (!isInkSlot(slot)) continue;
    if (typeof id !== "string" || !MINTED_ID.test(id.trim())) continue;
    read[slot] = id.trim();
  }
  return Object.keys(read).length === 0 ? null : read;
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
  return deltaCarriesField(value, "inkApplied");
}

function deltaCarriesField(value: unknown, field: string): boolean {
  if (!value || typeof value !== "object") return false;
  return field in (value as Record<string, unknown>);
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

/**
 * AND WHICH PICTURE OF HER THE NEXT RENDER SENDS — the reader for
 * `RefineDelta`'s `inkDelivered`, and the one owner of what THAT field may
 * contain (migration 0050, ruled fable-1197 §1).
 *
 * # It is `inkApplied`'s sibling and not its replacement
 *
 * `inkApplied` says WHICH DESIGN is on her and is what keeps the per-design
 * delete honest; this says WHICH DELIVERED CROP shows how it landed, and it is
 * the half a words-only tattoo can have. On D-137's road there is no design at
 * all, so `inkApplied` is empty for that slot and this is the whole record of
 * the tattoo — which is exactly the hole that made a words-painted tattoo
 * vanish on the next unrelated edit.
 *
 * # Every sentence in this file's header applies here unchanged
 *
 * The strict reader must never see it (a reply free to name a crop id would be
 * a model choosing which picture of a customer's body rides the next render);
 * it enters only from the service that claimed the render; it comes back out
 * through `readStoredDelta`; a key that is not an ink slot is dropped rather
 * than refused after the money has moved; and an id that is not the shape this
 * product mints is dropped for the same reason.
 *
 * The one difference worth stating out loud: this id may name a row that was
 * never written, because the name is minted at claim and the crop at delivery.
 * The carry treats that exactly as it treats a deleted design — skip, and say
 * so loudly.
 */
export function readDeliveredInk(value: unknown): Record<string, string> | null {
  return readInkPointers(value, "inkDelivered");
}

/**
 * DOES THIS OBJECT CARRY `inkDelivered` AT ALL — `deltaCarriesAppliedInk`'s
 * sibling, and the same false-pass guard in miniature: a malformed attempt to
 * name a crop is still the thing the fence forbids, so the instrument answers
 * *did this reply try* rather than *is there anything usable here*.
 */
export function deltaCarriesDeliveredInk(value: unknown): boolean {
  return deltaCarriesField(value, "inkDelivered");
}

/**
 * THE SAME DELTA WITH ONE DELIVERED CROP RECORDED AGAINST ITS SLOT.
 *
 * A copy, never a mutation — `withAppliedInk`'s reason exactly: the step delta
 * and the composed delta are both already held by a dozen consumers by the time
 * this runs.
 */
export function withDeliveredInk(
  delta: RefineDelta,
  slot: string,
  cropId: string,
): RefineDelta {
  return { ...delta, inkDelivered: { ...(delta.inkDelivered ?? {}), [slot]: cropId } };
}

/**
 * WHICH SENTENCE PAINTED WHICH TATTOO — the reader for `RefineDelta`'s
 * `inkAsked`, the THIRD slot-keyed half of one fact (§10 item 3b, shape A,
 * ruled fable-1494).
 *
 * # The hole it fills, measured at the frames
 *
 * `free.ink` is ONE value holding every tattoo she has, and the two pointer
 * fields beside it are keyed by SLOT. So nothing in the record could say which
 * of her sentences belonged to which tattoo — and the two consequences were
 * driven on 2026-08-24 with 50 dev credits, on a Cast given a neck swallow and
 * then an arm compass rose:
 *
 *   the pointers   a step that says anything about ink REPLACED the whole
 *                  pointer set with its own, so the neck crop was dropped
 *                  INSIDE the render that added the arm piece
 *   the words      survived, so the second render painted the neck tattoo
 *                  AGAIN, from the sentence — a different swallow, on the other
 *                  side of his neck. D-137's forbidden render, reached by the
 *                  one road that never had this key
 *
 * With the words keyed by slot, both fall out of one rule: per-slot
 * last-writer-wins, so a second placement accumulates and a replacement at the
 * same placement overwrites; and a slot that already has a delivered crop
 * CARRIES BY PICTURE with its words withheld from the painter, which is
 * `INK_IS_NOT_THIS_SLOT`'s own sentence applied at its one gap.
 *
 * # It is CODE-WRITTEN and the strict reader is blind to it
 *
 * Its two siblings' fence, one degree softer and the same in kind: a reply free
 * to name the words of a slot it was not asked about would be a model editing
 * the record of a tattoo the customer never mentioned. It enters the record
 * only from the service that resolved the placement, and comes back out through
 * `readStoredDelta`, which guards our own past.
 *
 * # Strict about the key, generous about nothing, and DROPPING rather than
 * # refusing
 *
 * A key that is not an ink slot is dropped, an empty or blank sentence is
 * dropped, and a sentence longer than any this product files is dropped — the
 * reason is `readInkPointers`' exactly: what is lost by a drop is a carry, and
 * what would be lost by trusting a malformed entry is a refused render the
 * customer paid for.
 */
export function readAskedInk(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>).inkAsked;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const read: Record<string, string> = {};
  for (const [slot, words] of Object.entries(raw as Record<string, unknown>)) {
    if (!isInkSlot(slot)) continue;
    if (typeof words !== "string") continue;
    const tidy = words.trim();
    if (tidy === "" || tidy.length > ASKED_INK_MAX) continue;
    read[slot] = tidy;
  }
  return Object.keys(read).length === 0 ? null : read;
}

/**
 * The longest sentence this field will carry.
 *
 * A free-lane item is one customer sentence about one tattoo, and the whole
 * interpreted character detail is capped at 180 characters upstream
 * (`NOTES_MAX`). This is deliberately looser than that and still bounded: the
 * field is written by us, so the cap is a fence against a corrupted row rather
 * than against a customer, and a fence that also truncates honest asks would be
 * the announced-cap defect wearing a guard's name.
 */
const ASKED_INK_MAX = 400;

/**
 * DOES THIS OBJECT CARRY `inkAsked` AT ALL — the third of the fence's
 * instruments, and the same false-pass guard in miniature: a malformed attempt
 * to name a slot's words is still the thing the fence forbids.
 */
export function deltaCarriesAskedInk(value: unknown): boolean {
  return deltaCarriesField(value, "inkAsked");
}

/**
 * THE SAME DELTA WITH ONE SLOT'S OWN SENTENCE RECORDED AGAINST IT.
 *
 * A copy, never a mutation — its two siblings' reason exactly.
 */
export function withAskedInk(
  delta: RefineDelta,
  slot: string,
  words: string,
): RefineDelta {
  return { ...delta, inkAsked: { ...(delta.inkAsked ?? {}), [slot]: words } };
}
