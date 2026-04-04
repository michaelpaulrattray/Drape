/**
 * Board DB Helpers — CRUD operations for boards and board items.
 */
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  boards,
  boardItems,
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
  return db
    .select()
    .from(boardItems)
    .where(eq(boardItems.boardId, boardId))
    .orderBy(asc(boardItems.createdAt));
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
  data: Partial<Pick<InsertBoardItem, "label" | "imageUrl" | "imageKey" | "positionX" | "positionY" | "width" | "height" | "zIndex" | "metadata">>
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
