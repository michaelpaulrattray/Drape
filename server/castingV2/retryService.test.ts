import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * THE RETRY (#122 shape 1) — the money sequence for ONE re-rendered slice.
 *
 * The roll suite's own fakes, over one row. Every arm here is about what
 * moves and in what order: the flag before any read, every refusal free and
 * before the claim, rows before money, the refund under the RETRY's own
 * reference and never the roll's, and the original failure class restored
 * when the charge does not land.
 */

const journal: string[] = [];
const refunds: Array<{ amount: number; reference: string }> = [];
let refundRecords = true;
let chargeSucceeds = true;

const ROLL_OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const RETRY_OPERATION_ID = "33333333-3333-4333-8333-333333333333";

type Row = {
  id: number;
  publicId: string;
  position: number;
  status: string;
  pointsCost: number;
  failureClass: string | null;
  internalPrompt: unknown;
  attemptCount: number;
};

const rows: { candidates: Row[]; roll: { id: number; publicId: string; status: string; compiledBrief: unknown } } = {
  candidates: [],
  roll: { id: 100, publicId: "roll-public", status: "partial", compiledBrief: null },
};

const dbCalls = {
  reset: vi.fn(),
  restore: vi.fn(),
  setRollStatus: vi.fn(),
  read: vi.fn(),
};

vi.mock("../db/castingV2", () => ({
  CastingV2OwnershipError: class extends Error {},
  getOwnedCandidateForRetry: vi.fn(async (_userId: number, publicId: string) => {
    dbCalls.read(publicId);
    const candidate = rows.candidates.find((row) => row.publicId === publicId);
    if (!candidate) return null;
    return { candidate: { ...candidate }, roll: { ...rows.roll } };
  }),
  resetCandidateForRetry: vi.fn(async ({ candidateId, pointsCost }: { candidateId: number; pointsCost: number }) => {
    dbCalls.reset(candidateId, pointsCost);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "failed") return false;
    journal.push("reset");
    row.status = "queued";
    row.failureClass = null;
    row.pointsCost = pointsCost;
    return true;
  }),
  restoreCandidateFailure: vi.fn(async ({ candidateId, failureClass }: { candidateId: number; failureClass: string }) => {
    dbCalls.restore(candidateId, failureClass);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "queued") return false;
    row.status = "failed";
    row.failureClass = failureClass;
    return true;
  }),
  listRollCandidateStatuses: vi.fn(async () => rows.candidates.map((row) => row.status)),
  setRollStatus: vi.fn(async (input: { status: string; from?: string[] }) => {
    dbCalls.setRollStatus(input);
    rows.roll.status = input.status;
    return true;
  }),
  markCandidateDispatched: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "queued") return false;
    row.status = "dispatched";
    row.attemptCount += 1;
    return true;
  }),
  landCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row) row.status = "ready";
    journal.push("land");
    return "ready";
  }),
  failCandidate: vi.fn(async ({ candidateId, failureClass }: { candidateId: number; failureClass: string }) => {
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row) {
      row.status = "failed";
      row.failureClass = failureClass;
    }
    return true;
  }),
}));

vi.mock("../db/connection", () => ({
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
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
  claimedFailure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
};

let claimAnswer: { type: "execute"; operationId: string } | { type: "replay"; operationId: string; result: unknown } =
  { type: "execute", operationId: RETRY_OPERATION_ID };

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("claim");
    return claimAnswer;
  }),
  completeDirectOperationSuccess: vi.fn(async (input: any) => receipts.success(input)),
  completeDirectOperationFailure: vi.fn(async (input: any) => receipts.failure(input)),
  failClaimedDirectOperation: vi.fn(async (input: any) => receipts.claimedFailure(input)),
}));

const {
  retryCandidate,
  rollStatusAfterRetry,
  promptOfInternal,
  statedInkOfCompiledBrief,
  RETRY_NOT_AVAILABLE_MESSAGE,
  RETRY_NOT_THIS_KIND_MESSAGE,
} = await import("./retryService");
const { candidateChargeReference } = await import("./rollRecovery");
const { ProviderError } = await import("../providers/types");
const { CASTING_V2_RETRY_PRICE_CREDITS } = await import("../casting/castingCreditCosts");
const { CANDIDATE_RENDER } = await import("./briefCompiler");
const directOperation = await import("../casting/directOperation");
const db = await import("../db/castingV2");

