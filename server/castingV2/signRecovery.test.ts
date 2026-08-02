import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Sign adjudicator: what a crashed ceremony resolves to, and in what order.
 *
 * The order is the point. D-92's dangerous case is **sweep versus live**: a
 * process that outlived its lease is still holding an open Sign transaction
 * while this sweep decides the Sign is dead. Refund first and you can end up
 * with a Cast that exists AND was fully refunded — the one outcome the whole
 * design exists to prevent. So the fence comes first, and these tests assert it
 * as an observed order rather than trusting the code to keep it.
 *
 * The fork variable is `casting_candidates.signedCastId`, never the operation's
 * `modelId`: that column is bound at activation, so on exactly the crashes this
 * exists for it is null, and an adjudicator keyed on it would conclude a Cast
 * that plainly exists was never created.
 */

const OPERATION_ID = "44444444-4444-4444-8444-444444444444";
const CHARGE_REFERENCE = `op:${OPERATION_ID}:charge`;

const journal: string[] = [];
const refunds: Array<{ amount: number; reference: string }> = [];
const markers: Array<{ angle: string; refunded: number }> = [];
const seals: Array<Record<string, unknown>> = [];
const parked: Array<Record<string, unknown>> = [];

let ledgerRows: Array<Record<string, unknown>> = [];
let fenceWins = true;
let cast: Record<string, unknown> | null = null;
let unsettled: string[] = [];
let activation: Record<string, unknown> = { type: "activated", modelId: 901, slots: ["frontClose"] };
let refundRecords = true;

vi.mock("../db/connection", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: async () => ledgerRows }) }),
  })),
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

vi.mock("../db/generationOperations", () => ({
  fenceCastingV2SignOperationIn: vi.fn(async () => {
    journal.push("fence");
    return fenceWins;
  }),
  finalizeFencedCastingV2SignOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal");
    seals.push(input);
  }),
  finalizeClaimedGenerationOperationFailure: vi.fn(async () => {
    journal.push("seal:claimed");
    seals.push({ kind: "claimed" });
  }),
  parkFencedCastingV2SignOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("park");
    parked.push(input);
  }),
  markGenerationOperationRecoveryRequired: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("park:running");
    parked.push(input);
  }),
  markClaimedGenerationOperationRecoveryRequired: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("park:claimed");
    parked.push(input);
  }),
}));

vi.mock("../db/castingV2Sign", () => ({
  findCastBySignOperation: vi.fn(async () => {
    journal.push("locate");
    return cast;
  }),
  activateSignedCast: vi.fn(async () => {
    journal.push("activate");
    return activation;
  }),
  recordRecoveredSlotFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("marker");
    const failure = input.failure as { refunded: number };
    markers.push({ angle: input.angle as string, refunded: failure.refunded });
    return true;
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, _label: string, reference: string) => {
    journal.push("refund");
    if (!refundRecords) {
      return { recorded: false, amount: 0, reference: `refund:${reference}`, duplicate: false };
    }
    /*
      The ledger's uniqueness, modelled honestly: a reference that is already
      in the ledger comes back recorded AND duplicate. Without this the suite
      could never see a receipt counting the same 50 credits twice.
    */
    const already = ledgerRows.some((row) => row.referenceId === `refund:${reference}`)
      || refunds.some((entry) => entry.reference === reference);
    if (already) return { recorded: true, amount, reference: `refund:${reference}`, duplicate: true };
    refunds.push({ amount, reference });
    return { recorded: true, amount, reference: `refund:${reference}`, duplicate: false };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

const { recoverCastingV2SignOperation } = await import("./signRecovery");

function chargeRow(amount = 500) {
  return { referenceId: CHARGE_REFERENCE, type: "generation", amount: -amount };
}
function refundRow(reference: string, amount: number) {
  return { referenceId: `refund:${reference}`, type: "refund", amount };
}

const signedCast = {
  modelId: 901,
  modelStatus: "provisioning",
  agencyId: "KI-AAAA-BBBB-CCCC-DDDD",
  identityRevisionId: "rev-1",
  identitySnapshotId: "snap-1",
  identityText: "identity",
  anchorAssetId: 5,
  candidateId: 55,
  candidatePublicId: "candidate-public",
  candidateSignedCastId: 901,
  candidateStatus: "signed",
};

const operation = {
  id: OPERATION_ID,
  userId: 1,
  status: "running" as const,
  chargedCredits: 0,
  refundedCredits: 0,
};

beforeEach(() => {
  journal.length = 0;
  refunds.length = 0;
  markers.length = 0;
  seals.length = 0;
  parked.length = 0;
  ledgerRows = [];
  fenceWins = true;
  cast = null;
  unsettled = [];
  activation = { type: "activated", modelId: 901, slots: ["frontClose", "frontFull"] };
  refundRecords = true;
  vi.clearAllMocks();
});

describe("the boundary never committed", () => {
  it("fences the operation BEFORE it touches the money", async () => {
    ledgerRows = [chargeRow()];
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
    });

    expect(outcome).toMatchObject({ type: "paid_failure", chargedCredits: 500, refundedCredits: 500 });
    // The order is the defence. Fence, then locate, then refund, then seal.
    expect(journal).toEqual(["fence", "locate", "refund", "seal"]);
    expect(journal.indexOf("fence")).toBeLessThan(journal.indexOf("refund"));
  });

  it("gives the whole price back — promotion included, because nothing was created", async () => {
    ledgerRows = [chargeRow()];
    await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(refunds).toEqual([{ amount: 500, reference: CHARGE_REFERENCE }]);
  });

  it("owes nothing when the crash landed before the charge", async () => {
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(refunds).toHaveLength(0);
    expect(seals.at(-1)).toMatchObject({ chargedCredits: 0, refundedCredits: 0 });
  });

  it("does not pay twice when an earlier pass already refunded", async () => {
    ledgerRows = [chargeRow(), refundRow(CHARGE_REFERENCE, 500)];
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    // Read, not re-issued: nothing owed, so nothing sent.
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 500 });
  });

  it("escalates rather than sealing a lie when the refund will not record", async () => {
    ledgerRows = [chargeRow()];
    refundRecords = false;
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(outcome.type).toBe("recovery_required");
    // No terminal receipt: the operation stays fenced, where support can see it.
    expect(seals).toHaveLength(0);
  });
});

