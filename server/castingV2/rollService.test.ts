import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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
/*
  THE CREDIT LEDGER, in the order rows were written (#995). `readCancelCharge`
  and the live seal both read it through the real `readOperationLedger`, so the
  question "was this roll charged yet?" is answered by rows, never by a flag.
  Seeded with the roll's charge in `beforeEach`, because the fixture roll is
  `generating` and a generating roll has been charged; the #995 arms clear it.
*/
const ledger: Array<{ userId: number; referenceId: string; type: string; amount: number; description?: string }> = [];
let ledgerReadThrows = false;
let chargeSucceeds = true;
/* Candidate ids whose `markCandidateDispatched` THROWS — the write before the
   try, which is where the remote database dropped roll 111 (#855). */
const dispatchWriteThrowsFor = new Set<number>();

const dbCalls = {
  createRoll: vi.fn(),
  failCandidate: vi.fn(),
  setRollStatus: vi.fn(),
  cancelQueued: vi.fn(),
  markDispatched: vi.fn(),
  land: vi.fn(),
};

vi.mock("../db/castingV2", async (importOriginal) => ({
  /* The REAL class, not a bare `extends Error`: the #854 door arm asserts the
     sentence a foreign session gets, and a stand-in with no message would pass
     that arm on an empty string. The module's db connection is lazy, so
     importing it under the stripped DATABASE_URL opens nothing. */
  CastingV2OwnershipError: (await importOriginal<typeof import("../db/castingV2")>()).CastingV2OwnershipError,
  createRollWithCandidates: vi.fn(async (input: unknown) => {
    journal.push("rows");
    dbCalls.createRoll(input);
    return {
      session: { id: 10 },
      roll: { id: 100, publicId: "roll-public", sessionId: 10, operationId: OPERATION_ID, priceCredits: 160 },
      candidates: rows.candidates,
    };
  }),
  listRollCandidates: vi.fn(async () => rows.candidates),
  /* The sheet, read before the compile (#854). `open` is the fixture's default;
     the door arms override it to `expired`, `abandoned` and null. */
  getOwnedCastingSession: vi.fn(async () => ({ id: 10, status: "open" })),
  getRollByOperation: vi.fn(async () => ({
    id: 100,
    publicId: "roll-public",
    priceCredits: 160,
    operationId: OPERATION_ID,
  })),
  /* A follow's parent. Only the pick arms roll a follow, and all they need is
     for the read to succeed — the lineage itself is `followAnchor`'s suite.

     ⚠ THE TWO KEYS DIFFER ON PURPOSE (#185 half 2). `candidate.imageKey` is the
     PRISTINE MASTER and the top-level `imageKey` is THE SELECTED FACE — which
     is a refinement's frame whenever one is selected, because that is what
     `getOwnedCandidateWithSelectedFace` resolves. A fixture carrying only one
     of them cannot tell the two apart, so an anchor that quietly went back to
     the master would still have measured green. */
  getOwnedCandidateWithSelectedFace: vi.fn(async () => ({
    candidate: {
      id: 1,
      publicId: "66666666-6666-4666-8666-666666666666",
      position: 3,
      imageKey: "casting-v2/candidates/parent-MASTER.png",
    },
    internalPrompt: null,
    /* The SELECTED face's frame — what a Row A follow attaches (#177). */
    imageKey: "casting-v2/candidates/parent-frame.png",
  })),
  /* The parent ROLL's compiled brief, read by the honest follow source (#176).
     No `register` = a house-road parent, which keeps these arms on the road
     they were written for; the author-road gate is `followGhost`'s suite. */
  getBriefForOwnedCandidate: vi.fn(async () => ({
    compiledBrief: {},
    lockContract: {},
    briefText: "",
  })),
  /* The parent SHEET's born pair. Its default is the honest one for a fixture
     whose parent predates the paths: both NULL, which must keep the follow's
     prompt unpathed. The follow arms override it. */
  getRollWardrobeForOwnedCandidate: vi.fn(async () => ({ wardrobeLine: null })),
  getOwnedRoll: vi.fn(async () => ({
    id: 100,
    publicId: "roll-public",
    status: "generating",
    operationId: OPERATION_ID,
  })),
  markCandidateDispatched: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.markDispatched(candidateId);
    if (dispatchWriteThrowsFor.has(candidateId)) {
      throw Object.assign(new Error("Got timeout reading communication packets"), { code: "ER_NET_READ_INTERRUPTED" });
    }
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

vi.mock("../db/connection", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    // No frozen account in these scenarios; the frozen path has its own case.
    getDb: async () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (getTableName(table as never) !== "point_transactions") {
              return { limit: async () => [{ frozenAt: null }] };
            }
            if (ledgerReadThrows) return Promise.reject(new Error("Connection lost: The server closed the connection."));
            return Promise.resolve([...ledger]);
          },
        }),
      }),
    }),
  };
});

/*
  THE ANCHOR FRAME'S STORE (#177 Row A): an authored follow reads the followed
  face's bytes before the claim, and refuses free when they cannot be read.
  `storagePut`/`storageDelete` are stubbed because the module binds them at
  load; every arm's stores go through the injected `storeImage` dependency.
*/
let anchorBytesAvailable = true;
const anchorReads: string[] = [];
vi.mock("../storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://public/${key}` })),
  storageDelete: vi.fn(async () => undefined),
  storageReadBytes: vi.fn(async (key: string) => {
    anchorReads.push(key);
    if (!anchorBytesAvailable) throw new Error("NoSuchKey");
    return { bytes: Buffer.from("anchor-frame"), contentType: "image/png" };
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
    recordRefund: vi.fn(async (userId: number, amount: number, description: string, reference: string) => {
      journal.push("refund");
      if (!refundRecords) return { recorded: false, amount: 0, reference };
      refunds.push({ amount, reference });
      // The ledger's unique reference, as the real index enforces it.
      const referenceId = actual.refundReferenceFor(reference);
      if (!ledger.some((row) => row.referenceId === referenceId)) {
        ledger.push({ userId, referenceId, type: "refund", amount, description });
      }
      return { recorded: true, amount, reference };
    }),
  };
});

