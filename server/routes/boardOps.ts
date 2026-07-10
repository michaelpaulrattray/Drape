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
import * as boardOps from "../lib/boardOps";
import { getSnapshot } from "../lib/boardState";
import { BOARD_ITEM_KINDS, BOARD_EDGE_RELATIONS } from "../../drizzle/schema";
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
        attributes: z.record(z.string(), z.unknown()).optional(),
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