describe("sweep versus live", () => {
  it("does nothing at all when the live process settled first", async () => {
    // The fence is lost because the operation is no longer `running` — the live
    // Sign finished between the sweep's read and this statement. Its settlement
    // stands, and touching the money now would refund a delivered Cast.
    ledgerRows = [chargeRow()];
    fenceWins = false;
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });

    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(refunds).toHaveLength(0);
    expect(seals).toHaveLength(0);
    expect(journal).toEqual(["fence"]);
  });

  it("re-adjudicates an operation an earlier pass fenced and never sealed", async () => {
    // A crash between the fence and the receipt parks the operation in
    // `recovery_required`. Nothing else in the sweep looks there, so this is
    // the path that stops a Cast being half-settled forever.
    ledgerRows = [chargeRow()];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, status: "recovery_required" },
      { unsettledAngles: async () => [] },
    );

    // No second fence — it is already fenced.
    expect(journal).not.toContain("fence");
    expect(outcome.type).toBe("durable_success");
  });
});

describe("the Cast exists", () => {
  it("keeps the promotion and refunds only the views nobody settled", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    unsettled = ["sideFull", "backFull"];

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as never,
    });

    expect(refunds).toHaveLength(2);
    expect(refunds.every((entry) => entry.amount === 50)).toBe(true);
    // Per-slot references, never the bare charge reference — refunding that
    // would hand back the promotion on a Cast that exists.
    expect(refunds.every((entry) => entry.reference.includes(":slot:"))).toBe(true);
    expect(refunds.some((entry) => entry.reference === CHARGE_REFERENCE)).toBe(false);
    expect(outcome).toMatchObject({ type: "partial", chargedCredits: 500, refundedCredits: 100 });
  });

  it("writes the confession where the ROOM reads it, not only the log", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => ["backFull"] as never,
    });

    // A slot that was refunded but has no marker renders as an empty shimmer
    // for ever — the founder's gate condition is that it confesses in place.
    expect(markers).toEqual([{ angle: "backFull", refunded: 50 }]);
    expect(outcome.type).toBe("partial");
  });

  it("activates the Cast and binds it to the receipt the live process never sealed", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });

    expect(journal).toContain("activate");
    // `bindGenerationOperationModel` gates on `running`, which the fence has
    // left — so the receipt carries the link or nothing does.
    expect(seals.at(-1)).toMatchObject({ modelId: 901 });
  });

  it("reports a clean success when the live process had finished every view", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(outcome).toMatchObject({ type: "durable_success", refundedCredits: 0 });
    expect(seals.at(-1)).toMatchObject({ chargedCredits: 500, refundedCredits: 0 });
  });

  it("never refunds more than was charged", async () => {
    // The conservation ceiling. Slices come from a code constant and the ledger
    // from the database; if they ever disagree enough to overpay, that is a
    // support case, not a silent overpayment.
    ledgerRows = [
      chargeRow(),
      refundRow(`${CHARGE_REFERENCE}:slot:frontClose`, 250),
    ];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () =>
        ["threeQuarter", "frontFull", "sideClose", "sideFull", "backFull", "frontClose"] as never,
    });

    const paidBack = 250 + refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(paidBack).toBeLessThanOrEqual(500);
    expect(outcome.type).toBe("recovery_required");
  });

  it("escalates when the Cast and its candidate disagree about the signature", async () => {
    ledgerRows = [chargeRow()];
    cast = { ...signedCast, candidateSignedCastId: 999 };
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(outcome.type).toBe("recovery_required");
    expect(refunds).toHaveLength(0);
  });

  it("escalates a Cast that exists under a Sign with no recorded charge", async () => {
    // authority exists ⟹ money was taken. If that is false, the sequence was
    // violated and nothing here should guess which way.
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(outcome.type).toBe("recovery_required");
    expect(refunds).toHaveLength(0);
  });
});

