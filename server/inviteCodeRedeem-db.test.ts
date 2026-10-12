/**
 * AN ACCESS CODE'S LIMIT, AGAINST A REAL DATABASE (#2373).
 *
 * `server/db/inviteCodeRedeemRace.test.ts` holds the helper's logic with the
 * database faked, and says plainly that its fake interprets two predicates.
 * This file is the part a fake cannot prove: real MySQL row locks, real
 * `affectedRows`, real rollback — two redeems of a one-use code fired at once
 * through the real helper admit exactly one person.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --suite
 * server/inviteCodeRedeem-db.test.ts`, which creates one, replays the
 * migrations into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("redeemInviteCode (disposable DB)", () => {
  let connection: Connection;
  let redeemInviteCode: typeof import("./db/inviteCodes")["redeemInviteCode"];

  async function newUser(): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Code race', 0, 1)",
      [`code-race-${randomUUID()}`],
    );
    return row.insertId;
  }

  async function newCode(maxUses: number): Promise<string> {
    const code = `RACE-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    await connection.execute(
      "INSERT INTO invite_codes (code, createdBy, maxUses) VALUES (?, 1, ?)",
      [code, maxUses],
    );
    return code;
  }

  async function uses(code: string): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT currentUses FROM invite_codes WHERE code = ?",
      [code],
    );
    return Number(rows[0].currentUses);
  }

  async function approvedAmong(ids: number[]): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM users WHERE id IN (?) AND approved = 1",
      [ids],
    );
    return Number(rows[0].n);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    ({ redeemInviteCode } = await import("./db/inviteCodes"));
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("CONTROL — one person, one free use: approved, counter 1", async () => {
    const code = await newCode(1);
    const person = await newUser();

    await expect(redeemInviteCode(person, code)).resolves.toEqual({ success: true });
    expect(await uses(code)).toBe(1);
    expect(await approvedAmong([person])).toBe(1);
  });

  it("THE RACE — several people redeem a one-use code at once: exactly one is let in, the counter reads 1", async () => {
    const code = await newCode(1);
    const people = await Promise.all([newUser(), newUser(), newUser(), newUser()]);

    const outcomes = await Promise.all(people.map((id) => redeemInviteCode(id, code)));

    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(await uses(code)).toBe(1);
    expect(await approvedAmong(people)).toBe(1);
  });

  it("ONE PERSON RACING THEMSELVES on a five-use code spends exactly one use", async () => {
    const code = await newCode(5);
    const person = await newUser();

    const outcomes = await Promise.all([1, 2, 3, 4].map(() => redeemInviteCode(person, code)));

    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(await uses(code)).toBe(1);
  });
});
