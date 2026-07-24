/**
 * boardOps — the single source of truth for "what operations exist on a board"
 * (CANVAS_FOUNDATIONS.md §4, Decision 5). Every mutation has a `plan` (expected
 * outcome + server-derived credit cost, no side effects) and an `execute`.
 * Costs come from CREDIT_COSTS — never client literals (Decision 6).
 *
 * M3a scope: the cheap structural operations + runGeneration v0 (first cast on
 * an empty cast_root, composing the existing casting engine). Later milestones
 * add generateViews, fork/recast, refreshStaleViews, refinement, etc. here.
 */
import { TRPCError } from "@trpc/server";
import {
  addBoardItem,
  getBoardItems,
  getBoardItemById,
  updateBoardItem,
  batchUpdateBoardItemPositions,
  softDeleteBoardItems,
  undoDeleteBoardItems,
  addBoardItemVersion,
  getLatestVersionNumber,
  stampBoardItemWithVersion,
  stampBoardItemWithVersionIn,
  fillEmptyCastNodeWithVersionIn,
  updateBoardItemIn,
  placeLinkedBoardItem,
  withTransaction,
  createModel,
  getModelById,
  updateModel,
  getModelAssets,
  createModelAsset,
  createGeneration,
  updateGeneration,
  deductPoints,
  addCredits,
} from "../db";
import { addBoardEdge, getEdgesForItem, removeBoardEdge, getEdgesFrom } from "../db/boardEdges";
import {
  generateMasterPrompt,
  generateCastingImage,
  generateCastingImageRaw,
  uploadRawCandidate,
  clearCastingSession,
  CREDIT_COSTS,
  type ModelPreferences,
} from "../casting/aiService";
import { buildEthnicityHint, buildReinforcedPrompt } from "../casting/promptReinforcement";
import { assertNotArchived } from "../casting/modelGuards";
import { parseCastingPrompt, mergeParsedPreferences, resolveEngineChoices } from "../casting/promptParser";
import { recordRefund, refundTruth } from "../casting/atomicCredits";
import { publicErrorMessage } from "./publicError";
import type { TransactionHandle } from "../db/connection";
import { validateCreationIntent } from "../casting/identity/creationIntake";
import { buildStructuredPatch } from "../casting/identity/structuredEdit";
import { computeIdentityCommit } from "../casting/identity/identityCommit";
import { commitCanvasRecastSnapshot } from "../casting/snapshotTransitions";
import { currentRevisionId, identityStampFor } from "../casting/identity/anchorSelector";
import { buildIdentityAnchor } from "../casting/geminiClient";
import {
  resolveEffectiveCastStateForRead,
  resolveEffectiveCastStatesForRead,
} from "../casting/effectiveCastRead";
import type { SnapshotReadMode } from "../casting/snapshotReadScope";
import {
  selectedAssetForAngle,
} from "../casting/modelReadProjections";
import {
  clearEngineChoiceForChanges,
  prepareCandidatePreferences,
} from "../casting/engineChoiceMetadata";
import { enforceDailyQuota } from "../db/dailyQuota";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import type {
  Provenance,
  NodeStatus,
  BoardItemCanvasMetadata,
  CanonicalViewAngle,
} from "../../shared/boardTypes";
import { VIEW_ANGLE_LABELS, CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
import { isModelDraftStatus, isModelAvailableStatus } from "../../shared/modelLifecycle";
import type {
  BoardItemKind,
  BoardEdgeRelation,
  Model,
  ModelAsset,
} from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";
import { storageDelete } from "../storage";

const log = createModuleLogger("lib/boardOps");

// ── Plan shape (foundations §4) ────────────────────────────────────────────

export interface OperationPlan {
  operation: string;
  creates: Array<{ kind: BoardItemKind; provenance: Provenance | null; position: { x: number; y: number } }>;
  modifies: Array<{ itemId: number; changes: Record<string, unknown> }>;
  deletes: number[];
  addEdges: Array<{ source: number; target: number; relation: BoardEdgeRelation }>;
  estimatedCreditCost: number;
  estimatedDurationMs: number;
}

const emptyPlan = (operation: string): OperationPlan => ({
  operation,
  creates: [],
  modifies: [],
  deletes: [],
  addEdges: [],
  estimatedCreditCost: 0,
  estimatedDurationMs: 0,
});

// ── Metadata helpers ───────────────────────────────────────────────────────

function readMeta(item: { metadata: unknown }): BoardItemCanvasMetadata {
  return (item.metadata && typeof item.metadata === "object"
    ? item.metadata
    : {}) as BoardItemCanvasMetadata;
}

/** Legacy `type` value for the compatibility window (new code writes both). */
function legacyTypeForKind(kind: BoardItemKind, provenance: Provenance | null): string {
  if (kind === "note") return "note";
  if (kind === "frame") return "frame";
  if (provenance?.type === "library_garment") return "garment";
  if (provenance?.type === "vto_output") return "vto_result";
  if (provenance?.type === "reference") return "reference";
  return "model";
}

// ── createNode ─────────────────────────────────────────────────────────────

export interface CreateNodeInput {
  boardId: number;
  kind: BoardItemKind;
  provenance: Provenance | null;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  label?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export function planCreateNode(input: CreateNodeInput): OperationPlan {
  return {
    ...emptyPlan("createNode"),
    creates: [{ kind: input.kind, provenance: input.provenance, position: input.position }],
  };
}

export async function executeCreateNode(input: CreateNodeInput) {
  const metadata: BoardItemCanvasMetadata = {
    ...(input.metadata ?? {}),
    ...(input.provenance ? { provenance: input.provenance } : {}),
    ...(input.imageUrl ? { version: 1 } : {}),
  };
  const itemId = await addBoardItem({
    boardId: input.boardId,
    type: legacyTypeForKind(input.kind, input.provenance) as never,
    kind: input.kind,
    label: input.label,
    imageUrl: input.imageUrl,
    positionX: Math.round(input.position.x),
    positionY: Math.round(input.position.y),
    width: input.size?.width ?? 280,
    height: input.size?.height ?? 420,
    metadata,
    sourceModelId:
      input.provenance && "modelId" in input.provenance ? input.provenance.modelId : undefined,
    sourceGarmentId:
      input.provenance?.type === "library_garment" ? input.provenance.garmentId : undefined,
  });
  // Library placements arrive with an image — record v1 so history starts truthful
  if (input.imageUrl) {
    await addBoardItemVersion({ itemId, version: 1, imageUrl: input.imageUrl, tool: "initial" });
  }
  return { itemId, plan: planCreateNode(input) };
}

// ── updateNodeMetadata (debounced config writes) ───────────────────────────

export async function executeUpdateNodeMetadata(input: {
  itemId: number;
  metadata: Record<string, unknown>;
  label?: string;
}) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const merged = { ...readMeta(item), ...input.metadata };
  await updateBoardItem(input.itemId, { metadata: merged, ...(input.label !== undefined ? { label: input.label } : {}) });
  return { itemId: input.itemId };
}

// ── markNodeStatus / setNodePinned ─────────────────────────────────────────

export async function executeMarkNodeStatus(input: { itemId: number; status: NodeStatus | null }) {
  return executeUpdateNodeMetadata({ itemId: input.itemId, metadata: { status: input.status } });
}

export async function executeSetNodePinned(input: { itemId: number; pinned: boolean }) {
  // Pinning also clears staleness — pinned = accepted as finished work (3c)
  return executeUpdateNodeMetadata({
    itemId: input.itemId,
    metadata: input.pinned ? { pinned: true, status: null } : { pinned: false },
  });
}

// ── moveNodes ──────────────────────────────────────────────────────────────

export async function executeMoveNodes(input: {
  moves: Array<{ itemId: number; x: number; y: number; width?: number; height?: number; zIndex?: number }>;
}) {
  await batchUpdateBoardItemPositions(
    input.moves.map((m) => ({
      id: m.itemId,
      positionX: Math.round(m.x),
      positionY: Math.round(m.y),
      width: m.width,
      height: m.height,
      zIndex: m.zIndex,
    })),
  );
  return { moved: input.moves.length };
}

// ── deleteNode / undoDelete (soft, cascade-aware) ──────────────────────────

/** A root's cascade unit = itself + its ALIVE generated_from_cast targets.
 *  Deliberately NOT forked_from/variant_of — forks and variations are
 *  independent identities, never destroyed by deleting their source (D-8's
 *  red is scoped to delete-cascade alone).
 *
 *  ALIVE only (VC-R5 fix 1): edges survive soft deletes by design (undo needs
 *  them), so a popped view that was collapsed or deleted earlier leaves its
 *  edge... no — collapse removes its edge, but a DIRECTLY deleted popped view
 *  keeps one. Counting such targets made the one red mark in the app lie
 *  about its blast radius ("2 connected views" over an empty cascade). */
async function cascadeUnit(itemId: number): Promise<number[]> {
  const viewEdges = await getEdgesFrom(itemId, "generated_from_cast");
  const unit = [itemId];
  for (const edge of viewEdges) {
    const target = await getBoardItemById(edge.targetItemId);
    if (target && !target.deletedAt) unit.push(edge.targetItemId);
  }
  return unit;
}

/** Union of cascade units for a selection — deleted and restored as one unit. */
async function cascadeUnits(itemIds: number[]): Promise<number[]> {
  const unit = new Set<number>();
  for (const id of itemIds) {
    for (const member of await cascadeUnit(id)) unit.add(member);
  }
  return Array.from(unit);
}

export async function planDeleteNodes(input: { itemIds: number[] }): Promise<OperationPlan> {
  const unit = await cascadeUnits(input.itemIds);
  return { ...emptyPlan("deleteNodes"), deletes: unit };
}

export async function executeDeleteNodes(input: { itemIds: number[] }) {
  const unit = await cascadeUnits(input.itemIds);
  await softDeleteBoardItems(unit);
  // Edges + versions survive intact — undo restores everything (Decision 7)
  return { deletedItemIds: unit };
}

export const planDeleteNode = (input: { itemId: number }) =>
  planDeleteNodes({ itemIds: [input.itemId] });
export const executeDeleteNode = (input: { itemId: number }) =>
  executeDeleteNodes({ itemIds: [input.itemId] });

export async function executeUndoDelete(input: { itemIds: number[] }) {
  await undoDeleteBoardItems(input.itemIds);
  return { restored: input.itemIds.length };
}

// ── addEdge / removeEdge ───────────────────────────────────────────────────

export async function executeAddEdge(input: {
  boardId: number;
  sourceItemId: number;
  targetItemId: number;
  relation: BoardEdgeRelation;
  metadata?: Record<string, unknown>;
}) {
  const edgeId = await addBoardEdge(input);
  return { edgeId };
}

export async function executeRemoveEdge(input: { edgeId: number }) {
  await removeBoardEdge(input.edgeId);
  return { removed: true };
}

// ── runGeneration v0 — first cast on an empty cast_root ────────────────────
//
// Composes the existing engine exactly as the legacy two-step client flow did
// (models.create → generation.castingImage), server-side, against a board
// item. The M2b parser slots in ahead of generateMasterPrompt.

export function planRunGeneration(): OperationPlan {
  return {
    ...emptyPlan("runGeneration"),
    estimatedCreditCost: CREDIT_COSTS.castingImage,
    estimatedDurationMs: 20_000,
  };
}

export interface RunGenerationInput {
  userId: number;
  itemId: number;
  /** Natural-language prompt (verbatim). M2b routes this through the parser. */
  userPrompt?: string;
  /** Explicit attribute values (chips/rows) — hard constraints over parser output. */
  attributes?: Record<string, unknown>;
  modelName?: string;
  chargeReferenceId: string;
  operationId: string;
  onCharged: (amount: number) => void;
  onRefunded: (amount: number) => void;
  onModelCreated: (modelId: number) => Promise<void> | void;
}

export async function executeRunGeneration(input: RunGenerationInput) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });

  const rate = checkRateLimit(`user:${input.userId}`, RATE_LIMITS.generation);
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
  }
  await enforceDailyQuota(input.userId);

  // Batch C (§10.2, M22): parse and VALIDATE the final normalized creation
  // intent BEFORE any deduction — the old order deducted first, so a refused
  // brief still moved money. Three-path parser dispatch (R2/D-14) is
  // unchanged: the parser never blocks a run — on failure the prompt passes
  // through verbatim — but the VALIDATION refusal is deliberate and free.
  const locked = (input.attributes ?? {}) as Record<string, unknown>;
  const promptText = (input.userPrompt ?? "").trim();
  let prefs: ModelPreferences = { ...locked, userPrompt: promptText } as ModelPreferences;
  if (promptText) {
    try {
      const parsed = await parseCastingPrompt(promptText);
      prefs = mergeParsedPreferences(parsed, locked, promptText);
    } catch (parseError) {
      log.warn(
        { itemId: input.itemId, err: parseError instanceof Error ? parseError.message : String(parseError) },
        "Prompt parse failed — falling back to verbatim passthrough",
      );
    }
  }
  // Paid path: engine-choice brand resolves to a recorded random pick (D-41)
  prefs = resolveEngineChoices(prefs);
  // §10.3: no reference rides any creation path
  delete (prefs as Record<string, unknown>).referenceImage;
  const intake = validateCreationIntent(prefs as Record<string, unknown>);
  if (!intake.ok) {
    log.warn({ itemId: input.itemId, code: intake.code, channel: intake.channel }, "Canvas cast refused at intake (free)");
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: intake.message });
  }

  const cost = CREDIT_COSTS.castingImage;
  const deduct = await deductPoints(
    input.userId, cost, "generation", "Canvas cast generation (pending)", input.chargeReferenceId,
  );
  if (!deduct.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: deduct.error || `Insufficient credits. Need ${cost} credits.`,
    });
  }
  input.onCharged(cost);

  // ── The PAID DURABLE-EFFECT boundary (review finding 3): everything inside
  // this try either precedes or IS the durable paid result (model row +
  // generation record + headshot asset). Failure here means no usable paid
  // result survives, so the deterministic refund below is always correct.
  let modelId: number;
  let imageUrl: string;
  let assetId: number;
  let engineUsed: string | undefined;
  try {
    const masterPrompt = await generateMasterPrompt(prefs);
    const modelResult = await createModel({
      userId: input.userId,
      name: input.modelName || "Draft Model",
      masterPrompt: masterPrompt.naturalDescription,
      technicalSchema: masterPrompt.technicalSchema,
      preferences: prefs,
      status: "draft",
    });
    if (!modelResult.success || !modelResult.modelId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: modelResult.error || "Failed to create model" });
    }
    modelId = modelResult.modelId;
    await input.onModelCreated(modelId);

    // Review finding 2: a failed audit-row insert is detected, never
    // dereferenced as an undefined generation id
    const genRecord = await createGeneration({
      userId: input.userId,
      modelId,
      operationId: input.operationId,
      stepKey: "headshot",
      viewAngle: "frontClose",
      type: "castingImage",
      status: "processing",
      pointsCost: cost,
    });
    if (!genRecord.success || !genRecord.generationId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't start the cast" });
    }

    const ethnicityHint = buildEthnicityHint(prefs as never);
    const reinforced = buildReinforcedPrompt(masterPrompt.naturalDescription, prefs as never);
    const result = await generateCastingImage(reinforced, {
      castingBrand: (prefs as { castingBrand?: string }).castingBrand || "Generic",
      frame: "HEADSHOT",
      ethnicityHint,
      userId: String(input.userId),
      modelId,
      technicalSchema: masterPrompt.technicalSchema,
    });
    if (!result.imageUrl) {
      const auditFailed = await updateGeneration(genRecord.generationId, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
      if (!auditFailed.success) log.error({ itemId: input.itemId, modelId }, "runGeneration: audit-row failure write failed — audit gap");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
    }
    imageUrl = result.imageUrl;
    engineUsed = result.engineUsed;

    // Register the headshot as a model asset (parity with the legacy flow) —
    // the models library, the D-28 picker, and /studio resume all read these.
    // §7 (Batch C): the initial cast headshot is the identity ANCHOR under
    // the genesis revision, fingerprinted for legacy-compatible restores.
    // Review finding 2: the asset row completes the durable paid result — a
    // failed write fails (and refunds) the whole cast.
    const asset = await createModelAsset({
      modelId,
      viewType: "frontClose",
      resolution: "1K",
      storageUrl: result.imageUrl,
      pointsCost: cost,
      provenance: {
        engine: result.engineUsed,
        ...identityStampFor({
          role: "anchor",
          revisionId: currentRevisionId({ identityRevisionId: null }),
          identityText: buildIdentityAnchor(masterPrompt.naturalDescription, masterPrompt.technicalSchema),
        }),
      },
    });
    if (!asset.success || !asset.assetId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The cast generated but couldn't be saved." });
    }
    assetId = asset.assetId;

    const auditDone = await updateGeneration(genRecord.generationId, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
    if (!auditDone.success) {
      log.error({ itemId: input.itemId, modelId, generationId: genRecord.generationId }, "runGeneration: audit-row completion write failed AFTER durable result — audit gap, result stands");
    }
  } catch (error) {
    // Refund on any failure BEFORE the durable result completed — and carry
    // the refund TRUTH into both the node status and the outgoing error
    // (final correction 1): never claim "not charged" for an unrecorded refund.
    log.error({ err: error, itemId: input.itemId }, "runGeneration failed before the durable boundary");
    const outcome = await recordRefund(input.userId, cost, "Canvas cast generation failed (refund)", input.chargeReferenceId);
    if (outcome.recorded) input.onRefunded(outcome.amount);
    // Sanitized (final corrections): authored TRPCError/PublicError wording
    // passes; raw internal error text never reaches the node card or toast.
    const baseMessage = publicErrorMessage(error, "Generation failed.");
    const truthful = `${baseMessage} ${refundTruth(outcome)}`;
    await executeMarkNodeStatus({
      itemId: input.itemId,
      status: { type: "error", message: truthful },
    }).catch((statusError) => {
      log.warn({ err: statusError, itemId: input.itemId }, "runGeneration: failed to persist the error status on the node");
    });
    throw new TRPCError({
      code: error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR",
      message: truthful,
    });
  }

  // ── Past the boundary: the paid result exists (model + headshot in the
  // library). Board/UI synchronization failures are logged audit gaps —
  // never a refund, never a retryable "generation failed" that could
  // duplicate the paid work (review finding 3, invariant 2). The return
  // payload still carries the result so the client can render it.
  let placed = true;
  let placementMessage: string | undefined;
  try {
    const provenance: Provenance = {
      type: "cast_root",
      modelId,
      viewAngle: "frontClose",
      attributes: { ...prefs } as Record<string, unknown>,
      engine: engineUsed || "gemini",
    };
    // Final correction 4: the node stamp and its version row are one domain
    // record — they commit together or not at all (no half-versioned node).
    const fill = await withTransaction((tx) => fillEmptyCastNodeWithVersionIn(tx, {
      boardId: item.boardId,
      itemId: input.itemId,
      modelId,
      build: (lockedItem) => ({
        update: {
          imageUrl,
          label: input.modelName || lockedItem.label || "Cast",
          metadata: {
            ...readMeta(lockedItem),
            provenance,
            attributes: { ...prefs } as Record<string, unknown>,
            userPrompt: input.userPrompt ?? "",
            status: null,
            isGenerating: false,
            version: 1,
          } satisfies BoardItemCanvasMetadata,
          sourceModelId: modelId,
        },
        version: {
          imageUrl,
          prompt: input.userPrompt || null,
          tool: "initial",
        },
      }),
    }));
    if (fill !== "filled") throw new Error("The origin Cast node is no longer empty");
  } catch (syncError) {
    placed = false;
    placementMessage =
      "Your cast was created and charged — find the draft in your model library. Placing it on the board failed; it was not charged twice.";
    log.error(
      { itemId: input.itemId, modelId, err: syncError instanceof Error ? syncError.message : String(syncError) },
      "runGeneration: board stamp failed AFTER the paid cast landed (rolled back whole) — the draft lives in the library; no refund, no retryable failure",
    );
  }

  log.info({ itemId: input.itemId, modelId, engine: engineUsed }, "Canvas cast generated");
  return {
    success: true as const,
    itemId: input.itemId,
    modelId,
    assetId,
    imageUrl,
    creditCost: cost,
    placed,
    ...(placementMessage ? { placementMessage } : {}),
  };
}

