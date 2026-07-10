/**
 * boardState — the JSON-serializable read layer (foundations Decision 5.5).
 * One function returns one object; agents, undo, export, and future
 * collaboration all consume this.
 */
import { getBoardById, getBoardItems, getVersionCount } from "../db";
import { getBoardEdges } from "../db/boardEdges";
import type { Provenance, NodeStatus, BoardItemCanvasMetadata } from "../../shared/boardTypes";
import type { BoardItemKind, BoardEdgeRelation } from "../../drizzle/schema";

export interface BoardStateSnapshot {
  boardId: number;
  viewport: { x: number; y: number; zoom: number };
  nodes: Array<{
    id: number;
    kind: BoardItemKind;
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
    label: string | null;
    imageUrl: string | null;
    provenance: Provenance | null;
    status: NodeStatus | null;
    pinned: boolean;
    metadata: Record<string, unknown>;
    versionCount: number;
  }>;
  edges: Array<{
    id: number;
    source: number;
    target: number;
    relation: BoardEdgeRelation;
    metadata: Record<string, unknown> | null;
  }>;
}

export async function getSnapshot(boardId: number): Promise<BoardStateSnapshot | null> {
  const board = await getBoardById(boardId);
  if (!board) return null;

  const [items, edges] = await Promise.all([getBoardItems(boardId), getBoardEdges(boardId)]);
  const versionCounts = await Promise.all(items.map((i) => getVersionCount(i.id)));

  return {
    boardId,
    viewport: {
      x: board.viewportX ?? 0,
      y: board.viewportY ?? 0,
      zoom: (board.viewportZoom ?? 100) / 100,
    },
    nodes: items.map((item, idx) => {
      const meta = (item.metadata && typeof item.metadata === "object"
        ? item.metadata
        : {}) as BoardItemCanvasMetadata;
      return {
        id: item.id,
        // Backfill guarantees kind on legacy rows; brand-new rows always write it.
        kind: (item.kind ?? "image") as BoardItemKind,
        position: { x: item.positionX, y: item.positionY },
        size: { width: item.width, height: item.height },
        zIndex: item.zIndex,
        label: item.label,
        imageUrl: item.imageUrl,
        provenance: meta.provenance ?? null,
        status: meta.status ?? null,
        pinned: meta.pinned === true,
        metadata: meta as Record<string, unknown>,
        versionCount: versionCounts[idx] ?? 0,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.sourceItemId,
      target: e.targetItemId,
      relation: e.relation,
      metadata: (e.metadata as Record<string, unknown> | null) ?? null,
    })),
  };
}
