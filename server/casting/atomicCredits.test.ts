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
import { displayRefund, formatCredits } from "../../shared/creditDisplay";

const ledger = vi.hoisted(() => {
  const state = {
    balance: 1000,
    transactions: [] as Array<{ userId: number; referenceId?: string; amount: number; toolKind?: string | null }>,
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
    deductCredits: vi.fn(async (userId: number, amount: number, _t: string, _d: string, referenceId?: string, attribution?: { toolKind: string | null; engineUsed?: string }) => {
      if (ledger.balance < amount) return { success: false, error: "Insufficient credits" };
      ledger.balance -= amount;
      ledger.transactions.push({ userId, referenceId, amount: -amount, toolKind: attribution?.toolKind });
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
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-11", toolKind: "image" as const },
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
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-11", toolKind: "image" as const },
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
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-12", toolKind: "image" as const },
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
        { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-14", toolKind: "image" as const },
        async () => {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
        },
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining("No image generated") });
    expect(ledger.balance).toBe(1000); // refunded
  });

  it("success keeps the deduction and never calls addCredits", async () => {
    const result = await withAtomicCredits(
      { userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-13", toolKind: "image" as const },
      async () => "ok",
    );
    expect(result).toBe("ok");
    expect(ledger.balance).toBe(650);
    expect(addCredits).not.toHaveBeenCalled();
    // #401 wire arm: the helper forwards toolKind into the ledger write.
    expect(ledger.transactions[0].toolKind).toBe("image");
  });

  it("without a caller referenceId, charge and refund ids are still distinct and paired", async () => {
    await withAtomicCredits(
      { userId: 1, amount: 100, description: "Upscale", toolKind: "image" as const },
      async () => {
        throw new Error("boom");
      },
    ).catch(() => {});
    expect(ledger.balance).toBe(1000);
    const [charge, refund] = ledger.transactions;
    expect(refund.referenceId).toBe(refundReferenceFor(charge.referenceId!));
  });

  it("bounds long refund child references to the ledger's varchar(64)", () => {
    const longCharge = `casting-image-${"9".repeat(20)}-${"a".repeat(36)}`;
    const reference = refundReferenceFor(longCharge);
    expect(reference).toHaveLength(64);
    expect(reference).toMatch(/^sha256:[a-f0-9]{57}$/);
    expect(refundReferenceFor(longCharge)).toBe(reference);
  });

  it("FROZEN CLOCK, PARALLEL calls: fallback charge references never collide (final correction 7)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    try {
      await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          withAtomicCredits({ userId: 1, amount: 10, description: "Parallel op", toolKind: "image" as const }, async () => {
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
      withAtomicCredits({ userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-77", toolKind: "image" as const }, async () => {
        throw new Error("engine down");
      }),
    ).rejects.toMatchObject({
      /* #1940 B17 — his approved wording, *"{N} credits returned."* */
      message: expect.stringContaining(`${formatCredits(displayRefund(350))} credits returned.`),
    });

    ledger.failNextAdd = true;
    await expect(
      withAtomicCredits({ userId: 1, amount: 350, description: "Model iteration", referenceId: "gen-78", toolKind: "image" as const }, async () => {
        throw new Error("engine down");
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("could not be recorded — quote reference refund:gen-78"),
    });
  });
});

/*
  WHAT HER SCREEN SHOWS (#2058) — the thrown error through the formatter the
  server wires (`withSpokenFlag`) and the client's own rule (`readableFailure`).
  The client never reads an unmarked INTERNAL_SERVER_ERROR aloud, so before
  this card the refund truth — and the reference support needs when a refund
  did not record — was replaced by the surface's fallback. The fallback here is
  a stand-in: what matters is only whether the server's sentence beats it.
*/
describe("the refund truth reaches her screen (#2058)", () => {
  const FALLBACK = "(the surface's own fallback)";
  const settle = (referenceId: string, operation: () => Promise<never>) =>
    withAtomicCredits(
      { userId: 1, amount: 350, description: "Model iteration", referenceId, toolKind: "image" as const },
      operation,
    ).then(() => null, (error: unknown) => error);
  const shownToHer = async (error: unknown) => {
    const { withSpokenFlag } = await import("../_core/spokenError");
    const { readableFailure } = await import("../../client/src/lib/failureSentence");
    return readableFailure(
      withSpokenFlag({ message: (error as Error).message, data: { code: (error as { code?: string }).code } }, error),
      FALLBACK,
    );
  };

  it("an engine failure is spoken: the refund that landed is read out", async () => {
    const { SpokenError } = await import("../_core/spokenError");
    const error = await settle("gen-2058a", async () => { throw new Error("engine down"); });
    expect(error).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(error).toBeInstanceOf(SpokenError);
    expect(await shownToHer(error)).toBe(`The operation failed. ${formatCredits(displayRefund(350))} credits returned.`);
  });

  it("a refund that did not record is spoken too: she keeps the reference support needs", async () => {
    ledger.failNextAdd = true;
    const error = await settle("gen-2058b", async () => { throw new Error("engine down"); });
    expect(await shownToHer(error)).toContain("quote reference refund:gen-2058b");
    /* Raw provider text still never travels — the sanitizer is unchanged. */
    expect(await shownToHer(error)).not.toContain("engine down");
  });

  it("an inner refusal that was already spoken keeps its marker through the rebuild", async () => {
    const { SpokenError, spokenError } = await import("../_core/spokenError");
    const error = await settle("gen-2058c", async () => {
      throw spokenError({ code: "INTERNAL_SERVER_ERROR", message: "That one did not finish." });
    });
    expect(error).toBeInstanceOf(SpokenError);
    expect(await shownToHer(error)).toBe(`That one did not finish. ${formatCredits(displayRefund(350))} credits returned.`);
  });

  it("NEGATIVE: an UNMARKED inner TRPCError is not promoted — its words are not known to be hers", async () => {
    const { TRPCError } = await import("@trpc/server");
    const { SpokenError } = await import("../_core/spokenError");
    const error = await settle("gen-2058d", async () => {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No image generated" });
    });
    expect(error).not.toBeInstanceOf(SpokenError);
    expect(await shownToHer(error)).toBe(FALLBACK);
  });

  it("NEGATIVE: an unauthored failure that never reached the catch is not marked", async () => {
    const { deductCredits } = await import("../db");
    const { SpokenError } = await import("../_core/spokenError");
    vi.mocked(deductCredits).mockRejectedValueOnce(new Error("connection lost"));
    const error = await settle("gen-2058e", async () => { throw new Error("unreached"); });
    expect(error).not.toBeInstanceOf(SpokenError);
    expect(await shownToHer(error)).toBe(FALLBACK);
  });
});

describe("shared refund copy helpers (client surfaces, final correction 1)", () => {
  it("branches on the recorded outcome — never an unconditional 'not charged'", async () => {
    const { refundOutcomeText, refundBadgeText, slotFailureMessage } = await import("../../shared/refundCopy");
    /*
      ⚠ **IT SAID `300 credits refunded` UNTIL #1600 SLICE 3, AND THE SUBJECT
      MOVED RATHER THAN DIED.** `refunded` is still the LEDGER figure every
      caller hands it — that has not changed and must not — but the sentence now
      quotes the display scale, because the balance beside it does. 300 ledger is
      60 display. The expected figure is DERIVED through the helper rather than
      typed as 60: a literal here would be a second copy of the scale, which is
      the exact working-law-4 defect `shared/creditDisplay.ts` exists to prevent.
    */
    /* #1940 B13: *"{N} credits returned."* — and nothing after it. */
    expect(refundOutcomeText({ refunded: 300 }))
      .toBe(`${formatCredits(displayRefund(300))} credits returned.`);
    expect(refundOutcomeText({ refunded: 300 })).not.toContain("300 credits");
    expect(refundOutcomeText({ refunded: 0, refundReference: "refund:slot-gen-9" })).toContain("quote refund:slot-gen-9");
    /*
      ⚠ **THREE STATES SINCE #1968, AND THE THIRD IS SILENCE.** A zero with no
      reference used to read *"contact support"*; his flat Sign price makes a
      refused view refund nothing BY DESIGN, so that sentence would invent a
      fault and an errand about money nobody owed. The two arms are kept
      adjacent because the distinction is the whole repair: with a reference it
      is a failed refund, without one there was never a refund to fail.
    */
    expect(refundOutcomeText({ refunded: 0 })).toBe("");
    expect(refundBadgeText({ refunded: 300 })).toBe("Credits returned");
    expect(refundBadgeText({ refunded: 0, refundReference: "refund:slot-gen-9" }))
      .toBe("Refund pending — contact support");
    expect(refundBadgeText({ refunded: 0 }), "no money was owed, so no badge").toBe("");
    const ok = slotFailureMessage({ label: "Side profile", reason: "gate", refunded: 300, markerPersisted: true });
    /* One verb, Try again, everywhere (#1940 B18). */
    expect(ok).toContain('"Try again"');
    const noMarker = slotFailureMessage({ label: "Side profile", reason: "gate", refunded: 0, markerPersisted: false });
    expect(noMarker).not.toContain('"Try again"');
    expect(noMarker).toContain("couldn't be saved to the package");
    /* The join drops the empty money half rather than leaving its space (#1968). */
    expect(noMarker, "no doubled space where the refund sentence used to be")
      .not.toContain("  ");
  });

  it("⚠ never says a refund of ZERO landed — the one sentence a refund line cannot print", async () => {
    /*
      `displayRefund` floors, which is right: it never claims more credits came
      back than did. Floored to 0 beside the "you weren't charged" promise it
      would read *"0 credits refunded — you weren't charged"*, which is a
      contradiction on a money surface. UNREACHABLE TODAY and driven anyway —
      every refundable unit in the product is a multiple of 5 and
      `server/creditPriceScale.test.ts` refuses a declared price that is not, so
      this arm is what makes the backstop a fact rather than a comment.
    */
    const { refundOutcomeText } = await import("../../shared/refundCopy");
    expect(displayRefund(3)).toBe(0);
    const sentence = refundOutcomeText({ refunded: 3 });
    expect(sentence).not.toContain("0 credits");
    /* #1940 B14. */
    expect(sentence).toBe("Your credits were returned.");
  });
});
