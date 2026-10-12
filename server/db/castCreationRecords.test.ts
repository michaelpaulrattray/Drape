/**
 * WHICH ROWS THE CREATION RECORD'S STATEMENTS CAN REACH — read at the wire (#2311).
 *
 * `vitest.setup.ts` strips `DATABASE_URL`, so a row-level suite would SKIP on
 * the gate and read green while proving nothing. So the real functions are
 * driven against a pool that records the SQL it is handed and never connects —
 * the shape `castPersonaWrite.test.ts` and `accountDeletionOrphanOwnerScope.test.ts`
 * use — and the assertions are about the statements actually sent:
 *
 *   1. the OWNER is bound in every statement that reads a cast's facts or
 *      touches a record (invariants 1 and 2) — including the child reads of
 *      the roll, the candidate, its refinements and the anchor asset;
 *   2. the `models` read NEVER SELECTS the recipe (`masterPrompt`,
 *      `technicalSchema`, `preferences`) or the persona lines — the record is
 *      built from facts the road never loaded (invariant 8, and §3's bound);
 *   3. a stamp only ever fills a record that has no token yet.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 41;
const MODEL_ID = 907;

const sent: Array<{ sql: string; params: unknown[] }> = [];
/** What the driver answers, statement by statement; past the end, an empty result. */
let answers: unknown[][] = [];
/** What a write answers — a gated INSERT … SELECT whose cast is gone moves 0 rows. */
let writeAffected = 1;

const recordingPool = {
  query(...args: unknown[]) {
    const config = args[0] as { sql?: string; values?: unknown[] } | string;
    const sql = typeof config === "string" ? config : config.sql ?? "";
    const params = (args[1] as unknown[]) ?? (typeof config === "string" ? [] : config.values ?? []);
    const index = sent.length;
    sent.push({ sql, params });
    const rows = /^\s*select/i.test(sql) ? (answers[index] ?? []) : { affectedRows: writeAffected };
    const callback = args.find((argument) => typeof argument === "function") as
      | ((error: unknown, rows: unknown, fields: unknown) => void)
      | undefined;
    if (callback) {
      callback(null, rows, []);
      return undefined;
    }
    return Promise.resolve([rows, []]);
  },
  execute(...args: unknown[]) {
    return (recordingPool as unknown as { query: (...a: unknown[]) => unknown }).query(...args);
  },
};

vi.mock("./connection", () => ({
  getDb: async () => drizzle(recordingPool as never, { mode: "default" } as never),
  withTransaction: () => {
    throw new Error("castCreationRecords.test.ts: no transaction is expected on these statements");
  },
}));

const {
  deleteCastCreationRecordsIn,
  getCastCreationRecord,
  insertCastCreationRecord,
  readCreationRecordSource,
  recordCastCreationStamp,
} = await import("./castCreationRecords");

beforeEach(() => {
  sent.length = 0;
  answers = [];
  writeAffected = 1;
});

/** Does this statement bind the owner — a `userId` column compared to USER_ID? */
function bindsOwner(statement: { sql: string; params: unknown[] }): boolean {
  return /`userId`\s*=\s*\?/.test(statement.sql) && statement.params.includes(USER_ID);
}

/* The seven reads of a full source, answered in order as row ARRAYS (drizzle's mysql2 select shape). */
const FULL_SOURCE_ANSWERS = [
  [[MODEL_ID, "KI-AAAA-BBBB-CCCC-DDDD", "2026-09-03 10:00:00", "2026-09-03 10:04:00", 300, 400]],
  [["casting-v2/casts/op/anchor/x.png"]],
  [["Ada"]],
  [[300, 12, "2026-09-03 09:40:00"]],
  [[3]],
  [["2026-09-03 09:45:00"]],
  [[2, "2026-09-03 09:50:00", "2026-09-03 09:55:00"]],
];

