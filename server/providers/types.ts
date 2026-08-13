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
  /**
   * The provider SUCCEEDED, and what it returned is not a photograph of one
   * person (D-93).
   *
   * The odd one out in this union, and deliberately here rather than on an axis
   * of its own. Every other class answers "did the provider fail"; this one
   * answers "did it succeed at producing garbage" — the only paid failure the
   * product could not see, because nothing ever looked at the bytes. D-93 ruled
   * it routes through this taxonomy precisely so it needs no new money path:
   * the existing settlement already fails the candidate and refunds its slice.
   *
   * Non-retryable. A contact sheet is a verdict about what came back, not a
   * transport hiccup; re-rolling it is the user's decision and their money.
   */
  | "render_fault"
  /**
   * The provider succeeded, the picture is HEALTHY, and a fact the record
   * states is not in it (D-188).
   *
   * Split from `render_fault` because the receipt is the record. Both refuse
   * and both refund, but a verification refusal wearing the damage class wrote
   * *"the image came back damaged"* on eight ledger rows for renders that were
   * not damaged at all — and the first person to read those rows reported them
   * to the founder as provider damage. A refund line that misdescribes what
   * happened is a support conversation nobody can resolve from the record.
   *
   * Non-retryable at the provider layer: the retry that mattered already
   * happened, and a third attempt at the same prompt is not a different
   * request.
   */
  | "facts_missing"
  /**
   * The provider succeeded, the picture it returned was fine, and OUR
   * compositor cut it (2026-08-08).
   *
   * Third split for the same reason as the two above: the receipt is the
   * record. `render_fault` says "the image came back damaged", which about a
   * provider that did nothing wrong is the mistake `facts_missing` was split
   * out to stop, one layer further in — and this time the damage is ours, so a
   * support conversation that blames the vendor is worse than useless.
   *
   * Origin: run-6's freckles render was delivered and charged with a slab of
   * background punched through her hair, and scored `delivered_compliant`,
   * because nothing in the product asked whether the frame was intact.
   *
   * Non-retryable. A seam is a verdict about what our own compositor did with
   * a frame; the same inputs produce the same cut.
   */
  | "composite_fault"
  /**
   * WE COULD NOT READ WHAT SHE ALREADY HAS (segment permanence, slice 1).
   *
   * Fourth split, same law: the receipt is the record. The provider was fine,
   * our compositor was fine, and the store of her kept edits could not be
   * listed — so we do not know what belongs in this picture.
   *
   * It refuses rather than degrading, and that is the whole point of having
   * the class. A face assembled from a list we could not finish reading looks
   * exactly like a correct render: her freckles are simply gone again, on a
   * picture she paid for, with every instrument green. A refusal she can see
   * beats a silent short paste she cannot.
   *
   * Non-retryable here: the retry that would help is the sweep's, not the
   * render's, and a second attempt in the same second reaches the same
   * database.
   */
  | "segment_store"
  /**
   * THE THING SHE ASKED US TO TAKE OFF IS STILL IN THE PICTURE (chunk 3).
   *
   * Fifth split, same law: the receipt is the record. `facts_missing` is the
   * mirror of this and reads *"came back twice without what you asked for"* —
   * true of a verification refusal, which has already re-rendered once for
   * free, and false here in both halves. A removal is adjudicated once, before
   * the landing, and its shortfall is not an absence at all: the render came
   * back WITH the thing that was supposed to go.
   *
   * Non-retryable. The recipe already said the absence in the plainest words
   * the catalogue has; asking the same engine the same question is not a
   * different request, and the honest answer to a removal that will not take is
   * the money back rather than a second charge-shaped attempt.
   */
  | "removal_not_delivered"
  /**
   * WE CANNOT SAY THIS ASK, SO NOTHING WAS RENDERED (fable-442 ruling 2).
   *
   * The repaint assembles a recipe declaratively; an ask whose facet has no
   * slot — `expression` today — cannot be stated in one, and painting a recipe
   * that never mentions what she asked for is worse than refusing. So the road
   * refuses BEFORE the provider is contacted, and the whole charge goes back.
   *
   * It had been recording itself as `unknown`, which is the one class that
   * means *we do not know why*. The door whose entire point is that it knows
   * exactly what went wrong was filing its refusals into the noise bucket —
   * and D-236's report reads that column, so a named product gap was inflating
   * the unknown-failure rate and hiding inside it.
   *
   * Not a provider failure at all, and it wears this union because the column
   * is one column. Non-retryable by construction: the recipe will have the same
   * nothing to say a second later.
   */
  | "cannot_say"
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
  /**
   * Pictures the model must actually look at, in the order given.
   *
   * Present only for the judging calls (§I's cohort validator): "is this the
   * same person, at the requested angle, in the wardrobe we promised" is a
   * question about two images, and asking it of a text-only model would produce
   * a confident answer about nothing. Interpreter calls omit this and stay
   * exactly as cheap as they were.
   */
  images?: readonly ReferenceImage[];
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