// ── fillFromLibrary (D-28 — empty cast node picks an existing model) ───────
//
// Fills THIS node in place: provenance → library_cast, image → the model's
// canonical headshot, initial version row. Never spawns a sibling.

/** The provenance viewAngle for a library-cast fill: the stored viewType when
 *  it is one of the canonical six, else the headshot slot. Pure — exported for
 *  tests (audit N1: this list must be CANONICAL_VIEW_ANGLES, never a copy). */
export function libraryCastViewAngle(viewType: string): CanonicalViewAngle {
  return (CANONICAL_VIEW_ANGLES as readonly string[]).includes(viewType)
    ? (viewType as CanonicalViewAngle)
    : "frontClose";
}

/**
 * Server-owned image authority for free Canvas package-consumption actions.
 *
 * Snapshot mode selects only the explicit package slot. The R6 branch keeps
 * the existing newest-ledger behavior byte-for-byte as the rollout fallback.
 */
export async function resolveCanvasPackageView(input: {
  userId: number;
  modelId: number;
  angle: CanonicalViewAngle;
  readMode: SnapshotReadMode;
  /** Closed rollback policy: Library fill historically falls back to row 0;
   * pop-out historically skips empty failure markers. */
  r6Selection: "fill_front_close" | "filled_angle";
}): Promise<{ model: Model; asset: ModelAsset | null }> {
  if (input.readMode === "snapshot") {
    const state = await resolveEffectiveCastStateForRead({
      userId: input.userId,
      modelId: input.modelId,
    });
    const selected = state.status === "current"
      ? state.selectedViews.find((view) => view.angle === input.angle)?.asset ?? null
      : null;
    return { model: state.model, asset: selected };
  }

  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  assertNotArchived(model);
  const assets = await getModelAssets(input.modelId);
  const matching = input.r6Selection === "fill_front_close"
    ? assets.find((asset) => asset.viewType === input.angle) ?? assets[0] ?? null
    : assets.find(
        (asset) => asset.viewType === input.angle && !!asset.storageUrl,
      ) ?? null;
  return {
    model,
    asset: matching,
  };
}

