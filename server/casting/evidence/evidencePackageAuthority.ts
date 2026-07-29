import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  generationOperationLocks,
  generationOperations,
  modelAssets,
  models,
  type Model,
  type ModelAsset,
  type ModelIdentitySnapshot,
  type ModelReferencePlate,
} from "../../../drizzle/schema";
import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import { withTransaction, type TransactionHandle } from "../../db/connection";
import { buildEffectiveCastState } from "../effectiveCastState";
import { availableModelWhere } from "../modelAvailability";
import { modelOperationLockKey } from "../operationContract";
import { readSnapshotShadowStateIn } from "../snapshotShadow";
import {
  assessSupportedInkFeatureGraph,
  computeEvidencePackageSyncPlan,
  type EvidencePackageSlotState,
  type EvidencePackageSyncPlan,
  type SupportedInkFeatureGraph,
} from "./evidencePackagePlan";
import {
  assessClosedInkFeatureGraph,
  type ClosedInkFeatureGraph,
} from "./inkFeatureGraph";
import {
  inkPackageAngleAuthority,
  type InkPackageAngleAuthority,
} from "./inkPackageImpactV2";
import {
  inkPackageDirective,
  type EvidencePackageDirective,
} from "./evidencePackageRegistry";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import { readEvidencePackageFeatureRowsIn } from "./evidencePackageFeatureRows";
import { releasedInkProjectionAngles } from "./inkReleasePolicy";

const PACKAGE_UNAVAILABLE =
  "This Cast's saved feature evidence is unavailable. No credits were used.";

export class EvidencePackageAuthorityError extends Error {
  constructor(
    public readonly code:
      | "feature_graph_unsupported"
      | "operation_unavailable"
      | "slot_unavailable",
  ) {
    super(PACKAGE_UNAVAILABLE);
    this.name = "EvidencePackageAuthorityError";
  }
}

export interface EvidencePackagePrivateSlotAuthority {
  angle: CanonicalViewAngle;
  target: ModelAsset;
  directive: EvidencePackageDirective;
}

export interface EvidencePackagePrivateV2SlotAuthority {
  angle: CanonicalViewAngle;
  target: ModelAsset;
  angleAuthority: InkPackageAngleAuthority;
}

export interface EvidencePackagePrivateLegacyAuthority {
  contract: "legacy_v1";
  model: Model;
  identity: ModelIdentitySnapshot;
  identityAnchor: ModelAsset;
  authoringTruth: ModelAsset;
  graph: SupportedInkFeatureGraph;
  acceptedPlate: ModelReferencePlate;
  plan: EvidencePackageSyncPlan;
  slots: EvidencePackagePrivateSlotAuthority[];
}

export interface EvidencePackagePrivateV2Authority {
  contract: "all_body_v2";
  model: Model;
  identity: ModelIdentitySnapshot;
  identityAnchor: ModelAsset;
  graph: ClosedInkFeatureGraph;
  plan: EvidencePackageSyncPlan;
  slots: EvidencePackagePrivateV2SlotAuthority[];
}

export type EvidencePackagePrivateAuthority =
  | EvidencePackagePrivateLegacyAuthority
  | EvidencePackagePrivateV2Authority;

function fail(
  code: EvidencePackageAuthorityError["code"],
): never {
  throw new EvidencePackageAuthorityError(code);
}

function selectedSlotStates(input: {
  selected: ReadonlyArray<{
    angle: CanonicalViewAngle;
    compatibility: "current" | "stale" | "unverified";
    asset: ModelAsset;
  }>;
  assets: readonly ModelAsset[];
}): EvidencePackageSlotState[] {
  const selectedByAngle = new Map(input.selected.map((view) => [view.angle, view]));
  return CANONICAL_VIEW_ANGLES.map((angle) => {
    const selected = selectedByAngle.get(angle);
    const failed = input.assets.some((asset) => {
      if (asset.viewType !== angle) return false;
      const status = asset.status as { state?: unknown } | null;
      return !asset.storageUrl || status?.state === "failed";
    });
    return {
      angle,
      selectedAssetId: selected?.asset.id ?? null,
      compatibility: selected?.compatibility ?? null,
      pinned: selected?.asset.pinned ?? false,
      failed,
    };
  });
}

