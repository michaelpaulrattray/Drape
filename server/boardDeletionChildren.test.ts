/**
 * A PERMANENT BOARD DELETION TAKES ITS CHILD ROWS WITH IT.
 *
 * `board_edges` and `board_item_versions` hang off boards and items with no
 * foreign key, so nothing in the database removes them when their parent goes.
 * All three hard-delete paths used to delete the parent and stop, and the cost
 * was measured before this suite was written (2026-08-19, read-only census of
 * both worlds): production held **73 of 83 edges and 170 of 184 versions
 * orphaned**; dev held 658 of 701 versions orphaned.
 *
 * # What this suite is, and what it is NOT
 *
 * It drives the REAL `deleteBoard` / `deleteBoardItem` / `deleteBoardItems`
 * through a recording fake transaction and asserts which tables each one
 * deletes from, in what order. That is stronger than a source-text assertion —
 * it fails if the call is removed, reordered, or pointed at another table.
 *
 * **It is weaker than the behavioural arm and this is the honest statement of
 * why.** The real proof is: insert a board, an item, an edge and a version;
 * delete; observe the children are gone. That needs a disposable database, and
 * this machine has none — `server/boards.test.ts` is 28 tests and skips all 28
 * for exactly this reason. Three HELD rows in
 * `docs/specs/cleanup-dispositions.yaml` already name that blocker; this fix is
 * its fourth customer. So this suite proves the STATEMENTS ARE ISSUED and
 * cannot prove the ROWS ARE GONE.
 *
 * # The ordering assertion is not cosmetic
 *
 * Children are deleted BEFORE the parent because each child statement
 * re-anchors through the owned parent row (enforcement invariants 1 and 2). If
 * the parent went first, the ownership subquery would find nothing and the
 * child delete would silently match zero rows — a fix that looks right, passes
 * a "does it call the delete" test, and leaves the orphans exactly where they
 * were. Order is the correctness condition here, so it is asserted.
 *
 * # Rows only, asserted as such
 *
 * No path may reach storage: a board item's image can be owned by another
 * domain (a cast's frame placed on a board), so deleting bytes through a boards
 * reference is cross-domain destruction. The suite asserts the deleted tables
 * are exactly the row tables and nothing else.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

/* The recording fake. Every `tx.delete(table)` appends that table's name, so a
   test reads the sequence the real function issued rather than its source. */
const deletions: string[] = [];

function makeTx() {
  const selectResult = {
    from: () => ({
      where: () => {
        const rows = [{
          id: 41, deletedAt: null, positionX: 0, positionY: 0,
          width: 10, height: 10, zIndex: 0,
        }];
        /* Two shapes reach here: the board lock (`.where().for("update")`,
           which must yield one owned board) and the item lock
           (`.where().orderBy().for("update")`, which must yield the rows). */
        return Object.assign(Promise.resolve(rows), {
          for: () => Promise.resolve([{ id: 7 }]),
          orderBy: () => ({ for: () => Promise.resolve(rows) }),
        });
      },
    }),
  };
  return {
    select: () => selectResult,
    delete: (table: unknown) => ({
      where: () => {
        deletions.push(getTableName(table as never));
        return Promise.resolve([{ affectedRows: 1 }]);
      },
    }),
  };
}

vi.mock("./db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/connection")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    withTransaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(makeTx())),
  };
});

const { deleteBoard, deleteBoardItem, deleteBoardItems } = await import("./db/boards");

beforeEach(() => {
  deletions.length = 0;
});

describe("a permanent board deletion takes its child rows with it", () => {
  it("deleteBoard removes both child tables, then the items, then the board", async () => {
    await deleteBoard({ userId: 7, boardId: 3 });

    expect(deletions).toEqual([
      "board_item_versions",
      "board_edges",
      "board_items",
      "boards",
    ]);
  });

  it("deleteBoardItem removes the item's versions and edges before the item", async () => {
    await deleteBoardItem({ userId: 7, itemId: 41 });

    expect(deletions).toEqual([
      "board_item_versions",
      "board_edges",
      "board_items",
    ]);
  });

  it("deleteBoardItems removes the batch's versions and edges before the items", async () => {
    await deleteBoardItems({ userId: 7, boardId: 3, itemIds: [41] });

    expect(deletions).toEqual([
      "board_item_versions",
      "board_edges",
      "board_items",
    ]);
  });

  /* The negative arm the ordering claim needs: children strictly precede the
     parent everywhere. Stated as its own assertion because it is the condition
     that makes the ownership re-anchoring work, and a reordering would still
     satisfy every "does it delete from X" check above. */
  it("never deletes a parent before its children, on any path", async () => {
    for (const run of [
      () => deleteBoard({ userId: 7, boardId: 3 }),
      () => deleteBoardItem({ userId: 7, itemId: 41 }),
      () => deleteBoardItems({ userId: 7, boardId: 3, itemIds: [41] }),
    ]) {
      deletions.length = 0;
      await run();
      const parent = deletions.indexOf("board_items");
      const versions = deletions.indexOf("board_item_versions");
      const edges = deletions.indexOf("board_edges");
      /* Presence is asserted before order. `indexOf` returns -1 for a MISSING
         delete, and -1 < parent is true — so an ordering check alone stays
         green when a child delete is removed entirely. Found by sabotage
         rather than by reading: cutting the edge delete out of `deleteBoard`
         reddened only the sequence test above and this one passed. */
      expect(parent).toBeGreaterThan(-1);
      expect(versions).toBeGreaterThan(-1);
      expect(edges).toBeGreaterThan(-1);
      expect(versions).toBeLessThan(parent);
      expect(edges).toBeLessThan(parent);
    }
  });

  /* Rows only — no path may reach a storage table or any table outside the
     board family. An imageUrl on a version row can point at an object another
     domain owns. */
  it("touches board row tables only — never storage, never another domain", async () => {
    await deleteBoard({ userId: 7, boardId: 3 });
    await deleteBoardItem({ userId: 7, itemId: 41 });
    await deleteBoardItems({ userId: 7, boardId: 3, itemIds: [41] });

    const allowed = new Set(["boards", "board_items", "board_edges", "board_item_versions"]);
    expect(deletions.filter((table) => !allowed.has(table))).toEqual([]);
  });

  /* Nothing to delete must issue nothing — an empty batch that still fired a
     DELETE would be a statement whose predicate is the only thing standing
     between it and the whole table. */
  it("deleteBoardItems with no ids issues no statement at all", async () => {
    await deleteBoardItems({ userId: 7, boardId: 3, itemIds: [] });
    expect(deletions).toEqual([]);
  });
});
