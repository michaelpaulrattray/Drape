import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A deploy lands mid-refine — the collision class, one surface down (D-85).
 *
 * Every push to `main` deploys, and the founder dogfoods paid work while that
 * happens. A deploy that lands mid-refine kills the process holding the
 * generation, and the answer is the same as the roll's: the sweep settles it,
 * and money is conserved either way.
 *
 * Simpler than the roll's because a refine has no slices. The adjudicator asks
 * ONE question — did the variant land? — and this file is the proof that both
 * answers are honest:
 *
 *   ready  ⟹ the user has the picture, the charge stands, nothing refunded
 *   not    ⟹ the user has nothing, the whole 25 comes back, once
 */

const ledger = {
  charge: 25,
  refunds: [] as Array<{ amount: number; reference: string }>,
};
let variantRow: Record<string, unknown> | null = null;
let refundRecords = true;
const receipts: Array<Record<string, unknown>> = [];
const parked: string[] = [];
const failed: number[] = [];

vi.mock("../db/connection", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: async () => {
          const rows: Array<Record<string, unknown>> = [];
          if (ledger.charge > 0) {
            rows.push({
              referenceId: "op:33333333-3333-4333-8333-333333333333:charge",
              type: "generation",
              amount: -ledger.charge,
            });
          }
          for (const refund of ledger.refunds) {
            rows.push({ referenceId: refund.reference, type: "refund", amount: refund.amount });
          }
          return rows;
        },
      }),
    }),
  })),
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

vi.mock("../db/castingV2Variants", () => ({
  findVariantByOperation: vi.fn(async () => variantRow),
  failVariant: vi.fn(async (input: { variantId: number }) => {
    failed.push(input.variantId);
    return true;
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, _description: string, reference: string) => {
    if (!refundRecords) return { recorded: false };
    ledger.refunds.push({ amount, reference: `refund:${reference}` });
    return { recorded: true };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../db/generationOperations", () => ({
  finalizeGenerationOperationSuccess: vi.fn(async (input: Record<string, unknown>) => {
    receipts.push({ kind: "success", ...input });
  }),
  finalizeGenerationOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    receipts.push({ kind: "failure", ...input });
  }),
  finalizeClaimedGenerationOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    receipts.push({ kind: "claimed-failure", ...input });
  }),
  markGenerationOperationRecoveryRequired: vi.fn(async (input: Record<string, unknown>) => {
    parked.push(String(input.operationId));
  }),
}));

const { recoverCastingV2RefineOperation } = await import("./refineRecovery");

beforeEach(() => {
  ledger.charge = 25;
  ledger.refunds.length = 0;
  receipts.length = 0;
  parked.length = 0;
  failed.length = 0;
  refundRecords = true;
  variantRow = null;
  vi.clearAllMocks();
});

const operation = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: 1,
  status: "running" as const,
  chargedCredits: 25,
  refundedCredits: 0,
};

describe("the fork: did the variant land?", () => {
  it("keeps the charge when the refinement is on disk and selected", async () => {
    variantRow = { id: 500, publicId: "variant-1", status: "ready" };
    const outcome = await recoverCastingV2RefineOperation(operation);

    expect(outcome).toMatchObject({ type: "durable_success", chargedCredits: 25, refundedCredits: 0 });
    expect(ledger.refunds).toHaveLength(0);
    expect(receipts.at(-1)).toMatchObject({ kind: "success" });
  });

  it("gives the whole 25 back when nothing landed", async () => {
    variantRow = { id: 500, publicId: "variant-1", status: "dispatched" };
    const outcome = await recoverCastingV2RefineOperation(operation);

    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 25 });
    expect(ledger.refunds).toEqual([{ amount: 25, reference: "refund:op:33333333-3333-4333-8333-333333333333:charge" }]);
    /* Terminal, so a second sweep cannot pick the row up and refund it twice. */
    expect(failed).toEqual([500]);
  });

  it("refunds even when the variant row never made it to disk", async () => {
    variantRow = null;
    const outcome = await recoverCastingV2RefineOperation(operation);
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 25 });
  });
});

describe("money is conserved, and said honestly", () => {
  /*
    "Paid" is what downstream accounting reads to decide money moved. A crash
    before the deduct must NOT report a paid failure, or the receipt invents a
    charge that never happened.
  */
  it("reports a free failure when the crash beat the charge", async () => {
    ledger.charge = 0;
    variantRow = { id: 500, publicId: "variant-1", status: "queued" };
    const outcome = await recoverCastingV2RefineOperation(operation);

    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(ledger.refunds).toHaveLength(0);
    expect(receipts.at(-1)).toMatchObject({ kind: "failure", chargedCredits: 0, refundedCredits: 0 });
  });

  /*
    Read prior refunds; never re-issue one to find out. Idempotent references
    make a duplicate refund a no-op — right up until the day one of them is not
    a duplicate.
  */
  it("does not refund twice when an earlier sweep already paid it back", async () => {
    ledger.refunds.push({ amount: 25, reference: "refund:op:33333333-3333-4333-8333-333333333333:charge" });
    variantRow = { id: 500, publicId: "variant-1", status: "failed" };
    const outcome = await recoverCastingV2RefineOperation(operation);

    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 25 });
    expect(ledger.refunds).toHaveLength(1);
  });

  it("parks rather than claiming a refund that did not record", async () => {
    refundRecords = false;
    variantRow = { id: 500, publicId: "variant-1", status: "dispatched" };
    const outcome = await recoverCastingV2RefineOperation(operation);

    expect(outcome).toMatchObject({ type: "recovery_required" });
    expect(parked).toContain("33333333-3333-4333-8333-333333333333");
    /* The receipt must never say money came back when it did not. */
    expect(receipts.filter((receipt) => receipt.kind === "failure")).toHaveLength(0);
  });

  /*
    A delivered refinement with no charge behind it means the landing and the
    ledger disagree. Surfacing it beats keeping it quietly: a free paid feature
    is a bug in the direction that costs the business, and it is exactly what a
    sweep exists to notice.
  */
  it("parks a landed refinement that carries no charge", async () => {
    ledger.charge = 0;
    variantRow = { id: 500, publicId: "variant-1", status: "ready" };
    const outcome = await recoverCastingV2RefineOperation(operation);

    expect(outcome).toMatchObject({ type: "recovery_required" });
    expect(parked).toContain("33333333-3333-4333-8333-333333333333");
  });

  it("parks when the ledger holds two charges for one refine", async () => {
    variantRow = { id: 500, publicId: "variant-1", status: "ready" };
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: async () => [
            { referenceId: "op:33333333-3333-4333-8333-333333333333:charge", type: "generation", amount: -25 },
            { referenceId: "op:33333333-3333-4333-8333-333333333333:charge", type: "generation", amount: -25 },
          ],
        }),
      }),
    } as never);

    const outcome = await recoverCastingV2RefineOperation(operation);
    expect(outcome).toMatchObject({ type: "recovery_required" });
    expect(parked).toContain("33333333-3333-4333-8333-333333333333");
  });
});
