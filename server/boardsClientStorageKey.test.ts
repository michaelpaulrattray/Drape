/**
 * A BOARD'S STORAGE KEY IS NEVER THE CLIENT'S TO NAME (#2056).
 *
 * The attack, end to end: a customer writes ANOTHER customer's storage key
 * (a cast's picture key is readable off its public URL) into her own board —
 * `boards.update`'s `thumbnailKey`, or `imageKey` on `addItem`, `addItems` or
 * `updateItem` — then deletes her account. The erasure
 * (`collectAccountOwnedStorageItemsIn`) reads `boards.thumbnailKey` and
 * `board_items.imageKey` as EXPLICIT keys, which are deletion authority, so
 * the other customer's picture lands in her deletion manifest.
 *
 * The repair is at the input (`server/routes/boards.ts`): the four writers
 * take either key only as `null` or absent and never write the column. These
 * arms drive the REAL router (`appRouter.createCaller`) with only the database
 * writers replaced by recorders, then hand the rows those writers were given
 * to the REAL collector over a transaction that answers each table's read with
 * them — so what is asserted is the deletion set itself, reached through the
 * same two hops the attack takes.
 *
 * Controls:
 *   · NEGATIVE (the attack): another account's key on each of the four
 *     writers is a BAD_REQUEST, nothing is written, and the key is not in the
 *     manifest.
 *   · POSITIVE (legitimate traffic): every payload the client actually sends
 *     (read at `client/src/features/boards/`) still writes, and the deploy-skew
 *     `null` is accepted and dropped.
 *   · POSITIVE (the instrument): the same collector over a board item whose key
 *     a SERVER writer recorded does put that key in the manifest — without it,
 *     the negative arm's absence would prove nothing.
 *
 * Out of scope and filed on the card rather than papered over: a row ALREADY
 * carrying a client-typed key from before this guard is still read as
 * authority by the erasure; that side lives in `server/db/accountDeletion.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const ME = 41;
const OTHER = 77;
const BOARD_ID = 9001;
const PUBLIC = "https://pub-test.r2.dev";
/** A real cast-picture key shape belonging to ANOTHER account. */
const STOLEN = `castingv2/${OTHER}/candidates/abc-0001.png`;
/** A key only a server writer could have put there, owned by ME. */
const SERVER_WRITTEN_OWN = `castingv2/${ME}/candidates/own-0001.png`;

type Written = Record<string, unknown>;
const writes = {
  boardUpdates: [] as Array<{ id: number; data: Written }>,
  itemInserts: [] as Written[],
  itemUpdates: [] as Array<{ itemId: number; data: Written }>,
};

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getBoardById: async (id: number) => ({ id, userId: ME }),
    updateBoard: async (id: number, data: Written) => {
      writes.boardUpdates.push({ id, data });
    },
    addBoardItem: async (data: Written) => {
      writes.itemInserts.push(data);
      return writes.itemInserts.length;
    },
    addBoardItems: async (items: Written[]) => {
      writes.itemInserts.push(...items);
      return items.map((_, index) => index + 1);
    },
    updateBoardItem: async (input: { userId: number; itemId: number; data: Written }) => {
      writes.itemUpdates.push({ itemId: input.itemId, data: input.data });
    },
  };
});

const { appRouter } = await import("./routers");
const { collectAccountOwnedStorageItemsIn } = await import("./db/accountDeletion");
const { boards, boardItems } = await import("../drizzle/schema");
type TransactionHandle = import("./db/connection").TransactionHandle;

function callerFor(userId: number) {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      email: `test${userId}@example.com`,
      name: `Test User ${userId}`,
      loginMethod: "email",
      approved: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function fakeTx(rowsByTable: Map<unknown, unknown[]>): TransactionHandle {
  return {
    select() {
      let table: unknown;
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "limit", "for", "innerJoin", "orderBy"]) {
        chain[method] = () => chain;
      }
      chain.from = (source: unknown) => {
        table = source;
        return chain;
      };
      chain.then = (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(rowsByTable.get(table) ?? []).then(resolve, reject);
      return chain;
    },
  } as unknown as TransactionHandle;
}

/**
 * The rows the erasure would read, built from what the route handed its
 * writers: the board carries the last thumbnailKey written to it (or null),
 * and each item carries the imageKey it was inserted or updated with.
 */
function rowsFromWrites(extraItems: Written[] = []): Map<unknown, unknown[]> {
  let thumbnailKey: unknown = null;
  for (const update of writes.boardUpdates) {
    if ("thumbnailKey" in update.data) thumbnailKey = update.data.thumbnailKey;
  }
  const items: Written[] = writes.itemInserts.map((data, index) => ({
    id: index + 1,
    boardId: BOARD_ID,
    imageKey: (data.imageKey as unknown) ?? null,
  }));
  for (const update of writes.itemUpdates) {
    if ("imageKey" in update.data) {
      items.push({ id: update.itemId, boardId: BOARD_ID, imageKey: update.data.imageKey });
    }
  }
  return new Map<unknown, unknown[]>([
    [boards, [{ id: BOARD_ID, userId: ME, thumbnailKey }]],
    [boardItems, [...items, ...extraItems]],
  ]);
}

