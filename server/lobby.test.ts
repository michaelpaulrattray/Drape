import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { mergeRecentWork, type RecentWorkItem } from "./routes/lobby";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ── Pure merge logic (no DB required) ───────────────────────────────────

function boardRow(id: number, updatedAt: Date) {
  return {
    id,
    userId: 1,
    name: `Board ${id}`,
    description: null,
    thumbnailUrl: null,
    thumbnailKey: null,
    startedWith: "casting" as const,
    status: "active" as const,
    viewportX: 0,
    viewportY: 0,
    viewportZoom: 100,
    createdAt: updatedAt,
    updatedAt,
  };
}

function sessionRow(sessionId: number, updatedAt: Date) {
  return {
    tool: "wardrobe" as const,
    sessionId,
    modelId: null,
    modelName: null,
    masterPrompt: null,
    modelImageUrl: "https://example.com/model.png",
    lastResultUrl: "https://example.com/result.png",
    iterationCount: 3,
    savedLookCount: 0,
    activeGarmentIds: [],
    history: ["https://example.com/result.png"],
    historyIndex: 0,
    updatedAt,
    tattooMapData: null,
    styleNotes: null,
  };
}

function draftRow(id: number, updatedAt: Date) {
  return {
    id,
    name: `Draft ${id}`,
    masterPrompt: null,
    preferences: null,
    technicalSchema: null,
    thumbnailUrl: "https://example.com/draft.png",
    assetCount: 2,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("mergeRecentWork", () => {
  it("interleaves tools sorted by updatedAt descending", () => {
    const t = (min: number) => new Date(2026, 6, 10, 12, min);
    const result = mergeRecentWork(
      [boardRow(1, t(10)), boardRow(2, t(40))],
      [sessionRow(5, t(30))],
      [draftRow(9, t(20))],
      12,
    );
    expect(result.map((r) => r.tool)).toEqual([
      "canvas",
      "wardrobe",
      "casting",
      "canvas",
    ]);
    expect(result[0]).toMatchObject({ tool: "canvas", boardId: 2 });
    expect(result[1]).toMatchObject({ tool: "wardrobe", sessionId: 5 });
    expect(result[2]).toMatchObject({ tool: "casting", modelId: 9 });
  });

  it("applies the limit after sorting", () => {
    const t = (min: number) => new Date(2026, 6, 10, 12, min);
    const result = mergeRecentWork(
      [boardRow(1, t(1)), boardRow(2, t(2)), boardRow(3, t(3))],
      [sessionRow(5, t(4))],
      [],
      2,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ tool: "wardrobe", sessionId: 5 });
    expect(result[1]).toMatchObject({ tool: "canvas", boardId: 3 });
  });

  it("returns an empty feed when there is no work", () => {
    expect(mergeRecentWork([], [], [], 12)).toEqual([]);
  });

  it("excludes UNNAMED casts — canvas candidates live on their board, not the lobby (A2b/D-42/F3)", () => {
    const now = new Date();
    const unnamed = { ...draftRow(7, now), name: null };
    const sentinel = { ...draftRow(8, now), name: "Draft Model" };
    const named = draftRow(9, now);
    // Minted models arrive through the same casting source (F3) — named at
    // mint by construction, they must survive the filter
    const minted = { id: 10, name: "Vera", thumbnailUrl: "https://example.com/vera.png", assetCount: 4, updatedAt: now };
    const result = mergeRecentWork([], [], [unnamed, sentinel, named, minted], 12);
    expect(result).toHaveLength(2);
    expect(result.map((r) => (r.tool === "casting" ? r.modelId : -1)).sort((a, b) => a - b)).toEqual([9, 10]);
  });

  it("maps per-tool card fields onto the union shape", () => {
    const now = new Date();
    const [canvas, wardrobe, casting] = mergeRecentWork(
      [boardRow(1, now)],
      [sessionRow(2, now)],
      [draftRow(3, now)],
      12,
    ) as [RecentWorkItem, RecentWorkItem, RecentWorkItem];

    expect(canvas).toMatchObject({
      tool: "canvas",
      boardId: 1,
      name: "Board 1",
      startedWith: "casting",
    });
    expect(wardrobe).toMatchObject({
      tool: "wardrobe",
      sessionId: 2,
      thumbnailUrl: "https://example.com/result.png",
      iterationCount: 3,
    });
    expect(casting).toMatchObject({
      tool: "casting",
      modelId: 3,
      thumbnailUrl: "https://example.com/draft.png",
      assetCount: 2,
    });
  });
});

// ── Router (requires a disposable TEST_DATABASE_URL) ───────────────────

const dbAvailable = Boolean(process.env.DATABASE_URL);
if (!dbAvailable) {
  console.warn(
    "[test] Skipping lobby router tests — no test database (set TEST_DATABASE_URL to run them)"
  );
}

describe("lobby.recentWork auth", () => {
  it("rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.lobby.recentWork()).rejects.toThrow(TRPCError);
  });
});

describe.skipIf(!dbAvailable)("lobby.recentWork", () => {
  it("includes a freshly created board in the feed", async () => {
    const caller = appRouter.createCaller(createAuthContext(200));
    const { id } = await caller.boards.create({
      startedWith: "blank",
      name: "Lobby Feed Board",
    });

    const feed = await caller.lobby.recentWork();
    const item = feed.find((i) => i.tool === "canvas" && i.boardId === id);
    expect(item).toBeDefined();
    expect(item).toMatchObject({ tool: "canvas", name: "Lobby Feed Board" });
  });

  it("respects the limit input", async () => {
    const caller = appRouter.createCaller(createAuthContext(201));
    await caller.boards.create({ startedWith: "blank" });
    await caller.boards.create({ startedWith: "blank" });
    const feed = await caller.lobby.recentWork({ limit: 1 });
    expect(feed.length).toBeLessThanOrEqual(1);
  });
});
