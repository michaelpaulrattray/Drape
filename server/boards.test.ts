import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import {
  addOwnedBoardItemVersion,
  createModel,
  createSession,
  deleteBoardItem,
  fillEmptyCastNodeWithVersionIn,
  getBoardItemById,
  getBoardItemVersions,
  getSessionById,
  mergeBoardItemMetadata,
  revertOwnedBoardItemVersion,
  softDeleteBoardItems,
  stampBoardItemWithVersionIn,
  updateBoardItem,
  updateBoardItemIn,
  updateSession,
  withTransaction,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    approved: true,
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

  describe("C1 durable ownership", () => {
    it("rejects client-supplied authority fields at every hardened wire boundary", async () => {
      const caller = appRouter.createCaller(createAuthContext(400));

      await expect(caller.boards.batchUpdatePositions({
        boardId: 1,
        updates: [{ id: 1, positionX: 0, positionY: 0 }],
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boards.deleteItems({
        boardId: 1,
        itemIds: [1],
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boardOps.undoDelete({
        boardId: 1,
        itemIds: [1],
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boardOps.removeEdge({
        boardId: 1,
        edgeId: 1,
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boards.updateItem({
        itemId: 1,
        label: "forged",
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boards.deleteItem({
        itemId: 1,
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boards.addItemVersion({
        itemId: 1,
        imageUrl: "https://example.com/version.png",
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boards.revertItemVersion({
        itemId: 1,
        versionId: 1,
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boardOps.updateNodeMetadata({
        boardId: 1,
        itemId: 1,
        metadata: {},
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boardOps.markNodeStatus({
        boardId: 1,
        itemId: 1,
        status: null,
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller.boardOps.setNodePinned({
        boardId: 1,
        itemId: 1,
        pinned: true,
        userId: 999,
      } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects a mixed-board position batch before changing either user's item", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(401));
      const ownerB = appRouter.createCaller(createAuthContext(402));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({
        boardId: boardA,
        type: "note",
        positionX: 10,
        positionY: 20,
      });
      const { id: itemB } = await ownerB.boards.addItem({
        boardId: boardB,
        type: "note",
        positionX: 30,
        positionY: 40,
      });

      await expect(ownerB.boards.batchUpdatePositions({
        boardId: boardB,
        updates: [
          { id: itemB, positionX: 300, positionY: 400 },
          { id: itemA, positionX: 500, positionY: 600 },
        ],
      })).rejects.toMatchObject({ code: "NOT_FOUND" });

      const [afterA] = await ownerA.boards.getItems({ boardId: boardA });
      const [afterB] = await ownerB.boards.getItems({ boardId: boardB });
      expect({ x: afterA?.positionX, y: afterA?.positionY }).toEqual({ x: 10, y: 20 });
      expect({ x: afterB?.positionX, y: afterB?.positionY }).toEqual({ x: 30, y: 40 });

      await ownerB.boards.batchUpdatePositions({
        boardId: boardB,
        updates: [{ id: itemB, positionX: 300, positionY: 400 }],
      });
      const [landedB] = await ownerB.boards.getItems({ boardId: boardB });
      expect({ x: landedB?.positionX, y: landedB?.positionY }).toEqual({ x: 300, y: 400 });
      expect((await ownerA.boards.getItems({ boardId: boardA }))[0]?.positionX).toBe(10);

      await ownerB.boardOps.moveNodes({
        boardId: boardB,
        moves: [{ itemId: itemB, x: 350, y: 450 }],
      });
      const [movedB] = await ownerB.boards.getItems({ boardId: boardB });
      expect({ x: movedB?.positionX, y: movedB?.positionY }).toEqual({ x: 350, y: 450 });
    });

    it("rejects a mixed-board hard-delete batch without deleting any row", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(403));
      const ownerB = appRouter.createCaller(createAuthContext(404));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({ boardId: boardA, type: "note" });
      const { id: itemB } = await ownerB.boards.addItem({ boardId: boardB, type: "note" });

      await expect(ownerB.boards.deleteItems({
        boardId: boardB,
        itemIds: [itemB, itemA],
      })).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect((await ownerA.boards.getItems({ boardId: boardA })).map((item) => item.id))
        .toContain(itemA);
      expect((await ownerB.boards.getItems({ boardId: boardB })).map((item) => item.id))
        .toContain(itemB);

      await ownerB.boards.deleteItems({ boardId: boardB, itemIds: [itemB] });
      expect((await ownerB.boards.getItems({ boardId: boardB })).map((item) => item.id))
        .not.toContain(itemB);
      expect((await ownerA.boards.getItems({ boardId: boardA })).map((item) => item.id))
        .toContain(itemA);
    });

    it("rejects a mixed-board undo before restoring either user's deleted item", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(405));
      const ownerB = appRouter.createCaller(createAuthContext(406));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({ boardId: boardA, type: "note" });
      const { id: itemB } = await ownerB.boards.addItem({ boardId: boardB, type: "note" });
      await ownerA.boardOps.deleteNode.execute({ boardId: boardA, itemId: itemA });
      await ownerB.boardOps.deleteNode.execute({ boardId: boardB, itemId: itemB });

      await expect(ownerB.boardOps.undoDelete({
        boardId: boardB,
        itemIds: [itemB, itemA],
      })).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect((await getBoardItemById(itemA))?.deletedAt).not.toBeNull();
      expect((await getBoardItemById(itemB))?.deletedAt).not.toBeNull();

      await expect(ownerB.boardOps.undoDelete({
        boardId: boardB,
        itemIds: [itemB],
      })).resolves.toEqual({ restored: 1 });
      expect((await getBoardItemById(itemA))?.deletedAt).not.toBeNull();
      expect((await getBoardItemById(itemB))?.deletedAt).toBeNull();
    });

    it("cannot remove another board's edge and leaves both edge sets intact", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(407));
      const ownerB = appRouter.createCaller(createAuthContext(408));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: sourceA } = await ownerA.boards.addItem({ boardId: boardA, type: "note" });
      const { id: targetA } = await ownerA.boards.addItem({ boardId: boardA, type: "note" });
      const { id: sourceB } = await ownerB.boards.addItem({ boardId: boardB, type: "note" });
      const { id: targetB } = await ownerB.boards.addItem({ boardId: boardB, type: "note" });
      const { edgeId: edgeA } = await ownerA.boardOps.addEdge({
        boardId: boardA,
        sourceItemId: sourceA,
        targetItemId: targetA,
        relation: "reference_for",
      });
      const { edgeId: edgeB } = await ownerB.boardOps.addEdge({
        boardId: boardB,
        sourceItemId: sourceB,
        targetItemId: targetB,
        relation: "reference_for",
      });

      await expect(ownerB.boardOps.removeEdge({
        boardId: boardB,
        edgeId: edgeA,
      })).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect((await ownerA.boardOps.listEdges({ boardId: boardA })).map((edge) => edge.id))
        .toContain(edgeA);
      expect((await ownerB.boardOps.listEdges({ boardId: boardB })).map((edge) => edge.id))
        .toContain(edgeB);

      await ownerB.boardOps.removeEdge({ boardId: boardB, edgeId: edgeB });
      expect((await ownerB.boardOps.listEdges({ boardId: boardB })).map((edge) => edge.id))
        .not.toContain(edgeB);
      expect((await ownerA.boardOps.listEdges({ boardId: boardA })).map((edge) => edge.id))
        .toContain(edgeA);
    });

    it("soft-delete rejects a mixed-owner cohort before changing either row", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(409));
      const ownerB = appRouter.createCaller(createAuthContext(410));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({ boardId: boardA, type: "note" });
      const { id: itemB } = await ownerB.boards.addItem({ boardId: boardB, type: "note" });

      await expect(softDeleteBoardItems({
        userId: 410,
        boardId: boardB,
        itemIds: [itemB, itemA],
      })).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect((await getBoardItemById(itemA))?.deletedAt).toBeNull();
      expect((await getBoardItemById(itemB))?.deletedAt).toBeNull();

      await softDeleteBoardItems({
        userId: 410,
        boardId: boardB,
        itemIds: [itemB],
      });
      expect((await getBoardItemById(itemA))?.deletedAt).toBeNull();
      expect((await getBoardItemById(itemB))?.deletedAt).not.toBeNull();
    });

    it("R7 landing helpers cannot stamp, stale, fill, or version another owner's node", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(411));
      const ownerB = appRouter.createCaller(createAuthContext(412));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({
        boardId: boardA,
        type: "note",
        label: "Owner A",
      });
      const { id: itemB } = await ownerB.boards.addItem({
        boardId: boardB,
        type: "note",
        label: "Owner B",
      });
      const model = await createModel({
        userId: 412,
        name: "Owner B Cast",
        masterPrompt: "Owner B immutable prompt",
        technicalSchema: {},
        preferences: {},
        status: "draft",
      });
      if (!model.modelId) throw new Error("test model insert failed");

      await expect(withTransaction((tx) => stampBoardItemWithVersionIn(tx, {
        userId: 412,
        boardId: boardB,
        itemId: itemA,
        update: { label: "Compromised" },
        version: {
          version: 1,
          imageUrl: "https://example.com/foreign-stamp.png",
          tool: "initial",
        },
      }))).rejects.toMatchObject({ code: "NOT_FOUND" });

      await expect(withTransaction((tx) => updateBoardItemIn(tx, {
        userId: 412,
        boardId: boardB,
        itemId: itemA,
        data: { label: "Compromised" },
      }))).rejects.toMatchObject({ code: "NOT_FOUND" });

      await expect(withTransaction((tx) => fillEmptyCastNodeWithVersionIn(tx, {
        userId: 412,
        boardId: boardB,
        itemId: itemA,
        modelId: model.modelId!,
        build: () => ({
          update: {
            label: "Compromised",
            imageUrl: "https://example.com/foreign-fill.png",
            sourceModelId: model.modelId!,
          },
          version: {
            imageUrl: "https://example.com/foreign-fill.png",
            tool: "initial",
          },
        }),
      }))).resolves.toBe("not_found");

      expect((await getBoardItemById(itemA))?.label).toBe("Owner A");
      expect(await getBoardItemVersions(itemA)).toHaveLength(0);

      await withTransaction((tx) => stampBoardItemWithVersionIn(tx, {
        userId: 412,
        boardId: boardB,
        itemId: itemB,
        update: {
          label: "Owner B stamped",
          imageUrl: "https://example.com/owner-b-stamp.png",
        },
        version: {
          version: 1,
          imageUrl: "https://example.com/owner-b-stamp.png",
          tool: "initial",
        },
      }));
      expect((await getBoardItemById(itemB))?.label).toBe("Owner B stamped");
      expect((await getBoardItemVersions(itemB)).map((version) => version.itemId))
        .toEqual([itemB]);
    });

    it("single-item metadata, update, and delete helpers prove ownership in their writes", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(415));
      const ownerB = appRouter.createCaller(createAuthContext(416));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({
        boardId: boardA,
        type: "note",
        label: "Owner A",
        metadata: { retained: "yes" },
      });
      const { id: itemB } = await ownerB.boards.addItem({
        boardId: boardB,
        type: "note",
        label: "Owner B",
      });

      await expect(updateBoardItem({
        userId: 416,
        itemId: itemA,
        data: { label: "Compromised" },
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(mergeBoardItemMetadata({
        userId: 416,
        itemId: itemA,
        metadata: { compromised: true },
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(deleteBoardItem({
        userId: 416,
        itemId: itemA,
      })).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(await getBoardItemById(itemA)).toMatchObject({
        label: "Owner A",
        metadata: { retained: "yes" },
      });

      await ownerB.boards.updateItem({
        itemId: itemB,
        label: "Owner B updated",
      });
      await ownerB.boardOps.updateNodeMetadata({
        boardId: boardB,
        itemId: itemB,
        metadata: { pinned: true },
      });
      expect(await getBoardItemById(itemB)).toMatchObject({
        label: "Owner B updated",
        metadata: { pinned: true },
      });
      await ownerB.boards.deleteItem({ itemId: itemB });
      expect(await getBoardItemById(itemB)).toBeNull();
      expect((await getBoardItemById(itemA))?.label).toBe("Owner A");
    });

    it("version insert and revert anchor the client version id to an owned item", async () => {
      const ownerA = appRouter.createCaller(createAuthContext(417));
      const ownerB = appRouter.createCaller(createAuthContext(418));
      const { id: boardA } = await ownerA.boards.create({ startedWith: "blank" });
      const { id: boardB } = await ownerB.boards.create({ startedWith: "blank" });
      const { id: itemA } = await ownerA.boards.addItem({
        boardId: boardA,
        type: "note",
        imageUrl: "https://example.com/a-current.png",
      });
      const { id: itemB } = await ownerB.boards.addItem({
        boardId: boardB,
        type: "note",
        imageUrl: "https://example.com/b-current.png",
      });

      await expect(addOwnedBoardItemVersion({
        userId: 418,
        itemId: itemA,
        imageUrl: "https://example.com/foreign-version.png",
        tool: "initial",
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await getBoardItemVersions(itemA)).toHaveLength(0);

      const versionA = await ownerA.boards.addItemVersion({
        itemId: itemA,
        imageUrl: "https://example.com/a-history.png",
        tool: "initial",
      });
      const versionB = await ownerB.boards.addItemVersion({
        itemId: itemB,
        imageUrl: "https://example.com/b-history.png",
        tool: "initial",
      });
      expect(versionA.version).toBe(1);
      expect(versionB.version).toBe(1);

      await expect(ownerB.boards.revertItemVersion({
        itemId: itemB,
        versionId: versionA.id,
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(revertOwnedBoardItemVersion({
        userId: 418,
        itemId: itemA,
        versionId: versionA.id,
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await getBoardItemById(itemA))?.imageUrl)
        .toBe("https://example.com/a-current.png");
      expect((await getBoardItemById(itemB))?.imageUrl)
        .toBe("https://example.com/b-current.png");

      await expect(ownerA.boards.revertItemVersion({
        itemId: itemA,
        versionId: versionA.id,
      })).resolves.toEqual({
        success: true,
        imageUrl: "https://example.com/a-history.png",
      });
      expect((await getBoardItemById(itemA))?.imageUrl)
        .toBe("https://example.com/a-history.png");
    });

    it("Wardrobe session reads and writes scope ownership in the database statement", async () => {
      const sessionId = await createSession({
        userId: 413,
        modelId: null,
        modelImageUrl: "https://example.com/owner-413.png",
        history: ["https://example.com/original.png"],
        historyIndex: 0,
        activeGarmentIds: [],
      });

      await expect(getSessionById(sessionId, 414)).resolves.toBeNull();
      await updateSession(sessionId, 414, {
        history: ["https://example.com/foreign.png"],
      });
      expect((await getSessionById(sessionId, 413))?.history)
        .toEqual(["https://example.com/original.png"]);

      await updateSession(sessionId, 413, {
        history: ["https://example.com/owned.png"],
      });
      expect((await getSessionById(sessionId, 413))?.history)
        .toEqual(["https://example.com/owned.png"]);
    });
  });
});
