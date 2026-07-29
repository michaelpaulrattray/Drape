import { createHash, randomUUID } from "node:crypto";
import type { GenerateContentConfig } from "@google/genai";
import { TRPCError } from "@trpc/server";
import { AspectRatio } from "../geminiTypes";
import {
  diagnoseResponse,
  extractImageFromResponse,
  getAiClient,
  safeResponseText,
  SAFETY_SETTINGS,
  withTimeout,
} from "../geminiClient";
import { withImageQueue, withTextQueue } from "../geminiQueue";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  type DirectOperationGate,
} from "../directOperation";
import {
  getGenerationOperationOutcomeByClaim,
  markGenerationOperationRunning,
} from "../../db/generationOperations";
import {
  completeInkCandidateReady,
  findActiveOwnedInkCandidate,
  findActiveOwnedInkProjectionCandidate,
  InkCandidateStateError,
  invalidateInkCandidate,
  markInkCandidateAttemptGenerating,
  markInkCandidateAttemptStored,
  loadInkProjectionCandidatePreflight,
  prepareIncludedInkCandidateRetry,
  prepareInkCandidateGeneration,
  prepareInkProjectionCandidateGeneration,
  type InkProjectionCandidatePreflight,
  type PreparedInkCandidateAttempt,
} from "../../db/inkAddCandidates";
import {
  findOwnedInkIntentClaimSubject,
  findOwnedPendingInkIntent,
} from "../../db/inkAddIntents";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { withAtomicCredits, type RefundOutcome } from "../atomicCredits";
import { modelOperationLockKey } from "../operationContract";
import { slotCost } from "../packagePricing";
import { fetchTrustedImage } from "../../security/trustedImageFetch";
import {
  canonicalizeEvidenceDataUrl,
  type CanonicalEvidenceImage,
} from "./imageValidation";
import {
  putCanonicalEvidence,
  type CanonicalEvidenceRead,
  type PrivateEvidenceStorageAdapter,
} from "./evidenceDelivery";
import {
  INK_ADD_PRICE_CREDITS,
} from "./evidenceCandidateContract";
import {
  buildInkAnywhereComposerRequest,
  buildInkComposerRequest,
  type ComposerImage,
  type InkAnywhereComposerRequest,
  type InkComposerRequest,
  type InkRetryDirective,
} from "./composer/inkComposer";
import {
  buildAnatomicalInkZoneGuide,
  buildInkZoneGuide,
  buildMultiAnatomicalInkZoneGuide,
} from "./composer/inkZoneGuide";
import {
  runInkAnywhereCandidateProbes,
  runInkAnywhereVisibilityProbe,
  runInkCandidateProbes,
  runInkVisibilityProbe,
  type InkProbeRequest,
} from "./composer/inkProbe";
import {
  assertSupportedInkAnatomyTuple,
  inkAnatomicalSideAuthority,
  inkAnatomyLabel,
} from "./inkAnatomyRegistry";
import { decideInkCandidateAttempt } from "./composer/inkRetryDecision";
import { INK_ADD_IMAGE_ENGINE } from "./composer/inkAddRecipe";
import { captureEvidenceComposerEnabled } from "./evidenceComposerScope";
import { createModuleLogger } from "../../logging/logger";
import {
  extractInkProviderTelemetry,
} from "./composer/inkProviderTelemetry";
import {
  buildInkCoverageProbeRequest,
  buildInkEvidenceMosaic,
  buildInkProjectionComposerRequest,
  parseInkCoverageProbeResponse,
  runInkProjectionCandidateProbes,
  summarizeInkCoverageProbeResponse,
  type InkProjectionComposerRequest,
  type InkProjectionFeatureReference,
} from "./inkProjectionComposition";
import type { CanonicalViewAngle } from "../../../shared/boardTypes";
import {
  INK_PROJECTION_LOCATION_UNAVAILABLE,
  isInkProjectionAngleReleased,
} from "./inkReleasePolicy";

const log = createModuleLogger("casting/evidence/inkCandidateGeneration");
const CANDIDATE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const CANDIDATE_FAILURE =
  "The tattoo preview could not be created.";
const VISIBILITY_FAILURE =
  "The current Cast does not show the requested tattoo location clearly enough. Nothing was charged.";

export interface InkCandidateReadyResult {
  candidateId: string;
  status: "ready";
  expiresAt: string;
  chargedCredits: number;
}

type BeginOperation = (input: Parameters<typeof beginDirectOperation>[0]) =>
  Promise<DirectOperationGate>;

