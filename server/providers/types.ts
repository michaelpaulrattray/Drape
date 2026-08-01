/**
 * Provider boundary for Casting V2 (plan §E "Provider orchestration").
 *
 * Deliberately outside `server/castingV2/` so Wardrobe and Canvas can share it
 * later. Two rules give this layer its whole purpose:
 *
 *   1. Engine choice is server policy. Nothing provider-shaped — a name, a
 *      model id, a request id, a raw error — ever reaches a client projection
 *      (§J). Callers ask for a capability; they do not ask for a vendor.
 *   2. Outputs land through the storage authority before anything references
 *      them. Provider URLs are never persisted and never exposed.
 *
 * IMPLEMENTATION STATUS. The interfaces here are the ratified §E surface. Only
 * what the M3 calibration actually exercises is implemented:
 *
 *   implemented   CreativeEngine.generateCandidate      (GPT Image 2)
 *                 IdentityEngine.editWithReferences     (Nano Banana Pro)
 *                 IdentityEngine.generateView
 *                 Validator.judgeIdentity               (provisional, see below)
 *   deferred      IdentityEngine.generateTake           → M8
 *                 VoiceEngine                           → M8b
 *
 * Writing an interface against behaviour nobody has measured is the exact
 * failure this milestone's gate exists to prevent, so the deferred members are
 * typed but unimplemented, and M3's report records any amendment calibration
 * shows they need.
 */

/* ----------------------------------------------------------------- failures */

/**
 * Normalized failure taxonomy (§E). Every adapter maps its provider's errors
 * into exactly these, so retry policy, refunds and user-facing copy are written
 * once against a closed set rather than per vendor.
 */
export type ProviderFailureClass =
  /** Network, DNS, socket, 5xx — the request never got a verdict. */
  | "transport"
  /** Provider said slow down. */
  | "rate_limit"
  /** Our deadline expired. The provider may still be working. */
  | "timeout"
  /** The provider refused the content. Never retried — it will refuse again. */
  | "content_policy"
  /** The request asked for something this provider cannot do. */
  | "capability"
  /**
   * OUR account with the provider is unusable — no credit, bad key, suspended.
   *
   * Split out of `capability` because it is categorically different: nothing
   * about the request is wrong, every candidate after it will fail the same
   * way, and no user action can fix it. It surfaced as an exhausted fal
   * balance returning 403 on candidate after candidate, each one charged,
   * failed and refunded, while the sheet told the founder "didn't arrive".
   */
  | "provider_account"
  /** Unmapped. Treated as non-retryable so unknowns fail closed. */
  | "unknown";

/**
 * Retryability per class, stated once (§H.5). `content_policy` and `capability`
 * are terminal: retrying them burns budget to reach the same answer. `unknown`
 * is terminal on purpose — an unrecognised failure must fail closed rather than
 * spin.
 */
export const RETRYABLE_FAILURES: ReadonlySet<ProviderFailureClass> = new Set<ProviderFailureClass>([
  "transport",
  "rate_limit",
  "timeout",
]);

export function isRetryable(failure: ProviderFailureClass): boolean {
  return RETRYABLE_FAILURES.has(failure);
}

export class ProviderError extends Error {
  readonly failureClass: ProviderFailureClass;
  /** The provider's own reference, for support. Internal — never projected. */
  readonly providerRef?: string;
  /** Provider status code when there was one. Internal. */
  readonly status?: number;

