/**
 * THE GDPR EXPORT CARRIES THE CUSTOMER'S CREATION RECORDS — the relay's
 * finding 3 on PR #2317 (N2d-1, #2311).
 *
 * Each record holds the customer's display name, account id and Klieg ID, so
 * a data export that left the table out would be incomplete without saying
 * so. The harness is `gdprExportCampaigns.test.ts`'s (a fake client that
 * honours the owner predicate by reading the bound parameter, so dropping it
 * hands back every account's rows as a real database would).
 *
 *   1. the owner's record exports as their evidence — the signed document,
 *      its signature and token — keyed by the cast's PUBLIC id, and without
 *      the internal authority name;
 *   2. NEGATIVE — the stranger's record never appears, and the statement
 *      carries the caller as owner;
 *   3. RE-ANCHORING — a row stamped with the caller's id but pointing at a
 *      cast that is not theirs is dropped.
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
  cast_creation_records: "`cast_creation_records`.`userId` = ?",
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
  tables.cast_creation_records = [
    { id: 1, modelId: 70_001, userId: OWNER, recordVersion: "1", recordJson: '{"kliegId":"A"}', recordSha256: "1".repeat(64),
      signature: "h..s", signingKeyId: "kid", timestampToken: "dG9rZW4=", timestampAuthority: "digicert",
      stampedAt: STAMP, publicAt: STAMP, createdAt: STAMP },
    /* The owner's own userId on a row pointing at the STRANGER's cast — re-anchoring must drop it. */
    { id: 2, modelId: 80_001, userId: OWNER, recordVersion: "1", recordJson: '{"kliegId":"MISSTAMPED"}', recordSha256: "2".repeat(64),
      signature: "h..s", signingKeyId: "kid", timestampToken: null, timestampAuthority: null, stampedAt: null, createdAt: STAMP },
    { id: 3, modelId: 80_001, userId: STRANGER, recordVersion: "1", recordJson: '{"kliegId":"STRANGER-RECORD"}', recordSha256: "3".repeat(64),
      signature: "h..s", signingKeyId: "kid", timestampToken: null, timestampAuthority: null, stampedAt: null, createdAt: STAMP },
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

describe("the export carries the customer's creation records", () => {
  it("exports the owner's record as checkable evidence, keyed by public cast id, with no internal authority name", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.creationRecords).toEqual([{
      castId: OWNER_CAST_A,
      recordVersion: "1",
      record: '{"kliegId":"A"}',
      recordSha256: "1".repeat(64),
      signature: "h..s",
      signingKeyId: "kid",
      timestampToken: "dG9rZW4=",
      stampedAt: expect.any(String),
      publicAt: expect.any(String),
      createdAt: expect.any(String),
    }]);
    expect(JSON.stringify(data.creationRecords)).not.toContain("digicert");
  });

  it("carries the public check-page switch when it is ON (#2313) — as its time", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.creationRecords[0]?.publicAt).toMatch(/^2026-01-01T/);
  });

  it("carries the switch when it is OFF as an explicit null, not an absent key", async () => {
    tables.cast_creation_records[0] = { ...tables.cast_creation_records[0], publicAt: null };
    const data = await callerFor(OWNER).exportData();
    expect(data.creationRecords[0]).toHaveProperty("publicAt", null);
  });

  it("⚠ NEGATIVE — another account's record never appears, and the statement is owner-scoped", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(JSON.stringify(data.creationRecords)).not.toContain("STRANGER-RECORD");
    const statement = sent.find((entry) => entry.table === "cast_creation_records");
    expect(statement?.sql).toContain("`cast_creation_records`.`userId` = ?");
    expect(statement?.params[0]).toBe(OWNER);
  });

  it("⚠ RE-ANCHORING — a row with the caller's id on someone else's cast is dropped", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(JSON.stringify(data.creationRecords)).not.toContain("MISSTAMPED");
  });
});
