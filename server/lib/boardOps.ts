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
  CanonicalViewAngle,
} from "../../shared/boardTypes";
import { VIEW_ANGLE_LABELS } from "../../shared/boardTypes";
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
  /** 'rerun' = the R4 fork/recast gesture (same engine path, version rows
   *  stamp `tool:'rerun'`); 'edit' = an environment save (default). */
  intent?: "edit" | "rerun";
}

/**
 * One draft candidate from a set of preferences: model row (unnamed draft,
 * D-42) + generation audit + headshot + frontClose asset. The shared engine
 * path behind fork (applyModelEdit), recast-as-fork, and runVariations.
 * Throws on failure — the CALLER owns deduction and refunds.
 */
async function generateCastCandidate(opts: { userId: number; prefs: ModelPreferences; cost: number }) {
  const masterPrompt = await generateMasterPrompt(opts.prefs);
  const model = await createModel({
    userId: opts.userId,
    name: DRAFT_AUTO_NAME,
    masterPrompt: masterPrompt.naturalDescription,
    technicalSchema: masterPrompt.technicalSchema,
    preferences: opts.prefs,
    status: "draft",
  });
  if (!model.success || !model.modelId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: model.error || "Failed to create model" });
  }
  const genRecord = await createGeneration({
    userId: opts.userId, modelId: model.modelId, type: "castingImage", status: "processing", pointsCost: opts.cost,
  });
  const result = await generateCastingImage(
    buildReinforcedPrompt(masterPrompt.naturalDescription, opts.prefs as never),
    {
      castingBrand: (opts.prefs as { castingBrand?: string }).castingBrand || "Generic",
      frame: "HEADSHOT",
      ethnicityHint: buildEthnicityHint(opts.prefs as never),
      userId: String(opts.userId),
    },
  );
  if (!result.imageUrl) {
    await updateGeneration(genRecord.generationId!, { status: "failed", errorMessage: "No image generated", completedAt: new Date() });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
  }
  await updateGeneration(genRecord.generationId!, { status: "completed", resultUrl: result.imageUrl, completedAt: new Date() });
  await createModelAsset({ modelId: model.modelId, viewType: "frontClose", resolution: "1K", storageUrl: result.imageUrl, pointsCost: opts.cost });
  return { modelId: model.modelId, imageUrl: result.imageUrl, engineUsed: result.engineUsed };
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
    if (input.decision === "update") {
      const masterPrompt = await generateMasterPrompt(merged);
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
      // R4: a recast (rerun-in-place, drafts only past the D-43 guard) is a
      // rerun in the version ledger, not an attribute edit
      await addBoardItemVersion({
        itemId: input.itemId, version, imageUrl: result.imageUrl,
        prompt: input.intent === "rerun" ? "Recast" : `Identity update: ${Object.keys(input.changes).join(", ")}`,
        tool: input.intent === "rerun" ? "rerun" : "attributes",
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
    const candidate = await generateCastCandidate({ userId: input.userId, prefs: merged, cost });
    const { itemId: newItemId } = await executeCreateNode({
      boardId: item.boardId,
      kind: "image",
      provenance: {
        type: "library_cast",
        modelId: candidate.modelId,
        viewAngle: "frontClose",
        attributes: merged as Record<string, unknown>,
        draft: true,
      },
      position: { x: item.positionX + item.width + 60, y: item.positionY },
      size: { width: 280, height: 420 },
      imageUrl: candidate.imageUrl,
    });
    await addBoardEdge({
      boardId: item.boardId,
      sourceItemId: input.itemId,
      targetItemId: newItemId,
      relation: "forked_from",
    });

    log.info({ itemId: input.itemId, newItemId, forkModelId: candidate.modelId }, "Identity forked");
    return { decision: "fork" as const, itemId: input.itemId, newItemId, modelId: candidate.modelId, imageUrl: candidate.imageUrl };
  } catch (error) {
    // Atomic-credits contract: refund on any failure after deduction
    await addCredits(input.userId, cost, "refund", `Identity ${input.decision} failed (refund)`);
    throw error;
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

export async function executeRunVariations(input: { userId: number; itemId: number; count: number }) {
  const item = await getBoardItemById(input.itemId);
  if (!item || item.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
  const meta = readMeta(item);
  const prov = meta.provenance;
  if (!prov || !("modelId" in prov)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This node has no cast identity to vary" });
  }
  if (prov.type === "cast_view") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Variations spawn from the cast, not a view" });
  }
  const model = await getModelById(prov.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

  const rate = checkRateLimit(`user:${input.userId}`, RATE_LIMITS.generation);
  if (!rate.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
  }
  await enforceDailyQuota(input.userId);

  const count = Math.max(1, Math.min(MAX_VARIATIONS, input.count));
  const unitCost = CREDIT_COSTS.castingImage;
  const totalCost = count * unitCost;
  const deduct = await deductPoints(
    input.userId, totalCost, "generation",
    `${count} cast variation${count === 1 ? "" : "s"} (pending)`, `variations-${input.itemId}-${Date.now()}`,
  );
  if (!deduct.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: deduct.error || `Insufficient credits. Need ${totalCost} credits.` });
  }

  const base = (model.preferences ?? {}) as Record<string, unknown>;
  const positions = variationPositions(item, count);

  // Parallel candidates; failures are named-and-refunded PER candidate (the
  // mintPackage contract) — one bad roll never takes the batch down.
  const settled = await Promise.allSettled(
    positions.map(() =>
      // Each candidate re-resolves engine choices — an open brand rolls fresh
      // per candidate (D-41 records the pick in the model's preferences)
      generateCastCandidate({ userId: input.userId, prefs: resolveEngineChoices({ ...base } as ModelPreferences), cost: unitCost }),
    ),
  );

  const variations: Array<{ index: number; itemId: number; modelId: number; imageUrl: string; position: { x: number; y: number } }> = [];
  const failures: Array<{ index: number; message: string }> = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "rejected") {
      const message = outcome.reason instanceof Error ? outcome.reason.message : "Generation failed";
      failures.push({ index: i, message });
      await addCredits(input.userId, unitCost, "refund", `Cast variation ${i + 1} failed (refund)`);
      log.warn({ itemId: input.itemId, index: i, message }, "Variation candidate failed — refunded");
      continue;
    }
    const { itemId: newItemId } = await executeCreateNode({
      boardId: item.boardId,
      kind: "image",
      provenance: {
        type: "library_cast",
        modelId: outcome.value.modelId,
        viewAngle: "frontClose",
        draft: true,
      },
      position: positions[i],
      size: { width: 280, height: 420 },
      imageUrl: outcome.value.imageUrl,
    });
    await addBoardEdge({
      boardId: item.boardId,
      sourceItemId: input.itemId,
      targetItemId: newItemId,
      relation: "variant_of",
    });
    variations.push({ index: i, itemId: newItemId, modelId: outcome.value.modelId, imageUrl: outcome.value.imageUrl, position: positions[i] });
  }

  if (variations.length === 0) {
    // Everything already refunded per candidate above
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: failures[0]?.message || "All variations failed — you weren't charged." });
  }

  log.info({ itemId: input.itemId, requested: count, landed: variations.length }, "Variations cast");
  return { itemId: input.itemId, variations, failures, creditCost: variations.length * unitCost };
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