  constructor(
    failureClass: ProviderFailureClass,
    message: string,
    options: { providerRef?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.failureClass = failureClass;
    this.providerRef = options.providerRef;
    this.status = options.status;
  }

  get retryable(): boolean {
    return isRetryable(this.failureClass);
  }
}

/* ------------------------------------------------------------- provenance */

/**
 * Pinned per artifact (D-12). Recorded on every generated row so a Cast can
 * always say which engine and which snapshot produced it — reproducibility
 * comes from provenance, not from pixel replay, because neither engine
 * documents a usable seed (§B-5).
 */
export type ProviderProvenance = {
  provider: "openrouter" | "fal" | "gemini" | "elevenlabs";
  /** The model slug as requested. */
  model: string;
  /** The snapshot the provider reported serving, when it reports one. */
  servedModel?: string;
  /** The provider's request id. Internal only. */
  providerRef?: string;
};

/** What every image-producing call returns. Bytes, never a provider URL. */
export type ImageResult = {
  bytes: Buffer;
  contentType: string;
  width?: number;
  height?: number;
  provenance: ProviderProvenance;
  /** Milliseconds from dispatch to bytes in hand. */
  latencyMs: number;
  /** Provider-reported cost when available; else our documented estimate. */
  estimatedCostUsd?: number;
};

/* ------------------------------------------------------------- capabilities */

export type CandidateRequest = {
  /** The compiled instruction. Internal — never leaves the server. */
  prompt: string;
  /** Portrait by default for sheet candidates (§H.10: 1K sheet). */
  size: `${number}x${number}`;
  quality: "low" | "medium" | "high";
  /** Abort signal so a cancelled roll stops dispatching. */
  signal?: AbortSignal;
};

export interface CreativeEngine {
  readonly id: string;
  generateCandidate(request: CandidateRequest): Promise<ImageResult>;
}

/**
 * The text stage (§E "Brief compiler"). One completion, one answer.
 *
 * Separate from the image engines because it is billed, queued and failed
 * differently: a text call costs a fraction of a cent and takes a second or
 * two, so it runs *before* the claim, where a failure is free. Nothing that
 * comes back from here is ever trusted — see `castingIntent.ts` for what
 * happens to it.
 */
export type TextRequest = {
  system: string;
  user: string;
  /** Ask the provider for a JSON object. A hint, never a guarantee. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export type TextResult = {
  text: string;
  provenance: ProviderProvenance;
  /** Milliseconds from dispatch to text in hand (M3 condition 4). */
  latencyMs: number;
  /**
   * TRUE when the provider stopped because it hit the token ceiling.
   *
   * The reply is then a fragment, and a fragment of JSON does not degrade to a
   * missing field — it fails the whole parse. Without this signal that failure
   * is indistinguishable from "the model returned nonsense", so a truncated
   * interpretation silently becomes "the brief said nothing" and every stated
   * lock is lost. A ceiling will always be a guess; whether we HIT it must not
   * be.
   */
  truncated?: boolean;
};

export interface TextEngine {
  readonly id: string;
  complete(request: TextRequest): Promise<TextResult>;
}

export type ReferenceImage = {
  bytes: Buffer;
  contentType: string;
};

export type IdentityEditRequest = {
  prompt: string;
  /** The signed anchor and any supporting plates. NBP accepts up to 14. */
  references: ReferenceImage[];
  /** 1K for candidates, 2K for signed package views (§H.10). */
  resolution: "1K" | "2K" | "4K";
  aspectRatio?: string;
  signal?: AbortSignal;
};

export interface IdentityEngine {
  readonly id: string;
  editWithReferences(request: IdentityEditRequest): Promise<ImageResult>;
  generateView(request: IdentityEditRequest & { viewAngle: string }): Promise<ImageResult>;
  /** Deferred to M8 — presentation-only generation off a signed snapshot. */
  generateTake?(request: IdentityEditRequest & { kind: "image" | "video" }): Promise<ImageResult>;
}

export type IdentityVerdict = {
  /** Whether the candidate reads as the same character as the anchor. */
  sameCharacter: boolean;
  /** 0–1. Comparable only within one scoring method — see `method`. */
  confidence: number;
  /** How this verdict was reached, so a score is never read as absolute. */
  method: string;
  /** Human-readable reasoning. Internal — never projected. */
  notes?: string;
};

export interface Validator {
  readonly id: string;
  /**
   * Judges an output against the signed anchor. Prompt compliance is never the
   * sole check (§I) — this is the second opinion that lets a view land.
   *
   * Provisional in M3: the calibration harness needs a scoring path to produce
   * likeness numbers at all, and the cohort-specific rubrics arrive with the
   * cohort registry in M9.
   */
  judgeIdentity(input: {
    anchor: ReferenceImage;
    candidate: ReferenceImage;
    cohortKey?: string;
    signal?: AbortSignal;
  }): Promise<IdentityVerdict>;
}

/**
 * Deferred to M8b. Typed here because §E ratifies the surface, unimplemented
 * because the transport is an open M3 question: whether prompt-based voice
 * *design* is reachable through Fal's ElevenLabs endpoints, or needs the direct
 * ElevenLabs API (no key is configured). If neither works at acceptable cost,
 * M8b drops from V2.0 and the room simply never renders a Voice card — the
 * honest-capability law (§I), not a greyed-out control.
 */
export interface VoiceEngine {
  readonly id: string;
  designVoice(input: { description: string; signal?: AbortSignal }): Promise<{
    providerVoiceRef: string;
    provenance: ProviderProvenance;
  }>;
  synthesizeAudition(input: {
    providerVoiceRef: string;
    text: string;
    signal?: AbortSignal;
  }): Promise<{ bytes: Buffer; contentType: string; provenance: ProviderProvenance }>;
}