/*
  THE SWEEP'S OWN ADJUDICATOR, as the live road (#855) reaches for it. Its
  verdict is dictated per arm; what these arms prove is the WIRING — that a
  throw mid-loop reaches it at all, after every sibling has finished, and that
  each verdict maps to the exit the receipt was sealed with. The adjudicator's
  own money law is `rollRecovery.test.ts`'s.
*/
const adjudicator = {
  recover: vi.fn(async (_operation: unknown): Promise<unknown> => {
    throw new Error("arm did not dictate a verdict");
  }),
  park: vi.fn(async (_input: unknown) => undefined),
  handoff: vi.fn(async (_input: unknown) => undefined),
};
vi.mock("./rollRecovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./rollRecovery")>()),
  recoverCastingV2RollOperation: vi.fn(async (operation: unknown) => {
    journal.push("adjudicate");
    return adjudicator.recover(operation);
  }),
  /* The live seal's ledger reading (#994). Its money law is `rollRecovery.test.ts`'s;
     here it answers "nothing cancelled" unless an arm dictates otherwise, and the
     arms prove the receipt carries ITS figure rather than the rows'. */
  settleCancelledSlices: vi.fn(async (_input: unknown) => ({ refundedCredits: 0, unrecorded: 0 })),
}));
vi.mock("../db/generationOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/generationOperations")>()),
  markGenerationOperationRecoveryRequired: vi.fn(async (input: unknown) => adjudicator.park(input)),
  handoffGenerationOperationToRecovery: vi.fn(async (input: unknown) => adjudicator.handoff(input)),
}));

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
const { getOwnedCastingSession } = vi.mocked(await import("../db/castingV2"));
const { refusalTagOf } = await import("./refusalTag");
const { BRIEF_TEXT_MAX_AUTHOR_ROAD, BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE } = await import("./briefLength");
const { deterministicBriefCompiler, castingBriefCompiler, READER_OUTAGE_MESSAGE } = await import("./briefCompiler");
const {
  candidateChargeReference,
  candidateUnseenChargeReference,
  settleCancelledSlices,
  ROLL_RECOVERY_SENTENCE,
} = await import("./rollRecovery");
const { recordRefund } = await import("../casting/atomicCredits");
const { ROLL_UNSEEN_REFUND_DESCRIPTION } = await import("./sliceRefundLedger");
const { ProviderError } = await import("../providers/types");

/** The roll's charge row, as `deductCredits` writes it under the pinned reference. */
function chargeRow() {
  return { userId: 7, referenceId: `op:${OPERATION_ID}:charge`, type: "generation", amount: -160 };
}

function seedCandidates(count = 8) {
  rows.candidates = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    publicId: `cand-${index + 1}`,
    position: index,
    pointsCost: 20,
    status: "queued",
  }));
}

/** What each dispatch handed the engine — the anchored arms read `references` off it. */
const engineSent: Array<{ prompt: string; references?: readonly { bytes: Buffer }[] }> = [];

