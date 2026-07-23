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
 *    proceeds; the slot stays open for later. Batch C (§14/R8): a slot
 *    failure ABORTS the mint transition itself — the successful views
 *    persist on the draft, and retrying the mint with the slots filled
 *    charges nothing (M20).
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
  mintModelAtomically,
  deductPoints,
  addCredits,
} from "../db";
import { generateFullBody, generateRemainingViews, CREDIT_COSTS } from "./aiService";
import { recordRefund } from "./atomicCredits";
import { PublicError, publicErrorMessage } from "../lib/publicError";
import type { SingleViewAngle } from "./geminiViews";
import { assertNotArchived } from "./modelGuards";
import { buildIdentityAnchor } from "./geminiClient";
import { isGatedAngle, verifyViewIdentity } from "./backViewGate";
import {
  MINT_TIER_SLOTS,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
  type MintTier,
} from "../../shared/boardTypes";
import { isModelMintedStatus } from "../../shared/modelLifecycle";
import {
  assetRevisionMembership,
  currentRevisionId,
  identityStampFor,
  isRestoreCompatible,
  selectIdentityAnchor,
} from "./identity/anchorSelector";
import { computeMintIntegrity, type MintIntegrity } from "./identity/mintIntegrity";
import { REFUSAL_COPY } from "./identity/refusalCopy";
import { createModuleLogger } from "../logging/logger";
import { commitRestoredSlotSnapshot } from "./snapshotTransitions";
import { storageDelete } from "../storage";

const log = createModuleLogger("casting/mintPackage");

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
  assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
  const assets = await getModelAssets(input.modelId);
  const existing = assets.filter((a) => a.storageUrl).map((a) => a.viewType);
  // §14 (R8, Batch C): the dialog predicts each mint-validity refusal PER
  // CHECK, with its own copy — never one vague "out of sync" state.
  const identityText = buildIdentityAnchor(model.masterPrompt || "", model.technicalSchema ?? undefined);
  const integrity: Record<MintTier, MintIntegrity> = {
    draft: computeMintIntegrity(model, assets, MINT_TIER_SLOTS.draft, identityText),
    core: computeMintIntegrity(model, assets, MINT_TIER_SLOTS.core, identityText),
    production: computeMintIntegrity(model, assets, MINT_TIER_SLOTS.production, identityText),
  };
  return {
    tiers: tierCosts(existing),
    hasHeadshot: existing.includes("frontClose"),
    integrity,
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
  chargeReferenceId?: string;
  expectedIdentityRevisionId?: string | null;
  operationId?: string;
  onCharged?: (amount: number) => void;
  onRefunded?: (amount: number) => void;
}

/** What one slot generation needs — shared by mint (R3b) and refresh (R5). */
export interface SlotGenContext {
  userId: number;
  modelId: number;
  model: {
    masterPrompt: string;
    technicalSchema: unknown;
    preferences?: unknown;
    /** §7.4: outputs are stamped with the revision they generate under. */
    identityRevisionId?: string | null;
  };
  /** The AUTHORITATIVE identity anchor (§7 shared selector) — every view
   *  generates from it, never from a display-only headshot refinement. */
  headshotUrl: string;
  /** Names the money movement in the ledger: "Mint package" | "Refresh". */
  reasonLabel: string;
  /** Present on mint; absent on refresh (stamped into generation metadata + provenance). */
  mintTier?: MintTier;
  chargeReferenceId?: string;
  onRefunded?: (amount: number) => void;
  operationId?: string;
}

export type SlotGenResult =
  // assetId is the REAL ledger row id (D-55: the session stays open on a
  // draft and iterates these views immediately — the client must hold the
  // true id, never a synthesized one, or the iterate lookup misses)
  | { ok: true; angle: CanonicalViewAngle; imageUrl: string; assetId: number | null }
  | {
      ok: false;
      angle: CanonicalViewAngle;
      label: string;
      reason: string;
      /** Credits that ACTUALLY recorded back — 0 when the refund failed. */
      refunded: number;
      /** Deterministic reference for support reconciliation. */
      refundReference: string;
      /** False when the durable Retry marker itself could not be saved. */
      markerPersisted: boolean;
    };

export interface PreparedPackageSlot {
  ok: true;
  angle: CanonicalViewAngle;
  imageUrl: string;
  storageKey: string;
  engineUsed?: string;
  generationId: number;
}

export type PreparedPackageSlotResult = PreparedPackageSlot | Extract<SlotGenResult, { ok: false }>;

