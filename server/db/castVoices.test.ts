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
/**
 * A per-statement override of the affected count, keyed on a fragment of the
 * SQL — needed since #2470's repair, because the kept-voice write now sends
 * THREE statements in one transaction (the insert and the manifest's two
 * deletes) and an arm has to be able to move zero rows on exactly one of them.
 */
let affectedBySql: Array<{ match: RegExp; affected: number }> = [];

function affectedFor(sql: string): number {
  for (const rule of affectedBySql) if (rule.match.test(sql)) return rule.affected;
  return writeAffected;
}

const recordingPool = {
  query(...args: unknown[]) {
    const config = args[0] as { sql?: string; values?: unknown[] } | string;
    const sql = typeof config === "string" ? config : config.sql ?? "";
    const params = (args[1] as unknown[]) ?? (typeof config === "string" ? [] : config.values ?? []);
    const index = sent.length;
    sent.push({ sql, params });
    const rows = /^\s*select/i.test(sql) ? (answers[index] ?? []) : { affectedRows: affectedFor(sql) };
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

/*
  ⚠ **THIS MOCK USED TO THROW ON `withTransaction`, ASSERTING THAT THE KEPT
  VOICE'S WRITE NEEDED NO TRANSACTION — AND #2470's FINDING IS THAT IT DOES.**
  The row write now discharges the clip's write-ahead cleanup manifest in its
  own transaction, so the callback is RUN here, against the same recording pool,
  and the statements it sends are what the arms below read.
*/
vi.mock("./connection", () => ({
  getDb: async () => drizzle(recordingPool as never, { mode: "default" } as never),
  withTransaction: async (run: (tx: unknown) => unknown) =>
    run(drizzle(recordingPool as never, { mode: "default" } as never)),
}));

const {
  CastVoiceManifestUndischargeable,
  deleteAccountVoicesIn,
  deleteCastVoicesIn,
  insertCastVoice,
  readAccountVoiceReleaseFactsIn,
  readCastVoice,
  readCastVoiceLine,
  readCastVoiceReleaseFactsIn,
  removeCastVoice,
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
  cleanupBatchId: "11111111-2222-3333-4444-555555555555",
};

beforeEach(() => {
  sent.length = 0;
  answers = [];
  writeAffected = 1;
  affectedBySql = [];
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

    expect(result).toEqual({ inserted: true, replaced: null });
    /* sent[0] is the locked read of the cast's current voice (#2497). */
    const statement = sent[1];
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

    const statement = sent[1];
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

    expect(await insertCastVoice(WRITE)).toEqual({ inserted: false, replaced: null });
  });

  it("reports `inserted: false` on the unique index rather than throwing at a caller", async () => {
    const duplicate = Object.assign(new Error("ER_DUP_ENTRY"), { code: "ER_DUP_ENTRY", errno: 1062 });
    const failing = { ...recordingPool, query: () => Promise.reject(duplicate) };
    vi.doMock("./connection", () => ({
      getDb: async () => drizzle(failing as never, { mode: "default" } as never),
      withTransaction: async (run: (tx: unknown) => unknown) =>
        run(drizzle(failing as never, { mode: "default" } as never)),
    }));
    vi.resetModules();
    const { insertCastVoice: insertAgain } = await import("./castVoices");

    expect(await insertAgain(WRITE)).toEqual({ inserted: false, replaced: null });

    vi.doUnmock("./connection");
    vi.resetModules();
  });

  it("refuses a non-positive id before it reaches the database at all", async () => {
    await expect(readCastVoice(0, MODEL_ID)).rejects.toThrow(/userId/);
    await expect(readCastVoice(USER_ID, -1)).rejects.toThrow(/modelId/);
    expect(sent).toHaveLength(0);
  });

  /*
    THE CLIP'S WRITE-AHEAD MANIFEST IS DISCHARGED IN THIS SAME TRANSACTION —
    #2470's finding, item 2.

    The clip is in the PUBLIC bucket before this statement runs, named by a
    manifest and by no row, because a process death between the two would
    otherwise leave ninety seconds of a voice under a key no row points at —
    and both deletion roads find clips THROUGH the rows. These arms are about
    the three statements and their ORDER, because the order is the whole
    correctness argument.
  */
  it("discharges the clip's write-ahead manifest in the SAME transaction as the row", async () => {
    expect(await insertCastVoice(WRITE)).toEqual({ inserted: true, replaced: null });

    expect(sent).toHaveLength(4);
    expect(sent[0]?.sql).toMatch(/^select .* from `cast_voices`.* for update$/i);
    expect(sent[1]?.sql).toMatch(/^insert into `cast_voices`/i);
    expect(sent[2]?.sql).toMatch(/^delete from `storage_cleanup_items`/i);
    expect(sent[2]?.params).toContain(WRITE.cleanupBatchId);
    expect(sent[3]?.sql).toMatch(/^delete from `storage_cleanup_batches`/i);
    expect(sent[3]?.params).toEqual(
      expect.arrayContaining([WRITE.cleanupBatchId, USER_ID]),
    );
  });

  it("⚠ INSERTS BEFORE IT DISCHARGES, so a failed write never hands live bytes to the worker", async () => {
    /*
      THE ORDER IS THE CLAIM. Discharging first and inserting second would, on a
      zero-row insert, leave the clip with no manifest AND no row — the exact
      orphan this repair exists to close, reached by the repair itself.
    */
    affectedBySql = [{ match: /^insert into `cast_voices`/i, affected: 0 }];

    expect(await insertCastVoice(WRITE)).toEqual({ inserted: false, replaced: null });
    expect(sent).toHaveLength(2);
    expect(sent[1]?.sql).toMatch(/^insert into `cast_voices`/i);
    /* No discharge was attempted, so the manifest still stands and the worker
       collects the bytes — which is correct, since nothing references them. */
    expect(sent.some((one) => /storage_cleanup/i.test(one.sql))).toBe(false);
  });

  it("⚠ scopes the discharge to an UNDISCHARGED batch, never to the id alone", async () => {
    await insertCastVoice(WRITE);

    const discharge = sent[3]?.sql ?? "";
    /*
      `undischargedStorageCleanupBatchWhere()`'s shape. Without it this delete
      could retire a batch the cleanup worker had already claimed and begun
      deleting from — which would report success over bytes being removed.
    */
    expect(discharge).toMatch(/status/i);
    expect(discharge).toMatch(/leaseToken/i);
    expect(discharge).toMatch(/attemptedAt/i);
  });

  it("⚠ THROWS when there is no manifest to discharge, rather than reporting a write", async () => {
    /*
      POSITIVE CONTROL for the one case that must not be absorbed. This manifest
      was created by the same Keep moments earlier, so a zero-row discharge is an
      invariant violation and not a race — and dressing it up as `inserted:
      false` is how one would go unnoticed for months.
    */
    affectedBySql = [{ match: /^delete from `storage_cleanup_batches`/i, affected: 0 }];

    await expect(insertCastVoice(WRITE)).rejects.toThrow(CastVoiceManifestUndischargeable);
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

/**
 * CHANGE AND REMOVE — #2497, at the wire.
 *
 * His rule for a replace: *"the old voice is released only after the new one is
 * fully kept (slot saved, clip stored, row written); a failed replace leaves the
 * old voice exactly as it was."* By the time `insertCastVoice` runs the new slot
 * and clip exist, so these arms are about the one transaction that turns them
 * into the cast's voice — what it locks, what it proves, and what it hands to
 * the cleanup worker, in what order.
 *
 * The prior row is POSITIONAL (`id`, `voiceId`, `clipStorageKey`) for the reason
 * the line-read arm above gives.
 */
const OLD_CLIP = "casting/voices/41/907/old-voice.mp3";
const PRIOR_ROW = [[77, "old-saved-voice", OLD_CLIP]];

/** The manifest INSERTs a replace or a remove sent, with the old clip's key. */
function manifestWrites() {
  return sent.filter((one) => /^insert into `storage_cleanup_(batches|items)`/i.test(one.sql));
}

describe("a Keep on a cast that already has a voice replaces it (#2497)", () => {
  it("⚠ LOCKS the current voice with the owner bound, before anything is written", async () => {
    answers = [PRIOR_ROW];

    await insertCastVoice(WRITE);

    const read = sent[0];
    expect(read?.sql).toMatch(/^select .* from `cast_voices`/i);
    expect(read?.sql).toMatch(/for update$/i);
    expect(read?.params).toEqual(expect.arrayContaining([MODEL_ID, USER_ID]));
  });

  it("updates the ONE row in place — owner, cast, and the live signed cast in the same statement", async () => {
    answers = [PRIOR_ROW];

    expect(await insertCastVoice(WRITE)).toEqual({
      inserted: true,
      replaced: { voiceId: "old-saved-voice" },
    });

    const update = sent[1];
    expect(update?.sql).toMatch(/^update `cast_voices`/i);
    /* No second row: the unique index stays one voice per cast. */
    expect(sent.some((one) => /^insert into `cast_voices`/i.test(one.sql))).toBe(false);
    /* Keyed on the locked row's id AND the owner AND the cast … */
    expect(update?.params).toEqual(expect.arrayContaining([77, USER_ID, MODEL_ID]));
    /* … AND re-proved live and signed IN the statement (invariant 1): a cast
       deleted during the three provider calls must make this move zero rows. */
    expect(update?.sql).toMatch(/`cast_voices`\.`modelId` in \(select `id` from `models`/i);
    expect(update?.sql).toMatch(/deletedAt/);
    /* The new voice's facts, as bound values. */
    expect(update?.params).toEqual(expect.arrayContaining([SENTENCE, WRITE.clipStorageKey, WRITE.voiceId]));
    expect(update?.sql).not.toContain("decides");
  });

  it("⚠ HANDS THE OLD CLIP TO THE CLEANUP WORKER, unheld, in the same transaction", async () => {
    answers = [PRIOR_ROW];

    await insertCastVoice(WRITE);

    const writes = manifestWrites();
    expect(writes).toHaveLength(2);
    const [batch, items] = writes;
    /* The kind every other retired KEPT casting byte uses (face scans, removed
       ink designs) — and the value the column already has, so no migration. */
    expect(batch?.params).toContain("casting_candidate_cleanup");
    /* UNHELD: claimable at once, because nothing references these bytes now. */
    expect(batch?.params).toContain("pending");
    expect(batch?.params).toContain(USER_ID);
    expect(items?.params).toContain(OLD_CLIP);
    /* And it is the OLD clip that is queued — never the new one. */
    expect(items?.params).not.toContain(WRITE.clipStorageKey);
  });

  it("⚠ queues the old clip only AFTER the row stopped naming it, and discharges the new one last", async () => {
    answers = [PRIOR_ROW];

    await insertCastVoice(WRITE);

    const order = sent.map((one) => one.sql.slice(0, 40).toLowerCase());
    const updateAt = order.findIndex((one) => one.startsWith("update `cast_voices`"));
    const queueAt = order.findIndex((one) => one.startsWith("insert into `storage_cleanup_batches`"));
    const dischargeAt = order.findIndex((one) => one.startsWith("delete from `storage_cleanup_batches`"));
    expect(updateAt).toBeGreaterThan(0);
    expect(queueAt).toBeGreaterThan(updateAt);
    expect(dischargeAt).toBeGreaterThan(queueAt);
  });

  it("⚠ A REPLACE THAT LOSES ITS ROW QUEUES NOTHING — the old voice is left exactly as it was", async () => {
    /*
      The update moves zero rows (the cast went away mid-Keep). The transaction
      must throw before the old clip is queued: queueing it would delete the
      bytes of a voice the row still names.
    */
    answers = [PRIOR_ROW];
    affectedBySql = [{ match: /^update `cast_voices`/i, affected: 0 }];

    expect(await insertCastVoice(WRITE)).toEqual({ inserted: false, replaced: null });
    expect(manifestWrites()).toHaveLength(0);
    expect(sent.some((one) => /storage_cleanup/i.test(one.sql))).toBe(false);
  });
});

describe("Remove voice (#2497)", () => {
  it("removes the row, queues its clip, and hands back the slot to release", async () => {
    answers = [PRIOR_ROW];

    expect(await removeCastVoice(USER_ID, MODEL_ID)).toEqual({ voiceId: "old-saved-voice" });

    expect(sent[0]?.sql).toMatch(/^select .* from `cast_voices`.* for update$/i);
    expect(sent[0]?.params).toEqual(expect.arrayContaining([MODEL_ID, USER_ID]));
    const writes = manifestWrites();
    expect(writes[0]?.params).toContain("casting_candidate_cleanup");
    expect(writes[0]?.params).toContain("pending");
    expect(writes[1]?.params).toContain(OLD_CLIP);
    const removal = sent.find((one) => /^delete from `cast_voices`/i.test(one.sql));
    /* The owner AGAIN on the delete, never the id alone (invariant 1). */
    expect(removal?.params).toEqual(expect.arrayContaining([77, USER_ID, MODEL_ID]));
    /* The clip is queued BEFORE the row that names it goes, inside one
       transaction — so a crash leaves both or neither. */
    expect(sent.indexOf(writes[1]!)).toBeLessThan(sent.indexOf(removal!));
  });

  it("answers null and writes nothing when the cast has no voice", async () => {
    answers = [[]];

    expect(await removeCastVoice(USER_ID, MODEL_ID)).toBeNull();
    expect(sent).toHaveLength(1);
  });

  it("refuses a non-positive id before it reaches the database", async () => {
    await expect(removeCastVoice(0, MODEL_ID)).rejects.toThrow(/userId/);
    expect(sent).toHaveLength(0);
  });
});