describe("reading a cast's facts", () => {
  it("binds the owner in EVERY statement, the child reads included", async () => {
    answers = FULL_SOURCE_ANSWERS;
    const source = await readCreationRecordSource(USER_ID, MODEL_ID);
    expect("refused" in source).toBe(false);
    expect(sent).toHaveLength(7);
    /* The maker read is keyed on the account itself: `users.id = USER_ID`. */
    const makerIndex = sent.findIndex((statement) => /from `users`/.test(statement.sql));
    expect(makerIndex).toBe(2);
    expect(sent[makerIndex]!.params).toEqual([USER_ID, 1]);
    sent.forEach((statement, index) => {
      if (index === makerIndex) return;
      expect(bindsOwner(statement), `statement ${index}: ${statement.sql}`).toBe(true);
    });
  });

  it("⚠ never SELECTS the recipe or the persona lines from `models`", async () => {
    answers = FULL_SOURCE_ANSWERS;
    await readCreationRecordSource(USER_ID, MODEL_ID);
    const everything = sent.map((statement) => statement.sql).join("\n");
    for (const column of [
      "masterPrompt", "technicalSchema", "preferences", "personality", "voice",
      "identityText", "briefText", "compiledBrief", "instructions", "email",
    ]) {
      expect(everything, column).not.toContain(`\`${column}\``);
    }
    /* CONTROL — the reader can see a column when one is selected. */
    expect(everything).toContain("`agencyId`");
  });

  it("⚠ reads the maker's DISPLAY name and never `users`.`name` (finding 4 on PR #2317)", async () => {
    answers = FULL_SOURCE_ANSWERS;
    await readCreationRecordSource(USER_ID, MODEL_ID);
    const maker = sent.find((statement) => /from `users`/.test(statement.sql))!;
    /* A single-table select renders bare column names. */
    expect(maker.sql).toMatch(/^select `displayName` from `users`/);
    expect(maker.sql).not.toMatch(/`name`/);
  });

  it("reads the ORIGINAL anchor — the lowest-sequence identity snapshot — re-anchored to the owned cast", async () => {
    answers = FULL_SOURCE_ANSWERS;
    await readCreationRecordSource(USER_ID, MODEL_ID);
    const anchor = sent[1]!;
    expect(anchor.sql).toMatch(/order by `model_identity_snapshots`.`sequence` asc/);
    expect(anchor.sql).toMatch(/`model_assets`.`modelId` = `model_identity_snapshots`.`modelId`/);
    expect(bindsOwner(anchor)).toBe(true);
  });

  it("assembles the source the record is built from", async () => {
    answers = FULL_SOURCE_ANSWERS;
    const source = await readCreationRecordSource(USER_ID, MODEL_ID);
    expect(source).toMatchObject({
      modelId: MODEL_ID,
      kliegId: "KI-AAAA-BBBB-CCCC-DDDD",
      anchorStorageKey: "casting-v2/casts/op/anchor/x.png",
      makerDisplayName: "Ada",
      rollsInSession: 3,
      refinements: { count: 2 },
    });
  });

  it("refuses a cast that is not this owner's signed cast — and reads nothing further", async () => {
    answers = [[]];
    expect(await readCreationRecordSource(USER_ID, MODEL_ID)).toEqual({ refused: "not_a_signed_cast" });
    expect(sent).toHaveLength(1);
  });

  it("refuses a cast whose views have not finished (no mintedAt)", async () => {
    answers = [[[MODEL_ID, "KI-AAAA-BBBB-CCCC-DDDD", "2026-09-03 10:00:00", null, 300, 400]]];
    expect(await readCreationRecordSource(USER_ID, MODEL_ID)).toEqual({ refused: "not_minted" });
  });
});

