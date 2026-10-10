/**
 * THE GDPR EXPORT CARRIES EACH CAST'S PERSONA — the driven arms for #2219.
 *
 * The defect: `exportUserData` projected each cast as `name`, `agencyId`,
 * `status`, `createdAt` and its assets, and dropped the cast's personality
 * and voice lines and the customer's own sentence behind each one
 * (`personalityOwnWords` / `voiceOwnWords`, #2197 / #2217). A data export that
 * leaves out words the customer wrote is incomplete.
 *
 * What these arms hold:
 *   1. a cast carrying all four fields exports all four, through the real
 *      `account.exportData` procedure;
 *   2. NEGATIVE CONTROL — another account's cast, persona and all, never
 *      appears, and the models statement on the wire is scoped to the caller;
 *   3. the cast's recipe (`masterPrompt`, `technicalSchema`, `preferences`)
 *      stays out, read off the serialized export and off the projection's key
 *      set (invariant 8 — an explicit projection, not a spread row).
 *
 * WHY A FAKE CLIENT: `vitest.setup.ts` strips `DATABASE_URL`, so a row-level
 * suite would SKIP in CI and prove nothing while reading green. Real drizzle
 * renders real statements onto a client that answers from in-memory tables
 * and honours the one WHERE that matters here — `models`.`userId` = ? — by
 * reading the bound parameter, so dropping that predicate from the export
 * hands back every account's casts exactly as a real database would.
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

const MODELS_OWNER_PREDICATE = "`models`.`userId` = ?";

const fakeClient = {
  async query(q: { sql: string } | string, params: unknown[] = []) {
    const sql = typeof q === "string" ? q : q.sql;
    const table = /from `([^`]+)`/.exec(sql)?.[1] ?? "?";
    sent.push({ table, sql, params });
    let rows = tables[table] ?? [];
    if (table === "models" && sql.includes(MODELS_OWNER_PREDICATE)) {
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
  The export's rate limit (one export per account per window) is in memory and
  shared across arms, so every arm takes a fresh pair of accounts.
*/
let OWNER = 22_190;
let STRANGER = 22_191;

/** Recipe sentinels: none of these strings may appear anywhere in an export. */
const RECIPE = {
  masterPrompt: "RECIPE-SENTINEL-masterPrompt-2219",
  technicalSchema: "RECIPE-SENTINEL-technicalSchema-2219",
  preferences: "RECIPE-SENTINEL-preferences-2219",
};

function seed(): void {
  tables.users = [
    { id: OWNER, name: "Owner", role: "user", createdAt: STAMP, lastSignedIn: STAMP },
    { id: STRANGER, name: "Stranger", role: "user", createdAt: STAMP, lastSignedIn: STAMP },
  ];
  tables.credits = [];
  tables.credit_transactions = [];
  tables.models = [
    {
      id: 50_001,
      userId: OWNER,
      name: "Owner's cast",
      status: "active",
      createdAt: STAMP,
      updatedAt: STAMP,
      personality: "Dry, patient, laughs late.",
      voice: "Low and unhurried, clipped vowels.",
      personalityOwnWords: "kind of the friend who waits for you to finish",
      voiceOwnWords: "sounds like a late-night radio host",
      ...RECIPE,
    },
    {
      id: 50_002,
      userId: OWNER,
      name: "Owner's unwritten cast",
      status: "draft",
      createdAt: STAMP,
      updatedAt: STAMP,
    },
    {
      id: 60_001,
      userId: STRANGER,
      name: "Stranger's cast",
      status: "active",
      createdAt: STAMP,
      updatedAt: STAMP,
      personality: "STRANGER-personality",
      voice: "STRANGER-voice",
      personalityOwnWords: "STRANGER-personalityOwnWords",
      voiceOwnWords: "STRANGER-voiceOwnWords",
    },
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

describe("#2219 — the export carries each cast's persona and the customer's own words", () => {
  it("a cast carrying all four fields exports all four; a cast with none exports nulls", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.models).toHaveLength(2);
    const [written, unwritten] = data.models;
    expect(written).toMatchObject({
      name: "Owner's cast",
      personality: "Dry, patient, laughs late.",
      voice: "Low and unhurried, clipped vowels.",
      personalityOwnWords: "kind of the friend who waits for you to finish",
      voiceOwnWords: "sounds like a late-night radio host",
    });
    expect(unwritten).toMatchObject({
      name: "Owner's unwritten cast",
      personality: null,
      voice: null,
      personalityOwnWords: null,
      voiceOwnWords: null,
    });
  });

  it("NEGATIVE CONTROL — another account's cast never appears, and the statement is scoped to the caller", async () => {
    // Instrument check first: the fake really does hold the stranger's row and
    // would hand it back to an unscoped read.
    expect(tables.models.some((row) => row.userId === STRANGER)).toBe(true);

    const data = await callerFor(OWNER).exportData();
    const serialized = JSON.stringify(data);
    expect(data.models.map((m) => m.name)).not.toContain("Stranger's cast");
    expect(serialized).not.toContain("STRANGER-");

    const modelsReads = sent.filter((s) => s.table === "models");
    expect(modelsReads).toHaveLength(1);
    expect(modelsReads[0].sql).toContain(MODELS_OWNER_PREDICATE);
    expect(modelsReads[0].params[0]).toBe(OWNER);

    // And the mirror: the stranger's own export carries only the stranger's cast.
    const theirs = await callerFor(STRANGER).exportData();
    expect(theirs.models.map((m) => m.name)).toEqual(["Stranger's cast"]);
    expect(theirs.models[0].personalityOwnWords).toBe("STRANGER-personalityOwnWords");
  });

  it("the cast's recipe stays out: an explicit projection, no masterPrompt/technicalSchema/preferences", async () => {
    // Instrument check: the recipe IS on the row the export reads.
    expect(tables.models[0].masterPrompt).toBe(RECIPE.masterPrompt);

    const data = await callerFor(OWNER).exportData();
    const serialized = JSON.stringify(data);
    for (const sentinel of Object.values(RECIPE)) {
      expect(serialized, `the export leaked ${sentinel}`).not.toContain(sentinel);
    }
    expect(Object.keys(data.models[0]).sort()).toEqual(
      [
        "agencyId",
        "assets",
        "createdAt",
        "name",
        "personality",
        "personalityOwnWords",
        "status",
        "voice",
        "voiceOwnWords",
      ].sort(),
    );
  });
});
