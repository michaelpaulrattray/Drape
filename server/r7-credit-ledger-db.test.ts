/**
 * Disposable-DB proof for migration 0006. Set TEST_DATABASE_URL to an
 * isolated MySQL database with migrations through 0006 applied. Unit-test
 * setup deliberately strips DATABASE_URL, so this suite can never fall back
 * to the configured development or production database.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-1B unique credit ledger (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  let addCredits: typeof import("./db/credits")["addCredits"];
  let deductCredits: typeof import("./db/credits")["deductCredits"];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);

    const [indexRows] = await connection.query<RowDataPacket[]>(
      "SHOW INDEX FROM point_transactions WHERE Key_name = 'uq_point_txn_user_ref'",
    );
    if (indexRows.length === 0 || Number(indexRows[0].Non_unique) !== 0) {
      throw new Error("Disposable database must have migration 0006 applied before this suite runs");
    }

    const openId = `r7-ledger-${randomUUID()}`;
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7 Ledger Test', 1, 1)",
      [openId],
    );
    userId = inserted.insertId;
    await connection.execute(
      "INSERT INTO points (userId, balance, planTier, creditsPurchased, creditsUsed, rolloverCredits) VALUES (?, 5000, 'free', 0, 0, 0)",
      [userId],
    );

    ({ addCredits, deductCredits } = await import("./db/credits"));
  });

  beforeEach(async () => {
    await connection.execute("DELETE FROM point_transactions WHERE userId = ?", [userId]);
    await connection.execute(
      "UPDATE points SET balance = 5000, creditsPurchased = 0, creditsUsed = 0 WHERE userId = ?",
      [userId],
    );
  }, 30_000);

  afterAll(async () => {
    if (!connection) return;
    await connection.execute("DELETE FROM point_transactions WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM points WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
    delete process.env.DATABASE_URL;
  });

  it("records twenty concurrent exact additions once", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => addCredits(userId, 350, "refund", "concurrent refund", "r7:add:one")),
    );
    expect(results.filter((result) => result.success && !result.duplicate)).toHaveLength(1);
    expect(results.filter((result) => result.success && result.duplicate)).toHaveLength(19);

    const [[balance]] = await connection.query<RowDataPacket[]>("SELECT balance FROM points WHERE userId = ?", [userId]);
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM point_transactions WHERE userId = ? AND referenceId = 'r7:add:one'",
      [userId],
    );
    expect(Number(balance.balance)).toBe(5_350);
    expect(Number(count.n)).toBe(1);
  }, 60_000);

  it("records twenty concurrent deductions once and refuses every replay", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => deductCredits(userId, 300, "generation", "concurrent charge", "r7:deduct:one")),
    );
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success && result.duplicate)).toHaveLength(19);

    const [[balance]] = await connection.query<RowDataPacket[]>(
      "SELECT balance, creditsUsed FROM points WHERE userId = ?",
      [userId],
    );
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM point_transactions WHERE userId = ? AND referenceId = 'r7:deduct:one'",
      [userId],
    );
    expect(Number(balance.balance)).toBe(4_700);
    expect(Number(balance.creditsUsed)).toBe(300);
    expect(Number(count.n)).toBe(1);
  }, 60_000);

  it("keeps duplicate charge classification after the first charge exhausts the balance", async () => {
    await connection.execute("UPDATE points SET balance = 300 WHERE userId = ?", [userId]);

    await expect(
      deductCredits(userId, 300, "generation", "exhausting charge", "r7:deduct:exhaust"),
    ).resolves.toMatchObject({ success: true });
    await expect(
      deductCredits(userId, 300, "generation", "exhausting charge replay", "r7:deduct:exhaust"),
    ).resolves.toMatchObject({
      success: false,
      error: "Credit charge already recorded",
      duplicate: true,
    });

    const [[balance]] = await connection.query<RowDataPacket[]>(
      "SELECT balance FROM points WHERE userId = ?",
      [userId],
    );
    expect(Number(balance.balance)).toBe(0);
  }, 30_000);

  it("keeps multiple legacy null references legal", async () => {
    await expect(addCredits(userId, 10, "bonus", "legacy null one")).resolves.toMatchObject({ success: true });
    await expect(addCredits(userId, 10, "bonus", "legacy null two")).resolves.toMatchObject({ success: true });
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM point_transactions WHERE userId = ? AND referenceId IS NULL",
      [userId],
    );
    expect(Number(count.n)).toBe(2);
  }, 30_000);

  it("makes an old check-then-write runtime lose safely under the new index", async () => {
    let arrivals = 0;
    let release!: () => void;
    const bothSelected = new Promise<void>((resolve) => { release = resolve; });

    const legacyAdd = async () => {
      const legacy = await mysql.createConnection(testDatabaseUrl!);
      try {
        await legacy.beginTransaction();
        const [existing] = await legacy.query<RowDataPacket[]>(
          "SELECT id FROM point_transactions WHERE userId = ? AND referenceId = 'r7:legacy:mixed' LIMIT 1",
          [userId],
        );
        if (existing.length > 0) {
          await legacy.rollback();
          return "prechecked" as const;
        }
        arrivals += 1;
        if (arrivals === 2) release();
        await bothSelected;
        await legacy.execute("UPDATE points SET balance = balance + 75 WHERE userId = ?", [userId]);
        await legacy.execute(
          "INSERT INTO point_transactions (userId, amount, type, description, referenceId, balanceAfter) SELECT ?, 75, 'bonus', 'legacy writer', 'r7:legacy:mixed', balance FROM points WHERE userId = ?",
          [userId, userId],
        );
        await legacy.commit();
        return "committed" as const;
      } catch (error) {
        await legacy.rollback();
        throw error;
      } finally {
        await legacy.end();
      }
    };

    const outcomes = await Promise.allSettled([legacyAdd(), legacyAdd()]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const [[balance]] = await connection.query<RowDataPacket[]>("SELECT balance FROM points WHERE userId = ?", [userId]);
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM point_transactions WHERE userId = ? AND referenceId = 'r7:legacy:mixed'",
      [userId],
    );
    expect(Number(balance.balance)).toBe(5_075);
    expect(Number(count.n)).toBe(1);
  }, 30_000);
});
