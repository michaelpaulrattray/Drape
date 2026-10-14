/**
 * WHICH VOICE A CUSTOMER IS KEEPING — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4.
 *
 * A design hands back three voices; a Keep says which one. This module is the
 * whole of how the second sentence names the first, and it exists because of
 * one rule in the engine boundary that must not be bent:
 *
 * > *"The id is the provider's and is INTERNAL — it never reaches a client
 * > projection"* (`server/providers/voiceTypes.ts`, `VoicePreview`).
 *
 * So the client cannot be handed the `generated_voice_id` and asked to send it
 * back. It gets an opaque **handle** per voice instead, and this store is the
 * only thing that can turn a handle into the provider's id. One indirection,
 * in one place, with the owner recorded beside it.
 *
 * # ⚠ IT IS IN PROCESS, AND THAT IS A STATED LIMIT RATHER THAN A HIDDEN ONE
 *
 * The design asks for the three previews to be *"held under the
 * cleanup-manifest pattern for the life of a preview id, so a reload does not
 * lose a paid design"*. **This slice does not do that**, and the reasoning is
 * on the record rather than in a builder's head:
 *
 *   · **The bytes never get an address at all.** The three MP3s are returned in
 *     the design response and held by the browser that asked for them. There is
 *     no key, no object, no route and no row for a preview — which is strictly
 *     more private than an owner-only address, and it is why the owner-only
 *     route this card adds serves the KEPT CLIP alone.
 *   · **A durable store would outlive the thing it stores.** A preview id stops
 *     being saveable at a provider-side moment nobody has measured (known good
 *     at 49–53 s; design §3 and #2469's receipt). Writing the bytes to R2 under
 *     a manifest would persist audio whose only possible use — being kept — may
 *     already have expired, and then sweep it.
 *   · **What it costs when it is lost is one design.** A reload or a deploy
 *     loses the handles, the card makes a fresh three, and nothing is charged
 *     in this slice (the price and the charge are #2471). About $0.01 of house
 *     money, measured.
 *
 * This is the same shape as the login-attack counter, whose limit is stated the
 * same way in `CLAUDE.md` — *"the counter is in memory and resets on every
 * deploy"*. A durable preview store is a card of its own if the reload ever
 * matters, never a thing folded into this one (his 2026-09-24 ruling).
 *
 * # WHAT THE LOOKUP PROVES, AND WHY IT PROVES IT HERE
 *
 * A handle is a bearer name, so the store refuses one that does not belong to
 * the account and the cast asking (access-control invariant 1's spirit: the
 * owner is in the statement that reads, not in a check beside it). It is a
 * second lock rather than the only one — `keepCastVoice` re-proves the owned
 * live signed cast in the INSERT itself — and that is deliberate: a handle
 * guessed or replayed must not reach the provider on somebody else's design
 * sentence.
 */
import { randomUUID } from "node:crypto";

/**
 * How long a handle stays resolvable.
 *
 * Generous against the provider's own unmeasured window on purpose: when the
 * provider has expired the preview first, the Keep gets the provider's refusal,
 * which is a true sentence about the voice. When THIS store expires first the
 * customer gets a refusal about our bookkeeping, which is the less honest of
 * the two, so it is the one made rare.
 */
export const VOICE_DESIGN_TTL_MS = 15 * 60 * 1000;

/**
 * How many designs may be remembered at once, across every account.
 *
 * An unbounded map on a long-lived process is a leak however small each entry
 * is, and an entry holds only ids and one sentence — no audio. At the ceiling
 * the oldest is dropped, which is also the one most likely to have expired
 * provider-side already.
 */
export const VOICE_DESIGN_STORE_MAX = 500;

type StoredDesign = {
  userId: number;
  modelId: number;
  designSentence: string;
  /** handle → the provider's `generated_voice_id`. Never leaves this module. */
  byHandle: Map<string, string>;
  createdAtMs: number;
};

/** Insertion-ordered, so the oldest entry is the first key (`Map` guarantees it). */
const designs = new Map<string, StoredDesign>();

/**
 * Designs a Keep has CLAIMED and not yet finished with.
 *
 * A claimed design is unresolvable — that is the whole point of the claim — but
 * it must still be restorable if the Keep fails, and the provider ids inside it
 * must not leave this module to do it (the header's rule: a preview id never
 * leaves here). So it moves between two maps and the caller holds only the
 * design id it already had.
 */
const claimed = new Map<string, StoredDesign>();

function now(): number {
  return Date.now();
}

function dropExpired(atMs: number): void {
  /* `Array.from` because this project sets no `target`, so a bare `for…of` over
     a Map is a typecheck error — the house style everywhere under `server/`. */
  for (const [designId, stored] of Array.from(designs.entries())) {
    if (atMs - stored.createdAtMs >= VOICE_DESIGN_TTL_MS) designs.delete(designId);
  }
  /* The claimed map expires on the same clock. A Keep that died mid-flight
     without restoring or dropping would otherwise hold its entry for the life
     of the process. */
  for (const [designId, stored] of Array.from(claimed.entries())) {
    if (atMs - stored.createdAtMs >= VOICE_DESIGN_TTL_MS) claimed.delete(designId);
  }
}

/**
 * Remember a design, and hand back the opaque names its voices answer to.
 *
 * The handles are returned in the same order as the previews, because the card
 * labels them Voice 1–3 in that order and a shuffled pair would mean a customer
 * keeps a voice other than the one they heard.
 */
