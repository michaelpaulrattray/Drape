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
  setModelAssetPinned,
  createGeneration,
  updateGeneration,
  updateModel,
  mintModel,
  deductPoints,
  addCredits,
} from "../db";
import { generateFullBody, generateRemainingViews, CREDIT_COSTS } from "./aiService";
import { buildIdentityAnchor } from "./geminiClient";
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
  /** Trap ruling (a), amending D-46 rider 1: false = generate the tier's
   *  slots (same pricing, same identity gates — they key off the CURRENT
   *  headshot, never mint state) but the model STAYS A DRAFT. Minting is a
   *  separate deliberate act; identity iteration stays free until it. */
  mint?: boolean;
}

/** What one slot generation needs — shared by mint (R3b) and refresh (R5). */
export interface SlotGenContext {
  userId: number;
  modelId: number;
  model: {
    masterPrompt: string;
    technicalSchema: unknown;
    preferences?: unknown;
  };
  /** The CURRENT canonical headshot — every view generates from it (D-30). */
  headshotUrl: string;
  /** Names the money movement in the ledger: "Mint package" | "Refresh". */
  reasonLabel: string;
  /** Present on mint; absent on refresh (stamped into generation metadata + provenance). */
  mintTier?: MintTier;
}

export type SlotGenResult =
  | { ok: true; angle: CanonicalViewAngle; imageUrl: string }
  | { ok: false; angle: CanonicalViewAngle; label: string; reason: string; refunded: number };

/**
 * Generate ONE package slot — the house pattern, extracted so mint and
 * refresh can never drift: audit row → generate from the current headshot +
 * identity text → per-angle identity gate (back + walk, retry-then-refund)
 * → asset row with D-12 provenance (exact inputs + verbatim identityText).
 * Failures are NAMED-AND-REFUNDED and persist as durable marker rows.
 * The caller has already deducted this slot's cost.
 */
