import { TRPCError } from "@trpc/server";
import type { TransactionHandle } from "../../db/connection";
import { withTransaction } from "../../db/connection";
import {
  MINT_TIER_SLOTS,
  type CanonicalViewAngle,
  type MintTier,
} from "../../../shared/boardTypes";
import { isModelDraftStatus } from "../../../shared/modelLifecycle";
import { buildEffectiveCastState, type EffectiveCastState } from "../effectiveCastState";
import { planMintPackageFromEffectiveState } from "../mintPackage";
import { readSnapshotShadowStateIn } from "../snapshotShadow";
import {
  CastPublicIdAllocationError,
  withUniqueCastPublicId,
} from "../castPublicId";
import {
  commitEvidenceMintSnapshot,
  type SnapshotTransitionResult,
} from "../snapshotTransitions";
import {
  assessSupportedInkFeatureGraph,
} from "./evidencePackagePlan";
import { readEvidencePackageFeatureRowsIn } from "./evidencePackageFeatureRows";

export interface EvidenceMintTierPlan {
  ready: boolean;
  requiredAngles: CanonicalViewAngle[];
  missingAngles: CanonicalViewAngle[];
  staleAngles: CanonicalViewAngle[];
  attentionAngles: CanonicalViewAngle[];
}

export interface EvidenceMintPlan {
  modelId: number;
  supported: boolean;
  zeroGeneration: true;
  tiers: Record<MintTier, EvidenceMintTierPlan>;
}

function unavailableTier(tier: MintTier): EvidenceMintTierPlan {
  return {
    ready: false,
    requiredAngles: [...MINT_TIER_SLOTS[tier]],
    missingAngles: [],
    staleAngles: [],
    attentionAngles: [],
  };
}

function unsupportedPlan(modelId: number): EvidenceMintPlan {
  return {
    modelId,
    supported: false,
    zeroGeneration: true,
    tiers: {
      draft: unavailableTier("draft"),
      core: unavailableTier("core"),
      production: unavailableTier("production"),
    },
  };
}

export function computeEvidenceMintPlan(input: {
  state: Extract<EffectiveCastState, { status: "current" }>;
  supported: boolean;
  pendingEvidence: boolean;
}): EvidenceMintPlan {
  if (!input.supported) return unsupportedPlan(input.state.model.id);
  const ordinary = planMintPackageFromEffectiveState(input.state);
  const selectedByAngle = new Map(
    input.state.selectedViews.map((view) => [view.angle, view]),
  );
  const cleanDraft =
    isModelDraftStatus(input.state.model.status)
    && !input.state.model.agencyId
    && !input.state.model.mintedAt;
  const tiers = {} as Record<MintTier, EvidenceMintTierPlan>;
  for (const tier of ["draft", "core", "production"] as const) {
    const requiredAngles = [...MINT_TIER_SLOTS[tier]];
    const missingAngles: CanonicalViewAngle[] = [];
    const staleAngles: CanonicalViewAngle[] = [];
    const attentionAngles: CanonicalViewAngle[] = [];
    for (const angle of requiredAngles) {
      const selected = selectedByAngle.get(angle);
      if (!selected) {
        missingAngles.push(angle);
      } else if (selected.compatibility === "stale") {
        staleAngles.push(angle);
      } else if (
        selected.compatibility !== "current"
        || !selected.asset.storageUrl?.trim()
      ) {
        attentionAngles.push(angle);
      }
    }
    tiers[tier] = {
      ready:
        cleanDraft
        && !input.pendingEvidence
        && ordinary.integrity[tier].ok
        && missingAngles.length === 0
        && staleAngles.length === 0
        && attentionAngles.length === 0,
      requiredAngles,
      missingAngles,
      staleAngles,
      attentionAngles,
    };
  }
  return {
    modelId: input.state.model.id,
    supported: true,
    zeroGeneration: true,
    tiers,
  };
}

async function loadEvidenceMintPlanIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<{
  state: EffectiveCastState;
  plan: EvidenceMintPlan;
  featureless: boolean;
}> {
  const state = buildEffectiveCastState(
    await readSnapshotShadowStateIn(tx, input),
  );
  if (state.status !== "current") {
    return {
      state,
      plan: unsupportedPlan(input.modelId),
      featureless: true,
    };
  }
  const featureRows = await readEvidencePackageFeatureRowsIn(tx, {
    userId: input.userId,
    modelId: input.modelId,
    identitySnapshotId: state.identity.id,
  });
  if (featureRows.graph.selections.length === 0) {
    return {
      state,
      plan: unsupportedPlan(input.modelId),
      featureless: true,
    };
  }
  const frontFull = state.selectedViews.find(
    (view) => view.angle === "frontFull",
  );
  const graph = assessSupportedInkFeatureGraph(
    featureRows.graph,
    frontFull?.asset.id ?? null,
  );
  if (!graph) {
    return {
      state,
      plan: unsupportedPlan(input.modelId),
      featureless: false,
    };
  }
  return {
    state,
    featureless: false,
    plan: computeEvidenceMintPlan({
      state,
      supported: true,
      pendingEvidence: featureRows.hasUnresolvedIntentOrReadyCandidate,
    }),
  };
}

export async function planEvidenceMint(input: {
  userId: number;
  modelId: number;
}): Promise<EvidenceMintPlan> {
  return withTransaction(async (tx) =>
    (await loadEvidenceMintPlanIn(tx, input)).plan
  );
}

export type EvidenceMintRouteAuthority =
  | { type: "featureless" }
  | { type: "supported"; plan: EvidenceMintPlan }
  | { type: "unsupported"; plan: EvidenceMintPlan };

export async function classifyEvidenceMintRouteAuthority(input: {
  userId: number;
  modelId: number;
}): Promise<EvidenceMintRouteAuthority> {
  return withTransaction(async (tx) => {
    const loaded = await loadEvidenceMintPlanIn(tx, input);
    if (loaded.featureless) return { type: "featureless" };
    return loaded.plan.supported
      ? { type: "supported", plan: loaded.plan }
      : { type: "unsupported", plan: loaded.plan };
  });
}

export interface EvidenceMintResult {
  agencyId: string;
  minted: true;
  tier: MintTier;
  generated: [];
  failed: [];
}

export class EvidenceMintSettlementUncertainError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Evidence mint settlement outcome is uncertain");
    this.name = "EvidenceMintSettlementUncertainError";
    this.cause = cause;
  }
}

type EvidenceMintCommit = typeof commitEvidenceMintSnapshot;

export interface EvidenceMintExecutionDependencies {
  commit?: EvidenceMintCommit;
  allocate?: <T>(commit: (agencyId: string) => Promise<T>) => Promise<T>;
}

export async function executeEvidenceMint(
  dependencies: EvidenceMintExecutionDependencies,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    tier: MintTier;
    name: string;
  },
): Promise<EvidenceMintResult> {
  if (!input.name.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A name is required to mint",
    });
  }
  const commit = dependencies.commit ?? commitEvidenceMintSnapshot;
  const allocate = dependencies.allocate ?? withUniqueCastPublicId;
  try {
    const settled: SnapshotTransitionResult<{
      agencyId: string;
      minted: true;
      tier: MintTier;
      generated: [];
      failedAngles: [];
    }> = await allocate((agencyId) =>
      commit({
        userId: input.userId,
        modelId: input.modelId,
        operationId: input.operationId,
        tier: input.tier,
        agencyId,
        name: input.name,
      })
    );
    return {
      agencyId: settled.result.agencyId,
      minted: true,
      tier: settled.result.tier,
      generated: [],
      failed: [],
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (error instanceof CastPublicIdAllocationError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "A unique Cast ID could not be allocated",
      });
    }
    throw new EvidenceMintSettlementUncertainError(error);
  }
}
