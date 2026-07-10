/**
 * Board edge DB helpers — first-class DAG lineage (foundations Decision 2).
 */
import { eq, and, inArray, or } from "drizzle-orm";
import { getDb } from "./connection";
import { boardEdges, type InsertBoardEdge, type BoardEdgeRelation } from "../../drizzle/schema";

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

export async function removeBoardEdge(edgeId: number) {
  const db = (await getDb())!;
  await db.delete(boardEdges).where(eq(boardEdges.id, edgeId));
}

export async function removeEdgesForItems(itemIds: number[]) {
  if (itemIds.length === 0) return;
  const db = (await getDb())!;
  await db
    .delete(boardEdges)
    .where(or(inArray(boardEdges.sourceItemId, itemIds), inArray(boardEdges.targetItemId, itemIds)));
}
