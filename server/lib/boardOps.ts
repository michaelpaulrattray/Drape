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
  CREDIT_COSTS,
  type ModelPreferences,
} from "../casting/aiService";
import { buildEthnicityHint, buildReinforcedPrompt } from "../casting/promptReinforcement";
import { parseCastingPrompt, mergeParsedPreferences, resolveEngineChoices } from "../casting/promptParser";
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
    // Three-path parser dispatch (R2/D-14): parsed / random / per-field
    // random, merged under defaults < parser < randomization < locked
    // attributes. The parser NEVER blocks a paid run — on failure the prompt
    // passes through verbatim (the engine already interprets free text).
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

    // Register the headshot as a model asset (parity with the legacy flow) —
    // the models library, the D-28 picker, and /studio resume all read these.
    await createModelAsset({
      modelId,
      viewType: "frontClose",
      resolution: "1K",
      storageUrl: result.imageUrl,
      pointsCost: cost,
    });

    // Stamp the node: image + provenance (Decision 1 — engine recorded) +
    // attrs + version (the strip reads metadata.version — never hardcode)
    const provenance: Provenance = {
      type: "cast_root",
      modelId,
      viewAngle: "frontClose",
      attributes: { ...prefs } as Record<string, unknown>,
      engine: result.engineUsed || "gemini",
    };
    const meta = readMeta(item);
    const version = (await getLatestVersionNumber(input.itemId)) + 1;
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
        version,
      } satisfies BoardItemCanvasMetadata,
    });
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

// ── fillFromLibrary (D-28 — empty cast node picks an existing model) ───────
//
// Fills THIS node in place: provenance → library_cast, image → the model's
// canonical headshot, initial version row. Never spawns a sibling.

export async function executeFillFromLibrary(input: {
  userId: number;
  itemId: number;
  modelId: number;
}) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });

  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

  // Canonical reference imagery only (D-28 constraint): the frontClose asset.
  const assets = await getModelAssets(input.modelId);
  const headshot = assets.find((a) => a.viewType === "frontClose") ?? assets[0];
  if (!headshot?.storageUrl) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This model has no canonical imagery yet" });
  }

  const canonical = ["frontClose", "frontFull", "sideClose", "sideFull", "backFull"];
  const draft = model.status !== "active" && model.status !== "locked";
  const provenance: Provenance = {
    type: "library_cast",
    modelId: input.modelId,
    viewAngle: (canonical.includes(headshot.viewType) ? headshot.viewType : "frontClose") as
      Extract<Provenance, { type: "library_cast" }>["viewAngle"],
    ...(draft ? { draft: true } : {}),
  };

  const meta = readMeta(item);
  // Unnamed drafts render as unnamed (D-42) — never the fake auto-name
  const honestName = draft && model.name === DRAFT_AUTO_NAME ? null : model.name;
  const version = (await getLatestVersionNumber(input.itemId)) + 1;
  await updateBoardItem(input.itemId, {
    imageUrl: headshot.storageUrl,
    label: honestName || item.label || null,
    metadata: { ...meta, provenance, status: null, isGenerating: false, version },
    // Keep the legacy FK in sync — the node was created empty, so createNode
    // couldn't stamp it (legacy surfaces + analytics read this column)
    sourceModelId: input.modelId,
  });
  await addBoardItemVersion({
    itemId: input.itemId,
    version,
    imageUrl: headshot.storageUrl,
    tool: "initial",
  });
  return { itemId: input.itemId, modelId: input.modelId, imageUrl: headshot.storageUrl, label: honestName, draft };
}

// ── listCastableModels (D-28 picker data, D-42 drafts) ─────────────────────
//
// Models represented ONLY by canonical cast reference imagery (frontClose
// headshot). Models without one are excluded — never substituted with VTO
// or styled outputs (§1.5). Drafts are placeable and honestly presented
// (D-42): they carry `draft: true`, sort below minted models, and the fake
// auto-name ("Draft Model") is stripped — unnamed renders as unnamed.

const DRAFT_AUTO_NAME = "Draft Model";