/** Pop-outs land right of the root, stacking downward (founder-ruled at R5
 *  planning; shares fork's "beside" axis — flagged for the VC-R5 feel ruling
 *  per D-48; this constant is the one tuning point). Exported for tests. */
export function popOutPlacement(
  root: { positionX: number; positionY: number; width: number | null },
  existingPoppedCount: number,
): { x: number; y: number } {
  return {
    x: root.positionX + (root.width ?? 280) + POP_OUT_GAP_X,
    y: root.positionY + existingPoppedCount * POP_OUT_STEP_Y,
  };
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
        position: popOutPlacement(item, 0),
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

  const model = await getModelById(modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

  // The angle's CURRENT image — newest filled row (the read model's rule)
  const assets = await getModelAssets(modelId);
  const assetRow = assets.find((a) => a.viewType === input.angle && a.storageUrl);
  if (!assetRow) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${VIEW_ANGLE_LABELS[input.angle]} hasn't been cast yet — add it from the comp card`,
    });
  }

  // One placement per angle per root (package integrity — the tile keeps
  // rendering; a second identical card would just be a duplicate)
  const viewEdges = await getEdgesFrom(input.itemId, "generated_from_cast");
  let alivePopped = 0;
  for (const edge of viewEdges) {
    const target = await getBoardItemById(edge.targetItemId);
    if (!target || target.deletedAt) continue;
    alivePopped += 1;
    const targetProv = readMeta(target).provenance;
    if (targetProv?.type === "cast_view" && targetProv.viewAngle === input.angle) {
      throw new TRPCError({ code: "CONFLICT", message: `${VIEW_ANGLE_LABELS[input.angle]} is already on the board` });
    }
  }

  const position = input.position ?? popOutPlacement(item, alivePopped);
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