export async function executeFillFromLibrary(input: {
  userId: number;
  itemId: number;
  modelId: number;
  readMode: SnapshotReadMode;
}) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });

  const { model, asset: headshot } = await resolveCanvasPackageView({
    userId: input.userId,
    modelId: input.modelId,
    angle: "frontClose",
    readMode: input.readMode,
    r6Selection: "fill_front_close",
  });
  if (!headshot?.storageUrl) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This model has no canonical imagery yet" });
  }

  // Batch B: draft is the STATUS read-model, never "not minted" — an
  // archived or unrecognized row must not degrade to an editable draft
  // (assertNotArchived above already 404s archived; this keeps the
  // derivation truthful even if that guard's placement ever changes).
  const draft = isModelDraftStatus(model.status);
  const provenance: Provenance = {
    type: "library_cast",
    modelId: input.modelId,
    // Audit N1: the canonical list is the shared six (a hardcoded five-view
    // copy here silently demoted a threeQuarter asset to "frontClose")
    viewAngle: libraryCastViewAngle(headshot.viewType),
    ...(draft ? { draft: true } : {}),
  };

  // Unnamed drafts render as unnamed (D-42) — never the fake auto-name
  const honestName = draft && model.name === DRAFT_AUTO_NAME ? null : model.name;
  const fill = await withTransaction((tx) => fillEmptyCastNodeWithVersionIn(tx, {
    boardId: item.boardId,
    itemId: input.itemId,
    modelId: input.modelId,
    build: (lockedItem) => ({
      update: {
        imageUrl: headshot.storageUrl,
        label: honestName || lockedItem.label || null,
        metadata: { ...readMeta(lockedItem), provenance, status: null, isGenerating: false, version: 1 },
        // Keep the legacy FK in sync — the node was created empty, so
        // createNode couldn't stamp it (legacy surfaces + analytics read it).
        sourceModelId: input.modelId,
      },
      version: { imageUrl: headshot.storageUrl, tool: "initial" },
    }),
    reconcileExact: {
      sourceModelId: input.modelId,
      imageUrl: headshot.storageUrl,
      buildUpdate: (lockedItem) => {
        const metadata = readMeta(lockedItem);
        if (
          metadata.provenance?.type !== "library_cast" ||
          metadata.provenance.modelId !== input.modelId
        ) return null;
        return {
          // A custom Canvas label belongs to the placement. Otherwise keep the
          // linked node in sync with the model's honest draft/minted name.
          label: metadata.customLabel === true
            ? lockedItem.label
            : honestName || lockedItem.label || null,
          metadata: {
            ...metadata,
            provenance,
            status: null,
            isGenerating: false,
          },
          sourceModelId: input.modelId,
          imageUrl: headshot.storageUrl,
        };
      },
    },
  }));
  if (fill === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  if (fill === "not_empty") {
    throw new TRPCError({ code: "CONFLICT", message: "This Cast node is no longer empty." });
  }
  return { itemId: input.itemId, modelId: input.modelId, imageUrl: headshot.storageUrl, label: honestName, draft };
}

// ── listCastableModels (D-28 picker data, D-42 drafts) ─────────────────────
//
// Models represented ONLY by canonical cast reference imagery (frontClose
// headshot). Models without one are excluded — never substituted with VTO
// or styled outputs (§1.5). Drafts are placeable and honestly presented
// (D-42): they carry `draft: true`, sort below minted models, and the fake
// auto-name ("Draft Model") is stripped — unnamed renders as unnamed.

/** D-42's fake auto-name sentinel — unnamed must render as unnamed. Exported
 *  for every surface that needs the honest-naming rule (picker, lobby feed). */
export const DRAFT_AUTO_NAME = "Draft Model";

