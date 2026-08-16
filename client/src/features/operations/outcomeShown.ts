/**
 * WHICH REQUESTS A SURFACE HAS ALREADY ANSWERED — and with WHOSE words.
 *
 * # The gap this closes, with a measurement on it
 *
 * A refine is one long-held mutation: `castingV2.refine` awaits the whole render
 * before it answers. Read off production on 2026-08-17 (opus-616, n=180 of the
 * founder's own settled refines, the only account that has ever bought one):
 * **1.7% answered past the observed ~305 s gateway wall, and 2.8% at or past
 * 290 s** — where run-15 already proved 293 s was too late. When that happens
 * the socket carrying the answer is gone before the answer exists, so the panel
 * shows its fallback (*"We lost contact while that was rendering"*) and the
 * server's own sentence — which carried the actionable half, *"Try saying it a
 * different way"* — is never delivered to anyone.
 *
 * The `spoken` marker cannot help: it marks a sentence on a response, and there
 * is no response. The surface cannot help either — a terminal refine failure is
 * in neither of the sheet's two lists (`status='ready'` and
 * `status IN ('queued','dispatched')`), so it leaves the payload entirely.
 *
 * The `GenerationOperationBridge` is the one thing that still has the sentence.
 *
 * # Why a per-request fact and not another entry on a kind list
 *
 * `surfaceOwnership.ts` answers "will somebody else say this?" per KIND, which
 * is a standing answer to a question whose truth changes per request: the refine
 * panel says the outcome when it receives one, and says nothing when it does
 * not. The bridge already holds a per-request answer of exactly this shape
 * (`localRequestsRef`) — but its only producer is `pendingCastRegistry`, whose
 * four importers are all legacy casting, boards and studio. No Casting V2
 * surface registers, so for `castingV2.refine` that answer is permanently
 * `undefined`, and the kind list was standing in for it.
 *
 * This is that answer, produced. Deliberately NOT routed through
 * `pendingCastRegistry`: that module is shaped for legacy casting (`modelId`,
 * `angles`, `origin`, a five-value `kind`), and feeding it nulls to borrow one
 * boolean would be a worse mirror than the one it removes.
 *
 * # "server" versus "fallback" is the whole point
 *
 * Not "did the panel show something" — it always does. The question is whether
 * what it showed came from the server. `failureIsOurs` decides it structurally
 * (the `spoken` marker, or a code a gateway cannot forge), so nothing here ever
 * compares a string against a copy constant.
 */

/** What a surface put on screen for one request. */
export type OutcomeShown = "server" | "fallback";

/*
  Module state rather than a store: nothing renders from it, it must survive a
  component unmounting mid-request (which is the case it exists for), and it
  must NOT survive a reload — a mark that outlived the page would tell the
  bridge a sentence had been delivered to a surface that no longer exists.
*/
const shown = new Map<string, OutcomeShown>();

/**
 * A surface has answered this request.
 *
 * Called on BOTH settlement paths, because "the server answered and I showed
 * it" and "the server never answered and I showed my own line" are the two
 * things the bridge has to tell apart — and a request that is simply missing
 * from this map is the third (nobody was watching), which is why absence is not
 * spelled as either one.
 */
export function markOutcomeShown(clientRequestId: string, source: OutcomeShown): void {
  shown.set(clientRequestId, source);
}

/** What a surface showed for this request, or null if none did. */
export function outcomeShownFor(clientRequestId: string): OutcomeShown | null {
  return shown.get(clientRequestId) ?? null;
}

/**
 * Forget it, once the bridge has decided.
 *
 * The map is bounded by this call rather than by a size cap: the bridge already
 * deletes its own per-request state at the same point, and an entry that
 * outlives the decision it exists for is only a leak.
 */
export function forgetOutcomeShown(clientRequestId: string): void {
  shown.delete(clientRequestId);
}

/** Test isolation. */
export function resetOutcomesShownForTests(): void {
  shown.clear();
}
