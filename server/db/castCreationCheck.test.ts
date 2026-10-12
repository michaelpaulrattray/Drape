/**
 * THE PUBLIC CHECK PAGE'S STATEMENTS, READ AT THE WIRE (#2313).
 *
 * `vitest.setup.ts` strips `DATABASE_URL`, so a row-level suite would SKIP on
 * the gate and read green while proving nothing. So the real functions are
 * driven against a pool that records the SQL it is handed and never connects
 * (the shape `castCreationRecords.test.ts` uses), and every assertion is about
 * a statement actually sent.
 *
 * ⚠ THE THREE-ARM NO-EXISTENCE-ORACLE RULE, AT THE DATABASE. The public read is
 * ONE statement, and each of the three IDs that must look identical is kept out
 * of it by a clause of that one statement:
 *
 *   an ID that does not exist   → `models.agencyId = ?` (bound to the asked ID)
 *   an ID whose page is off     → `cast_creation_records.publicAt is not null`
 *   a deleted cast's ID         → `models.deletedAt is null` and the live
 *                                  status set, joined on the record's own owner
 *
 * so all three come back as "no row" from the same single round trip. The
 * router half (`server/creationCheckRoute.test.ts`) proves "no row" becomes one
 * identical answer; the live half was driven on the dev database (the PR body).
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const USER_ID = 41;
const MODEL_ID = 907;
const KI = "KI-AAAA-BBBB-CCCC-DDDD";

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
    throw new Error("castCreationCheck.test.ts: no transaction is expected on these statements");
  },
}));

const {
  readCreationCheckSwitch,
  readPublicCreationCheck,
  resolveOwnedSignedCast,
  setCreationCheckPublic,
} = await import("./castCreationCheck");

beforeEach(() => {
  sent.length = 0;
  answers = [];
  writeAffected = 1;
});

const RECIPE = /masterPrompt|technicalSchema|preferences|storageKey|imageUrl|resultUrl|`email`|passwordHash/i;

function bindsOwner(statement: { sql: string; params: unknown[] }): boolean {
  return /`userId`\s*=\s*\?/.test(statement.sql) && statement.params.includes(USER_ID);
}

describe("the public read — one statement, and each oracle arm is a clause of it", () => {
  it("sends exactly ONE statement, whatever the answer", async () => {
    await readPublicCreationCheck(KI);
    expect(sent).toHaveLength(1);
    answers = [[[KI, USER_ID, "{}", null]]];
    sent.length = 0;
    await readPublicCreationCheck(KI);
    expect(sent).toHaveLength(1);
  });

  it("arm 1 — an unknown ID: the statement is keyed on the asked ID", async () => {
    await readPublicCreationCheck(KI);
    expect(sent[0]!.sql).toMatch(/`models`\.`agencyId`\s*=\s*\?/);
    expect(sent[0]!.params).toContain(KI);
  });

  it("arm 2 — a private ID: only a record whose page is ON can come back", async () => {
    await readPublicCreationCheck(KI);
    expect(sent[0]!.sql).toMatch(/`cast_creation_records`\.`publicAt` is not null/);
  });

  it("arm 3 — a deleted cast's ID: only a live, signed cast of the record's own owner joins", async () => {
    await readPublicCreationCheck(KI);
    const sql = sent[0]!.sql;
    expect(sql).toMatch(/inner join `models`/);
    expect(sql).toMatch(/`models`\.`deletedAt` is null/);
    expect(sql).toMatch(/`models`\.`status` in \(\?, \?, \?\)/);
    expect(sql).toMatch(/`models`\.`sourceCandidateId` is not null/);
    /* The owner comes from the record row itself, never from anything a stranger sends. */
    expect(sql).toMatch(/`models`\.`userId`\s*=\s*`cast_creation_records`\.`userId`/);
    expect(sent[0]!.params).not.toContain("archived");
  });

  it("selects no picture, no recipe and no address — an explicit projection (invariant 8)", async () => {
    await readPublicCreationCheck(KI);
    const selected = sent[0]!.sql.slice(0, sent[0]!.sql.toLowerCase().indexOf(" from "));
    expect(selected).not.toMatch(RECIPE);
    expect(selected).toMatch(/`recordJson`/);
    /* ⚠ The cast's name is never read for a stranger (finding 1 on PR #2325). */
    expect(selected).not.toMatch(/`models`\.`name`/);
    expect(selected).toMatch(/`stampedAt`/);
    /* POSITIVE CONTROL for the reader above: it does see a recipe column when one is there. */
    expect("select `masterPrompt` ").toMatch(RECIPE);
  });

  it("returns null for no row, and the row for one", async () => {
    expect(await readPublicCreationCheck(KI)).toBeNull();
    sent.length = 0;
    answers = [[[KI, USER_ID, "{\"a\":1}", null]]];
    expect(await readPublicCreationCheck(KI)).toEqual({
      kliegId: KI,
      ownerId: USER_ID,
      recordJson: "{\"a\":1}",
      stampedAt: null,
    });
  });
});

