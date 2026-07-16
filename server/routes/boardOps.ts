/**
 * boardOps Router — tRPC surface over server/lib/boardOps + boardState.
 *
 * Thin: ownership checks + input validation only; all behavior lives in the
 * lib modules (foundations Decision 5.1 — no component mutates board state
 * except through here, and an agent can drive the same operations).
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getBoardById } from "../db";
import { getBoardEdges } from "../db/boardEdges";
import * as boardOps from "../lib/boardOps";
import { getSnapshot } from "../lib/boardState";
import { BOARD_ITEM_KINDS, BOARD_EDGE_RELATIONS } from "../../drizzle/schema";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
import type { Provenance, NodeStatus } from "../../shared/boardTypes";

async function requireBoardOwnership(boardId: number, userId: number) {
  const board = await getBoardById(boardId);
  if (!board) throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
  if (board.userId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return board;
}

const kindSchema = z.enum(BOARD_ITEM_KINDS);
const relationSchema = z.enum(BOARD_EDGE_RELATIONS);
const positionSchema = z.object({ x: z.number(), y: z.number() });

/**
 * Batch C (§13.5/M6): the structured attribute editor's wire boundary.
 * `changes` was an arbitrary z.record — now every key must be a known
 * casting-form field; unknown keys (and the removed `referenceImage` /
 * `previousMasterPrompt` channels) are REJECTED, never silently stripped.
 * The update branch further restricts to authorizable identity fields
 * (buildStructuredPatch); fork validates the full creation intake.
 */
