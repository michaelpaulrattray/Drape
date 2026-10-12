/**
 * THE TWO STATEMENTS BEHIND "GOOGLE SIGN-IN MATCHES THE PERSON" (#2389), READ
 * AT THE WIRE.
 *
 * `server/routes/googleAuth.test.ts` drives the four sign-in paths with these
 * two helpers standing in as the far end. This file proves what the helpers
 * themselves send, because the contract is about the statement (invariant 5):
 *
 *   1. the lookup asks for BOTH ways an account can carry a Google `sub` — the
 *      `google_<sub>` openId Google-created accounts have, and the `googleSub`
 *      column a linked account has — and returns up to two rows so the route
 *      can refuse a sub claimed twice;
 *   2. the bind writes ONLY a row that is still unbound, and reports whether it
 *      landed, so a racing second sign-in cannot rebind an account.
 *
 * `vitest.setup.ts` strips `DATABASE_URL`, so a row-level suite would skip and
 * read green. The pool below records and never connects — the shape
 * `castPersonaWrite.test.ts` uses.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const sent: Array<{ sql: string; params: unknown[] }> = [];
/** What the driver answers an UPDATE with next. */
const answer = { affectedRows: 1 };

const recordingPool = {
  query(...args: unknown[]) {
    const config = args[0] as { sql?: string; values?: unknown[] } | string;
    const sql = typeof config === "string" ? config : config.sql ?? "";
    const params = (args[1] as unknown[])
      ?? (typeof config === "string" ? [] : config.values ?? []);
    sent.push({ sql, params });
    /* A SELECT is answered with no rows; an UPDATE with the staged count. */
    const rows = /^\s*select/i.test(sql) ? [] : { ...answer };
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
}));

const { getUsersByGoogleSub, bindGoogleSub } = await import("./users");

beforeEach(() => {
  sent.length = 0;
  answer.affectedRows = 1;
});

function onlyStatement(): { sql: string; params: unknown[] } {
  expect(sent).toHaveLength(1);
  return sent[0]!;
}

describe("getUsersByGoogleSub — every account bound to one Google account", () => {
  it("asks for the google_<sub> openId AND the linked googleSub, in one statement", async () => {
    await getUsersByGoogleSub("1234567890");

    const { sql, params } = onlyStatement();
    expect(sql).toMatch(/`users`\.`openId` = \?/);
    expect(sql).toMatch(/`users`\.`googleSub` = \?/);
    expect(sql).toMatch(/ or /i);
    expect(params).toContain("google_1234567890");
    expect(params).toContain("1234567890");
  });

  it("reads up to TWO rows, so a sub claimed twice is visible to the caller", async () => {
    await getUsersByGoogleSub("1234567890");

    const { sql, params } = onlyStatement();
    expect(sql).toMatch(/limit \?/i);
    expect(params.at(-1)).toBe(2);
  });

  it("never matches on the address", async () => {
    await getUsersByGoogleSub("1234567890");

    /* The WHERE only — the select list names every column, `email` included. */
    const where = onlyStatement().sql.split(/ where /i)[1] ?? "";
    expect(where).toMatch(/googleSub/);
    expect(where).not.toMatch(/email/);
  });
});

describe("bindGoogleSub — the first Google sign-in of an unbound account", () => {
  it("writes the sub ONLY to that account, and only while it is still unbound", async () => {
    await bindGoogleSub(7, "1234567890");

    const { sql, params } = onlyStatement();
    expect(sql).toMatch(/^update `users` set `googleSub` = \?/i);
    expect(sql).toMatch(/`users`\.`id` = \?/);
    expect(sql).toMatch(/`users`\.`googleSub` is null/i);
    expect(params).toEqual(["1234567890", 7]);
  });

  it("POSITIVE CONTROL: reports a binding that landed", async () => {
    answer.affectedRows = 1;
    await expect(bindGoogleSub(7, "1234567890")).resolves.toBe(true);
  });

  it("NEGATIVE CONTROL: reports a binding another sign-in already made as NOT landed", async () => {
    answer.affectedRows = 0;
    await expect(bindGoogleSub(7, "1234567890")).resolves.toBe(false);
  });
});
