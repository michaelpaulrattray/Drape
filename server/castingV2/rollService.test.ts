import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The roll service's money and its ordering (plan §F, §H).
 *
 * Two things are under test here, and they are the two things a billing review
 * should refuse to take on faith:
 *
 *   1. THE SEQUENCE. rows → running → charge → dispatch, in that order, every
 *      time. It is asserted as an observed order of calls rather than by
 *      reading the code, because the recovery adjudicator's central rule —
 *      "rows exist but no ledger charge means nothing was taken" — is only
 *      true while this order holds. Swap two lines and the adjudicator starts
 *      refunding money that was never charged; this test fails first.
 *
 *   2. CONSERVATION, per slice. A roll is eight independently refundable
 *      units, so the assertions are always of the sharp form: exactly the
 *      candidates that did not arrive were refunded, never one that did, never
 *      twice, never more than was charged.
 *
 * Every case constructs the exact state a crash or a race would leave and then
 * proves what happens to the money.
 */

type Journal = string[];
const journal: Journal = [];

const rows = {
  candidates: [] as Array<Record<string, unknown>>,
};

const refunds: Array<{ amount: number; reference: string }> = [];
let refundRecords = true;
let chargeSucceeds = true;

const dbCalls = {
  createRoll: vi.fn(),
  failCandidate: vi.fn(),
  setRollStatus: vi.fn(),
  cancelQueued: vi.fn(),
  markDispatched: vi.fn(),
  land: vi.fn(),
};

vi.mock("../db/castingV2", () => ({
  CastingV2OwnershipError: class extends Error {},
  createRollWithCandidates: vi.fn(async () => {
    journal.push("rows");
    dbCalls.createRoll();
    return {
      session: { id: 10 },
      roll: { id: 100, publicId: "roll-public", sessionId: 10, operationId: OPERATION_ID, priceCredits: 160 },
      candidates: rows.candidates,
    };
  }),
  listRollCandidates: vi.fn(async () => rows.candidates),
  getRollByOperation: vi.fn(async () => ({
    id: 100,
    publicId: "roll-public",
    priceCredits: 160,
    operationId: OPERATION_ID,
  })),
  /* A follow's parent. Only the pick arms roll a follow, and all they need is
     for the read to succeed — the lineage itself is `followAnchor`'s suite. */
  getOwnedCandidateWithSelectedFace: vi.fn(async () => ({
    candidate: { id: 1, publicId: "66666666-6666-4666-8666-666666666666", position: 3 },
    internalPrompt: null,
  })),
  /* The parent SHEET's born pair. Its default is the honest one for a fixture
     whose parent predates the paths: both NULL, which must keep the follow's
     prompt unpathed. The follow arms override it. */
  getRollWardrobeForOwnedCandidate: vi.fn(async () => ({ path: null, wardrobeLine: null })),
  getOwnedRoll: vi.fn(async () => ({
    id: 100,
    publicId: "roll-public",
    status: "generating",
    operationId: OPERATION_ID,
  })),
  markCandidateDispatched: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.markDispatched(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "queued") return false;
    row.status = "dispatched";
    return true;
  }),
  landCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.land(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.cancelledMidFlight) {
      row.status = "expired";
      return "expired";
    }
    if (row) row.status = "ready";
    return "ready";
  }),
  failCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.failCandidate(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row) row.status = "failed";
    return true;
  }),
  cancelQueuedCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.cancelQueued(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "queued") return false;
    row.status = "cancelled";
    return true;
  }),
  setRollStatus: vi.fn(async ({ status }: { status: string }) => {
    dbCalls.setRollStatus(status);
    return true;
  }),
  touchCastingSession: vi.fn(async () => undefined),
}));

vi.mock("../db/connection", () => ({
  // No frozen account in these scenarios; the frozen path has its own case.
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ frozenAt: null }] }) }),
    }),
  }),
}));

vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async () => ({ success: true, generationId: 1 })),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

vi.mock("../casting/atomicCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../casting/atomicCredits")>();
  return {
    ...actual,
    recordRefund: vi.fn(async (_userId: number, amount: number, _d: string, reference: string) => {
      journal.push("refund");
      if (!refundRecords) return { recorded: false, amount: 0, reference };
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference };
    }),
  };
});

const receipts = {
  // Takes its input like the other two. It was declared with none and called
  // with one — invisible while the typecheck skipped test files.
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
  claimedFailure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
};

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("claim");
    return { type: "execute", operationId: OPERATION_ID };
  }),
  completeDirectOperationSuccess: vi.fn(async (input: any) => receipts.success(input)),
  completeDirectOperationFailure: vi.fn(async (input: any) => receipts.failure(input)),
  failClaimedDirectOperation: vi.fn(async (input: any) => receipts.claimedFailure(input)),
}));

