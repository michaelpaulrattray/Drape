/**
 * THE VOICE BOUNDARY — N4b-1 (#2469), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §3/§4/§5.
 *
 * `types.ts` has carried a `VoiceEngine` interface since M3, deferred to M8b
 * and written against behaviour nobody had measured. Its own docblock said so
 * in as many words — *"writing an interface against behaviour nobody has
 * measured is the exact failure this milestone's gate exists to prevent"* — and
 * it was right: **the spike measured an engine that does not fit that shape**,
 * in two ways that decide how the whole road is built.
 *
 *   1. **A design returns THREE previews, not one voice.** The old
 *      `designVoice` returned a single `providerVoiceRef`, so a caller written
 *      against it could not offer a choice at all — and the choice by ear is
 *      the entire feature (#2140, *"Listen and pick"*).
 *   2. **A preview cannot speak until it is SAVED.** `POST
 *      /v1/text-to-speech/{generated_voice_id}` answers **404
 *      `voice_not_found`** for a preview id (measured). So `synthesizeAudition`
 *      taking a `providerVoiceRef` straight from a design was a call that could
 *      only ever fail, and Keep is irreducibly two provider steps: save, then
 *      speak.
 *
 * So the deferred interface is REPLACED rather than extended, and it lives here
 * rather than in `types.ts` because that file is `import type` only — this one
 * carries a real error class and the allowance shape a road reads before it
 * spends. The old declaration is struck in place there, with a pointer to this
 * file, so nobody re-implements the shape that cannot work.
 *
 * # WHAT IS SCARCE, AND WHY A ROAD MUST ASK BEFORE IT SPENDS
 *
 * Two different ceilings, and they fail in different directions (§5):
 *
 *   - **Voice operations a month** (`max_voice_add_edits`). Every SAVE and
 *     every clone spends one; a design spends none; **a delete refunds none**
 *     (measured — the counter stayed put). This is the real scarcity, and it is
 *     per ACCOUNT, not per customer.
 *   - **Voice slots** (`voice_limit`). A save occupies one; a delete frees it.
 *     A cache, not a ledger.
 *
 * ⚠ **BOTH ARE READ LIVE AND NEITHER IS EVER HARD-CODED** — the relay's rule on
 * PR #2468, and #2469's own correction records what hard-coding cost before a
 * line of this was written: the card was filed with a 3-slot account's figures
 * and told a builder to refuse a Keep *"when three slots are full"*. His plan
 * was upgraded the same day to **30** slots, so that refusal would have shipped
 * refusing a Keep with 27 free. A plan can change under us between two deploys;
 * a number in our source cannot.
 */
import type { ProviderError } from "./types";

/**
 * What one design call produced. The id is the provider's and is INTERNAL — it
 * never reaches a client projection (§E rule 1, and the
 * disappearing-technology law's *no engine name on a path someone must walk*).
 */
export type VoicePreview = {
  /** The provider's `generated_voice_id`. Internal. Cannot speak until saved. */
  previewId: string;
  bytes: Buffer;
  contentType: string;
  /** Seconds of audio, when the provider reports it. */
  durationSeconds?: number;
};

/** What the account has left. Read before any spend, never cached. */
export type VoiceAllowance = {
  /** `voice_limit` — how many saved voices the plan allows at once. */
  slotsTotal: number;
  /** `voice_slots_used`. */
  slotsUsed: number;
  /** `max_voice_add_edits` — saves and clones permitted this period. */
  operationsTotal: number;
  /** `voice_add_edit_counter`. */
  operationsUsed: number;
  /**
   * `can_use_instant_voice_cloning`. N4b-4's eviction and re-mint (#2472) read
   * it LIVE before evicting anything: on a plan without it an evicted voice
   * could never be cloned back, so nothing is evicted and a full plan refuses.
   */
  instantCloning: boolean;
  /** The plan's own name. Internal, for a receipt — never a customer string. */
  tier: string;
};

