/**
 * Lobby Router — unified home-base queries for /app.
 *
 * recentWork unions the user's resumable work across tools into one
 * tool-tagged feed: canvas boards, wardrobe sessions, and NAMED casts
 * (VC-R5 F3: naming happens at mint, which also flips status past 'draft' —
 * a drafts-only source lost every cast the moment the user named it, and
 * the D-42 unnamed-filter then emptied the rest; the honest source is named
 * casting work regardless of status). Future tools join the union here.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getUserBoards, getPlacedModelIds } from "../db/boards";
import { getRecentUserSessions } from "../db/wardrobe";
import { getUserDraftModelsWithThumbnail, getUserMintedModelsWithThumbnail } from "../db/models";
import { DRAFT_AUTO_NAME } from "../lib/boardOps";

// 8 = two clean rows at the lobby's 4-across laptop layout; Home is a
// resume surface, the full archives live in Boards and the library pages.
const DEFAULT_LIMIT = 8;
const CASTS_LIMIT = 6; // per casting source (named drafts / minted)

type BoardRow = Awaited<ReturnType<typeof getUserBoards>>[number];
type WardrobeSessionRow = Awaited<ReturnType<typeof getRecentUserSessions>>[number];
/** The casting feed row — named drafts and minted models both map onto it. */
type CastFeedRow = {
  id: number;
  name: string | null;
  thumbnailUrl: string;
  assetCount: number;
  updatedAt: Date;
  /** Batch 0 (deletion ruling): only drafts are hard-deletable — the card's
   *  delete affordance keys off this, never off a client guess. */
  draft: boolean;
};

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
      /** Only drafts may be deleted (Batch 0 ruling); minted rows disable
       *  the affordance with honest copy. */
      draft: boolean;
    };

/**
 * Merge the three per-tool result sets into one feed, newest first.
 * Pure — exported for unit tests.
 */
export function mergeRecentWork(
  boards: BoardRow[],
  sessions: WardrobeSessionRow[],
  casts: CastFeedRow[],
  limit: number,
  /** Group 6j item 4 (C8): model ids alive on the user's active boards —
   *  a canvas-born cast is represented by its BOARD row only (the board IS
   *  the recent work); standalone casts appear individually. */
  placedModelIds: Set<number> = new Set(),
): RecentWorkItem[] {
  // A2(b) as corrected by VC-R5 F3: the feed's casting rows are NAMED casts —
  // named drafts and minted models alike. Unnamed drafts (D-42's candidate
  // marker — every canvas cast/fork/variation) stay out: candidates live on
  // their board, and six of them were displacing the boards/sessions the
  // user actually returns to. The Models library is untouched.
  const namedCasts = casts.filter(
    (c) => c.name && c.name !== DRAFT_AUTO_NAME && !placedModelIds.has(c.id),
  );
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
    ...namedCasts.map((c): RecentWorkItem => ({
      tool: "casting",
      modelId: c.id,
      name: c.name,
      thumbnailUrl: c.thumbnailUrl,
      assetCount: c.assetCount,
      updatedAt: c.updatedAt,
      draft: c.draft,
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
      const [boards, sessions, drafts, minted, placedModelIds] = await Promise.all([
        getUserBoards(ctx.user.id, "active"),
        getRecentUserSessions(ctx.user.id),
        getUserDraftModelsWithThumbnail(ctx.user.id, CASTS_LIMIT),
        getUserMintedModelsWithThumbnail(ctx.user.id, CASTS_LIMIT),
        getPlacedModelIds(ctx.user.id),
      ]);
      // One casting source: named drafts + minted models (F3). The merge's
      // named-filter drops unnamed candidates; minted are named at mint.
      const casts: CastFeedRow[] = [
        ...drafts.map((d) => ({ ...d, draft: true })),
        ...minted.map((m) => ({
          id: m.id,
          name: m.name,
          thumbnailUrl: m.thumbnailUrl,
          assetCount: m.assetCount,
          updatedAt: m.updatedAt,
          draft: false,
        })),
      ];
      return mergeRecentWork(boards, sessions, casts, limit, placedModelIds);
    }),
});