const MODEL_EDIT_CHANGE_KEYS = new Set([
  "gender", "age", "ethnicity", "ethnicityBlend", "bodyType",
  "faceShape", "jawline", "cheekbones", "cheeks", "eyeShape", "noseShape",
  "lipShape", "eyebrowStyle", "skinTone", "skinTexture", "skinFinish",
  "eyeColor", "hairStyle", "hairColor", "hairLength", "hairTexture",
  "hairFringe", "hairParting", "hairVolume", "hairFlyaways", "hairHairline",
  "hairTuck", "hairFade", "facialHair", "castingBrand", "castingVibe",
  "features", "userPrompt",
  "hairStyleOverride", "hairColorOverride", "eyeColorOverride",
  "facialHairOverride", "skinTextureOverride", "castingBrandOverride",
]);
const modelEditChangesSchema = z
  .record(z.string(), z.unknown())
  .superRefine((changes, ctx) => {
    for (const key of Object.keys(changes)) {
      if (!MODEL_EDIT_CHANGE_KEYS.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown field: ${key}`,
        });
      }
    }
  });

/**
 * Batch C final correction 3: the Canvas creation `attributes` wire boundary
 * is a TYPED closed schema, not `z.unknown()` — arrays and nested objects
 * can no longer smuggle forbidden text or malformed preference containers
 * past the string-channel scans (e.g. `jawline: ["sharp", "red dress"]`).
 * The only legitimate nested shapes (`castingVibe`, `ethnicityBlend`) are
 * validated exactly; unknown keys reject; everything else is a plain string.
 */
const creationVibeSchema = z.object({
  editorial: z.number().finite(),
  commercial: z.number().finite(),
  runway: z.number().finite(),
}).strict();
const creationBlendSchema = z.array(
  z.object({ name: z.string().max(64), pct: z.number().finite() }).strict(),
).max(4);
const CREATION_STRING_KEYS = [
  "gender", "ethnicity", "bodyType",
  "faceShape", "jawline", "cheekbones", "cheeks", "eyeShape", "noseShape",
  "lipShape", "eyebrowStyle", "skinTone", "skinTexture", "skinFinish",
  "eyeColor", "hairStyle", "hairColor", "hairLength", "hairTexture",
  "hairFringe", "hairParting", "hairVolume", "hairFlyaways", "hairHairline",
  "hairTuck", "hairFade", "facialHair", "castingBrand", "features", "userPrompt",
  "hairStyleOverride", "hairColorOverride", "eyeColorOverride",
  "facialHairOverride", "skinTextureOverride", "castingBrandOverride",
] as const;
const creationAttributesSchema = z
  .object({
    age: z.union([z.string().max(16), z.number().finite()]).optional(),
    castingVibe: creationVibeSchema.optional(),
    ethnicityBlend: creationBlendSchema.optional(),
    ...Object.fromEntries(CREATION_STRING_KEYS.map((k) => [k, z.string().max(4000).optional()])),
  })
  .strict();
// Provenance/status are typed shared/boardTypes shapes; structural validation
// happens at the type level, passthrough at the wire level (same stance as
// boards.updateItem's metadata record).
const provenanceSchema = z.record(z.string(), z.unknown()).nullable();
const statusSchema = z.record(z.string(), z.unknown()).nullable();

export const boardOpsRouter = router({
  /** Full serializable board state (Decision 5.5). */
  getSnapshot: protectedProcedure
    .input(z.object({ boardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      return getSnapshot(input.boardId);
    }),

  createNode: router({
    plan: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        kind: kindSchema,
        provenance: provenanceSchema,
        position: positionSchema,
      }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        return boardOps.planCreateNode({ ...input, provenance: input.provenance as Provenance | null });
      }),
    execute: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        kind: kindSchema,
        provenance: provenanceSchema,
        position: positionSchema,
        size: z.object({ width: z.number().int().min(50).max(2000), height: z.number().int().min(50).max(2000) }).optional(),
        label: z.string().max(256).optional(),
        imageUrl: z.string().max(2048).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        return boardOps.executeCreateNode({ ...input, provenance: input.provenance as Provenance | null });
      }),
  }),

  updateNodeMetadata: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemId: z.number().int().positive(),
      metadata: z.record(z.string(), z.unknown()),
      label: z.string().max(256).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await boardOps.requireItemInBoard(input.itemId, input.boardId);
      return boardOps.executeUpdateNodeMetadata(input);
    }),

  markNodeStatus: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemId: z.number().int().positive(),
      status: statusSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await boardOps.requireItemInBoard(input.itemId, input.boardId);
      return boardOps.executeMarkNodeStatus({ itemId: input.itemId, status: input.status as NodeStatus | null });
    }),

  setNodePinned: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemId: z.number().int().positive(),
      pinned: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await boardOps.requireItemInBoard(input.itemId, input.boardId);
      return boardOps.executeSetNodePinned(input);
    }),

  moveNodes: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      moves: z.array(z.object({
        itemId: z.number().int().positive(),
        x: z.number(),
        y: z.number(),
        width: z.number().int().min(50).max(2000).optional(),
        height: z.number().int().min(50).max(2000).optional(),
        zIndex: z.number().int().min(0).max(9999).optional(),
      })).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      for (const move of input.moves) {
        await boardOps.requireItemInBoard(move.itemId, input.boardId);
      }
      return boardOps.executeMoveNodes(input);
    }),

  deleteNode: router({
    plan: protectedProcedure
      .input(z.object({ boardId: z.number().int().positive(), itemId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.planDeleteNode(input);
      }),
    execute: protectedProcedure
      .input(z.object({ boardId: z.number().int().positive(), itemId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.executeDeleteNode(input);
      }),
  }),

  /** R4 multi-select delete: the selection's cascade units, one soft-deleted unit. */
  deleteNodes: router({
    plan: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemIds: z.array(z.number().int().positive()).min(1).max(100),
      }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        for (const id of input.itemIds) await boardOps.requireItemInBoard(id, input.boardId);
        return boardOps.planDeleteNodes(input);
      }),
    execute: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemIds: z.array(z.number().int().positive()).min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        for (const id of input.itemIds) await boardOps.requireItemInBoard(id, input.boardId);
        return boardOps.executeDeleteNodes(input);
      }),
  }),

  undoDelete: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemIds: z.array(z.number().int().positive()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      return boardOps.executeUndoDelete(input);
    }),

  addEdge: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      sourceItemId: z.number().int().positive(),
      targetItemId: z.number().int().positive(),
      relation: relationSchema,
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await boardOps.requireItemInBoard(input.sourceItemId, input.boardId);
      await boardOps.requireItemInBoard(input.targetItemId, input.boardId);
      return boardOps.executeAddEdge(input);
    }),

  removeEdge: protectedProcedure
    .input(z.object({ boardId: z.number().int().positive(), edgeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      return boardOps.executeRemoveEdge(input);
    }),

  /** D-28 picker data: models with canonical headshots only. */
  listCastableModels: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return boardOps.listCastableModels(ctx.user.id, input?.limit ?? 30);
    }),

  /** D-28: fill an empty cast node in place from the Models library. */
  fillFromLibrary: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemId: z.number().int().positive(),
      modelId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await boardOps.requireItemInBoard(input.itemId, input.boardId);
      return boardOps.executeFillFromLibrary({
        userId: ctx.user.id,
        itemId: input.itemId,
        modelId: input.modelId,
      });
    }),

  /** R3 (D-11/D-41): identity edits from the casting environment land here. */
  applyModelEdit: router({
    plan: protectedProcedure
      .input(z.object({ boardId: z.number().int().positive(), itemId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.planApplyModelEdit({ itemId: input.itemId });
      }),
    execute: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        decision: z.enum(["update", "fork"]),
        changes: modelEditChangesSchema,
        intent: z.enum(["edit", "rerun"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.executeApplyModelEdit({
          userId: ctx.user.id,
          itemId: input.itemId,
          decision: input.decision,
          changes: input.changes,
          intent: input.intent,
        });
      }),
  }),

  /** R4 (foundations §4): N sibling candidates from one identity, variant_of edges. */
  runVariations: router({
    plan: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        count: z.number().int().min(1).max(boardOps.MAX_VARIATIONS),
      }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.planRunVariations(input);
      }),
    execute: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        count: z.number().int().min(1).max(boardOps.MAX_VARIATIONS),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.executeRunVariations({
          userId: ctx.user.id,
          itemId: input.itemId,
          count: input.count,
        });
      }),
  }),

  /** R5 (D-29/D-39): pop a comp-card tile out as a board placement referencing
   *  the model asset, connected by the cascade-bearing generated_from_cast
   *  edge with { viewAngle } metadata. Free — placements cost nothing. */
  popOutView: router({
    plan: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        angle: z.enum(CANONICAL_VIEW_ANGLES),
      }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.planPopOutView({ itemId: input.itemId, angle: input.angle });
      }),
    execute: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        angle: z.enum(CANONICAL_VIEW_ANGLES),
        position: positionSchema.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.executePopOutView({
          userId: ctx.user.id,
          boardId: input.boardId,
          itemId: input.itemId,
          angle: input.angle,
          position: input.position,
        });
      }),
  }),

  /** R5: dematerialize a popped view — outgoing edges re-anchor to the root
   *  (viewAngle preserved in metadata, D-30); the placement soft-deletes.
   *  Not Cmd+Z-undoable in pass 1; re-pop-out is the free recovery. */
  collapseView: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await boardOps.requireItemInBoard(input.itemId, input.boardId);
      return boardOps.executeCollapseView({
        userId: ctx.user.id,
        boardId: input.boardId,
        itemId: input.itemId,
      });
    }),

  /** Board edges — light read for client cascade knowledge (R4) and edge
   *  rendering (R5). Invalidate alongside getItems when ops add edges. */
  listEdges: protectedProcedure
    .input(z.object({ boardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      const edges = await getBoardEdges(input.boardId);
      return edges.map((e) => ({
        id: e.id,
        source: e.sourceItemId,
        target: e.targetItemId,
        relation: e.relation,
        // Carried so set-duplication can re-create edges faithfully
        // (viewAngle intent on generated_from_cast — D-30; VC-R6b bug 2)
        metadata: (e.metadata ?? null) as Record<string, unknown> | null,
      }));
    }),

  runGeneration: router({
    plan: protectedProcedure
      .input(z.object({ boardId: z.number().int().positive(), itemId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.planRunGeneration();
      }),
    execute: protectedProcedure
      .input(z.object({
        boardId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        userPrompt: z.string().max(4000).optional(),
        attributes: creationAttributesSchema.optional(),
        modelName: z.string().max(128).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireBoardOwnership(input.boardId, ctx.user.id);
        await boardOps.requireItemInBoard(input.itemId, input.boardId);
        return boardOps.executeRunGeneration({
          userId: ctx.user.id,
          itemId: input.itemId,
          userPrompt: input.userPrompt,
          attributes: input.attributes,
          modelName: input.modelName,
        });
      }),
  }),
});
