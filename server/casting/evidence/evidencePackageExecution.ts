import { createHash, randomUUID } from "node:crypto";
import type { GenerateContentConfig } from "@google/genai";
import { TRPCError } from "@trpc/server";
import {
  createGeneration,
  createModelAsset,
  deductPoints,
  updateGeneration,
} from "../../db";
import {
  recordRefund,
  type RefundOutcome,
} from "../atomicCredits";
import {
  diagnoseResponse,
  extractImageFromResponse,
  getAiClient,
  safeResponseText,
  SAFETY_SETTINGS,
  withTimeout,
} from "../geminiClient";
import { AspectRatio } from "../geminiTypes";
import { withImageQueue, withTextQueue } from "../geminiQueue";
import { slotCost } from "../packagePricing";
import {
  commitEvidencePackageSyncSnapshot,
  type EvidencePackageSyncCandidate,
} from "../snapshotTransitions";
import { fetchTrustedImage } from "../../security/trustedImageFetch";
import { storageDelete, storagePut } from "../../storage";
import {
  releaseStorageCleanupReservation,
  reserveStorageCleanupItemForOperation,
} from "../../db/storageCleanup";
import { createModuleLogger } from "../../logging/logger";
import {
  canonicalizeEvidenceDataUrl,
  MAX_EVIDENCE_CANONICAL_BYTES,
  type CanonicalEvidenceImage,
} from "./imageValidation";
import {
  type CanonicalEvidenceRead,
  type PrivateEvidenceStorageAdapter,
} from "./evidenceDelivery";
import {
  buildEvidenceContextCrop,
  buildEvidenceGuidedTarget,
  buildEvidencePackageComposerRequest,
  type EvidencePackageComposerRequest,
} from "./evidencePackageComposition";
import {
  assessEvidencePackageProbe,
  buildEvidencePackageProbeRequest,
  EVIDENCE_PACKAGE_PROBE_FAILURES,
  parseEvidencePackageProbeResponse,
  type EvidencePackageProbeFailure,
  type EvidencePackageProbeRequest,
} from "./evidencePackageProbe";
import {
  EvidencePackageAuthorityError,
  loadLockedEvidencePackageAuthority,
  type EvidencePackagePrivateAuthority,
  type EvidencePackagePrivateLegacyAuthority,
  type EvidencePackagePrivateSlotAuthority,
  type EvidencePackagePrivateV2Authority,
  type EvidencePackagePrivateV2SlotAuthority,
} from "./evidencePackageAuthority";
import {
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_TARGET_VIEW,
  type InkAddSide,
} from "./composer/inkAddRecipe";
import type {
  ComposerImage,
  InkRetryDirective,
} from "./composer/inkComposer";
import type { InkProbeRequest } from "./composer/inkProbe";
import { extractInkProviderTelemetry } from "./composer/inkProviderTelemetry";
import {
  assessInkProjectionProbe,
  buildInkEvidenceMosaic,
  buildInkProjectionComposerRequest,
  buildInkProjectionProbeRequest,
  parseInkProjectionProbeResponse,
  type InkProjectionComposerRequest,
  type InkProjectionFeatureReference,
} from "./inkProjectionComposition";
import { buildMultiAnatomicalInkZoneGuide } from "./composer/inkZoneGuide";
import {
  assertSupportedInkAnatomyTuple,
  inkAnatomyLabel,
  inkViewDirectiveV2,
} from "./inkAnatomyRegistry";
import { inkPackageDirective } from "./evidencePackageRegistry";

const log = createModuleLogger("casting/evidence/evidencePackageExecution");
const PACKAGE_FAILURE = "The view could not be updated from its saved evidence.";
export const EVIDENCE_PACKAGE_EXECUTION_FAILURE_CODES = [
  ...EVIDENCE_PACKAGE_PROBE_FAILURES,
  "execution_error",
  "settlement_refused",
] as const;
export type EvidencePackageExecutionFailureCode =
  typeof EVIDENCE_PACKAGE_EXECUTION_FAILURE_CODES[number];

export interface EvidencePackageSyncResult {
  refreshed: Array<{
    angle: EvidencePackagePrivateSlotAuthority["angle"];
    imageUrl: string;
    assetId: number;
  }>;
  failed: Array<{
    angle: EvidencePackagePrivateSlotAuthority["angle"];
    label: string;
    reason: string;
    failureCode: EvidencePackageExecutionFailureCode;
    refunded: number;
    refundReference: string;
    markerPersisted: boolean;
  }>;
}

/**
 * Settlement may have committed even though the database connection did not
 * acknowledge it. The route must leave the receipt running for the stale
 * recovery adjudicator; it must not delete candidate bytes, refund, or write a
 * terminal failure speculatively.
 */
export class EvidencePackageSettlementUncertainError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Evidence package settlement outcome is uncertain");
    this.name = "EvidencePackageSettlementUncertainError";
    this.cause = cause;
  }
}

interface GeneratedCandidate {
  candidate: EvidencePackageSyncCandidate;
  generationId: number;
}

