import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { captureCastingV2Enabled, captureCastingVoiceEnabled } from "../castingV2/castingV2Scope";
import { getOwnedCastByPublicId } from "../db/castingV2Sign";
import { readCastVoice } from "../db/castVoices";
import { designCastVoices, keepCastVoice, type VoiceRefusal } from "../castingV2/voiceService";
import {
  forgetVoiceDesign,
  rememberVoiceDesign,
  resolveVoiceDesignHandle,
} from "../castingV2/voiceDesignStore";
import { voiceClipPath } from "../../shared/voiceClipDelivery";

/**
 * THE VOICE CARD'S THREE PROCEDURES — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4/§5/§6.
 *
 * Slice 1 built the road and deliberately shipped no procedure: *"a procedure
 * with no caller is a surface that exists without a design pass over it, and
 * the surface is his approved Desk design, which is N4b-2's work"*
 * (`voiceService.ts`). This is that surface's entrance, and nothing more than
 * its entrance — every provider step, every refusal and every spend decision
 * is already in the service, and these three procedures add no rule of their
 * own about the voice.
 *
 * # WHERE THE THREE PROCEDURES ARE DECLARED, AND WHY IT IS NOT HERE
 *
 * They are `castingV2.voice.status`, `.design` and `.keep`, and the
 * `protectedProcedure` declarations sit in `castingV2.ts` beside `inkRouter`,
 * `conceptRouter` and `referenceRouter`. **This file holds the work each one
 * does**, as three plain functions, so the logic stays its own slice.
 *
 * ⚠ **ONE TIDIER SPELLING WAS TRIED FIRST AND IT IS WRONG:
 * `...castingVoiceRouter._def.procedures` spread into `castingV2`** — the
 * attested pattern (`generation/index.ts` is built entirely out of it, and
 * CLAUDE.md's public list notes the consequence for ids). It **loses the
 * procedure types**: the spread widens every member to a union of query and
 * mutation, so `trpc.castingV2.voice.status.useQuery` stops existing on the
 * client. Nothing calls `generation.*` from the client with hooks, which is why
 * that has never bitten there — this surface is a client one, so it cannot use
 * that road.
 *
 * ⚠ **AND A CLAIM THAT STOOD HERE FOR AN HOUR WAS FALSE, SO THE MEASUREMENT
 * REPLACES IT RATHER THAN THE CONCLUSION.** It said `voice: castingVoiceRouter`
 * — the router declared in this file and referenced from `castingV2.ts` — was
 * *"invisible to the capability atlas"*, on the strength of
 * `static.procedures` holding 40 ids with none of the three. **That reading was
 * taken from a capability atlas built on a STALE architecture atlas**: the
 * capability map does not extract procedures at all, it reads them out of
 * `docs/architecture/drape-architecture.json` (`declaredCastingProcedures`), and
 * that file had not been regenerated. Law 1, in the direction it is easiest to
 * fall: a derived artifact read as if it were the tree.
 *
 * **Driven afterwards, both forms, each with the architecture atlas regenerated
 * first: the walker sees BOTH.** An imported router reference resolves to
 * `castingV2.<name>.status|design|keep` exactly as a same-file const does. So
 * the choice between them is style and not visibility, and the shape below is
 * chosen for the plainest reason: it is what `ink`, `concept` and `reference`
 * already do four lines away.
 *      Re-imagine sat off the map for three weeks the same way, green
 *      throughout.
 *
 * # ⚠ A REFUSAL COMES BACK IN THE RESULT, AND INVARIANT 6 IS WHY — read it
 *
 * Invariant 6's words are *"Rate limits return a real `TOO_MANY_REQUESTS`, not
 * a 200 carrying an error field **the client cannot distinguish from a
 * validation failure**"*. The operative clause is the last one, and it is what
 * decides the split here:
 *
 *   · **What throws**: the rate limits (a real `TOO_MANY_REQUESTS`, as
 *     everywhere else in this router), the scope being shut
 *     (`PRECONDITION_FAILED`), and a cast this account cannot touch
 *     (`NOT_FOUND`). None of those is a fact about a voice.
 *   · **What comes back in the result**: every member of {@link VoiceRefusal},
 *     as a discriminated `{ ok: false, refusal }`. A refusal key is strictly
 *     MORE distinguishable than an exception message — the client picks §6's
 *     sentence by the key and never by parsing prose
 *     ([[spelling-not-meaning]]'s class) — and the service's own docblock
 *     already describes its result that way: *"The caller gets a discriminated
 *     result it can tell apart from success and from a validation failure; the
 *     customer-facing words are §6's and are N4b-2's to render."*
 *
 * **The simpler road, named because the fidelity law asks for it**: throwing a
 * `TRPCError` per refusal and letting the client read `error.message`. Declined
 * — it makes the customer's sentence a function of a server string, which is
 * the one thing `shared/voiceCardCopy.ts` exists to prevent, and it would put
 * two mechanisms behind one outcome the client handles identically.
 *
 * # NOTHING IS CHARGED HERE, AND THAT IS THIS SLICE'S SHAPE
 *
 * The card's own bullet is a **placeholder** price, and #2471 is *"the real
 * price"*. So there is no credit spend on either mutation, no `creditSpend`
 * call, and — see the client — **no number on the button**: a price drawn
 * beside a press that charges nothing is a false promise, and a placeholder
 * figure is exactly the *"number nobody can act on"* the
 * disappearing-technology law's third question forbids. What paces the house
 * spend meanwhile is the limiter, which is why both buckets are new and stated.
 *
 * ⚠ **When the price arrives it arrives WITH the charge** (the relay's
 * requirement on this card: *"Make new voices 125 ledger and Keep 500 ledger
 * (#2471), with an atomic charge and a refund on failure"*).
 */

