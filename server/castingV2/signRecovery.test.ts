import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CastViewAngle } from "../../shared/boardTypes";
import { CASTING_V2_SIGN_PRICE_CREDITS } from "../casting/castingCreditCosts";


/**
 * THE SIGN'S MONEY, READ FROM THE PRODUCT — #1601 item 1, 2026-10-01.
 *
 * ⚠ **THIS SUITE PINNED `450`, `200`, `50`, `100` AND `500` AS LITERALS AND
 * EVERY ONE OF THEM WENT RED ON TWO CONSTANT EDITS.** So each number is read
 * from the product rather than typed.
 *
 * ⚠ **AND THE SPLIT THE OTHER CONSTANTS NAMED IS GONE — #1968.** `PROMOTION`
 * (the kept half) and `VIEW_PRICE` (the refundable slice) described a price
 * with two parts; his word of 2026-10-08 makes a Sign one flat charge with no
 * per-view refund, so the only figure left is the whole one. The arms below
 * moved with it: what they assert now is that the sweep settles from the
 * LEDGER's own charge rather than from any constant, which is what lets one
 * build settle a Sign bought at 8,500 and one bought at 3,250.
 */
const SIGN_PRICE = CASTING_V2_SIGN_PRICE_CREDITS;
/**
 * What a Sign cost before #1968 — a LEDGER fact, not a product constant.
 *
 * The in-flight case this suite has to cover: a Sign charged under the old
 * decomposition (3,500 + 5 × 1,000) and settled by a build that has only the
 * flat price. It is a literal on purpose, because it is history: no constant in
 * the tree can produce it any more, and deriving it from one would be a fiction
 * that moves with his next price word.
 */
const LEGACY_EIGHT_FIVE_SIGN = 8500;

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
  /* Not this suite's subject: the storage-cleanup module derives a born-held
     manifest's grace from the operation lease, so anything that reaches
     `storageCleanup` through this double needs the constant to EXIST. Nothing
     in this suite reads its value, so this is a stand-in rather than a second
     copy of the answer; the real one is proved in
     `server/db/storageCleanupHold.test.ts`. */
  DEFAULT_GENERATION_OPERATION_LEASE_MS: 5 * 60 * 1000,
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

