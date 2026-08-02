import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CastViewAngle } from "../../shared/boardTypes";

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
/*
  The Cast's own asset rows — what recovery reads to decide whether ANYTHING
  landed (D-103). Two 2K views by default, so the ordinary partial cases keep
  their promotion; a total-loss test empties it.
*/
let castAssets: Array<Record<string, unknown>> = [];

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
  listCastAssets: vi.fn(async () => castAssets),
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

/**
 * What the Sign under test promised, as its own durable rows would report.
 *
 * Injected rather than left to the profile constant, because the whole point
 * of the promise is that recovery settles what was BOUGHT — see the skew case
 * at the bottom of this file.
 */
const promised = {
  angles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "backFull"] as never,
  source: "recorded" as const,
};

function chargeRow(amount = 450) {
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
  // What the server planned to charge — the cross-check on the promised views.
  plannedCredits: 450,
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
  castAssets = [
    { viewType: "frontClose", resolution: "2K", storageUrl: "https://cdn/1.png", status: null },
    { viewType: "frontFull", resolution: "2K", storageUrl: "https://cdn/2.png", status: null },
  ];
  vi.clearAllMocks();
});

describe("the boundary never committed", () => {
  it("fences the operation BEFORE it touches the money", async () => {
    ledgerRows = [chargeRow()];
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });

    expect(outcome).toMatchObject({ type: "paid_failure", chargedCredits: 450, refundedCredits: 450 });
    // The order is the defence. Fence, then locate, then refund, then seal.
    expect(journal).toEqual(["fence", "locate", "refund", "seal"]);
    expect(journal.indexOf("fence")).toBeLessThan(journal.indexOf("refund"));
  });

  it("gives the whole price back — promotion included, because nothing was created", async () => {
    ledgerRows = [chargeRow()];
    await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    expect(refunds).toEqual([{ amount: 450, reference: CHARGE_REFERENCE }]);
  });

  it("owes nothing when the crash landed before the charge", async () => {
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(refunds).toHaveLength(0);
    expect(seals.at(-1)).toMatchObject({ chargedCredits: 0, refundedCredits: 0 });
  });

  it("does not pay twice when an earlier pass already refunded", async () => {
    ledgerRows = [chargeRow(), refundRow(CHARGE_REFERENCE, 450)];
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    // Read, not re-issued: nothing owed, so nothing sent.
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 450 });
  });

  it("escalates rather than sealing a lie when the refund will not record", async () => {
    ledgerRows = [chargeRow()];
    refundRecords = false;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
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
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });

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
      { unsettledAngles: async () => [], promisedAngles: async () => promised },
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
      promisedAngles: async () => promised,
    });

    expect(refunds).toHaveLength(2);
    expect(refunds.every((entry) => entry.amount === 50)).toBe(true);
    // Per-slot references, never the bare charge reference — refunding that
    // would hand back the promotion on a Cast that exists.
    expect(refunds.every((entry) => entry.reference.includes(":slot:"))).toBe(true);
    expect(refunds.some((entry) => entry.reference === CHARGE_REFERENCE)).toBe(false);
    expect(outcome).toMatchObject({ type: "partial", chargedCredits: 450, refundedCredits: 100 });
  });

  it("writes the confession where the ROOM reads it, not only the log", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => ["backFull"] as never,
      promisedAngles: async () => promised,
    });

    // A slot that was refunded but has no marker renders as an empty shimmer
    // for ever — the founder's gate condition is that it confesses in place.
    expect(markers).toEqual([{ angle: "backFull", refunded: 50 }]);
    expect(outcome.type).toBe("partial");
  });

  it("activates the Cast and binds it to the receipt the live process never sealed", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });

    expect(journal).toContain("activate");
    // `bindGenerationOperationModel` gates on `running`, which the fence has
    // left — so the receipt carries the link or nothing does.
    expect(seals.at(-1)).toMatchObject({ modelId: 901 });
  });

  it("reports a clean success when the live process had finished every view", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    expect(outcome).toMatchObject({ type: "durable_success", refundedCredits: 0 });
    expect(seals.at(-1)).toMatchObject({ chargedCredits: 450, refundedCredits: 0 });
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
        ["threeQuarter", "frontFull", "sideClose", "backFull", "frontClose"] as never,
      promisedAngles: async () => promised,
    });

    const paidBack = 250 + refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(paidBack).toBeLessThanOrEqual(450);
    expect(outcome.type).toBe("recovery_required");
  });

  it("escalates when the Cast and its candidate disagree about the signature", async () => {
    ledgerRows = [chargeRow()];
    cast = { ...signedCast, candidateSignedCastId: 999 };
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    expect(outcome.type).toBe("recovery_required");
    expect(refunds).toHaveLength(0);
  });

  it("escalates a Cast that exists under a Sign with no recorded charge", async () => {
    // authority exists ⟹ money was taken. If that is false, the sequence was
    // violated and nothing here should guess which way.
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
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
      promisedAngles: async () => promised,
    });

    expect(outcome.type).toBe("recovery_required");
    expect(journal).toContain("park");
    // No terminal receipt: a human has to look, and the message must survive.
    expect(seals).toHaveLength(0);
  });

  it("parks a Cast whose candidate disagrees with it", async () => {
    ledgerRows = [chargeRow()];
    cast = { ...signedCast, candidateSignedCastId: 999 };
    await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    expect(journal).toContain("park");
    expect(seals).toHaveLength(0);
  });

  it("parks a ledger nobody can read, before the fence", async () => {
    ledgerRows = [chargeRow(), chargeRow()];
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
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
      promisedAngles: async () => promised,
    });

    // 50 back in total, not 100.
    expect(outcome).toMatchObject({ type: "partial", chargedCredits: 450, refundedCredits: 50 });
  });
});

