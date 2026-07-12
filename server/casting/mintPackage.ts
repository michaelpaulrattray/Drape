/**
 * mintPackage — the D-39 tiered mint (founder-ratified; built R3b).
 *
 * The mint dialog's tiers replace the old "generate side view (recommended)"
 * checkbox. Each tier names what it is FOR (Draft = exploring candidates;
 * Core identity = ready for downstream work; Production sheet = full comp
 * card for scenes/video); tier contents live in shared/boardTypes
 * (MINT_TIER_SLOTS) so client and server can never disagree. Costs are
 * derived HERE from CREDIT_COSTS and served via plan() — never client
 * literals (D-15).
 *
 * Contracts:
 *  - Upgrade anytime at the same cost: pricing counts only MISSING slots.
 *  - Back views pass the identity gate (backViewGate) — one auto-retry,
 *    then that slot fails NAMED-AND-REFUNDED while the rest of the package
 *    (and the mint itself) proceeds; the slot stays open for later.
 *  - Every generated view records its provenance (inputs + engine) on the
 *    asset row — D-12 reproducibility at the package level.
 *  - Atomic credits: the tier total deducts up front; failed slots refund
 *    individually; a total failure refunds everything.
 */
import { TRPCError } from "@trpc/server";
import {
  getModelById,
  getModelAssets,
  createModelAsset,
  createGeneration,
  updateGeneration,
  updateModel,
  mintModel,
  deductPoints,
  addCredits,
} from "../db";
import { generateFullBody, generateRemainingViews, CREDIT_COSTS } from "./aiService";
import { isGatedAngle, verifyViewIdentity } from "./backViewGate";
import {
  MINT_TIER_SLOTS,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
  type MintTier,
} from "../../shared/boardTypes";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/mintPackage");

/** generateSingleView's wire names per canonical angle. */
const SINGLE_VIEW_TYPE: Partial<Record<CanonicalViewAngle, "side" | "walk" | "back" | "threeQuarter">> = {
  sideClose: "side",
  sideFull: "walk",
  backFull: "back",
  threeQuarter: "threeQuarter",
};

export function slotCost(angle: CanonicalViewAngle): number {
  return angle === "frontFull" ? CREDIT_COSTS.fullBody : CREDIT_COSTS.multiView;
}

/** Pure tier pricing over the slots still missing — exported for tests. */
export function tierCosts(existingAngles: string[]): Record<MintTier, { missing: CanonicalViewAngle[]; cost: number }> {
  const out = {} as Record<MintTier, { missing: CanonicalViewAngle[]; cost: number }>;
  for (const tier of ["draft", "core", "production"] as MintTier[]) {
    const missing = MINT_TIER_SLOTS[tier].filter((a) => !existingAngles.includes(a));
    out[tier] = { missing, cost: missing.reduce((sum, a) => sum + slotCost(a), 0) };
  }
  return out;
}

export async function planMintPackage(input: { userId: number; modelId: number }) {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  const assets = await getModelAssets(input.modelId);
  const existing = assets.filter((a) => a.storageUrl).map((a) => a.viewType);
  return {
    tiers: tierCosts(existing),
    hasHeadshot: existing.includes("frontClose"),
  };
}

export interface MintPackageInput {
  userId: number;
  modelId: number;
  tier: MintTier;
  characterName: string;
}

