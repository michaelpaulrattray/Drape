/**
 * THE GDPR EXPORT CARRIES THE CUSTOMER'S CAMPAIGNS — the driven arms for #2257.
 *
 * The defect: `exportUserData` never read `cast_campaigns` or
 * `cast_campaign_members` (both arrived with #2249 / PR #2256), so a customer
 * who downloaded their data got their casts but not the names of the
 * campaigns they made — words they typed themselves.
 *
 * What these arms hold:
 *   1. each campaign exports its name, its date and the PUBLIC ids of the
 *      casts filed in it (the same `agencyId`s the export's `models` carry),
 *      through the real `account.exportData` procedure — and nothing else:
 *      no internal row id, no campaign `publicId`, no `sortOrder`;
 *   2. NEGATIVE CONTROL — another account's campaign and its casts never
 *      appear, and both statements on the wire carry the caller as owner;
 *   3. RE-ANCHORING — a member row stamped with the caller's `userId` but
 *      pointing at someone else's campaign or someone else's cast is dropped
 *      (invariant 2: the owner on a child row never vouches for its parents).
 *
 * WHY A FAKE CLIENT: the same reason as `gdprExportPersona.test.ts` —
 * `vitest.setup.ts` strips `DATABASE_URL`, so a row-level suite would skip in
 * CI. Real drizzle renders real statements onto a client that answers from
 * in-memory tables and honours the owner predicates by reading the bound
 * parameter, so dropping one from the export hands back every account's rows
 * exactly as a real database would.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {};
const sent: Array<{ table: string; sql: string; params: unknown[] }> = [];

function columnsOf(sql: string): string[] {
  const list = sql.slice("select ".length, sql.indexOf(" from `"));
  return list.split(", ").map((part) => {
    const names = [...part.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    return names[names.length - 1];
  });
}

/** The owner predicate each owner-scoped table must carry, as drizzle renders it. */
const OWNER_PREDICATE: Record<string, string> = {
  models: "`models`.`userId` = ?",
  cast_campaigns: "`cast_campaigns`.`userId` = ?",
  cast_campaign_members: "`cast_campaign_members`.`userId` = ?",
};

