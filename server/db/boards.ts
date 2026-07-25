/**
 * Board DB Helpers — CRUD operations for boards and board items.
 */
import { eq, and, desc, asc, inArray, sql, isNull, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import {
  boards,
  boardItems,
  boardItemVersions,
  boardEdges,
  type BoardItem,
  type InsertBoard,
  type InsertBoardItem,
  type InsertBoardItemVersion,
  type InsertBoardEdge,
} from "../../drizzle/schema";
import { CAST_PROVENANCE_TYPES, parseJsonValue, readCastProvenance } from "../casting/deletionAudit";
import { assertOwnedAvailableModelIn } from "./modelReferenceFence";

// ── Boards ────────────────────────────────────────────────────────────────

export async function createBoard(data: InsertBoard) {
  const db = (await getDb())!;
  const [result] = await db.insert(boards).values(data).$returningId();
  return result.id;
}

export async function getBoardById(boardId: number) {
  const db = (await getDb())!;
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  return board || null;
}

export async function getUserBoards(userId: number, status: "active" | "archived" = "active") {
  const db = (await getDb())!;
  return db
    .select()
    .from(boards)
    .where(and(eq(boards.userId, userId), eq(boards.status, status)))
    .orderBy(desc(boards.updatedAt));
}

/**
 * Model ids with an ALIVE placement on any of the user's active boards —
 * the Recent Work provenance rule (Group 6j item 4): a canvas-born cast is
 * represented by its BOARD in the feed (the board IS the recent work);
 * only standalone casts appear individually.
 */
export async function getPlacedModelIds(userId: number): Promise<Set<number>> {
  const db = (await getDb())!;
  const rows = await db
    .selectDistinct({ modelId: boardItems.sourceModelId })
    .from(boardItems)
    .innerJoin(boards, eq(boardItems.boardId, boards.id))
    .where(
      and(
        eq(boards.userId, userId),
        eq(boards.status, "active"),
        isNull(boardItems.deletedAt),
        sql`${boardItems.sourceModelId} IS NOT NULL`,
      ),
    );
  return new Set(rows.map((r) => r.modelId!).filter((id) => id != null));
}

export async function updateBoard(
  boardId: number,
  data: Partial<Pick<InsertBoard, "name" | "description" | "thumbnailUrl" | "thumbnailKey" | "status" | "viewportX" | "viewportY" | "viewportZoom">>
) {
  const db = (await getDb())!;
  await db.update(boards).set(data).where(eq(boards.id, boardId));
}

export async function archiveBoard(boardId: number) {
  return updateBoard(boardId, { status: "archived" });
}

export async function deleteBoard(boardId: number) {
  const db = (await getDb())!;
  // Delete all items first (cascade)
  await db.delete(boardItems).where(eq(boardItems.boardId, boardId));
  // Then delete the board
  await db.delete(boards).where(eq(boards.id, boardId));
}

export async function getUserBoardCount(userId: number) {
  const db = (await getDb())!;
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(boards)
    .where(and(eq(boards.userId, userId), eq(boards.status, "active")));
  return result?.count ?? 0;
}

// ── Board Items ───────────────────────────────────────────────────────────

export async function addBoardItem(data: InsertBoardItem) {
  return withTransaction(async (tx) => {
    await fenceBoardModelReferencesIn(tx, data.boardId, data);
    const [result] = await tx.insert(boardItems).values(data).$returningId();
    return result.id;
  });
}

export async function addBoardItems(items: InsertBoardItem[]) {
  if (items.length === 0) return [];
  return withTransaction(async (tx) => {
    const boardIds = Array.from(new Set(items.map((item) => item.boardId))).sort((a, b) => a - b);
    for (const boardId of boardIds) {
      const modelIds = Array.from(new Set(
        items.filter((item) => item.boardId === boardId).flatMap(referencedModelIds),
      )).sort((a, b) => a - b);
      if (modelIds.length === 0) continue;
      const userId = await boardOwnerIn(tx, boardId);
      for (const modelId of modelIds) await assertOwnedAvailableModelIn(tx, { modelId, userId });
    }
    const results = await tx.insert(boardItems).values(items).$returningId();
    return results.map((r) => r.id);
  });
}

export async function getBoardItems(boardId: number) {
  const db = (await getDb())!;
  // Soft-deleted rows are invisible everywhere (foundations Decision 7);
  // undoDelete clears deletedAt to restore.
  return db
    .select()
    .from(boardItems)
    .where(and(eq(boardItems.boardId, boardId), isNull(boardItems.deletedAt)))
    .orderBy(asc(boardItems.createdAt));
}

// ── Soft delete (foundations Decision 7 — delete is undoable) ─────────────

export async function softDeleteBoardItems(input: OwnedBoardItemMutation) {
  if (input.itemIds.length === 0) return;
  await withTransaction(async (tx) => {
    const rows = await lockOwnedBoardItemsIn(tx, input);
    const aliveIds = rows
      .filter((row) => row.deletedAt === null)
      .map((row) => row.id);
    if (aliveIds.length === 0) return;

    const deleted = await tx
      .update(boardItems)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(boardItems.boardId, input.boardId),
          inArray(boardItems.id, aliveIds),
          isNull(boardItems.deletedAt),
          ownedBoardExists(input.userId, input.boardId),
        ),
      );
    if (affectedRows(deleted) !== aliveIds.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Board item not found",
      });
    }
  });
}