function chargeRow(amount = SIGN_PRICE) {
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
  plannedCredits: SIGN_PRICE,
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

    expect(outcome).toMatchObject({ type: "paid_failure", chargedCredits: SIGN_PRICE, refundedCredits: SIGN_PRICE });
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
    expect(refunds).toEqual([{ amount: SIGN_PRICE, reference: CHARGE_REFERENCE }]);
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
    ledgerRows = [chargeRow(), refundRow(CHARGE_REFERENCE, SIGN_PRICE)];
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [],
      promisedAngles: async () => promised,
    });
    // Read, not re-issued: nothing owed, so nothing sent.
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: SIGN_PRICE });
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
  /*
    ⚠ **THIS ARM READ *"keeps the promotion and refunds only the views nobody
    settled"* AND BOTH HALVES ARE GONE — #1968.** There is no promotion to keep
    and no slice to refund: a Sign that delivered SOMETHING keeps its whole
    charge, and the customer keeps what landed. His word: *"Credits only come
    back if the Sign can't be delivered at all."*

    It still drives two unsettled views, because the arm that matters is that
    nothing moves for them — and `toEqual([])` on the refunds can tell this rule
    from the old one, where a length check could not.
  */
  it("refunds NOTHING for views nobody settled, when the Cast exists", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    unsettled = ["sideFull", "backFull"];

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as never,
      promisedAngles: async () => promised,
    });

    expect(refunds, "no slice comes back for an unsettled view (#1968)").toEqual([]);
    expect(outcome).toMatchObject({ type: "partial", chargedCredits: SIGN_PRICE, refundedCredits: 0 });
  });

  it("writes the confession where the ROOM reads it, not only the log", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => ["backFull"] as never,
      promisedAngles: async () => promised,
    });

    // A slot with no marker renders as an empty shimmer for ever — the
    // founder's gate condition is that it confesses in place. Since #1968 it
    // confesses with no money beside it, which is the honest figure rather
    // than a stub: nothing was owed for this view.
    expect(markers).toEqual([{ angle: "backFull", refunded: 0 }]);
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
    expect(seals.at(-1)).toMatchObject({ chargedCredits: SIGN_PRICE, refundedCredits: 0 });
  });

  it("never refunds more than was charged", async () => {
    /*
      The conservation ceiling — **and since #1968 it is measured against the
      LEDGER on both sides, which is stronger than it was.** It used to compare
      a code constant against a database row; now the amount owed IS a
      subtraction over two database figures, so the ceiling can only be reached
      by a ledger that already contradicts itself.

      The fixture is exactly that: an old slot refund larger than the charge,
      which is impossible to create but is what a corrupted or double-written
      row looks like. It must park rather than pay.
    */
    ledgerRows = [
      chargeRow(),
      refundRow(`${CHARGE_REFERENCE}:slot:frontClose`, SIGN_PRICE + 500),
    ];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () =>
        ["threeQuarter", "frontFull", "sideClose", "backFull", "frontClose"] as never,
      promisedAngles: async () => promised,
      committedAngles: async () => [],
    });

    expect(refunds, "nothing is paid out over a ledger that cannot be trusted").toEqual([]);
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
  /*
    ⚠ **RE-POINTED AT THE TOTAL LOSS BY #1968, BECAUSE A PARTIAL PACKAGE NO
    LONGER REFUNDS ANYTHING.** It drove one unsettled view on a Cast that
    exists, which used to attempt a slice refund and could therefore fail to
    record one. With the slice gone that fixture issues no refund at all, so the
    arm would have gone on passing while measuring nothing — the exact shape of
    an inert guard.

    The concern it exists for is untouched and now lives where the money does:
    the total-loss refund.
  */
  it("parks an unrecorded refund instead of sealing a receipt over it", async () => {
    ledgerRows = [chargeRow()];
    cast = signedCast;
    refundRecords = false;
    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => [...promised.angles] as never,
      promisedAngles: async () => promised,
      committedAngles: async () => [],
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
  /*
    ⚠ **SINCE #1968 THIS ARM IS ABOUT A SLICE THE OLD BUILD PAID, AND IT IS THE
    IN-FLIGHT CASE RATHER THAN AN EDGE ONE.** No build writes a slot refund any
    more, so the only way one of these rows exists is a Sign the old code
    part-refunded before this deploy. It must be COUNTED (it is money that
    really went back) and never clawed back or re-issued.
  */
  it("counts a slice the old build already refunded, and issues nothing new", async () => {
    const slotReference = `${CHARGE_REFERENCE}:slot:backFull`;
    const legacySlice = 1000;
    ledgerRows = [chargeRow(), refundRow(slotReference, legacySlice)];
    cast = signedCast;

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => ["backFull"] as never,
      promisedAngles: async () => promised,
    });

    expect(refunds, "nothing is re-issued and nothing is clawed back").toEqual([]);
    expect(outcome).toMatchObject({
      type: "partial",
      chargedCredits: SIGN_PRICE,
      refundedCredits: legacySlice,
    });
  });
});

