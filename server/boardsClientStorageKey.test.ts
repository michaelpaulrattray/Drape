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
 *   · POSITIVE (the instrument): the same collector really reads a board item
 *     the routes wrote — without it, the negative arm's absence would prove
 *     nothing.
 *
 * THE ERASURE HALF (the second #2056 PR): a row ALREADY carrying a
 * client-typed key from before the route guard is no longer deletion
 * authority either. `collectAccountOwnedStorageItemsIn` skips and logs both
 * board key columns (`skipUnownedBoardKey`), and Cast deletion's canvas
 * reads stop reading `board_items.imageKey` (`collectCanvasCleanupKeysIn`).
 * Its arms are the second `describe` below, and the reason the rule is
 * "skip" rather than "accept under this account's prefix" is read at the
 * writers in its last arm: no server writer has ever stored a key in either
 * column, so the set of prefixes to accept is empty.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withoutComments } from "./testing/withoutComments";
import type { TrpcContext } from "./_core/context";

const ME = 41;
const OTHER = 77;
const BOARD_ID = 9001;
const PUBLIC = "https://pub-test.r2.dev";
/** A real cast-picture key shape belonging to ANOTHER account. */
const STOLEN = `castingv2/${OTHER}/candidates/abc-0001.png`;
/**
 * Another account's cast picture in the REAL shape its writer uses
 * (`rollService.ts`: `${CANDIDATE_KEY_PREFIX}/${randomUUID()}.${extension}`)
 * — no account id anywhere in it, which is why no prefix rule could own it.
 */
const OTHERS_CAST_KEY = "casting-v2/candidates/6f1c2b9e-3a4d-4e5f-8a7b-0c1d2e3f4a5b.png";
/** This account's own wardrobe picture, under the prefix its writers use. */
const OWN_WARDROBE_KEY = `wardrobe/${ME}/flat-lays/1700000000000-own.png`;
const serverRoot = import.meta.dirname;

/** What `db/accountDeletion`'s logger was asked to warn about. */
const erasureWarnings = vi.hoisted(() => [] as unknown[][]);
/** What `casting/finalCastDeletion`'s logger was asked to warn about (#2062). */
const castDeletionWarnings = vi.hoisted(() => [] as unknown[][]);
vi.mock("./logging/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./logging/logger")>();
  return {
    ...actual,
    createModuleLogger: (module: string) => {
      const child = actual.createModuleLogger(module);
      const sink = module === "db/accountDeletion"
        ? erasureWarnings
        : module === "casting/finalCastDeletion"
          ? castDeletionWarnings
          : null;
      if (!sink) return child;
      return new Proxy(child, {
        get(target, property, receiver) {
          if (property === "warn") return (...args: unknown[]) => { sink.push(args); };
          return Reflect.get(target, property, receiver);
        },
      });
    },
  };
});

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
const { collectCanvasCleanupKeysIn } = await import("./casting/finalCastDeletion");
const { boards, boardItems, boardItemVersions, models, modelAssets, wardrobeGarments } = await import("../drizzle/schema");
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
    correlationId: "test-2056",
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
  erasureWarnings.length = 0;
  castDeletionWarnings.length = 0;
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

  it("✅ instrument: the collector really reads a board item the routes wrote", async () => {
    // Without this arm the negative arms' absence would pass against a
    // collector that never read board items at all: a key planted on a row
    // beside the one the route wrote IS read — and is answered with a
    // warning, never a delete.
    await callerFor(ME).boards.addItem({ boardId: BOARD_ID, type: "note" });
    const keys = await deletionSet(rowsFromWrites([{ id: 99, boardId: BOARD_ID, imageKey: STOLEN }]));
    expect(keys).not.toContain(STOLEN);
    expect(erasureWarnings).toHaveLength(1);
  });
});

