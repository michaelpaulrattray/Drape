/**
 * ONE QUERY PER ROW, ALL AT ONCE — the driven arms for #2000 (#1989's siblings).
 *
 * The defect class: a `Promise.all(rows.map(async … await db.select…))` that
 * fires one database read per row, all at once, onto the one shared pool
 * (`connectionLimit: 20`, `queueLimit: 50` in `server/db/connection.ts`). The
 * 71st concurrent query is refused with `Queue limit reached.`, so the whole
 * request fails. #1989 found it in the data export; this card's three
 * siblings, each driven here through its REAL procedure:
 *
 *  - `moderator.getFlaggedReferrals` — a full page (limit 100) was 100
 *    concurrent user lookups.
 *  - `referral.getHistory` — one name lookup per referral, unbounded.
 *  - `boardOps.getSnapshot` — one version count per board item, unbounded.
 *  - `wardrobe` — FIVE reads of one garment per id from input arrays with no
 *    `.max()` on them (the card named four; the sweep found the fifth, a
 *    sequential loop in `outfits.save` that could not trip the ceiling and was
 *    still one round trip per garment). `outfits.save` is the one of the five
 *    that is NOT behind the closed try-on door (#1537), so it is driven here
 *    for real; the other four share its one db reader, which is driven
 *    directly beside it.
 *
 * `castingV2.openSessions` is the card's fifth site and is driven in
 * `server/openSessionCardsBounded.test.ts` — its subject is how many SESSIONS
 * are read at one time rather than the shape of a statement, so its instrument
 * counts calls into the db layer instead of faking a pool.
 *
 * WHY A FAKE CLIENT AND NOT A DATABASE — the same reasoning as
 * `server/gdprExportBounded.test.ts`: `vitest.setup.ts` strips `DATABASE_URL`,
 * so a row-level suite would skip in CI and read green while proving nothing.
 * Real drizzle renders the real statements onto a client that refuses any
 * query arriving while seventy are already outstanding, the way mysql2's pool
 * does at 20 + 50. The fake answers only the statement shapes these three
 * roads send, and THROWS on any other, so a new statement cannot be answered
 * by accident.
 *
 * The first arm proves the instrument CAN fail before any verdict is believed.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** mysql2's pool ceiling as `server/db/connection.ts` configures it: 20 + 50. */
const POOL_CEILING = 70;

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {};
const sent: Array<{ table: string; sql: string; params: unknown[] }> = [];
let inFlight = 0;
let maxInFlight = 0;
let inserted = 0;

