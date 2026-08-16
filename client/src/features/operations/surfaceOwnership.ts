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
  /*
    THESE TWO STAY ON THE LIST BECAUSE THE COARSE ANSWER IS THE TRUE ONE FOR
    THEM: their surfaces can represent a TERMINAL FAILURE, whoever was watching.
    That is the property the list is really asserting, and it is a property of
    the kind rather than of the request — so a standing answer is honest here.
  */
  // The sheet: the failure banner, per-tile captions, the cancel line that
  // counts refunds down as they land, and the notice slot. A failed roll leaves
  // `failed-refunded` tiles behind whether or not anyone saw it happen.
  "castingV2.roll",
  // The room: a permanently failed slot confesses in place ("this view didn't
  // arrive — refunded"), and a total loss says so at the top, server-authored
  // so the room and the ledger cannot drift.
  "castingV2.sign",
  /*
    `castingV2.refine` WAS HERE and is not, since 2026-08-17 (opus-614/617,
    ruled fable-825 §2 / fable-828 §3). Kept as a comment because its removal
    is the ruling, and a reader who re-adds it will re-open a defect the
    founder personally lived eight times.

    The entry was correct about the panel and wrong about the payload. The
    refine panel does own its outcomes (D-154) — but its ONLY channel is the
    return value of its own mutation, and a terminal refine failure is in
    NEITHER of the sheet's two lists (`status='ready'`,
    `status IN ('queued','dispatched')`), so it leaves the payload entirely.
    When the mutation is the thing that died — 1.7% of his production refines
    answered past the ~305 s gateway wall, measured — the panel shows its
    fallback and the server's sentence reaches nobody.

    So the ownership is per REQUEST, not per kind, and it is produced by the
    sheet into `outcomeShown.ts`. The list keeps only the kinds whose answer
    genuinely cannot vary that way.
  */
]);

/** True when this operation's outcome already has somewhere better to appear. */
export function ownsItsOwnSurface(kind: string): boolean {
  return SELF_REPORTING_KINDS.has(kind);
}

/**
 * THE WHOLE DECISION, IN THE FUNCTION THE BRIDGE ACTUALLY CALLS.
 *
 * It used to be four clauses inline in `GenerationOperationBridge`, with the
 * suite carrying its own copy of three of them and importing only the fourth —
 * so the test described the bridge rather than testing it, and would have
 * stayed green through a wrong change to any of the restated three. That is the
 * same mirror (law 4) this file's own ruling is about, one level up.
 *
 * The order is the argument:
 *
 *   1. only a FAILURE with a sentence to say is a candidate at all;
 *   2. `locallyNotifiedFailure` — the legacy adapter's per-request answer,
 *      unchanged and still first among the suppressions;
 *   3. a kind whose surface can represent a terminal failure whoever was
 *      watching (roll, sign) is never spoken over;
 *   4. and otherwise the per-request fact: if a surface showed the SERVER'S own
 *      sentence, the bridge has nothing to add. If it showed a fallback — or if
 *      nobody was watching at all — the true sentence has reached no one, and
 *      the bridge is the only thing that still holds it.
 */
export function bridgeShouldSpeak(input: {
  kind: string;
  status: string;
  publicMessage: string | null;
  /** The legacy same-tab adapter's answer, where one exists. */
  locallyNotifiedFailure?: boolean;
  /** What a surface put on screen for this request, from `outcomeShown.ts`. */
  outcomeShown?: "server" | "fallback" | null;
}): boolean {
  if (input.status !== "failed" || !input.publicMessage) return false;
  if (input.locallyNotifiedFailure) return false;
  if (ownsItsOwnSurface(input.kind)) return false;
  return input.outcomeShown !== "server";
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