/**
 * Generate ONE package slot — the house pattern, extracted so mint and
 * refresh can never drift: audit row → generate from the current headshot +
 * identity text → per-angle identity gate (back + walk, retry-then-refund)
 * → owned candidate with its exact storage key. Failures are
 * NAMED-AND-REFUNDED and persist as durable marker rows.
 * The caller has already deducted this slot's cost.
 */
export async function generatePackageSlotCandidate(
  ctx: SlotGenContext,
  angle: CanonicalViewAngle,
): Promise<PreparedPackageSlotResult> {
  const gender = (ctx.model.technicalSchema as { subject?: { sex?: string } })?.subject?.sex || "female";
  const genRecord = await createGeneration({
    userId: ctx.userId,
    modelId: ctx.modelId,
    operationId: ctx.operationId,
    stepKey: ctx.operationId ? `view:${angle}` : undefined,
    viewAngle: ctx.operationId ? angle : undefined,
    type: "multiView",
    status: "processing",
    pointsCost: slotCost(angle),
    metadata: ctx.mintTier ? { viewType: angle, mintTier: ctx.mintTier } : { viewType: angle, source: "refresh" },
  });
  // Review finding 2: a failed audit-row insert fails the SLOT (refund +
  // durable marker below) instead of continuing with an undefined id.
  if (!genRecord.success || !genRecord.generationId) {
    log.error({ modelId: ctx.modelId, angle }, "[PackageSlot] createGeneration failed — slot fails before any image call");
    return await failSlot(ctx, angle, "The view couldn't start", null);
  }
  let ownedCandidate: PreparedPackageSlot | null = null;
  try {
    const generate = () =>
      angle === "frontFull"
        ? generateFullBody(ctx.model.masterPrompt, ctx.headshotUrl, gender, ctx.model.technicalSchema,
            (ctx.model.preferences as { bodyType?: string } | null | undefined)?.bodyType)
        // V21: one canonical vocabulary — the angle IS the generator's view
        // name. frontClose never reaches here (tiers exclude it; refresh
        // refuses the identity anchor), hence the narrowing.
        : generateRemainingViews(ctx.model.masterPrompt, ctx.headshotUrl, gender, angle as SingleViewAngle, ctx.model.technicalSchema);

    const prepareOwnedCandidate = (result: Awaited<ReturnType<typeof generate>>): PreparedPackageSlot => {
      const storageKey = result.storageKey?.trim();
      if (!storageKey) {
        throw new PublicError(`The ${VIEW_ANGLE_LABELS[angle].toLowerCase()} view generated without an owned storage key`);
      }
      return {
        ok: true,
        angle,
        imageUrl: result.imageUrl,
        storageKey,
        engineUsed: result.engineUsed,
        generationId: genRecord.generationId!,
      };
    };
    ownedCandidate = prepareOwnedCandidate(await generate());

    // Gated angles (back + walk, D-46) pass the identity gate — one auto-retry (D-39)
    if (isGatedAngle(angle)) {
      const verdict = await verifyViewIdentity(ctx.headshotUrl, ownedCandidate.imageUrl, angle);
      if (!verdict.ok) {
        log.warn({ modelId: ctx.modelId, angle }, "[PackageSlot] view failed the gate — retrying once");
        await deletePreparedPackageSlot(ownedCandidate, ctx.modelId);
        ownedCandidate = null;
        ownedCandidate = prepareOwnedCandidate(await generate());
        const second = await verifyViewIdentity(ctx.headshotUrl, ownedCandidate.imageUrl, angle);
        if (!second.ok) {
          throw new PublicError(`The ${VIEW_ANGLE_LABELS[angle].toLowerCase()} view could not match this identity (checked twice)`);
        }
      }
    }

    return ownedCandidate;
  } catch (error) {
    if (ownedCandidate) await deletePreparedPackageSlot(ownedCandidate, ctx.modelId);
    // The slot reason is PUBLIC (persisted on the failed-slot marker, rendered
    // on ViewTabs/CastNode): deliberately written TRPCError/PublicError
    // wording passes through; raw internal error text never does (final
    // corrections). The complete error is logged here.
    log.error({ err: error, modelId: ctx.modelId, angle }, "[PackageSlot] slot generation failed");
    const reason = publicErrorMessage(error, "Generation failed");
    return await failSlot(ctx, angle, reason, genRecord.generationId ?? null);
  }
}

