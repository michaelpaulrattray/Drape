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
  getBoardItemById,
  updateBoardItem,
  batchUpdateBoardItemPositions,
  softDeleteBoardItems,
  undoDeleteBoardItems,
  addBoardItemVersion,
  getLatestVersionNumber,
  createModel,
  createGeneration,
  updateGeneration,
  deductPoints,
  addCredits,
} from "../db";
import { addBoardEdge, getEdgesForItem, removeBoardEdge, getEdgesFrom } from "../db/boardEdges";
import {
  generateMasterPrompt,
  generateCastingImage,
  CREDIT_COSTS,
  type ModelPreferences,
} from "../casting/aiService";
import { buildEthnicityHint, buildReinforcedPrompt } from "../casting/promptReinforcement";
import { enforceDailyQuota } from "../db/dailyQuota";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import type {
  Provenance,
  NodeStatus,
  BoardItemCanvasMetadata,
} from "../../shared/boardTypes";
import type { BoardItemKind, BoardEdgeRelation } from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";

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
  };
  const itemId = await addBoardItem({
    boardId: input.boardId,
    type: legacyTypeForKind(input.kind, input.provenance) as never,
    kind: input.kind,
    label: input.label,
    imageUrl: input.imageUrl,
    positionX: Math.round(input.position.x),
    positionY: Math.round(input.position.y),
    width: input.size?.width ?? 260,
    height: input.size?.height ?? 220,
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

/** A root's cascade unit = itself + its generated_from_cast targets. */
async function cascadeUnit(itemId: number): Promise<number[]> {
  const viewEdges = await getEdgesFrom(itemId, "generated_from_cast");
  return [itemId, ...viewEdges.map((e) => e.targetItemId)];
}

export async function planDeleteNode(input: { itemId: number }): Promise<OperationPlan> {
  const unit = await cascadeUnit(input.itemId);
  return { ...emptyPlan("deleteNode"), deletes: unit };
}

export async function executeDeleteNode(input: { itemId: number }) {
  const unit = await cascadeUnit(input.itemId);
  await softDeleteBoardItems(unit);
  // Edges + versions survive intact — undo restores everything (Decision 7)
  return { deletedItemIds: unit };
}

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
}

export async function executeRunGeneration(input: RunGenerationInput) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });

  const rate = checkRateLimit(`user:${input.userId}`, RATE_LIMITS.generation);
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
  }
  await enforceDailyQuota(input.userId);

  const cost = CREDIT_COSTS.castingImage;
  const deduct = await deductPoints(
    input.userId, cost, "generation", "Canvas cast generation (pending)", `board-item-${input.itemId}-${Date.now()}`,
  );
  if (!deduct.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: deduct.error || `Insufficient credits. Need ${cost} credits.`,
    });
  }

  try {
    // M2b replaces this passthrough with the three-path parser dispatch.
    const prefs: ModelPreferences = {
      ...(input.attributes ?? {}),
      userPrompt: input.userPrompt ?? "",
    } as ModelPreferences;

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
    const modelId = modelResult.modelId;

    const genRecord = await createGeneration({
      userId: input.userId,
      modelId,
      type: "castingImage",
      status: "processing",
      pointsCost: cost,
    });

    const ethnicityHint = buildEthnicityHint(prefs as never);
    const reinforced = buildReinforcedPrompt(masterPrompt.naturalDescription, prefs as never);
    const result = await generateCastingImage(reinforced, {
      castingBrand: (prefs as { castingBrand?: string }).castingBrand || "Generic",
      frame: "HEADSHOT",
      ethnicityHint,
      userId: String(input.userId),
    });
    if (!result.imageUrl) {
      await updateGeneration(genRecord.generationId!, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
    }
    await updateGeneration(genRecord.generationId!, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });

    // Stamp the node: image + provenance (Decision 1 — engine recorded) + attrs
    const provenance: Provenance = {
      type: "cast_root",
      modelId,
      viewAngle: "frontClose",
      attributes: { ...prefs } as Record<string, unknown>,
      engine: result.engineUsed || "gemini",
    };
    const meta = readMeta(item);
    await updateBoardItem(input.itemId, {
      imageUrl: result.imageUrl,
      label: input.modelName || item.label || "Cast",
      metadata: {
        ...meta,
        provenance,
        attributes: { ...prefs } as Record<string, unknown>,
        userPrompt: input.userPrompt ?? "",
        status: null,
        isGenerating: false,
      } satisfies BoardItemCanvasMetadata,
    });
    const version = (await getLatestVersionNumber(input.itemId)) + 1;
    await addBoardItemVersion({
      itemId: input.itemId,
      version,
      imageUrl: result.imageUrl,
      prompt: input.userPrompt || null,
      tool: version === 1 ? "initial" : "rerun",
    });

    log.info({ itemId: input.itemId, modelId, engine: result.engineUsed }, "Canvas cast generated");
    return {
      success: true as const,
      itemId: input.itemId,
      modelId,
      imageUrl: result.imageUrl,
      masterPrompt: masterPrompt.naturalDescription,
      creditCost: cost,
    };
  } catch (error) {
    // Refund on any failure after deduction (the atomic-credits contract);
    // the node keeps its error status client-side ("You weren't charged").
    await addCredits(input.userId, cost, "refund", "Canvas cast generation failed (refund)");
    await executeMarkNodeStatus({
      itemId: input.itemId,
      status: {
        type: "error",
        message: error instanceof Error ? error.message : "Generation failed",
      },
    }).catch(() => {});
    throw error;
  }
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