type OwnedBoardItemMutation = {
  userId: number;
  boardId: number;
  itemIds: number[];
};

type BoardItemPositionUpdate = {
  id: number;
  positionX: number;
  positionY: number;
  width?: number;
  height?: number;
  zIndex?: number;
};

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  }
  return (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

function uniqueItemIds(itemIds: number[]): number[] {
  const unique = Array.from(new Set(itemIds));
  if (unique.length !== itemIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Duplicate board item ids are not allowed",
    });
  }
  return unique.sort((a, b) => a - b);
}

function ownedBoardExists(userId: number, boardId: number) {
  return sql<boolean>`exists (
    select 1
    from ${boards}
    where ${boards.id} = ${boardId}
      and ${boards.userId} = ${userId}
  )`;
}

async function lockOwnedBoardItemsIn(
  tx: TransactionHandle,
  input: OwnedBoardItemMutation,
) {
  const itemIds = uniqueItemIds(input.itemIds);
  if (itemIds.length === 0) return [];

  const [board] = await tx
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.id, input.boardId), eq(boards.userId, input.userId)))
    .for("update");
  if (!board) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
  }

  const rows = await tx
    .select({
      id: boardItems.id,
      deletedAt: boardItems.deletedAt,
      positionX: boardItems.positionX,
      positionY: boardItems.positionY,
      width: boardItems.width,
      height: boardItems.height,
      zIndex: boardItems.zIndex,
    })
    .from(boardItems)
    .where(
      and(
        eq(boardItems.boardId, input.boardId),
        inArray(boardItems.id, itemIds),
        ownedBoardExists(input.userId, input.boardId),
      ),
    )
    .orderBy(asc(boardItems.id))
    .for("update");

  if (rows.length !== itemIds.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Board item not found",
    });
  }
  return rows;
}

function boardItemWriteScope(input: {
  userId: number;
  boardId: number;
  itemId: number;
}) {
  return and(
    eq(boardItems.id, input.itemId),
    eq(boardItems.boardId, input.boardId),
    ownedBoardExists(input.userId, input.boardId),
  );
}

export async function undoDeleteBoardItems(input: OwnedBoardItemMutation) {
  if (input.itemIds.length === 0) return 0;
  return withTransaction(async (tx) => {
    const rows = await lockOwnedBoardItemsIn(tx, input);
    const restoreIds = rows
      .filter((row) => row.deletedAt !== null)
      .map((row) => row.id);
    if (restoreIds.length === 0) return 0;

    const restored = await tx
      .update(boardItems)
      .set({ deletedAt: null })
      .where(
        and(
          eq(boardItems.boardId, input.boardId),
          inArray(boardItems.id, restoreIds),
          isNotNull(boardItems.deletedAt),
          ownedBoardExists(input.userId, input.boardId),
        ),
      );
    if (affectedRows(restored) !== restoreIds.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Board item not found",
      });
    }
    return restoreIds.length;
  });
}