describe("a dead end parks, and stays parked", () => {
  /**
   * The fence and a genuine support case share one status, so the sweep's
   * widened selection has to tell them apart. If it cannot, the next pass
   * re-adjudicates a parked Sign, finds its failed slot already marked, and
   * seals a CLEAN receipt over the support message — the customer stays short
   * and the trail is gone.
   */
  it("parks an unrecorded refund instead of sealing a receipt over it", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    refundRecords = false;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => ["backFull"] as never,
    });

    expect(outcome.type).toBe("recovery_required");
    expect(journal).toContain("park");
    // No terminal receipt: a human has to look, and the message must survive.
    expect(seals).toHaveLength(0);
  });

  it("parks a Cast whose candidate disagrees with it", async () => {
    ledgerRows = [chargeRow()];
    cast = { ...signedCast, candidateSignedCastId: 999 };
    await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(journal).toContain("park");
    expect(seals).toHaveLength(0);
  });

  it("parks a ledger nobody can read, before the fence", async () => {
    ledgerRows = [chargeRow(), chargeRow()];
    const outcome = await recoverCastingV2SignOperation(operation, { unsettledAngles: async () => [] });
    expect(outcome.type).toBe("recovery_required");
    // Still `running` at that point, so the standard marker owns it.
    expect(journal).toEqual(["park:running"]);
  });
});

describe("a refund that was already in the ledger", () => {
  /**
   * The live process can record a slice refund and then lose the fence before
   * it writes the slot's marker. The slot is then unsettled with its refund
   * already paid — and `alreadyRefunded` has already counted it. Re-issuing is
   * harmless to the balance (the reference is idempotent) but must NOT be
   * counted again, or the receipt overstates the refund and the conservation
   * ceiling can park a perfectly healthy Cast.
   */
  it("is paid once and counted once", async () => {
    const slotReference = `${CHARGE_REFERENCE}:slot:backFull`;
    ledgerRows = [chargeRow(), refundRow(slotReference, 50)];
    cast = signedCast;

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => ["backFull"] as never,
    });

    // 50 back in total, not 100.
    expect(outcome).toMatchObject({ type: "partial", chargedCredits: 500, refundedCredits: 50 });
  });
});

describe("a Sign that never started", () => {
  it("closes a claimed operation as a free failure", async () => {
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, status: "claimed" },
      { unsettledAngles: async () => [] },
    );
    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(journal).toEqual(["seal:claimed"]);
    expect(refunds).toHaveLength(0);
  });

  it("escalates a claimed operation that somehow carries a charge", async () => {
    ledgerRows = [chargeRow()];
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, status: "claimed" },
      { unsettledAngles: async () => [] },
    );
    expect(outcome.type).toBe("recovery_required");
    // Parked with the claimed marker, so the sweep stops re-picking it.
    expect(journal).toEqual(["park:claimed"]);
  });
});
