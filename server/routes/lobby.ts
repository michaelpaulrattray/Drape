/**
 * Lobby Router — unified home-base queries for /app.
 *
 * recentWork unions the user's resumable work across tools into one
 * tool-tagged feed: canvas boards, wardrobe sessions, and draft casts.
 * Future tools (scenery, editorial) join the union here.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getUserBoards } from "../db/boards";
import { getRecentUserSessions } from "../db/wardrobe";
import { getUserDraftModelsWithThumbnail } from "../db/models";

// 8 = two clean rows at the lobby's 4-across laptop layout; Home is a
// resume surface, the full archives live in Boards and the library pages.
const DEFAULT_LIMIT = 8;
const DRAFTS_LIMIT = 6;

type BoardRow = Awaited<ReturnType<typeof getUserBoards>>[number];
type WardrobeSessionRow = Awaited<ReturnType<typeof getRecentUserSessions>>[number];
type DraftModelRow = Awaited<ReturnType<typeof getUserDraftModelsWithThumbnail>>[number];

export type RecentWorkItem =
  | {
      tool: "canvas";
      boardId: number;
      name: string;
      thumbnailUrl: string | null;
      startedWith: BoardRow["startedWith"];
      updatedAt: Date;
    }
  | {
      tool: "wardrobe";
      sessionId: number;
      modelId: number | null;
      name: string | null;
      thumbnailUrl: string;
      iterationCount: number;
      savedLookCount: number;
      updatedAt: Date;
    }
  | {
      tool: "casting";
      modelId: number;
      name: string | null;
      thumbnailUrl: string;
      assetCount: number;
      updatedAt: Date;
    };

/**
 * Merge the three per-tool result sets into one feed, newest first.
 * Pure — exported for unit tests.
 */
export function mergeRecentWork(
  boards: BoardRow[],
  sessions: WardrobeSessionRow[],
  drafts: DraftModelRow[],
  limit: number,
): RecentWorkItem[] {
  const items: RecentWorkItem[] = [
    ...boards.map((b): RecentWorkItem => ({
      tool: "canvas",
      boardId: b.id,
      name: b.name,
      thumbnailUrl: b.thumbnailUrl,
      startedWith: b.startedWith,
      updatedAt: b.updatedAt,
    })),
    ...sessions.map((s): RecentWorkItem => ({
      tool: "wardrobe",
      sessionId: s.sessionId,
      modelId: s.modelId,
      name: s.modelName,
      thumbnailUrl: s.lastResultUrl,
      iterationCount: s.iterationCount,
      savedLookCount: s.savedLookCount,
      updatedAt: s.updatedAt,
    })),
    ...drafts.map((d): RecentWorkItem => ({
      tool: "casting",
      modelId: d.id,
      name: d.name,
      thumbnailUrl: d.thumbnailUrl,
      assetCount: d.assetCount,
      updatedAt: d.updatedAt,
    })),
  ];

  return items
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export const lobbyRouter = router({
  /** Unified recent-work feed across boards, wardrobe sessions, and draft casts */
  recentWork: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(DEFAULT_LIMIT),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? DEFAULT_LIMIT;
      const [boards, sessions, drafts] = await Promise.all([
        getUserBoards(ctx.user.id, "active"),
        getRecentUserSessions(ctx.user.id),
        getUserDraftModelsWithThumbnail(ctx.user.id, DRAFTS_LIMIT),
      ]);
      return mergeRecentWork(boards, sessions, drafts, limit);
    }),
});