export async function listCastableModels(userId: number, limit = 30) {
  const { getUserModels } = await import("../db");
  const models = await getUserModels(userId, limit * 2); // headroom for filtering
  const out: Array<{ id: number; name: string | null; headshotUrl: string; draft: boolean }> = [];
  for (const model of models) {
    if (out.length >= limit) break;
    const assets = await getModelAssets(model.id);
    const headshot = assets.find((a) => a.viewType === "frontClose");
    if (headshot?.storageUrl) {
      const draft = model.status !== "active" && model.status !== "locked";
      out.push({
        id: model.id,
        name: draft && model.name === DRAFT_AUTO_NAME ? null : model.name,
        headshotUrl: headshot.storageUrl,
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
}

export async function executeApplyModelEdit(input: ApplyModelEditInput) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const meta = readMeta(item);
  const prov = meta.provenance;
  if (!prov || !("modelId" in prov)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This node has no cast identity to edit" });
  }
  const model = await getModelById(prov.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

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

  const current = (model.preferences ?? {}) as Record<string, unknown>;
  const merged = resolveEngineChoices(mergeAttributeChanges(current, input.changes));

  const cost = CREDIT_COSTS.castingImage;
  const deduct = await deductPoints(
    input.userId, cost, "generation",
    `Identity ${input.decision} (pending)`, `apply-edit-${input.itemId}-${Date.now()}`,
  );
  if (!deduct.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${cost} credits.` });
  }

  try {
    const masterPrompt = await generateMasterPrompt(merged);

    if (input.decision === "update") {
      const genRecord = await createGeneration({
        userId: input.userId, modelId: model.id, type: "castingImage", status: "processing", pointsCost: cost,
      });
      const result = await generateCastingImage(
        buildReinforcedPrompt(masterPrompt.naturalDescription, merged as never),
        {
          castingBrand: (merged as { castingBrand?: string }).castingBrand || "Generic",
          frame: "HEADSHOT",
          ethnicityHint: buildEthnicityHint(merged as never),
          userId: String(input.userId),
        },
      );
      if (!result.imageUrl) {
        await updateGeneration(genRecord.generationId!, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
      }
      await updateGeneration(genRecord.generationId!, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
      await createModelAsset({ modelId: model.id, viewType: "frontClose", resolution: "1K", storageUrl: result.imageUrl, pointsCost: cost });
      await updateModel(model.id, {
        masterPrompt: masterPrompt.naturalDescription,
        technicalSchema: masterPrompt.technicalSchema,
        preferences: merged,
      });

      // Restamp THIS node — the landing op is the only writer of node versions (D-23)
      const newProv: Provenance = prov.type === "cast_root"
        ? { ...prov, attributes: merged as Record<string, unknown>, engine: result.engineUsed || prov.engine }
        : { ...prov, attributes: merged as Record<string, unknown> };
      const version = (await getLatestVersionNumber(input.itemId)) + 1;
      await updateBoardItem(input.itemId, {
        imageUrl: result.imageUrl,
        metadata: { ...meta, provenance: newProv, attributes: merged as Record<string, unknown>, status: null, isGenerating: false, version },
      });
      await addBoardItemVersion({
        itemId: input.itemId, version, imageUrl: result.imageUrl,
        prompt: `Identity update: ${Object.keys(input.changes).join(", ")}`,
        tool: "attributes",
      });

      // Downstream edge targets go stale (D-11; R5 renders the full flow)
      const edges = await getEdgesFrom(input.itemId);
      for (const edge of edges) {
        await executeMarkNodeStatus({
          itemId: edge.targetItemId,
          status: {
            type: "stale",
            message: "The cast this was made from was updated — it reflects the previous identity.",
            context: { causedByItemId: input.itemId },
          },
        }).catch(() => {});
      }

      log.info({ itemId: input.itemId, modelId: model.id, changed: Object.keys(input.changes) }, "Identity updated");
      return { decision: "update" as const, itemId: input.itemId, modelId: model.id, imageUrl: result.imageUrl };
    }

    // decision === "fork" — a new unnamed draft, original untouched
    const forkModel = await createModel({
      userId: input.userId,
      name: DRAFT_AUTO_NAME,
      masterPrompt: masterPrompt.naturalDescription,
      technicalSchema: masterPrompt.technicalSchema,
      preferences: merged,
      status: "draft",
    });
    if (!forkModel.success || !forkModel.modelId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: forkModel.error || "Failed to create fork" });
    }
    const genRecord = await createGeneration({
      userId: input.userId, modelId: forkModel.modelId, type: "castingImage", status: "processing", pointsCost: cost,
    });
    const result = await generateCastingImage(
      buildReinforcedPrompt(masterPrompt.naturalDescription, merged as never),
      {
        castingBrand: (merged as { castingBrand?: string }).castingBrand || "Generic",
        frame: "HEADSHOT",
        ethnicityHint: buildEthnicityHint(merged as never),
        userId: String(input.userId),
      },
    );
    if (!result.imageUrl) {
      await updateGeneration(genRecord.generationId!, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
    }
    await updateGeneration(genRecord.generationId!, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
    await createModelAsset({ modelId: forkModel.modelId, viewType: "frontClose", resolution: "1K", storageUrl: result.imageUrl, pointsCost: cost });

    const { itemId: newItemId } = await executeCreateNode({
      boardId: item.boardId,
      kind: "image",
      provenance: {
        type: "library_cast",
        modelId: forkModel.modelId,
        viewAngle: "frontClose",
        attributes: merged as Record<string, unknown>,
        draft: true,
      },
      position: { x: item.positionX + item.width + 60, y: item.positionY },
      size: { width: 280, height: 420 },
      imageUrl: result.imageUrl,
    });
    await addBoardEdge({
      boardId: item.boardId,
      sourceItemId: input.itemId,
      targetItemId: newItemId,
      relation: "forked_from",
    });

    log.info({ itemId: input.itemId, newItemId, forkModelId: forkModel.modelId }, "Identity forked");
    return { decision: "fork" as const, itemId: input.itemId, newItemId, modelId: forkModel.modelId, imageUrl: result.imageUrl };
  } catch (error) {
    // Atomic-credits contract: refund on any failure after deduction
    await addCredits(input.userId, cost, "refund", `Identity ${input.decision} failed (refund)`);
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
