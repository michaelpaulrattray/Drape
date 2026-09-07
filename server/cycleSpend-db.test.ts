/**
 * THE CYCLE SPEND AGAINST A REAL DATABASE — #624.
 *
 * `server/cycleSpend.test.ts` proves the DECISIONS: which instant the window
 * opens at, and which branch an absent or future period takes. This file proves
 * the STATEMENT — that the sum MySQL actually runs drops a transaction that
 * belongs to the previous cycle, keeps the one that belongs to this one, and
 * cannot see a stranger's spend at all.
 *
 * ⚠ **THE CARD'S BAR CANNOT BE MET BY A MOCK.** Its words: *"driven with a
 * period starting mid-day and spend on both sides of the boundary: the
 * pre-renewal spend must NOT be counted, and the post-renewal spend must be."*
 * A boundary is a `>=` in a WHERE clause; a fake that answers like the outcome
 * would be measuring the fake (`fake-reader-must-model-the-measurement`). So
 * the rows go into a real `point_transactions` table and the answer comes back
 * through the real reader.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 *   npx tsx scripts/drive-casting-v2-segment-store-disposable.mts \
 *     --suite server/cycleSpend-db.test.ts
 * which creates one, replays the journal into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("#624 — the cycle spend, summed by MySQL (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let billing: typeof import("./db/billing");

  /** `2026-09-05 14:00:00` — a period that began when the customer paid. */
  const PERIOD_START = new Date("2026-09-05T14:00:00Z");
  /** The morning of the same UTC day: the PREVIOUS cycle's money. */
  const BEFORE = new Date("2026-09-05T09:00:00Z");
  /** An hour after the renewal: this cycle's money. */
  const AFTER = new Date("2026-09-05T15:00:00Z");
  const NOW = new Date("2026-09-06T14:00:00Z");

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`cycle-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  /** `point_transactions` stores UTC; the driver connection must not shift it. */
  const asSql = (at: Date) => at.toISOString().slice(0, 19).replace("T", " ");

  async function setPeriod(userId: number, start: Date | null): Promise<void> {
    await connection.execute(
      "INSERT INTO points (userId, balance, currentPeriodStart) VALUES (?, 20000, ?)"
        + " ON DUPLICATE KEY UPDATE currentPeriodStart = VALUES(currentPeriodStart)",
      [userId, start ? asSql(start) : null],
    );
  }

  /** A spend is a NEGATIVE amount — the same shape `deductCredits` writes. */
  async function spend(userId: number, credits: number, at: Date): Promise<void> {
    await connection.execute(
      "INSERT INTO point_transactions (userId, amount, type, description, referenceId, balanceAfter, createdAt)"
        + " VALUES (?, ?, 'generation', 'driven', ?, 0, ?)",
      [userId, -credits, randomUUID(), asSql(at)],
    );
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection({ uri: testDatabaseUrl!, timezone: "Z" });
    owner = await newUser("Cycle Owner");
    stranger = await newUser("Cycle Stranger");
    billing = await import("./db/billing");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM point_transactions");
    await connection.query("DELETE FROM points");
  });

  it("⚠ THE CARD'S BAR: the pre-renewal spend is dropped and the post-renewal spend is kept", async () => {
    await setPeriod(owner, PERIOD_START);
    await spend(owner, 9_000, BEFORE);
    await spend(owner, 1_000, AFTER);

    const reading = await billing.getCycleSpend(owner, NOW);

    expect(reading.basis).toBe("period");
    expect(
      reading.spent,
      "the morning's 9,000 belonged to the previous cycle and was counted anyway",
    ).toBe(1_000);
  });

  it("⚠ AND THE OLD ROAD WOULD HAVE ANSWERED 10,000 — driven, not asserted about", async () => {
    /*
      THE ARM THAT MAKES THE FIX LEGIBLE. Without this, the arm above passes on
      any reader that happens to return 1,000, including one that never looked
      at the boundary. Here the DAY-KEYED window the three surfaces used to
      compute is run against the same rows, and the two answers are shown to
      disagree by the whole of the previous cycle's morning.
    */
    await setPeriod(owner, PERIOD_START);
    await spend(owner, 9_000, BEFORE);
    await spend(owner, 1_000, AFTER);

    const dayKeyed = await connection.query<any[]>(
      "SELECT COALESCE(SUM(ABS(amount)), 0) AS spent FROM point_transactions"
        + " WHERE userId = ? AND amount < 0 AND createdAt >= ?",
      [owner, `${PERIOD_START.toISOString().slice(0, 10)} 00:00:00`],
    );
    const oldAnswer = Number((dayKeyed[0] as any[])[0].spent);
    const newAnswer = (await billing.getCycleSpend(owner, NOW)).spent;

    expect(oldAnswer, "the fixture cannot show the defect — the old edge caught nothing extra")
      .toBe(10_000);
    expect(newAnswer).toBe(1_000);
    expect(oldAnswer - newAnswer, "the two readings agree, so nothing was fixed").toBe(9_000);
  });

  it("⚠ THE NEGATIVE CONTROL: a period starting at exactly midnight is unchanged", async () => {
    /*
      The card's own second bar. The mid-day case is the defect; the midnight
      case is the one the old road already got right, and a repair that moved it
      would be a different window rather than a more precise one.
    */
    const midnight = new Date("2026-09-05T00:00:00Z");
    await setPeriod(owner, midnight);
    await spend(owner, 4_000, new Date("2026-09-05T09:00:00Z"));
    await spend(owner, 2_000, new Date("2026-09-04T23:00:00Z"));

    const reading = await billing.getCycleSpend(owner, NOW);
    expect(reading.spent, "the midnight case moved").toBe(4_000);
  });

  it("⚠ a stranger's spend is invisible, and it is invisible in the STATEMENT", async () => {
    /*
      Enforcement invariant 1: the owner is in the WHERE, not checked beforehand.
      The stranger's rows sit inside the same window, so a sum that forgot the
      user would return 6,000 rather than 1,000.
    */
    await setPeriod(owner, PERIOD_START);
    await setPeriod(stranger, PERIOD_START);
    await spend(owner, 1_000, AFTER);
    await spend(stranger, 5_000, AFTER);

    expect((await billing.getCycleSpend(owner, NOW)).spent).toBe(1_000);
    expect((await billing.getCycleSpend(stranger, NOW)).spent).toBe(5_000);
  });

  it("⚠ a GRANT is not a spend — only negative amounts are summed", async () => {
    /*
      `point_transactions` holds both directions: a subscription grant is a
      positive amount on the same table. Summing the absolute value of every row
      would report a top-up as usage and put the burn rate above the truth.
    */
    await setPeriod(owner, PERIOD_START);
    await spend(owner, 1_000, AFTER);
    await connection.execute(
      "INSERT INTO point_transactions (userId, amount, type, description, referenceId, balanceAfter, createdAt)"
        + " VALUES (?, 75000, 'subscription', 'driven grant', ?, 0, ?)",
      [owner, randomUUID(), asSql(AFTER)],
    );

    expect((await billing.getCycleSpend(owner, NOW)).spent).toBe(1_000);
  });

  it("⚠ an ANNUAL period sums the whole period, past the 90 days the old endpoint capped at", async () => {
    /*
      PR #622's finding 1, dissolved rather than worked around. `getDailyUsage`
      caps at 90 days, so an annual subscriber's window could never be summed —
      the old road divided a 90-day total by the days the period had run and
      understated the burn by more than half.
    */
    const DAY = 86_400_000;
    const annualStart = new Date(NOW.getTime() - 200 * DAY);
    await setPeriod(owner, annualStart);
    await spend(owner, 7_000, new Date(NOW.getTime() - 150 * DAY));
    await spend(owner, 3_000, new Date(NOW.getTime() - 10 * DAY));
    /* Outside even the annual period: it must not be counted. */
    await spend(owner, 500, new Date(annualStart.getTime() - DAY));

    const reading = await billing.getCycleSpend(owner, NOW);
    expect(reading.spent).toBe(10_000);
    expect(Math.round(reading.days)).toBe(200);
  });

  it("⚠ no rows is a spend of zero and NOT a refusal — the two are different answers", async () => {
    /*
      A customer who has not cast this cycle has genuinely spent nothing, and
      the surfaces render that (the burn band hides itself). The refusal path is
      a database that did not answer, which is a throw — proved by the reader's
      own shape in `server/cycleSpend.test.ts`.
    */
    await setPeriod(owner, PERIOD_START);
    const reading = await billing.getCycleSpend(owner, NOW);
    expect(reading.spent).toBe(0);
    expect(reading.basis).toBe("period");
  });

  it("an account with no points row at all falls back to the rolling window", async () => {
    /* A signed-in account that has never been granted credits has no row. The
       reader must not throw on that — it is an ordinary state, not a failure. */
    await spend(owner, 250, new Date(NOW.getTime() - 3 * 86_400_000));
    const reading = await billing.getCycleSpend(owner, NOW);
    expect(reading.basis).toBe("rolling30");
    expect(reading.spent).toBe(250);
  });
});
