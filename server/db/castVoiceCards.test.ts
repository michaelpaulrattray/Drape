/**
 * WHICH ROWS THE HIDDEN VOICE CARD'S STATEMENTS CAN REACH — read at the wire
 * (#2498), on `castVoices.test.ts`'s shape: the real functions against a pool
 * that records the SQL it is handed and never connects.
 *
 *   1. the source read binds the OWNER on the cast AND on the roll it joins, so
 *      a cast can never borrow another account's brief (invariant 2);
 *   2. the write is an `INSERT … SELECT` over the owner's live signed cast, and
 *      the old row's delete is owner-scoped in the same transaction;
 *   3. the card and its line travel as BOUND PARAMETERS, never interpolated;
 *   4. both deletion doors carry the owner in their own `WHERE`.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 41;
const MODEL_ID = 907;
const CARD = "Native English. Female, 30s. Studio quality. Persona: it's 'certain'; 100% calm.";

const sent: Array<{ sql: string; params: unknown[] }> = [];
let insertAffected = 1;

const recordingPool = {
  query(...args: unknown[]) {
    const config = args[0] as { sql?: string; values?: unknown[] } | string;
    const sql = typeof config === "string" ? config : config.sql ?? "";
    const params = (args[1] as unknown[]) ?? (typeof config === "string" ? [] : config.values ?? []);
    sent.push({ sql, params });
    const rows = /^\s*select/i.test(sql)
      ? []
      : { affectedRows: /^\s*insert/i.test(sql) ? insertAffected : 1 };
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
  withTransaction: async (run: (tx: unknown) => unknown) =>
    run(drizzle(recordingPool as never, { mode: "default" } as never)),
}));

const {
  deleteAccountVoiceCardsIn,
  deleteCastVoiceCardsIn,
  readCastVoiceCard,
  readCastVoiceCardSources,
  saveCastVoiceCard,
} = await import("./castVoiceCards");

const tx = drizzle(recordingPool as never, { mode: "default" } as never) as never;

const WRITE = {
  userId: USER_ID,
  modelId: MODEL_ID,
  sourceHash: "a".repeat(64),
  voiceCard: CARD,
  previewLine: "Say the name, then leave. I don't chase.",
  writerModel: "x-ai/grok-4.7",
};

beforeEach(() => {
  sent.length = 0;
  insertAffected = 1;
});

describe("the hidden voice card's statements", () => {
  it("⚠ the source read binds the owner on the cast AND on the roll it borrows the brief from", async () => {
    await readCastVoiceCardSources(USER_ID, MODEL_ID);
    expect(sent).toHaveLength(1);
    const [{ sql, params }] = sent;
    expect(sql).toMatch(/left join `casting_rolls` on \(`casting_rolls`\.`id` = `models`\.`sourceRollId` and `casting_rolls`\.`userId` = \?\)/);
    expect(sql).toMatch(/`models`\.`userId` = \?/);
    expect(sql).toMatch(/`models`\.`deletedAt` is null/);
    expect(params.filter((param) => param === USER_ID)).toHaveLength(2);
    expect(params).toContain(MODEL_ID);
  });

  it("reads the kept card with owner and cast in the one statement", async () => {
    await readCastVoiceCard(USER_ID, MODEL_ID);
    const [{ sql, params }] = sent;
    expect(sql).toMatch(/from `cast_voice_cards` where \(`cast_voice_cards`\.`modelId` = \? and `cast_voice_cards`\.`userId` = \?\)/);
    expect(params).toEqual(expect.arrayContaining([MODEL_ID, USER_ID]));
  });

  it("writes as INSERT … SELECT over the owner's live signed cast, the old row deleted owner-scoped first, the card BOUND", async () => {
    expect(await saveCastVoiceCard(WRITE)).toEqual({ written: true });
    const deleted = sent.find((statement) => /^\s*delete/i.test(statement.sql));
    const inserted = sent.find((statement) => /^\s*insert/i.test(statement.sql));
    expect(deleted?.sql).toMatch(/`cast_voice_cards`\.`modelId` = \? and `cast_voice_cards`\.`userId` = \?/);
    expect(inserted?.sql).toMatch(/insert into `cast_voice_cards` .*select/i);
    expect(inserted?.sql).toMatch(/`models`\.`userId` = \?/);
    expect(inserted?.sql).not.toContain(CARD);
    expect(inserted?.params).toContain(CARD);
    expect(inserted?.params).toContain(USER_ID);
  });

  it("a cast gone before the write lands nothing and says so", async () => {
    insertAffected = 0;
    expect(await saveCastVoiceCard(WRITE)).toEqual({ written: false });
  });

  it("both deletion doors carry the owner in their own WHERE", async () => {
    await deleteCastVoiceCardsIn(tx, { userId: USER_ID, modelId: MODEL_ID });
    await deleteAccountVoiceCardsIn(tx, { userId: USER_ID });
    expect(sent[0].sql).toMatch(/delete from `cast_voice_cards` where \(`cast_voice_cards`\.`modelId` = \? and `cast_voice_cards`\.`userId` = \?\)/);
    expect(sent[1].sql).toMatch(/delete from `cast_voice_cards` where `cast_voice_cards`\.`userId` = \?/);
    expect(sent[1].params).toEqual([USER_ID]);
  });
});