const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const { createRoll, cancelRoll } = await import("./rollService");
const { BRIEF_TEXT_MAX, BRIEF_TEXT_MAX_AUTHOR_ROAD, BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE, BRIEF_TOO_LONG_MESSAGE } = await import("./briefLength");
const { deterministicBriefCompiler, castingBriefCompiler, READER_OUTAGE_MESSAGE } = await import("./briefCompiler");
const { candidateChargeReference } = await import("./rollRecovery");
const { ProviderError } = await import("../providers/types");

function seedCandidates(count = 8) {
  rows.candidates = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    publicId: `cand-${index + 1}`,
    position: index,
    pointsCost: 20,
    status: "queued",
  }));
}

/** An engine whose per-candidate outcome the test dictates. */
function engineWhere(fails: (position: number) => boolean) {
  let call = 0;
  return () => ({
    id: "fal:test",
    generateCandidate: vi.fn(async () => {
      const position = call++;
      if (fails(position)) throw new ProviderError("transport", "provider blew up");
      journal.push("dispatch");
      return {
        bytes: Buffer.from("image"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "openai/gpt-image-2", providerRef: "req" },
      };
    }),
  });
}

function baseDependencies(fails: (position: number) => boolean = () => false) {
  return {
    engine: engineWhere(fails),
    /*
      Compile without an interpreter. These tests are about the billing
      sequence, and the default compiler now reaches for a text transport —
      which, with a real key in `.env`, turns a 17ms unit suite into 32
      seconds of live API calls against someone's account. A unit test that
      silently spends money is not a unit test.
    */
    compileBrief: deterministicBriefCompiler,
    admit: () => ({ admitted: true as const }),
    markRunning: vi.fn(async () => {
      journal.push("running");
      return { operationId: OPERATION_ID, chargeReferenceId: `op:${OPERATION_ID}:charge` };
    }),
    deduct: vi.fn(async () => {
      journal.push("charge");
      return chargeSucceeds
        ? { success: true, newBalance: 100 }
        : { success: false, error: "Insufficient credits" };
    }),
    storeImage: vi.fn(async () => ({ key: "casting-v2/candidates/x.png" })),
  } as never;
}

import { HOUSE_WARDROBE_LINE } from "./wardrobeLine";

const INPUT = {
  userId: 7,
  clientRequestId: "44444444-4444-4444-8444-444444444444",
  sessionPublicId: "55555555-5555-4555-8555-555555555555",
  briefText: "a wiry cyclist in her 20s, freckled, mid-laugh",
};

beforeEach(() => {
  journal.length = 0;
  refunds.length = 0;
  refundRecords = true;
  chargeSucceeds = true;
  seedCandidates();
  vi.clearAllMocks();
  receipts.success.mockImplementation(async () => undefined);
});