/** One cast's public KI id, the same shape every other cast procedure takes. */
const castIdInput = z.string().min(1).max(32);

/** A handle out of {@link rememberVoiceDesign} — `randomUUID`'s own shape. */
const designHandle = z.string().uuid();

function enforce(userId: number, config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]): void {
  const check = checkRateLimit(`user:${userId}`, config);
  if (!check.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(check.resetIn) });
  }
}

/**
 * The two gates every voice procedure passes, in this order.
 *
 * `CASTING_VOICE_SCOPE` is a child of `CASTING_V2_SCOPE` and the boot fence
 * already refuses a child reaching past its parent, so checking both here is
 * not belt-and-braces about configuration — it is that a customer outside
 * casting altogether should meet casting's own sentence rather than a voice
 * one.
 */
function requireVoiceRoad(userId: number): void {
  if (!captureCastingV2Enabled(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Casting is not available for this account yet.",
    });
  }
  if (!captureCastingVoiceEnabled(userId)) {
    /*
      Dark. `voiceStatus` answers `available: false` instead of throwing, so the
      card draws nothing at all (the `PublicCheckCard` precedent); the two
      MUTATIONS throw, because reaching one while dark means a client built
      against a surface that is not open, not a customer meeting a state.
    */
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Voice is not available for this account yet.",
    });
  }
}

/** The owned, live, signed cast behind a public id, or the same 404 for all. */
async function requireCast(userId: number, castId: string) {
  const model = await getOwnedCastByPublicId(userId, castId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "That character isn't here." });
  return model;
}


/* ---------------------------------------------------------------- the inputs.

   Exported so the procedure declarations in `castingV2.ts` are thin — the
   shape a caller must send is a fact about this road, and it belongs beside
   the function that reads it rather than being written out again at the
   mounting point (working law 4). Every one is `.strict()` (invariant 4). */

export const voiceCastInput = z.object({ castId: castIdInput }).strict();
export const voiceKeepInput = z.object({
  castId: castIdInput,
  designId: z.string().uuid(),
  handle: designHandle,
}).strict();

/**
 * WHAT THE VOICE CARD DRAWS BEFORE ANYTHING IS PRESSED.
 *
 * Three facts and no creative content: whether this road is open at all,
 * whether there is a line to make voices from, and whether a voice is already
 * kept. The voice LINE itself is not returned — the room already has it from
 * `getCast`, and a second copy is the drift working law 4 names.
 *
 * ⚠ **It returns the clip's PATH and never a storage URL.** The path is an
 * authenticated app address (`shared/voiceClipDelivery.ts`); the storage key
 * stays on the server, because on a public bucket that key is the credential.
 */
