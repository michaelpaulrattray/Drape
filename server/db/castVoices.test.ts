/**
 * WHICH ROWS THE KEPT VOICE'S STATEMENTS CAN REACH — read at the wire (#2469).
 *
 * `vitest.setup.ts` strips `DATABASE_URL`, so a row-level suite would SKIP on
 * the gate and read green while proving nothing. So the real functions are
 * driven against a pool that records the SQL it is handed and never connects —
 * `castCreationRecords.test.ts`'s shape — and the assertions are about the
 * statements actually sent:
 *
 *   1. the OWNER is bound in every statement that reads or writes a voice
 *      (invariants 1 and 2), and the cast is re-anchored to the owner's LIVE
 *      SIGNED cast in the statement that writes;
 *   2. the write is an `INSERT … SELECT` over that predicate and NOT a plain
 *      insert — the claim that matters, because Keep makes three provider calls
 *      between any prior check and this statement;
 *   3. the `models` read never selects the recipe (invariant 8) — a voice road
 *      has no use for `masterPrompt`, and the design sentence it DOES read is
 *      the customer's own voice line, which is the whole input;
 *   4. the customer's sentence travels as a BOUND PARAMETER, never interpolated.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 41;
const MODEL_ID = 907;
/** A customer's own words, with the shapes a hand-built string would break on. */
const SENTENCE = "Low, dry — it doesn't 'ask'; it decides. 100% sure of itself.";

const sent: Array<{ sql: string; params: unknown[] }> = [];
let answers: unknown[][] = [];
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
    throw new Error("castVoices.test.ts: no transaction is expected on these statements");
  },
}));

const {
  deleteAccountVoicesIn,
  deleteCastVoicesIn,
  insertCastVoice,
  readAccountVoiceReleaseFactsIn,
  readCastVoice,
  readCastVoiceLine,
  readCastVoiceReleaseFactsIn,
} = await import("./castVoices");

/**
 * A transaction handle, for the four statements the deletion roads run INSIDE
 * one. The recording pool is the same; what differs is only that production
 * hands these a `tx` rather than the pool, so they are driven with a handle of
 * that shape.
 */
const tx = drizzle(recordingPool as never, { mode: "default" } as never) as never;

const WRITE = {
  userId: USER_ID,
  modelId: MODEL_ID,
  designSentence: SENTENCE,
  voiceId: "saved-voice-7",
  clipStorageKey: "casting/voices/41/907/abc.mp3",
  clipSha256: "f".repeat(64),
  clipBytes: 1_234_567,
  clipContentType: "audio/mpeg",
  passageVersion: 1,
};

beforeEach(() => {
  sent.length = 0;
  answers = [];
  writeAffected = 1;
});

describe("the kept voice's statements", () => {
  it("reads the voice LINE off the owner's live signed cast, and loads no recipe", async () => {
    /*
      POSITIONAL, not an object — `castCreationRecords.test.ts`'s own fixtures
      are arrays for the same reason: drizzle's mysql2 driver maps a row to the
      selected fields BY POSITION, and this pool answers with no `fields`
      metadata. An object row reads as every column undefined, which makes a
      projection assertion pass while the value assertion fails. Order is the
      select's: `models.id`, `models.name`, `models.voice`.
    */
    answers = [[[MODEL_ID, "Reva", SENTENCE]]];

    const line = await readCastVoiceLine(USER_ID, MODEL_ID);

    expect(line?.voice).toBe(SENTENCE);
    const [statement] = sent;
    expect(statement?.params).toContain(USER_ID);
    expect(statement?.params).toContain(MODEL_ID);
    /* Invariant 8: an explicit projection, and the recipe is not in it. */
    for (const forbidden of ["masterPrompt", "technicalSchema", "preferences", "personality"]) {
      expect(statement?.sql).not.toContain(forbidden);
    }
    /* The liveness and signed predicates ride the same statement. */
    expect(statement?.sql).toMatch(/deletedAt/);
  });

  it("reads a cast's voice with BOTH the owner and the cast bound", async () => {
    answers = [[]];

    await readCastVoice(USER_ID, MODEL_ID);

    const [statement] = sent;
    expect(statement?.sql).toMatch(/from `cast_voices`/i);
    expect(statement?.params).toEqual(expect.arrayContaining([MODEL_ID, USER_ID]));
  });

  it("writes through an INSERT … SELECT over the owned live signed cast — never a plain insert", async () => {
    const result = await insertCastVoice(WRITE);

    expect(result).toEqual({ inserted: true });
    const [statement] = sent;
    expect(statement?.sql).toMatch(/^insert into `cast_voices`/i);
    /*
      THE CLAIM OF THIS SUITE. A plain `insert … values` would write a voice onto
      a cast deleted during the three provider calls Keep makes. The ownership,
      liveness and signed predicates have to be IN this statement.
    */
    expect(statement?.sql).toMatch(/select/i);
    expect(statement?.sql).toMatch(/from `models`/i);
    expect(statement?.sql).toMatch(/deletedAt/);
    expect(statement?.params).toEqual(expect.arrayContaining([MODEL_ID, USER_ID]));
  });

  it("sends the customer's sentence as a BOUND PARAMETER, never inside the SQL text", async () => {
    await insertCastVoice(WRITE);

    const [statement] = sent;
    expect(statement?.params).toContain(SENTENCE);
    /*
      The positive control is the line above; this is the one that matters. An
      interpolated sentence is both an injection road and a value that lands in
      a query-error message — which `redactQueryValuesInText` exists because of.
    */
    expect(statement?.sql).not.toContain("decides");
    expect(statement?.sql).not.toContain("100%");
  });

  it("reports `inserted: false` when the cast is gone, rather than claiming a write", async () => {
    /* An `INSERT … SELECT` whose predicate matches nothing moves zero rows. */
    writeAffected = 0;

    expect(await insertCastVoice(WRITE)).toEqual({ inserted: false });
  });

  it("reports `inserted: false` on the unique index rather than throwing at a caller", async () => {
    const duplicate = Object.assign(new Error("ER_DUP_ENTRY"), { code: "ER_DUP_ENTRY", errno: 1062 });
    const failing = { ...recordingPool, query: () => Promise.reject(duplicate) };
    vi.doMock("./connection", () => ({
      getDb: async () => drizzle(failing as never, { mode: "default" } as never),
      withTransaction: () => {
        throw new Error("no transaction expected");
      },
    }));
    vi.resetModules();
    const { insertCastVoice: insertAgain } = await import("./castVoices");

    expect(await insertAgain(WRITE)).toEqual({ inserted: false });

    vi.doUnmock("./connection");
    vi.resetModules();
  });

  it("refuses a non-positive id before it reaches the database at all", async () => {
    await expect(readCastVoice(0, MODEL_ID)).rejects.toThrow(/userId/);
    await expect(readCastVoice(USER_ID, -1)).rejects.toThrow(/modelId/);
    expect(sent).toHaveLength(0);
  });
});

