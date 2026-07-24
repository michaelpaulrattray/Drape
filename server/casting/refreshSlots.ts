/**
 * refreshSlots — R5's per-tile quality refresh over the package ledger.
 *
 * Refreshing a slot regenerates that ONE view against the model's CURRENT
 * headshot + identity text (the house pattern, shared with mint via
 * generatePackageSlotCandidate) and commits the successful assets plus one
 * package snapshot atomically. Legacy readers still see the same newest
 * asset rows during the dual-write period.
 *
 * Structural refusals, enforced BEFORE any money moves (D-43/D-15):
 *  - `frontClose` is NEVER refreshable — the headshot IS the minted
 *    identity; regenerating it would cast a different person. Fork is the
 *    identity operation.
 *  - Pinned slots are accepted-final (D-21) — unpin first.
 *  - Unfilled, never-attempted slots are UPGRADES (the mint gate owns
 *    them); a failed-marker slot IS refreshable — that's the retry path.
 *
 * Money: the batch total deducts up front (atomic-credits contract); each
 * slot failure refunds itself NAMED (`Refresh: {label} failed (refund)`).
 * Gated angles (back + walk) pass the identity gate with the same
 * retry-then-refund contract as mint.
 */
import { TRPCError } from "@trpc/server";
import { getModelById, getModelAssets, deductPoints } from "../db";
import {
  computePackageSlots,
  computeEffectivePackageSlots,
  completePreparedPackageSlotAudit,
  failPreparedPackageSlot,
  generatePackageSlotCandidate,
  slotCost,
  type PackageSlot,
  type PreparedPackageSlot,
  type SlotGenContext,
} from "./mintPackage";
import { resolveEffectiveCastStateForRead } from "./effectiveCastRead";
import type { EffectiveCastState } from "./effectiveCastState";
import type { SnapshotReadMode } from "./snapshotReadScope";
import { VIEW_ANGLE_LABELS, type CanonicalViewAngle } from "../../shared/boardTypes";
// V8: refusal law lives in shared/refreshPolicy so the client's stale count
// and this plan's rows derive from the SAME predicate — they cannot disagree
import { refreshRefusalFor, type RefreshRefusal } from "../../shared/refreshPolicy";
import { assertNotArchived } from "./modelGuards";
import { selectIdentityAnchor } from "./identity/anchorSelector";
import { createModuleLogger } from "../logging/logger";
import { commitRefreshedSlotsSnapshot } from "./snapshotTransitions";

const log = createModuleLogger("casting/refreshSlots");

export type { RefreshRefusal };

export interface RefreshSlotInfo {
  angle: CanonicalViewAngle;
  label: string;
  /** slotCost(angle) — CREDIT_COSTS-derived, the D-15 source of truth. */
  cost: number;
  pinned: boolean;
  stale: boolean;
  refusal: RefreshRefusal;
}

export interface RefreshPlan {
  slots: RefreshSlotInfo[];
  /** The angles a refresh may target (refusal === null ∩ requested). */
  refreshable: CanonicalViewAngle[];
  /** Total over `refreshable` — what execute would deduct. */
  totalCost: number;
}

/** Pure — exported for tests. `requested` narrows the refreshable set;
 *  omitted = every non-refused slot (the aggregate-refresh default). */
export function computeRefreshPlan(slots: PackageSlot[], requested?: CanonicalViewAngle[]): RefreshPlan {
  const infos: RefreshSlotInfo[] = slots.map((s) => ({
    angle: s.angle,
    label: s.label,
    cost: slotCost(s.angle),
    pinned: s.pinned,
    stale: s.stale,
    refusal: refreshRefusalFor(s),
  }));
  const refreshable = infos
    .filter((s) => s.refusal === null && (!requested || requested.includes(s.angle)))
    .map((s) => s.angle);
  const totalCost = refreshable.reduce((sum, a) => sum + slotCost(a), 0);
  return { slots: infos, refreshable, totalCost };
}

