import type {
  ModelAsset,
  ModelIdentityFeature,
  ModelIdentityFeatureProjectionEvidence,
  ModelIdentityFeatureVersion,
  ModelReferencePlate,
  ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import {
  CANONICAL_VIEW_ANGLES,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import {
  isModelAvailableStatus,
  isModelDraftStatus,
} from "../../../shared/modelLifecycle";
import { slotCost } from "../packagePricing";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_TARGET_VIEW,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import {
  inkPackageDirective,
  type EvidencePackageDirective,
} from "./evidencePackageRegistry";
import { parseEvidenceStorageKey } from "./evidenceDelivery";
import {
  MAX_EVIDENCE_CANONICAL_BYTES,
  MAX_EVIDENCE_DIMENSION,
  MAX_EVIDENCE_PIXELS,
  MIN_EVIDENCE_DIMENSION,
} from "./imageValidation";
import { assessClosedInkFeatureGraph } from "./inkFeatureGraph";
import {
  inkPackageAngleAuthority,
  type InkPackageAngleAuthority,
} from "./inkPackageImpactV2";

export const EVIDENCE_PACKAGE_REFUSALS = [
  "feature_graph_unsupported",
  "model_unavailable",
  "identity_anchor",
  "authoring_truth",
  "pinned",
  "already_current",
  "compatibility_repair_required",
  "compatibility_unverified",
  "angle_not_supported",
  "projection_not_calibrated",
] as const;
export type EvidencePackageRefusal = typeof EVIDENCE_PACKAGE_REFUSALS[number];

export interface EvidencePackageSlotState {
  angle: CanonicalViewAngle;
  selectedAssetId: number | null;
  compatibility: "current" | "stale" | "unverified" | null;
  pinned: boolean;
  failed: boolean;
}

export interface EvidencePackageFeatureGraph {
  userId: number;
  modelId: number;
  identitySnapshotId: string;
  selections: readonly ModelSnapshotFeatureSelection[];
  features: readonly ModelIdentityFeature[];
  versions: readonly ModelIdentityFeatureVersion[];
  plates: readonly ModelReferencePlate[];
  /** R7-7G positive-closure inputs. Optional only for historical unit fixtures. */
  projections?: readonly ModelIdentityFeatureProjectionEvidence[];
  assets?: readonly ModelAsset[];
}

export interface SupportedInkFeatureGraph {
  selection: ModelSnapshotFeatureSelection;
  feature: ModelIdentityFeature;
  version: ModelIdentityFeatureVersion;
  plate: ModelReferencePlate;
}

function positiveId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Positive closure proof for the pilot graph. Absence of a known bad row is
 * never enough: the exact selection, feature, version, accepted plate, source
 * accepted asset, recipe and ontology must all agree. The pre-edit source is
 * retained when the Cast owns it; forks honestly carry null because they do
 * not copy stale, unselected source assets.
 */
export function assessSupportedInkFeatureGraph(
  graph: EvidencePackageFeatureGraph,
  frontFullAssetId: number | null,
): SupportedInkFeatureGraph | null {
  if (
    !positiveId(graph.userId)
    || !positiveId(graph.modelId)
    || !graph.identitySnapshotId
    || graph.selections.length !== 1
    || graph.features.length !== 1
    || graph.versions.length !== 1
    || graph.plates.length !== 1
    || !positiveId(frontFullAssetId ?? 0)
  ) {
    return null;
  }
  const selection = graph.selections[0];
  const feature = graph.features[0];
  const version = graph.versions[0];
  const plate = graph.plates[0];
  let parsedPlateKey;
  try {
    parsedPlateKey = parseEvidenceStorageKey(plate.storageKey);
  } catch {
    return null;
  }
  if (
    selection.modelId !== graph.modelId
    || selection.identitySnapshotId !== graph.identitySnapshotId
    || selection.featureId !== feature.id
    || selection.featureVersionId !== version.id
    || feature.modelId !== graph.modelId
    || feature.category !== "ink"
    || version.modelId !== graph.modelId
    || version.featureId !== feature.id
    || version.operation !== "present"
    || version.ontologyVersion !== INK_ADD_ONTOLOGY_VERSION
    || version.zone !== INK_ADD_ZONE
    || version.surface !== INK_ADD_SURFACE
    || version.sourceViewAngle !== INK_ADD_TARGET_VIEW
    || !positiveId(version.acceptedAssetId ?? 0)
    || version.acceptedAssetId !== frontFullAssetId
    || (
      version.sourceAssetId !== null
      && (
        !positiveId(version.sourceAssetId)
        || version.sourceAssetId === version.acceptedAssetId
      )
    )
    || version.recipeVersion !== INK_ADD_COMPOSER_RECIPE_VERSION
    || version.acceptedCandidatePlateId !== plate.id
    || plate.userId !== graph.userId
    || plate.modelId !== graph.modelId
    || plate.kind !== "accepted_candidate"
    || parsedPlateKey.userId !== graph.userId
    || parsedPlateKey.modelId !== graph.modelId
    || plate.mime !== "image/webp"
    || !Number.isSafeInteger(plate.byteSize)
    || plate.byteSize <= 0
    || plate.byteSize > MAX_EVIDENCE_CANONICAL_BYTES
    || !/^[0-9a-f]{64}$/.test(plate.contentHash)
    || !Number.isSafeInteger(plate.width)
    || !Number.isSafeInteger(plate.height)
    || plate.width < MIN_EVIDENCE_DIMENSION
    || plate.height < MIN_EVIDENCE_DIMENSION
    || plate.width > MAX_EVIDENCE_DIMENSION
    || plate.height > MAX_EVIDENCE_DIMENSION
    || plate.width * plate.height > MAX_EVIDENCE_PIXELS
  ) {
    return null;
  }
  if (!inkPackageDirective({
    capabilityKey: INK_ADD_CAPABILITY_KEY,
    ontologyVersion: version.ontologyVersion,
    zone: version.zone,
    surface: version.surface,
    side: version.side,
    angle: INK_ADD_TARGET_VIEW,
  })) {
    return null;
  }
  return { selection, feature, version, plate };
}

export type EvidencePackageSlotStatus =
  | "current"
  | "stale"
  | "failed"
  | "missing"
  | "attention";

export interface EvidencePackagePlanSlot {
  angle: CanonicalViewAngle;
  label: string;
  status: EvidencePackageSlotStatus;
  cost: number;
  refusal: EvidencePackageRefusal | null;
  /** Present for the R7-7G closed multi-feature planner. */
  action?: "refresh" | "projection" | null;
  /** A free observed-coverage check must pass before any charged action. */
  requiresCoverageProbe?: boolean;
}

export interface EvidencePackageSyncPlan {
  modelId: number;
  supported: boolean;
  slots: EvidencePackagePlanSlot[];
  actionableAngles: CanonicalViewAngle[];
  refreshableAngles: CanonicalViewAngle[];
  missingAngles: CanonicalViewAngle[];
  totalCost: number;
  zeroGenerationMintAvailable: boolean;
}

function normalizeSlots(
  slots: readonly EvidencePackageSlotState[],
): Map<CanonicalViewAngle, EvidencePackageSlotState> | null {
  if (
    slots.length !== CANONICAL_VIEW_ANGLES.length
    || new Set(slots.map((slot) => slot.angle)).size !== slots.length
  ) {
    return null;
  }
  const map = new Map(slots.map((slot) => [slot.angle, slot]));
  return CANONICAL_VIEW_ANGLES.every((angle) => map.has(angle)) ? map : null;
}

function attentionSlot(
  angle: CanonicalViewAngle,
  refusal: EvidencePackageRefusal,
): EvidencePackagePlanSlot {
  return {
    angle,
    label: VIEW_ANGLE_LABELS[angle],
    status: "attention",
    cost: 0,
    refusal,
  };
}

function slotPlan(input: {
  slot: EvidencePackageSlotState;
  directive: EvidencePackageDirective | null;
}): EvidencePackagePlanSlot {
  const { slot, directive } = input;
  if (slot.angle === "frontClose") return attentionSlot(slot.angle, "identity_anchor");
  if (!directive) return attentionSlot(slot.angle, "angle_not_supported");
  if (directive.visibility === "authoring_truth") {
    return attentionSlot(slot.angle, "authoring_truth");
  }
  if (slot.selectedAssetId !== null) {
    if (slot.pinned) {
      return attentionSlot(slot.angle, "pinned");
    }
    if (slot.compatibility === "unverified" || slot.compatibility === null) {
      return attentionSlot(slot.angle, "compatibility_unverified");
    }
    if (slot.compatibility === "current") {
      return {
        angle: slot.angle,
        label: VIEW_ANGLE_LABELS[slot.angle],
        status: "current",
        cost: 0,
        refusal: "already_current",
      };
    }
    if (directive.existingSelectionImpact === "unaffected") {
      return attentionSlot(slot.angle, "compatibility_repair_required");
    }
    return {
      angle: slot.angle,
      label: VIEW_ANGLE_LABELS[slot.angle],
      status: "stale",
      cost: slotCost(slot.angle),
      refusal: null,
    };
  }
  if (directive.missingViewAuthority !== "compose") {
    return attentionSlot(slot.angle, "angle_not_supported");
  }
  return {
    angle: slot.angle,
    label: VIEW_ANGLE_LABELS[slot.angle],
    status: slot.failed ? "failed" : "missing",
    cost: slotCost(slot.angle),
    refusal: null,
  };
}

function closedGraphSlotPlan(input: {
  slot: EvidencePackageSlotState;
  authority: InkPackageAngleAuthority;
  projectionReleased: boolean;
}): EvidencePackagePlanSlot {
  const { slot, authority } = input;
  if (slot.selectedAssetId !== null) {
    if (slot.pinned) {
      return {
        ...attentionSlot(slot.angle, "pinned"),
        action: null,
        requiresCoverageProbe: authority.requiresCoverageProbe,
      };
    }
    if (slot.compatibility === "unverified" || slot.compatibility === null) {
      return {
        ...attentionSlot(slot.angle, "compatibility_unverified"),
        action: null,
        requiresCoverageProbe: authority.requiresCoverageProbe,
      };
    }
    if (slot.compatibility === "current") {
      return {
        angle: slot.angle,
        label: VIEW_ANGLE_LABELS[slot.angle],
        status: "current",
        cost: 0,
        refusal: "already_current",
        action: null,
        requiresCoverageProbe: false,
      };
    }
    if (authority.impact === "unaffected") {
      return {
        ...attentionSlot(slot.angle, "compatibility_repair_required"),
        action: null,
        requiresCoverageProbe: false,
      };
    }
  }
  if (authority.requiresProjectionCandidate && !input.projectionReleased) {
    return {
      ...attentionSlot(slot.angle, "projection_not_calibrated"),
      action: null,
      requiresCoverageProbe: false,
    };
  }
  const action = authority.requiresProjectionCandidate
    ? "projection"
    : "refresh";
  return {
    angle: slot.angle,
    label: VIEW_ANGLE_LABELS[slot.angle],
    status: slot.selectedAssetId !== null
      ? "stale"
      : slot.failed
        ? "failed"
        : "missing",
    cost: slotCost(slot.angle),
    refusal: null,
    action,
    requiresCoverageProbe: authority.requiresCoverageProbe,
  };
}

/**
 * Pure public plan. Private feature text, row IDs, plate locators and recipe
 * internals never enter the returned shape.
 */
export function computeEvidencePackageSyncPlan(input: {
  modelId: number;
  modelStatus: unknown;
  graph: EvidencePackageFeatureGraph;
  slots: readonly EvidencePackageSlotState[];
  requestedAngles?: readonly CanonicalViewAngle[];
  requiredMintAngles: readonly CanonicalViewAngle[];
  hasUnresolvedIntentOrReadyCandidate: boolean;
  releasedProjectionAngles: readonly CanonicalViewAngle[];
}): EvidencePackageSyncPlan {
  const byAngle = normalizeSlots(input.slots);
  const frontFullAssetId = byAngle?.get("frontFull")?.selectedAssetId ?? null;
  const closedGraphCandidate = byAngle
    ? assessClosedInkFeatureGraph(input.graph)
    : null;
  const closedGraph = closedGraphCandidate?.entries.some(
    (entry) => entry.contract === "all_body_v2",
  )
    ? closedGraphCandidate
    : null;
  const legacyGraph = byAngle && !closedGraph
    ? assessSupportedInkFeatureGraph(input.graph, frontFullAssetId)
    : null;
  const supportedGraph = closedGraph ?? legacyGraph;
  const modelDraft = isModelDraftStatus(input.modelStatus);
  const modelAvailable = isModelAvailableStatus(input.modelStatus);
  const requested = input.requestedAngles
    ? new Set(input.requestedAngles)
    : null;
  const requestedValid = !requested
    || (
      requested.size === input.requestedAngles!.length
      && input.requestedAngles!.every((angle) =>
        (CANONICAL_VIEW_ANGLES as readonly string[]).includes(angle)
      )
    );
  const releasedProjections = new Set(
    input.releasedProjectionAngles,
  );

  if (
    !positiveId(input.modelId)
    || input.graph.modelId !== input.modelId
    || !supportedGraph
    || !byAngle
    || !requestedValid
  ) {
    return {
      modelId: input.modelId,
      supported: false,
      slots: CANONICAL_VIEW_ANGLES.map((angle) =>
        attentionSlot(angle, "feature_graph_unsupported")
      ),
      actionableAngles: [],
      refreshableAngles: [],
      missingAngles: [],
      totalCost: 0,
      zeroGenerationMintAvailable: false,
    };
  }

  const slots = closedGraph
    ? CANONICAL_VIEW_ANGLES.map((angle) => closedGraphSlotPlan({
        slot: byAngle.get(angle)!,
        authority: inkPackageAngleAuthority(closedGraph, angle),
        projectionReleased: releasedProjections.has(angle),
      }))
    : CANONICAL_VIEW_ANGLES.map((angle) => slotPlan({
        slot: byAngle.get(angle)!,
        directive: inkPackageDirective({
          capabilityKey: INK_ADD_CAPABILITY_KEY,
          ontologyVersion: legacyGraph!.version.ontologyVersion,
          zone: legacyGraph!.version.zone,
          surface: legacyGraph!.version.surface,
          side: legacyGraph!.version.side,
          angle,
        }),
      }));
  if (!modelAvailable) {
    return {
      modelId: input.modelId,
      supported: true,
      slots: slots.map((slot) => attentionSlot(slot.angle, "model_unavailable")),
      actionableAngles: [],
      refreshableAngles: [],
      missingAngles: [],
      totalCost: 0,
      zeroGenerationMintAvailable: false,
    };
  }

  const actionable = slots.filter(
    (slot) => slot.refusal === null && (!requested || requested.has(slot.angle)),
  );
  const requiredMintSet = new Set(input.requiredMintAngles);
  const requiredMintAnglesValid =
    requiredMintSet.size === input.requiredMintAngles.length
    && input.requiredMintAngles.every((angle) =>
      (CANONICAL_VIEW_ANGLES as readonly string[]).includes(angle)
    );
  const zeroGenerationMintAvailable =
    modelDraft
    &&
    requiredMintAnglesValid
    && !input.hasUnresolvedIntentOrReadyCandidate
    && input.requiredMintAngles.every(
      (angle) => {
        const slot = byAngle.get(angle);
        return !!slot?.selectedAssetId && slot.compatibility === "current";
      },
    );
  return {
    modelId: input.modelId,
    supported: true,
    slots,
    actionableAngles: actionable.map((slot) => slot.angle),
    refreshableAngles: actionable
      .filter((slot) => slot.status === "stale" || slot.status === "failed")
      .map((slot) => slot.angle),
    missingAngles: actionable
      .filter((slot) => slot.status === "missing")
      .map((slot) => slot.angle),
    totalCost: actionable.reduce((sum, slot) => sum + slot.cost, 0),
    zeroGenerationMintAvailable,
  };
}
