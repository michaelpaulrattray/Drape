/**
 * THE VOICE ROAD — N4b-1 (#2469), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4/§5.
 *
 * Two entrances, and the whole of slice 1:
 *
 *   · {@link designCastVoices} — the cast's written voice line becomes three
 *     voices to listen to. Spends no voice operation.
 *   · {@link keepCastVoice} — the chosen one becomes the cast's voice: saved,
 *     recorded reading the house passage, and the clip stored beside the line
 *     it was made from. **One voice operation and one slot.**
 *
 * **No UI reaches either of them yet.** Slice 1 is the road; N4b-2 is the Voice
 * card that walks it. There is no tRPC procedure here on purpose — a procedure
 * with no caller is a surface that exists without a design pass over it, and
 * the surface is his approved Desk design, which is N4b-2's work.
 *
 * # EVERY REFUSAL IS A MEMBER OF A CLOSED SET, AND EVERY ONE REFUSES
 *
 * {@link VoiceRefusal} is the whole vocabulary. Two rules it exists to keep:
 *
 *   · **It is never a 200 carrying a message** (invariant 6). The caller gets a
 *     discriminated result it can tell apart from success and from a validation
 *     failure; the customer-facing words are §6's and are N4b-2's to render.
 *   · ⚠ **It refuses when the quota read FAILS, and that is the arm most worth
 *     having** (invariant 7: a control that cannot answer must not wave the
 *     request through). A Keep that could not read the allowance has no idea
 *     whether a save would be the one that exceeds the account's month, and in
 *     slice 2 that press carries a price.
 *
 * # NOTHING HERE IS HARD-CODED ABOUT THE PLAN
 *
 * Neither ceiling is a constant anywhere in this product, and #2469's own
 * correction is why: the card was filed against a 3-slot account and told a
 * builder to refuse *"when three slots are full"*. His plan was upgraded the
 * same day to 30 slots, so that refusal would have shipped refusing a Keep with
 * 27 free. The allowance is read live, immediately before the spend.
 */
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

import { ProviderError } from "../providers/types";
import {
  voiceOperationsAvailable,
  voiceSlotsAvailable,
  type VoiceAllowance,
  type VoiceEngine,
} from "../providers/voiceTypes";
import { createElevenLabsVoiceEngine } from "../providers/elevenlabsVoice";
import { captureCastingVoiceEnabled } from "./castingV2Scope";
import {
  VOICE_AUDITION_PASSAGE,
  VOICE_AUDITION_PASSAGE_VERSION,
  VOICE_PREVIEW_TEXT,
} from "./voiceAuditionPassage";
import { insertCastVoice, readCastVoice, readCastVoiceLine } from "../db/castVoices";
import { storageDelete, storagePut } from "../storage";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/voiceService");

/**
 * The closed refusal set. Each is a different thing to say to a customer and a
 * different thing for the house to do about it.
 */
export type VoiceRefusal =
  /** The voice road is not open for this account. */
  | "voice_off"
  /** Not this owner's, not live, or not signed — one answer for all three. */
  | "cast_not_available"
  /** The cast has no written voice line to make a voice from. */
  | "no_voice_line"
  /** The line is shorter than the engine can design from. */
  | "voice_line_too_short"
  /** This cast already has a kept voice (slice-1 scaffolding — see the header). */
  | "already_kept"
  /** The allowance could not be read, so nothing is spent. Invariant 7. */
  | "allowance_unreadable"
  /** The account's voice operations for this period are spent. */
  | "no_operations_left"
  /** Every saved-voice slot the plan allows is occupied. */
  | "no_slots_left"
  /** The provider failed. The class is internal; the customer gets §6's words. */
  | "provider_failed";

export type VoiceDesignResult =
  | {
      ok: true;
      /** Three, measured — the engine settles the count (design §1). */
      previews: Array<{ previewId: string; bytes: Buffer; contentType: string; durationSeconds?: number }>;
      /** The line these were made from, to be stored verbatim by a later Keep. */
      designSentence: string;
      latencyMs: number;
    }
  | { ok: false; refusal: VoiceRefusal; failureClass?: string };