describe("the sequence", () => {
  it("commits rows before it charges, and dispatches only after", async () => {
    await createRoll(baseDependencies(), INPUT);

    const first = journal.filter((entry) =>
      ["claim", "rows", "running", "charge", "dispatch"].includes(entry),
    );
    // The adjudicator's rule — rows without a charge means nothing was taken —
    // is only true while this order holds.
    expect(first.slice(0, 4)).toEqual(["claim", "rows", "running", "charge"]);
    expect(first[4]).toBe("dispatch");
  });

  it("refuses at the door without claiming or charging when the queue is full", async () => {
    const dependencies = baseDependencies();
    await expect(
      createRoll({ ...(dependencies as object), admit: () => ({ admitted: false, reason: "busy" }) } as never, INPUT),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // §H.8: pressure produces an honest refusal, never a silent queue of paid
    // work — and nothing was claimed, so there is no receipt to reconcile.
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
  });

  it("refuses an uninterpretable brief for free", async () => {
    await expect(
      createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
  });

  /*
    THE 2,000-CHARACTER BOUND LIVES IN THE SERVICE NOW (#131 slice D,
    `briefLength.ts`): the entrance admits 4,000 so an authored prompt can come
    back as the next brief, and this is what keeps every account OFF the
    author road exactly where it was. Free, before the claim.
  */
  it("refuses a brief over 2,000 characters for free off the author road, with the sentence that says so", async () => {
    const long = "a wiry cyclist ".repeat(140);
    expect(long.length).toBeGreaterThan(BRIEF_TEXT_MAX);
    await expect(
      createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: long }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: BRIEF_TOO_LONG_MESSAGE });
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
  });

  it("on the author road the same brief reaches the compiler untouched", async () => {
    const long = "a wiry cyclist ".repeat(140);
    vi.stubEnv("CASTING_V2_SCOPE", "all");
    vi.stubEnv("CASTING_CREATIVE_REGISTER_SCOPE", `users:${INPUT.userId}`);
    try {
      const seen: string[] = [];
      const dependencies = baseDependencies();
      const compileBrief = (dependencies as { compileBrief: (input: { briefText: string }) => unknown }).compileBrief;
      await createRoll(
        {
          ...(dependencies as object),
          compileBrief: (input: { briefText: string }) => {
            seen.push(input.briefText);
            return compileBrief(input);
          },
        } as never,
        { ...INPUT, briefText: long },
      );
      expect(seen).toEqual([long]);
      expect(journal).toContain("claim");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("on the author road, past 4,000 it is refused free with the road's own sentence (review of #137, finding 1)", async () => {
    const long = "a wiry cyclist ".repeat(270);
    expect(long.length).toBeGreaterThan(BRIEF_TEXT_MAX_AUTHOR_ROAD);
    vi.stubEnv("CASTING_V2_SCOPE", "all");
    vi.stubEnv("CASTING_CREATIVE_REGISTER_SCOPE", `users:${INPUT.userId}`);
    try {
      await expect(
        createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: long }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE });
      expect(journal).not.toContain("claim");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  /*
    THE IMAGINATION METER (#131 slice E) reaches the compile exactly as sent,
    and absent stays absent — the author's own default is the compiler's to
    apply, never a second copy of "low" written here.
  */
  const compileSpy = (seen: (string | undefined)[]) => {
    const dependencies = baseDependencies();
    const compileBrief = (dependencies as { compileBrief: (input: { imagination?: string }) => unknown }).compileBrief;
    return {
      ...(dependencies as object),
      compileBrief: (input: { imagination?: string }) => {
        seen.push(input.imagination);
        return compileBrief(input);
      },
    } as never;
  };

  it("hands `imagination` to the compile as sent", async () => {
    const seen: (string | undefined)[] = [];
    await createRoll(compileSpy(seen), { ...INPUT, imagination: "max" });
    expect(seen).toEqual(["max"]);
  });

  it("and absent stays absent — the author's default is the compiler's to apply, never a second copy here", async () => {
    const seen: (string | undefined)[] = [];
    await createRoll(compileSpy(seen), INPUT);
    expect(seen).toEqual([undefined]);
  });

  it("the bound keys on the ROAD, not the flag: a chip-edited roll under the flag composes house and stops at 2,000 (finding 2)", async () => {
    const long = "a wiry cyclist ".repeat(140);
    vi.stubEnv("CASTING_V2_SCOPE", "all");
    vi.stubEnv("CASTING_CREATIVE_REGISTER_SCOPE", `users:${INPUT.userId}`);
    try {
      await expect(
        createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: long, unlock: ["sex"] as never }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: BRIEF_TOO_LONG_MESSAGE });
      expect(journal).not.toContain("claim");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("insufficient credits", () => {
  it("dispatches nothing, refunds nothing, and drives the rows terminal", async () => {
    chargeSucceeds = false;
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toBeTruthy();

    expect(journal).not.toContain("dispatch");
    // Refunding here would return money that was never taken.
    expect(refunds).toHaveLength(0);
    expect(rows.candidates.every((candidate) => candidate.status === "failed")).toBe(true);
    expect(dbCalls.setRollStatus).toHaveBeenCalledWith("failed");
    expect(receipts.failure).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 0, refundedCredits: 0 }),
    );
  });
});

describe("settlement per slice", () => {
  it("charges once and refunds nothing when all eight arrive", async () => {
    await createRoll(baseDependencies(), INPUT);
    expect(refunds).toHaveLength(0);
    expect(receipts.success).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 0, terminalStatus: "succeeded" }),
    );
  });

  it("writes what each tile COST on its audit row — delivered and failed alike", async () => {
    /*
      ASSERT AT THE WIRE, because the same instrument shipped inert one commit
      ago: the census field went onto the wrong object and a real render landed
      with no cost on it, while the report said "an unread window" in a voice
      that sounds like a reading.

      Both paths, deliberately. A census that recorded only the tiles that
      worked would price the good days, and a failed tile is money out with
      nothing delivered — the exact number the cost program needs.
    */
    const generations = await import("../db/generations");
    (generations.updateGeneration as any).mockClear();

    await createRoll(baseDependencies((position) => position < 2), INPUT);

    const written = (generations.updateGeneration as any).mock.calls
      .map((call: any[]) => call[1]);
    expect(written.length).toBe(8);
    for (const row of written) {
      expect(row.metadata?.cost, `${row.status} tile carries its cost`).toBeDefined();
      expect(typeof row.metadata.cost.wallMs).toBe("number");
      expect(typeof row.metadata.cost.calls).toBe("number");
    }
    /* And both outcomes really are represented, or this passed by measuring
       one path twice. */
    expect(new Set(written.map((row: any) => row.status))).toEqual(new Set(["completed", "failed"]));
  });

  it("refunds exactly the slices that failed, and records a partial", async () => {
    await createRoll(baseDependencies((position) => position < 2), INPUT);

    expect(refunds.map((refund) => refund.amount)).toEqual([20, 20]);
    const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    expect(total).toBe(40);
    expect(total).toBeLessThan(160);
    expect(receipts.success).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 40, terminalStatus: "partial" }),
    );
  });

  it("refunds the whole sheet and fails when nothing arrives", async () => {
    await expect(createRoll(baseDependencies(() => true), INPUT)).rejects.toBeTruthy();
    const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    expect(total).toBe(160);
    // Conservation's outer bound: never more than was charged.
    expect(total).toBeLessThanOrEqual(160);
    expect(receipts.failure).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 160 }),
    );
  });

  it("derives refund references identically to the recovery adjudicator", async () => {
    await createRoll(baseDependencies((position) => position === 0), INPUT);
    // Writer and recovery must agree byte for byte, or the ledger's uniqueness
    // cannot make a retry idempotent and the user is refunded twice.
    expect(refunds[0].reference).toBe(candidateChargeReference(OPERATION_ID, "cand-1"));
  });

  it("never reports 'you weren't charged' when a refund did not record", async () => {
    refundRecords = false;
    await expect(createRoll(baseDependencies(() => true), INPUT)).rejects.toMatchObject({
      message: expect.stringContaining("could not be recorded"),
    });
  });
});