export async function generatePackageSlot(ctx: SlotGenContext, angle: CanonicalViewAngle): Promise<SlotGenResult> {
  const gender = (ctx.model.technicalSchema as { subject?: { sex?: string } })?.subject?.sex || "female";
  const identityText = buildIdentityAnchor(ctx.model.masterPrompt, ctx.model.technicalSchema);
  const genRecord = await createGeneration({
    userId: ctx.userId,
    modelId: ctx.modelId,
    type: "multiView",
    status: "processing",
    pointsCost: slotCost(angle),
    metadata: ctx.mintTier ? { viewType: angle, mintTier: ctx.mintTier } : { viewType: angle, source: "refresh" },
  });
  try {
    const generate = () =>
      angle === "frontFull"
        ? generateFullBody(ctx.model.masterPrompt, ctx.headshotUrl, gender, ctx.model.technicalSchema,
            (ctx.model.preferences as { bodyType?: string } | null | undefined)?.bodyType)
        : generateRemainingViews(ctx.model.masterPrompt, ctx.headshotUrl, gender, SINGLE_VIEW_TYPE[angle]!, ctx.model.technicalSchema);

    let result = await generate();

    // Gated angles (back + walk, D-46) pass the identity gate — one auto-retry (D-39)
    if (isGatedAngle(angle)) {
      const verdict = await verifyViewIdentity(ctx.headshotUrl, result.imageUrl, angle);
      if (!verdict.ok) {
        log.warn({ modelId: ctx.modelId, angle }, "[PackageSlot] view failed the gate — retrying once");
        result = await generate();
        const second = await verifyViewIdentity(ctx.headshotUrl, result.imageUrl, angle);
        if (!second.ok) {
          throw new Error(`The ${VIEW_ANGLE_LABELS[angle].toLowerCase()} view could not match this identity (checked twice)`);
        }
      }
    }

    await createModelAsset({
      modelId: ctx.modelId,
      viewType: angle,
      resolution: "1K",
      storageUrl: result.imageUrl,
      pointsCost: slotCost(angle),
      provenance: {
        inputs: [{ viewAngle: "frontClose", imageUrl: ctx.headshotUrl }],
        engine: result.engineUsed,
        ...(ctx.mintTier ? { mintTier: ctx.mintTier } : { source: "refresh" }),
        // D-12 reproducibility at the asset level: the exact identity text
        // this view generated against, verbatim (a few KB buys a full replay)
        identityText,
      },
    });
    await updateGeneration(genRecord.generationId!, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
    return { ok: true, angle, imageUrl: result.imageUrl };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Generation failed";
    await updateGeneration(genRecord.generationId!, { status: "failed", errorMessage: reason, completedAt: new Date() }).catch(() => {});
    // Named-and-refunded: this slot's cost goes back; the batch proceeds
    const refund = slotCost(angle);
    await addCredits(ctx.userId, refund, "refund", `${ctx.reasonLabel}: ${VIEW_ANGLE_LABELS[angle]} failed (refund)`);
    // Persist the failure DURABLY (D-40): a storageUrl-less marker row
    // carrying status — so the failed slot survives the takeover close and
    // renders named + retryable on re-edit (getPackageState reads it). A
    // later successful (re)generation writes a newer row with a real URL,
    // which supersedes this marker. (VC-R3b: the failure surfaced NOWHERE.)
    await createModelAsset({
      modelId: ctx.modelId,
      viewType: angle,
      resolution: "1K",
      storageUrl: "",
      pointsCost: 0,
      status: { state: "failed", reason, refunded: refund, at: new Date().toISOString() },
      provenance: {
        inputs: [{ viewAngle: "frontClose", imageUrl: ctx.headshotUrl }],
        engine: "identity-gate",
        ...(ctx.mintTier ? { mintTier: ctx.mintTier } : { source: "refresh" }),
      },
    }).catch(() => {});
    log.warn({ modelId: ctx.modelId, angle, reason }, "[PackageSlot] slot failed — refunded");
    return { ok: false, angle, label: VIEW_ANGLE_LABELS[angle], reason, refunded: refund };
  }
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

  // Parallel: the image queue caps concurrency; each slot settles on its own
  const ctx: SlotGenContext = {
    userId: input.userId,
    modelId: input.modelId,
    model,
    headshotUrl: headshot.storageUrl,
    reasonLabel: "Mint package",
    mintTier: input.tier,
  };
  const results = await Promise.all(missing.map((angle) => generatePackageSlot(ctx, angle)));
  const generated = results
    .filter((r): r is Extract<SlotGenResult, { ok: true }> => r.ok)
    .map((r) => ({ angle: r.angle, imageUrl: r.imageUrl }));
  const failed = results
    .filter((r): r is Extract<SlotGenResult, { ok: false }> => !r.ok)
    .map(({ angle, label, reason, refunded }) => ({ angle, label, reason, refunded }));

  // Trap ruling (a): views without minting — the slots landed above with
  // full gates and pricing; the model stays a draft, freely iterable, until
  // the user names-and-mints deliberately.
  if (input.mint === false) {
    log.info(
      { modelId: input.modelId, tier: input.tier, generated: generated.map((g) => g.angle), failed: failed.map((f) => f.angle) },
      "[MintPackage] views added, stays a draft",
    );
    return { agencyId: model.agencyId ?? null, minted: false, tier: input.tier, generated, failed };
  }

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
  return { agencyId, minted: true, tier: input.tier, generated, failed };
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
  /** The current view's staleness (model-level, D-39; dormant in pass 1 —
   *  D-43 removed the trigger; pass 2's stale-writer lights it up). */
  stale: boolean;
  /** vN for the tile popover: how many filled generations this slot has. */
  version: number;
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
    const filledStatus = filledRow?.status as { state?: string } | undefined;
    return {
      angle,
      label: VIEW_ANGLE_LABELS[angle],
      filled: !!filledRow,
      url: filledRow?.storageUrl ?? null,
      pinned: filledRow?.pinned ?? false,
      stale: filledStatus?.state === "stale",
      version: forAngle.filter((a) => a.storageUrl).length,
      failed,
    };
  });
}

/** Package completeness — the model-level slot read (D-39c; R5's comp card reads this). */
export async function getPackageState(input: { userId: number; modelId: number }) {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  const assets = await getModelAssets(input.modelId);
  return { modelId: input.modelId, minted: !!model.agencyId, slots: computePackageSlots(assets) };
}

/** The row pin/refresh act on: the NEWEST filled row for the angle — the same
 *  selection rule computePackageSlots renders, so state changes always land on
 *  the row the user is looking at. Pure; exported for tests. */
export function newestFilledAssetId(
  assets: Array<{ id: number; viewType: string; storageUrl: string }>,
  angle: CanonicalViewAngle,
): number | null {
  const row = assets.find((a) => a.viewType === angle && a.storageUrl);
  return row?.id ?? null;
}