export interface InkCandidateGenerationDependencies {
  delivery: PrivateEvidenceStorageAdapter;
  enabledForUser?: (userId: number) => boolean;
  projectionAngleReleased?: typeof isInkProjectionAngleReleased;
  begin?: BeginOperation;
  findClaimSubject?: typeof findOwnedInkIntentClaimSubject;
  getOutcomeByClaim?: typeof getGenerationOperationOutcomeByClaim;
  findIntent?: typeof findOwnedPendingInkIntent;
  markRunning?: typeof markGenerationOperationRunning;
  prepare?: typeof prepareInkCandidateGeneration;
  loadProjectionPreflight?: typeof loadInkProjectionCandidatePreflight;
  prepareProjection?: typeof prepareInkProjectionCandidateGeneration;
  prepareIncludedRetry?: typeof prepareIncludedInkCandidateRetry;
  markGenerating?: typeof markInkCandidateAttemptGenerating;
  markStored?: typeof markInkCandidateAttemptStored;
  completeReady?: typeof completeInkCandidateReady;
  invalidate?: typeof invalidateInkCandidate;
  enforceQuota?: typeof enforceDailyQuota;
  fetchImage?: typeof fetchTrustedImage;
  generate?: (
    request:
      | InkComposerRequest
      | InkAnywhereComposerRequest
      | InkProjectionComposerRequest,
  ) => Promise<string>;
  probe?: (request: InkProbeRequest) => Promise<unknown>;
  charge?: typeof withAtomicCredits;
  completeSuccess?: typeof completeDirectOperationSuccess;
  completeFailure?: typeof completeDirectOperationFailure;
  canonicalize?: typeof canonicalizeEvidenceDataUrl;
  generateId?: () => string;
  now?: () => Date;
}

function requireEnabled(
  userId: number,
  enabledForUser: (userId: number) => boolean,
): void {
  if (!enabledForUser(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Tattoo previews are not available for this account.",
    });
  }
}

function closedReadyResult(
  value: unknown,
  expectedCredits: number,
): InkCandidateReadyResult {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANDIDATE_FAILURE });
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.candidateId !== "string"
    || result.status !== "ready"
    || typeof result.expiresAt !== "string"
    || !Number.isFinite(Date.parse(result.expiresAt))
    || result.chargedCredits !== expectedCredits
  ) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANDIDATE_FAILURE });
  }
  return result as unknown as InkCandidateReadyResult;
}

function publicFailure(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof InkCandidateStateError) {
    const code = error.code === "model_unavailable"
      || error.code === "intent_unavailable"
      || error.code === "candidate_unavailable"
      ? "NOT_FOUND"
      : "PRECONDITION_FAILED";
    return new TRPCError({ code, message: CANDIDATE_FAILURE });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANDIDATE_FAILURE });
}

function composerImage(image: {
  bytes: Uint8Array;
  mime: string;
}): ComposerImage {
  if (
    image.mime !== "image/jpeg"
    && image.mime !== "image/png"
    && image.mime !== "image/webp"
  ) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: CANDIDATE_FAILURE });
  }
  return { bytes: image.bytes, mime: image.mime };
}

async function readPrivateExact(
  adapter: PrivateEvidenceStorageAdapter,
  input: {
    key: string;
    byteSize: number;
    contentHash: string;
  },
): Promise<ComposerImage> {
  const object = await adapter.readCanonical({
    key: input.key,
    expectedByteSize: input.byteSize,
  });
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of object.body) {
      total += chunk.byteLength;
      if (total > input.byteSize) throw new Error("private evidence overflow");
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    object.abort();
  }
  if (total !== input.byteSize) throw new Error("private evidence size mismatch");
  const bytes = Buffer.concat(chunks, total);
  if (createHash("sha256").update(bytes).digest("hex") !== input.contentHash) {
    throw new Error("private evidence hash mismatch");
  }
  return { bytes, mime: "image/webp" };
}

async function defaultGenerate(
  request:
    | InkComposerRequest
    | InkAnywhereComposerRequest
    | InkProjectionComposerRequest,
): Promise<string> {
  return withImageQueue(async () => {
    const response = await withTimeout(
      getAiClient().models.generateContent({
        model: request.model,
        contents: {
          parts: [
            ...request.images.map((image) => ({
              inlineData: image.inlineData,
            })),
            { text: request.prompt },
          ],
        },
        config: {
          responseModalities: [...request.responseModalities],
          imageConfig: { aspectRatio: AspectRatio.PORTRAIT },
          safetySettings: SAFETY_SETTINGS,
        },
      }),
      90_000,
      "InkCandidate",
    );
    const diagnosis = diagnoseResponse(response);
    if (diagnosis) throw new Error("ink candidate provider refused");
    const image = extractImageFromResponse(response);
    if (!image) throw new Error("ink candidate provider returned no image");
    return image;
  }, "inkCandidate");
}

