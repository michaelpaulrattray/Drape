import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Sign ceremony's ORDER and its MONEY (plan §F, §H.4, D-92).
 *
 * Sign inverts the roll's ordering: the charge comes BEFORE the durable
 * boundary, because that boundary creates authority — a Cast, and a spent
 * candidate — and an unpaid Cast is unacceptable. Everything in between must
 * therefore be compensable, and this file is the proof, case by case, of the
 * one invariant the whole design serves:
 *
 *   **authority exists ⟹ money was taken.**
 *
 * The sequence is asserted as an OBSERVED ORDER of calls rather than by reading
 * the code, because the adjudicator's verdicts are only correct while that
 * order holds: swap the deduct and the boundary and a crash between them
 * silently produces a free Cast; move the manifest after the copy and a crash
 * leaks a customer's face into the bucket with nothing pointing at it.
 */

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const journal: string[] = [];

const ledger = {
  charges: [] as Array<{ amount: number; reference: string }>,
  refunds: [] as Array<{ amount: number; reference: string }>,
};
let chargeSucceeds = true;
let refundRecords = true;

/** The candidate row, with a REAL compare-and-set on it. */
const candidateRow = {
  id: 55,
  publicId: "candidate-public",
  status: "ready" as string,
  signedCastId: null as number | null,
  imageKey: "casting-v2/candidates/abc.png",
  personaLine: "Dry and flat",
  position: 3,
  internalPrompt: { prompt: "the composed casting instruction", resolved: { sex: "female" } },
};

const casts: Array<{ modelId: number; agencyId: string; candidateId: number }> = [];
let nextModelId = 900;
let copyThrows = false;
let manifestThrows = false;
const cleanupBatches: string[] = [];
const receipts: Array<Record<string, unknown>> = [];

class TestSignPersistenceError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

vi.mock("../db/castingV2Sign", () => ({
  SignPersistenceError: TestSignPersistenceError,
  getSignableCandidate: vi.fn(async () => {
    journal.push("read");
    if (candidateRow.status !== "ready") return null;
    return {
      candidate: candidateRow,
      roll: {
        id: 22,
        publicId: "roll-public",
        briefText: "a redhead in her 30s",
        cohortKey: "photoreal-human",
        styleKey: null,
        styleProfile: null,
        createdAt: new Date("2026-08-02T10:00:00Z"),
      },
      session: { id: 10, publicId: "session-public" },
    };
  }),
  signCandidateIntoCast: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("boundary");
    // The CAS, for real: `status='ready' AND signedCastId IS NULL`.
    if (candidateRow.status !== "ready" || candidateRow.signedCastId !== null) {
      throw new TestSignPersistenceError("candidate_unavailable");
    }
    nextModelId += 1;
    candidateRow.status = "signed";
    candidateRow.signedCastId = nextModelId;
    // The manifest is discharged inside the same transaction.
    const index = cleanupBatches.indexOf(input.cleanupBatchId as string);
    if (index >= 0) cleanupBatches.splice(index, 1);
    casts.push({
      modelId: nextModelId,
      agencyId: input.agencyId as string,
      candidateId: input.candidateId as number,
    });
    return {
      modelId: nextModelId,
      agencyId: input.agencyId as string,
      anchorAssetId: 1,
      identitySnapshotId: "snapshot-1",
      identityRevisionId: input.identityRevisionId as string,
    };
  }),
}));

vi.mock("../db/credits", () => ({
  deductCredits: vi.fn(async (_userId: number, amount: number, _type: string, _label: string, reference: string) => {
    journal.push("deduct");
    if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
    ledger.charges.push({ amount, reference });
    return { success: true };
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, _label: string, chargeReference: string) => {
    journal.push("refund");
    const reference = `refund:${chargeReference}`;
    if (!refundRecords) return { recorded: false, amount: 0, reference };
    if (ledger.refunds.some((entry) => entry.reference === reference)) {
      // The ledger's uniqueness: a repeated reference is a no-op, not a second
      // refund.
      return { recorded: true, amount, reference };
    }
    ledger.refunds.push({ amount, reference });
    return { recorded: true, amount, reference };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("claim");
    return { type: "execute", operationId: OPERATION_ID };
  }),
  completeDirectOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:failure");
    receipts.push({ kind: "failure", ...input });
    throw input.error;
  }),
  failClaimedDirectOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:claimed-failure");
    receipts.push({ kind: "claimed-failure", ...input });
    throw input.error;
  }),
}));

