/**
 * A FAILED ACCOUNT DELETION DOES NOT HAND BACK THE VALUES IT WAS WRITING (#2222).
 *
 * `deleteUserAccount` runs its whole erasure inside one transaction, so its
 * catch holds a failed query, and it returns that error's message as `error`.
 * Driven by running the real function against a transaction that throws a REAL
 * `DrizzleQueryError` from a real drizzle UPDATE (`./testing/failedWrite`).
 *
 * The negative control is the fixture itself: the raw message carries the
 * sentinel, so the reduced `error` lacking it is the reduction's doing.
 */
import { describe, expect, it, vi } from "vitest";

import { failedWrite, SENTINEL } from "./testing/failedWrite";

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  withTransaction: vi.fn().mockImplementation(async () => {
    throw await failedWrite();
  }),
}));

const { deleteUserAccount } = await import("./db/accountDeletion");

describe("deleteUserAccount's failure", () => {
  it("NEGATIVE CONTROL: the failed write it catches carries the customer's words in its message", async () => {
    expect((await failedWrite()).message).toContain(SENTINEL);
  });

  it("returns the failure's SQL shape with every value withheld", async () => {
    const result = await deleteUserAccount(42);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Failed query: update `casts` set `persona` = \?/);
    expect(result.error).toContain("params: [withheld]");
    expect(result.error).not.toContain(SENTINEL);
  });
});