export async function listCastableModels(
  userId: number,
  limit = 30,
  readMode: SnapshotReadMode = "r6",
) {
  const { getUserModels, getHeadshotsForModels } = await import("../db");
  const models = await getUserModels(userId, limit * 2); // headroom for filtering
  // Snapshot mode resolves the frozen model cohort in one transaction. R6
  // keeps the historical two-query newest-frontClose reader byte-for-byte.
  const headshots = readMode === "r6"
    ? await getHeadshotsForModels(models.map((m) => m.id))
    : new Map(Array.from((await resolveEffectiveCastStatesForRead({
        userId,
        modelIds: models.map((model) => model.id),
      })).entries()).flatMap(([modelId, state]) => {
        const selected = selectedAssetForAngle(state, "frontClose");
        return selected ? [[modelId, selected.storageUrl] as const] : [];
      }));
  const out: Array<{ id: number; name: string | null; headshotUrl: string; draft: boolean }> = [];
  for (const model of models) {
    if (out.length >= limit) break;
    const headshotUrl = headshots.get(model.id);
    if (headshotUrl) {
      // Batch B: archived/unknown statuses are unavailable, never presented
      // (getUserModels already excludes archived — FR-4 — this is the read
      // model's own refusal, so the picker can't regress if that filter does)
      if (!isModelAvailableStatus(model.status)) continue;
      const draft = isModelDraftStatus(model.status);
      out.push({
        id: model.id,
        name: draft && model.name === DRAFT_AUTO_NAME ? null : model.name,
        headshotUrl,
        draft,
      });
    }
  }
  // Minted first; drafts below (each group keeps recency order)
  return out.sort((a, b) => Number(a.draft) - Number(b.draft));
}

// ── applyModelEdit (R3 — identity events, D-11/D-41) ───────────────────────
//
// The ONE landing path for identity edits made in the casting environment on
// a placed cast. Every save routes through here (the D-11 dialog is the
// confirm); the stage-lock never applies to minted edits. `decision`:
//   update — the cast becomes a different person: attributes merge with both
//            cross-field invalidation rules, the headshot regenerates, THIS
//            node restamps (image + version row `tool:'attributes'`), and
//            downstream edge targets go stale (R5 renders them richly).
//   fork   — the original is untouched; a NEW unnamed draft model generates
//            from the merged attributes and lands as a new node beside it,
//            connected by a `forked_from` edge (D-42 draft presentation).

/**
 * Cross-field invalidation (audit D1) + ethnicity dual-write (audit B4),
 * applied server-side so no surface can bypass them. Exported for tests.
 */
export function mergeAttributeChanges(
  current: Record<string, unknown>,
  changes: Record<string, unknown>,
): ModelPreferences {
  const merged: Record<string, unknown> = { ...current, ...changes };

  // Rule 1: a gender change clears gendered styling (unless the change set
  // provides its own replacement values)
  if (changes.gender && changes.gender !== current.gender) {
    for (const f of ["hairStyle", "hairFade", "facialHair"]) {
      if (!(f in changes)) merged[f] = "";
    }
  }
  // Rule 2: a hair-style change resets its sub-selectors — the engine
  // re-derives them for the new silhouette
  if (changes.hairStyle && changes.hairStyle !== current.hairStyle) {
    for (const f of ["hairLength", "hairTexture", "hairFringe", "hairParting", "hairVolume", "hairTuck", "hairFlyaways", "hairFade"]) {
      if (!(f in changes)) merged[f] = "";
    }
  }
  // Ethnicity dual-write: blend and legacy string stay in sync
  const blend = changes.ethnicityBlend as Array<{ name: string; pct: number }> | undefined;
  if (blend && blend.length > 0) {
    merged.ethnicity = blend.map((e) => e.name).join(", ");
  } else if (typeof changes.ethnicity === "string" && changes.ethnicity && !blend) {
    const names = changes.ethnicity.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2);
    const pct = names.length === 2 ? 50 : 100;
    merged.ethnicityBlend = names.map((name) => ({ name, pct }));
  }
  return merged as ModelPreferences;
}

export async function planApplyModelEdit(input: { itemId: number }) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const prov = readMeta(item).provenance;
  const modelId = prov && "modelId" in prov ? prov.modelId : null;
  let affectedViewCount = 0;
  if (modelId) {
    const assets = await getModelAssets(modelId);
    affectedViewCount = assets.filter((a) => a.viewType !== "frontClose" && a.storageUrl).length;
  }
  return {
    ...emptyPlan("applyModelEdit"),
    estimatedCreditCost: CREDIT_COSTS.castingImage,
    estimatedDurationMs: 25_000,
    affectedViewCount,
  };
}

export interface ApplyModelEditInput {
  userId: number;
  itemId: number;
  decision: "update" | "fork";
  changes: Record<string, unknown>;
  /** 'rerun' = the R4 fork/recast gesture (same engine path, version rows
   *  stamp `tool:'rerun'`); 'edit' = an environment save (default). */
  intent?: "edit" | "rerun";
  readMode: SnapshotReadMode;
  chargeReferenceId: string;
  operationId: string;
  onCharged: (amount: number) => void;
  onRefunded: (amount: number) => void;
}

/** Resolve the server-owned model behind a Canvas placement before claiming
 * its model-wide operation lock. Execute paths call this again after the lock
 * so ownership/lifecycle truth cannot change between the claim and the paid
 * work. */
export async function resolveModelBackedBoardOperation(input: { userId: number; itemId: number }) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const provenance = readMeta(item).provenance;
  if (!provenance || !("modelId" in provenance)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This node has no cast identity" });
  }
  const model = await getModelById(provenance.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  assertNotArchived(model);
  return { item, model, provenance };
}

/** Server-owned read authority for a Canvas update. The route calls this
 * before the receipt starts so typed refusals stay free; the paid executor
 * calls it again after the receipt-head assertion so generation never trusts
 * the earlier request read. */
export async function prepareCanvasRecastAuthority(input: {
  userId: number;
  itemId: number;
  changes: Record<string, unknown>;
  intent?: "edit" | "rerun";
  readMode: SnapshotReadMode;
}) {
  const resolved = await resolveModelBackedBoardOperation(input);
  if (!isModelDraftStatus(resolved.model.status)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This identity is minted and immutable — fork it as a new model instead.",
    });
  }

  let authorityModel: Model = resolved.model;
  if (input.readMode === "snapshot") {
    const state = await resolveEffectiveCastStateForRead({
      userId: input.userId,
      modelId: resolved.model.id,
    });
    if (state.status !== "current") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Generate a headshot before recasting this Cast.",
      });
    }
    authorityModel = {
      ...state.model,
      masterPrompt: state.identity.masterPrompt,
      technicalSchema: state.identity.technicalSchema,
      preferences: state.identity.preferences,
    };
  }

  const current = (authorityModel.preferences ?? {}) as Record<string, unknown>;
  const isRerun = input.intent === "rerun" && Object.keys(input.changes).length === 0;
  let identityPatch: import("../casting/identity/identityTypes").AuthorizedIdentityPatch | null = null;
  let generationDoc = {
    masterPrompt: authorityModel.masterPrompt || "",
    preferences: current,
    technicalSchema: authorityModel.technicalSchema ?? {},
  };
  let releasedIdentityDependents: string[] = [];
  if (!isRerun) {
    const structured = buildStructuredPatch(input.changes, current);
    if (!structured.ok) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: structured.message });
    }
    identityPatch = structured.patch;
    const computed = computeIdentityCommit(authorityModel, structured.patch);
    generationDoc = {
      masterPrompt: computed.masterPrompt,
      preferences: computed.preferences as Record<string, unknown>,
      technicalSchema: computed.technicalSchema,
    };
    releasedIdentityDependents = computed.releasedDependents;
  }

  return {
    resolved,
    authorityModel,
    current,
    isRerun,
    identityPatch,
    generationDoc,
    releasedIdentityDependents,
  };
}

/**
 * One draft candidate from a set of preferences: model row (unnamed draft,
 * D-42) + generation audit + headshot + frontClose asset. The shared engine
 * path behind fork (applyModelEdit), recast-as-fork, and runVariations.
 * Throws on failure — the CALLER owns deduction and refunds.
 */