const fakeClient = {
  async query(q: { sql: string } | string, params: unknown[] = []) {
    const sql = typeof q === "string" ? q : q.sql;
    const table = /from `([^`]+)`/.exec(sql)?.[1] ?? "?";
    sent.push({ table, sql, params });
    let rows = tables[table] ?? [];
    const predicate = OWNER_PREDICATE[table];
    if (predicate && sql.includes(predicate)) {
      rows = rows.filter((row) => row.userId === params[0]);
    }
    if (table === "model_assets") {
      const wanted = new Set(params);
      rows = rows.filter((row) => wanted.has(row.modelId));
    }
    const cols = columnsOf(sql);
    return [rows.map((row) => cols.map((c) => row[c] ?? null)), []];
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

const STAMP = "2026-01-01 00:00:00";
/*
  The export's rate limit is in memory and shared across arms, so every arm
  takes a fresh pair of accounts.
*/
let OWNER = 22_570;
let STRANGER = 22_571;

const OWNER_CAST_A = "a".repeat(32);
const OWNER_CAST_B = "b".repeat(32);
const STRANGER_CAST = "c".repeat(32);

function seed(): void {
  tables.users = [
    { id: OWNER, name: "Owner", role: "user", createdAt: STAMP, lastSignedIn: STAMP },
    { id: STRANGER, name: "Stranger", role: "user", createdAt: STAMP, lastSignedIn: STAMP },
  ];
  tables.credits = [];
  tables.credit_transactions = [];
  tables.models = [
    { id: 70_001, userId: OWNER, agencyId: OWNER_CAST_A, name: "A", status: "active", createdAt: STAMP, updatedAt: STAMP },
    { id: 70_002, userId: OWNER, agencyId: OWNER_CAST_B, name: "B", status: "active", createdAt: STAMP, updatedAt: STAMP },
    { id: 80_001, userId: STRANGER, agencyId: STRANGER_CAST, name: "S", status: "active", createdAt: STAMP, updatedAt: STAMP },
  ];
  tables.cast_campaigns = [
    { id: 901, publicId: "1".repeat(32), userId: OWNER, name: "Spring lookbook", sortOrder: 0, createdAt: STAMP, updatedAt: STAMP },
    { id: 902, publicId: "2".repeat(32), userId: OWNER, name: "Untitled short", sortOrder: 0, createdAt: STAMP, updatedAt: STAMP },
    { id: 903, publicId: "3".repeat(32), userId: STRANGER, name: "STRANGER-campaign", sortOrder: 0, createdAt: STAMP, updatedAt: STAMP },
  ];
  tables.cast_campaign_members = [
    { id: 1, campaignId: 901, modelId: 70_001, userId: OWNER, createdAt: STAMP },
    { id: 2, campaignId: 901, modelId: 70_002, userId: OWNER, createdAt: STAMP },
    { id: 3, campaignId: 903, modelId: 80_001, userId: STRANGER, createdAt: STAMP },
  ];
  tables.model_assets = [];
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

beforeEach(() => {
  sent.length = 0;
  OWNER += 10;
  STRANGER += 10;
  seed();
});

describe("#2257 — the export carries the customer's campaigns", () => {
  it("each campaign exports its name, date and filed casts' public ids — and nothing internal", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.campaigns).toEqual([
      { name: "Spring lookbook", createdAt: expect.any(String), castIds: [OWNER_CAST_A, OWNER_CAST_B] },
      { name: "Untitled short", createdAt: expect.any(String), castIds: [] },
    ]);
    // Every cast id the campaigns name is a cast the same export carries.
    const exportedCastIds = new Set(data.models.map((m) => m.agencyId));
    for (const castId of data.campaigns.flatMap((c) => c.castIds)) {
      expect(exportedCastIds.has(castId)).toBe(true);
    }
    // No campaign publicId, internal id or sortOrder travels.
    const serialized = JSON.stringify(data.campaigns);
    expect(serialized).not.toContain("1".repeat(32));
    for (const campaign of data.campaigns) {
      expect(Object.keys(campaign).sort()).toEqual(["castIds", "createdAt", "name"]);
    }
  });

  it("NEGATIVE CONTROL — another account's campaign never appears, and both statements are scoped to the caller", async () => {
    // Instrument check: the fake holds the stranger's rows and would hand them
    // back to an unscoped read.
    expect(tables.cast_campaigns.some((row) => row.userId === STRANGER)).toBe(true);

    const data = await callerFor(OWNER).exportData();
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("STRANGER-campaign");
    expect(serialized).not.toContain(STRANGER_CAST);

    for (const table of ["cast_campaigns", "cast_campaign_members"]) {
      const reads = sent.filter((s) => s.table === table);
      expect(reads, table).toHaveLength(1);
      expect(reads[0].sql, table).toContain(OWNER_PREDICATE[table]);
      expect(reads[0].params[0], table).toBe(OWNER);
    }

    // The mirror: the stranger's export carries only the stranger's campaign.
    const theirs = await callerFor(STRANGER).exportData();
    expect(theirs.campaigns).toEqual([
      { name: "STRANGER-campaign", createdAt: expect.any(String), castIds: [STRANGER_CAST] },
    ]);
  });

  it("a member row stamped with the caller but pointing at someone else's campaign or cast is dropped", async () => {
    tables.cast_campaign_members.push(
      // The caller's own campaign, the stranger's cast.
      { id: 4, campaignId: 901, modelId: 80_001, userId: OWNER, createdAt: STAMP },
      // The stranger's campaign, the caller's own cast.
      { id: 5, campaignId: 903, modelId: 70_001, userId: OWNER, createdAt: STAMP },
    );

    const data = await callerFor(OWNER).exportData();
    expect(data.campaigns.map((c) => c.castIds)).toEqual([[OWNER_CAST_A, OWNER_CAST_B], []]);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain(STRANGER_CAST);
    expect(serialized).not.toContain("STRANGER-campaign");
  });
});