async function loadModelSlots(input: { userId: number; modelId: number }) {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
  const assets = await getModelAssets(input.modelId);
  return { model, assets, slots: computePackageSlots(assets) };
}

interface RefreshExecutionAuthority {
  modelStatus: string;
  generationModel: SlotGenContext["model"];
  slots: PackageSlot[];
  anchorUrl: string | null;
}

/**
 * Snapshot execution authority is composed only from the explicit package
 * selection and immutable identity document. The ledger remains history and
 * failure evidence; a newer unselected row cannot become the refresh target,
 * anchor, pin state, or generation prompt.
 */
export function snapshotRefreshExecutionAuthority(
  state: EffectiveCastState,
): RefreshExecutionAuthority {
  return {
    modelStatus: state.model.status,
    generationModel: state.status === "current"
      ? {
          masterPrompt: state.identity.masterPrompt,
          technicalSchema: state.identity.technicalSchema,
          preferences: state.identity.preferences,
          identityRevisionId: state.model.identityRevisionId,
        }
      : state.model,
    slots: computeEffectivePackageSlots(state),
    anchorUrl: state.status === "current" ? state.anchor.storageUrl : null,
  };
}

async function loadRefreshExecutionAuthority(input: {
  userId: number;
  modelId: number;
  readMode?: SnapshotReadMode;
}): Promise<RefreshExecutionAuthority> {
  if (input.readMode === "snapshot") {
    return snapshotRefreshExecutionAuthority(
      await resolveEffectiveCastStateForRead(input),
    );
  }
  const { model, assets, slots } = await loadModelSlots(input);
  return {
    modelStatus: model.status,
    generationModel: model,
    slots,
    anchorUrl: selectIdentityAnchor(assets)?.storageUrl ?? null,
  };
}

export async function planRefreshSlots(input: {
  userId: number;
  modelId: number;
  angles?: CanonicalViewAngle[];
  readMode?: SnapshotReadMode;
}): Promise<RefreshPlan & { modelId: number }> {
  if (input.readMode === "snapshot") {
    const state = await resolveEffectiveCastStateForRead(input);
    return {
      modelId: input.modelId,
      ...computeRefreshPlan(computeEffectivePackageSlots(state), input.angles),
    };
  }
  const { slots } = await loadModelSlots(input);
  return { modelId: input.modelId, ...computeRefreshPlan(slots, input.angles) };
}

export interface RefreshResult {
  refreshed: Array<{ angle: CanonicalViewAngle; imageUrl: string; assetId: number }>;
  failed: Array<{
    angle: CanonicalViewAngle;
    label: string;
    reason: string;
    refunded: number;
    refundReference: string;
    markerPersisted: boolean;
  }>;
}