export type VoiceKeepResult =
  | {
      ok: true;
      clipStorageKey: string;
      clipSha256: string;
      clipBytes: number;
      clipContentType: string;
      passageVersion: number;
      /** The allowance BEFORE the save and AFTER it — the receipt's two reads. */
      allowanceBefore: VoiceAllowance;
      saveLatencyMs: number;
      speakLatencyMs: number;
    }
  | { ok: false; refusal: VoiceRefusal; failureClass?: string };

/**
 * Where a clip's bytes live. A random UUID under a voice prefix, so the key is
 * unguessable — every `storagePut` writer in this product uses
 * `crypto.randomUUID()` and a repository-wide guard refuses `Math.random()` in
 * one.
 *
 * ⚠ **THE KEY IS NOT A PERMISSION, AND THIS CLIP IS WHY THAT MATTERS MORE HERE
 * THAN FOR A PICTURE.** `server/storage.ts` writes to a PUBLIC bucket and its
 * URLs never expire, so anything there is protected only by its key being hard
 * to guess — and ninety seconds of a voice is a cloning source. Slice 1 never
 * projects this key and no route serves it; the owner-only route and the
 * decision on whether these bytes belong in the private evidence bucket instead
 * both ride N4b-2, which is where the design puts them. **Until then the only
 * thing that can read a clip is this server.**
 */