async function generateCastCandidate(opts: {
  userId: number;
  prefs: ModelPreferences;
  cost: number;
  operationId: string;
  stepKey: string;
}) {
  // §10.3 (Batch C): creation references are cleared from every fork/recast/
  // variation preference set — a persisted legacy referenceImage (or the
  // fork's merge) must never ride into a new cast. The INHERITED brief is
  // cleared too: NEW-mode document derivation never reads `userPrompt`, so a
  // pre-policy brief is inert here — clearing it keeps legacy models
  // forkable while the candidate's real intent (attributes + features) is
  // fully validated. Callers validate intake BEFORE deducting; this second
  // check fails closed if a new caller forgot.
  const inherited = { ...opts.prefs } as ModelPreferences & Record<string, unknown>;
  delete inherited.referenceImage;
  inherited.userPrompt = "";
  const candidate = prepareCandidatePreferences(inherited);
  const prefs = resolveEngineChoices(candidate.promptPreferences);
  const intake = validateCreationIntent(prefs as Record<string, unknown>);
  if (!intake.ok) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: intake.message });
  }
  const masterPrompt = await generateMasterPrompt(prefs);
  const model = await createModel({
    userId: opts.userId,
    name: DRAFT_AUTO_NAME,
    masterPrompt: masterPrompt.naturalDescription,
    technicalSchema: masterPrompt.technicalSchema,
    preferences: candidate.storeResolved(prefs),
    status: "draft",
  });
  if (!model.success || !model.modelId) {
    // model.error may carry raw DB text — log it, never send it (final corrections)
    log.error({ modelId: null, dbError: model.error }, "generateCastCandidate: createModel failed");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create the model." });
  }
  // Review finding 2: a failed audit-row insert is detected before the image
  // call — the caller's catch refunds; no undefined generation id survives
  const genRecord = await createGeneration({
    userId: opts.userId, modelId: model.modelId,
    operationId: opts.operationId, stepKey: opts.stepKey, viewAngle: "frontClose",
    type: "castingImage", status: "processing", pointsCost: opts.cost,
  });
  if (!genRecord.success || !genRecord.generationId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't start the cast" });
  }
  const result = await generateCastingImage(
    buildReinforcedPrompt(masterPrompt.naturalDescription, prefs as never),
    {
      castingBrand: (prefs as { castingBrand?: string }).castingBrand || "Generic",
      frame: "HEADSHOT",
      ethnicityHint: buildEthnicityHint(prefs as never),
      userId: String(opts.userId),
      modelId: model.modelId,
      technicalSchema: masterPrompt.technicalSchema,
    },
  );
  if (!result.imageUrl) {
    const auditFailed = await updateGeneration(genRecord.generationId, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
    if (!auditFailed.success) log.error({ modelId: model.modelId }, "generateCastCandidate: audit-row failure write failed — audit gap");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
  }
  // §7: a fresh candidate's headshot is its identity anchor (genesis
  // revision). Review finding 2: the asset row completes the candidate's
  // durable paid result — a failed write fails the candidate (the caller's
  // catch refunds); an empty model shell without a headshot is not usable.
  const asset = await createModelAsset({
    modelId: model.modelId,
    viewType: "frontClose",
    resolution: "1K",
    storageUrl: result.imageUrl,
    pointsCost: opts.cost,
    provenance: {
      engine: result.engineUsed,
      ...identityStampFor({
        role: "anchor",
        revisionId: currentRevisionId({ identityRevisionId: null }),
        identityText: buildIdentityAnchor(masterPrompt.naturalDescription, masterPrompt.technicalSchema),
      }),
    },
  });
  if (!asset.success || !asset.assetId) {
    const auditFailed = await updateGeneration(genRecord.generationId, { status: "failed", errorMessage: "Generated but could not be saved", completedAt: new Date() });
    if (!auditFailed.success) log.error({ modelId: model.modelId }, "generateCastCandidate: audit-row failure write failed — audit gap");
    // The CALLER refunds and appends the refund truth (final correction 1)
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The cast generated but couldn't be saved." });
  }
  const auditDone = await updateGeneration(genRecord.generationId, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
  if (!auditDone.success) {
    log.error({ modelId: model.modelId, generationId: genRecord.generationId }, "generateCastCandidate: audit-row completion write failed AFTER durable result — audit gap, result stands");
  }
  return { modelId: model.modelId, imageUrl: result.imageUrl, engineUsed: result.engineUsed };
}

export async function executeApplyModelEdit(input: ApplyModelEditInput) {
  const prepared = input.decision === "update"
    ? await prepareCanvasRecastAuthority(input)
    : null;
  const resolved = prepared?.resolved ?? await resolveModelBackedBoardOperation(input);
  const { item, model } = resolved;
  const meta = readMeta(item);
  const prov = resolved.provenance;

  // D-43 (founder-ratified 2026-07-11): minted identities are IMMUTABLE —
  // fork is the sole identity operation on any non-draft model. Keyed off
  // status !== 'draft' so no status value ('locked', 'archived', …) is a
  // loophole. Enforced HERE, where no client can bypass it.
  if (input.decision === "update" && model.status !== "draft") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This identity is minted and immutable — fork it as a new model instead.",
    });
  }

  const rate = checkRateLimit(`user:${input.userId}`, RATE_LIMITS.generation);
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
  }
  await enforceDailyQuota(input.userId);

  const current = prepared?.current ?? (model.preferences ?? {}) as Record<string, unknown>;
  const cost = CREDIT_COSTS.castingImage;

  if (input.decision === "update") {
    // Batch C (ratified R3, §13.5): the update branch is a
    // `source:"structured"` §8.6 patch commit. Changes resolve to
    // authorizable identity fields with their REAL typed values through the
    // handler registry — no wholesale document re-derivation (which
    // destroyed amendments and mark language), no unknown keys, no
    // presentation or `features` smuggling. Validation and the refusal are
    // FREE — they complete before the deduction.
    //
    // RECAST (R4): the board's rerun-in-place gesture arrives as `update`
    // with `intent:'rerun'` and NO changes — an identity-changing anchor
    // RE-ROLL from the current document (new anchor + new revision + stale
    // flags), never a structured patch and never a "nothing to change"
    // refusal.
    const { isRerun } = prepared!;
    const {
      identityPatch,
      generationDoc,
      releasedIdentityDependents,
    } = prepared!;

    const deduct = await deductPoints(
      input.userId, cost, "generation",
      `Model recast (pending)`, input.chargeReferenceId,
    );
    if (!deduct.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${cost} credits.` });
    }
    input.onCharged(cost);

    // ── The PAID DURABLE-EFFECT boundary (review finding 3 + FINAL
    // correction 3): generation, then ONE transaction carrying the atomic
    // identity commit AND its required board landing — the node stamp, the
    // version row, and every downstream stale status. The identity change
    // and the board state that represents it land together or not at all:
    // a failure anywhere inside rolls the whole landing back, nothing
    // durable survives, and the deterministic refund below is always
    // correct. No external image call runs inside the transaction.
    let imageUrl: string;
    let committedRevision: string;
    let uploadedStorageKey: string | undefined;
    let auditGenerationId: number | undefined;
    try {
      const genRecord = await createGeneration({
        userId: input.userId, modelId: model.id,
        operationId: input.operationId, stepKey: "recast", viewAngle: "frontClose",
        type: "castingImage", status: "processing", pointsCost: cost,
      });
      // Review finding 2: a failed audit-row insert is detected, never
      // dereferenced as an undefined id
      if (!genRecord.success || !genRecord.generationId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't start the update" });
      }
      auditGenerationId = genRecord.generationId;
      const generationOptions = {
        castingBrand: (generationDoc.preferences as { castingBrand?: string }).castingBrand || "Generic",
        frame: "HEADSHOT" as const,
        ethnicityHint: buildEthnicityHint(generationDoc.preferences as never),
        userId: String(input.userId),
        modelId: model.id,
        technicalSchema: generationDoc.technicalSchema,
      };
      const generationPrompt = buildReinforcedPrompt(generationDoc.masterPrompt, generationDoc.preferences as never);
      const result = isRerun
        ? await generateCastingImage(generationPrompt, generationOptions).then((generated) => {
            uploadedStorageKey = generated.storageKey;
            return generated;
          })
        : await (async () => {
            // Founder ruling (2026-07-18): changing Casting panel fields is
            // an intentional RECAST, not a same-person surgical iteration.
            // Generate a new identity from the updated casting document, but
            // retain tracked-upload cleanup if the atomic landing fails.
            const candidate = await generateCastingImageRaw(generationPrompt, generationOptions);
            const uploaded = await uploadRawCandidate(candidate.imageBase64, "casting");
            uploadedStorageKey = uploaded.storageKey;
            return { ...uploaded, engineUsed: candidate.engineUsed };
          })();
      if (!result.imageUrl) {
        const auditFailed = await updateGeneration(genRecord.generationId, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
        if (!auditFailed.success) log.error({ itemId: input.itemId, modelId: model.id }, "applyModelEdit: audit-row failure write failed — audit gap");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
      }
      imageUrl = result.imageUrl;

      // Precompute the board landing (reads BEFORE the transaction; the
      // landing callback performs writes only). Final correction 3: the node
      // stamp, its version row, and the downstream stale statuses are
      // REQUIRED board state, not best-effort logging — they commit inside
      // the identity transaction.
      const landingPrefs: Record<string, unknown> = isRerun
        ? current
        : (generationDoc.preferences as Record<string, unknown>);
      const newProv: Provenance = prov.type === "cast_root"
        ? { ...prov, attributes: landingPrefs, engine: result.engineUsed || prov.engine }
        : { ...prov, attributes: landingPrefs };
      const version = (await getLatestVersionNumber(input.itemId)) + 1;
      // Downstream edge targets go stale (D-11); missing/deleted targets are
      // skipped, but a failed stale WRITE is never swallowed — it aborts the
      // whole landing (final correction 3).
      const edges = await getEdgesFrom(input.itemId);
      const staleTargets: Array<{ id: number; metadata: Record<string, unknown> }> = [];
      for (const edge of edges) {
        const target = await getBoardItemById(edge.targetItemId);
        if (!target || target.deletedAt) continue;
        staleTargets.push({
          id: target.id,
          metadata: {
            ...readMeta(target),
            status: {
              type: "stale",
              message: "The cast this was made from was updated — it reflects the previous identity.",
              context: { causedByItemId: input.itemId },
            },
          },
        });
      }
      const landing = async (tx: TransactionHandle) => {
        await stampBoardItemWithVersionIn(tx, {
          itemId: input.itemId,
          update: {
            imageUrl: result.imageUrl,
            metadata: { ...meta, provenance: newProv, attributes: landingPrefs, status: null, isGenerating: false, version },
          },
          version: {
            itemId: input.itemId, version, imageUrl: result.imageUrl,
            prompt: input.intent === "rerun" ? "Recast" : `Recast from settings: ${Object.keys(input.changes).join(", ")}`,
            tool: input.intent === "rerun" ? "rerun" : "attributes",
          },
        });
        for (const target of staleTargets) {
          await updateBoardItemIn(tx, target.id, { metadata: target.metadata });
        }
      };

      if (isRerun) {
        // R4 re-roll: same shared atomic commit `castingImage` uses — new
        // anchor + new revision + stale-all (pinned included), no doc change
        if (!uploadedStorageKey) throw new Error("The recast storage key is unavailable");
        const reRoll = await commitCanvasRecastSnapshot({
          userId: input.userId,
          modelId: model.id,
          operationId: input.operationId,
          readMode: input.readMode,
          patch: null,
          candidate: {
            storageUrl: result.imageUrl,
            storageKey: uploadedStorageKey,
            pointsCost: cost,
            engine: result.engineUsed,
          },
          landing,
        });
        committedRevision = reRoll.result.identityRevisionId;
      } else {
        // §8.6 ATOMIC COMMIT: preferences patch + schema writes + fragments +
        // new anchor (role `anchor`) + new identityRevisionId + stale flags on
        // every filled sibling view, PINNED INCLUDED — all-or-nothing, WITH
        // the board landing in the same transaction (final correction 3).
        if (!uploadedStorageKey) throw new Error("The recast storage key is unavailable");
        const commit = await commitCanvasRecastSnapshot({
          userId: input.userId,
          modelId: model.id,
          operationId: input.operationId,
          readMode: input.readMode,
          patch: identityPatch!,
          candidate: {
            storageUrl: result.imageUrl,
            storageKey: uploadedStorageKey,
            pointsCost: cost,
            engine: result.engineUsed,
          },
          landing,
        });
        committedRevision = commit.result.identityRevisionId;
      }

      // The identity is durably committed — an audit-row failure past this
      // point is an audit gap, never a refund (finding 3, invariant 2)
      const auditDone = await updateGeneration(genRecord.generationId, {
        status: "completed",
        resultUrl: result.imageUrl,
        completedAt: new Date(),
        ...(!isRerun ? {
          metadata: {
            operationMode: "structured_recast",
            releasedIdentityDependents,
          },
        } : {}),
      });
      if (!auditDone.success) {
        log.error({ itemId: input.itemId, modelId: model.id, generationId: genRecord.generationId }, "applyModelEdit: audit-row completion write failed AFTER commit — audit gap, result stands");
      }
    } catch (error) {
      // Nothing durable survived (commit rolls back) — refund once, checked,
      // and carry the refund TRUTH out (corrections 1). Outward wording is
      // sanitized: raw internal error text is logged, never sent.
      log.error({ err: error, itemId: input.itemId, modelId: model.id }, "applyModelEdit recast failed inside the durable boundary");
      if (uploadedStorageKey) {
        try {
          const deleted = await storageDelete(uploadedStorageKey);
          if (!deleted.success) {
            log.error({ itemId: input.itemId, modelId: model.id, uploadedStorageKey }, "applyModelEdit: passing candidate cleanup failed after rollback");
          }
        } catch (cleanupError) {
          log.error({ err: cleanupError, itemId: input.itemId, modelId: model.id, uploadedStorageKey }, "applyModelEdit: passing candidate cleanup threw after rollback");
        }
      }
      // NEW-mode generation replaces this model's visual chat memory before
      // upload/commit completes. Any failed recast must discard that session
      // even when upload failed before producing a storage key.
      clearCastingSession(String(input.userId), model.id);
      if (auditGenerationId) {
        const auditFailed = await updateGeneration(auditGenerationId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
          ...(!isRerun ? {
            metadata: {
              operationMode: "structured_recast",
              releasedIdentityDependents,
            },
          } : {}),
        });
        if (!auditFailed.success) {
          log.error({ itemId: input.itemId, modelId: model.id, generationId: auditGenerationId }, "applyModelEdit: audit-row failure write failed — audit gap");
        }
      }
      const outcome = await recordRefund(input.userId, cost, `Model recast failed (refund)`, input.chargeReferenceId);
      if (outcome.recorded) input.onRefunded(outcome.amount);
      const baseMessage = publicErrorMessage(error, "The recast failed.");
      throw new TRPCError({
        code: error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR",
        message: `${baseMessage} ${refundTruth(outcome)}`,
      });
    }

    // The identity AND its board landing committed together (one
    // transaction) — there is no post-boundary board synchronization left to
    // fail silently, and nothing to repair.
    log.info({ itemId: input.itemId, modelId: model.id, changed: Object.keys(input.changes), rerun: isRerun, revision: committedRevision }, "Model recast");
    return { decision: "update" as const, itemId: input.itemId, modelId: model.id, imageUrl };
  }

  // decision === "fork" — a new unnamed draft, original untouched. This is a
  // CREATION path: merge keeps its creation semantics, references are
  // cleared (§10.3), and intake validation refuses FREE, before deduction
  // (§10.2 — this door previously deducted first).
  const merged = clearEngineChoiceForChanges(
    mergeAttributeChanges(current, input.changes),
    Object.keys(input.changes),
  ) as ModelPreferences & Record<string, unknown>;
  delete merged.referenceImage;
  merged.userPrompt = ""; // inherited briefs are inert in NEW-mode derivation — see generateCastCandidate
  const intake = validateCreationIntent(prepareCandidatePreferences(merged).promptPreferences as Record<string, unknown>);
  if (!intake.ok) {
    log.warn({ itemId: input.itemId, code: intake.code, channel: intake.channel }, "applyModelEdit fork refused at intake (free)");
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: intake.message });
  }

  const deduct = await deductPoints(
    input.userId, cost, "generation",
    `Identity fork (pending)`, input.chargeReferenceId,
  );
  if (!deduct.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${cost} credits.` });
  }
  input.onCharged(cost);

  // ── The PAID DURABLE-EFFECT boundary (review finding 3): the candidate
  // (model row + headshot asset) is the paid result. Failure inside means
  // nothing usable survived — refund once, checked, truth carried out.
  let candidate: Awaited<ReturnType<typeof generateCastCandidate>>;
  try {
    candidate = await generateCastCandidate({
      userId: input.userId, prefs: merged, cost,
      operationId: input.operationId, stepKey: "fork",
    });
  } catch (error) {
    log.error({ err: error, itemId: input.itemId }, "applyModelEdit fork failed inside the durable boundary");
    const outcome = await recordRefund(input.userId, cost, `Identity fork failed (refund)`, input.chargeReferenceId);
    if (outcome.recorded) input.onRefunded(outcome.amount);
    const baseMessage = publicErrorMessage(error, "The fork failed.");
    throw new TRPCError({
      code: error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR",
      message: `${baseMessage} ${refundTruth(outcome)}`,
    });
  }

  // ── Past the boundary: the fork EXISTS and was rightly charged (it lives
  // in the model library either way). The placement (item + v1 + lineage
  // edge) is ONE atomic record (final correction 4); if it fails, the
  // outcome is a TYPED PARTIAL SUCCESS (final correction 5) — never an error
  // shape a client could treat as a free refusal and re-fire, which would
  // charge a second fork.
  const forkProvenance: Provenance = {
    type: "library_cast",
    modelId: candidate.modelId,
    viewAngle: "frontClose",
    attributes: merged as Record<string, unknown>,
    draft: true,
  };
  try {
    const newItemId = await placeLinkedBoardItem({
      item: {
        boardId: item.boardId,
        type: legacyTypeForKind("image", forkProvenance) as never,
        kind: "image",
        imageUrl: candidate.imageUrl,
        positionX: Math.round(item.positionX + item.width + 60),
        positionY: Math.round(item.positionY),
        width: 280,
        height: 420,
        metadata: { provenance: forkProvenance, version: 1 },
        sourceModelId: candidate.modelId,
      },
      edge: { boardId: item.boardId, sourceItemId: input.itemId, relation: "forked_from" },
      initialVersion: { imageUrl: candidate.imageUrl },
    });

    log.info({ itemId: input.itemId, newItemId, forkModelId: candidate.modelId }, "Identity forked");
    return {
      decision: "fork" as const,
      itemId: input.itemId,
      newItemId,
      modelId: candidate.modelId,
      imageUrl: candidate.imageUrl,
      placed: true as const,
    };
  } catch (placementError) {
    log.error(
      { itemId: input.itemId, forkModelId: candidate.modelId, err: placementError instanceof Error ? placementError.message : String(placementError) },
      "applyModelEdit fork: atomic board placement failed AFTER the paid candidate landed (nothing half-written) — no refund, the draft lives in the library",
    );
    return {
      decision: "fork" as const,
      itemId: input.itemId,
      newItemId: null,
      modelId: candidate.modelId,
      imageUrl: candidate.imageUrl,
      placed: false as const,
      placementMessage:
        "Your fork was created and charged — find the new draft in your model library. Placing it on the board failed; it was not charged twice.",
    };
  }
}

