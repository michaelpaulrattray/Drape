/**
 * THE GDPR EXPORT AT ANY SIZE — the driven arms for #1989.
 *
 * The defect: `exportUserData` read each cast's assets with its own query and
 * fired them all at once (`Promise.all(userModels.map(…))`), onto the shared
 * pool (`connectionLimit: 20`, `queueLimit: 50` in `server/db/connection.ts`).
 * The 71st concurrent query was rejected with `Queue limit reached.`, so an
 * account with more than about seventy casts got a 500 instead of its data —
 * measured on the dev fixture's 77 casts. And because the rate limit was
 * spent on the way in, that 500 also refused her retry for five minutes.
 *
 * WHY A FAKE CLIENT AND NOT A DATABASE. `vitest.setup.ts` strips
 * `DATABASE_URL`, so a row-level suite would SKIP in CI and prove nothing
 * while reading green (working law 2). The pool's refusal is the subject, so
 * the fake models exactly that: real drizzle renders real statements onto a
 * client that refuses any query arriving while seventy are already
 * outstanding, the way mysql2's pool does at 20 + 50. The procedure driven is
 * the real `account.exportData`, through `createCaller`.
 *
 * The first arm proves the instrument CAN fail (it refuses the 71st) before
 * any verdict of it is believed.
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
let failAssets = false;

function columnsOf(sql: string): string[] {
  const list = sql.slice("select ".length, sql.indexOf(" from `"));
  return list.split(", ").map((part) => {
    const names = [...part.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    return names[names.length - 1];
  });
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
      if (table === "model_assets" && failAssets) throw new Error("simulated read failure");
      let rows = tables[table] ?? [];
      if (table === "model_assets") {
        const wanted = new Set(params);
        rows = rows.filter((row) => wanted.has(row.modelId));
      }
      const cols = columnsOf(sql);
      return [rows.map((row) => cols.map((c) => row[c] ?? null)), []];
    } finally {
      inFlight--;
    }
  },
};

const fakeDb = drizzle({ client: fakeClient as never });

vi.mock("./db/connection", () => ({
  getDb: async () => fakeDb,
}));
vi.mock("./auditLog", () => ({ logAuditEvent: async () => undefined }));
vi.mock("./casting/evidence/evidenceDeliveryRuntime", () => ({
  getEvidenceDeliveryAdapter: () => null,
}));

const { accountRouter } = await import("./routes/account");
const { checkRateLimit, releaseRateLimitSlot } = await import("./security/rateLimit");
const { GDPR_EXPORT_ASSET_CHUNK } = await import("./db/gdprExport");

const STAMP = "2026-01-01 00:00:00";

function seedAccount(userId: number, casts: number, assetsPerCast = 2): void {
  tables.users = [{ id: userId, name: "Fixture", role: "user", createdAt: STAMP, lastSignedIn: STAMP }];
  tables.credits = [];
  tables.credit_transactions = [];
  tables.models = Array.from({ length: casts }, (_, i) => ({
    id: 10_000 + i,
    userId,
    name: `Cast ${i}`,
    status: "active",
    createdAt: STAMP,
    updatedAt: STAMP,
  }));
  tables.model_assets = tables.models.flatMap((model) =>
    Array.from({ length: assetsPerCast }, (_, j) => ({
      modelId: model.id,
      viewType: `view-${j}`,
      resolution: "2k",
      storageUrl: `https://example.invalid/${String(model.id)}/${j}`,
      createdAt: STAMP,
    })),
  );
  tables.model_reference_plates = [];
  tables.model_evidence_crops = [];
  tables.generations = [];
  tables.referrals = [];
  tables.change_requests = [];
}

function callerFor(userId: number) {
  return accountRouter.createCaller({
    user: { id: userId, approved: true, suspendedAt: null, lockedUntil: null },
  } as never);
}

const assetStatements = () => sent.filter((s) => s.table === "model_assets");

beforeEach(() => {
  sent.length = 0;
  inFlight = 0;
  maxInFlight = 0;
  failAssets = false;
});

describe("#1989 — the instrument can fail", () => {
  it("the fake pool refuses the 71st concurrent query, as mysql2's 20 + 50 does", async () => {
    seedAccount(1, 0);
    const query = () => fakeClient.query({ sql: "select `id` from `users`" });
    await expect(Promise.all(Array.from({ length: POOL_CEILING }, query))).resolves.toHaveLength(POOL_CEILING);
    await expect(Promise.all(Array.from({ length: POOL_CEILING + 1 }, query))).rejects.toThrow(
      "Queue limit reached.",
    );
  });
});

describe("#1989 — an account with 200 casts exports", () => {
  it("through the real procedure, every cast with its own assets, on a pool that refuses past seventy", async () => {
    const userId = 9_101;
    seedAccount(userId, 200);
    const data = await callerFor(userId).exportData();

    expect(data.models).toHaveLength(200);
    for (const [i, model] of data.models.entries()) {
      expect(model.name).toBe(`Cast ${i}`);
      expect(model.assets.map((a) => a.storageUrl)).toEqual([
        `https://example.invalid/${10_000 + i}/0`,
        `https://example.invalid/${10_000 + i}/1`,
      ]);
    }
    expect(maxInFlight, "the export held more than one pool slot at once").toBeLessThanOrEqual(1);
  });

  it("reads assets in a number of statements that does not grow per cast", async () => {
    const userId = 9_102;
    seedAccount(userId, 200);
    await callerFor(userId).exportData();
    expect(
      assetStatements(),
      "one model_assets statement per cast — the unbounded fan-out is back",
    ).toHaveLength(1);
    expect(assetStatements()[0].sql).toContain(" in (");
  });

  it("chunks a very large account, and no statement's IN list exceeds the chunk", async () => {
    const userId = 9_103;
    const casts = GDPR_EXPORT_ASSET_CHUNK + 1;
    seedAccount(userId, casts, 1);
    const data = await callerFor(userId).exportData();
    expect(data.models).toHaveLength(casts);
    expect(data.models.every((m) => m.assets.length === 1)).toBe(true);
    expect(assetStatements()).toHaveLength(2);
    for (const statement of assetStatements()) {
      expect(statement.params.length).toBeLessThanOrEqual(GDPR_EXPORT_ASSET_CHUNK);
    }
  });

  it("a cast with no assets exports with an empty list, not someone else's", async () => {
    const userId = 9_104;
    seedAccount(userId, 3);
    tables.model_assets = tables.model_assets.filter((row) => row.modelId !== 10_001);
    const data = await callerFor(userId).exportData();
    expect(data.models[1].assets).toEqual([]);
    expect(data.models[0].assets).toHaveLength(2);
    expect(data.models[2].assets).toHaveLength(2);
  });
});

describe("#1989 — a failed export does not cost her the retry", () => {
  it("after a failure the next request is admitted, not refused for five minutes", async () => {
    const userId = 9_201;
    seedAccount(userId, 5);
    failAssets = true;
    await expect(callerFor(userId).exportData()).rejects.toThrow(/from `model_assets`/);

    failAssets = false;
    const data = await callerFor(userId).exportData();
    expect(data.models).toHaveLength(5);
  });

  it("CONTROL — after a success the limit still refuses, and says when", async () => {
    const userId = 9_202;
    seedAccount(userId, 5);
    await callerFor(userId).exportData();
    await expect(callerFor(userId).exportData()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("a release never hands back more than was spent", () => {
    const config = { maxRequests: 1, windowMs: 300_000 };
    const id = "release-arm-1989";
    expect(checkRateLimit(id, config).allowed).toBe(true);
    releaseRateLimitSlot(id, config);
    releaseRateLimitSlot(id, config);
    expect(checkRateLimit(id, config).allowed).toBe(true);
    expect(checkRateLimit(id, config).allowed, "two releases minted a second slot").toBe(false);
  });

  it("a release with nothing spent is a no-op", () => {
    const config = { maxRequests: 1, windowMs: 300_000 };
    const id = "release-arm-1989-empty";
    releaseRateLimitSlot(id, config);
    expect(checkRateLimit(id, config).allowed).toBe(true);
    expect(checkRateLimit(id, config).allowed).toBe(false);
  });
});