async function deletePreparedPackageSlot(candidate: PreparedPackageSlot, modelId: number): Promise<void> {
  try {
    const deleted = await storageDelete(candidate.storageKey);
    if (!deleted.success) {
      log.error(
        { modelId, angle: candidate.angle, errorCode: deleted.errorCode, retryable: deleted.retryable },
        "[PackageSlot] generated candidate cleanup failed",
      );
    }
  } catch (error) {
    log.error(
      { modelId, angle: candidate.angle, error: error instanceof Error ? error.name : "unknown" },
      "[PackageSlot] generated candidate cleanup threw",
    );
  }
}

export async function failPreparedPackageSlot(
  ctx: SlotGenContext,
  candidate: PreparedPackageSlot,
  reason: string,
): Promise<Extract<SlotGenResult, { ok: false }>> {
  await deletePreparedPackageSlot(candidate, ctx.modelId);
  return failSlot(ctx, candidate.angle, reason, candidate.generationId);
}

export async function completePreparedPackageSlotAudit(
  ctx: Pick<SlotGenContext, "modelId">,
  candidate: PreparedPackageSlot,
): Promise<void> {
  try {
    const auditDone = await updateGeneration(candidate.generationId, {
      status: "completed",
      resultUrl: candidate.imageUrl,
      completedAt: new Date(),
    });
    if (auditDone.success) return;
    log.error(
      { modelId: ctx.modelId, angle: candidate.angle, generationId: candidate.generationId },
      "[PackageSlot] audit-row completion write failed — audit gap, slot stands",
    );
  } catch (error) {
    log.error(
      {
        modelId: ctx.modelId,
        angle: candidate.angle,
        generationId: candidate.generationId,
        error: error instanceof Error ? error.name : "unknown",
      },
      "[PackageSlot] audit-row completion write threw — audit gap, slot stands",
    );
  }
}

export async function generatePackageSlot(ctx: SlotGenContext, angle: CanonicalViewAngle): Promise<SlotGenResult> {
  const candidate = await generatePackageSlotCandidate(ctx, angle);
  if (!candidate.ok) return candidate;
  const identityText = buildIdentityAnchor(ctx.model.masterPrompt, ctx.model.technicalSchema);
  const created = await createModelAsset({
    modelId: ctx.modelId,
    viewType: angle,
    resolution: "1K",
    storageUrl: candidate.imageUrl,
    storageKey: candidate.storageKey,
    pointsCost: slotCost(angle),
    provenance: {
      inputs: [{ viewAngle: "frontClose", imageUrl: ctx.headshotUrl }],
      engine: candidate.engineUsed,
      ...(ctx.mintTier ? { mintTier: ctx.mintTier } : { source: "refresh" }),
      ...identityStampFor({
        role: "display",
        revisionId: currentRevisionId(ctx.model),
        identityText,
      }),
    },
  });
  if (!created.success || !created.assetId) {
    return failPreparedPackageSlot(
      ctx,
      candidate,
      `The ${VIEW_ANGLE_LABELS[angle].toLowerCase()} view generated but couldn't be saved`,
    );
  }
  await completePreparedPackageSlotAudit(ctx, candidate);
  return { ok: true, angle, imageUrl: candidate.imageUrl, assetId: created.assetId };
}

/**
 * The named-and-refunded slot failure (D-39/D-40, hardened per review
 * findings 1+2): the refund uses a deterministic id derived from the slot's
 * generation record, its RESULT IS CHECKED, and the durable marker records
 * what actually happened — `refunded: 0` when the refund did not land, so
 * the UI never claims money moved that didn't.
 */
