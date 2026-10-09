/**
 * #2104 — deleting a wardrobe session hands its try-on history back to the
 * cleanup worker, unless something the account keeps still names a picture.
 *
 * Since #1980 a try-on result is ADOPTED out of its scratch manifest into
 * `wardrobe_sessions.history`, so the session row was the only thing naming it.
 * Deleting the session (by hand, or through the four-session cap) left the
 * picture at a permanently public URL that neither the worker nor the account
 * erasure could reach. `releaseSessionPhotosAndDeleteIn` now returns each such
 * picture to the worker — one single-object manifest each, through #2103's
 * `returnWardrobeScratchKeyIn` — unless a Look, an Outfit, a garment or a
 * surviving session still names it.
 *
 * #2108 — the same rule at `updateSession`: a history REPLACED by a shorter
 * one hands each dropped picture back, through the same two helpers, unless
 * something (this session's new history among it) still names it.
 *
 * ⚠ **WHAT IS PROVEN HERE AND WHAT IS NOT.** These arms drive the real
 * `deleteSession` / `capUserSessions` over a transaction that answers each
 * table with chosen rows, and record what is handed back. The owner scope and
 * the locks themselves cannot be proven against a fake handle; they are driven
 * against the dev database by the PR's disposable script, whose tally the PR
 * body records.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = 7;
const PUBLIC = "https://pub-test.r2.dev";

const fake = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[][]>(),
  reads: new Map<unknown, number>(),
  deletes: [] as unknown[],
  /** Every write, in order, with the step at which it ran (#2108). */
  updates: [] as { table: unknown; set: unknown; step: number }[],
  step: 0,
}));

vi.mock("../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/connection")>();
  return {
    ...actual,
    withTransaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(fakeTx())),
    getDb: vi.fn(async () => fakeTx()),
  };
});

vi.mock("./scratchUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scratchUpload")>();
  return {
    ...actual,
    returnWardrobeScratchKeyIn: vi.fn(async () => "returned-batch"),
    putWardrobeScratchUpload: vi.fn(async (input: { key: string }) => ({
      url: `${PUBLIC}/${input.key}`,
      key: input.key,
      cleanupBatchId: `batch-for:${input.key}`,
    })),
  };
});

/**
 * A transaction whose reads answer per table, in order: the first read of a
 * table takes the first row set given for it, and every later read the last.
 * The count is shared by every handle, so the cap's own listing (outside the
 * transaction) and the reads inside it are one sequence.
 */
function fakeTx() {
  const reads = fake.reads;
  return {
    select() {
      let table: unknown;
      const chain: Record<string, unknown> = {};
      for (const method of ["where", "limit", "for", "innerJoin", "orderBy"]) chain[method] = () => chain;
      chain.from = (source: unknown) => {
        table = source;
        return chain;
      };
      chain.then = (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) => {
        fake.step += 1;
        const sets = fake.rows.get(table) ?? [[]];
        const at = reads.get(table) ?? 0;
        reads.set(table, at + 1);
        return Promise.resolve(sets[Math.min(at, sets.length - 1)]).then(resolve, reject);
      };
      return chain;
    },
    update(table: unknown) {
      return {
        set: (values: unknown) => ({
          where: async () => {
            fake.step += 1;
            fake.updates.push({ table, set: values, step: fake.step });
            return [{ affectedRows: 1 }];
          },
        }),
      };
    },
    delete(table: unknown) {
      return {
        where: async () => {
          fake.deletes.push(table);
          return [{ affectedRows: 1 }];
        },
      };
    },
  };
}

import {
  capUserSessions,
  deleteSession,
  tryOnResultKeysIn,
  updateSession,
  wardrobeTryOnResultKeyPrefix,
} from "../db/wardrobe";
import { withTransaction } from "../db/connection";
import { returnWardrobeScratchKeyIn } from "./scratchUpload";
import { uploadTryOnResult } from "./utils";
import { wardrobeGarments, wardrobeLooks, wardrobeOutfits, wardrobeSessions } from "../../drizzle/schema";

const tryOn = (name: string, owner = ME) => `${wardrobeTryOnResultKeyPrefix(owner)}1700000000000-${name}.png`;
const url = (key: string) => `${PUBLIC}/${key}`;
/** A Cast-backed photo — never under the model-photo prefix, so the photo half stays silent. */
const CAST_PHOTO = url("casting-v2/candidates/6f1c2b9e-3a4d-4e5f-8a7b-0c1d2e3f4a5b.png");

function session(id: number, history: unknown, modelImageUrl = CAST_PHOTO) {
  return { id, userId: ME, modelImageUrl, history };
}

