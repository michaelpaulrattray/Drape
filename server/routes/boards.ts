/**
 * Boards Router — CRUD for canvas boards and board items.
 *
 * All procedures are protected (require authenticated user).
 * Ownership checks ensure users can only access their own boards.
 */
import { router, protectedProcedure } from "../_core/trpc";
import {
  createBoard,
  getBoardById,
  getUserBoards,
  updateBoard,
  archiveBoard,
  deleteBoard,
  getUserBoardCount,
  addBoardItem,
  addBoardItems,
  getBoardItems,
  getBoardItemById,
  updateBoardItem,
  batchUpdateBoardItemPositions,
  deleteBoardItem,
  deleteBoardItems,
  getModelById,
  getModelAssets,
  addBoardItemVersion,
  getBoardItemVersions,
  getLatestVersionNumber,
  getVersionCount,
} from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("routes/boards");

const MAX_BOARDS_PER_USER = 50;

// ── Shared ownership check ───────────────────────────────────────────────

async function requireBoardOwnership(boardId: number, userId: number) {
  const board = await getBoardById(boardId);
  if (!board) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
  }
  if (board.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
  return board;
}

// ── Zod schemas ──────────────────────────────────────────────────────────

const boardItemPositionSchema = z.object({
  positionX: z.number().int(),
  positionY: z.number().int(),
  width: z.number().int().min(50).max(2000).optional(),
  height: z.number().int().min(50).max(2000).optional(),
  zIndex: z.number().int().min(0).max(9999).optional(),
});

const boardItemTypeSchema = z.enum([
  "model", "garment", "vto_result", "reference", "iteration", "note", "frame",
]);

// ── Router ───────────────────────────────────────────────────────────────

