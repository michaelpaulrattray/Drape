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
  getModelStatusesIn,
  addOwnedBoardItemVersion,
  revertOwnedBoardItemVersion,
  getBoardItemVersions,
  getVersionCount,
} from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
import { isModelAvailableStatus, isModelDraftStatus } from "../../shared/modelLifecycle";
import { captureSnapshotReadMode } from "../casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "../casting/effectiveCastRead";
import { projectEffectiveBoardModelInfo } from "../casting/modelReadProjections";
import { BOARD_NAME_MAX_LENGTH } from "../../shared/inputLimits";

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

/**
 * A board's storage KEY is never the client's to name (#2056).
 *
 * `boards.thumbnailKey` and `board_items.imageKey` are read by the account
 * erasure (`collectAccountOwnedStorageItemsIn`) as EXPLICIT keys — deletion
 * authority with no further proof of ownership. Until this guard the four
 * board writers took either column straight from the client as
 * `z.string().max(256)`, so a customer could type ANOTHER customer's key
 * (a cast's picture key is readable off its public URL) onto her own board,
 * delete her account, and put the other customer's picture in the deletion
 * manifest.
 *
 * Nothing legitimate sends one, read at the callers 2026-10-09: the client's
 * three `imageKey: null` lines in `BoardPage.tsx` are OPTIMISTIC cache rows,
 * never request fields; no `boards.addItem`/`addItems`/`updateItem`/`update`
 * call site in `client/src` sends either key; and no server path writes
 * `board_items.imageKey` at all (`boardOps` writes `imageUrl` only).
 *
 * So the field is accepted only as `null` or absent — kept in the schema
 * rather than removed so `updateItem`'s `.strict()` never refuses a bundle
 * that still names it (the removal contract) — and a string is a BAD_REQUEST.
 * The accepted `null` is then DROPPED rather than written
 * (`withoutClientStorageKeys`): these routes never write a key column, so a
 * key on a board row can only come from a server writer.
 */
const clientStorageKeySchema = z.null().optional();

function withoutClientStorageKeys<T extends object>(
  data: T,
): Omit<T, "imageKey" | "thumbnailKey"> {
  const { imageKey: _imageKey, thumbnailKey: _thumbnailKey, ...rest } =
    data as T & { imageKey?: unknown; thumbnailKey?: unknown };
  return rest;
}

/**
 * …and neither is a board ITEM's picture address (#2062, the URL half).
 *
 * Cast deletion read `board_items.imageUrl` on every item linked to the Cast
 * and turned any address on our own bucket into a deletion key, and these
 * three writers took that column straight from the client as `z.string()`.
 * So a customer could put ANOTHER customer's picture address (it is public)
 * on an item linked to her own Cast, delete the Cast, and put the other
 * customer's picture in the deletion manifest. The deletion now checks every
 * address against the Cast's own pictures (`server/casting/
 * finalCastDeletion.ts`) — that is the half that covers rows already written
 * and the roads this file does not own — and this is the input half.
 *
 * Nothing legitimate sends one, read at the callers 2026-10-09: the only
 * client callers are `BoardPage.tsx`'s `updateItem` (position, size, label,
 * metadata) and `addItem` (the note), neither naming `imageUrl` — the
 * `vars.imageUrl ?? null` in `addItem`'s `onMutate` builds the OPTIMISTIC
 * cache row and reads `null` either way; `addItems` has no client caller. A
 * picture reaches an item through the SERVER writers (`server/lib/
 * boardOps.ts`, `server/db/boards.ts`), which never pass through here.
 *
 * Same shape as the keys above: accepted only as `null` or absent, so a
 * bundle that still names it is never refused by `updateItem`'s `.strict()`,
 * and DROPPED rather than written.
 */
const clientImageUrlSchema = z.null().optional();

function withoutClientItemPicture<T extends object>(
  data: T,
): Omit<T, "imageKey" | "thumbnailKey" | "imageUrl"> {
  const { imageUrl: _imageUrl, ...rest } =
    withoutClientStorageKeys(data) as Omit<T, "imageKey" | "thumbnailKey"> & { imageUrl?: unknown };
  return rest as Omit<T, "imageKey" | "thumbnailKey" | "imageUrl">;
}

// ── Router ───────────────────────────────────────────────────────────────

