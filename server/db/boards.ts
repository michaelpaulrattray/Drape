/**
 * Board DB Helpers — CRUD operations for boards and board items.
 */
import { eq, and, desc, asc, inArray, sql, isNull } from "drizzle-orm";
import { getDb } from "./connection";
import {
  boards,
  boardItems,
  type BoardItem,
  type InsertBoard,
  type InsertBoardItem,
} from "../../drizzle/schema";

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
  const db = (await getDb())!;
  const [result] = await db.insert(boardItems).values(data).$returningId();
  return result.id;
}

export async function addBoardItems(items: InsertBoardItem[]) {
  if (items.length === 0) return [];
  const db = (await getDb())!;
  const results = await db.insert(boardItems).values(items).$returningId();
  return results.map((r) => r.id);
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

export async function softDeleteBoardItems(itemIds: number[]) {
  if (itemIds.length === 0) return;
  const db = (await getDb())!;
  await db
    .update(boardItems)
    .set({ deletedAt: new Date() })
    .where(inArray(boardItems.id, itemIds));
}

export async function undoDeleteBoardItems(itemIds: number[]) {
  if (itemIds.length === 0) return;
  const db = (await getDb())!;
  await db
    .update(boardItems)
    .set({ deletedAt: null })
    .where(inArray(boardItems.id, itemIds));
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

export async function updateBoardItem(
  itemId: number,
  data: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "positionX" | "positionY" | "width" | "height" | "zIndex" | "metadata" | "sourceModelId">>
) {
  const db = (await getDb())!;
  await db.update(boardItems).set(data).where(eq(boardItems.id, itemId));
}

export async function batchUpdateBoardItemPositions(
  updates: Array<{ id: number; positionX: number; positionY: number; width?: number; height?: number; zIndex?: number }>
) {
  const db = (await getDb())!;
  // Execute updates sequentially — batch size is small (canvas items)
  for (const update of updates) {
    const { id, ...data } = update;
    // Filter out undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    await db.update(boardItems).set(cleanData).where(eq(boardItems.id, id));
  }
}

export async function deleteBoardItem(itemId: number) {
  const db = (await getDb())!;
  await db.delete(boardItems).where(eq(boardItems.id, itemId));
}

export async function deleteBoardItems(itemIds: number[]) {
  if (itemIds.length === 0) return;
  const db = (await getDb())!;
  await db.delete(boardItems).where(inArray(boardItems.id, itemIds));
}

// ── Board Item Versions ──────────────────────────────────────────────────

import {
  boardItemVersions,
  type InsertBoardItemVersion,
} from "../../drizzle/schema";

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

import { withTransaction, type TransactionHandle } from "./connection";
import { boardEdges, type InsertBoardEdge } from "../../drizzle/schema";

export interface StampBoardItemWithVersionInput {
  itemId: number;
  update: Partial<
    Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">
  >;
  version: InsertBoardItemVersion;
}

/** The stamp's writes on an EXISTING transaction — used by landings that must
 *  commit board state atomically with other domain writes (the identity
 *  commit, final correction 3). */
export async function stampBoardItemWithVersionIn(
  tx: TransactionHandle,
  input: StampBoardItemWithVersionInput,
): Promise<void> {
  await tx.update(boardItems).set(input.update).where(eq(boardItems.id, input.itemId));
  await tx.insert(boardItemVersions).values(input.version);
}

/** Node restamp + its version row, atomically. */
export async function stampBoardItemWithVersion(input: StampBoardItemWithVersionInput): Promise<void> {
  await withTransaction(async (tx) => {
    await stampBoardItemWithVersionIn(tx, input);
  });
}

export type FillEmptyCastNodeResult = "filled" | "not_found" | "not_empty";

/** Shared exactly-once fill primitive for the library picker and durable
 * operation landing. The row lock plus conditional write prevents either
 * path from overwriting a node another tab filled while it was waiting. */
export async function fillEmptyCastNodeWithVersionIn(
  tx: TransactionHandle,
  input: {
    boardId: number;
    itemId: number;
    build: (item: BoardItem) => {
      update: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">>;
      version: Omit<InsertBoardItemVersion, "itemId" | "version">;
    };
  },
): Promise<FillEmptyCastNodeResult> {
  const [item] = await tx
    .select()
    .from(boardItems)
    .where(and(eq(boardItems.id, input.itemId), eq(boardItems.boardId, input.boardId)))
    .limit(1)
    .for("update");
  if (!item) return "not_found";
  const [existingVersion] = await tx
    .select({ id: boardItemVersions.id })
    .from(boardItemVersions)
    .where(eq(boardItemVersions.itemId, item.id))
    .limit(1);
  if (
    item.deletedAt !== null ||
    item.kind !== "cast_config" ||
    item.imageUrl !== null ||
    item.sourceModelId !== null ||
    existingVersion
  ) return "not_empty";

  const built = input.build(item);
  const result = await tx
    .update(boardItems)
    .set(built.update)
    .where(and(
      eq(boardItems.id, item.id),
      eq(boardItems.boardId, input.boardId),
      isNull(boardItems.deletedAt),
      isNull(boardItems.imageUrl),
      isNull(boardItems.sourceModelId),
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
  itemId: number,
  data: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "metadata" | "sourceModelId">>,
): Promise<void> {
  await tx.update(boardItems).set(data).where(eq(boardItems.id, itemId));
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