// ── runVariations (R4 — N sibling candidates, variant_of edges) ────────────
//
// Foundations §4: N new roots cast from the SAME identity attributes — the
// engine's variance produces the candidates (the D-42 comparison workflow).
// The source is never modified. cast_view sources are NOT_SUPPORTED.

export const MAX_VARIATIONS = 4;

/** Candidates land in a row below the source — one formula, shared by plan
 *  (client optimistic temps read plan.creates) and execute. */
function variationPositions(
  item: { positionX: number; positionY: number; width: number; height: number },
  count: number,
) {
  return Array.from({ length: count }, (_, i) => ({
    x: item.positionX + i * (item.width + 60),
    y: item.positionY + item.height + 80,
  }));
}

/** Pure plan core — exported for tests (Decision 6: cost always CREDIT_COSTS-derived). */
export function buildVariationsPlan(
  itemId: number,
  item: { positionX: number; positionY: number; width: number; height: number },
  requestedCount: number,
): OperationPlan {
  const count = Math.max(1, Math.min(MAX_VARIATIONS, requestedCount));
  return {
    ...emptyPlan("runVariations"),
    creates: variationPositions(item, count).map((position) => ({
      kind: "image" as BoardItemKind,
      provenance: null,
      position,
    })),
    addEdges: Array.from({ length: count }, () => ({
      source: itemId,
      target: 0, // unknown until execute
      relation: "variant_of" as BoardEdgeRelation,
    })),
    estimatedCreditCost: count * CREDIT_COSTS.castingImage,
    estimatedDurationMs: 30_000, // candidates run in parallel
  };
}