export const boardsRouter = router({
  // ── Board CRUD ───────────────────────────────────────────────────────

  /** Create a new board */
  create: protectedProcedure
    .input(z.object({
      name: z.string().max(128).optional(),
      description: z.string().max(1000).optional(),
      startedWith: z.enum(["casting", "wardrobe", "blank"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const count = await getUserBoardCount(ctx.user.id);
      if (count >= MAX_BOARDS_PER_USER) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `You can have at most ${MAX_BOARDS_PER_USER} active boards. Archive or delete some first.`,
        });
      }

      const boardId = await createBoard({
        userId: ctx.user.id,
        name: input.name ?? "Untitled Board",
        description: input.description,
        startedWith: input.startedWith,
      });

      log.info({ userId: ctx.user.id, boardId, startedWith: input.startedWith }, "Board created");
      return { id: boardId };
    }),

  /** List user's boards (active or archived) */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "archived"]).default("active"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "active";
      return getUserBoards(ctx.user.id, status);
    }),

  /** Get a single board by ID (with ownership check) */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return requireBoardOwnership(input.id, ctx.user.id);
    }),

  /** Update board metadata (name, description, viewport) */
  update: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      name: z.string().max(128).optional(),
      description: z.string().max(1000).optional(),
      status: z.enum(["active", "archived"]).optional(),
      thumbnailUrl: z.string().url().optional(),
      thumbnailKey: z.string().max(256).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      const { boardId, ...data } = input;
      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      if (Object.keys(cleanData).length > 0) {
        await updateBoard(boardId, cleanData);
      }
      return { success: true };
    }),

  /** Save canvas viewport state (for resume) */
  saveViewport: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      viewportX: z.number().int(),
      viewportY: z.number().int(),
      viewportZoom: z.number().int().min(10).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.id, ctx.user.id);
      await updateBoard(input.id, {
        viewportX: input.viewportX,
        viewportY: input.viewportY,
        viewportZoom: input.viewportZoom,
      });
      return { success: true };
    }),

  /** Archive a board (soft delete) */
  archive: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.id, ctx.user.id);
      await archiveBoard(input.id);
      log.info({ userId: ctx.user.id, boardId: input.id }, "Board archived");
      return { success: true };
    }),

  /** Permanently delete a board and all its items */
  delete: protectedProcedure
    .input(z.object({ boardId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await deleteBoard(input.boardId);
      log.info({ userId: ctx.user.id, boardId: input.boardId }, "Board deleted");
      return { success: true };
    }),

  // ── Board Items CRUD ─────────────────────────────────────────────────

  /** Add a single item to a board */
  addItem: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      type: boardItemTypeSchema,
      label: z.string().max(256).optional(),
      imageUrl: z.string().optional(),
      imageKey: z.string().max(256).optional(),
      positionX: z.number().int().default(0),
      positionY: z.number().int().default(0),
      width: z.number().int().min(50).max(2000).default(280),
      height: z.number().int().min(50).max(2000).default(280),
      zIndex: z.number().int().min(0).max(9999).default(0),
      parentItemId: z.number().int().positive().optional(),
      sourceModelId: z.number().int().positive().optional(),
      sourceGarmentId: z.number().int().positive().optional(),
      sourceSessionId: z.number().int().positive().optional(),
      sourceLookId: z.number().int().positive().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      // Stamp the canvas `kind` alongside the legacy type (foundations Decision 1)
      const kind = input.type === "note" ? "note" : input.type === "frame" ? "frame" : "image";
      const itemId = await addBoardItem({ ...input, kind });
      return { id: itemId };
    }),

  /** Add multiple items to a board at once */
  addItems: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      items: z.array(z.object({
        type: boardItemTypeSchema,
        label: z.string().max(256).optional(),
        imageUrl: z.string().optional(),
        imageKey: z.string().max(256).optional(),
        positionX: z.number().int().default(0),
        positionY: z.number().int().default(0),
        width: z.number().int().min(50).max(2000).default(280),
        height: z.number().int().min(50).max(2000).default(280),
        zIndex: z.number().int().min(0).max(9999).default(0),
        parentItemId: z.number().int().positive().optional(),
        sourceModelId: z.number().int().positive().optional(),
        sourceGarmentId: z.number().int().positive().optional(),
        sourceSessionId: z.number().int().positive().optional(),
        sourceLookId: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      const itemsWithBoard = input.items.map((item) => ({
        ...item,
        boardId: input.boardId,
      }));
      const ids = await addBoardItems(itemsWithBoard);
      return { ids };
    }),

  /** Get all items for a board */
  getItems: protectedProcedure
    .input(z.object({ boardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      return getBoardItems(input.boardId);
    }),

  /** Update a single item (label, position, metadata) */
  updateItem: protectedProcedure
    .input(z.object({
      itemId: z.number().int().positive(),
      label: z.string().max(256).optional(),
      imageUrl: z.string().optional(),
      imageKey: z.string().max(256).optional(),
      positionX: z.number().int().optional(),
      positionY: z.number().int().optional(),
      width: z.number().int().min(50).max(2000).optional(),
      height: z.number().int().min(50).max(2000).optional(),
      zIndex: z.number().int().min(0).max(9999).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      await requireBoardOwnership(item.boardId, ctx.user.id);

      const { itemId, ...data } = input;
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      if (Object.keys(cleanData).length > 0) {
        await updateBoardItem(itemId, cleanData);
      }
      return { success: true };
    }),

  /** Batch update item positions (for drag-and-drop) */
  batchUpdatePositions: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      updates: z.array(z.object({
        id: z.number().int().positive(),
        positionX: z.number().int(),
        positionY: z.number().int(),
        width: z.number().int().min(50).max(2000).optional(),
        height: z.number().int().min(50).max(2000).optional(),
        zIndex: z.number().int().min(0).max(9999).optional(),
      })).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await batchUpdateBoardItemPositions(input.updates);
      return { success: true };
    }),

  /** Delete a single item from a board */
  deleteItem: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      await requireBoardOwnership(item.boardId, ctx.user.id);
      await deleteBoardItem(input.itemId);
      return { success: true };
    }),

  /** Delete multiple items from a board */
  deleteItems: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemIds: z.array(z.number().int().positive()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await deleteBoardItems(input.itemIds);
      return { success: true };
    }),

  // ── Board Item Versions ────────────────────────────────────────────────

  /** Save a new version snapshot for a board item */
  addItemVersion: protectedProcedure
    .input(z.object({
      itemId: z.number().int().positive(),
      imageUrl: z.string(),
      prompt: z.string().max(2000).optional(),
      tool: z.enum(["chat", "surgical", "eraser", "initial"]).default("initial"),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      await requireBoardOwnership(item.boardId, ctx.user.id);

      const latestVersion = await getLatestVersionNumber(input.itemId);
      const versionId = await addBoardItemVersion({
        itemId: input.itemId,
        version: latestVersion + 1,
        imageUrl: input.imageUrl,
        prompt: input.prompt ?? null,
        tool: input.tool,
      });

      log.info({ userId: ctx.user.id, itemId: input.itemId, version: latestVersion + 1 }, "Item version saved");
      return { id: versionId, version: latestVersion + 1 };
    }),

  /** Get all versions for a board item */
  getItemVersions: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      await requireBoardOwnership(item.boardId, ctx.user.id);

      const versions = await getBoardItemVersions(input.itemId);
      return { versions, currentImageUrl: item.imageUrl };
    }),

  /** Revert a board item to a specific version */
  revertItemVersion: protectedProcedure
    .input(z.object({
      itemId: z.number().int().positive(),
      versionId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      await requireBoardOwnership(item.boardId, ctx.user.id);

      const versions = await getBoardItemVersions(input.itemId);
      const target = versions.find(v => v.id === input.versionId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });

      await updateBoardItem(input.itemId, { imageUrl: target.imageUrl });
      log.info({ userId: ctx.user.id, itemId: input.itemId, versionId: input.versionId }, "Item reverted to version");
      return { success: true, imageUrl: target.imageUrl };
    }),

  /** Get version count for a board item (used by VersionHistoryBadge) */
  getItemVersionCount: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      await requireBoardOwnership(item.boardId, ctx.user.id);
      const count = await getVersionCount(input.itemId);
      return { count };
    }),

  /** Get linked model info for a board item (specs, master prompt, assets) */
  getItemModelInfo: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const item = await getBoardItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });

      // Verify board ownership
      await requireBoardOwnership(item.boardId, ctx.user.id);

      if (!item.sourceModelId) {
        return {
          item: {
            id: item.id,
            type: item.type,
            label: item.label,
            imageUrl: item.imageUrl,
            metadata: item.metadata,
            createdAt: item.createdAt,
          },
          model: null,
        };
      }

      const model = await getModelById(item.sourceModelId);
      const assets = model ? await getModelAssets(item.sourceModelId) : [];

      return {
        item: {
          id: item.id,
          type: item.type,
          label: item.label,
          imageUrl: item.imageUrl,
          metadata: item.metadata,
          createdAt: item.createdAt,
        },
        model: model
          ? {
              id: model.id,
              name: model.name,
              agencyId: model.agencyId,
              masterPrompt: model.masterPrompt,
              technicalSchema: model.technicalSchema,
              preferences: model.preferences,
              status: model.status,
              createdAt: model.createdAt,
            }
          : null,
        assetCount: assets.length,
        latestAssetId: assets.length > 0 ? assets[0].id : null,
      };
    }),
});
