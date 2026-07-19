import { beforeEach, describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => ({
  getDb: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("./db/connection", () => connection);

import {
  addCredits,
  creditReferenceSemanticsMatch,
  deductCredits,
  isDuplicateCreditReferenceError,
  normalizeCreditReferenceId,
} from "./db/credits";

function duplicateLookupDb(existing: { id: number; type: string; amount: number }, balance = 900) {
  let query = 0;
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => {
          query += 1;
          return query === 1 ? [existing] : [{ balance }];
        }),
      })),
    })),
  }));
  return { select };
}

describe("R7-1B credit-reference semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.withTransaction.mockRejectedValue({ code: "ER_DUP_ENTRY", errno: 1062 });
  });

  it("recognizes direct and wrapped MySQL duplicate-key errors", () => {
    expect(isDuplicateCreditReferenceError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isDuplicateCreditReferenceError({ cause: { errno: 1062 } })).toBe(true);
    expect(isDuplicateCreditReferenceError(new Error("other"))).toBe(false);
  });

  it("matches only the same type and signed amount", () => {
    expect(creditReferenceSemanticsMatch(
      { type: "refund", amount: 350 },
      { type: "refund", amount: 350 },
    )).toBe(true);
    expect(creditReferenceSemanticsMatch(
      { type: "refund", amount: 350 },
      { type: "bonus", amount: 350 },
    )).toBe(false);
    expect(creditReferenceSemanticsMatch(
      { type: "generation", amount: -350 },
      { type: "generation", amount: -300 },
    )).toBe(false);
  });

  it("keeps short references readable and deterministically bounds long child references", () => {
    expect(normalizeCreditReferenceId("refund:gen-11")).toBe("refund:gen-11");
    const long = `refund:casting-image-${"9".repeat(20)}-${"a".repeat(36)}`;
    const normalized = normalizeCreditReferenceId(long);
    expect(normalized).toHaveLength(64);
    expect(normalized).toMatch(/^sha256:[a-f0-9]{57}$/);
    expect(normalizeCreditReferenceId(long)).toBe(normalized);
    expect(normalizeCreditReferenceId(`${long}-different`)).not.toBe(normalized);
  });

  it("treats an exact duplicate addition as success and returns current balance", async () => {
    connection.getDb.mockResolvedValue(duplicateLookupDb({ id: 11, type: "refund", amount: 350 }, 1_250));
    await expect(addCredits(7, 350, "refund", "retry", "refund:op-1")).resolves.toEqual({
      success: true,
      newBalance: 1_250,
      duplicate: true,
    });
  });

  it("refuses a mismatched duplicate addition as a typed collision", async () => {
    connection.getDb.mockResolvedValue(duplicateLookupDb({ id: 12, type: "bonus", amount: 350 }));
    await expect(addCredits(7, 350, "refund", "collision", "shared-ref")).resolves.toEqual({
      success: false,
      error: "Credit reference collision",
      duplicate: true,
      collision: true,
    });
  });

  it("never lets a duplicate deduction authorize paid work again", async () => {
    connection.getDb.mockResolvedValue(duplicateLookupDb({ id: 13, type: "generation", amount: -300 }));
    await expect(deductCredits(7, 300, "generation", "retry", "op-2:charge")).resolves.toEqual({
      success: false,
      error: "Credit charge already recorded",
      duplicate: true,
    });
  });

  it("marks a mismatched duplicate deduction as a critical collision", async () => {
    connection.getDb.mockResolvedValue(duplicateLookupDb({ id: 14, type: "refund", amount: 300 }));
    await expect(deductCredits(7, 300, "generation", "collision", "shared-ref")).resolves.toEqual({
      success: false,
      error: "Credit reference collision",
      duplicate: true,
      collision: true,
    });
  });
});
