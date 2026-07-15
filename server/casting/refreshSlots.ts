/**
 * refreshSlots — R5's per-tile quality refresh over the package ledger.
 *
 * Refreshing a slot regenerates that ONE view against the model's CURRENT
 * headshot + identity text (the house pattern, shared with mint via
 * generatePackageSlot) and writes a NEW model_assets row — newest-wins, so
 * the read model picks it up with zero read-side changes and any stale
 * status clears by construction.
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
  generatePackageSlot,
  slotCost,
  type PackageSlot,
  type SlotGenContext,
  type SlotGenResult,
} from "./mintPackage";
import { VIEW_ANGLE_LABELS, type CanonicalViewAngle } from "../../shared/boardTypes";
import { assertNotArchived } from "./modelGuards";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/refreshSlots");

export type RefreshRefusal = "identity_anchor" | "pinned" | "unfilled" | null;

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

function refusalFor(slot: PackageSlot): RefreshRefusal {
  if (slot.angle === "frontClose") return "identity_anchor";
  if (slot.pinned) return "pinned";
  if (!slot.filled && !slot.failed) return "unfilled";
  return null;
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
    refusal: refusalFor(s),
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
  return { model, slots: computePackageSlots(assets) };
}

export async function planRefreshSlots(input: {
  userId: number;
  modelId: number;
  angles?: CanonicalViewAngle[];
}): Promise<RefreshPlan & { modelId: number }> {
  const { slots } = await loadModelSlots(input);
  return { modelId: input.modelId, ...computeRefreshPlan(slots, input.angles) };
}

export interface RefreshResult {
  refreshed: Array<{ angle: CanonicalViewAngle; imageUrl: string }>;
  failed: Array<{ angle: CanonicalViewAngle; label: string; reason: string; refunded: number }>;
}

export async function executeRefreshSlots(input: {
  userId: number;
  modelId: number;
  angles: CanonicalViewAngle[];
}): Promise<RefreshResult> {
  const { model, slots } = await loadModelSlots(input);

  // Structural refusals before any money moves
  for (const angle of input.angles) {
    const slot = slots.find((s) => s.angle === angle);
    const refusal = slot ? refusalFor(slot) : "unfilled";
    if (refusal === "identity_anchor") {
      // F6 (founder-ratified r3): the headshot is never REFRESHABLE — the
      // anchor can't refresh against itself (that's a re-cast, a different
      // face, regardless of status). But the copy + route are status-aware:
      // on a DRAFT identity is fluid, so the answer is iterate-in-environment
      // (free, whole-package-stales), never fork; fork is the minted answer.
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          model.status === "draft"
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

  const headshot = slots.find((s) => s.angle === "frontClose");
  if (!headshot?.url) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This model has no headshot to refresh against" });
  }

  const totalCost = input.angles.reduce((sum, a) => sum + slotCost(a), 0);
  const deduct = await deductPoints(
    input.userId,
    totalCost,
    "generation",
    `Refresh views (pending)`,
    `refresh-${input.modelId}-${Date.now()}`,
  );
  if (!deduct.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${totalCost} credits.` });
  }

  const ctx: SlotGenContext = {
    userId: input.userId,
    modelId: input.modelId,
    model,
    headshotUrl: headshot.url,
    reasonLabel: "Refresh",
  };
  // Parallel: the image queue caps concurrency; per-slot failures refund named
  const results = await Promise.all(input.angles.map((angle) => generatePackageSlot(ctx, angle)));
  const refreshed = results
    .filter((r): r is Extract<SlotGenResult, { ok: true }> => r.ok)
    .map((r) => ({ angle: r.angle, imageUrl: r.imageUrl }));
  const failed = results
    .filter((r): r is Extract<SlotGenResult, { ok: false }> => !r.ok)
    .map(({ angle, label, reason, refunded }) => ({ angle, label, reason, refunded }));

  log.info(
    { modelId: input.modelId, refreshed: refreshed.map((r) => r.angle), failed: failed.map((f) => f.angle) },
    "[RefreshSlots] done",
  );
  return { refreshed, failed };
}