export async function getBoardItemById(itemId: number) {
  const db = (await getDb())!;
  const [item] = await db
    .select()
    .from(boardItems)
    .where(eq(boardItems.id, itemId))
    .limit(1);
  return item || null;
}

export async function getOwnedBoardItemById(input: {
  userId: number;
  itemId: number;
}) {
  const db = (await getDb())!;
  const [item] = await db
    .select()
    .from(boardItems)
    .where(
      and(
        eq(boardItems.id, input.itemId),
        sql<boolean>`exists (
          select 1
          from ${boards}
          where ${boards.id} = ${boardItems.boardId}
            and ${boards.userId} = ${input.userId}
        )`,
      ),
    )
    .limit(1);
  return item || null;
}

export async function updateBoardItem(
  itemId: number,
  data: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "positionX" | "positionY" | "width" | "height" | "zIndex" | "metadata" | "sourceModelId">>
) {
  await withTransaction(async (tx) => {
    const [item] = await tx
      .select({ boardId: boardItems.boardId, sourceModelId: boardItems.sourceModelId, metadata: boardItems.metadata })
      .from(boardItems)
      .where(eq(boardItems.id, itemId))
      .limit(1);
    if (!item) throw new Error("Board item not found");
    if (data.sourceModelId !== undefined || data.metadata !== undefined) {
      await fenceBoardModelReferencesIn(tx, item.boardId, {
        sourceModelId: data.sourceModelId !== undefined ? data.sourceModelId : item.sourceModelId,
        metadata: data.metadata !== undefined ? data.metadata : item.metadata,
      });
    }
    await tx.update(boardItems).set(data).where(eq(boardItems.id, itemId));
  });
}

export async function batchUpdateBoardItemPositions(
  input: {
    userId: number;
    boardId: number;
    updates: BoardItemPositionUpdate[];
  },
) {
  if (input.updates.length === 0) return;
  await withTransaction(async (tx) => {
    const rows = await lockOwnedBoardItemsIn(tx, {
      userId: input.userId,
      boardId: input.boardId,
      itemIds: input.updates.map((update) => update.id),
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    // The full batch is validated before the first write. A mixed-board or
    // mixed-owner request therefore writes nothing.
    for (const update of input.updates) {
      const current = rowsById.get(update.id)!;
      const { id, ...data } = update;
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined),
      ) as Omit<BoardItemPositionUpdate, "id">;
      const changed = Object.entries(cleanData).some(
        ([key, value]) => current[key as keyof typeof current] !== value,
      );
      if (!changed) continue;

      const updated = await tx
        .update(boardItems)
        .set(cleanData)
        .where(boardItemWriteScope({
          userId: input.userId,
          boardId: input.boardId,
          itemId: id,
        }));
      if (affectedRows(updated) !== 1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board item not found",
        });
      }
    }
  });
}

export async function deleteBoardItem(itemId: number) {
  const db = (await getDb())!;
  await db.delete(boardItems).where(eq(boardItems.id, itemId));
}

export async function deleteBoardItems(input: OwnedBoardItemMutation) {
  if (input.itemIds.length === 0) return;
  await withTransaction(async (tx) => {
    const rows = await lockOwnedBoardItemsIn(tx, input);
    const deleted = await tx
      .delete(boardItems)
      .where(
        and(
          eq(boardItems.boardId, input.boardId),
          inArray(boardItems.id, rows.map((row) => row.id)),
          ownedBoardExists(input.userId, input.boardId),
        ),
      );
    if (affectedRows(deleted) !== rows.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Board item not found",
      });
    }
  });
}

// ── Board Item Versions ──────────────────────────────────────────────────