describe("the record's own statements", () => {
  it("reads, stores, stamps and deletes with the owner in the statement", async () => {
    await getCastCreationRecord(USER_ID, MODEL_ID);
    await insertCastCreationRecord({
      userId: USER_ID, modelId: MODEL_ID, recordVersion: "1", recordJson: "{}",
      recordSha256: "a".repeat(64), signature: "h..s", signingKeyId: "kid",
    });
    await recordCastCreationStamp({ userId: USER_ID, recordId: 5, token: null });
    await deleteCastCreationRecordsIn(
      drizzle(recordingPool as never, { mode: "default" } as never) as never,
      { userId: USER_ID, modelId: MODEL_ID },
    );
    expect(sent).toHaveLength(4);
    const [read, insert, stamp, remove] = sent;
    expect(bindsOwner(read!)).toBe(true);
    expect(insert!.sql).toMatch(/^insert into `cast_creation_records`/);
    expect(insert!.params).toContain(USER_ID);
    expect(bindsOwner(stamp!)).toBe(true);
    expect(bindsOwner(remove!)).toBe(true);
    expect(remove!.sql).toMatch(/`modelId` = \?/);
  });

  it("⚠ a stamp only ever fills a record with NO token yet", async () => {
    await recordCastCreationStamp({
      userId: USER_ID, recordId: 5,
      token: { tokenBase64: "dG9rZW4=", authority: "digicert", stampedAt: new Date("2026-10-12T03:11:42Z") },
    });
    expect(sent[0]!.sql).toMatch(/`timestampToken` is null/);
  });
});

/* The live-cast predicate as the roster draws it: owner, signed status, not deleted. */
function gatedOnLiveCast(sql: string): boolean {
  return /`models`.`userId` = \?/.test(sql)
    && /`models`.`deletedAt` is null/.test(sql)
    && /`models`.`status` in \(/.test(sql);
}

describe("⚠ the record cannot outlive its cast (the relay's finding 1 on PR #2317)", () => {
  it("the insert is an INSERT … SELECT out of the owner's LIVE, MINTED cast — never a plain VALUES", async () => {
    await insertCastCreationRecord({
      userId: USER_ID, modelId: MODEL_ID, recordVersion: "1", recordJson: "{}",
      recordSha256: "a".repeat(64), signature: "h..s", signingKeyId: "kid",
    });
    const insert = sent[0]!;
    expect(insert.sql).toMatch(/^insert into `cast_creation_records` \(.*\) select /);
    expect(insert.sql).not.toMatch(/ values /);
    expect(gatedOnLiveCast(insert.sql)).toBe(true);
    expect(insert.sql).toMatch(/`models`.`mintedAt` is not null/);
    expect(insert.params).toContain(USER_ID);
    expect(insert.params).toContain(MODEL_ID);
  });

  it("a cast deleted between the read and the insert: the gated insert moves no row, and says so", async () => {
    writeAffected = 0;
    expect(await insertCastCreationRecord({
      userId: USER_ID, modelId: MODEL_ID, recordVersion: "1", recordJson: "{}",
      recordSha256: "a".repeat(64), signature: "h..s", signingKeyId: "kid",
    })).toEqual({ stored: false });
  });

  it("CONTROL — a live cast's insert reports it stored", async () => {
    expect(await insertCastCreationRecord({
      userId: USER_ID, modelId: MODEL_ID, recordVersion: "1", recordJson: "{}",
      recordSha256: "a".repeat(64), signature: "h..s", signingKeyId: "kid",
    })).toEqual({ stored: true });
  });

  it("the reader serves a record only while its cast is live — the cast is JOINED", async () => {
    await getCastCreationRecord(USER_ID, MODEL_ID);
    expect(sent[0]!.sql).toMatch(/inner join `models` on/);
    expect(gatedOnLiveCast(sent[0]!.sql)).toBe(true);
  });

  it("the re-stamp writes a token only onto a record whose cast is live", async () => {
    await recordCastCreationStamp({
      userId: USER_ID, recordId: 5,
      token: { tokenBase64: "dG9rZW4=", authority: "digicert", stampedAt: new Date("2026-10-12T03:11:42Z") },
    });
    expect(sent[0]!.sql).toMatch(/`cast_creation_records`.`modelId` in \(select/);
    expect(gatedOnLiveCast(sent[0]!.sql)).toBe(true);
  });
});