describe("⚠ a Sign bought at a price this build no longer sells — #1968", () => {
  /**
   * THE DEPLOY COLLISION, in the package clothing — **and the repair changed
   * shape with his flat price.**
   *
   * What stood here PARKED: a Sign charged a total today constants cannot
   * reproduce was `recovery_required`, on the stated ground that *"the honest
   * move is a human rather than a refund of the wrong size"*. That was right
   * while the refund size came from a constant. It no longer does — the
   * total-loss refund is `ledger.charge.credits` minus `alreadyRefunded`, read
   * off the durable row — so there is no wrong size to guess at, and parking
   * would leave a real customer charged for pictures they never got until
   * somebody looked.
   *
   * ⚠ **The population is not hypothetical, which is why these arms exist:
   * every Sign in flight at THIS deploy was charged 8,500** and will be settled
   * by this code.
   */
  it("settles an 8,500 Sign that delivered nothing, giving back all 8,500", async () => {
    ledgerRows = [chargeRow(LEGACY_EIGHT_FIVE_SIGN)];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, plannedCredits: LEGACY_EIGHT_FIVE_SIGN },
      {
        unsettledAngles: async () => [...promised.angles] as never,
        promisedAngles: async () => promised,
        committedAngles: async () => [],
      },
    );

    /* The WHOLE legacy charge, under the one reference, and not today 3,250 —
       which is the arm a constant-reading settler could not pass. */
    expect(refunds).toEqual([
      { amount: LEGACY_EIGHT_FIVE_SIGN, reference: `${CHARGE_REFERENCE}:promotion` },
    ]);
    expect(outcome).toMatchObject({
      chargedCredits: LEGACY_EIGHT_FIVE_SIGN,
      refundedCredits: LEGACY_EIGHT_FIVE_SIGN,
    });
    expect(journal, "it settles rather than parking for a human").not.toContain("park");
  });

  it("⚠ CONTROL — it is not simply refunding the charge whatever happened", async () => {
    /*
      Without this the arm above passes on a settler that hands back the ledger
      charge for every operation it meets. Views landed, so this is a PARTIAL
      package and his rule says nothing comes back.
    */
    ledgerRows = [chargeRow(LEGACY_EIGHT_FIVE_SIGN)];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, plannedCredits: LEGACY_EIGHT_FIVE_SIGN },
      {
        unsettledAngles: async () => ["backFull"] as never,
        promisedAngles: async () => promised,
      },
    );

    expect(refunds).toEqual([]);
    expect(outcome).toMatchObject({ type: "partial", refundedCredits: 0 });
  });

  it("does not pay twice when the old build had already refunded some slices", async () => {
    /*
      A total loss on an 8,500 Sign whose old process got three slices out
      before it died: 5,500 is still owed, and not one credit more.
      `readSignLedger` reads every slot reference over `CAST_VIEW_ANGLES` for
      exactly this (D-102), which is why `packageSlotChargeReference` survives
      as a reader key with nothing writing it.
    */
    ledgerRows = [
      chargeRow(LEGACY_EIGHT_FIVE_SIGN),
      refundRow(`${CHARGE_REFERENCE}:slot:threeQuarter`, 1000),
      refundRow(`${CHARGE_REFERENCE}:slot:frontFull`, 1000),
      refundRow(`${CHARGE_REFERENCE}:slot:sideClose`, 1000),
    ];
    cast = signedCast;
    const outcome = await recoverCastingV2SignOperation(
      { ...operation, plannedCredits: LEGACY_EIGHT_FIVE_SIGN },
      {
        unsettledAngles: async () => [...promised.angles] as never,
        promisedAngles: async () => promised,
        committedAngles: async () => [],
      },
    );

    expect(refunds).toEqual([
      { amount: 5500, reference: `${CHARGE_REFERENCE}:promotion` },
    ]);
    expect(outcome).toMatchObject({ refundedCredits: LEGACY_EIGHT_FIVE_SIGN });
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

    /* The WHOLE charge, once, under the one reference — it was the promotion
       alone until #1968, because five slices had refunded themselves beside
       it. There are no slices now, so the single row IS the whole Sign. */
    expect(refunds).toEqual([
      { amount: SIGN_PRICE, reference: `${CHARGE_REFERENCE}:promotion` },
    ]);
    expect(outcome).toMatchObject({ refundedCredits: SIGN_PRICE });
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

    /* ⚠ **NOT ONE CREDIT MOVES**, which is stronger than the old assertion
       (that the PROMOTION was not refunded). One view survived, so the Sign was
       delivered — his *"credits only come back if the Sign cannot be delivered
       at all"* — and the four that did not survive refund nothing. */
    expect(refunds).toEqual([]);
  });

  it("does not pay the base twice when the live process already refunded it", async () => {
    /*
      The reason both paths derive the reference from one helper. If the live
      orchestrator got the promotion refund out before it died, the row is
      already in the ledger and this pass must read it as settled — not issue a
      second promotion.
    */
    cast = { modelId: 901, candidateSignedCastId: 901, candidateStatus: "signed" };
    ledgerRows = [chargeRow(), refundRow(`${CHARGE_REFERENCE}:promotion`, SIGN_PRICE)];
    castAssets = [];
    unsettled = [];

    const outcome = await recoverCastingV2SignOperation(operation, {
      unsettledAngles: async () => unsettled as CastViewAngle[],
      promisedAngles: async () => promised,
    });

    /* The prior refund is counted once, from the ledger — never re-issued and
       never added on top of itself. Since #1968 the owed figure is the charge
       MINUS what already went back, so a fully-refunded Sign owes zero and
       this pass sends nothing at all. */
    expect(refunds, "nothing is owed, so nothing is sent").toEqual([]);
    expect(outcome).toMatchObject({ refundedCredits: SIGN_PRICE });
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