/**
 * THE FOUR STATEMENTS THE DELETION ROADS RUN INSIDE A TRANSACTION — and they
 * are here because SABOTAGE FOUND THEM UNGUARDED.
 *
 * `accountDeletionOrphanOwnerScope.test.ts` joins these roads and stayed GREEN
 * with the owner clause CUT OUT of `readAccountVoiceReleaseFactsIn` — correctly,
 * because its arms inspect the statements carrying an ORPHAN CANDIDATE ID and
 * these four carry none. A neighbouring suite touching the same road is not
 * coverage of it (memory: a surviving sabotage may mean a blind guard), so the
 * owner clause on each of the four is driven here, where it is the subject.
 *
 * What each is really protecting: the two READS feed a manifest that DESTROYS
 * objects and a provider call that RELEASES slots, and the two DELETES remove a
 * customer's own writing. An owner-blind version of any of them reaches another
 * account's row, which is enforcement invariant 1 at its sharpest — the
 * statement, not a check before it.
 */
describe("the statements the deletion roads run inside a transaction", () => {
  it("⚠ the CAST's release facts carry the owner AND the cast", async () => {
    answers = [[["saved-7", "casting/voices/41/907/a.mp3"]]];

    const facts = await readCastVoiceReleaseFactsIn(tx, { userId: USER_ID, modelId: MODEL_ID });

    expect(facts).toEqual([{ voiceId: "saved-7", clipStorageKey: "casting/voices/41/907/a.mp3" }]);
    const [statement] = sent;
    expect(statement?.sql).toMatch(/from `cast_voices`/i);
    expect(statement?.sql).toMatch(/`userId` = \?/);
    expect(statement?.sql).toMatch(/`modelId` = \?/);
    expect(statement?.params).toContain(USER_ID);
    expect(statement?.params).toContain(MODEL_ID);
    /* It reads the two facts a release needs and NOT the customer's writing. */
    expect(statement?.sql).not.toContain("designSentence");
  });

  it("⚠ the ACCOUNT's release facts carry the owner — the clause sabotage removed", async () => {
    answers = [[[null, "casting/voices/41/907/b.mp3"]]];

    const facts = await readAccountVoiceReleaseFactsIn(tx, { userId: USER_ID });

    /* A null `voiceId` is "not resident", not "missing" — it still has a clip. */
    expect(facts).toEqual([{ voiceId: null, clipStorageKey: "casting/voices/41/907/b.mp3" }]);
    const [statement] = sent;
    expect(statement?.sql).toMatch(/from `cast_voices`/i);
    expect(statement?.sql).toMatch(/`userId` = \?/);
    expect(statement?.params).toContain(USER_ID);
    expect(statement?.sql).not.toContain("designSentence");
  });

  it("⚠ the CAST's delete carries the owner beside the cast", async () => {
    writeAffected = 1;

    expect(await deleteCastVoicesIn(tx, { userId: USER_ID, modelId: MODEL_ID })).toBe(1);

    const [statement] = sent;
    expect(statement?.sql).toMatch(/^delete from `cast_voices`/i);
    expect(statement?.sql).toMatch(/`userId` = \?/);
    expect(statement?.sql).toMatch(/`modelId` = \?/);
    expect(statement?.params).toContain(USER_ID);
    expect(statement?.params).toContain(MODEL_ID);
  });

  it("⚠ the ACCOUNT's delete carries the owner, and reports what it removed", async () => {
    writeAffected = 3;

    expect(await deleteAccountVoicesIn(tx, { userId: USER_ID })).toBe(3);

    const [statement] = sent;
    expect(statement?.sql).toMatch(/^delete from `cast_voices`/i);
    expect(statement?.sql).toMatch(/`userId` = \?/);
    expect(statement?.params).toContain(USER_ID);
  });
});