vi.mock("../db/generationOperations", () => ({
  markGenerationOperationRunning: vi.fn(async () => {
    journal.push("running");
  }),
  finalizeGenerationOperationSuccess: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:success");
    receipts.push({ kind: "success", ...input });
  }),
  bindGenerationOperationModel: vi.fn(async () => {
    journal.push("bind");
  }),
  markGenerationOperationRecoveryRequired: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:recovery");
    receipts.push({ kind: "recovery", ...input });
  }),
}));

vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: vi.fn(async (_tx: unknown, input: Record<string, unknown>) => {
    journal.push("manifest");
    if (manifestThrows) throw new Error("manifest failed");
    cleanupBatches.push(input.id as string);
    return { id: input.id as string };
  }),
}));

vi.mock("../db/connection", () => ({
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

vi.mock("../storage", () => ({
  storageCopyExact: vi.fn(async (input: { sourceKey: string; destinationKey: string }) => {
    journal.push("copy");
    if (copyThrows) throw new Error("copy failed");
    return {
      key: input.destinationKey,
      url: `https://cdn.example/${input.destinationKey}`,
      byteSize: 10,
      contentHash: "hash",
      contentType: "image/png",
    };
  }),
  storageReadBytes: vi.fn(async () => ({ bytes: Buffer.from("anchor"), contentType: "image/png" })),
  storagePut: vi.fn(async () => ({ key: "k", url: "u" })),
  storageDelete: vi.fn(async () => ({ success: true })),
  storagePublicUrl: (key: string) => `https://cdn.example/${key}`,
}));

const { signCandidate } = await import("./signService");
const { CASTING_V2_SIGN_PRICE_CREDITS } = await import("./castViewPackage");

/** A package that behaves however the case needs it to. */
function packageReturning(result: {
  committed?: number;
  failed?: number;
  refundedCredits?: number;
  refundUnrecorded?: boolean;
}) {
  return vi.fn(async () => {
    journal.push("package");
    return {
      committed: Array.from({ length: result.committed ?? 5 }, () => "frontFull" as const),
      failed: Array.from({ length: result.failed ?? 0 }, () => "backFull" as const),
      refundedCredits: result.refundedCredits ?? 0,
      refundUnrecorded: result.refundUnrecorded ?? false,
      activated: true,
      totalLoss: (result.committed ?? 5) === 0,
    };
  });
}

/** Tests await the package; production detaches it. */
const awaitPackage = (run: () => Promise<void>) => run();

beforeEach(() => {
  journal.length = 0;
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  receipts.length = 0;
  cleanupBatches.length = 0;
  casts.length = 0;
  chargeSucceeds = true;
  refundRecords = true;
  copyThrows = false;
  manifestThrows = false;
  candidateRow.status = "ready";
  candidateRow.signedCastId = null;
  vi.clearAllMocks();
});

const input = {
  userId: 1,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  candidatePublicId: "candidate-public",
  name: "Nine",
};

describe("the Sign ceremony's order", () => {
  it("charges BEFORE the durable boundary, and registers the copy before making it", async () => {
    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(journal).toEqual([
      "read",
      "claim",
      "running",
      "deduct",
      "manifest",
      "copy",
      "boundary",
      "package",
      "bind",
      "seal:success",
    ]);
  });

  it("binds the Cast to its receipt before the receipt is sealed", async () => {
    // `bindGenerationOperationModel` is gated on `running`; sealing first would
    // make it a control that is never on the path.
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(journal.indexOf("bind")).toBeLessThan(journal.indexOf("seal:success"));
  });
});

describe("Sign's money", () => {
  it("takes the whole price once, and gives nothing back when everything lands", async () => {
    const result = await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(result.chargedCredits).toBe(CASTING_V2_SIGN_PRICE_CREDITS);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.charges[0].amount).toBe(450);
    expect(ledger.refunds).toHaveLength(0);
    expect(casts).toHaveLength(1);
    expect(receipts.at(-1)).toMatchObject({ kind: "success", chargedCredits: 450, refundedCredits: 0 });
  });

  it("refuses for free when the balance is short — no claim spent, no candidate spent", async () => {
    chargeSucceeds = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/Not enough credits/);

    expect(ledger.charges).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(0);
    expect(casts).toHaveLength(0);
    expect(candidateRow.status).toBe("ready");
    expect(receipts.at(-1)).toMatchObject({ kind: "failure", chargedCredits: 0, refundedCredits: 0 });
  });

  /**
   * D-92's crash table, row "deduct / copy": a charge exists, the CAS is unset
   * and no model exists. That is a PAID failure and the whole price goes back.
   */
  it("refunds the whole price when the copy fails after the charge", async () => {
    copyThrows = true;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    expect(ledger.charges[0].amount).toBe(450);
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.refunds[0].amount).toBe(450);
    // The candidate is untouched: it can be signed again.
    expect(candidateRow.status).toBe("ready");
    expect(candidateRow.signedCastId).toBeNull();
    expect(casts).toHaveLength(0);
  });

  it("leaves the copy owned by its cleanup manifest when the boundary never commits", async () => {
    copyThrows = true;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    // The manifest survives the failure — the worker deletes the orphan. If the
    // manifest were registered after the copy, this list would be empty and the
    // object would be unreachable forever.
    expect(cleanupBatches).toHaveLength(1);
  });

  it("discharges the manifest inside the boundary, so a live Cast's anchor is never swept", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(cleanupBatches).toHaveLength(0);
  });

  it("tells the truth when a refund does not record", async () => {
    copyThrows = true;
    refundRecords = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/support will restore the balance/);
    expect(receipts.at(-1)).toMatchObject({ chargedCredits: 450, refundedCredits: 0 });
  });
});