export async function executeMintPackage(input: MintPackageInput) {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

  const assets = await getModelAssets(input.modelId);
  const headshot = assets.find((a) => a.viewType === "frontClose" && a.storageUrl);
  if (!headshot) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cast a headshot before minting" });
  }
  const existing = assets.filter((a) => a.storageUrl).map((a) => a.viewType);
  const { missing, cost: totalCost } = tierCosts(existing)[input.tier];

  // Deduct the tier total up front (atomic-credits contract)
  if (totalCost > 0) {
    const deduct = await deductPoints(
      input.userId, totalCost, "generation",
      `Mint package (${input.tier}, pending)`, `mint-${input.modelId}-${Date.now()}`,
    );
    if (!deduct.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${totalCost} credits.` });
    }
  }

  const gender = (model.technicalSchema as { subject?: { sex?: string } })?.subject?.sex || "female";
  const generated: Array<{ angle: CanonicalViewAngle; imageUrl: string }> = [];
  const failed: Array<{ angle: CanonicalViewAngle; label: string; reason: string; refunded: number }> = [];

  const generateSlot = async (angle: CanonicalViewAngle): Promise<void> => {
    const genRecord = await createGeneration({
      userId: input.userId,
      modelId: input.modelId,
      type: "multiView",
      status: "processing",
      pointsCost: slotCost(angle),
      metadata: { viewType: angle, mintTier: input.tier },
    });
    try {
      const generate = () =>
        angle === "frontFull"
          ? generateFullBody(model.masterPrompt, headshot.storageUrl, gender, model.technicalSchema,
              (model.preferences as { bodyType?: string } | null)?.bodyType)
          : generateRemainingViews(model.masterPrompt, headshot.storageUrl, gender, SINGLE_VIEW_TYPE[angle]!, model.technicalSchema);

      let result = await generate();

      // Gated angles (back + walk, D-46) pass the identity gate — one auto-retry (D-39)
      if (isGatedAngle(angle)) {
        const verdict = await verifyViewIdentity(headshot.storageUrl, result.imageUrl, angle);
        if (!verdict.ok) {
          log.warn({ modelId: input.modelId, angle }, "[MintPackage] view failed the gate — retrying once");
          result = await generate();
          const second = await verifyViewIdentity(headshot.storageUrl, result.imageUrl, angle);
          if (!second.ok) {
            throw new Error(`The ${VIEW_ANGLE_LABELS[angle].toLowerCase()} view could not match this identity (checked twice)`);
          }
        }
      }

      await createModelAsset({
        modelId: input.modelId,
        viewType: angle,
        resolution: "1K",
        storageUrl: result.imageUrl,
        pointsCost: slotCost(angle),
        provenance: {
          inputs: [{ viewAngle: "frontClose", imageUrl: headshot.storageUrl }],
          engine: result.engineUsed,
          mintTier: input.tier,
        },
      });
      await updateGeneration(genRecord.generationId!, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
      generated.push({ angle, imageUrl: result.imageUrl });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Generation failed";
      await updateGeneration(genRecord.generationId!, { status: "failed", errorMessage: reason, completedAt: new Date() }).catch(() => {});
      // Named-and-refunded: this slot's cost goes back; the mint proceeds
      const refund = slotCost(angle);
      await addCredits(input.userId, refund, "refund", `Mint package: ${VIEW_ANGLE_LABELS[angle]} failed (refund)`);
      // Persist the failure DURABLY (D-40): a storageUrl-less marker row
      // carrying status — so the failed slot survives the takeover close and
      // renders named + retryable on re-edit (getPackageState reads it). A
      // later successful (re)generation writes a newer row with a real URL,
      // which supersedes this marker. (VC-R3b: the failure surfaced NOWHERE.)
      await createModelAsset({
        modelId: input.modelId,
        viewType: angle,
        resolution: "1K",
        storageUrl: "",
        pointsCost: 0,
        status: { state: "failed", reason, refunded: refund, at: new Date().toISOString() },
        provenance: { inputs: [{ viewAngle: "frontClose", imageUrl: headshot.storageUrl }], engine: "identity-gate", mintTier: input.tier },
      }).catch(() => {});
      failed.push({ angle, label: VIEW_ANGLE_LABELS[angle], reason, refunded: refund });
      log.warn({ modelId: input.modelId, angle, reason }, "[MintPackage] slot failed — refunded");
    }
  };

  // Parallel: the image queue caps concurrency; each slot settles on its own
  await Promise.all(missing.map((angle) => generateSlot(angle)));

  // Name + mint (identity becomes real and immutable, D-43)
  await updateModel(input.modelId, { name: input.characterName });
  let agencyId = model.agencyId;
  if (!agencyId) {
    const chars = "0123456789ABCDEF";
    let hash = "";
    for (let i = 0; i < 6; i++) hash += chars[Math.floor(Math.random() * 16)];
    agencyId = `MOD-${new Date().getFullYear().toString().slice(-2)}-${hash}`;
    const minted = await mintModel(input.modelId, agencyId);
    if (!minted.success) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: minted.error || "Failed to mint model" });
    }
  }

  log.info(
    { modelId: input.modelId, tier: input.tier, generated: generated.map((g) => g.angle), failed: failed.map((f) => f.angle) },
    "[MintPackage] minted",
  );
  return { agencyId, tier: input.tier, generated, failed };
}

/** A slot's failure marker, read from the durable status row. */
export interface SlotFailure {
  reason: string;
  refunded: number;
  at: string;
}
export interface PackageSlot {
  angle: CanonicalViewAngle;
  label: string;
  filled: boolean;
  url: string | null;
  pinned: boolean;
  /** Set when the newest attempt at this slot failed the gate and no filled
   *  view exists (named-and-refunded, D-40). Cleared by a later success. */
  failed: SlotFailure | null;
}

interface SlotAssetRow {
  viewType: string;
  storageUrl: string;
  pinned?: boolean | null;
  status?: unknown;
  createdAt?: Date | string | null;
}

/** Pure per-slot computation — filled wins; else the newest attempt's failure
 *  marker surfaces. `assets` MUST be newest-first (getModelAssets order).
 *  Exported for tests. */
export function computePackageSlots(assets: SlotAssetRow[]): PackageSlot[] {
  return (Object.keys(VIEW_ANGLE_LABELS) as CanonicalViewAngle[]).map((angle) => {
    const forAngle = assets.filter((a) => a.viewType === angle);
    const filledRow = forAngle.find((a) => a.storageUrl);
    // Failed only when nothing is filled AND the newest attempt is a marker
    const newest = forAngle[0];
    const status = newest?.status as { state?: string; reason?: string; refunded?: number; at?: string } | undefined;
    const failed =
      !filledRow && status?.state === "failed"
        ? { reason: status.reason ?? "The identity check didn't pass", refunded: status.refunded ?? 0, at: status.at ?? "" }
        : null;
    return {
      angle,
      label: VIEW_ANGLE_LABELS[angle],
      filled: !!filledRow,
      url: filledRow?.storageUrl ?? null,
      pinned: filledRow?.pinned ?? false,
      failed,
    };
  });
}

/** Package completeness — the model-level slot read (D-39c; R5's sheet reads this). */
export async function getPackageState(input: { userId: number; modelId: number }) {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  const assets = await getModelAssets(input.modelId);
  return { modelId: input.modelId, minted: !!model.agencyId, slots: computePackageSlots(assets) };
}