async function deletionSet(tables: Map<unknown, unknown[]>): Promise<string[]> {
  const items = await collectAccountOwnedStorageItemsIn(fakeTx(tables), ME, PUBLIC);
  return items.map((item) => item.storageKey);
}

function everyWrittenField(): string[] {
  return [
    ...writes.boardUpdates.flatMap((write) => Object.keys(write.data)),
    ...writes.itemInserts.flatMap((data) => Object.keys(data)),
    ...writes.itemUpdates.flatMap((write) => Object.keys(write.data)),
  ];
}

/** The four attacks, one per writer that took a client key. */
const ATTACKS: Array<[string, () => Promise<unknown>]> = [
  ["boards.update (thumbnailKey)", () =>
    callerFor(ME).boards.update({ boardId: BOARD_ID, thumbnailKey: STOLEN } as never)],
  ["boards.addItem (imageKey)", () =>
    callerFor(ME).boards.addItem({ boardId: BOARD_ID, type: "reference", imageKey: STOLEN } as never)],
  ["boards.addItems (imageKey)", () =>
    callerFor(ME).boards.addItems({
      boardId: BOARD_ID,
      items: [{ type: "reference", imageKey: STOLEN }],
    } as never)],
  ["boards.updateItem (imageKey)", () =>
    callerFor(ME).boards.updateItem({ itemId: 5, imageKey: STOLEN } as never)],
];

beforeEach(() => {
  writes.boardUpdates.length = 0;
  writes.itemInserts.length = 0;
  writes.itemUpdates.length = 0;
});

describe("a board's storage key is never the client's to name (#2056)", () => {
  for (const [name, attack] of ATTACKS) {
    it(`❌ ${name}: another account's key is refused, nothing is written, and it never reaches the deletion manifest`, async () => {
      await expect(attack()).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(writes.boardUpdates).toEqual([]);
      expect(writes.itemInserts).toEqual([]);
      expect(writes.itemUpdates).toEqual([]);
      expect(await deletionSet(rowsFromWrites())).not.toContain(STOLEN);
    });
  }

  it("✅ every payload the client actually sends still writes", async () => {
    const me = callerFor(ME);
    // BoardPage.tsx: the note (addItem), the rename and the debounced thumbnail
    // (update), the node label and the drag/resize (updateItem);
    // useBoardMutations.ts: archive and rename (update).
    await me.boards.addItem({
      boardId: BOARD_ID, type: "note", label: "", width: 260, height: 150, positionX: 10, positionY: 20,
    });
    await me.boards.update({ boardId: BOARD_ID, name: "Renamed" });
    await me.boards.update({ boardId: BOARD_ID, status: "archived" });
    await me.boards.update({ boardId: BOARD_ID, thumbnailUrl: `${PUBLIC}/x.png` });
    await me.boards.update({ boardId: BOARD_ID, thumbnailUrl: null });
    await me.boards.updateItem({ itemId: 5, label: "character 1" });
    await me.boards.updateItem({ itemId: 5, positionX: 1, positionY: 2 });
    await me.boards.updateItem({ itemId: 5, width: 300, height: 400 });
    await me.boards.addItems({ boardId: BOARD_ID, items: [{ type: "note", label: "a" }] });

    expect(writes.itemInserts).toHaveLength(2);
    expect(writes.itemInserts[0]).toMatchObject({ type: "note", kind: "note", width: 260, height: 150 });
    expect(writes.boardUpdates.map((write) => write.data)).toEqual([
      { name: "Renamed" },
      { status: "archived" },
      { thumbnailUrl: `${PUBLIC}/x.png` },
      { thumbnailUrl: null },
    ]);
    expect(writes.itemUpdates.map((write) => write.data)).toEqual([
      { label: "character 1" },
      { positionX: 1, positionY: 2 },
      { width: 300, height: 400 },
    ]);
  });

  it("✅ a bundle that still sends the key as null is accepted, and the null is dropped rather than written", async () => {
    const me = callerFor(ME);
    await me.boards.update({ boardId: BOARD_ID, name: "n", thumbnailKey: null });
    await me.boards.addItem({ boardId: BOARD_ID, type: "note", imageKey: null });
    await me.boards.addItems({ boardId: BOARD_ID, items: [{ type: "note", imageKey: null }] });
    await me.boards.updateItem({ itemId: 5, label: "l", imageKey: null });
    expect(writes.itemInserts).toHaveLength(2);
    expect(everyWrittenField()).not.toContain("imageKey");
    expect(everyWrittenField()).not.toContain("thumbnailKey");
  });

  it("✅ instrument: the collector DOES delete a board item's key a server writer recorded", async () => {
    // Without this arm the negative arms' absence would pass against a
    // collector that never read board items at all.
    const keys = await deletionSet(rowsFromWrites([
      { id: 99, boardId: BOARD_ID, imageKey: SERVER_WRITTEN_OWN },
    ]));
    expect(keys).toContain(SERVER_WRITTEN_OWN);
    // …and a planted foreign key on a row IS still authority to the erasure —
    // the reason the guard has to sit at the input, and the remainder filed
    // on #2056 for the erasure side.
    const planted = await deletionSet(rowsFromWrites([
      { id: 98, boardId: BOARD_ID, imageKey: STOLEN },
    ]));
    expect(planted).toContain(STOLEN);
  });
});