/*
  THE ERASURE HALF — rows written BEFORE the route guard.

  Every arm runs the REAL collectors (`collectAccountOwnedStorageItemsIn`,
  `collectCanvasCleanupKeysIn`) over a transaction that answers each table's
  read with the rows given, and asserts on the deletion set they return.
*/
describe("a board key already on a row is never deletion authority (#2056, erasure)", () => {
  it("❌ another account's cast key on this account's board thumbnail and item is NOT in the manifest", async () => {
    const keys = await deletionSet(new Map<unknown, unknown[]>([
      [boards, [{ id: BOARD_ID, userId: ME, thumbnailKey: OTHERS_CAST_KEY }]],
      [boardItems, [{ id: 7, boardId: BOARD_ID, imageKey: OTHERS_CAST_KEY }]],
    ]));
    expect(keys).not.toContain(OTHERS_CAST_KEY);
    expect(keys).toEqual([]);
  });

  it("✅ the skip is logged with where it was — board, item, column — and never the key", async () => {
    await deletionSet(new Map<unknown, unknown[]>([
      [boards, [
        { id: BOARD_ID, userId: ME, thumbnailKey: OTHERS_CAST_KEY },
        { id: 2, userId: ME, thumbnailKey: null },
      ]],
      [boardItems, [
        { id: 7, boardId: BOARD_ID, imageKey: OTHERS_CAST_KEY },
        { id: 8, boardId: BOARD_ID, imageKey: null },
        { id: 9, boardId: BOARD_ID, imageKey: "" },
      ]],
    ]));
    // One warning per non-empty key: a null or empty column is not news.
    expect(erasureWarnings.map(([fields]) => fields)).toEqual([
      { userId: ME, boardId: BOARD_ID, column: "boards.thumbnailKey" },
      { userId: ME, boardId: BOARD_ID, itemId: 7, column: "board_items.imageKey" },
    ]);
    expect(JSON.stringify(erasureWarnings)).not.toContain(OTHERS_CAST_KEY);
  });

  it("✅ positive: this account's own picture on its board still goes — through the row that proves it is hers", async () => {
    // The control "a server-written board key IS in the manifest" cannot be
    // built: no server writer has ever stored one (the last arm reads the
    // writers). What the skip could cost is a picture the account owns, and
    // that arrives through its own road — here, its garment.
    const keys = await deletionSet(new Map<unknown, unknown[]>([
      [wardrobeGarments, [{
        id: 1,
        userId: ME,
        originalImageUrl: `${PUBLIC}/${OWN_WARDROBE_KEY}`,
        originalImageKey: OWN_WARDROBE_KEY,
        isolatedImageUrl: null,
        isolatedImageKey: null,
        sourceImageUrl: null,
        sourceImageKey: null,
      }]],
      [boards, [{ id: BOARD_ID, userId: ME, thumbnailKey: OWN_WARDROBE_KEY }]],
      [boardItems, [{ id: 7, boardId: BOARD_ID, imageKey: OWN_WARDROBE_KEY }]],
    ]));
    expect(keys).toEqual([OWN_WARDROBE_KEY]);
  });

  it("❌ Cast deletion's canvas read: another account's key on an item linked to the Cast is NOT collected, its URL still is", async () => {
    const modelId = 501;
    const ownUrlKey = `models/${ME}/head.png`;
    const storageKeys = new Set<string>();
    await collectCanvasCleanupKeysIn({
      // #2062: the URL counts because it is one of this Cast's own pictures.
      castOwnedKeys: new Set([ownUrlKey]),
      tx: fakeTx(new Map<unknown, unknown[]>([
        [boardItems, [{
          id: 7,
          sourceModelId: modelId,
          imageUrl: `${PUBLIC}/${ownUrlKey}`,
          imageKey: OTHERS_CAST_KEY,
          metadata: {},
        }]],
      ])),
      modelId,
      assetUrls: [],
      storageKeys,
      currentPublicUrl: PUBLIC,
    });
    expect([...storageKeys]).toEqual([ownUrlKey]);
  });

  it("❌ Cast deletion's second canvas read never names an item's imageKey either", () => {
    // The linked-item branch inside the deletion transaction is driven only by
    // `r7-final-cast-deletion-db.test.ts`, which needs a disposable database
    // and skips without one — so this reads the code for the same sentence
    // the driven arm above proves on `collectCanvasCleanupKeysIn`.
    const code = withoutComments(readFileSync(join(serverRoot, "casting/finalCastDeletion.ts"), "utf8"));
    const reads = [...code.matchAll(/collectCastCanvasKey\([^)]*item\.image(?:Url|Key)[^)]*\)/g)].map((m) => m[0]);
    expect(reads, "the canvas reads were not found — the arm is blind").toHaveLength(2);
    for (const read of reads) expect(read).not.toContain("imageKey");
  });

  it("⚠ the rule is read at the writers: nothing on the server stores a board key but the thumbnail's copy of an item's", () => {
    /*
      "Accept a board key under a prefix this account's writers use" reduces
      to "accept none" only while the writers are what this arm says. It reads
      every server module and lists each literal `thumbnailKey:` / `imageKey:` inside a
      statement that WRITES a board table — a raw `insert`/`update` of it, or
      a call to a db helper that does — other than a `null`. A new writer reddens this
      arm, and its keys then need an account-scoped prefix and a rule in
      `skipUnownedBoardKey` before the erasure may trust them. Its limit,
      stated: a key arriving through a SPREAD (`.values(data)`) is not a
      literal, and the route arms in the first describe drive that road.
    */
    const files = (readdirSync(serverRoot, { recursive: true, encoding: "utf8" }) as string[])
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    const found: string[] = [];
    const statementFiles = new Set<string>();
    // The board db helpers, DERIVED from the module that declares them rather
    // than listed here: every exported function of `server/db/boards.ts`.
    const helpers = [...withoutComments(readFileSync(join(serverRoot, "db/boards.ts"), "utf8"))
      .matchAll(/^export (?:async )?function (\w+)/gm)].map((match) => match[1]!);
    expect(helpers, "the board helpers were not found — the arm is blind").toEqual(
      expect.arrayContaining(["createBoard", "updateBoard", "addBoardItem", "updateBoardItemIn", "placeLinkedBoardItem"]),
    );
    // Every statement that writes a board table: a raw insert/update of it,
    // or a call to one of those helpers (read to the end of its `;`).
    const writers = new RegExp(
      `\\.(?:insert|update)\\(\\s*(?:boards|boardItems)\\s*\\)|\\b(?:${helpers.join("|")})\\(`,
      "g",
    );
    for (const file of files) {
      const code = withoutComments(readFileSync(join(serverRoot, file), "utf8"));
      for (const statement of code.matchAll(writers)) {
        const end = code.indexOf(";", statement.index!);
        const body = code.slice(statement.index!, end === -1 ? undefined : end);
        statementFiles.add(file);
        for (const match of body.matchAll(/\b(thumbnailKey|imageKey)\s*:\s*([^,\n})]+)/g)) {
          const value = match[2]!.trim();
          if (value === "null") continue;
          found.push(`${file.replace(/\\/g, "/")} ${match[1]}: ${value}`);
        }
      }
    }
    // db/boards.ts, lib/boardOps.ts, routes/boards.ts and casting/finalCastDeletion.ts at least.
    expect(statementFiles.size, "too few board-writing modules were found — the arm is blind").toBeGreaterThan(3);
    expect(found).toEqual([
      "casting/finalCastDeletion.ts thumbnailKey: newest?.imageKey ?? null",
    ]);
  });
});