export function rememberVoiceDesign(input: {
  userId: number;
  modelId: number;
  designSentence: string;
  previewIds: readonly string[];
}): { designId: string; handles: string[] } {
  const atMs = now();
  dropExpired(atMs);
  while (designs.size >= VOICE_DESIGN_STORE_MAX) {
    const oldest = designs.keys().next();
    if (oldest.done) break;
    designs.delete(oldest.value);
  }
  const designId = randomUUID();
  const byHandle = new Map<string, string>();
  const handles: string[] = [];
  for (const previewId of input.previewIds) {
    const handle = randomUUID();
    byHandle.set(handle, previewId);
    handles.push(handle);
  }
  designs.set(designId, {
    userId: input.userId,
    modelId: input.modelId,
    designSentence: input.designSentence,
    byHandle,
    createdAtMs: atMs,
  });
  return { designId, handles };
}

/**
 * Resolve a handle to the provider's id, for this account and this cast only.
 *
 * ⚠ **The design SENTENCE comes back from here too, and never from the client.**
 * It is stored beside the kept clip as the words the voice was made from
 * (design §4), so letting a caller supply it would let the record say the voice
 * came from words it did not come from. The line can also have been edited
 * between the design and the Keep — the stored one is the true answer to *what
 * was this made from*, and the design's own §9 says editing the line does not
 * change a kept voice.
 */
export function resolveVoiceDesignHandle(input: {
  userId: number;
  modelId: number;
  designId: string;
  handle: string;
}): { previewId: string; designSentence: string } | null {
  const atMs = now();
  dropExpired(atMs);
  const stored = designs.get(input.designId);
  if (!stored) return null;
  if (stored.userId !== input.userId || stored.modelId !== input.modelId) return null;
  const previewId = stored.byHandle.get(input.handle);
  if (!previewId) return null;
  return { previewId, designSentence: stored.designSentence };
}

/**
 * CLAIM a handle — resolve it and take the design out of reach in one step, so a
 * second press cannot resolve it again.
 *
 * ⚠ **THIS IS THE ONLY ROAD A KEEP MAY TAKE, AND THE REASON IS MONEY.** Keep
 * spends one of the account's monthly voice operations (95 on this plan) and the
 * provider's save is tens of seconds long. Resolving first and forgetting after
 * — which is what this road did until #2470's second finding — leaves a window
 * in which two presses on one handle BOTH resolve and BOTH call the provider:
 * the loser releases its slot, but its operation is spent and no delete refunds
 * it. `disabled={working}` on the button is render-time and stops none of it; a
 * fast double-click, a retry, or a second tab all get through.
 *
 * ⚠ **The atomicity is the single-threaded event loop's, which is a real
 * guarantee rather than a hopeful one** — there is no `await` between the `get`
 * and the move below, so no other request runs in the gap. It holds for THIS
 * PROCESS, the same bound the store itself has (one map per process, stated in
 * the header); two processes racing one cast are fenced at the row by the unique
 * index, not here.
 *
 * On a failed Keep the caller puts it back with {@link restoreVoiceDesign}, so a
 * provider outage does not cost a customer three voices they could still keep.
 */
export function claimVoiceDesignHandle(input: {
  userId: number;
  modelId: number;
  designId: string;
  handle: string;
}): { previewId: string; designSentence: string } | null {
  const atMs = now();
  dropExpired(atMs);
  const stored = designs.get(input.designId);
  if (!stored) return null;
  if (stored.userId !== input.userId || stored.modelId !== input.modelId) return null;
  const previewId = stored.byHandle.get(input.handle);
  if (!previewId) return null;
  /* The claim, indivisible: nothing above it awaits. */
  designs.delete(input.designId);
  claimed.set(input.designId, stored);
  return { previewId, designSentence: stored.designSentence };
}

/**
 * Put a claimed design back, because its Keep did not land.
 *
 * ⚠ **The TTL is the ORIGINAL `createdAtMs`, never a fresh one** — it is the
 * same object moving back. Re-stamping it would let a failing Keep extend a
 * preview's life past the provider's own window, turning an honest provider
 * refusal into a refusal about our bookkeeping, which is the trade the header
 * picks the other way. A design whose TTL lapsed while the Keep was in flight is
 * dropped rather than restored.
 */
export function restoreVoiceDesign(designId: string): void {
  const stored = claimed.get(designId);
  if (!stored) return;
  claimed.delete(designId);
  if (now() - stored.createdAtMs >= VOICE_DESIGN_TTL_MS) return;
  designs.set(designId, stored);
}

/**
 * Forget one design. Called after a Keep LANDS, because its other two voices can
 * never be kept now (one voice per cast) and a resolvable handle for a voice
 * nothing may keep is a name with no referent.
 *
 * It clears BOTH maps, so it is the right call whether the design was claimed
 * (the Keep road) or merely remembered (the deletion road and the drivers).
 */
export function forgetVoiceDesign(designId: string): void {
  designs.delete(designId);
  claimed.delete(designId);
}

/**
 * For the drivers: how many designs are RESOLVABLE, so a suite can see eviction
 * happen — and, since #2470's second finding, see a claim remove one.
 */
export function voiceDesignStoreSize(): number {
  return designs.size;
}

/** For the drivers: how many are claimed and awaiting a restore or a drop. */
export function claimedVoiceDesignCount(): number {
  return claimed.size;
}

/** For the drivers: empty it between arms. Never called by production code. */
export function resetVoiceDesignStore(): void {
  designs.clear();
  claimed.clear();
}