describe("the double Sign", () => {
  /**
   * Two distinct `clientRequestId`s racing one candidate charge twice by
   * construction — idempotency is per request, and neither request is a replay
   * of the other. The CAS decides who gets the Cast; the loser must take the
   * paid-failure exit.
   *
   * The assertion the review asked for is the LOSER'S MONEY, not merely the
   * winner's Cast: a test that only checks "one Cast exists" passes just as
   * happily when the loser was charged 500 and never refunded.
   */
  it("gives exactly one Cast, and gives the loser every credit back", async () => {
    const deps = { schedulePackage: awaitPackage, buildPackage: packageReturning({}) };
    const first = signCandidate(deps, input);
    const second = signCandidate(deps, {
      ...input,
      clientRequestId: "33333333-3333-4333-8333-333333333333",
    }).catch((error: Error) => error);

    const winner = await first;
    const loser = await second;

    expect(casts).toHaveLength(1);
    expect(winner.castPublicId).toBeTruthy();
    expect(loser).toBeInstanceOf(Error);
    expect((loser as Error).message).toMatch(/already signed or discarded/);

    // Both were charged — that is the construction, not a bug.
    expect(ledger.charges).toHaveLength(2);
    // And exactly one full refund exists: the loser's.
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.refunds[0].amount).toBe(450);
    // Conservation: the money kept equals one Sign.
    const charged = ledger.charges.reduce((sum, entry) => sum + entry.amount, 0);
    const refunded = ledger.refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(charged - refunded).toBe(450);
  });

  it("refuses a candidate that was signed by an earlier ceremony", async () => {
    candidateRow.status = "signed";
    candidateRow.signedCastId = 901;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/discarded, expired, or already signed/);
    // Refused before the claim: free.
    expect(ledger.charges).toHaveLength(0);
  });
});

describe("the package's money, after the boundary", () => {
  it("keeps the promotion and refunds only the views that failed", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 3, failed: 2, refundedCredits: 100 }),
      },
      input,
    );

    // 450 charged, 2 × 50 back. The promotion is never refunded once the CAS is
    // set — the customer has the locked face it bought.
    expect(ledger.charges[0].amount).toBe(450);
    expect(receipts.at(-1)).toMatchObject({
      kind: "success",
      chargedCredits: 450,
      refundedCredits: 100,
      terminalStatus: "partial",
    });
    expect(casts).toHaveLength(1);
  });

  it("still delivers a Cast when every view fails, and refunds every view", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 0, failed: 5, refundedCredits: 250 }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({
      chargedCredits: 450,
      refundedCredits: 250,
      terminalStatus: "partial",
    });
    // 200 kept — the promotion, which is exactly what was delivered.
    expect(candidateRow.status).toBe("signed");
  });

  it("never seals a clean receipt over a refund that did not record", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 4, failed: 1, refundedCredits: 0, refundUnrecorded: true }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({ kind: "recovery" });
    expect(journal).not.toContain("seal:success");
  });

  it("leaves the Cast standing when the package throws — the sweep finishes it", async () => {
    const exploding = vi.fn(async () => {
      throw new Error("the package exploded");
    });
    // The mutation resolves: the Cast exists, and that is what the customer is
    // told. Nothing is refunded here, because nothing here knows what landed.
    const result = await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: exploding },
      input,
    );
    expect(result.castPublicId).toBeTruthy();
    expect(casts).toHaveLength(1);
    expect(journal).not.toContain("seal:success");
    expect(ledger.refunds).toHaveLength(0);
  });
});