describe("a Sign bought under a different package", () => {
  /**
   * THE DEPLOY COLLISION, in the package's clothing.
   *
   * A Sign charged 500 for six views, left non-terminal by the deploy that
   * retired the walk, then swept by five-view code: settle it against today's
   * profile and the walk's slice is charged, never generated and never
   * refunded. Silently. The promise is read from the operation's own durable
   * rows for exactly this reason, and where there are none to read, the price
   * is the cross-check — a disagreement parks for a human rather than guessing.
   */
  it("refuses to settle a six-view Sign against a five-view profile", async () => {
    ledgerRows = [chargeRow(500)];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, plannedCredits: 500 },
      {
        unsettledAngles: async () => ["backFull"],
        // No durable rows: the fallback is today's five-view profile, which
        // implies 450 and cannot be what a 500-credit Sign bought.
        promisedAngles: async () => ({ angles: promised.angles, source: "profile" }),
      },
    );
    expect(outcome.type).toBe("recovery_required");
    expect((outcome as { reason: string }).reason).toContain("does not match");
    expect(refunds).toHaveLength(0);
    expect(journal).toContain("park");
  });

  it("settles a six-view Sign against the six views it actually bought", async () => {
    ledgerRows = [chargeRow(500)];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, plannedCredits: 500 },
      {
        unsettledAngles: async () => ["sideFull"],
        promisedAngles: async () => ({
          angles: ["frontClose", "threeQuarter", "frontFull", "sideClose", "sideFull", "backFull"],
          source: "recorded",
        }),
      },
    );
    // The retired walk still refunds, because that Sign paid for it.
    expect(refunds).toEqual([{ amount: 50, reference: `${CHARGE_REFERENCE}:slot:sideFull` }]);
    expect(outcome).toMatchObject({ type: "partial", chargedCredits: 500, refundedCredits: 50 });
  });
});

describe("a Sign that never started", () => {
  it("closes a claimed operation as a free failure", async () => {
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, status: "claimed" },
      { unsettledAngles: async () => [], promisedAngles: async () => promised },
    );
    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(journal).toEqual(["seal:claimed"]);
    expect(refunds).toHaveLength(0);
  });

  it("escalates a claimed operation that somehow carries a charge", async () => {
    ledgerRows = [chargeRow()];
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, status: "claimed" },
      { unsettledAngles: async () => [], promisedAngles: async () => promised },
    );
    expect(outcome.type).toBe("recovery_required");
    // Parked with the claimed marker, so the sweep stops re-picking it.
    expect(journal).toEqual(["park:claimed"]);
  });
});