function referencedModelIds(data: Pick<InsertBoardItem, "sourceModelId" | "metadata">): number[] {
  const direct = data.sourceModelId ?? null;
  const parsed = parseJsonValue(data.metadata);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const raw = record.provenance && typeof record.provenance === "object" && !Array.isArray(record.provenance)
      ? record.provenance as Record<string, unknown>
      : record;
    if (CAST_PROVENANCE_TYPES.includes(raw.type as (typeof CAST_PROVENANCE_TYPES)[number]) && !readCastProvenance(parsed)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Canvas Cast provenance is invalid" });
    }
  }
  const provenance = readCastProvenance(data.metadata);
  if (direct && provenance && direct !== provenance.modelId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Canvas Cast provenance disagrees with its model link" });
  }
  return Array.from(new Set([direct, provenance?.modelId ?? null].filter((id): id is number => id !== null)));
}

async function boardOwnerIn(tx: TransactionHandle, boardId: number): Promise<number> {
  const [board] = await tx
    .select({ userId: boards.userId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) throw new Error("Board not found");
  return board.userId;
}

async function fenceBoardModelReferencesIn(
  tx: TransactionHandle,
  boardId: number,
  data: Pick<InsertBoardItem, "sourceModelId" | "metadata">,
): Promise<void> {
  const modelIds = referencedModelIds(data).sort((a, b) => a - b);
  if (modelIds.length === 0) return;
  const userId = await boardOwnerIn(tx, boardId);
  for (const modelId of modelIds) await assertOwnedAvailableModelIn(tx, { modelId, userId });
}

export async function addBoardItemVersion(data: InsertBoardItemVersion) {
  const db = (await getDb())!;
  const [result] = await db.insert(boardItemVersions).values(data).$returningId();
  return result.id;
}

// ── Atomic landing records (Batch C final correction 4) ───────────────────
//
// A landing's board writes are DOMAIN RECORDS, not best-effort logging: a
// node stamp without its version row (or a placed node without its lineage
// edge) is half-versioned board state that no log line recovers. Each
// grouped write commits together or not at all. No external image call ever
// runs inside these transactions — callers finish generation first.

export interface StampBoardItemWithVersionInput {
  userId: number;
  boardId: number;
  itemId: number;
  update: Partial<
    Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">
  >;
  version: Omit<InsertBoardItemVersion, "itemId">;
}

/** The stamp's writes on an EXISTING transaction — used by landings that must
 *  commit board state atomically with other domain writes (the identity
 *  commit, final correction 3). */
export async function stampBoardItemWithVersionIn(
  tx: TransactionHandle,
  input: StampBoardItemWithVersionInput,
): Promise<void> {
  const [item] = await tx
    .select({ boardId: boardItems.boardId, sourceModelId: boardItems.sourceModelId, metadata: boardItems.metadata })
    .from(boardItems)
    .where(boardItemWriteScope(input))
    .limit(1)
    .for("update");
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Board item not found" });
  if (input.update.sourceModelId !== undefined || input.update.metadata !== undefined) {
    await fenceBoardModelReferencesIn(tx, item.boardId, {
      sourceModelId: input.update.sourceModelId !== undefined ? input.update.sourceModelId : item.sourceModelId,
      metadata: input.update.metadata !== undefined ? input.update.metadata : item.metadata,
    });
  }
  const updated = await tx
    .update(boardItems)
    .set(input.update)
    .where(boardItemWriteScope(input));
  if (affectedRows(updated) !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board item not found" });
  }
  await tx.insert(boardItemVersions).values({
    ...input.version,
    itemId: input.itemId,
  });
}

/** Node restamp + its version row, atomically. */
export async function stampBoardItemWithVersion(input: StampBoardItemWithVersionInput): Promise<void> {
  await withTransaction(async (tx) => {
    await stampBoardItemWithVersionIn(tx, input);
  });
}

export type FillEmptyCastNodeResult = "filled" | "reconciled" | "not_found" | "not_empty";

/** Shared exactly-once fill primitive for the library picker and durable
 * operation landing. The row lock plus conditional write prevents either
 * path from overwriting a node another tab filled while it was waiting. */
export async function fillEmptyCastNodeWithVersionIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    boardId: number;
    itemId: number;
    /** Lock this model before the board item so deletion and landing share a
     * single lock order (model -> Canvas row) and cannot deadlock. */
    modelId: number;
    build: (item: BoardItem) => {
      update: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">>;
      version: Omit<InsertBoardItemVersion, "itemId" | "version">;
    };
    /** A foreground close/mint can arrive after the durable-operation bridge
     *  filled the same origin node. Reconcile only that exact landing; this is
     *  deliberately not a general "overwrite occupied node" escape hatch. */
    reconcileExact?: {
      sourceModelId: number;
      imageUrl: string;
      buildUpdate: (item: BoardItem) => Partial<
        Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">
      > | null;
    };
  },
): Promise<FillEmptyCastNodeResult> {
  await assertOwnedAvailableModelIn(tx, { modelId: input.modelId, userId: input.userId });
  const [item] = await tx
    .select()
    .from(boardItems)
    .where(and(
      eq(boardItems.id, input.itemId),
      eq(boardItems.boardId, input.boardId),
      ownedBoardExists(input.userId, input.boardId),
    ))
    .limit(1)
    .for("update");
  if (!item) return "not_found";
  const [existingVersion] = await tx
    .select({ id: boardItemVersions.id })
    .from(boardItemVersions)
    .where(eq(boardItemVersions.itemId, item.id))
    .limit(1);
  const isEmpty =
    item.deletedAt === null &&
    item.kind === "cast_config" &&
    item.imageUrl === null &&
    item.sourceModelId === null &&
    !existingVersion;
  if (!isEmpty) {
    const reconcile = input.reconcileExact;
    if (
      !reconcile ||
      item.deletedAt !== null ||
      item.kind !== "cast_config" ||
      item.sourceModelId !== reconcile.sourceModelId ||
      item.imageUrl !== reconcile.imageUrl
    ) return "not_empty";
    const [matchingVersion] = await tx
      .select({ id: boardItemVersions.id })
      .from(boardItemVersions)
      .where(and(
        eq(boardItemVersions.itemId, item.id),
        eq(boardItemVersions.imageUrl, reconcile.imageUrl),
      ))
      .limit(1);
    if (!matchingVersion) return "not_empty";
    const reconciliationUpdate = reconcile.buildUpdate(item);
    if (!reconciliationUpdate) return "not_empty";
    const reconciliationModelIds = referencedModelIds({
      sourceModelId: reconciliationUpdate.sourceModelId !== undefined
        ? reconciliationUpdate.sourceModelId
        : item.sourceModelId,
      metadata: reconciliationUpdate.metadata !== undefined ? reconciliationUpdate.metadata : item.metadata,
    });
    if (reconciliationModelIds.some((modelId) => modelId !== input.modelId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Canvas Cast landing changed its model identity" });
    }
    const result = await tx
      .update(boardItems)
      .set(reconciliationUpdate)
      .where(and(
        eq(boardItems.id, item.id),
        eq(boardItems.boardId, input.boardId),
        isNull(boardItems.deletedAt),
        eq(boardItems.sourceModelId, reconcile.sourceModelId),
        eq(boardItems.imageUrl, reconcile.imageUrl),
        ownedBoardExists(input.userId, input.boardId),
      ));
    const header = result as { affectedRows?: number } | [{ affectedRows?: number }];
    const changed = Array.isArray(header) ? header[0]?.affectedRows : header.affectedRows;
    if (changed !== 1) throw new Error("Exact Cast node reconciliation lost its state race");
    return "reconciled";
  }

  const built = input.build(item);
  const builtModelIds = referencedModelIds({
    sourceModelId: built.update.sourceModelId !== undefined ? built.update.sourceModelId : item.sourceModelId,
    metadata: built.update.metadata !== undefined ? built.update.metadata : item.metadata,
  });
  if (builtModelIds.some((modelId) => modelId !== input.modelId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Canvas Cast landing changed its model identity" });
  }
  const result = await tx
    .update(boardItems)
    .set(built.update)
    .where(and(
      eq(boardItems.id, item.id),
      eq(boardItems.boardId, input.boardId),
      isNull(boardItems.deletedAt),
      isNull(boardItems.imageUrl),
      isNull(boardItems.sourceModelId),
      ownedBoardExists(input.userId, input.boardId),
    ));
  const header = result as { affectedRows?: number } | [{ affectedRows?: number }];
  const changed = Array.isArray(header) ? header[0]?.affectedRows : header.affectedRows;
  if (changed !== 1) throw new Error("Empty Cast node fill lost its state race");
  await tx.insert(boardItemVersions).values({
    ...built.version,
    itemId: item.id,
    version: 1,
  });
  return "filled";
}

/** A single board-item update on an EXISTING transaction (same landing use). */
export async function updateBoardItemIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    boardId: number;
    itemId: number;
    data: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">>;
  },
): Promise<void> {
  const [item] = await tx
    .select({ boardId: boardItems.boardId, sourceModelId: boardItems.sourceModelId, metadata: boardItems.metadata })
    .from(boardItems)
    .where(boardItemWriteScope(input))
    .limit(1)
    .for("update");
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Board item not found" });
  if (input.data.sourceModelId !== undefined || input.data.metadata !== undefined) {
    await fenceBoardModelReferencesIn(tx, item.boardId, {
      sourceModelId: input.data.sourceModelId !== undefined ? input.data.sourceModelId : item.sourceModelId,
      metadata: input.data.metadata !== undefined ? input.data.metadata : item.metadata,
    });
  }
  const updated = await tx
    .update(boardItems)
    .set(input.data)
    .where(boardItemWriteScope(input));
  if (affectedRows(updated) !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board item not found" });
  }
}