describe("replay", () => {
  it("returns the existing roll instead of charging again", async () => {
    const directOperation = await import("../casting/directOperation");
    vi.mocked(directOperation.beginDirectOperation).mockResolvedValueOnce({
      type: "replay",
      operationId: OPERATION_ID,
      result: {},
    });

    const result = await createRoll(baseDependencies(), INPUT);

    expect(result.rollPublicId).toBe("roll-public");
    // Idempotency, not an error (§F): one request id, one roll, one charge.
    expect(journal).not.toContain("charge");
    expect(journal).not.toContain("rows");
  });
});

describe("cancel", () => {
  it("refunds only the candidates its CAS won", async () => {
    // Four already dispatched — the provider is working on them.
    rows.candidates.slice(0, 4).forEach((candidate) => {
      candidate.status = "dispatched";
    });

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    expect(result.cancelled).toBe(4);
    expect(result.refundedCredits).toBe(80);
    // Delivered work is never refunded (§H.6), and a candidate can only be won
    // by cancel or by dispatch — never both.
    expect(refunds).toHaveLength(4);
    expect(dbCalls.setRollStatus).toHaveBeenCalledWith("cancelled");

    /*
      The sheet paints from these two, and it cannot derive either: §J's
      projection collapses queued and dispatched into one `casting` status, so
      a client guessing which tiles to mark cancelled would paint over the four
      that are about to arrive.
    */
    expect(result.stillFinishing).toBe(4);
    expect(result.cancelledCandidateIds).toHaveLength(4);
    // Exactly the ones the CAS won — never the dispatched four.
    const dispatched = rows.candidates.slice(0, 4).map((candidate) => candidate.publicId);
    for (const id of result.cancelledCandidateIds) {
      expect(dispatched).not.toContain(id);
    }
  });

  it("refunds a candidate that lands unseen after the cancel", async () => {
    rows.candidates = [
      { id: 1, publicId: "cand-1", position: 0, pointsCost: 20, status: "queued", cancelledMidFlight: true },
    ];
    // The whole sheet here is one cancelled-mid-flight candidate, so the
    // create call ends in a refusal — and its wording must blame the cancel,
    // not us. "None of the sheet arrived" would read as our failure.
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      message: expect.stringContaining("cancelled"),
    });

    // The generosity ruling (founder, 2026-07-31): we paid the provider, but
    // the user never saw it, so the credits go back. "Cancel refunds
    // everything you haven't seen" is the promise this test holds up.
    expect(rows.candidates[0].status).toBe("expired");
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(20);
  });

  it("refunds the unseen landing under its own reference, not the failure one", async () => {
    rows.candidates = [
      { id: 1, publicId: "cand-1", position: 0, pointsCost: 20, status: "queued", cancelledMidFlight: true },
    ];
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toThrow();

    // Absorbed COGS and "we failed you" are different events. The ledger has
    // to be able to tell them apart, or the generosity rule is invisible in
    // the accounts it costs money in.
    const failureReference = candidateChargeReference(OPERATION_ID, "cand-1");
    expect(refunds[0].reference).not.toBe(failureReference);
    expect(refunds[0].reference).toContain("unseen");
  });

  it("is a no-op on a terminal roll rather than a refusal", async () => {
    const castingDb = await import("../db/castingV2");
    vi.mocked(castingDb.getOwnedRoll).mockResolvedValueOnce({
      id: 100,
      publicId: "roll-public",
      status: "complete",
      operationId: OPERATION_ID,
    } as never);

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });
    expect(result).toEqual({
      cancelled: 0,
      refundedCredits: 0,
      refundUnrecorded: false,
      // Nothing was stopped and nothing is coming — the sheet needs both to
      // say "this had already finished" rather than reporting a bare zero.
      stillFinishing: 0,
      cancelledCandidateIds: [],
    });
    expect(refunds).toHaveLength(0);
  });
});