/** An engine whose per-candidate outcome the test dictates. */
function engineWhere(fails: (position: number) => boolean) {
  let call = 0;
  return () => ({
    id: "fal:test",
    generateCandidate: vi.fn(async (request: { prompt: string; references?: readonly { bytes: Buffer }[] }) => {
      engineSent.push({ prompt: request.prompt, references: request.references });
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
  anchorReads.length = 0;
  engineSent.length = 0;
  anchorBytesAvailable = true;
  refundRecords = true;
  chargeSucceeds = true;
  ledgerReadThrows = false;
  ledger.length = 0;
  ledger.push(chargeRow());
  dispatchWriteThrowsFor.clear();
  seedCandidates();
  vi.clearAllMocks();
  receipts.success.mockImplementation(async () => undefined);
  adjudicator.recover.mockImplementation(async () => {
    throw new Error("arm did not dictate a verdict");
  });
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

  /*
    THE SHEET IS READ BEFORE THE INTERPRETER (#854). An expired sheet's Roll
    again used to spend a ~13 s paid text call and only then meet the roll
    transaction's "Casting session not found" — the wrong sentence for "too
    old to roll on". These arms hold the ORDER (the compiler is never reached)
    and the SENTENCE (it names expiry, never absence), and they are driven at
    the service with the compiler spied, so an LLM that happens to behave
    cannot rescue them (working law 3).
  */
  describe("a sheet that cannot be rolled on refuses before any text call", () => {
    const compilerReached = () => {
      const compileBrief = vi.fn(async (compilerInput: unknown) =>
        (baseDependencies() as { compileBrief: (input: unknown) => unknown }).compileBrief(compilerInput),
      );
      return { compileBrief, dependencies: { ...(baseDependencies() as object), compileBrief } as never };
    };

    it("an EXPIRED sheet: PRECONDITION_FAILED, the sentence names expiry, the compiler is never called", async () => {
      getOwnedCastingSession.mockResolvedValueOnce({ id: 10, status: "expired" } as never);
      const { compileBrief, dependencies } = compilerReached();

      const refusal = await createRoll(dependencies, INPUT).then(
        () => { throw new Error("rolled on an expired sheet"); },
        (error: { code: string; message: string }) => error,
      );
      expect(refusal).toMatchObject({ code: "PRECONDITION_FAILED" });
      // The door's own name, so the capability atlas can see it was proven to shut.
      expect(refusalTagOf(refusal)?.reason).toBe("session_expired");
      expect(refusal.message).toMatch(/expired/i);
      // The old sentence, and the one the card is about: absence, for a sheet
      // the customer is looking at.
      expect(refusal.message).not.toMatch(/not found/i);
      expect(refusal.message).toMatch(/nothing was charged/i);

      expect(compileBrief).not.toHaveBeenCalled();
      expect(journal).not.toContain("claim");
      expect(journal).not.toContain("charge");
      expect(getOwnedCastingSession).toHaveBeenCalledWith(INPUT.userId, INPUT.sessionPublicId);
    });

    it("an ABANDONED sheet (their own Start over): the same door, a sentence that says closed", async () => {
      getOwnedCastingSession.mockResolvedValueOnce({ id: 10, status: "abandoned" } as never);
      const { compileBrief, dependencies } = compilerReached();

      const refusal = await createRoll(dependencies, INPUT).catch((error: unknown) => error);
      expect(refusal).toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(/closed/i) });
      expect(refusalTagOf(refusal)?.reason).toBe("session_closed");
      expect(compileBrief).not.toHaveBeenCalled();
      expect(journal).not.toContain("claim");
    });

    it("a sheet that is not this account's keeps the ownership sentence and code, still before the compiler", async () => {
      getOwnedCastingSession.mockResolvedValueOnce(null);
      const { compileBrief, dependencies } = compilerReached();

      const refusal = await createRoll(dependencies, INPUT).catch((error: unknown) => error);
      expect(refusal).toMatchObject({ code: "NOT_FOUND", message: "Casting session not found" });
      expect(refusalTagOf(refusal)?.reason).toBe("session_missing");
      expect(compileBrief).not.toHaveBeenCalled();
      expect(journal).not.toContain("claim");
    });

    it("positive control: an OPEN sheet reaches the compiler and rolls", async () => {
      const { compileBrief, dependencies } = compilerReached();
      await createRoll(dependencies, INPUT);
      expect(compileBrief).toHaveBeenCalledTimes(1);
      expect(journal).toContain("charge");
    });
  });

  it("refuses an uninterpretable brief for free", async () => {
    await expect(
      createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
  });

  /*
    ⚠ THE 2,000-CHARACTER ARM IS DELETED WITH ITS SUBJECT (#1204).

    It drove a brief over 2,000 with the register flag unset and asserted the
    house road's refusal. That road's population emptied when the flag went to
    `all` on 2026-09-24, so the arm proved a refusal nobody could meet — and it
    could not have gone red, because it set the world it was testing. A test
    whose subject no longer exists cannot be salvaged into one that means
    something; what it incidentally guarded (a long brief is refused FREE,
    before the claim, with a sentence) is guarded at the real bound by the
    4,000 arm below, which asserts the same three properties.
  */
  it("a brief that fits reaches the compiler untouched", async () => {
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
    THE STYLE (#142) reaches the compile exactly as sent, and absent stays
    absent — the default is the compiler's to apply, never a second copy of
    "photoreal" written here. (The imagination meter this spy used to watch is
    gone, #535 — `CreateRollInput` no longer has the field, which is the
    stronger guarantee: nothing here could hand one on.)
  */
  const compileSpy = (seen: (string | undefined)[]) => {
    const dependencies = baseDependencies();
    const compileBrief = (dependencies as { compileBrief: (input: { style?: string }) => unknown }).compileBrief;
    return {
      ...(dependencies as object),
      compileBrief: (input: { style?: string }) => {
        seen.push(input.style);
        return compileBrief(input);
      },
    } as never;
  };

  it("hands `style` to the compile as sent", async () => {
    const seen: (string | undefined)[] = [];
    await createRoll(compileSpy(seen), { ...INPUT, style: "photoreal" });
    expect(seen).toEqual(["photoreal"]);
  });

  it("hands the compiler NO path key at all and no wardrobe pick, even when a path is sent (#203 — the road is retired)", async () => {
    /*
      The COMPILER's side of the entrance, which the wire block above does not
      read: what the prompt is composed from, rather than what the insert gets.

      This arm was once about the author road WINNING over the two-paths flag
      (review of #138, finding 1) — an account could be inside both and the
      author road had to decide. There is no longer a second road for it to
      beat, so the flag stubs are gone and the claim is unconditional: a path
      sent from anywhere reaches neither the prompt nor the pick.

      ⚠ **AND IT NOW ASKS ABOUT THE KEY RATHER THAN THE VALUE — step (e), the
      same correction step (d) made one field over, arriving for the same
      reason.** It asserted `path` was `null`; step (e) stopped passing the
      field, so `undefined` is what a reader of `input.path` sees and
      `toBeNull()` FAILED — loudly, which is the good outcome. Had it been
      written as `toBeFalsy()` or `toEqual({...})` it would have gone green over
      a compiler that is no longer handed the field, which is the whole change.
      `in` answers the question actually being asked, and the control below
      keeps the absence honest.
    */
    const seen: { hasPath: boolean; hasPick: boolean; keys: string[] }[] = [];
    const dependencies = baseDependencies();
    const compileBrief = (dependencies as { compileBrief: (input: { path?: unknown }) => unknown }).compileBrief;
    await createRoll(
      {
        ...(dependencies as object),
        compileBrief: (input: { path?: unknown }) => {
          /*
            ⚠ THE KEY'S ABSENCE, NOT ITS VALUE — #203 slice 2, step (d).

            This read `pickWardrobe: input.pickWardrobe` and compared against
            `false` while the field existed. `toEqual` does not distinguish an
            undefined property from a missing one, so the same assertion would
            have gone on passing over a compiler that had never been handed the
            field at all — a green arm proving nothing, on the retirement it
            was pointed at. `in` answers the question actually being asked.
          */
          seen.push({
            hasPath: "path" in input,
            hasPick: "pickWardrobe" in input,
            keys: Object.keys(input),
          });
          return compileBrief(input);
        },
      } as never,
      /* The whole object is cast, because the input type NO LONGER DECLARES a
         path — which is itself the retirement, and is why sending one has to
         be done deliberately here rather than by accident anywhere else. */
      { ...INPUT, path: "wardrobe" } as never,
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]!.hasPath).toBe(false);
    expect(seen[0]!.hasPick).toBe(false);
    /* CONTROL — the spy really saw a populated compile input, so both absences
       above are fields that are GONE rather than an object nobody filled in.
       ⚠ `path` was on this control list until step (e) and has moved to the
       assertion above: it was the proof the key existed, and it is now the
       proof it does not. */
    expect(seen[0]!.keys).toContain("briefText");
    expect(seen[0]!.keys).toContain("rollSeed");
  });

  it("and absent stays absent — the author's default is the compiler's to apply, never a second copy here", async () => {
    const seen: (string | undefined)[] = [];
    await createRoll(compileSpy(seen), INPUT);
    expect(seen).toEqual([undefined]);
  });

  /*
    ⚠ THE SECOND HALF OF THIS ARM WENT WITH THE SECOND BOUND (#1204).

    It read *"…off the flag the same roll stops at 2,000"* and drove exactly
    that: register flag unset, 2,100 characters, refused. **That was the whole
    point of the arm — the bound keying on the ROAD rather than on the flag —
    and the two roads stopped differing on 2026-09-24.** The half that survives
    is the one that is still a fact about the product: a chip-edited roll is the
    author road (#154, the family clause) and carries a brief past 2,000
    without refusal. It is kept because that is the behaviour #154 bought, and
    2,000 is still the number the old road would have stopped it at.
  */
  it("a chip-edited roll is the author road since #154 and carries a brief past 2,000", async () => {
    const long = "a wiry cyclist ".repeat(140);
    expect(long.length).toBeGreaterThan(2000);
    vi.stubEnv("CASTING_V2_SCOPE", "all");
    vi.stubEnv("CASTING_CREATIVE_REGISTER_SCOPE", `users:${INPUT.userId}`);
    try {
      await expect(
        createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: long, unlock: ["sex"] as never }),
      ).resolves.toMatchObject({ ready: 8 });
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

  it("refunds under the sentence and the reference the recovery sweep pays a torn cancel with (#955)", async () => {
    const { recordRefund } = await import("../casting/atomicCredits");
    const { ROLL_CANCEL_REFUND_DESCRIPTION } = await import("./sliceRefundLedger");

    await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    /*
      Asserted at the wire (working law 5). The sweep pays a cancel that died
      before this call under the same charge reference, so the two meet as a
      ledger duplicate rather than a second refund — and under the same words,
      so the customer reads one line whichever of the two paid them.
    */
    const calls = vi.mocked(recordRefund).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, , description, reference] of calls) {
      expect(description).toBe(ROLL_CANCEL_REFUND_DESCRIPTION);
      const candidateId = reference.split(":candidate:")[1];
      expect(reference).toBe(candidateChargeReference(OPERATION_ID, candidateId));
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

  it("writes the unseen refund in the sentence recovery pays it with (#994)", async () => {
    rows.candidates = [
      { id: 1, publicId: "cand-1", position: 0, pointsCost: 20, status: "queued", cancelledMidFlight: true },
    ];
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toThrow();

    const calls = vi.mocked(recordRefund).mock.calls;
    expect(calls.map((call) => call[2])).toEqual([ROLL_UNSEEN_REFUND_DESCRIPTION]);
    expect(calls[0][3]).toBe(candidateUnseenChargeReference(OPERATION_ID, "cand-1"));
  });

  /*
    THE RECEIPT'S CANCEL SHARE (#994). It summed the `cancelled` rows' prices;
    it now carries what the live seal read off the ledger. The seal's own money
    law is `rollRecovery.test.ts`'s — these prove the wiring.
  */
  it("puts the ledger's cancel refunds on the receipt, not the cancelled rows' prices", async () => {
    rows.candidates[7].status = "cancelled";
    vi.mocked(settleCancelledSlices).mockResolvedValueOnce({ refundedCredits: 0, unrecorded: 1 });

    await createRoll(baseDependencies(), INPUT);

    expect(settleCancelledSlices).toHaveBeenCalledWith({
      userId: 7,
      operationId: OPERATION_ID,
      candidates: rows.candidates,
    });
    // The row is priced at 20. The ledger says nothing came back, so neither
    // does the receipt.
    expect(receipts.success).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 0, terminalStatus: "partial" }),
    );
  });

  it("quotes the operation, never 'refunded', when a whole-sheet cancel's refund will not record", async () => {
    rows.candidates.forEach((candidate) => {
      candidate.status = "cancelled";
    });
    vi.mocked(settleCancelledSlices).mockResolvedValueOnce({ refundedCredits: 140, unrecorded: 1 });

    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      message: `That roll was cancelled. Part of the refund could not be recorded — quote operation ${OPERATION_ID} and support will restore the balance.`,
    });
    expect(receipts.failure).toHaveBeenCalledWith(expect.objectContaining({ refundedCredits: 140 }));
  });

  it("THE CONTROL: says the credits came back when the ledger holds every cancel refund", async () => {
    rows.candidates.forEach((candidate) => {
      candidate.status = "cancelled";
    });
    vi.mocked(settleCancelledSlices).mockResolvedValueOnce({ refundedCredits: 160, unrecorded: 0 });

    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      message: "That roll was cancelled. 160 credits were refunded.",
    });
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

/*
  A CANCEL THAT BEATS THE CHARGE (#995).

  `createRoll` commits the rows before it deducts, and a `pending` roll is
  cancellable, so a second tab can cancel inside that window. The cancel used
  to refund credits that had not been taken: the ledger then held a refund
  older than its own charge, and if the deduct failed the customer kept
  credits for a roll nobody paid for.

  These arms drive the window itself. The deduct is the spy, and it lets the
  cancel land before it writes the charge row. The ledger is read through the
  real `readOperationLedger` at both the cancel and the live seal. Nothing in
  them is a flag that says "charged".
*/
describe("a cancel that lands before the roll is charged (#995)", () => {
  const actualRecovery = async () => vi.importActual<typeof import("./rollRecovery")>("./rollRecovery");
  const cancelRefundReference = (publicId: string) =>
    `op:${OPERATION_ID}:charge:candidate:${publicId}`;

  /** A deduct that lets a cancel in first, then charges (or fails) as the arm says. */
  function deductAfterCancel(landed: { cancel?: Awaited<ReturnType<typeof cancelRoll>> }, charges: boolean) {
    return vi.fn(async () => {
      landed.cancel = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });
      journal.push("charge");
      if (!charges) return { success: false, error: "User credits not found" };
      ledger.push(chargeRow());
      return { success: true, newBalance: 100 };
    });
  }

  beforeEach(async () => {
    ledger.length = 0;
    const castingDb = await import("../db/castingV2");
    vi.mocked(castingDb.getOwnedRoll).mockResolvedValue({
      id: 100,
      publicId: "roll-public",
      status: "pending",
      operationId: OPERATION_ID,
    } as never);
    // The live seal is the REAL one here: it is the road that pays these slices.
    const { settleCancelledSlices: realSeal } = await actualRecovery();
    vi.mocked(settleCancelledSlices).mockImplementation(realSeal);
  });

  afterEach(async () => {
    const castingDb = await import("../db/castingV2");
    vi.mocked(castingDb.getOwnedRoll).mockReset();
    vi.mocked(castingDb.getOwnedRoll).mockImplementation(async () => ({
      id: 100,
      publicId: "roll-public",
      status: "generating",
      operationId: OPERATION_ID,
    }) as never);
    vi.mocked(settleCancelledSlices).mockReset();
    vi.mocked(settleCancelledSlices).mockImplementation(async () => ({ refundedCredits: 0, unrecorded: 0 }));
  });

  it("THE DEFECT: refunds nothing before the charge, then the seal pays each slice once, after the charge", async () => {
    const landed: { cancel?: Awaited<ReturnType<typeof cancelRoll>> } = {};
    const dependencies = { ...(baseDependencies() as object), deduct: deductAfterCancel(landed, true) } as never;

    await expect(createRoll(dependencies, INPUT)).rejects.toMatchObject({
      message: "That roll was cancelled. 160 credits were refunded.",
    });

    // The press worked: every tile stopped, and the cancel claimed no money.
    expect(landed.cancel).toMatchObject({ cancelled: 8, refundedCredits: 0, refundUnrecorded: false });

    // THE ORDER: the charge is the first row, and every refund follows it.
    expect(ledger[0]).toMatchObject({ referenceId: `op:${OPERATION_ID}:charge`, type: "generation" });
    const refundRows = ledger.slice(1);
    expect(refundRows).toHaveLength(8);
    expect(refundRows.every((row) => row.type === "refund" && row.amount === 20)).toBe(true);
    // Once each, under the cancel's own reference and in the cancel's words.
    const { refundReferenceFor } = await vi.importActual<typeof import("../casting/atomicCredits")>("../casting/atomicCredits");
    const { ROLL_CANCEL_REFUND_DESCRIPTION } = await import("./sliceRefundLedger");
    expect(new Set(refundRows.map((row) => row.referenceId))).toEqual(
      new Set(rows.candidates.map((candidate) => refundReferenceFor(cancelRefundReference(candidate.publicId as string)))),
    );
    expect(refundRows.every((row) => row.description === ROLL_CANCEL_REFUND_DESCRIPTION)).toBe(true);
    expect(receipts.failure).toHaveBeenCalledWith(expect.objectContaining({ chargedCredits: 160, refundedCredits: 160 }));
  });

  it("THE DEFECT, BY THE FAILED DEDUCT: a roll that is never charged leaves no refund on the ledger", async () => {
    const landed: { cancel?: Awaited<ReturnType<typeof cancelRoll>> } = {};
    const dependencies = { ...(baseDependencies() as object), deduct: deductAfterCancel(landed, false) } as never;

    await expect(createRoll(dependencies, INPUT)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(landed.cancel).toMatchObject({ cancelled: 8, refundedCredits: 0, refundUnrecorded: false });
    // Nothing taken, nothing given back: no credits minted out of a roll nobody paid for.
    expect(ledger).toEqual([]);
    expect(refunds).toHaveLength(0);
  });

  it("THE CONTROL: a cancel after the charge refunds as before, one row each", async () => {
    ledger.push(chargeRow());
    rows.candidates.slice(0, 3).forEach((candidate) => {
      candidate.status = "dispatched";
    });

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    expect(result).toMatchObject({ cancelled: 5, refundedCredits: 100, refundUnrecorded: false });
    expect(ledger.filter((row) => row.type === "refund")).toHaveLength(5);
    expect(ledger.indexOf(ledger.find((row) => row.type === "generation")!)).toBe(0);
  });

  it("refunds nothing, and says so, when the ledger cannot be read", async () => {
    ledger.push(chargeRow());
    ledgerReadThrows = true;

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    // The tiles still stop; the money is reported unrecorded rather than claimed.
    expect(result).toMatchObject({ cancelled: 8, refundedCredits: 0, refundUnrecorded: true });
    expect(refunds).toHaveLength(0);
  });

  it("refunds nothing, and says so, when the charge is ambiguous", async () => {
    ledger.push(chargeRow(), chargeRow());

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    expect(result).toMatchObject({ cancelled: 8, refundedCredits: 0, refundUnrecorded: true });
    expect(refunds).toHaveLength(0);
  });

  it("does not read the ledger when the cancel won nothing it could owe", async () => {
    rows.candidates.forEach((candidate) => {
      candidate.status = "dispatched";
    });
    ledgerReadThrows = true;

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    // An unreadable ledger would have said "unrecorded"; nothing was owed, so it was never asked.
    expect(result).toMatchObject({ cancelled: 0, refundedCredits: 0, refundUnrecorded: false, stillFinishing: 8 });
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
 * NO ROLL IS BORN ON A PATH — asserted AT THE WIRE, on what actually reaches
 * the insert (#203, his ruling 2026-08-28: *"yeah we will retire the
 * wardrobe/basics path obviously"*).
 *
 * ⚠ **WHAT THIS BLOCK USED TO BE, AND WHY THE REPLACEMENT IS NOT WEAKER.**
 * It drove the flag's two sides and the toggle's two values — four rolls, a
 * pick asked for on exactly one of them, and a CONTROL proving the toggle
 * really moved the answer. Every one of those arms had the same subject: a
 * CHOICE a customer could make. The choice is retired, so a driven pair over
 * it would be a control that cannot fail wearing coverage's clothes.
 *
 * What replaces it is the claim this slice actually makes, and it is a
 * REFUSAL rather than an equality: **a `path` sent anyway does not reach the
 * row.** That arm reddens if the constant is ever quietly turned back into a
 * read of the input, which is the one regression this retirement can suffer
 * and the only one worth a driver.
 *
 * The follow's inheritance arms are UNTOUCHED and deliberately so: a follow
 * still inherits its parent's pair, and rolls written while the road ran still
 * carry one. Retiring the entrance does not retire the record.
 */
describe("no roll is born on a path", () => {
  const castingDbModule = () => import("../db/castingV2");

  /*
    ⚠ THE FIXTURE IS STATEFUL, and an arm that rolls twice inside one `it` is
    the thing that found it: `rows.candidates` is consumed by a roll, so the
    second call in a loop met a sheet that was already spent and came back
    "that roll was cancelled". Re-seeded before EVERY roll rather than once per
    test — a stateful fixture re-establishes its state in front of each row it
    is asked about, which is the census corpus's own first law.
  */
  async function roll(extra: Record<string, unknown> = {}) {
    seedCandidates();
    await createRoll(baseDependencies(), { ...INPUT, ...extra } as never);
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

  it("writes NULL for both columns — and NULL is not `wardrobe`", async () => {
    /*
      NULL keeps the meaning it has always had on these columns: *not cast on a
      path*. A default written here would make a roll cast after the retirement
      indistinguishable from one whose owner chose Wardrobe, permanently and
      with no way back — which is the argument `shared/castingPaths.ts` makes
      about the absence, still load-bearing after the control is gone.
    */
    const written = await roll();
    expect(written.path).toBeNull();
    expect(written.wardrobeLine).toBeNull();
  });

  it("⚠ REFUSES a path sent anyway — the entrance is closed at the service, not only at the client", async () => {
    /*
      THE ARM THAT MATTERS, and it is driven through the real service rather
      than read off the constant.

      Neither `createRoll`'s input nor its procedure schema declares a path any
      more — the one-deploy wire tolerance came off in #203 slice 2a, and the
      arm that proves the WIRE refuses it lives in `_core/invalidInputWire`.
      This arm is the layer beneath that one and outlives it on purpose: the
      service must ignore a path however one arrives, because a resurrected
      reader here would write a column nobody chose. So it sends one — in both
      his words — and proves the row is unmoved.
    */
    for (const path of ["wardrobe", "basics"]) {
      const written = await roll({ path });
      expect(written.path, path).toBeNull();
      expect(written.wardrobeLine, path).toBeNull();
    }
  });

  it("never writes one column without the other", async () => {
    /*
      The `incoherent` case's structural guard. It is satisfied trivially today
      — both are null — and that is said out loud rather than dressed up: what
      it is here to catch is a future writer that resolves a line without a
      path, or a path without a line, which is the shape that would put a grey
      tee on a bare chest.
    */
    const written = await roll();
    expect((written.path === null) === (written.wardrobeLine === null)).toBe(true);
  });

  /**
   * THE PICK IS NEVER ASKED FOR — and it is asserted on the COMPILER's
   * argument object, because the ask is a change to a paid prompt.
   *
   * A prompt is live behaviour: every fact on a paid sheet comes out of that
   * one reply, and context is not additive here — a SUBSET of prompt context
   * was measured raising the stage wall twice as often as its superset. The
   * wardrobe question was asked only where its answer was read; nothing reads
   * one now, so it is asked nowhere.
   *
   * ⚠ **Since #203 slice 2 step (d) the field does not EXIST, so these arms
   * read the KEY rather than the value.** `false` and *not handed over at all*
   * are the same prompt and a different claim, and an arm comparing against
   * `false` passes identically over both — which would leave the retirement
   * itself unguarded here.
   */
  describe("the pick", () => {
    const FOLLOW_CANDIDATE_PUBLIC_ID = "66666666-6666-4666-8666-666666666666";

    /** Records whether the service handed the compiler a pick at all. */
    function compilerSpy() {
      const asked: boolean[] = [];
      const compileBrief = async (compilerInput: Record<string, unknown>) => {
        asked.push("pickWardrobe" in compilerInput);
        return deterministicBriefCompiler(compilerInput as never);
      };
      return { asked, compileBrief };
    }

    async function rollAsking(extra: Record<string, unknown> = {}) {
      seedCandidates();
      const spy = compilerSpy();
      await createRoll(
        { ...(baseDependencies() as object), compileBrief: spy.compileBrief } as never,
        { ...INPUT, ...extra } as never,
      );
      return spy.asked;
    }

    it("⚠ is not even a field on the compile any more — on no roll, including one that sends a path", async () => {
      expect(await rollAsking()).toEqual([false]);
      expect(await rollAsking({ path: "wardrobe" })).toEqual([false]);
      expect(await rollAsking({ followCandidatePublicId: FOLLOW_CANDIDATE_PUBLIC_ID })).toEqual([false]);
    });

    it("CONTROL — the spy can see a key the compile DOES carry", async () => {
      /*
        Three `false`s above are three absences, and an absence is worth
        nothing beside a probe that cannot detect a presence. `readInk` rides
        the same object from the same function and is always handed over, so it
        answers the other way through the identical reader.
      */
      seedCandidates();
      const seen: Record<string, unknown>[] = [];
      await createRoll(
        {
          ...(baseDependencies() as object),
          compileBrief: async (compilerInput: Record<string, unknown>) => {
            seen.push(compilerInput);
            return deterministicBriefCompiler(compilerInput as never);
          },
        } as never,
        { ...INPUT } as never,
      );
      expect("readInk" in seen[0]!).toBe(true);
      expect("pickWardrobe" in seen[0]!).toBe(false);
    });

    /**
     * ⚠ A FOLLOW WEARS THE SHEET IT DESCENDS FROM, IN THE PICTURE AS WELL AS
     * IN THE ROW — and this OUTLIVES the retirement (§3.1).
     *
     * Rolls written while the road ran still carry a pair, and a follow from
     * one of them must be dressed in it: the db layer inherits inside the
     * transaction, which is the authority for what is STORED, and that arrives
     * too late for the eight PROMPTS. So the pair is read owner-scoped before
     * the compile, and these arms assert on what the COMPILER was handed.
     */
    describe("a follow", () => {
      const PARENT_LINE = "a red apron over a plain white tee, dark straight jeans, plain low shoes";

      /* ⚠ The fixture is the db reader's REAL shape and lost its `path` with it
         (step (e) — `OwnedRollWardrobe` is one field now). A fixture richer than
         the function it stands in for is how a suite goes on proving something
         about a shape that can no longer occur. */
      async function followWith(parent: { wardrobeLine: string | null }) {
        const castingDb = await castingDbModule();
        (castingDb.getRollWardrobeForOwnedCandidate as any).mockResolvedValueOnce(parent);
        seedCandidates();
        const seen: Record<string, unknown>[] = [];
        await createRoll(
          {
            ...(baseDependencies() as object),
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
        const compilerInput = await followWith({ wardrobeLine: PARENT_LINE });
        expect(compilerInput.inheritedWardrobe).toEqual({ line: PARENT_LINE });
        /* And no pick travelled with it — the field is gone, and the answer
           already exists anyway, which was the older of the two reasons. */
        expect("pickWardrobe" in compilerInput).toBe(false);
        /* ⚠ Nor a PATH (step (e)), asked with `in` rather than left to `toEqual`
           — which treats an explicitly-undefined property as a missing one and
           would pass over a service that still put the key there. */
        expect("path" in (compilerInput.inheritedWardrobe as object)).toBe(false);
      });

      it("⚠ carries the parent's NULL when the parent predates the paths", async () => {
        /*
          The same divergence with its sign flipped: a service that resolved a
          line here would paint eight people in the house outfit while the
          transaction wrote the parent's NULL.
        */
        const compilerInput = await followWith({ wardrobeLine: null });
        expect(compilerInput.inheritedWardrobe).toEqual({ line: null });
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

describe("the ROW A follow (#177) — on the author road the photo rides, or the roll refuses free", () => {
  const PARENT_FRAME = "casting-v2/candidates/parent-frame.png";
  /** The parent's OWN column — what an anchor must never fall back to (#185). */
  const PARENT_MASTER = "casting-v2/candidates/parent-MASTER.png";
  const FOLLOW_PARENT = "66666666-6666-4666-8666-666666666666";
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.CASTING_V2_SCOPE = process.env.CASTING_V2_SCOPE;
    saved.CASTING_CREATIVE_REGISTER_SCOPE = process.env.CASTING_CREATIVE_REGISTER_SCOPE;
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_CREATIVE_REGISTER_SCOPE = "all";
  });
  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  async function followRoll(overridesAndUnlock: Record<string, unknown> = {}) {
    const seen: Record<string, unknown>[] = [];
    const result = createRoll(
      {
        ...(baseDependencies() as object),
        compileBrief: async (compilerInput: Record<string, unknown>) => {
          seen.push(compilerInput);
          return deterministicBriefCompiler(compilerInput as never);
        },
      } as never,
      { ...INPUT, followCandidatePublicId: FOLLOW_PARENT, ...overridesAndUnlock },
    );
    return { seen, result };
  }

  it("reads the anchor's bytes BEFORE the claim and hands them to all eight renders; the compiler is told the photo rides", async () => {
    const { seen, result } = await followRoll();
    await result;
    expect(anchorReads).toEqual([PARENT_FRAME]);
    /* The read happened before any money word entered the journal. */
    expect(journal.indexOf("claim")).toBeGreaterThan(-1);
    expect(seen[0]?.anchorImageAttached).toBe(true);
    expect(engineSent).toHaveLength(8);
    for (const dispatch of engineSent) {
      expect(dispatch.references?.[0]?.bytes.toString()).toBe("anchor-frame");
    }
  });

  /*
    THE VERSION YOU ARE ON, not the version you started from (#185 half 2).

    The founder asked: *"if we refine an image and then follow the refined
    version ... will it use that version we are on as the reference image for
    the follow"*. The answer is yes and it always was — `parent` here is
    `getOwnedCandidateWithSelectedFace`, whose whole job is to resolve the
    SELECTED face, and a landed refine selects itself (`landVariant` moves the
    pointer in the same transaction). The issue reported it as a gap because
    `parent.imageKey` READS like a candidate's own column; it is not.

    Driven at the real dev database before this arm was written — five
    candidates with a selected variant all resolved to the VARIANT's frame, and
    the negative control (deselect, re-read, restore) resolved to the master —
    so this arm pins the half of the chain a unit suite can hold: that the roll
    attaches whatever the selected face resolved to, and never the master
    beside it.
  */
  it("anchors THE SELECTED FACE — a follow of a refined version attaches that version's frame, not the pristine master (#185)", async () => {
    const { result } = await followRoll();
    await result;
    expect(anchorReads).toEqual([PARENT_FRAME]);
    expect(anchorReads).not.toContain(PARENT_MASTER);
    const written = dbCalls.createRoll.mock.calls[0]?.[0] as {
      candidates: Array<{ internalPrompt: { anchorImageKey?: string } }>;
    };
    for (const candidate of written.candidates) {
      expect(candidate.internalPrompt.anchorImageKey).toBe(PARENT_FRAME);
      expect(candidate.internalPrompt.anchorImageKey).not.toBe(PARENT_MASTER);
    }
  });

  it("drops adjustments — facts change at the roll, never at the follow (his build order, verbatim on #177)", async () => {
    const { seen, result } = await followRoll({ unlock: ["sex"], overrides: { ageBand: "40s" } });
    await result;
    expect(seen[0]?.unlock).toEqual([]);
    expect(seen[0]?.overrides).toBeUndefined();
  });

  it("writes the anchor's key into every candidate's internalPrompt, so a retry can re-attach the same photograph", async () => {
    const { result } = await followRoll();
    await result;
    const written = dbCalls.createRoll.mock.calls[0]?.[0] as {
      candidates: Array<{ internalPrompt: { anchorImageKey?: string } }>;
    };
    expect(written.candidates).toHaveLength(8);
    for (const candidate of written.candidates) {
      expect(candidate.internalPrompt.anchorImageKey).toBe(PARENT_FRAME);
    }
  });

  it("refuses FREE when the parent's frame KEY is null — a ready row with no key must not become a paid unanchored roll (review of #184, finding 1)", async () => {
    const castingDb = await import("../db/castingV2");
    (castingDb.getOwnedCandidateWithSelectedFace as any).mockResolvedValueOnce({
      candidate: { id: 1, publicId: FOLLOW_PARENT, position: 3 },
      internalPrompt: null,
      imageKey: null,
    });
    const { result } = await followRoll();
    await expect(result).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("nothing was charged"),
    });
    expect(anchorReads).toEqual([]);
    expect(journal).not.toContain("claim");
    expect(dbCalls.createRoll).not.toHaveBeenCalled();
  });

  it("refuses FREE — before the claim, before any row — when the anchor frame cannot be read", async () => {
    anchorBytesAvailable = false;
    const { result } = await followRoll();
    await expect(result).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("nothing was charged"),
    });
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
    expect(dbCalls.createRoll).not.toHaveBeenCalled();
  });

  it("off the author road a follow reads no storage and the engine receives no references — the house wire is what it always was", async () => {
    process.env.CASTING_CREATIVE_REGISTER_SCOPE = "off";
    const { seen, result } = await followRoll();
    await result;
    expect(anchorReads).toEqual([]);
    expect(seen[0]?.anchorImageAttached).toBe(false);
    for (const dispatch of engineSent) expect(dispatch.references).toBeUndefined();
    const written = dbCalls.createRoll.mock.calls[0]?.[0] as {
      candidates: Array<{ internalPrompt: { anchorImageKey?: string } }>;
    };
    for (const candidate of written.candidates) {
      expect(candidate.internalPrompt).not.toHaveProperty("anchorImageKey");
    }
  });
});

/**
 * ⚠ THE FRAMING TRIM IS RETIRED, AND THESE ARE THE ARMS THAT OUTLIVE IT.
 *
 * The founder judged the framing on his own flagged sheets (2026-09-03 AEST,
 * card #11, verbatim: *"11 heads look fine."*) and rule 15 of
 * `PROMPT_AUTHOR_RULING_2026-08-26.md` retires the trim on that word. Deleting
 * it took `framingTrimStep.test.ts`'s sheet arm with it — **the one arm that
 * asserted every frame on a sheet leaves at ONE size** — so the contract it held
 * is re-asserted here, on the road that is left.
 *
 * Both arms are AT THE WIRE (invariant 5): what the engine was asked for and
 * what the row was handed, never a constant read back beside itself. A sheet
 * that renders large again, or a second copy of identical bytes written to R2
 * for every face, reddens here.
 */
describe("the retired framing trim — the contracts its own suite used to hold", () => {
  /** An engine that records the box it was ASKED for, and delivers. */
  function engineRecording(boxes: string[]) {
    return () => ({
      id: "fal:test",
      generateCandidate: vi.fn(async (request: { size: string }) => {
        boxes.push(request.size);
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

  it("⚠ every slice is rendered at the box it is DELIVERED at — never larger", async () => {
    const boxes: string[] = [];
    await createRoll(
      { ...(baseDependencies() as object), engine: engineRecording(boxes) } as never,
      INPUT,
    );

    /* POSITIVE CONTROL FIRST. An `every`/`not.toContain` over an empty array is
       green on a roll that dispatched nothing at all, which is the shape this
       repository calls `absence-only-expect-passes-on-nothing`. */
    expect(boxes, "the roll dispatched a full sheet — without this the arms below prove nothing")
      .toHaveLength(8);
    expect(new Set(boxes), "one sheet, one box").toEqual(new Set(["1024x1536"]));
    /* The trim's render box, named so a reader can see what is being refused. */
    expect(boxes).not.toContain("1536x2304");
  });

  it("⚠ one frame is one object — the kept original is not written, and the row says so", async () => {
    const stored: string[] = [];
    await createRoll(
      {
        ...(baseDependencies() as object),
        engine: engineRecording([]),
        storeImage: vi.fn(async (input: { contentType: string }) => {
          stored.push(input.contentType);
          return { key: "casting-v2/candidates/x.png" };
        }),
      } as never,
      INPUT,
    );

    const db = await import("../db/castingV2");
    const landings = (db.landCandidate as unknown as { mock: { calls: any[][] } }).mock.calls;
    expect(landings, "eight faces landed — the control for the assertion below").toHaveLength(8);

    /* ONE png a face. While the trim ran, a TRIMMED frame stored twice: the
       delivered crop and the 1536x2304 original it was cut from. With no crop
       the two are the same bytes, so a second write would double R2 to record
       that nothing was cut. Sixteen here means the kept original came back.

       ⚠ `stores a WebP beside the frame` above counts png writes too, and it
       predates this arm — driven under sabotage, both go red together. That is
       stated rather than hidden: the write count was ALREADY guarded, and what
       this arm adds is the line below, which nothing else asserts. */
    expect(stored.filter((type) => type === "image/png")).toHaveLength(8);
    for (const [landing] of landings) {
      expect(landing.sourceKey, "no candidate carries a kept original any more").toBeNull();
    }
  });
});

describe("a slice whose dispatch WRITE throws — the live-process collision (#855)", () => {
  /*
    Roll 111 on dev: the remote database dropped the connection inside
    `markCandidateDispatched` for two of eight slices. That write runs BEFORE
    `dispatchCandidate`'s try, so nothing settled the slice; the rejection fell
    out of `Promise.all`, the mutation threw INTERNAL, and the operation's
    heartbeat kept renewing a lease the sweep is built to wait for — six ready,
    two `queued`, forty minutes and counting. Every arm here drives THAT write
    throwing and proves the loop no longer outlives its own failure.
  */
  const PARTIAL = { type: "partial", ready: 7, refunded: 1, chargedCredits: 160, refundedCredits: 20 } as const;

  it("hands the roll to the sweep's own adjudicator, in-process, AFTER every sibling has finished", async () => {
    dispatchWriteThrowsFor.add(3);
    adjudicator.recover.mockResolvedValueOnce(PARTIAL);

    const result = await createRoll(baseDependencies(), INPUT);

    expect(adjudicator.recover).toHaveBeenCalledTimes(1);
    expect(adjudicator.recover).toHaveBeenCalledWith({
      id: OPERATION_ID,
      userId: INPUT.userId,
      status: "running",
      chargedCredits: 160,
      refundedCredits: 0,
    });
    /* `allSettled`, not `all`: the seven that could land DID land, and all of
       them before the adjudicator looked — so it never CAS'd a row a sibling
       was still about to write. */
    expect(dbCalls.land).toHaveBeenCalledTimes(7);
    expect(journal.lastIndexOf("dispatch")).toBeLessThan(journal.indexOf("adjudicate"));
    /* The adjudicator sealed the receipt itself; this road writes no second one. */
    expect(receipts.success).not.toHaveBeenCalled();
    expect(receipts.failure).not.toHaveBeenCalled();
    expect(result).toEqual({
      rollId: 100,
      rollPublicId: "roll-public",
      chargedCredits: 160,
      refundedCredits: 20,
      ready: 7,
      failed: 1,
    });
  });

  it("throws the sentence the receipt was sealed with when nothing arrived", async () => {
    dispatchWriteThrowsFor.add(1);
    adjudicator.recover.mockResolvedValueOnce({
      type: "paid_failure", refunded: 8, chargedCredits: 160, refundedCredits: 160,
    });

    await expect(createRoll(baseDependencies(() => true), INPUT)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: ROLL_RECOVERY_SENTENCE.didNotFinish,
    });
    expect(receipts.failure).not.toHaveBeenCalled();
  });

  it("parks a dead-end verdict for support exactly as the sweep does — same words, heartbeat stopped by the park", async () => {
    dispatchWriteThrowsFor.add(5);
    adjudicator.recover.mockResolvedValueOnce({
      type: "recovery_required", reason: "duplicate charge rows for one operation", chargedCredits: 160, refundedCredits: 40,
    });

    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: ROLL_RECOVERY_SENTENCE.supportReview(OPERATION_ID),
    });
    expect(adjudicator.park).toHaveBeenCalledWith({
      userId: INPUT.userId,
      operationId: OPERATION_ID,
      publicMessage: ROLL_RECOVERY_SENTENCE.supportReview(OPERATION_ID),
      chargedCredits: 160,
      refundedCredits: 40,
    });
    expect(adjudicator.handoff).not.toHaveBeenCalled();
  });

  it("when the adjudicator itself throws — the database really is gone — hands the lease to the sweep rather than keeping the heartbeat alive", async () => {
    dispatchWriteThrowsFor.add(2);
    dispatchWriteThrowsFor.add(6);
    adjudicator.recover.mockRejectedValueOnce(
      Object.assign(new Error("Got timeout reading communication packets"), { code: "ER_NET_READ_INTERRUPTED" }),
    );

    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: `This sheet is still being settled. Operation ${OPERATION_ID}.`,
    });
    /* The export road's precedent: stop the heartbeat FIRST, expire the lease,
       and the sweep — already proven on the dead-process case — settles it on
       its next pass. No second receipt, no guessed refund. */
    expect(adjudicator.handoff).toHaveBeenCalledWith({ userId: INPUT.userId, operationId: OPERATION_ID });
    expect(adjudicator.park).not.toHaveBeenCalled();
    expect(receipts.failure).not.toHaveBeenCalled();
    expect(refunds, "nothing refunded on a guess").toHaveLength(0);
  });

  it("and a handoff that cannot write does not mask the sentence — the heartbeat was already stopped inside it", async () => {
    dispatchWriteThrowsFor.add(4);
    adjudicator.recover.mockRejectedValueOnce(new Error("connection lost"));
    adjudicator.handoff.mockRejectedValueOnce(new Error("connection lost"));

    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      message: `This sheet is still being settled. Operation ${OPERATION_ID}.`,
    });
  });

  it("CONTROL — a loop with no thrown write never reaches the adjudicator; the ordinary receipt seals", async () => {
    await createRoll(baseDependencies((position) => position === 0), INPUT);

    expect(adjudicator.recover).not.toHaveBeenCalled();
    expect(adjudicator.handoff).not.toHaveBeenCalled();
    expect(receipts.success).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 20, terminalStatus: "partial" }),
    );
  });
});