function returnedKeys(): string[] {
  return vi.mocked(returnWardrobeScratchKeyIn).mock.calls.map(([, input]) => input.storageKey);
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.rows.clear();
  fake.reads.clear();
  fake.deletes.length = 0;
  fake.updates.length = 0;
  fake.step = 0;
});

describe("#2104 — a deleted session's try-on history goes back to the worker", () => {
  it("✅ the CARD'S ARMS: a picture also saved as a Look is kept; one not saved is queued for collection", async () => {
    const saved = tryOn("saved-as-look");
    const unsaved = tryOn("never-saved");
    const doomed = session(91, [url(saved), url(unsaved)]);
    fake.rows.set(wardrobeSessions, [[doomed], [doomed]]);
    fake.rows.set(wardrobeLooks, [[{ imageUrl: url(saved) }]]);

    await deleteSession(91, ME, PUBLIC);

    expect(returnedKeys()).toEqual([unsaved]);
    expect(vi.mocked(returnWardrobeScratchKeyIn).mock.calls[0][1]).toEqual({ userId: ME, storageKey: unsaved });
    /* And the session row itself still goes. */
    expect(fake.deletes).toEqual([wardrobeSessions]);
  });

  it("✅ a history stored as JSON text (how mysql2 may hand it back) is read the same", async () => {
    const pic = tryOn("json-text");
    const doomed = session(91, JSON.stringify([url(pic)]));
    fake.rows.set(wardrobeSessions, [[doomed], [doomed]]);
    await deleteSession(91, ME, PUBLIC);
    expect(returnedKeys()).toEqual([pic]);
  });

  it("❌ an Outfit naming the picture by its KEY keeps it", async () => {
    const pic = tryOn("outfit-key");
    const doomed = session(91, [url(pic)]);
    fake.rows.set(wardrobeSessions, [[doomed], [doomed]]);
    fake.rows.set(wardrobeOutfits, [[{ resultThumbUrl: null, resultThumbKey: pic }]]);
    await deleteSession(91, ME, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ an Outfit naming the picture by its URL keeps it", async () => {
    const pic = tryOn("outfit-url");
    const doomed = session(91, [url(pic)]);
    fake.rows.set(wardrobeSessions, [[doomed], [doomed]]);
    fake.rows.set(wardrobeOutfits, [[{ resultThumbUrl: url(pic), resultThumbKey: null }]]);
    await deleteSession(91, ME, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ a garment naming the picture keeps it", async () => {
    const pic = tryOn("garment");
    const doomed = session(91, [url(pic)]);
    fake.rows.set(wardrobeSessions, [[doomed], [doomed]]);
    fake.rows.set(wardrobeGarments, [[{
      originalImageKey: null, originalImageUrl: url(pic),
      isolatedImageKey: null, isolatedImageUrl: null,
      sourceImageKey: null, sourceImageUrl: null,
    }]]);
    await deleteSession(91, ME, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ a session that SURVIVES the delete and names the picture keeps it", async () => {
    const shared = tryOn("shared");
    const mine = tryOn("only-mine");
    const doomed = session(91, [url(shared), url(mine)]);
    const survivor = session(92, [url(shared)]);
    fake.rows.set(wardrobeSessions, [[doomed], [doomed, survivor]]);
    await deleteSession(91, ME, PUBLIC);
    expect(returnedKeys()).toEqual([mine]);
  });

  it("❌ nothing outside this account's own try-on folder is ever handed to the worker", async () => {
    const doomed = session(91, [
      url(tryOn("theirs", 77)),
      url(tryOn("account-12", 12)),
      url(`wardrobe/${ME}/flat-lays/1700000000000-f.png`),
      url(`${ME}-wardrobe/garment/a.png`),
      "https://files.manuscdn.com/" + tryOn("legacy"),
      CAST_PHOTO,
      "not a url",
      42,
    ]);
    fake.rows.set(wardrobeSessions, [[doomed], [doomed]]);
    await deleteSession(91, ME, PUBLIC);
    expect(returnedKeys()).toEqual([]);
    expect(fake.deletes).toEqual([wardrobeSessions]);
  });

  it("✅ the cap: a picture in two doomed histories is handed back ONCE, and a survivor's is not", async () => {
    const both = tryOn("in-both-doomed");
    const kept = tryOn("survivor-has-it");
    const live = [1, 2, 3, 4].map((id) => session(id, id === 1 ? [url(kept)] : []));
    const old = [session(5, [url(both), url(kept)]), session(6, [url(both)])];
    /* The cap's own listing, then the doomed read, then every session. */
    fake.rows.set(wardrobeSessions, [[...live, ...old], old, [...live, ...old]]);
    await capUserSessions(ME, PUBLIC);
    expect(returnedKeys()).toEqual([both]);
  });
});

describe("#2104 — the folder is the writer's, and ownership is the account's", () => {
  it("✅ the key `uploadTryOnResult` mints sits under the prefix the release reads", async () => {
    const { url: written } = await uploadTryOnResult("data:image/png;base64,aGVsbG8=", String(ME));
    const key = written.slice(PUBLIC.length + 1);
    expect(key.startsWith(wardrobeTryOnResultKeyPrefix(ME))).toBe(true);
    expect(tryOnResultKeysIn([[written]], { userId: ME, currentPublicUrl: PUBLIC })).toEqual(new Set([key]));
  });

  it("❌ account 1's prefix does not own account 12's try-on", () => {
    const twelves = tryOn("x", 12);
    expect(tryOnResultKeysIn([[url(twelves)]], { userId: 1, currentPublicUrl: PUBLIC })).toEqual(new Set());
    expect(tryOnResultKeysIn([[url(twelves)]], { userId: 12, currentPublicUrl: PUBLIC })).toEqual(new Set([twelves]));
  });

  it("❌ a history that is not an array, or is null, names nothing", () => {
    expect(tryOnResultKeysIn([null, "{}", "not json", { a: 1 }], { userId: ME, currentPublicUrl: PUBLIC })).toEqual(new Set());
  });
});

describe("#2108 — a history update that DROPS a try-on hands it back to the worker", () => {
  /** The session row before the write, then as every later read sees it. */
  function rows(before: unknown, after: unknown) {
    fake.rows.set(wardrobeSessions, [[session(91, before)], [session(91, after)]]);
  }

  it("✅ the CARD'S ARM: a picture dropped from the history, and named by nothing, is queued for collection", async () => {
    const kept = tryOn("still-in-history");
    const dropped = tryOn("dropped");
    rows([url(kept), url(dropped)], [url(kept)]);

    await updateSession(91, ME, { history: [url(kept)], historyIndex: 0 }, PUBLIC);

    expect(returnedKeys()).toEqual([dropped]);
    expect(vi.mocked(returnWardrobeScratchKeyIn).mock.calls[0][1]).toEqual({ userId: ME, storageKey: dropped });
    /* And the write itself landed, whole. */
    expect(fake.updates.map((u) => [u.table, u.set])).toEqual([
      [wardrobeSessions, { history: [url(kept)], historyIndex: 0 }],
    ]);
  });

  it("✅ the keepers are read AFTER the write, inside the same transaction as the lock", async () => {
    const dropped = tryOn("dropped");
    rows([url(dropped)], []);
    await updateSession(91, ME, { history: [] }, PUBLIC);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    const write = fake.updates[0].step;
    /* Read 1 is the locked before-row; every keeper read follows the write. */
    expect(write).toBe(2);
    expect(fake.step).toBeGreaterThan(write);
    expect(returnedKeys()).toEqual([dropped]);
  });

  it("❌ a picture the NEW history still carries is kept — even spelled another way", async () => {
    const pic = tryOn("respelled");
    /* A query string and an upper-case host name the same object on the bucket. */
    const respelled = `${url(pic).replace("pub-test", "PUB-TEST")}?v=2`;
    rows([url(pic)], [respelled]);
    await updateSession(91, ME, { history: [respelled] }, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ a dropped picture saved as a Look is kept", async () => {
    const pic = tryOn("saved");
    rows([url(pic)], []);
    fake.rows.set(wardrobeLooks, [[{ imageUrl: url(pic) }]]);
    await updateSession(91, ME, { history: [] }, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ a dropped picture another session still names is kept", async () => {
    const pic = tryOn("shared");
    fake.rows.set(wardrobeSessions, [[session(91, [url(pic)])], [session(91, []), session(92, [url(pic)])]]);
    await updateSession(91, ME, { history: [] }, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ a dropped picture outside this account's try-on folder is never handed back", async () => {
    rows([url(tryOn("theirs", 77)), url(`wardrobe/${ME}/flat-lays/1700000000000-f.png`), CAST_PHOTO, "not a url"], []);
    await updateSession(91, ME, { history: [] }, PUBLIC);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ not this account's session: nothing is written and nothing handed back", async () => {
    fake.rows.set(wardrobeSessions, [[]]);
    await updateSession(91, ME, { history: [] }, PUBLIC);
    expect(fake.updates).toEqual([]);
    expect(returnedKeys()).toEqual([]);
  });

  it("❌ a write that does not touch the history hands nothing back and opens no transaction", async () => {
    rows([url(tryOn("untouched"))], [url(tryOn("untouched"))]);
    await updateSession(91, ME, { historyIndex: 0 }, PUBLIC);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(fake.updates.map((u) => u.set)).toEqual([{ historyIndex: 0 }]);
    expect(returnedKeys()).toEqual([]);
  });
});