/** Is there room for one more save? Asked of a LIVE reading, never of a constant. */
export function voiceSlotsAvailable(allowance: VoiceAllowance): boolean {
  return allowance.slotsUsed < allowance.slotsTotal;
}

/** Is there a voice operation left this period? Same rule. */
export function voiceOperationsAvailable(allowance: VoiceAllowance): boolean {
  return allowance.operationsUsed < allowance.operationsTotal;
}

/**
 * The engine, as measured.
 *
 * Every member returns bytes or an internal id and never a provider URL
 * (§E rule 2). Every failure arrives as a {@link ProviderError} so one retry
 * and refusal policy is written against a closed taxonomy rather than per
 * vendor.
 */
export interface VoiceEngine {
  readonly id: string;

  /**
   * The account's two ceilings, read live. Free — one GET, no generation.
   *
   * A road calls this BEFORE it saves, and a FAILED read refuses the save
   * rather than allowing it (invariant 7: a control that cannot answer must
   * not wave the request through).
   */
  readAllowance(input?: { signal?: AbortSignal }): Promise<VoiceAllowance>;

  /**
   * Words → three voices to listen to. Spends no voice operation (measured:
   * the counter read 0 after the first design and 1 after the first save).
   */
  designVoices(input: {
    /** The cast's voice line, verbatim — the customer's own words. */
    description: string;
    /**
     * What the previews read aloud — the house passage's opening.
     *
     * ⚠ **REQUIRED, AND IT WAS OPTIONAL UNTIL IT WAS DRIVEN.** The provider
     * answers **400 `"You need to provide either 'text' or
     * 'auto_generate_text'"`** when it is absent (measured at the wire,
     * 2026-10-13, both arms: omitted → 400, present → 200 with three
     * previews). The service always sends it, so no shipped road could reach
     * that 400 — which is exactly why it had to be found by driving rather
     * than by reading, and why it is closed here rather than noted: the next
     * caller is N4b-2's *"Make new voices from this text"*, and an optional
     * field the engine actually requires hands them a runtime refusal where a
     * typecheck error belongs.
     */
    previewText: string;
    signal?: AbortSignal;
  }): Promise<{ previews: VoicePreview[]; latencyMs: number }>;

  /**
   * Keep: the chosen preview becomes a saved voice. **One voice operation and
   * one slot.** The name is ours and internal.
   */
  saveVoice(input: {
    previewId: string;
    name: string;
    description: string;
    signal?: AbortSignal;
  }): Promise<{ voiceId: string; latencyMs: number }>;

  /** A saved voice reads a line. Spends characters, not voice operations. */
  speak(input: {
    voiceId: string;
    text: string;
    signal?: AbortSignal;
  }): Promise<{ bytes: Buffer; contentType: string; latencyMs: number }>;

  /**
   * Release the slot. **Refunds no voice operation** (measured), so this is a
   * cache eviction and never an undo of a spend.
   */
  deleteVoice(input: { voiceId: string; signal?: AbortSignal }): Promise<void>;

  /**
   * RE-MINT — N4b-4 (#2472): a voice made back from its stored audition clip by
   * instant cloning. **One voice operation and one slot**, like a save.
   *
   * This is what makes a slot a cache rather than the voice itself: the clip
   * is the durable asset, and a voice evicted from its slot is cloned back from
   * it the next time something is about to speak with it. His ear passed the
   * re-mint court on 2026-10-13, verbatim: *"remint actually sounds better in
   * some cases both 90s clips were great though."*
   *
   * Needs {@link VoiceAllowance.instantCloning}; a caller checks that on a
   * LIVE reading before it evicts anything, because an evicted voice on a plan
   * that cannot clone could never come back.
   */
  cloneVoice(input: {
    /** OUR name, internal — never the cast's. */
    name: string;
    /** The stored audition clip's bytes. */
    bytes: Buffer;
    contentType: string;
    signal?: AbortSignal;
  }): Promise<{ voiceId: string; latencyMs: number }>;
}