/** A placed LINKED node — item + initial version + lineage edge — atomically.
 *  Returns the new item id. Throws with nothing written on any failure, so a
 *  caller can never observe an unlinked or unversioned placement. */
export async function placeLinkedBoardItem(input: {
  item: InsertBoardItem;
  /** The lineage edge; targetItemId is the freshly inserted item. */
  edge: Pick<InsertBoardEdge, "boardId" | "sourceItemId" | "relation">;
  /** Recorded as v1 when the item lands with an image. */
  initialVersion?: { imageUrl: string; prompt?: string | null };
}): Promise<number> {
  return withTransaction(async (tx) => {
    await fenceBoardModelReferencesIn(tx, input.item.boardId, input.item);
    const [row] = await tx.insert(boardItems).values(input.item).$returningId();
    if (!row?.id) throw new Error("Failed to create the board item");
    if (input.initialVersion) {
      await tx.insert(boardItemVersions).values({
        itemId: row.id,
        version: 1,
        imageUrl: input.initialVersion.imageUrl,
        prompt: input.initialVersion.prompt ?? null,
        tool: "initial",
      });
    }
    await tx.insert(boardEdges).values({
      boardId: input.edge.boardId,
      sourceItemId: input.edge.sourceItemId,
      targetItemId: row.id,
      relation: input.edge.relation,
    });
    return row.id;
  });
}

export async function getBoardItemVersions(itemId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(boardItemVersions)
    .where(eq(boardItemVersions.itemId, itemId))
    .orderBy(asc(boardItemVersions.version));
}

export async function getLatestVersionNumber(itemId: number): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${boardItemVersions.version}), 0)` })
    .from(boardItemVersions)
    .where(eq(boardItemVersions.itemId, itemId));
  return result?.maxVersion ?? 0;
}

export async function getVersionCount(itemId: number): Promise<number> {
  const db = (await getDb())!;
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(boardItemVersions)
    .where(eq(boardItemVersions.itemId, itemId));
  return result?.count ?? 0;
}

export async function deleteBoardItemVersions(itemId: number) {
  const db = (await getDb())!;
  await db.delete(boardItemVersions).where(eq(boardItemVersions.itemId, itemId));
}