/*
  THE URL HALF (#2062) — a board item's `imageUrl` is not the client's to name,
  and an address already on a row is deletion authority only when it is one of
  the Cast's own pictures.

  The attack: put ANOTHER account's cast picture address (public) on an item
  linked to your own Cast, then delete the Cast. Before #2062 the address
  became a key in YOUR Cast's deletion manifest. Both halves are driven here:
  the REAL router for the input, and the REAL collectors — Cast deletion's
  `collectCanvasCleanupKeysIn` and the account erasure's
  `collectAccountOwnedStorageItemsIn` — for the manifests.
*/
describe("a board item's picture address is never deletion authority on its own (#2062)", () => {
  const modelId = 501;
  /** This Cast's own picture, as its writer stores it (`uploadRawCandidate`). */
  const OWN_CAST_KEY = "casting/1700000000000-0b7d4c1e-2f3a-4b5c-9d8e-7f6a5b4c3d2e.png";
  const OWN_CAST_URL = `${PUBLIC}/${OWN_CAST_KEY}`;
  const OTHERS_CAST_URL = `${PUBLIC}/${OTHERS_CAST_KEY}`;

  const URL_ATTACKS: Array<[string, () => Promise<unknown>]> = [
    ["boards.addItem", () =>
      callerFor(ME).boards.addItem({ boardId: BOARD_ID, type: "model", sourceModelId: modelId, imageUrl: OTHERS_CAST_URL } as never)],
    ["boards.addItems", () =>
      callerFor(ME).boards.addItems({
        boardId: BOARD_ID,
        items: [{ type: "model", sourceModelId: modelId, imageUrl: OTHERS_CAST_URL }],
      } as never)],
    ["boards.updateItem", () =>
      callerFor(ME).boards.updateItem({ itemId: 5, imageUrl: OTHERS_CAST_URL } as never)],
  ];

  for (const [name, attack] of URL_ATTACKS) {
    it(`❌ ${name}: another account's picture address is refused and nothing is written`, async () => {
      await expect(attack()).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(writes.itemInserts).toEqual([]);
      expect(writes.itemUpdates).toEqual([]);
    });
  }

  it("✅ a bundle that still sends imageUrl as null is accepted, and the null is dropped rather than written", async () => {
    const me = callerFor(ME);
    await me.boards.addItem({ boardId: BOARD_ID, type: "note", imageUrl: null });
    await me.boards.addItems({ boardId: BOARD_ID, items: [{ type: "note", imageUrl: null }] });
    await me.boards.updateItem({ itemId: 5, label: "l", imageUrl: null });
    expect(writes.itemInserts).toHaveLength(2);
    expect(writes.itemUpdates.map((write) => write.data)).toEqual([{ label: "l" }]);
    expect(everyWrittenField()).not.toContain("imageUrl");
  });

  async function castManifest(rows: Map<unknown, unknown[]>, castOwnedKeys: string[]): Promise<string[]> {
    const storageKeys = new Set<string>(castOwnedKeys);
    await collectCanvasCleanupKeysIn({
      tx: fakeTx(rows),
      modelId,
      assetUrls: [OWN_CAST_URL],
      storageKeys,
      castOwnedKeys: new Set(castOwnedKeys),
      currentPublicUrl: PUBLIC,
    });
    return [...storageKeys].sort();
  }

  it("❌ Cast deletion: another account's picture on an item and a version linked to this Cast is NOT in the manifest", async () => {
    const keys = await castManifest(new Map<unknown, unknown[]>([
      [boardItems, [{ id: 7, sourceModelId: modelId, imageUrl: OTHERS_CAST_URL, imageKey: null, metadata: {} }]],
      [boardItemVersions, [{ itemId: 7, imageUrl: OTHERS_CAST_URL }]],
    ]), [OWN_CAST_KEY]);
    expect(keys).not.toContain(OTHERS_CAST_KEY);
    expect(keys).toEqual([OWN_CAST_KEY]);
  });

  it("✅ Cast deletion: this Cast's own picture on its canvas item and version is still in the manifest", async () => {
    // Positive control for the arm above: the SAME read, the same rows'
    // shape — only the address differs — and the key IS collected. Started
    // from an empty manifest so the canvas read itself is what puts it there.
    const storageKeys = new Set<string>();
    await collectCanvasCleanupKeysIn({
      tx: fakeTx(new Map<unknown, unknown[]>([
        [boardItems, [{ id: 7, sourceModelId: modelId, imageUrl: OWN_CAST_URL, imageKey: null, metadata: {} }]],
        [boardItemVersions, [{ itemId: 7, imageUrl: OWN_CAST_URL }]],
      ])),
      modelId,
      assetUrls: [OWN_CAST_URL],
      storageKeys,
      castOwnedKeys: new Set([OWN_CAST_KEY]),
      currentPublicUrl: PUBLIC,
    });
    expect([...storageKeys]).toEqual([OWN_CAST_KEY]);
    expect(castDeletionWarnings).toEqual([]);
  });

  it("✅ the skip is logged with where it was — Cast, item, column — and never the key; another origin stays silent", async () => {
    await castManifest(new Map<unknown, unknown[]>([
      [boardItems, [
        { id: 7, sourceModelId: modelId, imageUrl: OTHERS_CAST_URL, imageKey: null, metadata: {} },
        { id: 8, sourceModelId: modelId, imageUrl: "https://elsewhere.example/x.png", imageKey: null, metadata: {} },
      ]],
      [boardItemVersions, [{ itemId: 7, imageUrl: OTHERS_CAST_URL }]],
    ]), [OWN_CAST_KEY]);
    expect(castDeletionWarnings.map(([fields]) => fields)).toEqual([
      { modelId, itemId: 7, column: "board_items.imageUrl" },
      { modelId, itemId: 7, column: "board_item_versions.imageUrl" },
    ]);
    expect(JSON.stringify(castDeletionWarnings)).not.toContain(OTHERS_CAST_KEY);
  });

  it("❌ account erasure: another account's picture address on this account's board item is NOT in the manifest; its own Cast's picture is", async () => {
    const items = await collectAccountOwnedStorageItemsIn(fakeTx(new Map<unknown, unknown[]>([
      [models, [{ id: modelId }]],
      [modelAssets, [{ storageKey: OWN_CAST_KEY, storageUrl: OWN_CAST_URL }]],
      [boards, [{ id: BOARD_ID, userId: ME, thumbnailKey: null, thumbnailUrl: OTHERS_CAST_URL }]],
      [boardItems, [{ id: 7, boardId: BOARD_ID, imageKey: null, imageUrl: OTHERS_CAST_URL, sourceModelId: modelId }]],
      [boardItemVersions, [{ itemId: 7, imageUrl: OTHERS_CAST_URL }]],
    ])), ME, PUBLIC);
    const keys = items.map((item) => item.storageKey);
    expect(keys).not.toContain(OTHERS_CAST_KEY);
    expect(keys).toEqual([OWN_CAST_KEY]);
  });

  it("❌ static: neither canvas pass hands a board address to the unchecked collector, and the Cast's own keys are frozen before the canvas is read", () => {
    // The second pass (`deleteCanvasDependenciesIn`, inside the deletion) is
    // driven only by `r7-final-cast-deletion-db.test.ts`, which needs a
    // disposable database and skips without one — so this reads the code.
    const code = withoutComments(readFileSync(join(serverRoot, "casting/finalCastDeletion.ts"), "utf8"));
    const unchecked = [...code.matchAll(/collectManifestKey\([^;]*?(?:item|version)\.imageUrl[^;]*?\)/g)].map((m) => m[0]);
    expect(unchecked).toEqual([]);
    const checked = [...code.matchAll(/collectCastCanvasKey\([^)]*(?:item|version)\.imageUrl/g)];
    expect(checked, "the canvas reads were not found — the arm is blind").toHaveLength(4);
    const executor = code.slice(code.indexOf("export async function executeFinalCastDeletion"));
    const frozen = executor.indexOf("const castOwnedKeys");
    expect(frozen, "the frozen set was not found — the arm is blind").toBeGreaterThan(0);
    expect(frozen).toBeLessThan(executor.indexOf("await collectCanvasCleanupKeysIn("));
  });
});