async function loadAuthorityRowsIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    angles: readonly CanonicalViewAngle[];
  },
): Promise<EvidencePackagePrivateAuthority> {
  const state = buildEffectiveCastState(
    await readSnapshotShadowStateIn(tx, input),
  );
  if (state.status !== "current") fail("feature_graph_unsupported");
  const featureRows = await readEvidencePackageFeatureRowsIn(tx, {
    userId: input.userId,
    modelId: input.modelId,
    identitySnapshotId: state.identity.id,
  });
  const slotStates = selectedSlotStates({
    selected: state.selectedViews,
    assets: state.ledger.assets,
  });
  const plan = computeEvidencePackageSyncPlan({
    modelId: input.modelId,
    modelStatus: state.model.status,
    graph: featureRows.graph,
    slots: slotStates,
    requestedAngles: input.angles,
    requiredMintAngles: CANONICAL_VIEW_ANGLES,
    hasUnresolvedIntentOrReadyCandidate:
      featureRows.hasUnresolvedIntentOrReadyCandidate,
    releasedProjectionAngles: releasedInkProjectionAngles(),
  });
  const frontFull = state.selectedViews.find((view) => view.angle === "frontFull");
  const closedGraphCandidate = assessClosedInkFeatureGraph(featureRows.graph);
  const closedGraph = closedGraphCandidate?.entries.some(
    (entry) => entry.contract === "all_body_v2",
  )
    ? closedGraphCandidate
    : null;
  const legacyGraph = !closedGraph
    ? assessSupportedInkFeatureGraph(
        featureRows.graph,
        frontFull?.asset.id ?? null,
      )
    : null;
  if (!plan.supported || (!closedGraph && !legacyGraph)) {
    fail("feature_graph_unsupported");
  }
  const requested = new Set(input.angles);
  if (
    plan.actionableAngles.length !== requested.size
    || plan.actionableAngles.some((angle) => !requested.has(angle))
  ) {
    fail("slot_unavailable");
  }
  const planByAngle = new Map(plan.slots.map((slot) => [slot.angle, slot]));
  if (
    closedGraph
    && input.angles.some(
      (angle) => planByAngle.get(angle)?.action !== "refresh",
    )
  ) {
    fail("slot_unavailable");
  }
  const selectedByAngle = new Map(
    state.selectedViews.map((view) => [view.angle, view.asset]),
  );
  if (closedGraph) {
    const graphAssetById = new Map(featureRows.graph.assets!.map(
      (asset) => [asset.id, asset],
    ));
    const slots = input.angles.map((angle) => {
      const angleAuthority = inkPackageAngleAuthority(closedGraph, angle);
      const evidenceTarget = angleAuthority.features
        .map((feature) => feature.acceptedEvidenceAssetId)
        .filter((id): id is number => id !== null)
        .map((id) => graphAssetById.get(id))
        .find((asset): asset is ModelAsset => Boolean(asset));
      const target = selectedByAngle.get(angle) ?? evidenceTarget;
      if (
        !target?.storageUrl?.trim()
        || angleAuthority.requiresProjectionCandidate
      ) {
        fail("slot_unavailable");
      }
      return { angle, target, angleAuthority };
    });
    return {
      contract: "all_body_v2",
      model: state.model,
      identity: state.identity,
      identityAnchor: state.anchor,
      graph: closedGraph,
      plan,
      slots,
    };
  }
  if (!frontFull || !legacyGraph) {
    fail("feature_graph_unsupported");
  }
  const slots = input.angles.map((angle) => {
    const directive = inkPackageDirective({
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      ontologyVersion: legacyGraph.version.ontologyVersion,
      zone: legacyGraph.version.zone,
      surface: legacyGraph.version.surface,
      side: legacyGraph.version.side,
      angle,
    });
    const target = selectedByAngle.get(angle) ?? frontFull.asset;
    if (
      !directive
      || directive.visibility === "authoring_truth"
      || !target.storageUrl?.trim()
    ) {
      fail("slot_unavailable");
    }
    return { angle, target, directive };
  });
  return {
    contract: "legacy_v1",
    model: state.model,
    identity: state.identity,
    identityAnchor: state.anchor,
    authoringTruth: frontFull.asset,
    graph: legacyGraph,
    acceptedPlate: legacyGraph.plate,
    plan,
    slots,
  };
}

export async function planEvidencePackageSync(input: {
  userId: number;
  modelId: number;
  angles: readonly CanonicalViewAngle[];
}): Promise<EvidencePackageSyncPlan> {
  return withTransaction(async (tx) =>
    (await loadAuthorityRowsIn(tx, input)).plan
  );
}

export type EvidencePackageRouteAuthority =
  | { type: "featureless" }
  | { type: "supported"; plan: EvidencePackageSyncPlan }
  | { type: "unsupported" };