/**
 * D-93's smoke alarm, ENFORCING.
 *
 * It shipped in shadow mode and was flipped on the number the gate asked for:
 * a sweep of 1,017 real production candidates fired exactly once, on D-93's own
 * incident, with zero false positives. The founder ruled the flip happens now
 * rather than at invites — he is the only affectable user today, so a misfire
 * costs one self-refund and produces the evidence to fix it, while waiting only
 * guarantees the first stranger's garbage tile arrives before the alarm is
 * armed.
 *
 * This is a MONEY assertion, so it is made against money.
 */
describe("the render-fault detector, enforcing", () => {
  it("fails a contact sheet and refunds its slice, through the ordinary taxonomy", async () => {
    const { readFile } = await import("node:fs/promises");
    const specimen = await readFile(
      new URL("../../docs/specs/references/nine-tile-sheet.png", import.meta.url),
    );

    const dependencies = {
      ...(baseDependencies() as Record<string, unknown>),
      engine: () => ({
        id: "fal:test",
        generateCandidate: vi.fn(async () => ({
          // The actual failure, not a stand-in.
          bytes: specimen,
          contentType: "image/png",
          latencyMs: 1,
          provenance: { provider: "fal" as const, model: "openai/gpt-image-2", providerRef: "req" },
        })),
      }),
    } as never;

    /*
      Every tile was a contact sheet, so every tile fails — and a roll where
      nothing arrived throws, exactly as it already did when the PROVIDER failed
      all eight. That identity is the point of the assertion: a render fault
      takes the ordinary terminal path rather than a private one, which is what
      "no new money path" means in practice.
    */
    await expect(createRoll(dependencies, INPUT)).rejects.toThrow(
      /None of the sheet arrived/,
    );

    // Eight slices out, eight slices back, under the derived references.
    expect(refunds).toHaveLength(8);
    expect(refunds.reduce((total, refund) => total + refund.amount, 0)).toBe(160);
    // Sorted: candidates dispatch concurrently, so refunds land in completion
    // order. What matters is the SET — every slice, exactly once.
    expect(refunds.map((refund) => refund.reference).sort()).toEqual(
      rows.candidates
        .map((candidate) => candidateChargeReference(OPERATION_ID, candidate.publicId as string))
        .sort(),
    );
  });

  /*
    FAIL OPEN, asserted at the service rather than only at the detector.

    The unit test proves `detectRenderFault` returns `undetermined` on bytes it
    cannot read; this proves the SERVICE then delivers and charges normally.
    Those are different claims, and the one that matters to a customer is this
    one — a detector that cannot read a PNG must not start destroying paid work.
  */
  it("delivers and charges normally when the bytes cannot be read at all", async () => {
    const result = await createRoll(baseDependencies(), INPUT);
    expect(result.ready).toBe(8);
    expect(result.failed).toBe(0);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toHaveLength(0);
  });
});

/**
 * THE SMALL COPY, ON THE PAID PATH (fable-503).
 *
 * `thumbKey` has been on this row since the roll domain landed and nothing ever
 * wrote one, so a sheet drew eight 90-pixel tiles by downloading eight full
 * frames. These arms hold the two halves of the promise: a delivered face lands
 * WITH one, and a face whose thumbnail cannot be made or stored lands anyway.
 */