/*
  #2064 — a saved look's `imageUrl` and a session's `history` are typed by the
  browser (`looks.save`, `sessions.update`), so on the Cast deletion they are
  deletion authority only under THIS account's wardrobe prefixes, and they are
  added only AFTER the Cast's own keys are frozen for the canvas check.
*/
const { collectCastWardrobeKeys } = await import("./casting/finalCastDeletion");

describe("a wardrobe address linked to a Cast is never deletion authority on its own (#2064)", () => {
  const OTHERS_WARDROBE_KEY = `wardrobe/${OTHER}/vto-results/1700000000000-theirs.png`;
  const OWN_UPLOAD_KEY = `${ME}-wardrobe/originals/1700000000000-own.png`;
  const OWN_CAST_ASSET_URL = `${PUBLIC}/casting-v2/candidates/11111111-2222-4333-8444-555555555555.png`;

  function collect(sessions: Array<{ modelImageUrl: unknown; history: unknown }>, looks: Array<{ imageUrl: unknown }>) {
    const storageKeys = new Set<string>();
    collectCastWardrobeKeys({
      storageKeys,
      currentPublicUrl: PUBLIC,
      userId: ME,
      assetUrls: [OWN_CAST_ASSET_URL],
      sessions,
      looks,
    });
    return [...storageKeys].sort();
  }

  it("❌ another account's picture on a look and in a session's history linked to this Cast is NOT in the manifest", () => {
    const keys = collect(
      [{ modelImageUrl: `${PUBLIC}/${OTHERS_CAST_KEY}`, history: [`${PUBLIC}/${OTHERS_CAST_KEY}`, `${PUBLIC}/${OTHERS_WARDROBE_KEY}`] }],
      [{ imageUrl: `${PUBLIC}/${OTHERS_CAST_KEY}` }, { imageUrl: `${PUBLIC}/${OTHERS_WARDROBE_KEY}` }],
    );
    expect(keys).toEqual([]);
  });

  it("✅ this account's own wardrobe look and history pictures, and the Cast's own model picture, still are", () => {
    const keys = collect(
      [{ modelImageUrl: OWN_CAST_ASSET_URL, history: JSON.stringify([`${PUBLIC}/${OWN_WARDROBE_KEY}`]) }],
      [{ imageUrl: `${PUBLIC}/${OWN_UPLOAD_KEY}` }, { imageUrl: "https://elsewhere.example/not-ours.png" }],
    );
    expect(keys).toEqual([
      OWN_UPLOAD_KEY,
      "casting-v2/candidates/11111111-2222-4333-8444-555555555555.png",
      OWN_WARDROBE_KEY,
    ].sort());
  });

  it("❌ static: the executor freezes the Cast's own keys BEFORE any wardrobe address, and hands no look or history to the unchecked collector", () => {
    // The executor is driven only by `r7-final-cast-deletion-db.test.ts`,
    // which needs a disposable database and skips without one.
    const code = withoutComments(readFileSync(join(serverRoot, "casting/finalCastDeletion.ts"), "utf8"));
    const unchecked = [...code.matchAll(/collectManifestKey\([^;]*?(?:look\.imageUrl|\.history|entry)[^;]*?\)/g)].map((m) => m[0]);
    expect(unchecked).toEqual([]);
    const executor = code.slice(code.indexOf("export async function executeFinalCastDeletion"));
    const frozen = executor.indexOf("const castOwnedKeys");
    const wardrobe = executor.indexOf("collectCastWardrobeKeys(");
    expect(frozen, "the frozen set was not found — the arm is blind").toBeGreaterThan(0);
    expect(wardrobe, "the wardrobe collector was not found — the arm is blind").toBeGreaterThan(0);
    expect(frozen).toBeLessThan(wardrobe);
    // One copy of the prefix rule: the deletion reuses the erasure's.
    expect(code).toContain("wardrobeOwnedKeyPrefixes(");
    expect(code).not.toMatch(/-wardrobe\//);
  });
});