function responseSchema(request: InkProbeRequest) {
  const properties = Object.fromEntries(
    Object.entries(request.responseSchema).map(([key, type]) => [
      key,
      { type: type === "boolean" ? "BOOLEAN" : "INTEGER" },
    ]),
  );
  return {
    type: "OBJECT",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export function buildInkProbeProviderConfig(
  request: InkProbeRequest,
): GenerateContentConfig {
  return {
    temperature: 0,
    responseMimeType: request.responseMimeType,
    responseSchema: responseSchema(request),
    thinkingConfig: {
      thinkingBudget: request.thinkingBudget,
      includeThoughts: request.includeThoughts,
    },
    maxOutputTokens: request.maxOutputTokens,
    safetySettings: SAFETY_SETTINGS,
  };
}

async function defaultProbe(request: InkProbeRequest): Promise<unknown> {
  return withTextQueue(async () => {
    try {
      const response = await withTimeout(
        getAiClient().models.generateContent({
          model: request.model,
          contents: {
            parts: [
              ...request.images.map((image) => ({
                inlineData: image.inlineData,
              })),
              { text: request.prompt },
            ],
          },
          config: buildInkProbeProviderConfig(request),
        }),
        20_000,
        `InkProbe:${request.kind}`,
      );
      const text = safeResponseText(response);
      if (!text) {
        log.warn({
          probeKind: request.kind,
          provider: extractInkProviderTelemetry({
            response,
            textLength: 0,
          }),
        }, "Ink probe provider response was empty");
      }
      return text;
    } catch (error) {
      log.warn({
        probeKind: request.kind,
        provider: extractInkProviderTelemetry({ error }),
      }, "Ink probe provider request failed");
      throw error;
    }
  }, `inkProbe:${request.kind}`);
}

async function loadInputs(
  dependencies: InkCandidateGenerationDependencies,
  prepared: PreparedInkCandidateAttempt,
) {
  const fetchImage = dependencies.fetchImage ?? fetchTrustedImage;
  const [anchorFetched, targetFetched, reference] = await Promise.all([
    fetchImage(prepared.anchorUrl),
    fetchImage(prepared.sourceUrl),
    prepared.reference
      ? readPrivateExact(dependencies.delivery, {
          key: prepared.reference.storageKey,
          byteSize: prepared.reference.byteSize,
          contentHash: prepared.reference.contentHash,
        })
      : null,
  ]);
  const anchor = composerImage(anchorFetched);
  const target = composerImage(targetFetched);
  if (prepared.authority.kind === "projection_v2") {
    const projectionAuthority = prepared.authority;
    const projectionFeatures: InkProjectionFeatureReference[] =
      await Promise.all(projectionAuthority.features.map(async (feature) => {
        assertSupportedInkAnatomyTuple(feature.anatomy);
        return {
          featureId: feature.featureId,
          featureVersionId: feature.featureVersionId,
          normalizedDescriptor: feature.normalizedDescriptor,
          anatomyLabel: feature.anatomyLabel,
          sideAuthority: inkAnatomicalSideAuthority(
            feature.anatomy,
            projectionAuthority.targetAngle,
          ).prompt,
          targetZone: feature.targetZone,
          witnessZone: feature.witnessZone,
          witness: await readPrivateExact(dependencies.delivery, {
            key: feature.witness.storageKey,
            byteSize: feature.witness.byteSize,
            contentHash: feature.witness.contentHash,
          }),
          isProjectionTarget: feature.isProjectionTarget,
        };
      }));
    const [guide, evidenceMosaic] = await Promise.all([
      buildMultiAnatomicalInkZoneGuide({
        targetBytes: target.bytes,
        zones: projectionFeatures.map((feature) => ({
          normalizedZone: feature.targetZone,
          label: feature.anatomyLabel,
        })),
      }),
      buildInkEvidenceMosaic(projectionFeatures),
    ]);
    return {
      anchor,
      target,
      guidedTarget: composerImage(guide),
      reference: null,
      projectionFeatures: Object.freeze(projectionFeatures),
      evidenceMosaic: composerImage(evidenceMosaic),
    };
  }
  const guide = prepared.authority.kind === "legacy_v1"
    ? await buildInkZoneGuide({
        targetBytes: target.bytes,
        side: prepared.authority.anatomy.side,
      })
    : await buildAnatomicalInkZoneGuide({
        targetBytes: target.bytes,
        normalizedZone: prepared.authority.normalizedTargetZone,
        label:
          `${inkAnatomyLabel(prepared.authority.anatomy)} - ${
            inkAnatomicalSideAuthority(
              prepared.authority.anatomy,
              prepared.sourceViewAngle,
            ).guideLabel
          }`,
      });
  return {
    anchor,
    target,
    guidedTarget: composerImage(guide),
    reference,
    projectionFeatures: null,
    evidenceMosaic: null,
  };
}

async function runAttempt(input: {
  dependencies: InkCandidateGenerationDependencies;
  prepared: PreparedInkCandidateAttempt;
  images: Awaited<ReturnType<typeof loadInputs>>;
  predictedVisibility: "pass";
  retryDirectives?: readonly InkRetryDirective[];
}): Promise<
  | { type: "ready"; prepared: PreparedInkCandidateAttempt; expiresAt: Date }
  | {
      type: "included_retry";
      prepared: PreparedInkCandidateAttempt;
      directives: readonly InkRetryDirective[];
    }
  | { type: "failed"; prepared: PreparedInkCandidateAttempt }
> {
  const {
    dependencies,
    prepared,
    images,
  } = input;
  await (dependencies.markGenerating ?? markInkCandidateAttemptGenerating)(
    prepared,
  );
  const composerRequest = prepared.authority.kind === "legacy_v1"
    ? buildInkComposerRequest({
        identityText: prepared.identityText,
        normalizedDescriptor: prepared.normalizedDescriptor,
        side: prepared.authority.anatomy.side,
        attemptNumber: prepared.attemptNumber,
        identityAnchor: images.anchor,
        guidedTarget: images.guidedTarget,
        evidenceReference: images.reference ?? undefined,
        retryDirectives: input.retryDirectives,
      })
    : prepared.authority.kind === "anywhere_v2"
    ? buildInkAnywhereComposerRequest({
        identityText: prepared.identityText,
        normalizedDescriptor: prepared.normalizedDescriptor,
        anatomy: prepared.authority.anatomy,
        sourceAngle: prepared.sourceViewAngle,
        attemptNumber: prepared.attemptNumber,
        originalTarget: images.target,
        identityAnchor: images.anchor,
        guidedTarget: images.guidedTarget,
        evidenceReference: images.reference ?? undefined,
        retryDirectives: input.retryDirectives,
      })
    : buildInkProjectionComposerRequest({
        identityText: prepared.identityText,
        sourceAngle: prepared.authority.sourceAngle,
        targetAngle: prepared.authority.targetAngle,
        features: images.projectionFeatures!,
        attemptNumber: prepared.attemptNumber,
        originalTarget: images.target,
        identityAnchor: images.anchor,
        guidedTarget: images.guidedTarget,
        evidenceMosaic: images.evidenceMosaic!,
        retryDirectives: input.retryDirectives,
      });
  const imageDataUrl = await (dependencies.generate ?? defaultGenerate)(
    composerRequest,
  );
  const candidate = await (
    dependencies.canonicalize ?? canonicalizeEvidenceDataUrl
  )(imageDataUrl);
  await putCanonicalEvidence(dependencies.delivery, {
    key: prepared.privateStorageKey,
    image: candidate,
  });
  const verified = await readPrivateExact(dependencies.delivery, {
    key: prepared.privateStorageKey,
    byteSize: candidate.byteSize,
    contentHash: candidate.contentHash,
  });
  if (
    verified.mime !== candidate.mime
    || !Buffer.from(verified.bytes).equals(candidate.bytes)
  ) {
    throw new Error("private candidate verification mismatch");
  }
  await (dependencies.markStored ?? markInkCandidateAttemptStored)({
    prepared,
    image: candidate,
  });
  const rawCandidate = composerImage(candidate);
  const placementAuditCandidate =
    prepared.authority.kind === "anywhere_v2"
      ? composerImage(await buildAnatomicalInkZoneGuide({
          targetBytes: candidate.bytes,
          normalizedZone: prepared.authority.normalizedTargetZone,
          label:
            `${inkAnatomyLabel(prepared.authority.anatomy)} - ${
              inkAnatomicalSideAuthority(
                prepared.authority.anatomy,
                prepared.sourceViewAngle,
              ).guideLabel
            }`,
        }))
      : prepared.authority.kind === "projection_v2"
      ? composerImage(await buildMultiAnatomicalInkZoneGuide({
          targetBytes: candidate.bytes,
          zones: images.projectionFeatures!.map((feature) => ({
            normalizedZone: feature.targetZone,
            label: feature.anatomyLabel,
          })),
        }))
      : null;
  const probe = prepared.authority.kind === "legacy_v1"
    ? await runInkCandidateProbes({
        identityAnchor: images.anchor,
        originalTarget: images.target,
        candidate: rawCandidate,
        evidenceReference: images.reference ?? undefined,
        side: prepared.authority.anatomy.side,
        normalizedDescriptor: prepared.normalizedDescriptor,
        predictedVisibility: input.predictedVisibility,
        probe: dependencies.probe ?? defaultProbe,
      })
    : prepared.authority.kind === "anywhere_v2"
    ? await runInkAnywhereCandidateProbes({
        identityAnchor: images.anchor,
        originalTarget: images.target,
        candidate: rawCandidate,
        placementAuditCandidate: placementAuditCandidate!,
        evidenceReference: images.reference ?? undefined,
        anatomy: prepared.authority.anatomy,
        sourceAngle: prepared.sourceViewAngle,
        normalizedDescriptor: prepared.normalizedDescriptor,
        predictedVisibility: input.predictedVisibility,
        probe: dependencies.probe ?? defaultProbe,
      })
    : await runInkProjectionCandidateProbes({
        sourceAngle: prepared.authority.sourceAngle,
        targetAngle: prepared.authority.targetAngle,
        features: images.projectionFeatures!,
        identityAnchor: images.anchor,
        originalTarget: images.target,
        evidenceMosaic: images.evidenceMosaic!,
        candidate: rawCandidate,
        placementAuditCandidate: placementAuditCandidate!,
        probe: dependencies.probe ?? defaultProbe,
      });
  log.info({
    operationId: prepared.operationId,
    candidateId: prepared.candidateId,
    attemptNumber: prepared.attemptNumber,
    probe: {
      predictedVisibility: probe.predictedVisibility,
      identity: probe.identityOutcome,
      placement: probe.placementOutcome,
      featureMatch: probe.featureMatchOutcome,
      priorInk: probe.priorInkOutcome,
      poseFraming: probe.poseFramingOutcome,
      unexpectedInk: probe.unexpectedInkOutcome,
      overall: probe.overallOutcome,
      placementDetail: probe.placementDetail ?? null,
      placementAudit: probe.placementAudit ?? null,
    },
  }, "Ink candidate evidence assessed");
  const decision = decideInkCandidateAttempt({
    attemptNumber: prepared.attemptNumber,
    probe,
  });
  if (decision.action === "ready") {
    const now = dependencies.now?.() ?? new Date();
    const expiresAt = new Date(now.getTime() + CANDIDATE_EXPIRY_MS);
    await (dependencies.completeReady ?? completeInkCandidateReady)({
      prepared,
      probe,
      expiresAt,
    });
    return { type: "ready", prepared, expiresAt };
  }
  if (decision.action === "included_retry") {
    const generateId = dependencies.generateId ?? randomUUID;
    const next = await (
      dependencies.prepareIncludedRetry ?? prepareIncludedInkCandidateRetry
    )({
      prepared,
      probe,
      attemptId: generateId(),
      privatePlateId: generateId(),
    });
    return {
      type: "included_retry",
      prepared: next,
      directives: decision.directives,
    };
  }
  await (dependencies.invalidate ?? invalidateInkCandidate)({
    prepared,
    probe,
    publicError: CANDIDATE_FAILURE,
  });
  return { type: "failed", prepared };
}

async function executeCandidate(
  dependencies: InkCandidateGenerationDependencies,
  input: {
    userId: number;
    intentId: string;
    clientRequestId: string;
    operationKind: PreparedInkCandidateAttempt["operationKind"];
  },
): Promise<InkCandidateReadyResult> {
  const enabled = dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  requireEnabled(input.userId, enabled);
  const claimSubject = await (
    dependencies.findClaimSubject ?? findOwnedInkIntentClaimSubject
  )({
    userId: input.userId,
    intentId: input.intentId,
  });
  if (!claimSubject) {
    throw new TRPCError({ code: "NOT_FOUND", message: CANDIDATE_FAILURE });
  }
  const existing = await (
    dependencies.getOutcomeByClaim ?? getGenerationOperationOutcomeByClaim
  )({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: input.operationKind,
    modelId: claimSubject.modelId,
    payload: { intentId: input.intentId },
  });
  if (existing?.type === "replay_success") {
    return closedReadyResult(existing.result, INK_ADD_PRICE_CREDITS);
  }
  if (existing?.type === "replay_failure") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: existing.publicMessage,
    });
  }
  if (existing?.type === "deleted_subject") {
    throw new TRPCError({ code: "NOT_FOUND", message: CANDIDATE_FAILURE });
  }
  if (existing?.type === "recovery_required") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: existing.publicMessage,
    });
  }
  if (existing?.type === "in_progress") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This tattoo preview is already in progress.",
    });
  }
  if (existing?.type === "payload_conflict") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That request id was already used for a different action.",
    });
  }
  const intent = await (
    dependencies.findIntent ?? findOwnedPendingInkIntent
  )({
    userId: input.userId,
    intentId: input.intentId,
  });
  if (!intent) throw new TRPCError({ code: "NOT_FOUND", message: CANDIDATE_FAILURE });

  // Terminal replays returned above remain free. New work checks quota before
  // claiming the receipt/model lock, so an over-quota request cannot strand
  // an in-progress operation.
  await (dependencies.enforceQuota ?? enforceDailyQuota)(input.userId);
  const begin = dependencies.begin ?? beginDirectOperation;
  const gate = await begin({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: input.operationKind,
    modelId: intent.modelId,
    payload: { intentId: input.intentId },
    lockKey: modelOperationLockKey(intent.modelId),
  });
  if (gate.type === "replay") {
    return closedReadyResult(gate.result, INK_ADD_PRICE_CREDITS);
  }

  let prepared: PreparedInkCandidateAttempt | null = null;
  let chargedCredits = 0;
  let refundedCredits = 0;
  let readyBoundary = false;
  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId: gate.operationId,
      modelId: intent.modelId,
      plannedCredits: INK_ADD_PRICE_CREDITS,
      requiredLockKey: modelOperationLockKey(intent.modelId),
      phase: "validating",
      heartbeat: true,
    });
    const generateId = dependencies.generateId ?? randomUUID;
    prepared = await (dependencies.prepare ?? prepareInkCandidateGeneration)({
      userId: input.userId,
      modelId: intent.modelId,
      intentId: input.intentId,
      operationId: gate.operationId,
      operationKind: input.operationKind,
      candidateId: generateId(),
      attemptId: generateId(),
      privatePlateId: generateId(),
    });
    const images = await loadInputs(dependencies, prepared);
    if (prepared.authority.kind === "projection_v2") {
      throw new InkCandidateStateError("candidate_unavailable");
    }
    const visibility = prepared.authority.kind === "legacy_v1"
      ? await runInkVisibilityProbe({
          target: images.target,
          probe: dependencies.probe ?? defaultProbe,
        })
      : await runInkAnywhereVisibilityProbe({
          target: images.target,
          guidedTarget: images.guidedTarget,
          anatomy: prepared.authority.anatomy,
          probe: dependencies.probe ?? defaultProbe,
        });
    log.info({
      operationId: gate.operationId,
      candidateId: prepared.candidateId,
      sourceViewAngle: prepared.sourceViewAngle,
      anatomy: prepared.authority.anatomy,
      visibility,
    }, "Ink candidate pre-charge visibility assessed");
    if (visibility.predictedVisibility !== "pass") {
      await (dependencies.invalidate ?? invalidateInkCandidate)({
        prepared,
        publicError: VISIBILITY_FAILURE,
      });
      return (dependencies.completeFailure ?? completeDirectOperationFailure)({
        userId: input.userId,
        operationId: gate.operationId,
        error: new TRPCError({
          code: "PRECONDITION_FAILED",
          message: VISIBILITY_FAILURE,
        }),
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }

    const charge = dependencies.charge ?? withAtomicCredits;
    const ready = await charge({
      userId: input.userId,
      amount: INK_ADD_PRICE_CREDITS,
      description: "Tattoo preview",
      referenceId: `op:${gate.operationId}:charge`,
      engineUsed: INK_ADD_IMAGE_ENGINE,
      onCharged: (amount) => {
        chargedCredits = amount;
      },
      onRefunded: (outcome: RefundOutcome) => {
        if (outcome.recorded) refundedCredits = outcome.amount;
      },
    }, async () => {
      let outcome = await runAttempt({
        dependencies,
        prepared: prepared!,
        images,
        predictedVisibility: "pass",
      });
      if (outcome.type === "included_retry") {
        prepared = outcome.prepared;
        outcome = await runAttempt({
          dependencies,
          prepared,
          images,
          predictedVisibility: "pass",
          retryDirectives: outcome.directives,
        });
      }
      if (outcome.type !== "ready") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: CANDIDATE_FAILURE,
        });
      }
      return outcome;
    });
    const result: InkCandidateReadyResult = {
      candidateId: ready.prepared.candidateId,
      status: "ready",
      expiresAt: ready.expiresAt.toISOString(),
      chargedCredits: INK_ADD_PRICE_CREDITS,
    };
    // From this point the paid product is durably delivered. Receipt trouble
    // is recovery/audit work and must never invalidate it or trigger a refund.
    readyBoundary = true;
    await (dependencies.completeSuccess ?? completeDirectOperationSuccess)({
      userId: input.userId,
      operationId: gate.operationId,
      result: { ...result },
      chargedCredits,
      refundedCredits,
    });
    return result;
  } catch (error) {
    if (readyBoundary) throw error;
    log.error({
      errorName: error instanceof Error ? error.name : "UnknownError",
      operationId: gate.operationId,
      candidateId: prepared?.candidateId,
    }, "Ink candidate generation failed");
    if (prepared) {
      await (dependencies.invalidate ?? invalidateInkCandidate)({
        prepared,
        publicError: CANDIDATE_FAILURE,
      }).catch(() => undefined);
    }
    return (dependencies.completeFailure ?? completeDirectOperationFailure)({
      userId: input.userId,
      operationId: gate.operationId,
      error: publicFailure(error),
      chargedCredits,
      refundedCredits,
    });
  }
}

