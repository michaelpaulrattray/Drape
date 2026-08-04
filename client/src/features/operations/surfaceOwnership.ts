/**
 * Which work reports itself, and therefore must not be toasted.
 *
 * **D-110: a toast is the fallback channel. It is never a second copy.**
 *
 * The bridge exists for work nobody is watching — a canvas draft landing on a
 * board the user has navigated away from. That is a real gap and the toast is
 * the right answer to it.
 *
 * Casting V2 is not that. Its surfaces are durable and resumable: the sheet
 * polls itself and the room reads server truth, so **an outcome is never lost
 * by not being watched — it is sitting on the surface when you come back.**
 * That is why the exclusion is by KIND rather than by whether the page happens
 * to be open. The bridge cannot know who is looking, and it does not need to:
 * these kinds have somewhere better to say it, always.
 *
 * The founder found the failure this prevents. Cancelling a roll makes the
 * create call reject a minute or two later, and "That roll was cancelled. 160
 * credits were refunded." arrived bottom-right while they were doing something
 * else entirely — describing something they had chosen on purpose and had
 * already watched resolve.
 *
 * Their money is unaffected either way. This is only about who gets to tell the
 * story, and the surface tells it better.
 */

/**
 * Kinds whose outcome has a live, durable home of its own.
 *
 * Adding a `castingV2.*` kind without adding it here is almost certainly a
 * mistake — every V2 surface built so far confesses in place, by ratified
 * design. The test pins that as a rule rather than as a habit.
 */
const SELF_REPORTING_KINDS = new Set<string>([
  // The sheet: the failure banner, per-tile captions, the cancel line that
  // counts refunds down as they land, and the notice slot.
  "castingV2.roll",
  // The room: a permanently failed slot confesses in place ("this view didn't
  // arrive — refunded"), and a total loss says so at the top, server-authored
  // so the room and the ledger cannot drift.
  "castingV2.sign",
  /*
    The refine panel owns its outcomes (D-154), and this entry is what makes
    that true — it was missing, so the bridge toasted refine failures too.

    The founder met it as a long, leaky error pill beside a panel that was
    already saying the same thing better. The comment above had called this
    exact omission "almost certainly a mistake" before the kind existed; the
    kind arrived in M8 and the entry never followed, which is the call-site-
    never-added shape this program keeps finding, wearing a list instead of a
    function.
  */
  "castingV2.refine",
]);

/** True when this operation's outcome already has somewhere better to appear. */
export function ownsItsOwnSurface(kind: string): boolean {
  return SELF_REPORTING_KINDS.has(kind);
}

/**
 * The list itself, so a test can PIN it rather than restate it.
 *
 * Restating was the previous arrangement and it was worthless: the old suite
 * carried its own copy of the predicate, so it would have stayed green through
 * any change to the real one. A test that cannot see the code it describes is
 * proving the layer above the one that breaks.
 */
export function selfReportingKinds(): string[] {
  return Array.from(SELF_REPORTING_KINDS).sort();
}
