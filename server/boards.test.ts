import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

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

// These tests run the real boards router against a real database.
// vitest.setup.ts strips the live DATABASE_URL so unit runs can never touch
// production data; provide a disposable TEST_DATABASE_URL to run this suite.
const dbAvailable = Boolean(process.env.DATABASE_URL);
if (!dbAvailable) {
  console.warn(
    "[test] Skipping boards tests — no test database (set TEST_DATABASE_URL to run them)"
  );
}

describe.skipIf(!dbAvailable)("boards", () => {
  // ── Board CRUD ─────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a board with default name", async () => {
      const caller = appRouter.createCaller(createAuthContext(100));
      const result = await caller.boards.create({ startedWith: "casting" });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("creates a board with custom name", async () => {
      const caller = appRouter.createCaller(createAuthContext(101));
      const result = await caller.boards.create({
        startedWith: "wardrobe",
        name: "Summer Campaign",
        description: "SS25 lookbook",
      });
      expect(result).toHaveProperty("id");
    });

    it("rejects unauthenticated users", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(
        caller.boards.create({ startedWith: "casting" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("list", () => {
    it("returns only the user's own boards", async () => {
      const ctx1 = createAuthContext(102);
      const caller1 = appRouter.createCaller(ctx1);

      // Create a board for user 102
      await caller1.boards.create({ startedWith: "casting", name: "User102 Board" });

      // List should include it
      const boards = await caller1.boards.list();
      expect(Array.isArray(boards)).toBe(true);
      const names = boards.map((b) => b.name);
      expect(names).toContain("User102 Board");

      // User 103 should NOT see user 102's board
      const caller2 = appRouter.createCaller(createAuthContext(103));
      const boards2 = await caller2.boards.list();
      const names2 = boards2.map((b) => b.name);
      expect(names2).not.toContain("User102 Board");
    });
  });

  describe("get", () => {
    it("returns a board the user owns", async () => {
      const caller = appRouter.createCaller(createAuthContext(104));
      const { id } = await caller.boards.create({ startedWith: "casting" });
      const board = await caller.boards.get({ id });
      expect(board.id).toBe(id);
      expect(board.name).toBe("Untitled Board");
      expect(board.startedWith).toBe("casting");
    });

    it("rejects access to another user's board", async () => {
      const caller1 = appRouter.createCaller(createAuthContext(105));
      const { id } = await caller1.boards.create({ startedWith: "wardrobe" });

      const caller2 = appRouter.createCaller(createAuthContext(106));
      await expect(caller2.boards.get({ id })).rejects.toThrow(TRPCError);
    });
  });

  describe("update", () => {
    it("updates board name and description", async () => {
      const caller = appRouter.createCaller(createAuthContext(107));
      const { id } = await caller.boards.create({ startedWith: "casting" });

      await caller.boards.update({ boardId: id, name: "Renamed Board", description: "New desc" });

      const board = await caller.boards.get({ id });
      expect(board.name).toBe("Renamed Board");
      expect(board.description).toBe("New desc");
    });
  });

  describe("archive", () => {
    it("archives a board and hides it from active list", async () => {
      const caller = appRouter.createCaller(createAuthContext(108));
      const { id } = await caller.boards.create({ startedWith: "casting", name: "ToArchive" });

      await caller.boards.archive({ id });

      // Should not appear in active list
      const active = await caller.boards.list({ status: "active" });
      const activeIds = active.map((b) => b.id);
      expect(activeIds).not.toContain(id);

      // Should appear in archived list
      const archived = await caller.boards.list({ status: "archived" });
      const archivedIds = archived.map((b) => b.id);
      expect(archivedIds).toContain(id);
    });
  });

  describe("delete", () => {
    it("permanently deletes a board", async () => {
      const caller = appRouter.createCaller(createAuthContext(109));
      const { id } = await caller.boards.create({ startedWith: "casting", name: "ToDelete" });

      await caller.boards.delete({ boardId: id });

      await expect(caller.boards.get({ id })).rejects.toThrow(TRPCError);
    });
  });

  describe("saveViewport", () => {
    it("saves viewport state for resume", async () => {
      const caller = appRouter.createCaller(createAuthContext(110));
      const { id } = await caller.boards.create({ startedWith: "casting" });

      await caller.boards.saveViewport({
        id,
        viewportX: 150,
        viewportY: -200,
        viewportZoom: 75,
      });

      const board = await caller.boards.get({ id });
      expect(board.viewportX).toBe(150);
      expect(board.viewportY).toBe(-200);
      expect(board.viewportZoom).toBe(75);
    });
  });

  // ── Board Items CRUD ───────────────────────────────────────────────

  describe("addItem", () => {
    it("adds an item to a board", async () => {
      const caller = appRouter.createCaller(createAuthContext(111));
      const { id: boardId } = await caller.boards.create({ startedWith: "casting" });

      const { id: itemId } = await caller.boards.addItem({
        boardId,
        type: "model",
        label: "Test Model",
        positionX: 100,
        positionY: 200,
      });

      expect(typeof itemId).toBe("number");
    });

    it("rejects adding items to another user's board", async () => {
      const caller1 = appRouter.createCaller(createAuthContext(112));
      const { id: boardId } = await caller1.boards.create({ startedWith: "casting" });

      const caller2 = appRouter.createCaller(createAuthContext(113));
      await expect(
        caller2.boards.addItem({ boardId, type: "model", label: "Hack" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getItems", () => {
    it("returns all items for a board", async () => {
      const caller = appRouter.createCaller(createAuthContext(114));
      const { id: boardId } = await caller.boards.create({ startedWith: "wardrobe" });

      await caller.boards.addItem({ boardId, type: "model", label: "Model A" });
      await caller.boards.addItem({ boardId, type: "garment", label: "Dress B" });

      const items = await caller.boards.getItems({ boardId });
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.label)).toContain("Model A");
      expect(items.map((i) => i.label)).toContain("Dress B");
    });
  });

  describe("updateItem", () => {
    it("updates item label and position", async () => {
      const caller = appRouter.createCaller(createAuthContext(115));
      const { id: boardId } = await caller.boards.create({ startedWith: "casting" });
      const { id: itemId } = await caller.boards.addItem({
        boardId,
        type: "note",
        label: "Original",
        positionX: 0,
        positionY: 0,
      });

      await caller.boards.updateItem({
        itemId,
        label: "Updated",
        positionX: 500,
        positionY: 300,
      });

      const items = await caller.boards.getItems({ boardId });
      const updated = items.find((i) => i.id === itemId);
      expect(updated?.label).toBe("Updated");
      expect(updated?.positionX).toBe(500);
      expect(updated?.positionY).toBe(300);
    });
  });

  describe("batchUpdatePositions", () => {
    it("updates multiple item positions at once", async () => {
      const caller = appRouter.createCaller(createAuthContext(116));
      const { id: boardId } = await caller.boards.create({ startedWith: "casting" });

      const { id: id1 } = await caller.boards.addItem({ boardId, type: "model", positionX: 0, positionY: 0 });
      const { id: id2 } = await caller.boards.addItem({ boardId, type: "garment", positionX: 0, positionY: 0 });

      await caller.boards.batchUpdatePositions({
        boardId,
        updates: [
          { id: id1, positionX: 100, positionY: 200 },
          { id: id2, positionX: 400, positionY: 500, zIndex: 5 },
        ],
      });

      const items = await caller.boards.getItems({ boardId });
      const item1 = items.find((i) => i.id === id1);
      const item2 = items.find((i) => i.id === id2);
      expect(item1?.positionX).toBe(100);
      expect(item1?.positionY).toBe(200);
      expect(item2?.positionX).toBe(400);
      expect(item2?.positionY).toBe(500);
      expect(item2?.zIndex).toBe(5);
    });
  });

  describe("deleteItem", () => {
    it("deletes a single item", async () => {
      const caller = appRouter.createCaller(createAuthContext(117));
      const { id: boardId } = await caller.boards.create({ startedWith: "casting" });
      const { id: itemId } = await caller.boards.addItem({ boardId, type: "model", label: "ToDelete" });

      await caller.boards.deleteItem({ itemId });

      const items = await caller.boards.getItems({ boardId });
      expect(items.find((i) => i.id === itemId)).toBeUndefined();
    });
  });

  describe("deleteItems", () => {
    it("deletes multiple items at once", async () => {
      const caller = appRouter.createCaller(createAuthContext(118));
      const { id: boardId } = await caller.boards.create({ startedWith: "casting" });

      const { id: id1 } = await caller.boards.addItem({ boardId, type: "model" });
      const { id: id2 } = await caller.boards.addItem({ boardId, type: "garment" });
      const { id: id3 } = await caller.boards.addItem({ boardId, type: "note", label: "Keep" });

      await caller.boards.deleteItems({ boardId, itemIds: [id1, id2] });

      const items = await caller.boards.getItems({ boardId });
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(id3);
    });
  });

  describe("addItems (batch)", () => {
    it("adds multiple items at once", async () => {
      const caller = appRouter.createCaller(createAuthContext(119));
      const { id: boardId } = await caller.boards.create({ startedWith: "wardrobe" });

      const { ids } = await caller.boards.addItems({
        boardId,
        items: [
          { type: "model", label: "Model 1", positionX: 0, positionY: 0 },
          { type: "garment", label: "Garment 1", positionX: 300, positionY: 0 },
          { type: "reference", label: "Ref Image", positionX: 600, positionY: 0 },
        ],
      });

      expect(ids).toHaveLength(3);

      const items = await caller.boards.getItems({ boardId });
      expect(items).toHaveLength(3);
    });
  });
});