describe("zero of N, settled after the crash", () => {
  it("refunds the promotion when the asset rows show nothing landed", async () => {
    /*
      The adjudicator's half of the total-loss ruling (D-103). It cannot ask the
      process that built the package — that process is dead. It reads the Cast's
      own asset rows, finds no 2K view, and reaches the same verdict the live
      path would have reached, under the same derived reference.
    */
    cast = { modelId: 901, candidateSignedCastId: 901, candidateStatus: "signed" };
    ledgerRows = [chargeRow()];
    castAssets = [
      // The 1K anchor only: the face she already had. Not a delivered view.
      { viewType: "frontClose", resolution: "1K", storageUrl: "https://cdn/anchor.png", status: null },
    ];
    unsettled = [];

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as CastViewAngle[],
      promisedAngles: async () => promised,
    });

    const base = refunds.filter((entry) => entry.amount === 200);
    expect(base).toHaveLength(1);
    expect(outcome).toMatchObject({ refundedCredits: 200 });
  });

  it("keeps the promotion when one view survived the crash", async () => {
    cast = { modelId: 901, candidateSignedCastId: 901, candidateStatus: "signed" };
    ledgerRows = [chargeRow()];
    castAssets = [
      { viewType: "frontFull", resolution: "2K", storageUrl: "https://cdn/full.png", status: null },
    ];
    unsettled = [];

    await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as CastViewAngle[],
      promisedAngles: async () => promised,
    });

    expect(refunds.some((entry) => entry.amount === 200)).toBe(false);
  });

  it("does not pay the base twice when the live process already refunded it", async () => {
    /*
      The reason both paths derive the reference from one helper. If the live
      orchestrator got the promotion refund out before it died, the row is
      already in the ledger and this pass must read it as settled — not issue a
      second 200.
    */
    cast = { modelId: 901, candidateSignedCastId: 901, candidateStatus: "signed" };
    ledgerRows = [chargeRow(), refundRow(`${CHARGE_REFERENCE}:promotion`, 200)];
    castAssets = [];
    unsettled = [];

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as CastViewAngle[],
      promisedAngles: async () => promised,
    });

    // The prior 200 is counted once, from the ledger — never re-issued and
    // never added on top of itself.
    expect(outcome).toMatchObject({ refundedCredits: 200 });
  });
});

describe("the receipt counts views sold, not slots sealed", () => {
  it("does not count the anchor's frontClose slot as a delivered view", async () => {
    /*
      A real defect, caught before it shipped. `activateSignedCast` seals a
      `frontClose` slot from the 1K anchor because the snapshot authority
      requires a displayed headshot (D-97) — and package v3.1 does not sell
      `frontClose` at all. Counting sealed slots therefore reported SIX views on
      a five-view Sign, on the one document a support person reads when
      something has gone wrong.

      The live path was never wrong: `signService` counts committed views.
      Only recovery read the slots, so only recovery could produce a receipt
      that overstated what the customer received.
    */
    // A package-v3.1 promise: five views, and `frontClose` is not one of them.
    const v31 = {
      angles: ["closeUp", "threeQuarter", "frontFull", "sideClose", "backFull"] as never,
      source: "recorded" as const,
    };
    cast = { modelId: 901, candidateSignedCastId: 901, candidateStatus: "signed" };
    ledgerRows = [chargeRow()];
    castAssets = (v31.angles as unknown as string[]).map((angle) => ({
      viewType: angle, resolution: "2K", storageUrl: `https://cdn/${angle}.png`, status: null,
    }));
    unsettled = [];
    // What activation actually returns: the five sold views PLUS the anchor's
    // `frontClose` slot, which exists only to satisfy the snapshot authority.
    activation = {
      type: "activated",
      modelId: 901,
      slots: [...(v31.angles as unknown as string[]), "frontClose"],
    };

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as CastViewAngle[],
      promisedAngles: async () => v31,
    });

    // Five, not six. The anchor's slot is not a view anybody bought.
    expect(outcome).toMatchObject({ views: 5 });
    expect(seals.at(-1)).toMatchObject({ outcome: { result: { views: 5 } } });
  });
});