export async function planRunVariations(input: { itemId: number; count: number }): Promise<OperationPlan> {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  return buildVariationsPlan(input.itemId, item, input.count);
}

export async function executeRunVariations(input: {
  userId: number;
  itemId: number;
  count: number;
  chargeReferenceId: string;
  operationId: string;
  onCharged: (amount: number) => void;
  onRefunded: (amount: number) => void;
}) {
  const resolved = await resolveModelBackedBoardOperation(input);
  const { item, model, provenance: prov } = resolved;
  if (prov.type === "cast_view") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Variations spawn from the cast, not a view" });
  }

  const rate = checkRateLimit(`user:${input.userId}`, RATE_LIMITS.generation);
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
  }
  await enforceDailyQuota(input.userId);

  const count = Math.max(1, Math.min(MAX_VARIATIONS, input.count));
  const unitCost = CREDIT_COSTS.castingImage;
  const totalCost = count * unitCost;

  // Batch C (§10.2/§10.3, M22): variations are creations — the base
  // preference set is validated and reference-cleared BEFORE the deduction,
  // so a refused intent never moves money.
  const base = { ...((model.preferences ?? {}) as Record<string, unknown>) };
  delete base.referenceImage;
  base.userPrompt = ""; // inherited briefs are inert in NEW-mode derivation — see generateCastCandidate
  const intake = validateCreationIntent(prepareCandidatePreferences(base).promptPreferences as Record<string, unknown>);
  if (!intake.ok) {
    log.warn({ itemId: input.itemId, code: intake.code, channel: intake.channel }, "Variations refused at intake (free)");
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: intake.message });
  }

  const deduct = await deductPoints(
    input.userId, totalCost, "generation",
    `${count} cast variation${count === 1 ? "" : "s"} (pending)`, input.chargeReferenceId,
  );
  if (!deduct.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${totalCost} credits.` });
  }
  input.onCharged(totalCost);
  const positions = variationPositions(item, count);

  // Parallel candidates; failures are named-and-refunded PER candidate (the
  // mintPackage contract) — one bad roll never takes the batch down.
  const settled = await Promise.allSettled(
    positions.map((_, index) =>
      // Each candidate re-resolves engine choices — an open brand rolls fresh
      // per candidate (D-41 records the pick in the model's preferences)
      generateCastCandidate({
        userId: input.userId, prefs: { ...base } as ModelPreferences, cost: unitCost,
        operationId: input.operationId, stepKey: `variation:${index}`,
      }),
    ),
  );

  const variations: Array<{ index: number; itemId: number; modelId: number; imageUrl: string; position: { x: number; y: number } }> = [];
  let unplacedPaidCandidates = 0;
  // Every failure entry carries its own complete truth (final correction 1):
  // generation failures state the recorded refund outcome; placement
  // failures state that the charged draft exists in the library.
  const failures: Array<{ index: number; message: string; refunded: number }> = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "rejected") {
      // BEFORE the durable boundary: no usable candidate survived — refund
      // this slot once, checked, under a per-candidate deterministic id.
      // The outward message is sanitized; the complete error is logged below.
      const message = publicErrorMessage(outcome.reason, "Generation failed.");
      const refundOutcome = await recordRefund(
        input.userId, unitCost,
        `Cast variation ${i + 1} failed (refund)`,
        `${input.chargeReferenceId}:candidate:${i}`,
      );
      if (refundOutcome.recorded) input.onRefunded(refundOutcome.amount);
      failures.push({
        index: i,
        message: `${message} ${refundTruth(refundOutcome)}`,
        refunded: refundOutcome.recorded ? unitCost : 0,
      });
      log.warn({ err: outcome.reason, itemId: input.itemId, index: i, message, refunded: refundOutcome.recorded }, "Variation candidate failed");
      continue;
    }
    // PAST the boundary for this candidate: it exists and was rightly
    // charged (visible in the library). Placement (item + v1 + edge) is one
    // atomic record (final correction 4); a failure is reported honestly —
    // no refund, no silent duplicate-inviting failure.
    const variantProvenance: Provenance = {
      type: "library_cast",
      modelId: outcome.value.modelId,
      viewAngle: "frontClose",
      draft: true,
    };
    try {
      const newItemId = await placeLinkedBoardItem({
        item: {
          boardId: item.boardId,
          type: legacyTypeForKind("image", variantProvenance) as never,
          kind: "image",
          imageUrl: outcome.value.imageUrl,
          positionX: Math.round(positions[i].x),
          positionY: Math.round(positions[i].y),
          width: 280,
          height: 420,
          metadata: { provenance: variantProvenance, version: 1 },
          sourceModelId: outcome.value.modelId,
        },
        edge: { boardId: item.boardId, sourceItemId: input.itemId, relation: "variant_of" },
        initialVersion: { imageUrl: outcome.value.imageUrl },
      });
      variations.push({ index: i, itemId: newItemId, modelId: outcome.value.modelId, imageUrl: outcome.value.imageUrl, position: positions[i] });
    } catch (placementError) {
      unplacedPaidCandidates += 1;
      log.error(
        { itemId: input.itemId, index: i, modelId: outcome.value.modelId, err: placementError instanceof Error ? placementError.message : String(placementError) },
        "runVariations: atomic placement failed AFTER the paid candidate landed (nothing half-written) — no refund, the draft lives in the library",
      );
      failures.push({
        index: i,
        message: "Created and charged — placing it on the board failed. Find the draft in your model library; it was not charged twice.",
        refunded: 0,
      });
    }
  }

  if (variations.length === 0) {
    // Every failure entry carries its own honest copy — generation failures
    // were refunded per candidate; placement failures name the charged draft
    if (unplacedPaidCandidates > 0) {
      return { itemId: input.itemId, variations, failures, creditCost: totalCost };
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: failures[0]?.message || "All variations failed." });
  }

  log.info({ itemId: input.itemId, requested: count, landed: variations.length }, "Variations cast");
  const refundedCredits = failures.reduce((sum, failure) => sum + failure.refunded, 0);
  return { itemId: input.itemId, variations, failures, creditCost: totalCost - refundedCredits };
}

// ── popOutView / collapseView (R5 — the comp card's board placements) ──────
//
// D-39 ratification: the package lives on model_assets; a pop-out is a board
// PLACEMENT that references a model asset — `cast_view` board rows never
// carry package state. The generated_from_cast edge written here is exactly
// what the R4 delete-cascade dialog keys off (predictDeleteUnit client-side,
// cascadeUnit above) — it activates with no further wiring (VC-R4 confirm).

export const VIEW_CARD_WIDTH = 200;
const VIEW_CARD_HEIGHT = 360; // label row + 3:4 image (267) + strip allowance
const POP_OUT_GAP_X = 60;
const POP_OUT_STEP_Y = VIEW_CARD_HEIGHT + 30;
/** Rows per column before wrapping right (VC-R5 close-out bug 0): two rows
 *  keeps every placement within ~1.5 view-card heights of its predecessor —
 *  the old unbounded single-column stack sent a fifth view half a screen
 *  down. Columns advance right, staying visually near the root. */
const POP_OUT_ROWS_PER_COLUMN = 2;
const POP_OUT_MAX_COLUMNS = 8;

export interface OccupiedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: OccupiedRect, b: OccupiedRect, margin: number): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

/** Pop-outs land right of the root (founder-ruled at R5 planning; VC-R5 R2
 *  approved the geometry): the NEAREST FREE SLOT scanning a 2-rows-then-wrap
 *  grid of columns, skipping slots that collide with existing nodes — never
 *  an unbounded downward run (close-out bug 0). Pure; exported for tests. */
export function popOutPlacement(
  root: { positionX: number; positionY: number; width: number | null },
  occupied: OccupiedRect[],
): { x: number; y: number } {
  const startX = root.positionX + (root.width ?? 280) + POP_OUT_GAP_X;
  let candidate = { x: startX, y: root.positionY };
  for (let col = 0; col < POP_OUT_MAX_COLUMNS; col++) {
    for (let row = 0; row < POP_OUT_ROWS_PER_COLUMN; row++) {
      candidate = {
        x: startX + col * (VIEW_CARD_WIDTH + POP_OUT_GAP_X),
        y: root.positionY + row * POP_OUT_STEP_Y,
      };
      const slot: OccupiedRect = { ...candidate, width: VIEW_CARD_WIDTH, height: VIEW_CARD_HEIGHT };
      if (!occupied.some((r) => rectsOverlap(slot, r, 8))) return candidate;
    }
  }
  return candidate; // a full 8-column shelf — take the last slot rather than run away
}

export async function planPopOutView(input: { itemId: number; angle: CanonicalViewAngle }): Promise<OperationPlan> {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const meta = readMeta(item);
  const prov = meta.provenance;
  const modelId = prov && "modelId" in prov ? prov.modelId : null;
  return {
    ...emptyPlan("popOutView"),
    creates: [
      {
        kind: "image",
        provenance: modelId
          ? { type: "cast_view", modelId, rootItemId: input.itemId, viewAngle: input.angle, attributes: meta.attributes ?? {}, engine: "package", inputs: [] }
          : null,
        position: popOutPlacement(item, []),
      },
    ],
    addEdges: [{ source: input.itemId, target: -1, relation: "generated_from_cast" }],
  };
}

export async function executePopOutView(input: {
  userId: number;
  boardId: number;
  itemId: number; // the root placement
  angle: CanonicalViewAngle;
  readMode: SnapshotReadMode;
  position?: { x: number; y: number }; // pin-spawn passes the drop point
}) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const meta = readMeta(item);
  const prov = meta.provenance;
  if (!prov || (prov.type !== "cast_root" && prov.type !== "library_cast") || !("modelId" in prov)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a placed cast can pop views out" });
  }
  const modelId = prov.modelId;

  const { asset: assetRow } = await resolveCanvasPackageView({
    userId: input.userId,
    modelId,
    angle: input.angle,
    readMode: input.readMode,
    r6Selection: "filled_angle",
  });
  if (!assetRow?.storageUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${VIEW_ANGLE_LABELS[input.angle]} hasn't been cast yet — add it from the comp card`,
    });
  }

  // One placement per angle per root (package integrity — the tile keeps
  // rendering; a second identical card would just be a duplicate)
  const viewEdges = await getEdgesFrom(input.itemId, "generated_from_cast");
  for (const edge of viewEdges) {
    const target = await getBoardItemById(edge.targetItemId);
    if (!target || target.deletedAt) continue;
    const targetProv = readMeta(target).provenance;
    if (targetProv?.type === "cast_view" && targetProv.viewAngle === input.angle) {
      throw new TRPCError({ code: "CONFLICT", message: `${VIEW_ANGLE_LABELS[input.angle]} is already on the board` });
    }
  }

  // Collision-aware placement against every alive node (close-out bug 0):
  // the nearest free slot beside the root, never an unbounded downward run
  const aliveItems = await getBoardItems(input.boardId);
  const occupied: OccupiedRect[] = aliveItems.map((i) => ({
    x: i.positionX,
    y: i.positionY,
    width: i.width ?? 280,
    height: i.height ?? 420,
  }));
  const position = input.position ?? popOutPlacement(item, occupied);
  const assetProv = assetRow.provenance as { engine?: string } | null;
  const { itemId: newItemId } = await executeCreateNode({
    boardId: input.boardId,
    kind: "image",
    provenance: {
      type: "cast_view",
      modelId,
      rootItemId: input.itemId,
      viewAngle: input.angle,
      attributes: meta.attributes ?? {},
      engine: assetProv?.engine ?? "package",
      // D-12: the exact image this placement consumed, at pop-out time
      inputs: [{ itemId: input.itemId, imageUrl: assetRow.storageUrl }],
    },
    position,
    size: { width: VIEW_CARD_WIDTH, height: VIEW_CARD_HEIGHT },
    label: item.label ?? undefined,
    imageUrl: assetRow.storageUrl,
  });
  // The cascade-bearing lineage edge, with D-30's viewAngle intent metadata
  const edgeId = await addBoardEdge({
    boardId: input.boardId,
    sourceItemId: input.itemId,
    targetItemId: newItemId,
    relation: "generated_from_cast",
    metadata: { viewAngle: input.angle },
  });
  log.info({ rootItemId: input.itemId, newItemId, angle: input.angle }, "View popped out");
  return { itemId: newItemId, imageUrl: assetRow.storageUrl, edgeId, viewAngle: input.angle, position };
}