export function generateInkAddCandidate(
  dependencies: InkCandidateGenerationDependencies,
  input: {
    userId: number;
    intentId: string;
    clientRequestId: string;
  },
): Promise<InkCandidateReadyResult> {
  return executeCandidate(dependencies, {
    ...input,
    operationKind: "evidence_candidate_generate",
  });
}

export function retryInkAddCandidate(
  dependencies: InkCandidateGenerationDependencies,
  input: {
    userId: number;
    intentId: string;
    clientRequestId: string;
  },
): Promise<InkCandidateReadyResult> {
  return executeCandidate(dependencies, {
    ...input,
    operationKind: "evidence_candidate_retry",
  });
}

async function executeProjectionCandidate(
  dependencies: InkCandidateGenerationDependencies,
  input: {
    userId: number;
    modelId: number;
    targetViewAngle: CanonicalViewAngle;
    clientRequestId: string;
    operationKind: PreparedInkCandidateAttempt["operationKind"];
  },
): Promise<InkCandidateReadyResult> {
  const enabled = dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  requireEnabled(input.userId, enabled);
  const projectionAngleReleased =
    dependencies.projectionAngleReleased ?? isInkProjectionAngleReleased;
  if (!projectionAngleReleased(input.targetViewAngle)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: INK_PROJECTION_LOCATION_UNAVAILABLE,
    });
  }
  const projectionPrice = slotCost(input.targetViewAngle);
  const payload = {
    modelId: input.modelId,
    targetViewAngle: input.targetViewAngle,
    purpose: "feature_projection",
  };
  const existing = await (
    dependencies.getOutcomeByClaim ?? getGenerationOperationOutcomeByClaim
  )({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: input.operationKind,
    modelId: input.modelId,
    payload,
  });
  if (existing?.type === "replay_success") {
    return closedReadyResult(existing.result, projectionPrice);
  }
  if (existing?.type === "replay_failure") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: existing.publicMessage,
    });
  }
  if (existing?.type === "deleted_subject") {
    throw new TRPCError({ code: "NOT_FOUND", message: CANDIDATE_FAILURE });
  }
  if (existing?.type === "recovery_required") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: existing.publicMessage,
    });
  }
  if (existing?.type === "in_progress") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This tattoo projection is already in progress.",
    });
  }
  if (existing?.type === "payload_conflict") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That request id was already used for a different action.",
    });
  }
  await (dependencies.enforceQuota ?? enforceDailyQuota)(input.userId);
  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: input.operationKind,
    modelId: input.modelId,
    payload,
    lockKey: modelOperationLockKey(input.modelId),
  });
  if (gate.type === "replay") {
    return closedReadyResult(gate.result, projectionPrice);
  }

  let prepared: PreparedInkCandidateAttempt | null = null;
  let chargedCredits = 0;
  let refundedCredits = 0;
  let readyBoundary = false;
  let failureStage:
    | "preflight"
    | "coverage"
    | "prepare"
    | "load_inputs"
    | "generation" = "preflight";
  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId: gate.operationId,
      modelId: input.modelId,
      plannedCredits: projectionPrice,
      requiredLockKey: modelOperationLockKey(input.modelId),
      phase: "validating",
      heartbeat: true,
    });
    const preflight: InkProjectionCandidatePreflight = await (
      dependencies.loadProjectionPreflight
      ?? loadInkProjectionCandidatePreflight
    )({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      operationKind: input.operationKind,
      targetViewAngle: input.targetViewAngle,
    });
    failureStage = "coverage";
    const uncertain = preflight.features.filter(
      (feature) => feature.impact === "uncertain",
    );
    let observedCoverage: Readonly<Record<string, boolean>> = Object.freeze({});
    if (uncertain.length > 0) {
      if (preflight.sourceViewAngle !== preflight.targetViewAngle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This view does not yet show enough of the requested tattoo surface to verify it safely. Nothing was charged.",
        });
      }
      const target = composerImage(
        await (dependencies.fetchImage ?? fetchTrustedImage)(
          preflight.sourceUrl,
        ),
      );
      const rawCoverage = await (dependencies.probe ?? defaultProbe)(
        buildInkCoverageProbeRequest({
          targetAngle: preflight.targetViewAngle,
          features: uncertain.map((feature) => ({
            featureVersionId: feature.featureVersionId,
            anatomyLabel: feature.anatomyLabel,
            targetZone: feature.targetZone,
          })),
          target,
        }),
      );
      const coverageTelemetry = summarizeInkCoverageProbeResponse(
        rawCoverage,
        uncertain.length,
      );
      log.info({
        operationId: gate.operationId,
        targetViewAngle: input.targetViewAngle,
        responseShape: coverageTelemetry.responseShape,
        coverage: uncertain.map((feature, index) => ({
          anatomy: feature.anatomy,
          regionVisible:
            coverageTelemetry.features[index]?.regionVisible ?? null,
          verdictCertain:
            coverageTelemetry.features[index]?.verdictCertain ?? null,
        })),
      }, "Ink projection pre-charge coverage assessed");
      try {
        observedCoverage = parseInkCoverageProbeResponse(
          rawCoverage,
          uncertain.map((feature) => feature.featureVersionId),
        );
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This view does not show enough of the selected tattoo surfaces"
            + " to verify them safely. Nothing was charged.",
          cause: error,
        });
      }
    }
    failureStage = "prepare";
    const generateId = dependencies.generateId ?? randomUUID;
    prepared = await (
      dependencies.prepareProjection
      ?? prepareInkProjectionCandidateGeneration
    )({
      preflight,
      candidateId: generateId(),
      attemptId: generateId(),
      privatePlateId: generateId(),
      observedCoverage,
    });
    failureStage = "load_inputs";
    const images = await loadInputs(dependencies, prepared);
    failureStage = "generation";
    const ready = await (dependencies.charge ?? withAtomicCredits)({
      userId: input.userId,
      amount: projectionPrice,
      description: `Tattoo projection preview: ${input.targetViewAngle}`,
      referenceId: `op:${gate.operationId}:charge`,
      engineUsed: INK_ADD_IMAGE_ENGINE,
      onCharged: (amount) => {
        chargedCredits = amount;
      },
      onRefunded: (outcome: RefundOutcome) => {
        if (outcome.recorded) refundedCredits = outcome.amount;
      },
    }, async () => {
      let outcome = await runAttempt({
        dependencies,
        prepared: prepared!,
        images,
        predictedVisibility: "pass",
      });
      if (outcome.type === "included_retry") {
        prepared = outcome.prepared;
        outcome = await runAttempt({
          dependencies,
          prepared,
          images,
          predictedVisibility: "pass",
          retryDirectives: outcome.directives,
        });
      }
      if (outcome.type !== "ready") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: CANDIDATE_FAILURE,
        });
      }
      return outcome;
    });
    const result: InkCandidateReadyResult = {
      candidateId: ready.prepared.candidateId,
      status: "ready",
      expiresAt: ready.expiresAt.toISOString(),
      chargedCredits: projectionPrice,
    };
    readyBoundary = true;
    await (dependencies.completeSuccess ?? completeDirectOperationSuccess)({
      userId: input.userId,
      operationId: gate.operationId,
      result: { ...result },
      chargedCredits,
      refundedCredits,
    });
    return result;
  } catch (error) {
    if (readyBoundary) throw error;
    log.error({
      errorName: error instanceof Error ? error.name : "UnknownError",
      stateCode: error instanceof InkCandidateStateError ? error.code : null,
      failureStage,
      operationId: gate.operationId,
      candidateId: prepared?.candidateId,
      targetViewAngle: input.targetViewAngle,
    }, "Ink projection candidate generation failed");
    if (prepared) {
      await (dependencies.invalidate ?? invalidateInkCandidate)({
        prepared,
        publicError: CANDIDATE_FAILURE,
      }).catch(() => undefined);
    }
    return (dependencies.completeFailure ?? completeDirectOperationFailure)({
      userId: input.userId,
      operationId: gate.operationId,
      error: publicFailure(error),
      chargedCredits,
      refundedCredits,
    });
  }
}

