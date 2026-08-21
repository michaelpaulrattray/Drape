/**
 * Board edge DB helpers — first-class DAG lineage (foundations Decision 2).
 */
import { eq, and, inArray, or } from "drizzle-orm";
import { getDb } from "./connection";
import { TRPCError } from "@trpc/server";
import {
  boards,
  boardEdges,
  type InsertBoardEdge,
  type BoardEdgeRelation,
} from "../../drizzle/schema";

export async function addBoardEdge(data: InsertBoardEdge) {
  const db = (await getDb())!;
  const [result] = await db.insert(boardEdges).values(data).$returningId();
  return result.id;
}

export async function getBoardEdges(boardId: number) {
  const db = (await getDb())!;
  return db.select().from(boardEdges).where(eq(boardEdges.boardId, boardId));
}

export async function getEdgesForItem(itemId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(boardEdges)
    .where(or(eq(boardEdges.sourceItemId, itemId), eq(boardEdges.targetItemId, itemId)));
}

/** e.g. all cast_view targets of a root: edgesFrom(rootId, "generated_from_cast") */
export async function getEdgesFrom(sourceItemId: number, relation?: BoardEdgeRelation) {
  const db = (await getDb())!;
  return db
    .select()
    .from(boardEdges)
    .where(
      relation
        ? and(eq(boardEdges.sourceItemId, sourceItemId), eq(boardEdges.relation, relation))
        : eq(boardEdges.sourceItemId, sourceItemId),
    );
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  }
  return (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

export async function removeBoardEdge(input: {
  userId: number;
  boardId: number;
  edgeId: number;
}) {
  const db = (await getDb())!;
  const removed = await db
    .delete(boardEdges)
    .where(
      and(
        eq(boardEdges.id, input.edgeId),
        eq(boardEdges.boardId, input.boardId),
        inArray(
          boardEdges.boardId,
          db
            .select({ id: boards.id })
            .from(boards)
            .where(and(eq(boards.id, input.boardId), eq(boards.userId, input.userId))),
        ),
      ),
    );
  if (affectedRows(removed) !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board edge not found" });
  }
}