describe("a delivered face gets a thumbnail", () => {
  /** A real picture, because a thumbnail of `Buffer.from("image")` is null. */
  const realFrame = async () => (await import("sharp")).default({
    create: { width: 768, height: 1024, channels: 3, background: { r: 120, g: 90, b: 80 } },
  }).png().toBuffer();

  function engineDelivering(bytes: Buffer) {
    return () => ({
      id: "fal:test",
      generateCandidate: vi.fn(async () => {
        journal.push("dispatch");
        return {
          bytes,
          contentType: "image/png",
          latencyMs: 1,
          provenance: { provider: "fal" as const, model: "openai/gpt-image-2", providerRef: "req" },
        };
      }),
    });
  }

  it("stores a WebP beside the frame and lands its key on the row", async () => {
    const stored: Array<{ key?: string; contentType: string }> = [];
    const dependencies = {
      ...(baseDependencies() as Record<string, unknown>),
      engine: engineDelivering(await realFrame()),
      storeImage: vi.fn(async (input: { bytes: Buffer; contentType: string; key?: string }) => {
        stored.push({ key: input.key, contentType: input.contentType });
        return { key: input.key ?? "casting-v2/candidates/frame.png" };
      }),
    } as never;

    await createRoll(dependencies, INPUT);

    /* Two writes a face: the frame, then its small copy at a key minted before
       the write so the row can carry it. */
    expect(stored.filter((write) => write.contentType === "image/webp")).toHaveLength(8);
    expect(stored.filter((write) => write.contentType === "image/png")).toHaveLength(8);
    const db = await import("../db/castingV2");
    const landings = (db.landCandidate as unknown as { mock: { calls: any[][] } }).mock.calls;
    expect(landings).toHaveLength(8);
    for (const [landing] of landings) {
      expect(landing.thumbKey, "every delivered face carries its small copy").toMatch(/\.webp$/);
    }
  });

  it("DELIVERS ANYWAY when the thumbnail cannot be stored", async () => {
    /* A face she paid for never fails because its small copy did not write. */
    const dependencies = {
      ...(baseDependencies() as Record<string, unknown>),
      engine: engineDelivering(await realFrame()),
      storeImage: vi.fn(async (input: { bytes: Buffer; contentType: string; key?: string }) => {
        if (input.contentType === "image/webp") throw new Error("R2 said no");
        return { key: "casting-v2/candidates/frame.png" };
      }),
    } as never;

    const result = await createRoll(dependencies, INPUT);
    expect(result.ready).toBe(8);
    expect(result.refundedCredits).toBe(0);
    const db = await import("../db/castingV2");
    const landings = (db.landCandidate as unknown as { mock: { calls: any[][] } }).mock.calls;
    for (const [landing] of landings) expect(landing.thumbKey).toBeNull();
  });

  it("DELIVERS ANYWAY when the bytes cannot be shrunk", async () => {
    /* The suite's own default engine returns four bytes of text — the case that
       proved the detector fails open, reused for the mint. */
    const result = await createRoll(baseDependencies(), INPUT);
    expect(result.ready).toBe(8);
    const db = await import("../db/castingV2");
    const landings = (db.landCandidate as unknown as { mock: { calls: any[][] } }).mock.calls;
    for (const [landing] of landings) expect(landing.thumbKey).toBeNull();
  });
});

/**
 * THE TWO PATHS ARE STAMPED ON THE ROLL — asserted AT THE WIRE, on what
 * actually reaches the insert (design §3.1, slice 3).
 *
 * Not on the resolver: `wardrobeLine.test.ts` already drives that exhaustively,
 * and a green resolver beside an unwired caller is this campaign's own named
 * failure — the segment store passed both benches while nothing read it. What
 * these arms read is `createRollWithCandidates`'s argument object, which is the
 * last thing before the row.
 *
 * The FLAG IS THE ONLY VARIABLE between the first two arms, because a flag
 * asserted on one side only is a flag whose other side nobody has read.
 */
