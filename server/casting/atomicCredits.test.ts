/**
 * Batch C review finding 1 (P0) — the atomic-credits refund contract.
 *
 * The real ledger (server/db/credits.ts) writes the DEDUCTION as a
 * creditTransactions row under the caller's referenceId, and addCredits
 * treats ANY existing (userId, referenceId) row as a duplicate and SKIPS the
 * credit while returning success. A refund reusing the charge id is
 * therefore silently swallowed. These tests run the REAL withAtomicCredits
 * against a stateful fake ledger that reproduces exactly those semantics
 * (balance + transaction rows + the duplicate rule) — not independent mocks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ledger = vi.hoisted(() => {
  const state = {
    balance: 1000,
    transactions: [] as Array<{ userId: number; referenceId?: string; amount: number }>,
    failNextAdd: false,
    reset() {
      state.balance = 1000;
      state.transactions = [];
      state.failNextAdd = false;
    },
  };
  return state;
});

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    // Mirrors deductCredits: atomic conditional decrement + a transaction row
    // under the given referenceId (NO duplicate check on the deduct side).
    deductCredits: vi.fn(async (userId: number, amount: number, _t: string, _d: string, referenceId?: string) => {
      if (ledger.balance < amount) return { success: false, error: "Insufficient credits" };
      ledger.balance -= amount;
      ledger.transactions.push({ userId, referenceId, amount: -amount });
      return { success: true, newBalance: ledger.balance };
    }),
    // Mirrors addCredits: ANY existing (userId, referenceId) row is treated
    // as a duplicate — success:true, duplicate:true, NO balance change.
    addCredits: vi.fn(async (userId: number, amount: number, _t: string, _d: string, referenceId?: string) => {
      if (ledger.failNextAdd) {
        ledger.failNextAdd = false;
        return { success: false, error: "Database not available" };
      }
      if (referenceId && ledger.transactions.some((t) => t.userId === userId && t.referenceId === referenceId)) {
        return { success: true, newBalance: ledger.balance, duplicate: true };
      }
      ledger.balance += amount;
      ledger.transactions.push({ userId, referenceId, amount });
      return { success: true, newBalance: ledger.balance };
    }),
  };
});
vi.mock("../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/connection")>();
  return { ...actual, getDb: vi.fn().mockResolvedValue(null) }; // frozen-check skipped
});

import { addCredits } from "../db";
import { withAtomicCredits, refundReferenceFor } from "./atomicCredits";

beforeEach(() => {
  ledger.reset();
  vi.mocked(addCredits).mockClear();
});

describe("withAtomicCredits refund contract (review finding 1)", () => {
  it("operation failure refunds under a DIFFERENT deterministic id and restores the balance once", async () => {
    await expect(
      withAtomicCredits(
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-11" },
        async () => {
          throw new Error("engine down");
        },
      ),
      // Final correction 2: raw internal error text is sanitized outward —
      // the safe fallback travels, the original is logged server-side.
    ).rejects.toThrow("The operation failed.");

    // The balance came back — under the OLD same-id contract the ledger's
    // duplicate rule swallowed this refund and the user stayed at 650.
    expect(ledger.balance).toBe(1000);
    const refundCall = vi.mocked(addCredits).mock.calls[0];
    expect(refundCall[4]).toBe(refundReferenceFor("gen-11"));
    expect(refundCall[4]).not.toBe("gen-11");
    expect(refundReferenceFor("gen-11")).toBe("refund:gen-11");
  });

  it("retrying the same refund is idempotent — credits are never added twice", async () => {
    const run = () =>
      withAtomicCredits(
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-11" },
        async () => {
          throw new Error("engine down");
        },
      ).catch(() => {});
    await run();
    expect(ledger.balance).toBe(1000);
    // A second attempt to RECORD the same refund (e.g. a recovery retry)
    // dedupes against the refund's own row:
    const second = await addCredits(1, 350, "refund", "Refund: Model iteration failed", refundReferenceFor("gen-11"));
    expect(second.success).toBe(true);
    expect((second as { duplicate?: boolean }).duplicate).toBe(true);
    expect(ledger.balance).toBe(1000); // not 1350
  });

  it("a FAILED refund is not reported as refunded: the balance stays short, the truth propagates", async () => {
    ledger.failNextAdd = true;
    await expect(
      withAtomicCredits(
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-12" },
        async () => {
          throw new Error("engine down");
        },
      ),
      // Sanitized outward (final correction 2) — but the refund-failure truth
      // is never masked: the message carries the support reference.
    ).rejects.toMatchObject({ message: expect.stringContaining("could not be recorded — quote reference refund:gen-12") });
    // The refund genuinely did not land — nothing pretended otherwise
    expect(ledger.balance).toBe(650);
    expect(ledger.transactions.filter((t) => t.referenceId === refundReferenceFor("gen-12"))).toHaveLength(0);
  });

  it("deliberately written TRPCError wording still passes through the boundary", async () => {
    const { TRPCError } = await import("@trpc/server");
    await expect(
      withAtomicCredits(
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-14" },
        async () => {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
        },
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining("No image generated") });
    expect(ledger.balance).toBe(1000); // refunded
  });

  it("success keeps the deduction and never calls addCredits", async () => {
    const result = await withAtomicCredits(
      { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-13" },
      async () => "ok",
    );
    expect(result).toBe("ok");
    expect(ledger.balance).toBe(650);
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("without a caller referenceId, charge and refund ids are still distinct and paired", async () => {
    await withAtomicCredits(
      { userId: 1, amount: 100, description: "Upscale" },
      async () => {
        throw new Error("boom");
      },
    ).catch(() => {});
    expect(ledger.balance).toBe(1000);
    const [charge, refund] = ledger.transactions;
    expect(refund.referenceId).toBe(refundReferenceFor(charge.referenceId!));
  });

  it("FROZEN CLOCK, PARALLEL calls: fallback charge references never collide (final correction 7)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    try {
      await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          withAtomicCredits({ userId: 1, amount: 10, description: "Parallel op" }, async () => {
            throw new Error("boom");
          }),
        ),
      );
      const charges = ledger.transactions.filter((t) => t.amount < 0).map((t) => t.referenceId);
      const refunds = ledger.transactions.filter((t) => t.amount > 0).map((t) => t.referenceId);
      // Under a timestamp-only scheme all four charge ids would collide at a
      // frozen clock — every charge/refund pair must be distinct
      expect(new Set(charges).size).toBe(4);
      expect(new Set(refunds).size).toBe(4);
      expect(ledger.balance).toBe(1000); // all four refunds landed
    } finally {
      vi.useRealTimers();
    }
  });

  it("the truthful sentence propagates: failed refund reaches the thrown error, success states the amount", async () => {
    await expect(
      withAtomicCredits({ userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-77" }, async () => {
        throw new Error("engine down");
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("350 credits were refunded") });

    ledger.failNextAdd = true;
    await expect(
      withAtomicCredits({ userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-78" }, async () => {
        throw new Error("engine down");
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("could not be recorded — quote reference refund:gen-78"),
    });
  });
});

describe("shared refund copy helpers (client surfaces, final correction 1)", () => {
  it("branches on the recorded outcome — never an unconditional 'not charged'", async () => {
    const { refundOutcomeText, refundBadgeText, slotFailureMessage } = await import("../../shared/refundCopy");
    expect(refundOutcomeText({ refunded: 300 })).toContain("300 credits refunded");
    expect(refundOutcomeText({ refunded: 0, refundReference: "refund:slot-gen-9" })).toContain("quote refund:slot-gen-9");
    expect(refundOutcomeText({ refunded: 0 })).toContain("contact support");
    expect(refundBadgeText(300)).toBe("You weren't charged");
    expect(refundBadgeText(0)).toBe("Refund pending — contact support");
    const ok = slotFailureMessage({ label: "Side profile", reason: "gate", refunded: 300, markerPersisted: true });
    expect(ok).toContain('"Retry"');
    const noMarker = slotFailureMessage({ label: "Side profile", reason: "gate", refunded: 0, markerPersisted: false });
    expect(noMarker).not.toContain('"Retry"');
    expect(noMarker).toContain("couldn't be saved to the package");
  });
});