export async function readVoiceCardStatus(input: { userId: number; castId: string }) {
  if (!captureCastingV2Enabled(input.userId) || !captureCastingVoiceEnabled(input.userId)) {
    /* Dark: the card draws nothing at all rather than an empty voice panel
       (the `PublicCheckCard` precedent). */
    return { available: false as const, hasLine: false, kept: null };
  }
  enforce(input.userId, RATE_LIMITS.castingRead);
  const model = await requireCast(input.userId, input.castId);
  const kept = await readCastVoice(input.userId, model.id);
  return {
    available: true as const,
    hasLine: Boolean(model.voice && model.voice.trim().length > 0),
    kept: kept
      ? {
          clipPath: voiceClipPath(input.castId),
          byteSize: kept.clipBytes,
          keptAt: kept.keptAt,
        }
      : null,
  };
}

/**
 * THE CAST'S WORDS BECOME THREE VOICES TO LISTEN TO.
 *
 * ⚠ **The audio comes back in the result and gets no address at all.** The
 * three MP3s are base64 here; there is no key, no object, no route and no row
 * for a preview, which is strictly more private than an owner-only address and
 * is why the owner-only route this card adds serves the kept clip alone.
 * `server/castingV2/voiceDesignStore.ts` carries the full reading, including
 * what is lost on a reload and why that was chosen.
 *
 * ⚠ **The provider's own preview id is NOT in this result.** It is internal
 * (`VoicePreview`'s own rule), so each voice answers to an opaque handle and
 * only the server can turn one back into a provider id.
 */
export async function designVoicesForCard(input: { userId: number; castId: string }) {
  requireVoiceRoad(input.userId);
  enforce(input.userId, RATE_LIMITS.castingVoiceDesign);
  const model = await requireCast(input.userId, input.castId);

  const result = await designCastVoices({ userId: input.userId, modelId: model.id });
  if (!result.ok) return { ok: false as const, refusal: result.refusal };

  const { designId, handles } = rememberVoiceDesign({
    userId: input.userId,
    modelId: model.id,
    designSentence: result.designSentence,
    previewIds: result.previews.map((preview) => preview.previewId),
  });

  return {
    ok: true as const,
    designId,
    voices: result.previews.map((preview, index) => ({
      handle: handles[index],
      /* Base64 rather than a binary body: this is a tRPC result, and the client
         turns it straight into a blob to play. ~250 KB a voice, measured
         (design §3). */
      audioBase64: preview.bytes.toString("base64"),
      contentType: preview.contentType,
      durationSeconds: preview.durationSeconds ?? null,
    })),
  };
}

/**
 * KEEP — this one is the cast's voice from now on.
 *
 * The three provider steps, the live allowance read before any spend, and the
 * owned-live-signed proof inside the INSERT are all the service's
 * (`keepCastVoice`). What this adds is only the handle→provider-id resolution,
 * and it adds one rule with it:
 *
 * ⚠ **THE DESIGN SENTENCE COMES FROM THE STORE, NEVER FROM THE CLIENT.** It is
 * stored beside the clip as the words the voice was made from (design §4), so a
 * client-supplied sentence could make that record say the voice came from words
 * it did not come from. The line can also have been edited between the design
 * and this press — and the design's §9 is explicit that editing the line does
 * not change a kept voice.
 */
export async function keepVoiceForCard(input: {
  userId: number;
  castId: string;
  designId: string;
  handle: string;
}) {
  requireVoiceRoad(input.userId);
  enforce(input.userId, RATE_LIMITS.castingVoiceKeep);
  const model = await requireCast(input.userId, input.castId);

  const resolved = resolveVoiceDesignHandle({
    userId: input.userId,
    modelId: model.id,
    designId: input.designId,
    handle: input.handle,
  });
  if (!resolved) {
    /*
      The handle expired, was never ours, or belongs to another cast. The
      customer-facing answer is the same as a failed design — make them again —
      because that is the only thing that can be done about it, and the three
      cases must not be told apart to a caller holding a handle it should not
      have.
    */
    return { ok: false as const, refusal: "provider_failed" as VoiceRefusal };
  }

  const result = await keepCastVoice({
    userId: input.userId,
    modelId: model.id,
    previewId: resolved.previewId,
    designSentence: resolved.designSentence,
  });
  if (!result.ok) return { ok: false as const, refusal: result.refusal };

  /* The other two voices of this design can never be kept now — one voice per
     cast — so the handles are dropped rather than left resolvable. */
  forgetVoiceDesign(input.designId);

  return {
    ok: true as const,
    clipPath: voiceClipPath(input.castId),
    byteSize: result.clipBytes,
  };
}