describe("the two paths, at the wire", () => {
  const castingDbModule = () => import("../db/castingV2");

  /*
    ⚠ THE FIXTURE IS STATEFUL, and an arm that rolls twice inside one `it` is
    the thing that found it: `rows.candidates` is consumed by a roll, so the
    second call in a loop met a sheet that was already spent and came back
    "that roll was cancelled". Re-seeded before EVERY roll rather than once per
    test — a stateful fixture re-establishes its state in front of each row it
    is asked about, which is the census corpus's own first law.
  */
  async function rollWith(enabled: boolean, path?: "wardrobe" | "basics") {
    seedCandidates();
    await createRoll(
      { ...(baseDependencies() as object), twoPathsEnabled: () => enabled } as never,
      path === undefined ? INPUT : { ...INPUT, path },
    );
    return lastInsert();
  }

  async function lastInsert() {
    const castingDb = await castingDbModule();
    const calls = (castingDb.createRollWithCandidates as any).mock.calls;
    expect(calls.length, "nothing reached the insert").toBeGreaterThan(0);
    return calls[calls.length - 1][0];
  }

  beforeEach(async () => {
    const castingDb = await castingDbModule();
    (castingDb.createRollWithCandidates as any).mockClear();
  });

  it("⚠ OFF writes NULL for both — the dark landing, and NULL is not `wardrobe`", async () => {
    /*
      This is the state of every deployment as this lands, and the arm that
      says so. An account outside the flag must write NULL rather than the
      default, because NULL means *cast before the paths existed* — and a
      default applied here would make an account that never had the feature
      indistinguishable from one that chose Wardrobe, permanently and with no
      way back.
    */
    await createRoll({ ...(baseDependencies() as object), twoPathsEnabled: () => false } as never, INPUT);
    const written = await lastInsert();
    expect(written.path).toBeNull();
    expect(written.wardrobeLine).toBeNull();
  });

  it("⚠ ON with no toggle writes `wardrobe` and the house line", async () => {
    /*
      The other side of the same sentence. Inside the flag an unsent toggle
      becomes the default the control would have been showing (§6), and the
      line is stamped in the same breath — so the `incoherent` resolution
      cannot be produced from here.
    */
    await createRoll({ ...(baseDependencies() as object), twoPathsEnabled: () => true } as never, INPUT);
    const written = await lastInsert();
    expect(written.path).toBe("wardrobe");
    expect(written.wardrobeLine).toBe(HOUSE_WARDROBE_LINE);
  });

  it("⚠ ON with `basics` writes the basics line and NOT the house one", async () => {
    await createRoll(
      { ...(baseDependencies() as object), twoPathsEnabled: () => true } as never,
      { ...INPUT, path: "basics" as const },
    );
    const written = await lastInsert();
    expect(written.path).toBe("basics");
    expect(written.wardrobeLine).not.toBe(HOUSE_WARDROBE_LINE);
    expect(written.wardrobeLine).toContain("black");
  });

  it("⚠ NEVER writes one column without the other", async () => {
    /*
      The `incoherent` case's structural guard, checked over every combination
      this service can produce rather than argued in a comment. A path with no
      line is a roll that claims a path and cannot say what it is wearing, and
      on Basics the fallback would put a grey tee on a bare chest.
    */
    for (const enabled of [false, true]) {
      for (const path of [undefined, "wardrobe" as const, "basics" as const]) {
        const written = await rollWith(enabled, path);
        expect(
          (written.path === null) === (written.wardrobeLine === null),
          `enabled=${enabled} path=${String(path)} → ${JSON.stringify({ path: written.path, line: written.wardrobeLine })}`,
        ).toBe(true);
      }
    }
  });

  it("CONTROL — the toggle really moves the answer", async () => {
    /* Without this, every arm above is satisfied by a service that ignores
       both the flag and the toggle and writes one constant. */
    const wardrobe = await rollWith(true, "wardrobe");
    const basics = await rollWith(true, "basics");
    expect(wardrobe.wardrobeLine).not.toBe(basics.wardrobeLine);
    expect(wardrobe.path).not.toBe(basics.path);
  });

  /**
   * THE PICK, at its own two wires (design §4, item 4).
   *
   * Two questions, and they are separate: whether the interpreter is ASKED for
   * an outfit, and whether what it picked becomes the roll's line. The first is
   * asserted on the compiler's argument object because the ask is a change to a
   * paid prompt, which is live behaviour on every account it reaches.
   */
  describe("the pick", () => {
    const PICKED = "dark canvas work jacket, straight jeans, plain boots";
    const FOLLOW_CANDIDATE_PUBLIC_ID = "66666666-6666-4666-8666-666666666666";

    /** Records what the service asked the compiler for, and answers with a pick. */
    function compilerSpy() {
      const asked: (boolean | undefined)[] = [];
      const compileBrief = async (compilerInput: { pickWardrobe?: boolean }) => {
        asked.push(compilerInput.pickWardrobe);
        const compiled = await deterministicBriefCompiler(compilerInput as never);
        return { ...compiled, wardrobeLine: compilerInput.pickWardrobe === true ? PICKED : compiled.wardrobeLine };
      };
      return { asked, compileBrief };
    }

    async function rollAsking(
      enabled: boolean,
      extra: Record<string, unknown> = {},
    ) {
      seedCandidates();
      const spy = compilerSpy();
      await createRoll(
        {
          ...(baseDependencies() as object),
          twoPathsEnabled: () => enabled,
          compileBrief: spy.compileBrief,
        } as never,
        { ...INPUT, ...extra },
      );
      return { asked: spy.asked, written: await lastInsert() };
    }

    it("⚠ is asked for ONLY on a fresh Wardrobe roll inside the flag", async () => {
      /*
        Four rolls, one question each, and three of them must not carry it.

        A prompt is live behaviour: every fact on a paid sheet comes out of that
        one reply, and context is not additive here — a SUBSET of prompt context
        was measured raising the stage wall twice as often as its superset. So
        the question is asked only where the answer is read. Outside the flag
        nothing reads a pick; on BASICS the path IS the outfit and
        `bornWardrobeLine` discards `named`; on a FOLLOW the db layer inherits
        the parent roll's pair inside the transaction, so a pick made here is
        overwritten before it is a row.
      */
      expect((await rollAsking(false)).asked).toEqual([false]);
      expect((await rollAsking(true)).asked).toEqual([true]);
      expect((await rollAsking(true, { path: "basics" })).asked).toEqual([false]);
      expect(
        (await rollAsking(true, { followCandidatePublicId: FOLLOW_CANDIDATE_PUBLIC_ID })).asked,
      ).toEqual([false]);
    });

    it("writes the picked outfit as the roll's born line", async () => {
      const { written } = await rollAsking(true);
      expect(written.wardrobeLine).toBe(PICKED);
      /* CONTROL — the same service with no pick writes the house line, so the
         arm above is reading the pick and not a constant. */
      expect((await rollWith(true, "wardrobe")).wardrobeLine).toBe(HOUSE_WARDROBE_LINE);
    });

    /**
     * ⚠ A FOLLOW WEARS THE SHEET IT DESCENDS FROM, IN THE PICTURE AS WELL AS
     * IN THE ROW — the divergence item 5 created and has to close (§3.1).
     *
     * The db layer inherits the parent's pair inside the transaction, and that
     * is the authority for what is STORED. It arrives too late for the eight
     * PROMPTS. So the pair is read owner-scoped before the compile, and these
     * arms assert on what the COMPILER was handed — the last thing before the
     * pictures — rather than on the insert, which the db mock would answer for.
     */
    describe("a follow", () => {
      const PARENT_LINE = "a red apron over a plain white tee, dark straight jeans, plain low shoes";

      async function followWith(parent: { path: string | null; wardrobeLine: string | null }) {
        const castingDb = await castingDbModule();
        (castingDb.getRollWardrobeForOwnedCandidate as any).mockResolvedValueOnce(parent);
        seedCandidates();
        const seen: Record<string, unknown>[] = [];
        await createRoll(
          {
            ...(baseDependencies() as object),
            twoPathsEnabled: () => true,
            compileBrief: async (compilerInput: Record<string, unknown>) => {
              seen.push(compilerInput);
              return deterministicBriefCompiler(compilerInput as never);
            },
          } as never,
          { ...INPUT, followCandidatePublicId: FOLLOW_CANDIDATE_PUBLIC_ID },
        );
        return seen[0];
      }

      it("hands the compiler the PARENT's line, not a freshly resolved one", async () => {
        const compilerInput = await followWith({ path: "wardrobe", wardrobeLine: PARENT_LINE });
        expect(compilerInput.inheritedWardrobe).toEqual({ path: "wardrobe", line: PARENT_LINE });
        /* And it did not ask for a pick, because the answer already exists. */
        expect(compilerInput.pickWardrobe).toBe(false);
      });

      it("⚠ carries the parent's NULLS when the parent predates the paths", async () => {
        /*
          The same divergence with its sign flipped, and the one a conditional
          read would have produced: this account IS inside the flag, so a
          service that resolved a line here would paint eight people in the
          house outfit while the transaction wrote the parent's NULL pair.
        */
        const compilerInput = await followWith({ path: null, wardrobeLine: null });
        expect(compilerInput.inheritedWardrobe).toEqual({ path: null, line: null });
      });
    });
  });
});