/** Collapse's edge moves, pure (exported for tests): the root→popped lineage
 *  edge is removed; every OUTGOING edge re-anchors to the root with the
 *  popped view's angle preserved in metadata — D-30's weighted-reference
 *  contract survives the collapse with no data loss. Incoming third-party
 *  edges are left in place (orphaned by the soft delete, same as deleteNodes). */
export function planCollapseEdgeMoves(
  edges: Array<{ id: number; sourceItemId: number; targetItemId: number; relation: BoardEdgeRelation; metadata: unknown }>,
  rootItemId: number,
  poppedItemId: number,
  viewAngle: CanonicalViewAngle,
): {
  removeEdgeIds: number[];
  addEdges: Array<{ sourceItemId: number; targetItemId: number; relation: BoardEdgeRelation; metadata: Record<string, unknown> }>;
} {
  const removeEdgeIds: number[] = [];
  const addEdges: Array<{ sourceItemId: number; targetItemId: number; relation: BoardEdgeRelation; metadata: Record<string, unknown> }> = [];
  for (const edge of edges) {
    if (edge.relation === "generated_from_cast" && edge.sourceItemId === rootItemId && edge.targetItemId === poppedItemId) {
      removeEdgeIds.push(edge.id); // the lineage edge dematerializes with the card
      continue;
    }
    if (edge.sourceItemId === poppedItemId && edge.targetItemId !== rootItemId) {
      removeEdgeIds.push(edge.id);
      addEdges.push({
        sourceItemId: rootItemId,
        targetItemId: edge.targetItemId,
        relation: edge.relation,
        metadata: { ...(edge.metadata && typeof edge.metadata === "object" ? edge.metadata as Record<string, unknown> : {}), viewAngle },
      });
    }
  }
  return { removeEdgeIds, addEdges };
}

/** NOTE: collapse is not Cmd+Z-undoable in pass 1 (edge moves aren't
 *  versioned); recovery is a free re-pop-out. */
export async function executeCollapseView(input: { userId: number; boardId: number; itemId: number }) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const prov = readMeta(item).provenance;
  if (prov?.type !== "cast_view") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a popped-out view can collapse into its comp card" });
  }
  const edges = await getEdgesForItem(input.itemId);
  const moves = planCollapseEdgeMoves(edges, prov.rootItemId, input.itemId, prov.viewAngle);
  for (const edgeId of moves.removeEdgeIds) await removeBoardEdge(edgeId);
  for (const add of moves.addEdges) await addBoardEdge({ boardId: input.boardId, ...add });
  await softDeleteBoardItems([input.itemId]);
  log.info({ itemId: input.itemId, reanchored: moves.addEdges.length }, "View collapsed into sheet");
  return { collapsed: true, rootItemId: prov.rootItemId, reanchored: moves.addEdges.length };
}

// ── Shared read helper for the router ──────────────────────────────────────

export async function requireItemInBoard(itemId: number, boardId: number) {
  const item = await getBoardItemById(itemId);
  if (!item || item.boardId !== boardId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Node not found on this board" });
  }
  return item;
}

export { getEdgesForItem };