function voiceClipKey(userId: number, modelId: number): string {
  return `casting/voices/${userId}/${modelId}/${randomUUID()}.mp3`;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Injectable for the drivers; production always gets the real transport. */
export type VoiceServiceDeps = { engine?: VoiceEngine };

function engineFor(deps: VoiceServiceDeps | undefined): VoiceEngine {
  return deps?.engine ?? createElevenLabsVoiceEngine();
}

/**
 * The cast's words → three voices.
 *
 * ⚠ **The previews are returned in process and nothing stores them.** The
 * design asks for the three to be held under the cleanup-manifest pattern so a
 * RELOAD does not lose a paid design — a reload is a browser event, so that
 * belongs with the surface that can have one (N4b-2). Stated rather than
 * silently skipped: in slice 1 a design's previews live exactly as long as the
 * call that made them.
 */
export async function designCastVoices(
  input: { userId: number; modelId: number; signal?: AbortSignal },
  deps?: VoiceServiceDeps,
): Promise<VoiceDesignResult> {
  if (!captureCastingVoiceEnabled(input.userId)) return { ok: false, refusal: "voice_off" };

  const cast = await readCastVoiceLine(input.userId, input.modelId);
  if (!cast) return { ok: false, refusal: "cast_not_available" };
  const designSentence = (cast.voice ?? "").trim();
  if (designSentence.length === 0) return { ok: false, refusal: "no_voice_line" };

  try {
    const { previews, latencyMs } = await engineFor(deps).designVoices({
      description: designSentence,
      previewText: VOICE_PREVIEW_TEXT,
      signal: input.signal,
    });
    return { ok: true, previews, designSentence, latencyMs };
  } catch (error) {
    if (error instanceof ProviderError) {
      /*
        The engine's own floor on a description is a refusal the CUSTOMER can
        act on ("your words are too short"), which is a different thing to say
        from "the voice studio is having trouble" — so it is separated here
        rather than folded into `provider_failed`.
      */
      if (error.failureClass === "capability" && /characters to design from/.test(error.message)) {
        return { ok: false, refusal: "voice_line_too_short" };
      }
      log.warn({ failureClass: error.failureClass, status: error.status }, "[Voice] design refused");
      return { ok: false, refusal: "provider_failed", failureClass: error.failureClass };
    }
    throw error;
  }
}

/**
 * KEEP — the three provider steps of the design's §4, in its order, and Keep is
 * not done until all three are.
 *
 *   1. **Save** the chosen preview to a slot (one voice operation).
 *   2. **Record** the audition: the saved voice reads the house passage.
 *   3. **Store** the clip with its sha256 beside the line it was made from.
 *
 * ⚠ **THE ALLOWANCE IS READ BEFORE STEP 1 AND NOTHING IS SPENT BEFORE IT
 * ANSWERS.** Read before, and again after, so a receipt can show the counter
 * actually moving — which is how this road proves it spends what it says it
 * spends rather than asserting it.
 *
 * ⚠ **AND THE LAST ACT IS THE WRITE, WHICH CAN STILL LOSE.** The insert proves
 * the cast is the owner's live signed cast in the statement itself, because
 * steps 1–3 take tens of seconds and the cast can be deleted inside them. When
 * the write loses, the slot is RELEASED and the stored object DELETED before
 * returning: a Keep that did not land must not leave a slot occupied out of the
 * account's plan nor bytes nothing will ever collect. The voice OPERATION is
 * not refundable (measured), and that is reported rather than hidden.
 */
export async function keepCastVoice(
  input: {
    userId: number;
    modelId: number;
    previewId: string;
    /** The line the previews were designed from, as it read then. */
    designSentence: string;
    signal?: AbortSignal;
  },
  deps?: VoiceServiceDeps,
): Promise<VoiceKeepResult> {
  if (!captureCastingVoiceEnabled(input.userId)) return { ok: false, refusal: "voice_off" };

  const cast = await readCastVoiceLine(input.userId, input.modelId);
  if (!cast) return { ok: false, refusal: "cast_not_available" };

  const existing = await readCastVoice(input.userId, input.modelId);
  if (existing) return { ok: false, refusal: "already_kept" };

  const engine = engineFor(deps);

  let allowanceBefore: VoiceAllowance;
  try {
    allowanceBefore = await engine.readAllowance({ signal: input.signal });
  } catch (error) {
    /*
      ⚠ A FAILED READ REFUSES. It is tempting to let the save through and let the
      provider's own 4xx be the ceiling — that is the shape invariant 7 forbids,
      and here it would also charge a customer in slice 2 for a press we already
      knew we could not honour.
    */
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] allowance unreadable — Keep refused before any spend");
    return { ok: false, refusal: "allowance_unreadable", failureClass };
  }

  if (!voiceOperationsAvailable(allowanceBefore)) {
    return { ok: false, refusal: "no_operations_left" };
  }
  if (!voiceSlotsAvailable(allowanceBefore)) {
    /*
      Declared scaffolding (design §4): with no eviction yet, a full plan
      refuses. N4b-4 replaces this with least-recently-used eviction once his
      ear has passed the re-mint court — the court decides whether eviction is
      allowed at all, so this refusal is not a placeholder for a decision
      already made.
    */
    return { ok: false, refusal: "no_slots_left" };
  }

  let voiceId: string;
  let saveLatencyMs: number;
  try {
    const saved = await engine.saveVoice({
      previewId: input.previewId,
      /* OUR name, internal, and deliberately not the cast's: a provider-side
         label is one more place a customer's naming could travel. */
      name: `klieg-${input.userId}-${input.modelId}`,
      description: input.designSentence,
      signal: input.signal,
    });
    voiceId = saved.voiceId;
    saveLatencyMs = saved.latencyMs;
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    const billed = error instanceof ProviderError && error.completed;
    log.warn({ failureClass, billed }, "[Voice] save refused");
    return { ok: false, refusal: "provider_failed", failureClass };
  }

  let clipBytes: Buffer;
  let clipContentType: string;
  let speakLatencyMs: number;
  try {
    const spoken = await engine.speak({
      voiceId,
      text: VOICE_AUDITION_PASSAGE,
      signal: input.signal,
    });
    clipBytes = spoken.bytes;
    clipContentType = spoken.contentType;
    speakLatencyMs = spoken.latencyMs;
  } catch (error) {
    /* The save already spent an operation; the SLOT is at least recoverable. */
    await releaseSlotQuietly(engine, voiceId);
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.warn({ failureClass }, "[Voice] audition refused — slot released");
    return { ok: false, refusal: "provider_failed", failureClass };
  }

  const clipStorageKey = voiceClipKey(input.userId, input.modelId);
  const clipSha256 = sha256(clipBytes);
  try {
    await storagePut(clipStorageKey, clipBytes, clipContentType);
  } catch (error) {
    await releaseSlotQuietly(engine, voiceId);
    log.error({ err: error }, "[Voice] clip storage failed — slot released");
    return { ok: false, refusal: "provider_failed", failureClass: "transport" };
  }

  const written = await insertCastVoice({
    userId: input.userId,
    modelId: input.modelId,
    designSentence: input.designSentence,
    voiceId,
    clipStorageKey,
    clipSha256,
    clipBytes: clipBytes.byteLength,
    clipContentType,
    passageVersion: VOICE_AUDITION_PASSAGE_VERSION,
  });
  if (!written.inserted) {
    /*
      The cast went away inside the three provider steps, or a second Keep won
      the unique index. Either way this Keep owns nothing: release the slot and
      delete the bytes. The voice OPERATION stays spent — a delete refunds none
      (measured) — which is a real cost of a lost race and is logged as one
      rather than being quietly absorbed.
    */
    await releaseSlotQuietly(engine, voiceId);
    await deleteClipQuietly(clipStorageKey);
    log.warn(
      { modelId: input.modelId },
      "[Voice] Keep lost its write — slot and clip released, one voice operation spent",
    );
    return { ok: false, refusal: "cast_not_available" };
  }

  return {
    ok: true,
    clipStorageKey,
    clipSha256,
    clipBytes: clipBytes.byteLength,
    clipContentType,
    passageVersion: VOICE_AUDITION_PASSAGE_VERSION,
    allowanceBefore,
    saveLatencyMs,
    speakLatencyMs,
  };
}