describe("a reader outage on a roll is free (#126 — founder, Crew reply #7: 'refuse-free')", () => {
  /*
    The REAL compiler on the REAL service, with only the text engine doubled —
    and doubled to THROW, the way the deadline, the transport or the provider
    reach the catch branch (law 3). What this arm proves is the ordering the
    refusal's freedom rests on: the compile runs before the claim, so the
    money is never touched. Roll 219 went the other way and cost 160 credits.
  */
  it("refuses BAD_REQUEST with the outage sentence, and nothing is claimed or charged", async () => {
    const compileBrief = (compilerInput: Record<string, unknown>) =>
      castingBriefCompiler({
        ...(compilerInput as never as Parameters<typeof castingBriefCompiler>[0]),
        engine: {
          id: "test:interpreter-down",
          complete: async () => {
            throw new Error("TimeoutError: the brief interpreter exceeded its deadline");
          },
        },
      });
    await expect(
      createRoll(
        { ...(baseDependencies() as object), compileBrief } as never,
        {
          ...INPUT,
          briefText: "a young woman with an intense cyber-goth aesthetic, platinum-silver asymmetric shaved hair, pale porcelain skin, a leather harness and a choker",
        },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: READER_OUTAGE_MESSAGE });
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
    expect(journal).not.toContain("dispatch");
    expect(dbCalls.createRoll).not.toHaveBeenCalled();
  });
});
