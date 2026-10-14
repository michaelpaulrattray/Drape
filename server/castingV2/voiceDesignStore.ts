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

function now(): number {
  return Date.now();
}

function dropExpired(atMs: number): void {
  /* `Array.from` because this project sets no `target`, so a bare `for…of` over
     a Map is a typecheck error — the house style everywhere under `server/`. */
  for (const [designId, stored] of Array.from(designs.entries())) {
    if (atMs - stored.createdAtMs >= VOICE_DESIGN_TTL_MS) designs.delete(designId);
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
 * Forget one design. Called after a Keep lands, because its other two voices
 * can never be kept now (one voice per cast) and a resolvable handle for a
 * voice nothing may keep is a name with no referent.
 */
export function forgetVoiceDesign(designId: string): void {
  designs.delete(designId);
}

/** For the drivers: the store's own size, so a suite can see eviction happen. */
export function voiceDesignStoreSize(): number {
  return designs.size;
}

/** For the drivers: empty it between arms. Never called by production code. */
export function resetVoiceDesignStore(): void {
  designs.clear();
}