/** What reached the engine — the prompt and the box, asserted at the wire. */
const sent: Array<{ prompt: string; size: string; quality: string }> = [];

function engineThat(outcome: "delivers" | "fails") {
  return () => ({
    id: "fal:test",
    generateCandidate: vi.fn(async (input: { prompt: string; size: string; quality: string }) => {
      sent.push({ prompt: input.prompt, size: input.size, quality: input.quality });
      if (outcome === "fails") throw new ProviderError("timeout", "the engine timed out");
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

function dependencies(outcome: "delivers" | "fails" = "delivers", enabled = true) {
  return {
    engine: engineThat(outcome),
    retryEnabled: () => enabled,
    trimEnabled: () => false,
    markRunning: vi.fn(async () => {
      journal.push("running");
      return { operationId: RETRY_OPERATION_ID, chargeReferenceId: `op:${RETRY_OPERATION_ID}:charge` };
    }),
    deduct: vi.fn(async () => {
      journal.push("charge");
      return chargeSucceeds ? { success: true, newBalance: 100 } : { success: false, error: "Insufficient credits" };
    }),
    storeImage: vi.fn(async () => ({ key: "casting-v2/candidates/x.png" })),
  } as never;
}

const INPUT = {
  userId: 7,
  clientRequestId: "44444444-4444-4444-8444-444444444444",
  candidatePublicId: "cand-5",
};

function seed(failed: Partial<Row> = {}) {
  rows.candidates = [
    ...Array.from({ length: 7 }, (_, index) => ({
      id: index + 10,
      publicId: `cand-${index + 10}`,
      position: index,
      status: "ready",
      pointsCost: 20,
      failureClass: null,
      internalPrompt: { prompt: `words ${index + 1}` },
      attemptCount: 1,
    })),
    {
      id: 5,
      publicId: "cand-5",
      position: 7,
      status: "failed",
      pointsCost: 20,
      failureClass: "transport",
      internalPrompt: { prompt: "the words this tile was painted from" },
      attemptCount: 1,
      ...failed,
    },
  ];
  rows.roll = { id: 100, publicId: "roll-public", status: "partial", compiledBrief: null };
}

beforeEach(() => {
  journal.length = 0;
  sent.length = 0;
  refunds.length = 0;
  refundRecords = true;
  chargeSucceeds = true;
  claimAnswer = { type: "execute", operationId: RETRY_OPERATION_ID };
  seed();
  vi.clearAllMocks();
  receipts.success.mockImplementation(async () => undefined);
});

describe("the flag's door", () => {
  it("answers NOT_FOUND before any row is read when the account is outside the scope", async () => {
    await expect(retryCandidate(dependencies("delivers", false), INPUT)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: RETRY_NOT_AVAILABLE_MESSAGE,
    });
    expect(dbCalls.read).not.toHaveBeenCalled();
    expect(journal).not.toContain("claim");
  });
});

describe("admission — free, before the claim", () => {
  it("refuses a content-filter tile with the shape-two sentence, nothing claimed", async () => {
    seed({ failureClass: "content_policy" });
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: RETRY_NOT_THIS_KIND_MESSAGE,
    });
    expect(journal).not.toContain("claim");
    expect(dbCalls.reset).not.toHaveBeenCalled();
  });

  it("refuses a not-a-portrait tile and an unpaid one — neither is on his list", async () => {
    for (const failureClass of ["render_fault", "unpaid"]) {
      seed({ failureClass });
      await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    expect(journal).not.toContain("claim");
  });

  it("serves the didn't-arrive tile (no class on the row) exactly like an engine error", async () => {
    seed({ failureClass: null });
    const result = await retryCandidate(dependencies(), INPUT);
    expect(result.outcome).toBe("ready");
  });

  it("refuses while the sheet is still casting, and on a cancelled roll", async () => {
    rows.roll.status = "generating";
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/still casting/),
    });
    rows.roll.status = "cancelled";
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/cancelled/),
    });
    expect(journal).not.toContain("claim");
  });

  it("refuses a tile that is not failed, naming a casting one as already casting", async () => {
    seed({ status: "dispatched" });
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({
      message: "That tile is already casting.",
    });
    seed({ status: "ready" });
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(journal).not.toContain("claim");
  });

  it("refuses a row with no recorded prompt rather than rendering an empty one", async () => {
    seed({ internalPrompt: { resolved: {} } });
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({
      message: expect.stringMatching(/no recorded prompt/),
    });
    expect(journal).not.toContain("claim");
  });

  it("answers NOT_FOUND for a candidate this user does not own", async () => {
    await expect(retryCandidate(dependencies(), { ...INPUT, candidatePublicId: "cand-nobody" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("the sequence", () => {
  it("claims with the candidate lock, resets the row, runs, charges, then dispatches — in that order", async () => {
    const result = await retryCandidate(dependencies(), INPUT);
    expect(journal.filter((entry) => ["claim", "reset", "running", "charge", "dispatch", "land"].includes(entry)))
      .toEqual(["claim", "reset", "running", "charge", "dispatch", "land"]);
    expect(directOperation.beginDirectOperation).toHaveBeenCalledWith(expect.objectContaining({
      kind: "castingV2.retry",
      candidateLockPublicId: "cand-5",
      clientRequestId: INPUT.clientRequestId,
    }));
    expect(result).toMatchObject({
      candidateId: "cand-5",
      rollId: "roll-public",
      outcome: "ready",
      chargedCredits: CASTING_V2_RETRY_PRICE_CREDITS,
      refundedCredits: 0,
      refundRecorded: true,
      failureClass: null,
    });
  });

  it("sends the row's OWN prompt to the engine, byte for byte, at the sheet's render box", async () => {
    await retryCandidate(dependencies(), INPUT);
    expect(sent).toEqual([{
      prompt: "the words this tile was painted from",
      size: CANDIDATE_RENDER.size,
      quality: CANDIDATE_RENDER.quality,
    }]);
  });

  it("charges exactly one slice, pinned to the RETRY operation's reference", async () => {
    const deps = dependencies();
    await retryCandidate(deps, INPUT);
    const deduct = (deps as { deduct: ReturnType<typeof vi.fn> }).deduct;
    expect(deduct).toHaveBeenCalledTimes(1);
    expect(deduct).toHaveBeenCalledWith(
      7,
      CASTING_V2_RETRY_PRICE_CREDITS,
      "generation",
      "Casting retry (pending)",
      `op:${RETRY_OPERATION_ID}:charge`,
      "castingV2",
    );
    // The row is the refund authority: its cost is set in the reset statement.
    expect(dbCalls.reset).toHaveBeenCalledWith(5, CASTING_V2_RETRY_PRICE_CREDITS);
  });

  it("moves the roll from partial to complete when the rescued slice was the last one missing", async () => {
    await retryCandidate(dependencies(), INPUT);
    expect(rows.candidates.find((row) => row.id === 5)?.status).toBe("ready");
    expect(dbCalls.setRollStatus).toHaveBeenCalledWith({
      userId: 7, rollId: 100, status: "complete", from: ["partial", "failed"],
    });
    expect(receipts.success).toHaveBeenCalledWith(expect.objectContaining({
      operationId: RETRY_OPERATION_ID,
      chargedCredits: CASTING_V2_RETRY_PRICE_CREDITS,
      refundedCredits: 0,
      terminalStatus: "succeeded",
    }));
  });

  it("moves a roll that had lost everything to partial, not complete, while another slice is still failed", async () => {
    rows.candidates[0].status = "failed";
    rows.candidates[0].failureClass = "transport";
    rows.roll.status = "failed";
    await retryCandidate(dependencies(), INPUT);
    expect(dbCalls.setRollStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "partial" }));
  });

  it("replays an already-bought retry rather than buying a second one", async () => {
    const bought = { candidateId: "cand-5", rollId: "roll-public", outcome: "ready" };
    claimAnswer = { type: "replay", operationId: RETRY_OPERATION_ID, result: bought };
    const result = await retryCandidate(dependencies(), INPUT);
    expect(result).toEqual(bought);
    expect(dbCalls.reset).not.toHaveBeenCalled();
    expect(journal).not.toContain("charge");
  });
});

describe("when the engine fails again", () => {
  it("refunds the one slice under the RETRY's reference — never the roll's — and leaves the roll's status alone", async () => {
    await expect(retryCandidate(dependencies("fails"), INPUT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: `That tile didn't arrive again. ${CASTING_V2_RETRY_PRICE_CREDITS} credits were refunded.`,
    });
    expect(refunds).toEqual([{
      amount: CASTING_V2_RETRY_PRICE_CREDITS,
      reference: candidateChargeReference(RETRY_OPERATION_ID, "cand-5"),
    }]);
    // The original slice's refund lived under the ROLL's operation. Different
    // by construction, so neither can ever be mistaken for the other.
    expect(refunds[0].reference).not.toBe(candidateChargeReference(ROLL_OPERATION_ID, "cand-5"));
    expect(rows.candidates.find((row) => row.id === 5)).toMatchObject({ status: "failed", failureClass: "timeout" });
    expect(dbCalls.setRollStatus).not.toHaveBeenCalled();
    expect(receipts.failure).toHaveBeenCalledWith(expect.objectContaining({
      chargedCredits: CASTING_V2_RETRY_PRICE_CREDITS,
      refundedCredits: CASTING_V2_RETRY_PRICE_CREDITS,
    }));
  });

  it("never says 'refunded' when the refund did not record — it names the operation for support", async () => {
    refundRecords = false;
    await expect(retryCandidate(dependencies("fails"), INPUT)).rejects.toMatchObject({
      message: expect.stringContaining(`quote operation ${RETRY_OPERATION_ID}`),
    });
    expect(receipts.failure).toHaveBeenCalledWith(expect.objectContaining({
      chargedCredits: CASTING_V2_RETRY_PRICE_CREDITS,
      refundedCredits: 0,
    }));
  });
});

describe("when the money does not move", () => {
  it("restores the ORIGINAL failure class when the charge does not land — not `unpaid`", async () => {
    chargeSucceeds = false;
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient credits",
    });
    expect(dbCalls.restore).toHaveBeenCalledWith(5, "transport");
    expect(rows.candidates.find((row) => row.id === 5)).toMatchObject({ status: "failed", failureClass: "transport" });
    expect(journal).not.toContain("dispatch");
    expect(refunds).toEqual([]);
    expect(receipts.failure).toHaveBeenCalledWith(expect.objectContaining({ chargedCredits: 0, refundedCredits: 0 }));
  });

  it("closes free at the claimed finalizer when the reset CAS is lost, charging nothing", async () => {
    vi.mocked(db.resetCandidateForRetry).mockResolvedValueOnce(false);
    await expect(retryCandidate(dependencies(), INPUT)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(receipts.claimedFailure).toHaveBeenCalledTimes(1);
    expect(journal).not.toContain("charge");
    expect(journal).not.toContain("running");
  });
});

describe("the readers", () => {
  it("reads the prompt off the row and refuses an empty or missing one", () => {
    expect(promptOfInternal({ prompt: "words", resolved: {} })).toBe("words");
    expect(promptOfInternal({ prompt: "   " })).toBeNull();
    expect(promptOfInternal({ resolved: {} })).toBeNull();
    expect(promptOfInternal(null)).toBeNull();
    expect(promptOfInternal("words")).toBeNull();
  });

  it("reads statedInk off the roll's persisted compile, null on any other shape", () => {
    const ink = { regions: ["neck"], readFailed: false };
    expect(statedInkOfCompiledBrief({ intent: { statedInk: ink } })).toEqual(ink);
    expect(statedInkOfCompiledBrief({ intent: { statedInk: null } })).toBeNull();
    expect(statedInkOfCompiledBrief({ intent: {} })).toBeNull();
    expect(statedInkOfCompiledBrief(null)).toBeNull();
  });

  it("names the roll complete only when no slice is still undelivered", () => {
    expect(rollStatusAfterRetry(["ready", "ready", "signed", "discarded"])).toBe("complete");
    expect(rollStatusAfterRetry(["ready", "failed"])).toBe("partial");
    expect(rollStatusAfterRetry(["ready", "cancelled"])).toBe("partial");
    expect(rollStatusAfterRetry(["ready", "expired"])).toBe("partial");
  });
});