export interface EvidencePackageExecutionDependencies {
  delivery: PrivateEvidenceStorageAdapter;
  loadAuthority?: typeof loadLockedEvidencePackageAuthority;
  fetchImage?: typeof fetchTrustedImage;
  generate?: (
    request: EvidencePackageComposerRequest | InkProjectionComposerRequest,
  ) => Promise<string>;
  probe?: (
    request: EvidencePackageProbeRequest | InkProbeRequest,
  ) => Promise<unknown>;
  canonicalize?: typeof canonicalizeEvidenceDataUrl;
  putPublic?: typeof storagePut;
  deletePublic?: typeof storageDelete;
  createAudit?: typeof createGeneration;
  updateAudit?: typeof updateGeneration;
  createFailureMarker?: typeof createModelAsset;
  deduct?: typeof deductPoints;
  refund?: typeof recordRefund;
  commit?: typeof commitEvidencePackageSyncSnapshot;
  reserveCleanup?: (input: {
    userId: number;
    operationId: string;
    storageKey: string;
  }) => Promise<string>;
  releaseCleanup?: (input: {
    batchId: string;
    userId: number;
    operationId: string;
    storageKey: string;
  }) => Promise<void>;
  generateId?: () => string;
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
    throw new TypeError("Evidence package image is unavailable");
  }
  return { bytes: image.bytes, mime: image.mime };
}

async function readPrivateExact(
  adapter: PrivateEvidenceStorageAdapter,
  plate: {
    storageKey: string;
    byteSize: number;
    contentHash: string;
    mime: string;
  },
): Promise<ComposerImage> {
  if (
    !Number.isSafeInteger(plate.byteSize)
    || plate.byteSize <= 0
    || plate.byteSize > MAX_EVIDENCE_CANONICAL_BYTES
  ) {
    throw new Error("Private evidence size is invalid");
  }
  const object: CanonicalEvidenceRead = await adapter.readCanonical({
    key: plate.storageKey,
    expectedByteSize: plate.byteSize,
  });
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of object.body) {
      total += chunk.byteLength;
      if (total > plate.byteSize) {
        throw new Error("Private evidence overflow");
      }
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    object.abort();
  }
  if (total !== plate.byteSize) {
    throw new Error("Private evidence size mismatch");
  }
  const bytes = Buffer.concat(chunks, total);
  if (createHash("sha256").update(bytes).digest("hex") !== plate.contentHash) {
    throw new Error("Private evidence hash mismatch");
  }
  return composerImage({ bytes, mime: plate.mime });
}