/** R5 per-slot pin toggle (D-21 on the package ledger). Model-asset pins are
 *  a DIFFERENT ledger from board-item pins (boardOps.executeSetNodePinned) —
 *  one marks a package view accepted-final, the other marks a placement. */
export async function executeSetSlotPinned(input: {
  userId: number;
  modelId: number;
  angle: CanonicalViewAngle;
  pinned: boolean;
}): Promise<{ modelId: number; angle: CanonicalViewAngle; pinned: boolean }> {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  const assets = await getModelAssets(input.modelId);
  const assetId = newestFilledAssetId(assets, input.angle);
  if (assetId === null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${VIEW_ANGLE_LABELS[input.angle]} has no cast view to pin yet`,
    });
  }
  await setModelAssetPinned(assetId, input.pinned);
  return { modelId: input.modelId, angle: input.angle, pinned: input.pinned };
}

// ── D-53: the slot ledger is the single version history ─────────────────────

/** Filled rows for one angle, newest first — the tile thumb-strip's data.
 *  (The head is index 0: newest-wins everywhere.) */
export async function getSlotVersions(input: {
  userId: number;
  modelId: number;
  angle: CanonicalViewAngle;
}): Promise<{
  modelId: number;
  angle: CanonicalViewAngle;
  versions: Array<{ assetId: number; url: string; pinned: boolean; createdAt: string; isHead: boolean }>;
}> {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  const assets = await getModelAssets(input.modelId); // newest-first
  const filled = assets.filter((a) => a.viewType === input.angle && a.storageUrl);
  return {
    modelId: input.modelId,
    angle: input.angle,
    versions: filled.map((a, i) => ({
      assetId: a.id,
      url: a.storageUrl,
      pinned: a.pinned ?? false,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt ?? ""),
      isHead: i === 0,
    })),
  };
}

/** D-53 `restoreSlotVersion` — "Use this version": copy-forward APPEND, never
 *  a backward mutation (the board's `revertItemVersion` keeps its opposite
 *  semantics and its name). Zero generation cost; the restored row arrives
 *  UNPINNED (a pin marks a row, not a lineage) with `restoredFromAssetId`
 *  provenance so the D-12 audit chain stays whole. Newest-wins promotes it
 *  instantly for every consumer (comp card, composer, hydration, vN). */
export async function executeRestoreSlotVersion(input: {
  userId: number;
  modelId: number;
  angle: CanonicalViewAngle;
  assetId: number;
}): Promise<{ modelId: number; angle: CanonicalViewAngle; assetId: number; url: string; version: number }> {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

  const assets = await getModelAssets(input.modelId); // newest-first
  const source = assets.find((a) => a.id === input.assetId);
  if (!source || source.viewType !== input.angle || !source.storageUrl) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `That version isn't a cast ${VIEW_ANGLE_LABELS[input.angle]} view of this model`,
    });
  }
  const head = assets.find((a) => a.viewType === input.angle && a.storageUrl);
  if (head && head.id === source.id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That's already the current version",
    });
  }
  // No-op guard (VC-R6b drive 2): restoring a row whose IMAGE already equals
  // the head appends nothing but ledger noise — repeated restores were
  // minting identical rows (v8 stacks of one image). Same-content = same
  // version; refuse politely.
  if (head && head.storageUrl === source.storageUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That's already the current image",
    });
  }

  const sourceProvenance = (source.provenance ?? null) as { inputs?: unknown } | null;
  const created = await createModelAsset({
    modelId: input.modelId,
    viewType: input.angle,
    resolution: source.resolution ?? "1K",
    storageUrl: source.storageUrl,
    storageKey: source.storageKey ?? null,
    pointsCost: 0, // a pointer copy moves no money
    pinned: false,
    provenance: {
      restoredFromAssetId: source.id,
      inputs: sourceProvenance?.inputs ?? null,
      engine: "restore",
    },
  });
  if (!created.success || !created.assetId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Restore failed — nothing was changed" });
  }

  const after = await getModelAssets(input.modelId);
  const version = after.filter((a) => a.viewType === input.angle && a.storageUrl).length;
  return {
    modelId: input.modelId,
    angle: input.angle,
    assetId: created.assetId,
    url: source.storageUrl,
    version,
  };
}