export type EvidencePackagePlanRouteAuthority =
  | { type: "featureless" }
  | { type: "supported"; plan: EvidencePackageSyncPlan }
  | { type: "unsupported"; plan: EvidencePackageSyncPlan };

async function inspectEvidencePackageRoutePlanIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    angles?: readonly CanonicalViewAngle[];
  },
): Promise<EvidencePackagePlanRouteAuthority> {
  const state = buildEffectiveCastState(
    await readSnapshotShadowStateIn(tx, input),
  );
  if (state.status !== "current") return { type: "featureless" };
  const featureRows = await readEvidencePackageFeatureRowsIn(tx, {
    userId: input.userId,
    modelId: input.modelId,
    identitySnapshotId: state.identity.id,
  });
  if (featureRows.graph.selections.length === 0) {
    return { type: "featureless" };
  }
  const plan = computeEvidencePackageSyncPlan({
    modelId: input.modelId,
    modelStatus: state.model.status,
    graph: featureRows.graph,
    slots: selectedSlotStates({
      selected: state.selectedViews,
      assets: state.ledger.assets,
    }),
    requestedAngles: input.angles,
    requiredMintAngles: CANONICAL_VIEW_ANGLES,
    hasUnresolvedIntentOrReadyCandidate:
      featureRows.hasUnresolvedIntentOrReadyCandidate,
    releasedProjectionAngles: releasedInkProjectionAngles(),
  });
  return plan.supported
    ? { type: "supported", plan }
    : { type: "unsupported", plan };
}

/**
 * Read-only planning authority for product surfaces. Unlike execute
 * classification, this returns the complete public plan even when only some
 * views are actionable. Private evidence rows and recipe details never cross
 * the route boundary.
 */
export async function inspectEvidencePackageRoutePlan(input: {
  userId: number;
  modelId: number;
  angles?: readonly CanonicalViewAngle[];
}): Promise<EvidencePackagePlanRouteAuthority> {
  return withTransaction((tx) => inspectEvidencePackageRoutePlanIn(tx, input));
}

/**
 * Read-only route discriminator. It reveals no feature detail: the only
 * outward decision is whether the request remains in the ordinary family,
 * may enter the evidence-aware executor, or must refuse free.
 */
export async function classifyEvidencePackageRouteAuthority(input: {
  userId: number;
  modelId: number;
  angles: readonly CanonicalViewAngle[];
}): Promise<EvidencePackageRouteAuthority> {
  return withTransaction(async (tx) => {
    const authority = await inspectEvidencePackageRoutePlanIn(tx, input);
    if (authority.type !== "supported") {
      return { type: authority.type };
    }
    const { plan } = authority;
    const requested = new Set(input.angles);
    const requestedPlans = plan.slots.filter((slot) => requested.has(slot.angle));
    return plan.actionableAngles.length === requested.size
      && plan.actionableAngles.every((angle) => requested.has(angle))
      && requestedPlans.every((slot) => slot.action !== "projection")
      ? { type: "supported", plan }
      : { type: "unsupported" };
  });
}

/**
 * Positive, lock-scoped execution authority. The durable operation lock is
 * the inter-request exclusion fence; every selected feature row and image
 * locator is reloaded only after the model, receipt and lock are proven.
 */
export async function loadLockedEvidencePackageAuthority(input: {
  userId: number;
  modelId: number;
  operationId: string;
  angles: readonly CanonicalViewAngle[];
}): Promise<EvidencePackagePrivateAuthority> {
  return withTransaction(async (tx) => {
    const [model] = await tx
      .select({ id: models.id })
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .limit(1)
      .for("update");
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
    }
    const [operation] = await tx
      .select({
        id: generationOperations.id,
        kind: generationOperations.kind,
        status: generationOperations.status,
      })
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.modelId, input.modelId),
      ))
      .limit(1)
      .for("update");
    if (
      !operation
      || operation.kind !== "evidence_package_sync"
      || operation.status !== "running"
    ) {
      fail("operation_unavailable");
    }
    const [lock] = await tx
      .select({ operationId: generationOperationLocks.operationId })
      .from(generationOperationLocks)
      .where(eq(
        generationOperationLocks.lockKey,
        modelOperationLockKey(input.modelId),
      ))
      .limit(1)
      .for("update");
    if (lock?.operationId !== input.operationId) {
      fail("operation_unavailable");
    }
    return loadAuthorityRowsIn(tx, input);
  });
}