export const boardsRouter = router({
  // ── Board CRUD ───────────────────────────────────────────────────────

  /** Create a new board */
  create: protectedProcedure
    .input(z.object({
      name: z.string().max(BOARD_NAME_MAX_LENGTH).optional(),
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
      name: z.string().max(BOARD_NAME_MAX_LENGTH).optional(),
      description: z.string().max(1000).optional(),
      status: z.enum(["active", "archived"]).optional(),
      thumbnailUrl: z.string().url().nullable().optional(),
      thumbnailKey: clientStorageKeySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      const { boardId, ...data } = input;
      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(withoutClientStorageKeys(data)).filter(([_, v]) => v !== undefined)
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
      await deleteBoard({ userId: ctx.user.id, boardId: input.boardId });
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
      imageUrl: clientImageUrlSchema,
      imageKey: clientStorageKeySchema,
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
      const itemId = await addBoardItem({ ...withoutClientItemPicture(input), kind });
      return { id: itemId };
    }),

  /** Add multiple items to a board at once */
  addItems: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      items: z.array(z.object({
        type: boardItemTypeSchema,
        label: z.string().max(256).optional(),
        imageUrl: clientImageUrlSchema,
        imageKey: clientStorageKeySchema,
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
        ...withoutClientItemPicture(item),
        boardId: input.boardId,
      }));
      const ids = await addBoardItems(itemsWithBoard);
      return { ids };
    }),

  /** Get all items for a board. Model-linked placements carry live server
   *  lifecycle truth. Archived or hard-deleted sources degrade through the
   *  existing `sourceArchived` unavailable state; `sourceDraft` keeps every
   *  duplicate placement in sync after one placement mints the model. The
   *  unavailable flag renders D-12's state while the stored snapshot
   *  (label/imageUrl/metadata) stays as historical evidence, but the
   *  placement must not render as if its source still exists. */
  getItems: protectedProcedure
    .input(z.object({ boardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      const items = await getBoardItems(input.boardId);
      const sourceIds = Array.from(
        new Set(items.map((i) => i.sourceModelId).filter((id): id is number => !!id)),
      );
      const statuses = await getModelStatusesIn(sourceIds, ctx.user.id);
      return items.map((i) => {
        const source = i.sourceModelId ? statuses.get(i.sourceModelId) : undefined;
        return {
          ...i,
          sourceArchived: !!i.sourceModelId && !isModelAvailableStatus(source?.status),
          sourceDraft: !!i.sourceModelId && isModelDraftStatus(source?.status),
          sourceName: source?.name ?? null,
        };
      });
    }),

  /** Update a single item (label, position, metadata) */
  updateItem: protectedProcedure
    .input(z.object({
      itemId: z.number().int().positive(),
      label: z.string().max(256).optional(),
      imageUrl: clientImageUrlSchema,
      imageKey: clientStorageKeySchema,
      positionX: z.number().int().optional(),
      positionY: z.number().int().optional(),
      width: z.number().int().min(50).max(2000).optional(),
      height: z.number().int().min(50).max(2000).optional(),
      zIndex: z.number().int().min(0).max(9999).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const { itemId, ...data } = input;
      const cleanData = Object.fromEntries(
        Object.entries(withoutClientItemPicture(data)).filter(([_, v]) => v !== undefined)
      );
      await updateBoardItem({
        userId: ctx.user.id,
        itemId,
        data: cleanData,
      });
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
      }).strict()).min(1).max(100),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await batchUpdateBoardItemPositions({
        userId: ctx.user.id,
        boardId: input.boardId,
        updates: input.updates,
      });
      return { success: true };
    }),

  /** Delete a single item from a board */
  deleteItem: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      await deleteBoardItem({
        userId: ctx.user.id,
        itemId: input.itemId,
      });
      return { success: true };
    }),

  /** Delete multiple items from a board */
  deleteItems: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive(),
      itemIds: z.array(z.number().int().positive()).min(1).max(100),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      await requireBoardOwnership(input.boardId, ctx.user.id);
      await deleteBoardItems({
        userId: ctx.user.id,
        boardId: input.boardId,
        itemIds: input.itemIds,
      });
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
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const created = await addOwnedBoardItemVersion({
        userId: ctx.user.id,
        itemId: input.itemId,
        imageUrl: input.imageUrl,
        prompt: input.prompt ?? null,
        tool: input.tool,
      });

      log.info({ userId: ctx.user.id, itemId: input.itemId, version: created.version }, "Item version saved");
      return created;
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
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const imageUrl = await revertOwnedBoardItemVersion({
        userId: ctx.user.id,
        itemId: input.itemId,
        versionId: input.versionId,
      });
      log.info({ userId: ctx.user.id, itemId: input.itemId, versionId: input.versionId }, "Item reverted to version");
      return { success: true, imageUrl };
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
    .input(z.object({ itemId: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
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
          sourceArchived: false,
          sourceDraft: false,
        };
      }

      const sourceModel = await getModelById(item.sourceModelId);
      // Archived and hard-deleted sources are unavailable. The item's stored
      // snapshot is preserved, but no model document or ledger is exposed.
      // `sourceArchived` lets the client say "Source unavailable" explicitly
      // instead of conflating this with an ordinary unlinked item.
      const sourceArchived = !isModelAvailableStatus(sourceModel?.status);
      const sourceDraft = isModelDraftStatus(sourceModel?.status);
      const model = sourceModel && !sourceArchived ? sourceModel : null;
      if (model && readMode === "snapshot") {
        const state = await resolveEffectiveCastStateForRead({
          userId: ctx.user.id,
          modelId: item.sourceModelId,
        });
        const projected = projectEffectiveBoardModelInfo(state);
        return {
          item: {
            id: item.id,
            type: item.type,
            label: item.label,
            imageUrl: item.imageUrl,
            metadata: item.metadata,
            createdAt: item.createdAt,
          },
          model: projected.model,
          sourceArchived: false,
          sourceDraft: isModelDraftStatus(state.model.status),
          assetCount: projected.assetCount,
          latestAssetId: projected.latestAssetId,
        };
      }
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
        sourceArchived,
        sourceDraft,
        assetCount: assets.length,
        latestAssetId: assets.length > 0 ? assets[0].id : null,
      };
    }),
});