/**
 * Release a provider slot, best effort.
 *
 * ⚠ **A FAILURE HERE NEVER FAILS THE CALLER**, and the reasoning is the same on
 * every road that uses it: the thing at stake is one slot of OUR plan, and the
 * caller is either already refusing (where a second error would hide the first)
 * or deleting a customer's cast (where a vendor outage must not block an
 * erasure). An orphaned slot is logged with its id so it can be swept by hand;
 * silence is what this must not do.
 */
export async function releaseSlotQuietly(engine: VoiceEngine, voiceId: string): Promise<boolean> {
  try {
    await engine.deleteVoice({ voiceId });
    return true;
  } catch (error) {
    const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
    log.error(
      { failureClass, voiceId },
      "[Voice] a saved voice could not be released — this slot is now orphaned on the account",
    );
    return false;
  }
}

async function deleteClipQuietly(storageKey: string): Promise<void> {
  try {
    await storageDelete(storageKey);
  } catch (error) {
    log.error({ err: error, storageKey }, "[Voice] an unclaimed clip could not be deleted");
  }
}

/**
 * THE DELETION'S PROVIDER HALF — release every slot a cast's voices hold.
 *
 * Called by the deletion road with facts it read BEFORE its transaction, since
 * the transaction is about to remove the rows that name them. Returns what
 * happened per voice so a receipt can say it; never throws.
 */
export async function releaseVoiceSlots(
  voices: ReadonlyArray<{ voiceId: string | null }>,
  deps?: VoiceServiceDeps,
): Promise<{ attempted: number; released: number; orphaned: number }> {
  const resident = voices.filter((voice): voice is { voiceId: string } => Boolean(voice.voiceId));
  if (resident.length === 0) return { attempted: 0, released: 0, orphaned: 0 };
  const engine = engineFor(deps);
  let released = 0;
  for (const voice of resident) {
    if (await releaseSlotQuietly(engine, voice.voiceId)) released += 1;
  }
  return { attempted: resident.length, released, orphaned: resident.length - released };
}