async function defaultGenerate(
  request: EvidencePackageComposerRequest | InkProjectionComposerRequest,
): Promise<string> {
  return withImageQueue(async () => {
    let response;
    try {
      response = await withTimeout(
        getAiClient().models.generateContent({
          model: request.model,
          contents: {
            parts: [
              ...request.images.map((image) => ({ inlineData: image.inlineData })),
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
        "EvidencePackageSync",
      );
    } catch (error) {
      log.warn({
        provider: extractInkProviderTelemetry({ error }),
      }, "Evidence package image provider failed");
      throw error;
    }
    const diagnosis = diagnoseResponse(response);
    if (diagnosis) {
      log.warn({
        provider: extractInkProviderTelemetry({ response }),
      }, "Evidence package image provider refused");
      throw new Error("Evidence package provider refused");
    }
    const image = extractImageFromResponse(response);
    if (!image) {
      log.warn({
        provider: extractInkProviderTelemetry({ response }),
      }, "Evidence package image provider returned no candidate");
      throw new Error("Evidence package provider returned no image");
    }
    return image;
  }, "evidencePackageSync");
}

function probeProviderSchema(
  request: EvidencePackageProbeRequest | InkProbeRequest,
): GenerateContentConfig["responseSchema"] {
  const enumValues: Record<string, readonly string[]> = {
    observedVisibleAnatomicalSide: ["left", "right", "none", "unknown"],
    observedTravelDirection: ["frame_left", "frame_right", "stationary", "unknown"],
    featureRegionVisibility: ["visible", "hidden", "outside_frame", "unknown"],
  };
  const properties = Object.fromEntries(
    Object.keys(request.responseSchema).map((key) => {
      if (key === "confidence") return [key, { type: "INTEGER" }];
      if (enumValues[key]) {
        return [key, { type: "STRING", enum: [...enumValues[key]] }];
      }
      return [key, { type: "BOOLEAN" }];
    }),
  );
  return {
    type: "OBJECT",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as GenerateContentConfig["responseSchema"];
}

async function defaultProbe(
  request: EvidencePackageProbeRequest | InkProbeRequest,
): Promise<unknown> {
  return withTextQueue(async () => {
    try {
      const response = await withTimeout(
        getAiClient().models.generateContent({
          model: request.model,
          contents: {
            parts: [
              ...request.images.map((image) => ({ inlineData: image.inlineData })),
              { text: request.prompt },
            ],
          },
          config: {
            responseMimeType: request.responseMimeType,
            responseSchema: probeProviderSchema(request),
            thinkingConfig: {
              thinkingBudget: request.thinkingBudget,
              includeThoughts: request.includeThoughts,
            },
            maxOutputTokens: request.maxOutputTokens,
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        20_000,
        "EvidencePackageProbe",
      );
      const text = safeResponseText(response);
      if (!text) throw new Error("Evidence package probe returned no result");
      return text;
    } catch (error) {
      log.warn({
        provider: extractInkProviderTelemetry({ error }),
      }, "Evidence package probe failed");
      throw error;
    }
  }, "evidencePackageProbe");
}

function retryDirectives(
  failure: EvidencePackageProbeFailure,
): readonly (
  | "identity"
  | "framing"
  | "visible_side"
  | "placement"
  | "feature_match"
  | "unexpected_feature"
)[] | null {
  switch (failure) {
    case "probe_unknown":
      return null;
    case "low_confidence":
      return ["identity", "framing", "feature_match"];
    case "identity_mismatch":
      return ["identity"];
    case "framing_mismatch":
    case "continuity_mismatch":
      return ["framing"];
    case "visible_side_mismatch":
    case "travel_direction_mismatch":
      return ["visible_side"];
    case "feature_visibility_mismatch":
    case "feature_placement_failed":
      return ["placement"];
    case "feature_match_failed":
      return ["feature_match"];
    case "unexpected_feature":
      return ["unexpected_feature"];
  }
}

export const EVIDENCE_PACKAGE_EXECUTION_STAGES = [
  "generation_provider",
  "candidate_validation",
  "candidate_storage",
  "probe_provider",
  "probe_parse",
  "probe_assessment",
  "candidate_cleanup",
  "audit_close",
] as const;
export type EvidencePackageExecutionStage =
  typeof EVIDENCE_PACKAGE_EXECUTION_STAGES[number];

async function deleteCandidate(
  dependencies: EvidencePackageExecutionDependencies,
  candidate: GeneratedCandidate,
  input: { userId: number; operationId: string },
): Promise<void> {
  const deleted = await (dependencies.deletePublic ?? storageDelete)(
    candidate.candidate.storageKey,
  );
  if (!deleted.success) {
    log.warn({
      operationId: input.operationId,
      storageKeyOwned: true,
      retryable: deleted.retryable,
    }, "Evidence package candidate remains reserved for cleanup");
    return;
  }
  await (
    dependencies.releaseCleanup
    ?? ((releaseInput) => releaseStorageCleanupReservation({
      ...releaseInput,
      kind: "candidate_cleanup",
      storageBackend: "public_r2",
    }))
  )({
    batchId: candidate.candidate.cleanupBatchId,
    userId: input.userId,
    operationId: input.operationId,
    storageKey: candidate.candidate.storageKey,
  });
}

async function reservePublicCleanup(input: {
  userId: number;
  operationId: string;
  storageKey: string;
}): Promise<string> {
  return reserveStorageCleanupItemForOperation({
    userId: input.userId,
    operationId: input.operationId,
    kind: "candidate_cleanup",
    storageKey: input.storageKey,
    storageBackend: "public_r2",
  });
}

async function runCandidateAttempt(input: {
  dependencies: EvidencePackageExecutionDependencies;
  authority: EvidencePackagePrivateLegacyAuthority;
  slot: EvidencePackagePrivateSlotAuthority;
  references: {
    anchor: ComposerImage;
    originalTarget: ComposerImage;
    guidedTarget: ComposerImage;
    acceptedPlate: ComposerImage;
    acceptedCrop: ComposerImage;
  };
  attemptNumber: 1 | 2;
  retry?: ReturnType<typeof retryDirectives>;
  operationId: string;
}): Promise<
  | { type: "passed"; generated: GeneratedCandidate }
  | { type: "retry"; directives: NonNullable<ReturnType<typeof retryDirectives>> }
  | { type: "failed"; failureCode: EvidencePackageProbeFailure }
> {
  const { dependencies, authority, slot, references } = input;
  const publicStorageKey = [
    "evidence-package",
    String(authority.model.userId),
    String(authority.model.id),
    slot.angle,
    `${dependencies.generateId?.() ?? randomUUID()}.png`,
  ].join("/");
  const cleanupBatchId = await (
    dependencies.reserveCleanup ?? reservePublicCleanup
  )({
    userId: authority.model.userId,
    operationId: input.operationId,
    storageKey: publicStorageKey,
  });
  const auditMetadata = {
    source: "evidence_package_sync" as const,
    viewType: slot.angle,
    attemptNumber: input.attemptNumber,
    publicStorageKey,
  };
  const audit = await (dependencies.createAudit ?? createGeneration)({
    userId: authority.model.userId,
    modelId: authority.model.id,
    operationId: input.operationId,
    stepKey: `view:${slot.angle}`,
    viewAngle: slot.angle,
    type: "multiView",
    status: "processing",
    // One child row represents the terminal accounting truth for its attempt.
    // An included first-attempt miss is later closed as non-failing; if the
    // second attempt fails, that terminal row owns the one view refund.
    pointsCost: slotCost(slot.angle),
    metadata: auditMetadata,
  });
  if (!audit.success || !audit.generationId) {
    throw new Error("Evidence package audit could not start");
  }
  let generated: GeneratedCandidate | null = null;
  let failureStage: EvidencePackageExecutionStage = "generation_provider";
  try {
    const dataUrl = await (dependencies.generate ?? defaultGenerate)(
      buildEvidencePackageComposerRequest({
        identityText: authority.identity.identityText,
        normalizedDescriptor: authority.graph.version.normalizedDescriptor,
        featureSide: authority.graph.version.side as InkAddSide,
        directive: slot.directive,
        attemptNumber: input.attemptNumber,
        identityAnchor: references.anchor,
        guidedTarget: references.guidedTarget,
        acceptedEvidenceCrop: references.acceptedCrop,
        retryDirectives: input.retry ?? undefined,
      }),
    );
    failureStage = "candidate_validation";
    const canonical: CanonicalEvidenceImage = await (
      dependencies.canonicalize ?? canonicalizeEvidenceDataUrl
    )(dataUrl);
    failureStage = "candidate_storage";
    const uploaded = await (dependencies.putPublic ?? storagePut)(
      publicStorageKey,
      canonical.bytes,
      canonical.mime,
    );
    failureStage = "probe_provider";
    const rawProbe = await (dependencies.probe ?? defaultProbe)(
      buildEvidencePackageProbeRequest({
        directive: slot.directive,
        identityAnchor: references.anchor,
        originalTarget: references.originalTarget,
        acceptedEvidence: references.acceptedCrop,
        candidate: composerImage(canonical),
      }),
    );
    failureStage = "probe_parse";
    const response = parseEvidencePackageProbeResponse(rawProbe);
    failureStage = "probe_assessment";
    const assessment = assessEvidencePackageProbe({
      directive: slot.directive,
      response,
    });
    generated = {
      generationId: audit.generationId,
      candidate: {
        angle: slot.angle,
        storageUrl: uploaded.url,
        storageKey: uploaded.key,
        engine: INK_ADD_IMAGE_ENGINE,
        pointsCost: slotCost(slot.angle),
        sourceAssetId: slot.target.id,
        featureVersionId: authority.graph.version.id,
        requiredVisibleAnatomicalSide:
          slot.directive.requiredVisibleAnatomicalSide,
        observedVisibleAnatomicalSide:
          assessment.outcome === "pass"
            ? assessment.observedVisibleAnatomicalSide
            : response.observedVisibleAnatomicalSide,
        observedTravelDirection:
          assessment.outcome === "pass"
            ? assessment.observedTravelDirection
            : response.observedTravelDirection,
        cleanupBatchId,
      },
    };
    if (assessment.outcome === "pass") return { type: "passed", generated };
    log.info({
      modelId: authority.model.id,
      angle: slot.angle,
      attemptNumber: input.attemptNumber,
      failureCode: assessment.failure,
    }, "Evidence package candidate rejected");
    failureStage = "candidate_cleanup";
    await deleteCandidate(dependencies, generated, {
      userId: authority.model.userId,
      operationId: input.operationId,
    });
    generated = null;
    const retry = input.attemptNumber === 1
      ? retryDirectives(assessment.failure)
      : null;
    failureStage = "audit_close";
    await (dependencies.updateAudit ?? updateGeneration)(audit.generationId, {
      status: retry ? "completed" : "failed",
      errorMessage: retry ? null : PACKAGE_FAILURE,
      metadata: {
        ...auditMetadata,
        failureCode: assessment.failure,
      },
      completedAt: new Date(),
    });
    return retry
      ? { type: "retry", directives: retry }
      : { type: "failed", failureCode: assessment.failure };
  } catch (error) {
    log.warn({
      modelId: authority.model.id,
      angle: slot.angle,
      attemptNumber: input.attemptNumber,
      failureStage,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }, "Evidence package attempt execution failed");
    if (generated) {
      await deleteCandidate(dependencies, generated, {
        userId: authority.model.userId,
        operationId: input.operationId,
      });
    }
    await (dependencies.updateAudit ?? updateGeneration)(audit.generationId, {
      status: "failed",
      errorMessage: PACKAGE_FAILURE,
      metadata: {
        ...auditMetadata,
        failureCode: "execution_error",
        failureStage,
      },
      completedAt: new Date(),
    }).catch(() => undefined);
    throw error;
  }
}

async function loadSlotReferences(
  dependencies: EvidencePackageExecutionDependencies,
  authority: EvidencePackagePrivateLegacyAuthority,
  slot: EvidencePackagePrivateSlotAuthority,
): Promise<{
  anchor: ComposerImage;
  originalTarget: ComposerImage;
  guidedTarget: ComposerImage;
  acceptedPlate: ComposerImage;
  acceptedCrop: ComposerImage;
}> {
  const fetchImage = dependencies.fetchImage ?? fetchTrustedImage;
  const [anchor, target, acceptedPlate] = await Promise.all([
    fetchImage(authority.identityAnchor.storageUrl),
    fetchImage(slot.target.storageUrl),
    readPrivateExact(dependencies.delivery, authority.acceptedPlate),
  ]);
  const acceptedCrop = await buildEvidenceContextCrop({
    acceptedPlateBytes: acceptedPlate.bytes,
    side: authority.graph.version.side as InkAddSide,
    ontologyVersion: authority.graph.version.ontologyVersion,
    zone: authority.graph.version.zone,
    surface: authority.graph.version.surface,
    // This executor remains the immutable v1 anterior-torso reader until the
    // v2 multi-feature executor lands. Its closed graph proof already requires
    // the legacy Front source even though 0015 widens the stored enum.
    sourceViewAngle: INK_ADD_TARGET_VIEW,
  });
  const guidedTarget = await buildEvidenceGuidedTarget({
    targetBytes: target.bytes,
    directive: slot.directive,
    featureSide: authority.graph.version.side as InkAddSide,
  });
  return {
    anchor: composerImage(anchor),
    originalTarget: composerImage(target),
    guidedTarget: composerImage(guidedTarget),
    acceptedPlate,
    acceptedCrop: composerImage(acceptedCrop),
  };
}

function v2FeatureZone(
  feature: EvidencePackagePrivateV2SlotAuthority["angleAuthority"]["features"][number],
  angle: EvidencePackagePrivateV2SlotAuthority["angle"],
) {
  const entry = feature.entry;
  if (entry.contract === "legacy_front_upper_torso_v1") {
    const directive = inkPackageDirective({
      capabilityKey: "ink.add.front_upper_torso.v1",
      ontologyVersion: entry.version.ontologyVersion,
      zone: entry.version.zone,
      surface: entry.version.surface,
      side: entry.version.side,
      angle,
    });
    if (!directive?.normalizedTargetZone) {
      throw new TypeError("Saved tattoo evidence has no target geometry");
    }
    return directive.normalizedTargetZone;
  }
  const anatomy = {
    zone: entry.version.zone,
    surface: entry.version.surface,
    side: entry.version.side,
  };
  assertSupportedInkAnatomyTuple(anatomy);
  const directive = inkViewDirectiveV2(anatomy, angle);
  if (!directive.normalizedTargetZone) {
    throw new TypeError("Saved tattoo evidence has no target geometry");
  }
  return directive.normalizedTargetZone;
}

async function loadV2SlotReferences(
  dependencies: EvidencePackageExecutionDependencies,
  authority: EvidencePackagePrivateV2Authority,
  slot: EvidencePackagePrivateV2SlotAuthority,
): Promise<{
  anchor: ComposerImage;
  originalTarget: ComposerImage;
  guidedTarget: ComposerImage;
  evidenceMosaic: ComposerImage;
  features: readonly InkProjectionFeatureReference[];
}> {
  if (slot.angleAuthority.requiresCoverageProbe) {
    throw new EvidencePackageAuthorityError("slot_unavailable");
  }
  const relevant = slot.angleAuthority.features.filter(
    (feature) =>
      feature.impact === "affected"
      || (
        feature.impact === "uncertain"
        && feature.acceptedEvidenceAssetId !== null
      ),
  );
  if (
    relevant.length < 1
    || relevant.some((feature) => feature.requiresProjectionCandidate)
  ) {
    throw new EvidencePackageAuthorityError("slot_unavailable");
  }
  const fetchImage = dependencies.fetchImage ?? fetchTrustedImage;
  const [anchorFetched, targetFetched] = await Promise.all([
    fetchImage(authority.identityAnchor.storageUrl),
    fetchImage(slot.target.storageUrl),
  ]);
  const features: InkProjectionFeatureReference[] = await Promise.all(
    relevant.map(async (feature) => {
      const entry = feature.entry;
      const acceptedProjection = entry.projections.find(
        (projection) =>
          projection.evidence.targetViewAngle === slot.angle,
      );
      const acceptedAtTarget = entry.version.sourceViewAngle === slot.angle;
      const witnessPlate = acceptedAtTarget
        ? entry.authoringPlate
        : acceptedProjection?.plate ?? entry.authoringPlate;
      const witnessAngle = acceptedAtTarget
        ? entry.version.sourceViewAngle
        : acceptedProjection?.evidence.targetViewAngle
          ?? entry.version.sourceViewAngle;
      const anatomyLabel = entry.contract === "all_body_v2"
        ? (() => {
            const anatomy = {
              zone: entry.version.zone,
              surface: entry.version.surface,
              side: entry.version.side,
            };
            assertSupportedInkAnatomyTuple(anatomy);
            return inkAnatomyLabel(anatomy);
          })()
        : `${entry.version.side} chest`;
      return {
        featureId: entry.feature.id,
        featureVersionId: entry.version.id,
        normalizedDescriptor: entry.version.normalizedDescriptor,
        anatomyLabel,
        targetZone: v2FeatureZone(feature, slot.angle),
        witnessZone: v2FeatureZone(feature, witnessAngle),
        witness: await readPrivateExact(dependencies.delivery, witnessPlate),
        isProjectionTarget: false,
      };
    }),
  );
  const target = composerImage(targetFetched);
  const [guide, mosaic] = await Promise.all([
    buildMultiAnatomicalInkZoneGuide({
      targetBytes: target.bytes,
      zones: features.map((feature) => ({
        normalizedZone: feature.targetZone,
        label: feature.anatomyLabel,
      })),
    }),
    buildInkEvidenceMosaic(features, { requireProjectionTarget: false }),
  ]);
  return {
    anchor: composerImage(anchorFetched),
    originalTarget: target,
    guidedTarget: composerImage(guide),
    evidenceMosaic: composerImage(mosaic),
    features: Object.freeze(features),
  };
}

function projectionFailure(
  probe: ReturnType<typeof assessInkProjectionProbe>,
): EvidencePackageProbeFailure | null {
  if (probe.overallOutcome === "pass") return null;
  if (probe.identityOutcome !== "pass") return "identity_mismatch";
  if (probe.poseFramingOutcome !== "pass") return "framing_mismatch";
  if (probe.placementOutcome !== "pass") return "feature_placement_failed";
  if (
    probe.featureMatchOutcome !== "pass"
    || probe.priorInkOutcome !== "pass"
  ) {
    return "feature_match_failed";
  }
  if (probe.unexpectedInkOutcome !== "pass") return "unexpected_feature";
  return "probe_unknown";
}

function projectionRetryDirectives(
  directives: ReturnType<typeof retryDirectives> | undefined,
): readonly InkRetryDirective[] | undefined {
  if (!directives) return undefined;
  return Array.from(new Set(directives.map((directive): InkRetryDirective => {
    switch (directive) {
      case "identity":
        return "identity";
      case "placement":
        return "placement";
      case "feature_match":
        return "feature";
      case "unexpected_feature":
        return "unexpected_ink";
      case "framing":
      case "visible_side":
        return "pose_framing";
    }
  })));
}

async function runV2CandidateAttempt(input: {
  dependencies: EvidencePackageExecutionDependencies;
  authority: EvidencePackagePrivateV2Authority;
  slot: EvidencePackagePrivateV2SlotAuthority;
  references: Awaited<ReturnType<typeof loadV2SlotReferences>>;
  attemptNumber: 1 | 2;
  retry?: ReturnType<typeof retryDirectives>;
  operationId: string;
}): Promise<
  | { type: "passed"; generated: GeneratedCandidate }
  | { type: "retry"; directives: NonNullable<ReturnType<typeof retryDirectives>> }
  | { type: "failed"; failureCode: EvidencePackageProbeFailure }
> {
  const { dependencies, authority, slot, references } = input;
  const publicStorageKey = [
    "evidence-package",
    String(authority.model.userId),
    String(authority.model.id),
    slot.angle,
    `${dependencies.generateId?.() ?? randomUUID()}.png`,
  ].join("/");
  const cleanupBatchId = await (
    dependencies.reserveCleanup ?? reservePublicCleanup
  )({
    userId: authority.model.userId,
    operationId: input.operationId,
    storageKey: publicStorageKey,
  });
  const auditMetadata = {
    source: "evidence_package_sync_v2" as const,
    viewType: slot.angle,
    attemptNumber: input.attemptNumber,
    publicStorageKey,
    featureCount: references.features.length,
  };
  const audit = await (dependencies.createAudit ?? createGeneration)({
    userId: authority.model.userId,
    modelId: authority.model.id,
    operationId: input.operationId,
    stepKey: `view:${slot.angle}`,
    viewAngle: slot.angle,
    type: "multiView",
    status: "processing",
    pointsCost: slotCost(slot.angle),
    metadata: auditMetadata,
  });
  if (!audit.success || !audit.generationId) {
    throw new Error("Evidence package audit could not start");
  }
  let generated: GeneratedCandidate | null = null;
  let failureStage: EvidencePackageExecutionStage = "generation_provider";
  try {
    const dataUrl = await (dependencies.generate ?? defaultGenerate)(
      buildInkProjectionComposerRequest({
        purpose: "refresh",
        identityText: authority.identity.identityText,
        sourceAngle: slot.target.viewType,
        targetAngle: slot.angle,
        features: references.features,
        attemptNumber: input.attemptNumber,
        identityAnchor: references.anchor,
        guidedTarget: references.guidedTarget,
        evidenceMosaic: references.evidenceMosaic,
        retryDirectives: projectionRetryDirectives(input.retry),
      }),
    );
    failureStage = "candidate_validation";
    const canonical = await (
      dependencies.canonicalize ?? canonicalizeEvidenceDataUrl
    )(dataUrl);
    failureStage = "candidate_storage";
    const uploaded = await (dependencies.putPublic ?? storagePut)(
      publicStorageKey,
      canonical.bytes,
      canonical.mime,
    );
    failureStage = "probe_provider";
    const rawProbe = await (dependencies.probe ?? defaultProbe)(
      buildInkProjectionProbeRequest({
        purpose: "refresh",
        sourceAngle: slot.target.viewType,
        targetAngle: slot.angle,
        features: references.features,
        identityAnchor: references.anchor,
        originalTarget: references.originalTarget,
        evidenceMosaic: references.evidenceMosaic,
        candidate: composerImage(canonical),
      }),
    );
    failureStage = "probe_parse";
    const probe = assessInkProjectionProbe(parseInkProjectionProbeResponse(
      rawProbe,
      references.features.length,
    ));
    failureStage = "probe_assessment";
    const failure = projectionFailure(probe);
    const featureVersionIds = references.features
      .map((feature) => feature.featureVersionId)
      .sort();
    generated = {
      generationId: audit.generationId,
      candidate: {
        angle: slot.angle,
        storageUrl: uploaded.url,
        storageKey: uploaded.key,
        engine: INK_ADD_IMAGE_ENGINE,
        pointsCost: slotCost(slot.angle),
        sourceAssetId: slot.target.id,
        featureVersionId: featureVersionIds[0],
        featureVersionIds,
        evidenceContract: "all_body_v2",
        requiredVisibleAnatomicalSide: null,
        observedVisibleAnatomicalSide: "unknown",
        observedTravelDirection: "unknown",
        cleanupBatchId,
      },
    };
    if (!failure) return { type: "passed", generated };
    log.info({
      modelId: authority.model.id,
      angle: slot.angle,
      attemptNumber: input.attemptNumber,
      failureCode: failure,
    }, "Evidence package v2 candidate rejected");
    failureStage = "candidate_cleanup";
    await deleteCandidate(dependencies, generated, {
      userId: authority.model.userId,
      operationId: input.operationId,
    });
    generated = null;
    const retry = input.attemptNumber === 1
      ? retryDirectives(failure)
      : null;
    failureStage = "audit_close";
    await (dependencies.updateAudit ?? updateGeneration)(audit.generationId, {
      status: retry ? "completed" : "failed",
      errorMessage: retry ? null : PACKAGE_FAILURE,
      metadata: { ...auditMetadata, failureCode: failure },
      completedAt: new Date(),
    });
    return retry
      ? { type: "retry", directives: retry }
      : { type: "failed", failureCode: failure };
  } catch (error) {
    log.warn({
      modelId: authority.model.id,
      angle: slot.angle,
      attemptNumber: input.attemptNumber,
      failureStage,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }, "Evidence package v2 attempt execution failed");
    if (generated) {
      await deleteCandidate(dependencies, generated, {
        userId: authority.model.userId,
        operationId: input.operationId,
      });
    }
    await (dependencies.updateAudit ?? updateGeneration)(audit.generationId, {
      status: "failed",
      errorMessage: PACKAGE_FAILURE,
      metadata: {
        ...auditMetadata,
        failureCode: "execution_error",
        failureStage,
      },
      completedAt: new Date(),
    }).catch(() => undefined);
    throw error;
  }
}

async function createFailure(input: {
  dependencies: EvidencePackageExecutionDependencies;
  authority: EvidencePackagePrivateAuthority;
  slot:
    | EvidencePackagePrivateSlotAuthority
    | EvidencePackagePrivateV2SlotAuthority;
  chargeReferenceId: string;
  failureCode: EvidencePackageExecutionFailureCode;
}): Promise<EvidencePackageSyncResult["failed"][number]> {
  const cost = slotCost(input.slot.angle);
  const refund: RefundOutcome = await (
    input.dependencies.refund ?? recordRefund
  )(
    input.authority.model.userId,
    cost,
    `Evidence package: ${input.slot.angle} failed (refund)`,
    `${input.chargeReferenceId}:slot:${input.slot.angle}`,
  );
  const refunded = refund.recorded ? cost : 0;
  const marker = await (
    input.dependencies.createFailureMarker ?? createModelAsset
  )({
    modelId: input.authority.model.id,
    viewType: input.slot.angle,
    resolution: "1K",
    storageUrl: "",
    pointsCost: 0,
    status: {
      state: "failed",
      reason: PACKAGE_FAILURE,
      refunded,
      refundReference: refund.reference,
      at: new Date().toISOString(),
    },
    provenance: {
      source: "evidence_package_sync",
      ...(input.authority.contract !== "all_body_v2"
        ? { acceptedFeatureVersionId: input.authority.graph.version.id }
        : {
            acceptedFeatureVersionIds: input.authority.graph.entries.map(
              (entry) => entry.version.id,
            ),
          }),
      evidencePackageFailureCode: input.failureCode,
    },
  }).catch(() => ({ success: false as const }));
  return {
    angle: input.slot.angle,
    label: input.authority.plan.slots.find(
      (slot) => slot.angle === input.slot.angle,
    )!.label,
    reason: PACKAGE_FAILURE,
    failureCode: input.failureCode,
    refunded,
    refundReference: refund.reference,
    markerPersisted: marker.success,
  };
}

export async function executeEvidencePackageSync(
  dependencies: EvidencePackageExecutionDependencies,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    angles: readonly EvidencePackagePrivateSlotAuthority["angle"][];
    chargeReferenceId: string;
    onCharged?: (amount: number) => void;
    onRefunded?: (amount: number) => void;
  },
): Promise<EvidencePackageSyncResult> {
  const authority = await (
    dependencies.loadAuthority ?? loadLockedEvidencePackageAuthority
  )({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    angles: input.angles,
  });
  const charged = await (dependencies.deduct ?? deductPoints)(
    input.userId,
    authority.plan.totalCost,
    "generation",
    "Evidence package synchronization (pending)",
    input.chargeReferenceId,
    INK_ADD_IMAGE_ENGINE,
  );
  if (!charged.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        charged.error
        || `Insufficient credits. Need ${authority.plan.totalCost} credits.`,
    });
  }
  input.onCharged?.(authority.plan.totalCost);

  const passed: GeneratedCandidate[] = [];
  const failed: EvidencePackageSyncResult["failed"] = [];
  for (let slotIndex = 0; slotIndex < authority.slots.length; slotIndex += 1) {
    const slot = authority.slots[slotIndex];
    let failureCode: EvidencePackageExecutionFailureCode = "execution_error";
    try {
      let outcome:
        | Awaited<ReturnType<typeof runCandidateAttempt>>
        | Awaited<ReturnType<typeof runV2CandidateAttempt>>;
      if (authority.contract !== "all_body_v2") {
        const legacySlot = authority.slots[slotIndex];
        const references = await loadSlotReferences(
          dependencies,
          authority,
          legacySlot,
        );
        outcome = await runCandidateAttempt({
          dependencies,
          authority,
          slot: legacySlot,
          references,
          attemptNumber: 1,
          operationId: input.operationId,
        });
        if (outcome.type === "retry") {
          outcome = await runCandidateAttempt({
            dependencies,
            authority,
            slot: legacySlot,
            references,
            attemptNumber: 2,
            retry: outcome.directives,
            operationId: input.operationId,
          });
        }
      } else {
        const v2Slot = authority.slots[slotIndex];
        const references = await loadV2SlotReferences(
          dependencies,
          authority,
          v2Slot,
        );
        outcome = await runV2CandidateAttempt({
          dependencies,
          authority,
          slot: v2Slot,
          references,
          attemptNumber: 1,
          operationId: input.operationId,
        });
        if (outcome.type === "retry") {
          outcome = await runV2CandidateAttempt({
            dependencies,
            authority,
            slot: v2Slot,
            references,
            attemptNumber: 2,
            retry: outcome.directives,
            operationId: input.operationId,
          });
        }
      }
      if (outcome.type === "passed") {
        passed.push(outcome.generated);
        continue;
      }
      if (outcome.type === "retry") {
        throw new Error("Evidence package retry remained unresolved");
      }
      failureCode = outcome.failureCode;
    } catch (error) {
      log.error({
        modelId: input.modelId,
        angle: slot.angle,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }, "Evidence package view failed");
    }
    const failure = await createFailure({
      dependencies,
      authority,
      slot,
      chargeReferenceId: input.chargeReferenceId,
      failureCode,
    });
    if (failure.refunded > 0) input.onRefunded?.(failure.refunded);
    failed.push(failure);
  }

  let refreshed: EvidencePackageSyncResult["refreshed"] = [];
  if (passed.length > 0) {
    try {
      const committed = await (
        dependencies.commit ?? commitEvidencePackageSyncSnapshot
      )({
        userId: input.userId,
        modelId: input.modelId,
        operationId: input.operationId,
        candidates: passed.map((entry) => entry.candidate),
      });
      refreshed = committed.result.refreshed;
      await Promise.all(passed.map((entry) =>
        (dependencies.updateAudit ?? updateGeneration)(entry.generationId, {
          status: "completed",
          resultUrl: entry.candidate.storageUrl,
          completedAt: new Date(),
        }).catch(() => undefined)
      ));
    } catch (error) {
      if (!(error instanceof TRPCError)) {
        throw new EvidencePackageSettlementUncertainError(error);
      }
      log.error({
        modelId: input.modelId,
        angles: passed.map((entry) => entry.candidate.angle),
        errorName: error instanceof Error ? error.name : "UnknownError",
      }, "Evidence package settlement failed");
      for (const entry of passed) {
        await deleteCandidate(dependencies, entry, {
          userId: input.userId,
          operationId: input.operationId,
        }).catch(() => undefined);
        const slot = authority.slots.find(
          (candidate) => candidate.angle === entry.candidate.angle,
        )!;
        const failure = await createFailure({
          dependencies,
          authority,
          slot,
          chargeReferenceId: input.chargeReferenceId,
          failureCode: "settlement_refused",
        });
        if (failure.refunded > 0) input.onRefunded?.(failure.refunded);
        failed.push(failure);
      }
    }
  }
  return { refreshed, failed };
}