describe("the owner's statements carry the owner (invariants 1 and 2)", () => {
  it("resolving the cast binds the owner and the live, signed predicate", async () => {
    answers = [[[MODEL_ID]]];
    expect(await resolveOwnedSignedCast(USER_ID, KI)).toEqual({ modelId: MODEL_ID });
    expect(sent).toHaveLength(1);
    expect(bindsOwner(sent[0]!)).toBe(true);
    expect(sent[0]!.sql).toMatch(/`deletedAt` is null/);
    expect(sent[0]!.sql).not.toMatch(RECIPE);
  });

  it("reading the switch joins the owner's live cast", async () => {
    await readCreationCheckSwitch(USER_ID, MODEL_ID);
    expect(bindsOwner(sent[0]!)).toBe(true);
    expect(sent[0]!.sql).toMatch(/inner join `models`/);
  });

  it("turning ON writes publicAt only on the owner's record of a live cast, and keeps an earlier time", async () => {
    const at = new Date("2026-10-12T05:00:00Z");
    expect(await setCreationCheckPublic({ userId: USER_ID, modelId: MODEL_ID, on: true, now: at })).toEqual({ updated: true });
    expect(sent).toHaveLength(1);
    const write = sent[0]!;
    expect(write.sql).toMatch(/^update `cast_creation_records` set `publicAt` = \?/);
    expect(bindsOwner(write)).toBe(true);
    /* The RECORD's own owner column, not only the subquery's (which binds the same id). */
    expect(write.sql).toMatch(/`cast_creation_records`\.`userId` = \?/);
    expect(write.sql).toMatch(/`publicAt` is null/);
    expect(write.sql).toMatch(/`modelId` in \(select `id` from `models`/);
  });

  it("turning OFF nulls publicAt, owner and live cast in the same statement", async () => {
    expect(await setCreationCheckPublic({ userId: USER_ID, modelId: MODEL_ID, on: false })).toEqual({ updated: true });
    const write = sent[0]!;
    expect(write.sql).toMatch(/^update `cast_creation_records` set `publicAt` = \?/);
    expect(write.params[0]).toBeNull();
    expect(write.sql).toMatch(/`cast_creation_records`\.`userId` = \?/);
    expect(write.sql).not.toMatch(/`publicAt` is null/);
    expect(bindsOwner(write)).toBe(true);
  });

  it("a write that moves nothing reads the switch back rather than guessing", async () => {
    writeAffected = 0;
    /* No record for this owner's live cast: nothing to switch. */
    expect(await setCreationCheckPublic({ userId: USER_ID, modelId: MODEL_ID, on: true })).toEqual({ updated: false });
    expect(sent).toHaveLength(2);
    expect(bindsOwner(sent[1]!)).toBe(true);
    /* Already on: the no-op is a success, not a refusal. */
    sent.length = 0;
    answers = [[], [[new Date("2026-10-01T00:00:00Z")]]];
    expect(await setCreationCheckPublic({ userId: USER_ID, modelId: MODEL_ID, on: true })).toEqual({ updated: true });
  });
});