export async function executeRefreshSlots(input: {
  userId: number;
  modelId: number;
  angles: CanonicalViewAngle[];
  readMode?: SnapshotReadMode;
  chargeReferenceId?: string;
  onCharged?: (amount: number) => void;
  onRefunded?: (amount: number) => void;
  operationId: string;
}): Promise<RefreshResult> {
  const {
    modelStatus,
    generationModel,
    slots,
    anchorUrl,
  } = await loadRefreshExecutionAuthority(input);

  // Structural refusals before any money moves
  for (const angle of input.angles) {
    const slot = slots.find((s) => s.angle === angle);
    const refusal = slot ? refreshRefusalFor(slot) : "unfilled";
    if (refusal === "identity_anchor") {
      // F6 (founder-ratified r3): the headshot is never REFRESHABLE — the
      // anchor can't refresh against itself (that's a re-cast, a different
      // face, regardless of status). But the copy + route are status-aware:
      // on a DRAFT identity is fluid, so the answer is iterate-in-environment
      // (free, whole-package-stales), never fork; fork is the minted answer.
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          modelStatus === "draft"
            ? "The headshot anchors every view. Edit it in the environment — she stays a draft, and the other views will flag for a refresh."
            : "The headshot is this identity — changing it forks a new model.",
      });
    }
    if (refusal === "pinned") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${VIEW_ANGLE_LABELS[angle]} is pinned — kept as finished work. Unpin it to refresh.`,
      });
    }
    if (refusal === "unfilled") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${VIEW_ANGLE_LABELS[angle]} hasn't been cast yet — add it from the comp card, not a refresh.`,
      });
    }
  }

  // §7 (Batch C): refresh regenerates from the AUTHORITATIVE identity anchor
  // via the shared selector — never from a newer display-only headshot
  // refinement. The atomic snapshot transition stamps every successful
  // output with the current revision, so refresh remains the resolution leg
  // of every allowed identity edit.
  if (!anchorUrl) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This model has no headshot to refresh against" });
  }

  const totalCost = input.angles.reduce((sum, a) => sum + slotCost(a), 0);
  const deduct = await deductPoints(
    input.userId,
    totalCost,
    "generation",
    `Refresh views (pending)`,
    input.chargeReferenceId ?? `legacy-refresh-${input.modelId}`,
  );
  if (!deduct.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${totalCost} credits.` });
  }
  input.onCharged?.(totalCost);

  const ctx: SlotGenContext = {
    userId: input.userId,
    modelId: input.modelId,
    model: generationModel,
    headshotUrl: anchorUrl,
    reasonLabel: "Refresh",
    chargeReferenceId: input.chargeReferenceId ?? `legacy-refresh-${input.modelId}`,
    onRefunded: input.onRefunded,
    operationId: input.operationId,
  };
  // Parallel provider/gate work; only successful owned candidates enter the
  // one atomic asset + package-snapshot settlement below.
  const results = await Promise.all(input.angles.map((angle) => generatePackageSlotCandidate(ctx, angle)));
  const candidates = results.filter((r): r is PreparedPackageSlot => r.ok);
  const failed = results
    .filter((r): r is Exclude<(typeof results)[number], PreparedPackageSlot> => !r.ok)
    .map(({ angle, label, reason, refunded, refundReference, markerPersisted }) => ({
      angle, label, reason, refunded, refundReference, markerPersisted,
    }));
  let refreshed: RefreshResult["refreshed"] = [];
  if (candidates.length > 0) {
    try {
      const committed = await commitRefreshedSlotsSnapshot({
        userId: input.userId,
        modelId: input.modelId,
        operationId: input.operationId,
        candidates: candidates.map((candidate) => ({
          angle: candidate.angle,
          storageUrl: candidate.imageUrl,
          storageKey: candidate.storageKey,
          engine: candidate.engineUsed,
          pointsCost: slotCost(candidate.angle),
        })),
      });
      refreshed = committed.result.refreshed;
    } catch (error) {
      log.error(
        { modelId: input.modelId, angles: candidates.map((candidate) => candidate.angle), error: error instanceof Error ? error.name : "unknown" },
        "[RefreshSlots] atomic refresh settlement failed",
      );
      const settlementFailures = await Promise.all(candidates.map((candidate) => failPreparedPackageSlot(
        ctx,
        candidate,
        `The ${VIEW_ANGLE_LABELS[candidate.angle].toLowerCase()} view generated but couldn't be saved`,
      )));
      failed.push(...settlementFailures);
    }
    if (refreshed.length > 0) {
      // The snapshot commit is the durable boundary. Audit-row gaps are
      // logged but can never delete/refund already-selected package assets.
      await Promise.all(candidates.map((candidate) => completePreparedPackageSlotAudit(ctx, candidate)));
    }
  }

  log.info(
    { modelId: input.modelId, refreshed: refreshed.map((r) => r.angle), failed: failed.map((f) => f.angle) },
    "[RefreshSlots] done",
  );
  return { refreshed, failed };
}
