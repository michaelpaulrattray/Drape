/**
 * #789 — `getCreditTransactionByRef` answers `null` for "no such row" and
 * THROWS for "database unavailable". Until this card the two shared `null`,
 * and the two webhook handlers that restore credits from a deduction row
 * (dispute won, refund failed) read a no-db window as "nothing to restore"
 * and ACKed the event — Stripe never sent it again.
 *
 * All three arms run the REAL reader over a doubled connection (`getDb()`
 * answering null, an empty result, a row). The two controls are what make
 * the first arm mean anything — a reader that throws on everything would
 * pass it.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const connection = vi.hoisted(() => ({
  rows: [] as unknown[],
  available: false,
}));

vi.mock("./connection", () => ({
  getDb: vi.fn().mockImplementation(async () =>
    connection.available
      ? {
          select: () => ({
            from: () => ({ where: () => ({ limit: async () => connection.rows }) }),
          }),
        }
      : null,
  ),
}));

import { getCreditTransactionByRef } from "./credits";
import { getUserByStripeCustomerId } from "./billing";

describe("getCreditTransactionByRef distinguishes 'no row' from 'no database' (#789)", () => {
  beforeEach(() => {
    connection.rows = [];
    connection.available = false;
  });

  it("THROWS when the database is unavailable — never the truthful-sounding null", async () => {
    await expect(getCreditTransactionByRef(42, "dispute_dp_1")).rejects.toThrow("Database not available");
  });

  it("answers null when the database is up and no row carries the reference (the control)", async () => {
    connection.available = true;
    await expect(getCreditTransactionByRef(42, "dispute_dp_1")).resolves.toBeNull();
  });

  it("answers the row when one carries the reference (the positive control)", async () => {
    connection.available = true;
    const row = { id: 9, userId: 42, amount: -75, referenceId: "dispute_dp_1" };
    connection.rows = [row];
    await expect(getCreditTransactionByRef(42, "dispute_dp_1")).resolves.toBe(row);
  });
});

/*
  PR #791 review finding 1: on the dispute roads the FIRST read is the customer
  lookup, and `getDb()` caches, so it is the read that meets a no-db window.
  Same contract: throw on no database, null on no account, the account when
  one holds the customer id.
*/
describe("getUserByStripeCustomerId distinguishes 'no account' from 'no database' (#789)", () => {
  beforeEach(() => {
    connection.rows = [];
    connection.available = false;
  });

  it("THROWS when the database is unavailable — never the 'user not identified' null", async () => {
    await expect(getUserByStripeCustomerId("cus_1")).rejects.toThrow("Database not available");
  });

  it("answers null when the database is up and no account holds the customer id (the control)", async () => {
    connection.available = true;
    await expect(getUserByStripeCustomerId("cus_nobody")).resolves.toBeNull();
  });
});