async function failSlot(
  ctx: SlotGenContext,
  angle: CanonicalViewAngle,
  reason: string,
  generationId: number | null,
): Promise<Extract<SlotGenResult, { ok: false }>> {
  if (generationId !== null) {
    const auditFailed = await updateGeneration(generationId, { status: "failed", errorMessage: reason, completedAt: new Date() }).catch(
      () => ({ success: false as const }),
    );
    if (!auditFailed.success) {
      log.error({ modelId: ctx.modelId, angle, generationId }, "[PackageSlot] failed to record generation failure — audit trail gap");
    }
  }
  const refund = slotCost(angle);
  const chargeKey = `${ctx.chargeReferenceId ?? `legacy-package-${ctx.modelId}`}:slot:${angle}`;
  const outcome = await recordRefund(
    ctx.userId,
    refund,
    `${ctx.reasonLabel}: ${VIEW_ANGLE_LABELS[angle]} failed (refund)`,
    chargeKey,
  );
  const refunded = outcome.recorded ? refund : 0;
  if (refunded > 0) ctx.onRefunded?.(refunded);
  // Persist the failure DURABLY (D-40): a storageUrl-less marker row
  // carrying status — so the failed slot survives the takeover close and
  // renders named + retryable on re-edit (getPackageState reads it). A
  // later successful (re)generation writes a newer row with a real URL,
  // which supersedes this marker. (VC-R3b: the failure surfaced NOWHERE.)
  // Final review correction 6: the RESULT is checked — createModelAsset
  // returns { success:false } rather than throwing, so a .catch alone
  // misses ordinary failure. When the marker didn't save, the response says
  // so instead of promising a Retry chip that won't survive reopening.
  const markerResult = await createModelAsset({
    modelId: ctx.modelId,
    viewType: angle,
    resolution: "1K",
    storageUrl: "",
    pointsCost: 0,
    status: { state: "failed", reason, refunded, refundReference: outcome.reference, at: new Date().toISOString() },
    provenance: {
      inputs: [{ viewAngle: "frontClose", imageUrl: ctx.headshotUrl }],
      engine: "identity-gate",
      ...(ctx.mintTier ? { mintTier: ctx.mintTier } : { source: "refresh" }),
    },
  }).catch((markerError) => {
    log.error(
      { modelId: ctx.modelId, angle, err: markerError instanceof Error ? markerError.message : String(markerError) },
      "[PackageSlot] failed-slot marker insert THREW — failure will not survive takeover close",
    );
    return { success: false as const, assetId: undefined };
  });
  const markerPersisted = !!markerResult.success;
  if (!markerPersisted) {
    // Batch 0 (D-46 R7 log item 1) + correction 6: a swallowed marker failure
    // meant the slot failure surfaced nowhere durable — recoverable gap,
    // reported to the caller, never hidden
    log.error(
      { modelId: ctx.modelId, angle, generationId, refundReference: outcome.reference },
      "[PackageSlot] failed-slot marker DID NOT PERSIST — recoverable gap; the failure will not survive takeover close",
    );
  }
  log.warn({ modelId: ctx.modelId, angle, reason, refunded, markerPersisted }, "[PackageSlot] slot failed");
  return {
    ok: false,
    angle,
    label: VIEW_ANGLE_LABELS[angle],
    reason,
    refunded,
    refundReference: outcome.reference,
    markerPersisted,
  };
}