function columnsOf(sql: string): string[] {
  const list = sql.slice("select ".length, sql.indexOf(" from `"));
  return list.split(", ").map((part) => {
    const names = [...part.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    return names.length ? names[names.length - 1] : part;
  });
}

function byCreatedDesc(a: Row, b: Row): number {
  return String(b.createdAt).localeCompare(String(a.createdAt));
}

/** The rows a statement reads, as objects keyed by column name. */
function answer(table: string, sql: string, params: unknown[]): Row[] {
  const usersById = new Map((tables.users ?? []).map((u) => [u.id, u]));
  switch (table) {
    case "users": {
      const wanted = new Set<unknown>(params.filter((p) => typeof p === "number"));
      return (tables.users ?? []).filter((u) => wanted.has(u.id));
    }
    case "referrals": {
      if (sql.includes("`sameIpFlag` = ?")) {
        const flagged = (tables.referrals ?? []).filter((r) => r.sameIpFlag).sort(byCreatedDesc);
        if (sql.startsWith("select count(*)")) return [{ "count(*)": flagged.length }];
        // drizzle omits `offset ?` when the offset is 0.
        const limit = params[1] as number;
        const offset = sql.includes(" offset ?") ? (params[2] as number) : 0;
        return flagged.slice(offset, offset + limit);
      }
      if (sql.includes("`referrerUserId` = ?")) {
        return (tables.referrals ?? [])
          .filter((r) => r.referrerUserId === params[0])
          .sort(byCreatedDesc)
          .map((r) => ({ ...r, name: usersById.get(r.referredUserId)?.name ?? null }));
      }
      break;
    }
    case "wardrobe_garments": {
      /* The owner is in the statement, so the fake honours it rather than
         handing back every row and letting the caller filter — an instrument
         that ignores the WHERE cannot see invariant 1 break. */
      const owner = params[0];
      const wanted = new Set(params.slice(1));
      return (tables.wardrobe_garments ?? []).filter(
        (g) => g.userId === owner && wanted.has(g.id),
      );
    }
    case "boards":
      return (tables.boards ?? []).filter((b) => b.id === params[0]);
    case "board_items":
      return (tables.board_items ?? []).filter((i) => i.boardId === params[0] && !i.deletedAt);
    case "board_edges":
      return (tables.board_edges ?? []).filter((e) => e.boardId === params[0]);
    case "board_item_versions": {
      const versions = tables.board_item_versions ?? [];
      if (sql.includes("group by")) {
        const onBoard = new Set(
          (tables.board_items ?? []).filter((i) => i.boardId === params[0]).map((i) => i.id),
        );
        const counts = new Map<unknown, number>();
        for (const v of versions) {
          if (onBoard.has(v.itemId)) counts.set(v.itemId, (counts.get(v.itemId) ?? 0) + 1);
        }
        return [...counts].map(([itemId, count]) => ({ itemId, "count(*)": count }));
      }
      if (sql.startsWith("select count(*)")) {
        return [{ "count(*)": versions.filter((v) => v.itemId === params[0]).length }];
      }
      break;
    }
  }
  throw new Error(`fake pool has no answer for: ${sql}`);
}

const fakeClient = {
  async query(q: { sql: string } | string, params: unknown[] = []) {
    const sql = typeof q === "string" ? q : q.sql;
    const table = /from `([^`]+)`/.exec(sql)?.[1] ?? "?";
    sent.push({ table, sql, params });
    if (inFlight >= POOL_CEILING) {
      throw new Error("Queue limit reached.");
    }
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2));
      /* One write road reaches this fake — `outfits.save`'s insert, which the
         read under test guards. It answers like mysql2's ResultSetHeader so
         `$returningId()` has an id, and nothing here asserts on that id. */
      if (sql.startsWith("insert into ")) {
        inserted += 1;
        return [{ insertId: 9_000 + inserted, affectedRows: 1 }, []];
      }
      if (table === "?") return [[], []];
      const cols = columnsOf(sql);
      const rows = answer(table, sql, params);
      return [rows.map((row) => cols.map((c) => row[c] ?? null)), []];
    } finally {
      inFlight--;
    }
  },
};

const fakeDb = drizzle({ client: fakeClient as never });

vi.mock("./db/connection", () => ({
  getDb: async () => fakeDb,
  withTransaction: async () => {
    throw new Error("no transactions on the read roads under test");
  },
}));
vi.mock("./auditLog", () => ({ logAuditEvent: async () => undefined }));

const { moderatorRouter } = await import("./routes/moderator");
const { referralRouter } = await import("./routes/referral");
const { boardOpsRouter } = await import("./routes/boardOps");
const { wardrobeRouter } = await import("./routes/wardrobe");
const { FLAGGED_REFERRAL_USER_CHUNK } = await import("./db/moderatorQueries");
const { GARMENT_BATCH_CHUNK, getOwnedGarmentsByIds } = await import("./db/wardrobe");

function stamp(i: number): string {
  const s = String(i % 60).padStart(2, "0");
  const m = String(Math.floor(i / 60) % 60).padStart(2, "0");
  const h = String(Math.floor(i / 3600)).padStart(2, "0");
  return `2026-01-01 ${h}:${m}:${s}`;
}

const MODERATOR = { id: 1, role: "moderator", suspendedAt: null };
const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });

const statementsOn = (table: string) => sent.filter((s) => s.table === table);

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  sent.length = 0;
  inFlight = 0;
  maxInFlight = 0;
  inserted = 0;
});

describe("#2000 — the instrument can fail", () => {
  it("the fake pool refuses the 71st concurrent query, as mysql2's 20 + 50 does", async () => {
    tables.users = [];
    const query = () => fakeClient.query({ sql: "select `id` from `users` where `id` = ?" }, [1]);
    await expect(Promise.all(Array.from({ length: POOL_CEILING }, query))).resolves.toHaveLength(POOL_CEILING);
    await expect(Promise.all(Array.from({ length: POOL_CEILING + 1 }, query))).rejects.toThrow(
      "Queue limit reached.",
    );
  });

  it("the fake refuses a statement it was not built to answer", async () => {
    await expect(fakeClient.query({ sql: "select `id` from `models`" })).rejects.toThrow(/no answer/);
  });
});

function seedFlagged(count: number): void {
  tables.users = [];
  tables.referrals = [];
  for (let i = 0; i < count; i++) {
    const referrer = 1_000 + i;
    const referred = 5_000 + i;
    tables.users.push({ id: referrer, name: `Referrer ${i}`, email: `r${i}@example.invalid` });
    // Every third referral names a person who no longer exists; every fifth has none.
    if (i % 3 !== 0) tables.users.push({ id: referred, name: `Referred ${i}`, email: `d${i}@example.invalid` });
    tables.referrals.push({
      id: i + 1,
      referrerUserId: referrer,
      referredUserId: i % 5 === 0 ? null : referred,
      referredEmail: `d${i}@example.invalid`,
      sameIpFlag: true,
      status: "completed",
      creditsAwarded: 0,
      referrerCredited: false,
      referredCredited: false,
      createdAt: stamp(10_000 - i),
    });
  }
  // A row that is not flagged must not appear.
  tables.referrals.push({ id: 99_999, referrerUserId: 1_000, sameIpFlag: false, createdAt: stamp(20_000) });
}

describe("#2000 — the moderator's flagged-referrals page", () => {
  it("a full page of 100 loads on a pool that refuses past seventy, every name on its own row", async () => {
    seedFlagged(150);
    const page = await moderatorRouter.createCaller({ user: MODERATOR } as never).getFlaggedReferrals({
      limit: 100,
      offset: 0,
    });
    expect(page.total).toBe(150);
    expect(page.items).toHaveLength(100);
    for (const [i, row] of page.items.entries()) {
      expect(row.id).toBe(i + 1);
      expect(row.referrerName).toBe(`Referrer ${i}`);
      expect(row.referrerEmail).toBe(`r${i}@example.invalid`);
      const expected = i % 5 === 0 || i % 3 === 0 ? null : `Referred ${i}`;
      expect(row.referredName, `row ${i}`).toBe(expected);
    }
    expect(maxInFlight, "the page held more than one pool slot at once").toBeLessThanOrEqual(1);
  });

  it("reads users in one statement, not one per row", async () => {
    seedFlagged(100);
    await moderatorRouter.createCaller({ user: MODERATOR } as never).getFlaggedReferrals({ limit: 100 });
    expect(statementsOn("users"), "one users read per row — the fan-out is back").toHaveLength(1);
    expect(statementsOn("users")[0].sql).toContain(" in (");
    expect(statementsOn("users")[0].params.length).toBeLessThanOrEqual(FLAGGED_REFERRAL_USER_CHUNK);
  });

  it("the second page carries its own names, not the first page's", async () => {
    seedFlagged(150);
    const page = await moderatorRouter.createCaller({ user: MODERATOR } as never).getFlaggedReferrals({
      limit: 100,
      offset: 100,
    });
    expect(page.items).toHaveLength(50);
    expect(page.items[0].id).toBe(101);
    expect(page.items[0].referrerName).toBe("Referrer 100");
  });

  it("CONTROL — a customer is still refused the moderator page", async () => {
    seedFlagged(3);
    await expect(
      moderatorRouter.createCaller({ user: customer(7) } as never).getFlaggedReferrals({ limit: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("#2000 — a customer's referral history", () => {
  function seedHistory(referrerId: number, count: number): void {
    tables.users = [];
    tables.referrals = [];
    for (let i = 0; i < count; i++) {
      const referred = 50_000 + i;
      if (i % 4 !== 0) tables.users.push({ id: referred, name: i % 7 === 0 ? "" : `Friend ${i}` });
      tables.referrals.push({
        id: i + 1,
        referrerUserId: referrerId,
        referredUserId: i % 6 === 0 ? null : referred,
        referredEmail: `f${i}@example.invalid`,
        status: "completed",
        creditsAwarded: 50,
        sameIpFlag: false,
        createdAt: stamp(10_000 - i),
      });
    }
    // Someone else's referral, to a named person, must never appear in hers.
    tables.users.push({ id: 77_777, name: "Not hers" });
    tables.referrals.push({
      id: 88_888,
      referrerUserId: referrerId + 1,
      referredUserId: 77_777,
      referredEmail: "x@example.invalid",
      status: "completed",
      creditsAwarded: 50,
      sameIpFlag: false,
      createdAt: stamp(30_000),
    });
  }

  it("a referrer with 200 referrals reads her whole history, names right, nobody else's rows", async () => {
    const userId = 4_001;
    seedHistory(userId, 200);
    const history = await referralRouter.createCaller({ user: customer(userId) } as never).getHistory();
    expect(history).toHaveLength(200);
    for (const [i, row] of history.entries()) {
      expect(row.id).toBe(i + 1);
      const missing = i % 4 === 0 || i % 6 === 0 || i % 7 === 0;
      expect(row.referredName, `row ${i}`).toBe(missing ? null : `Friend ${i}`);
    }
    expect(history.some((row) => row.id === 88_888)).toBe(false);
    expect(maxInFlight, "the history held more than one pool slot at once").toBeLessThanOrEqual(1);
  });

  it("reads in ONE statement, scoped to her in its own WHERE", async () => {
    const userId = 4_002;
    seedHistory(userId, 120);
    await referralRouter.createCaller({ user: customer(userId) } as never).getHistory();
    expect(sent, "a per-referral users lookup is back").toHaveLength(1);
    expect(sent[0].sql).toContain("left join `users`");
    expect(sent[0].sql).toContain("`referrals`.`referrerUserId` = ?");
    expect(sent[0].params).toEqual([userId]);
  });
});

describe("#2000 — a board snapshot", () => {
  function seedBoard(boardId: number, ownerId: number, items: number): void {
    tables.boards = [{ id: boardId, userId: ownerId, name: "Board" }];
    tables.board_edges = [];
    tables.board_items = Array.from({ length: items }, (_, i) => ({
      id: 100_000 + i,
      boardId,
      type: "note",
      kind: "note",
      positionX: i,
      positionY: 0,
      width: 10,
      height: 10,
      zIndex: 0,
      createdAt: stamp(i),
      deletedAt: null,
    }));
    // Item i carries i % 4 versions.
    tables.board_item_versions = tables.board_items.flatMap((item, i) =>
      Array.from({ length: i % 4 }, (_, v) => ({ id: Number(item.id) * 10 + v, itemId: item.id, version: v + 1 })),
    );
    // An item on ANOTHER board with many versions, which must never be counted here.
    tables.board_items.push({ id: 999_999, boardId: boardId + 1, createdAt: stamp(0), deletedAt: null });
    for (let v = 0; v < 9; v++) tables.board_item_versions.push({ id: 9_000_000 + v, itemId: 999_999 });
  }

  it("a board with 200 items snapshots on a pool that refuses past seventy, each count its own", async () => {
    const userId = 6_001;
    seedBoard(42, userId, 200);
    const snap = await boardOpsRouter.createCaller({ user: customer(userId) } as never).getSnapshot({ boardId: 42 });
    expect(snap?.nodes).toHaveLength(200);
    for (const [i, node] of snap!.nodes.entries()) {
      expect(node.id).toBe(100_000 + i);
      expect(node.versionCount, `item ${i}`).toBe(i % 4);
    }
    // The ownership read, then items + edges + counts together: three at most.
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("counts versions in ONE grouped statement, scoped to the board in its own WHERE", async () => {
    const userId = 6_002;
    seedBoard(43, userId, 120);
    await boardOpsRouter.createCaller({ user: customer(userId) } as never).getSnapshot({ boardId: 43 });
    const counts = statementsOn("board_item_versions");
    expect(counts, "one version count per item — the fan-out is back").toHaveLength(1);
    expect(counts[0].sql).toContain("group by");
    expect(counts[0].sql).toContain("`board_items`.`boardId` = ?");
    expect(counts[0].params).toEqual([43]);
  });

  it("CONTROL — someone else's board is still refused", async () => {
    seedBoard(44, 6_003, 2);
    await expect(
      boardOpsRouter.createCaller({ user: customer(6_004) } as never).getSnapshot({ boardId: 44 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("#2000 — the wardrobe's garment reads", () => {
  function seedGarments(ownerId: number, count: number): void {
    tables.wardrobe_garments = Array.from({ length: count }, (_, i) => ({
      id: 300_000 + i,
      userId: ownerId,
      shortName: `Garment ${i}`,
      slotType: "tops",
      originalImageUrl: `https://example.invalid/${i}.png`,
      status: "ready",
    }));
    /* Somebody else's garment, with an id this account will ask for. */
    tables.wardrobe_garments.push({
      id: 777_777,
      userId: ownerId + 1,
      shortName: "Not hers",
      slotType: "tops",
      originalImageUrl: "https://example.invalid/theirs.png",
      status: "ready",
    });
  }

  const ids = (count: number) => Array.from({ length: count }, (_, i) => 300_000 + i);

  it("⚠ saving an outfit of 200 garments succeeds on a pool that refuses past seventy", async () => {
    const userId = 8_001;
    seedGarments(userId, 200);
    await wardrobeRouter.createCaller({ user: customer(userId) } as never).outfits.save({
      name: "Everything",
      garmentIds: ids(200),
    });
    expect(maxInFlight, "the save held more than one pool slot at once").toBeLessThanOrEqual(1);
    const reads = statementsOn("wardrobe_garments");
    expect(reads, "one read per garment — the fan-out is back").toHaveLength(1);
    expect(reads[0].sql).toContain(" in (");
  });

  it("⚠ the owner is in the statement, not checked after it (invariant 1)", async () => {
    const userId = 8_002;
    seedGarments(userId, 3);
    await expect(
      wardrobeRouter.createCaller({ user: customer(userId) } as never).outfits.save({
        name: "Someone else's",
        garmentIds: [300_000, 777_777],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const reads = statementsOn("wardrobe_garments");
    expect(reads).toHaveLength(1);
    expect(reads[0].sql).toContain("`userId` = ?");
    /* The owner is the FIRST parameter, ahead of the id list — so the row is
       never read, rather than read and discarded. */
    expect(reads[0].params[0]).toBe(userId);
    expect(reads[0].params).toContain(777_777);
  });

  it("the refusal names the FIRST missing id in the customer's own order, every time", async () => {
    const userId = 8_003;
    seedGarments(userId, 5);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(
        wardrobeRouter.createCaller({ user: customer(userId) } as never).outfits.save({
          name: "Gaps",
          garmentIds: [300_001, 400_001, 400_002, 300_002],
        }),
      ).rejects.toMatchObject({ message: "Garment 400001 not found" });
    }
  });

  it("NEGATIVE CONTROL — an outfit of garments that are all hers still saves", async () => {
    const userId = 8_004;
    seedGarments(userId, 5);
    const saved = await wardrobeRouter.createCaller({ user: customer(userId) } as never).outfits.save({
      name: "Hers",
      garmentIds: [300_000, 300_004],
    });
    expect(saved.outfitId).toBeTruthy();
    expect(statementsOn("wardrobe_outfits")).toHaveLength(0); // the insert carries no `from`
    expect(sent.some((one) => one.sql.startsWith("insert into"))).toBe(true);
  });

  it("⚠ the reader the other four roads share: 450 ids, chunked, one slot at a time", async () => {
    const userId = 8_005;
    seedGarments(userId, 450);
    const found = await getOwnedGarmentsByIds(userId, [...ids(450), 777_777]);

    expect(found.size).toBe(450);
    expect(found.has(777_777), "someone else's garment came back").toBe(false);
    expect(found.get(300_123)?.shortName).toBe("Garment 123");

    const reads = statementsOn("wardrobe_garments");
    expect(reads.length).toBe(Math.ceil(451 / GARMENT_BATCH_CHUNK));
    for (const read of reads) {
      /* The owner plus at most one chunk of ids. */
      expect(read.params.length).toBeLessThanOrEqual(GARMENT_BATCH_CHUNK + 1);
    }
    expect(maxInFlight, "the chunks ran at once rather than one after another").toBeLessThanOrEqual(1);
  });

  it("a repeated id is read once, not twice", async () => {
    const userId = 8_006;
    seedGarments(userId, 3);
    await getOwnedGarmentsByIds(userId, [300_000, 300_000, 300_001, 300_000]);
    const read = statementsOn("wardrobe_garments")[0];
    expect(read.params).toEqual([userId, 300_000, 300_001]);
  });

  it("no ids at all sends no statement", async () => {
    const userId = 8_007;
    seedGarments(userId, 3);
    const found = await getOwnedGarmentsByIds(userId, []);
    expect(found.size).toBe(0);
    expect(statementsOn("wardrobe_garments")).toHaveLength(0);
  });
});