export function generateInkProjectionCandidate(
  dependencies: InkCandidateGenerationDependencies,
  input: {
    userId: number;
    modelId: number;
    targetViewAngle: CanonicalViewAngle;
    clientRequestId: string;
  },
): Promise<InkCandidateReadyResult> {
  return executeProjectionCandidate(dependencies, {
    ...input,
    operationKind: "evidence_candidate_generate",
  });
}

export function retryInkProjectionCandidate(
  dependencies: InkCandidateGenerationDependencies,
  input: {
    userId: number;
    modelId: number;
    targetViewAngle: CanonicalViewAngle;
    clientRequestId: string;
  },
): Promise<InkCandidateReadyResult> {
  return executeProjectionCandidate(dependencies, {
    ...input,
    operationKind: "evidence_candidate_retry",
  });
}

export async function readActiveInkCandidate(input: {
  userId: number;
  intentId: string;
}): Promise<{
  candidateId: string;
  candidateStatus: "processing" | "ready";
  candidateDeliveryUrl: string | null;
  expiresAt: string | null;
} | null> {
  const candidate = await findActiveOwnedInkCandidate(input);
  if (!candidate) return null;
  return {
    candidateId: candidate.id,
    candidateStatus: candidate.status,
    candidateDeliveryUrl: candidate.status === "ready"
      ? `/api/evidence/candidate/${candidate.id}`
      : null,
    expiresAt: candidate.expiresAt?.toISOString() ?? null,
  };
}

export async function readActiveInkProjectionCandidate(input: {
  userId: number;
  modelId: number;
}): Promise<{
  candidateId: string;
  candidateStatus: "processing" | "ready";
  targetViewAngle: CanonicalViewAngle;
  priceCredits: number;
  candidateDeliveryUrl: string | null;
  expiresAt: string | null;
} | null> {
  const candidate = await findActiveOwnedInkProjectionCandidate(input);
  if (!candidate) return null;
  return {
    candidateId: candidate.id,
    candidateStatus: candidate.status,
    targetViewAngle: candidate.targetViewAngle,
    priceCredits: slotCost(candidate.targetViewAngle),
    candidateDeliveryUrl: candidate.status === "ready"
      ? `/api/evidence/candidate/${candidate.id}`
      : null,
    expiresAt: candidate.expiresAt?.toISOString() ?? null,
  };
}
