/**
 * WHERE A CAST'S KEPT VOICE IS LISTENED TO — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4.
 *
 * # ⚠ THE CLIP GETS NO PUBLIC ADDRESS, AND THE REASON IS NOT THE USUAL ONE
 *
 * The design's sentence: *"The clip is a cloning source, so it gets no public
 * address. Anyone holding 90 seconds of a voice can clone it once cloning is on
 * any account, which makes the clip closer to the recipe than to a picture."*
 * Instant voice cloning is **on** on the account today (read at the provider,
 * 2026-10-13 — tier `creator`), so that sentence is live rather than
 * precautionary.
 *
 * `server/storage.ts` writes to a permanently PUBLIC bucket whose URLs never
 * expire — CLAUDE.md says what that buys in as many words: an object there is
 * *"protected only by the URL being hard to guess"*. So the control here is
 * that **the address is never handed out**, which is exactly what
 * `/api/reference/:referenceId` buys for a photograph the customer attached,
 * and this route is that one's shape clause for clause.
 *
 * # WHY NOT THE PRIVATE EVIDENCE BUCKET — read at the code, not preferred
 *
 * The card asks for the bucket question to be answered at `server/storage.ts`
 * and stated. The private evidence store **cannot hold this object**, and that
 * is a measurement rather than a judgement: `createPrivateEvidenceStorageAdapter`'s
 * `putCanonical` refuses anything whose mime is not `EVIDENCE_CANONICAL_MIME`
 * (`image/webp`) AND whose bytes do not sniff as webp, under a key its own
 * `parseEvidenceStorageKey` grammar must accept
 * (`server/casting/evidence/privateEvidenceStorage.ts`). An MP3 is
 * `invalid_payload` there. Putting the clip in that bucket therefore means
 * widening a validated image-only store to accept audio and giving it a second
 * key grammar — new machinery inside the R7 evidence family, which is
 * **explicitly PARKED by founder ruling** (`PROGRAM.md`: *"parked until the
 * casting push lands"*).
 *
 * **So the bytes stay in the public bucket under an unguessable random key and
 * get no address at all, and the two consequences are carried rather than
 * assumed:**
 *
 *   1. **Both deletion roads stay correct.** `accountCastingPurge` files the
 *      clip with `publicItem(...)` and `finalCastDeletion` adds it to the
 *      cast-owned public set. Those are right because the bytes ARE public —
 *      the thing the relay's review warned about (#2470's comment: a bucket
 *      moved without its manifests leaves the clip undeletable and silent)
 *      cannot happen on a road that does not move the bucket.
 *   2. **The key is still a credential**, so nothing may log it. `voiceService`'s
 *      failed-delete line logged the raw key; it logs the cast instead now. The
 *      relay's comment left that fix for this slice precisely because its right
 *      form depended on this decision.
 *
 * # ONE SPELLING, BECAUSE TWO WOULD DRIFT
 *
 * The room that plays the clip is a client module and the route that serves it
 * is a server one. The day both spell the path by hand is the day one of them
 * is edited (working law 4), so the path is written once, here.
 */

/** The family this route joins: `/api/cast/:castId/sheet`, `…/certificate`. */
export const VOICE_CLIP_PATH_PREFIX = "/api/cast";

/** The leaf. Named for what a customer hears, not for what is stored. */
export const VOICE_CLIP_PATH_LEAF = "voice-clip";

/**
 * The Express pattern the server mounts.
 *
 * ⚠ **A LITERAL, NOT A TEMPLATE OF THE TWO CONSTANTS ABOVE, AND THE READER IS
 * WHY.** The Atlas extracts Express surfaces from source without running it,
 * and its constant resolver handles `CONSTANT + "/:id"` — the shape
 * `inkDesignDelivery` and `referenceDelivery` use, and the named positive
 * control in `architectureExpressSurfaces.test.ts`. A template interpolating
 * two imported constants is a shape it has no reason to resolve, and an
 * unresolved registration lands in the Atlas as *"(defined by the router)"*,
 * which that same suite refuses.
 *
 * So the composition runs the other way and the duplication is held by a guard
 * rather than by care: `voiceClipDelivery.test.ts` asserts this literal equals
 * the parts, so editing either without the other reddens.
 */
export const VOICE_CLIP_ROUTE_PATTERN = "/api/cast/:castId/voice-clip";

/**
 * The address of one cast's kept clip, for the account that owns it.
 *
 * An ordinary authenticated app URL, never a storage URL — see the header for
 * what that does and does not buy.
 */
export function voiceClipPath(castId: string): string {
  return `${VOICE_CLIP_PATH_PREFIX}/${encodeURIComponent(castId)}/${VOICE_CLIP_PATH_LEAF}`;
}

/**
 * How many clip reads one account may make in a minute.
 *
 * A cast has at most ONE kept voice and the room draws one player, so an
 * ordinary visit is a single read; a customer walking their whole library is a
 * handful. Generous against that and still bounding what a loop can pull. Each
 * read is a bounded fetch of an object this account already owns, and the clip
 * is ~2.1 MB (measured, #2469) — so unlike the reference route's limit this one
 * is about BANDWIDTH as much as secrecy, and it is set lower for that reason.
 */
export const VOICE_CLIP_READS_PER_MINUTE = 60;

/** The one content type a kept clip is ever stored as (`mp3_44100_128`). */
export const VOICE_CLIP_CONTENT_TYPE = "audio/mpeg";