export async function executeMintPackage(input: MintPackageInput) {
  // Batch 0 defense in depth: the router refuses nameless mints, but this is
  // the state machine's own boundary — no caller may mint without a name,
  // and the check runs BEFORE any slot generation spends credits.
  if (input.mint !== false && !input.characterName?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A name is required to mint" });
  }
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted

  // MINT-TRANSITION INVARIANT (Batch 0, review item 1): the only legal
  // transition through this boundary is a CLEAN draft → active. Adding
  // views to an already-minted model is a mint:false request (the client's
  // upgrade path) and never touches name or status. Anything else asking to
  // mint — an active/locked model, or an inconsistent row (a draft carrying
  // agencyId/mintedAt) — fails CLOSED before assets are read, costs are
  // computed, credits are deducted, or anything generates.
  if (input.mint !== false) {
    const cleanDraft = model.status === "draft" && !model.agencyId && !model.mintedAt;
    if (!cleanDraft) {
      log.warn(
        { modelId: input.modelId, status: model.status, hasAgencyId: !!model.agencyId, hasMintedAt: !!model.mintedAt },
        "[MintPackage] mint transition refused — not a clean draft",
      );
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          model.status === "draft"
            ? "This model's mint state is inconsistent — it can't be minted as-is."
            : "Already minted — add views without re-minting.",
      });
    }
  }

  const assets = await getModelAssets(input.modelId);
  // §7 (Batch C): every identity consumer — including every mint-time slot
  // generation — uses the AUTHORITATIVE anchor via the shared selector. A
  // newer display-only headshot refinement never silently replaces it.
  const anchor = selectIdentityAnchor(assets);
  if (!anchor) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cast a headshot before minting" });
  }

  // §14 (R8, Batch C): mint validity is THREE separate checks — identity
  // anchor, displayed headshot, selected-tier views — each refusing with its
  // own precise resolution copy, BEFORE any deduction or generation. A
  // same-revision display headshot over an older authoritative anchor
  // legally passes. Add-views (mint:false) is not the mint transition and
  // takes no integrity gate.
  if (input.mint !== false) {
    const identityText = buildIdentityAnchor(model.masterPrompt || "", model.technicalSchema ?? undefined);
    const integrity = computeMintIntegrity(model, assets, MINT_TIER_SLOTS[input.tier], identityText);
    if (!integrity.ok) {
      const firstTierFailure = integrity.tierViews.find((v) => !v.ok);
      const message = !integrity.anchor.ok
        ? integrity.anchor.message!
        : !integrity.displayHeadshot.ok
          ? integrity.displayHeadshot.message!
          : firstTierFailure?.message ?? REFUSAL_COPY.mintAnchorInvalid;
      log.warn(
        { modelId: input.modelId, anchorOk: integrity.anchor.ok, displayOk: integrity.displayHeadshot.ok, tierFailures: integrity.tierViews.filter((v) => !v.ok).map((v) => v.angle) },
        "[MintPackage] mint refused by §14 integrity checks (free)",
      );
      throw new TRPCError({ code: "PRECONDITION_FAILED", message });
    }
  }

  const existing = assets.filter((a) => a.storageUrl).map((a) => a.viewType);
  const { missing, cost: totalCost } = tierCosts(existing)[input.tier];

  // Deduct the tier total up front (atomic-credits contract)
  if (totalCost > 0) {
    const deduct = await deductPoints(
      input.userId, totalCost, "generation",
      `Mint package (${input.tier}, pending)`, input.chargeReferenceId ?? `legacy-mint-${input.modelId}`,
    );
    if (!deduct.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${totalCost} credits.` });
    }
    input.onCharged?.(totalCost);
  }

  // Parallel: the image queue caps concurrency; each slot settles on its own
  const ctx: SlotGenContext = {
    userId: input.userId,
    modelId: input.modelId,
    model,
    headshotUrl: anchor.storageUrl!,
    reasonLabel: "Mint package",
    mintTier: input.tier,
    chargeReferenceId: input.chargeReferenceId ?? `legacy-mint-${input.modelId}`,
    onRefunded: input.onRefunded,
    operationId: input.operationId,
  };
  const results = await Promise.all(missing.map((angle) => generatePackageSlot(ctx, angle)));
  const generated = results
    .filter((r): r is Extract<SlotGenResult, { ok: true }> => r.ok)
    .map((r) => ({ angle: r.angle, imageUrl: r.imageUrl, assetId: r.assetId }));
  const failed = results
    .filter((r): r is Extract<SlotGenResult, { ok: false }> => !r.ok)
    .map(({ angle, label, reason, refunded, refundReference, markerPersisted }) => ({
      angle, label, reason, refunded, refundReference, markerPersisted,
    }));

  // Trap ruling (a) as sharpened at VC-R6 final: views without minting —
  // the slots landed above with full gates and pricing; the model stays a
  // draft, freely iterable, until the user names-and-mints deliberately.
  // A provided name here is an OPTIONAL NICKNAME (honest D-42 naming for
  // the picker/board) — it never mints; naming-as-identity stays fused to
  // the mint moment.
  if (input.mint === false) {
    // Nicknames are a DRAFT affordance (D-42/D-55). A minted model reaching
    // here is the upgrade path — its name never changes through this door
    // (renames are models.update, FR-3(B)).
    if (input.characterName?.trim() && model.status === "draft") {
      // Optional nickname (best-effort): the paid slot generations above are
      // the operation's outcome; a failed nickname write must not fail them,
      // but it must never be silent either
      const nicknamed = await updateModel(input.modelId, { name: input.characterName.trim() });
      if (!nicknamed.success) {
        log.error({ modelId: input.modelId }, "[MintPackage] stays-draft nickname write failed — name unchanged");
      }
    }
    log.info(
      { modelId: input.modelId, tier: input.tier, generated: generated.map((g) => g.angle), failed: failed.map((f) => f.angle) },
      "[MintPackage] views added, stays a draft",
    );
    // Honest state (Batch B): minted is STATUS truth — active or the legacy
    // locked alias. On the upgrade path the model IS minted; a draft carrying
    // a stray agencyId is still a draft and must never read minted here.
    return { agencyId: model.agencyId ?? null, minted: isModelMintedStatus(model.status), tier: input.tier, generated, failed };
  }

  // §14 (R8, Batch C): a mint may not complete while a selected-tier view is
  // failed — if any slot failed during THIS mint's generation, the failed
  // slots were already refunded (named, durable markers persisted), the
  // successful slots persist on the draft, and the mint TRANSITION aborts.
  // Retrying the mint with the slots filled adds no new generation charges
  // (missing = ∅ ⇒ zero deduction), which is exactly M20's free
  // mint-transition retry.
  if (failed.length > 0) {
    log.warn(
      { modelId: input.modelId, tier: input.tier, failed: failed.map((f) => f.angle) },
      "[MintPackage] slot failure during mint — views kept, transition aborted, model stays a draft",
    );
    return {
      agencyId: model.agencyId ?? null,
      minted: false,
      tier: input.tier,
      generated,
      failed,
      mintAborted: true as const,
      message: REFUSAL_COPY.mintRetryCredit,
    };
  }

  // Name + mint is one conditional transition: clean draft, expected
  // identity revision, final name, agency id and mintedAt land together.
  let agencyId = model.agencyId;
  if (!agencyId) {
    const chars = "0123456789ABCDEF";
    let hash = "";
    for (let i = 0; i < 6; i++) hash += chars[Math.floor(Math.random() * 16)];
    agencyId = `MOD-${new Date().getFullYear().toString().slice(-2)}-${hash}`;
    const minted = await mintModelAtomically({
      modelId: input.modelId,
      userId: input.userId,
      agencyId,
      name: input.characterName.trim(),
      // The operation receipt uses the semantic "genesis" revision, but the
      // model row stores genesis as SQL NULL. This CAS must compare the raw
      // persisted value or every never-edited draft falsely reads "changed".
      expectedIdentityRevisionId:
        input.expectedIdentityRevisionId === undefined
          ? model.identityRevisionId ?? null
          : input.expectedIdentityRevisionId,
    });
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

/** A slot's failure marker, read from the durable status row. `refunded` is
 *  what ACTUALLY recorded (0 when the automatic refund failed);
 *  `refundReference` is the support-reconciliation key. */
export interface SlotFailure {
  reason: string;
  refunded: number;
  refundReference?: string;
  at: string;
}
export interface PackageSlot {
  angle: CanonicalViewAngle;
  label: string;
  filled: boolean;
  url: string | null;
  pinned: boolean;
  /** The current view's staleness (model-level, D-39). Written today by the
   *  F6 stale-writer: identity-classified draft edits stale the sibling
   *  head rows (castingRefinement iterate → markModelAssetsStale). */
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
    const status = newest?.status as { state?: string; reason?: string; refunded?: number; refundReference?: string; at?: string } | undefined;
    const failed =
      !filledRow && status?.state === "failed"
        ? {
            reason: status.reason ?? "The identity check didn't pass",
            refunded: status.refunded ?? 0,
            ...(status.refundReference ? { refundReference: status.refundReference } : {}),
            at: status.at ?? "",
          }
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
  assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
  const assets = await getModelAssets(input.modelId);
  // Batch B: minted is status truth (active | legacy locked) — agencyId is
  // integrity detail, never the read-model discriminator (a stray ID on a
  // draft must not read minted; a legacy locked row must).
  return { modelId: input.modelId, minted: isModelMintedStatus(model.status), slots: computePackageSlots(assets) };
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
  assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
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
  versions: Array<{
    assetId: number;
    url: string;
    pinned: boolean;
    createdAt: string;
    isHead: boolean;
    /** §7.4 (M13): restore is offered only where revision-compatible. */
    revisionCompatible: boolean;
  }>;
}> {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
  const assets = await getModelAssets(input.modelId); // newest-first
  const filled = assets.filter((a) => a.viewType === input.angle && a.storageUrl);
  // §7.4 (Batch C): restore is offered ONLY where revision-compatible — the
  // client's "Use this version" affordance keys off this flag (M13), so the
  // UI never advertises a restore the server would refuse.
  const identityText = buildIdentityAnchor(model.masterPrompt || "", model.technicalSchema ?? undefined);
  return {
    modelId: input.modelId,
    angle: input.angle,
    versions: filled.map((a, i) => ({
      assetId: a.id,
      url: a.storageUrl,
      pinned: a.pinned ?? false,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt ?? ""),
      isHead: i === 0,
      revisionCompatible: isRestoreCompatible(assetRevisionMembership(a, model, identityText)),
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
  operationId: string;
  angle: CanonicalViewAngle;
  assetId: number;
}): Promise<{ modelId: number; angle: CanonicalViewAngle; assetId: number; url: string; version: number }> {
  return (await commitRestoredSlotSnapshot(input)).result;
}
