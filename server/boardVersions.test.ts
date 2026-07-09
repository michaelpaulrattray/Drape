import { describe, it, expect } from "vitest";
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
    "[test] Skipping board version tests — no test database (set TEST_DATABASE_URL to run them)"
  );
}

describe.skipIf(!dbAvailable)("board item versions", () => {
  // Helper: create a board + item for version tests
  async function createBoardWithItem(userId: number) {
    const caller = appRouter.createCaller(createAuthContext(userId));
    const { id: boardId } = await caller.boards.create({ startedWith: "casting" });
    const { id: itemId } = await caller.boards.addItem({
      boardId,
      type: "model",
      label: "Test Model",
      imageUrl: "https://example.com/original.jpg",
      positionX: 0,
      positionY: 0,
    });
    return { caller, boardId, itemId };
  }

  describe("addItemVersion", () => {
    it("adds a version to a board item", async () => {
      const { caller, itemId } = await createBoardWithItem(500);
      const result = await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v1.jpg",
        prompt: "Make hair blonde",
        tool: "chat",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("adds multiple versions to the same item", async () => {
      const { caller, itemId } = await createBoardWithItem(501);

      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v1.jpg",
        prompt: "Original",
        tool: "initial",
      });
      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v2.jpg",
        prompt: "Change background",
        tool: "chat",
      });
      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v3.jpg",
        prompt: "Fix lighting",
        tool: "surgical",
      });

      const versions = await caller.boards.getItemVersions({ itemId });
      expect(versions.versions.length).toBe(3);
    });

    it("rejects unauthenticated users", async () => {
      const { itemId } = await createBoardWithItem(502);
      const unauth = appRouter.createCaller(createUnauthContext());
      await expect(
        unauth.boards.addItemVersion({
          itemId,
          imageUrl: "https://example.com/v1.jpg",
          tool: "chat",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("rejects access to another user's board item", async () => {
      const { itemId } = await createBoardWithItem(503);
      const otherCaller = appRouter.createCaller(createAuthContext(504));
      await expect(
        otherCaller.boards.addItemVersion({
          itemId,
          imageUrl: "https://example.com/v1.jpg",
          tool: "chat",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getItemVersions", () => {
    it("returns versions in descending order (newest first)", async () => {
      const { caller, itemId } = await createBoardWithItem(505);

      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/first.jpg",
        prompt: "First",
        tool: "initial",
      });
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));
      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/second.jpg",
        prompt: "Second",
        tool: "chat",
      });

      const result = await caller.boards.getItemVersions({ itemId });
      expect(result.versions.length).toBe(2);
      // Oldest first (ascending by version number)
      expect(result.versions[0].prompt).toBe("First");
      expect(result.versions[1].prompt).toBe("Second");
    });

    it("returns empty array for item with no versions", async () => {
      const { caller, itemId } = await createBoardWithItem(506);
      const result = await caller.boards.getItemVersions({ itemId });
      expect(result.versions).toEqual([]);
    });

    it("includes currentImageUrl from the board item", async () => {
      const { caller, itemId } = await createBoardWithItem(507);
      const result = await caller.boards.getItemVersions({ itemId });
      expect(result.currentImageUrl).toBe("https://example.com/original.jpg");
    });
  });

  describe("getItemVersionCount", () => {
    it("returns 0 for item with no versions", async () => {
      const { caller, itemId } = await createBoardWithItem(508);
      const result = await caller.boards.getItemVersionCount({ itemId });
      expect(result.count).toBe(0);
    });

    it("returns correct count after adding versions", async () => {
      const { caller, itemId } = await createBoardWithItem(509);

      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v1.jpg",
        tool: "initial",
      });
      await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v2.jpg",
        tool: "chat",
      });

      const result = await caller.boards.getItemVersionCount({ itemId });
      expect(result.count).toBe(2);
    });
  });

  describe("revertItemVersion", () => {
    it("reverts item to a previous version's image", async () => {
      const { caller, itemId, boardId } = await createBoardWithItem(510);

      // Add a version
      const { id: versionId } = await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/old-version.jpg",
        prompt: "Old version",
        tool: "initial",
      });

      // Update the item to a new image
      await caller.boards.updateItem({
        itemId,
        imageUrl: "https://example.com/new-current.jpg",
      });

      // Revert to the old version
      await caller.boards.revertItemVersion({ itemId, versionId });

      // Verify the item now has the old image
      const items = await caller.boards.getItems({ boardId });
      const item = items.find((i) => i.id === itemId);
      expect(item?.imageUrl).toBe("https://example.com/old-version.jpg");
    });

    it("rejects reverting another user's item version", async () => {
      const { caller, itemId } = await createBoardWithItem(511);

      const { id: versionId } = await caller.boards.addItemVersion({
        itemId,
        imageUrl: "https://example.com/v1.jpg",
        tool: "initial",
      });

      const otherCaller = appRouter.createCaller(createAuthContext(512));
      await expect(
        otherCaller.boards.revertItemVersion({ itemId, versionId })
      ).rejects.toThrow(TRPCError);
    });
  });
});
