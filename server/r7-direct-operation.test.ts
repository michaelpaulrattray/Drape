import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const db = vi.hoisted(() => ({
  claimGenerationOperation: vi.fn(),
  acquireGenerationOperationLock: vi.fn(),
  /* #1932 — the candidate lock was absent from this fake, so its branch could
     not be driven here at all and nothing in this file had ever entered it. */
  acquireCastingCandidateOperationLock: vi.fn(),
  finalizeClaimedGenerationOperationSuccess: vi.fn(),
  finalizeClaimedGenerationOperationFailure: vi.fn(),
  finalizeGenerationOperationFailure: vi.fn(),
  finalizeGenerationOperationSuccess: vi.fn(),
  getGenerationOperationOutcome: vi.fn(),
  markClaimedGenerationOperationRecoveryRequired: vi.fn(),
  markGenerationOperationRecoveryRequired: vi.fn(),
}));
vi.mock("./db", () => db);

import { SpokenError, withSpokenFlag } from "./_core/spokenError";
import { readableFailure } from "../client/src/lib/failureSentence";
import {
  beginDirectOperation,
  completeClaimedDirectOperationSuccess,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "./casting/directOperation";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const mock of Object.values(db)) mock.mockReset();
  db.acquireGenerationOperationLock.mockResolvedValue({
    type: "acquired",
    operationId: OPERATION_ID,
    lockKey: "model:7",
    expiresAt: new Date(),
  });
  db.acquireCastingCandidateOperationLock.mockResolvedValue({
    type: "acquired",
    operationId: OPERATION_ID,
    expiresAt: new Date(),
  });
});

describe("R7-1D direct operation adapter", () => {
  it("returns replay before trying to acquire a new resource lock", async () => {
    db.claimGenerationOperation.mockResolvedValue({
      type: "replay_success",
      operationId: OPERATION_ID,
      result: { assetId: 9 },
    });
    await expect(beginDirectOperation({
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "casting.headshot",
      modelId: 7,
      payload: { modelId: 7 },
      lockKey: "model:7",
    })).resolves.toEqual({ type: "replay", operationId: OPERATION_ID, result: { assetId: 9 } });
    expect(db.acquireGenerationOperationLock).not.toHaveBeenCalled();
  });

  it("a busy lock says the caller's sentence when it has one, and the staff one otherwise", async () => {
    /*
      #1257. Five roads take a `model:`/`board-item:` lock and share the staff
      sentence below — right for them, because a customer meeting it asked for
      something about the whole Cast. The per-slot road is different: it already
      refuses the common case in its own words, from the slot's state, a few
      hundred milliseconds earlier, so the race loser must hear the same thing.

      BOTH directions are asserted. Testing only the override would pass just as
      well if the default had been deleted, and four live roads depend on it.
    */
    db.claimGenerationOperation.mockResolvedValue({
      type: "claimed",
      operationId: OPERATION_ID,
      payloadHash: "hash",
    });
    db.acquireGenerationOperationLock.mockResolvedValue({
      type: "resource_busy",
      operationId: OPERATION_ID,
      lockKey: "cast-view:7:closeUp",
      ownerOperationId: "22222222-2222-4222-8222-222222222222",
    });

    const claim = {
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "castingV2.viewRetry" as const,
      modelId: 7,
      payload: { castId: "KI-A", angle: "closeUp" },
      lockKey: "cast-view:7:closeUp",
    };

    await expect(beginDirectOperation({ ...claim, lockBusyMessage: "That view is already being asked for. Nothing was charged." }))
      .rejects.toThrow("That view is already being asked for. Nothing was charged.");
    await expect(beginDirectOperation(claim))
      .rejects.toThrow("Another operation is already changing this Cast. Wait for it to finish before retrying.");

    /* A refusal, not a silent pass: the caller never reaches its money. */
    await expect(beginDirectOperation(claim)).rejects.toBeInstanceOf(TRPCError);
  });

  /*
    A REFUSED LOCK FAILS ITS OWN ROW BEFORE IT THROWS (#1932, found by the
    relay's review of PR #1924).

    ⚠ **The arm directly above this one could never have failed for this
    defect, and it is the arm that looks like it covers this road.** It asserts
    what the caller is TOLD — the override sentence, the staff sentence, that it
    is a `TRPCError` — and the defect was entirely in what was LEFT BEHIND: the
    claim created an operation row, the lock below it was refused, and the row
    stayed `claimed` with nobody holding it. `renderViewAttempts` reads a
    non-terminal row owned by no live process as `fenced`, which both its
    callers take to mean *another process owns this money, do not refund it*, so
    the slot read "being made" until the recovery sweep settled it for free on a
    later pass — up to about six minutes after a press that charged nothing.

    So these arms assert the WRITE, not the throw. Both of them failed before
    the repair and the negative controls below passed before it, which is the
    only shape that distinguishes a fix from a rewording.
  */
  it("fails its own claimed row before throwing when the resource lock is refused", async () => {
    db.claimGenerationOperation.mockResolvedValue({
      type: "claimed",
      operationId: OPERATION_ID,
      payloadHash: "hash",
    });
    db.acquireGenerationOperationLock.mockResolvedValue({
      type: "resource_busy",
      operationId: OPERATION_ID,
      lockKey: "model:7",
      ownerOperationId: "22222222-2222-4222-8222-222222222222",
    });
    db.finalizeClaimedGenerationOperationFailure.mockResolvedValue(undefined);

    await expect(beginDirectOperation({
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "casting.headshot",
      modelId: 7,
      payload: { modelId: 7 },
      lockKey: "model:7",
    })).rejects.toMatchObject({ code: "CONFLICT" });

    /* The row the claim just minted is terminal, and the receipt carries the
       sentence the caller was given rather than a staff paraphrase of it. */
    expect(db.finalizeClaimedGenerationOperationFailure).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      operationId: OPERATION_ID,
      errorCode: "CONFLICT",
      publicMessage: "Another operation is already changing this Cast. Wait for it to finish before retrying.",
    }));
  });

  it("fails its own claimed row when the CANDIDATE lock is refused, and keeps her sentence", async () => {
    db.claimGenerationOperation.mockResolvedValue({
      type: "claimed",
      operationId: OPERATION_ID,
      payloadHash: "hash",
    });
    db.acquireCastingCandidateOperationLock.mockResolvedValue({
      type: "resource_busy",
      operationId: OPERATION_ID,
      ownerOperationId: "22222222-2222-4222-8222-222222222222",
    });
    db.finalizeClaimedGenerationOperationFailure.mockResolvedValue(undefined);

    const refusal = await beginDirectOperation({
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "castingV2.retry",
      payload: { candidatePublicId: "cand-1", attempt: 2 },
      candidateLockPublicId: "cand-1",
    }).then(() => null, (error: unknown) => error);

    expect(db.finalizeClaimedGenerationOperationFailure).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      operationId: OPERATION_ID,
      errorCode: "CONFLICT",
    }));
    /* ⚠ Her sentence, not the staff one (fable-973 §2). The repair routes this
       refusal through `failClaimedDirectOperation`, which re-throws the very
       instance it was handed — so the arm asserts the MARKER survives, because a
       `new TRPCError(...)` in that call would read identically here on message
       alone and would silently drop the `spoken` flag the surface reads. */
    expect(refusal).toBeInstanceOf(SpokenError);
    expect((refusal as SpokenError).message).toContain("That edit is already being made");
  });

  it("leaves SOMEBODY ELSE'S row alone — the negative control the repair hangs on", async () => {
    /*
      Both refusals surface to a caller as the same `CONFLICT`, and only one of
      them is ours to fail. `resource_busy` and `in_progress` from the CLAIM
      itself are a row an earlier press created and a live process may still be
      holding; failing one of those would settle somebody else's money from the
      wrong process. This is why the repair is inside `beginDirectOperation`,
      which knows which refusal it is, rather than in a caller's unwind, which
      cannot tell them apart without matching an error-message string.
    */
    for (const claim of [
      { type: "resource_busy" as const, operationId: OPERATION_ID },
      { type: "in_progress" as const, operationId: OPERATION_ID },
    ]) {
      db.finalizeClaimedGenerationOperationFailure.mockReset();
      db.claimGenerationOperation.mockResolvedValue(claim);

      await expect(beginDirectOperation({
        userId: 1,
        clientRequestId: OPERATION_ID,
        kind: "casting.headshot",
        modelId: 7,
        payload: { modelId: 7 },
        lockKey: "model:7",
      })).rejects.toMatchObject({ code: "CONFLICT" });

      expect(db.finalizeClaimedGenerationOperationFailure, `a ${claim.type} claim is not ours to fail`)
        .not.toHaveBeenCalled();
      /* It never reached the lock either, so there is no row of ours to leave. */
      expect(db.acquireGenerationOperationLock).not.toHaveBeenCalled();
    }
  });

  it("a refused lock whose own receipt write fails is sealed for recovery, not left claimed", async () => {
    /*
      The repair's worst case, driven rather than reasoned about: the receipt
      write can itself fail, and `failClaimedDirectOperation` falls back to
      `recovery_required` so the row is still not left `claimed` and silent.
      That fallback existed; what is new is that this road reaches it.
    */
    db.claimGenerationOperation.mockResolvedValue({
      type: "claimed",
      operationId: OPERATION_ID,
      payloadHash: "hash",
    });
    db.acquireGenerationOperationLock.mockResolvedValue({
      type: "resource_busy",
      operationId: OPERATION_ID,
      lockKey: "model:7",
      ownerOperationId: "22222222-2222-4222-8222-222222222222",
    });
    db.finalizeClaimedGenerationOperationFailure.mockRejectedValue(new Error("response lost"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "in_progress",
      operationId: OPERATION_ID,
      status: "claimed",
    });
    db.markClaimedGenerationOperationRecoveryRequired.mockResolvedValue(undefined);

    await expect(beginDirectOperation({
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "casting.headshot",
      modelId: 7,
      payload: { modelId: 7 },
      lockKey: "model:7",
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining(OPERATION_ID),
    });
    expect(db.markClaimedGenerationOperationRecoveryRequired).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      operationId: OPERATION_ID,
    }));
  });

  it("seals a claimed receipt for recovery when its free-failure finalization is uncertain", async () => {
    db.finalizeClaimedGenerationOperationFailure.mockRejectedValue(new Error("response lost"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "in_progress",
      operationId: OPERATION_ID,
      status: "claimed",
    });
    db.markClaimedGenerationOperationRecoveryRequired.mockResolvedValue(undefined);

    await expect(failClaimedDirectOperation({
      userId: 1,
      operationId: OPERATION_ID,
      error: new TRPCError({ code: "PRECONDITION_FAILED", message: "Free refusal" }),
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining(OPERATION_ID),
    });
    expect(db.markClaimedGenerationOperationRecoveryRequired).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      operationId: OPERATION_ID,
    }));
  });

  it("accepts a free claimed result that committed when its response was lost", async () => {
    const result = { clarification: { kind: "hair_length" } };
    db.finalizeClaimedGenerationOperationSuccess.mockRejectedValue(new Error("connection reset"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "replay_success",
      operationId: OPERATION_ID,
      result,
    });

    await expect(completeClaimedDirectOperationSuccess({
      userId: 1,
      operationId: OPERATION_ID,
      result,
    })).resolves.toBeUndefined();
    expect(db.markClaimedGenerationOperationRecoveryRequired).not.toHaveBeenCalled();
  });

  it("accepts a success receipt that committed even when its response was lost", async () => {
    db.finalizeGenerationOperationSuccess.mockRejectedValue(new Error("connection reset"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "replay_success",
      operationId: OPERATION_ID,
      result: { assetId: 9 },
    });

    await expect(completeDirectOperationSuccess({
      userId: 1,
      operationId: OPERATION_ID,
      result: { assetId: 9 },
      chargedCredits: 350,
      refundedCredits: 0,
    })).resolves.toBeUndefined();
    expect(db.markGenerationOperationRecoveryRequired).not.toHaveBeenCalled();
  });

  /*
    THE SUPPORT-REVIEW SENTENCE REACHES HER WITH ITS OPERATION NUMBER (#2049).

    Each of the three roads that write it is driven for real, down to a receipt
    write that fails, and the error it throws is put through the formatter the
    server actually wires (`withSpokenFlag`) and then the client's own rule
    (`readableFailure`). Asserting on the message alone could not fail for this
    defect: the words were always right, it was the marker that was missing.
  */
  const FALLBACK = "We couldn't confirm that. Try again in a moment.";
  const wire = (error: unknown) => withSpokenFlag(
    { message: (error as Error).message, data: { code: "INTERNAL_SERVER_ERROR" } },
    error,
  );
  const roads: Array<{ name: string; drive: () => Promise<unknown> }> = [
    {
      name: "failClaimedDirectOperation",
      drive: () => {
        db.finalizeClaimedGenerationOperationFailure.mockRejectedValue(new Error("response lost"));
        return failClaimedDirectOperation({
          userId: 1,
          operationId: OPERATION_ID,
          error: new TRPCError({ code: "PRECONDITION_FAILED", message: "Free refusal" }),
        });
      },
    },
    {
      name: "completeClaimedDirectOperationSuccess",
      drive: () => {
        db.finalizeClaimedGenerationOperationSuccess.mockRejectedValue(new Error("response lost"));
        return completeClaimedDirectOperationSuccess({
          userId: 1,
          operationId: OPERATION_ID,
          result: { clarification: { kind: "hair_length" } },
        });
      },
    },
    {
      name: "completeDirectOperationSuccess (markRecoveryAfterReceiptFailure)",
      drive: () => {
        db.finalizeGenerationOperationSuccess.mockRejectedValue(new Error("response lost"));
        return completeDirectOperationSuccess({
          userId: 1,
          operationId: OPERATION_ID,
          result: { assetId: 9 },
          chargedCredits: 350,
          refundedCredits: 0,
        });
      },
    },
  ];

  for (const road of roads) {
    it(`${road.name}: the support-review sentence is spoken, so her screen keeps the operation number`, async () => {
      db.getGenerationOperationOutcome.mockResolvedValue({
        type: "in_progress",
        operationId: OPERATION_ID,
        status: "claimed",
      });
      db.markClaimedGenerationOperationRecoveryRequired.mockResolvedValue(undefined);
      db.markGenerationOperationRecoveryRequired.mockResolvedValue(undefined);

      const refusal = await road.drive().then(() => null, (error: unknown) => error);

      expect(refusal).toBeInstanceOf(SpokenError);
      expect(refusal).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
      const shown = readableFailure(wire(refusal), FALLBACK);
      expect(shown).toContain("needs support review");
      expect(shown, "the number she would quote to support").toContain(OPERATION_ID);
    });
  }

  it("CONTROL — an unauthored failure on the same module still meets the fallback", async () => {
    /* The marker must not be a blanket: a crash this module did not write
       (`"The operation failed."`, minted for a non-tRPC throw) keeps reaching
       her as the surface's own copy. */
    db.finalizeGenerationOperationFailure.mockResolvedValue(undefined);
    const refusal = await completeDirectOperationFailure({
      userId: 1,
      operationId: OPERATION_ID,
      error: new Error("read ECONNRESET"),
      chargedCredits: 0,
      refundedCredits: 0,
    }).then(() => null, (error: unknown) => error);

    expect(refusal).toBeInstanceOf(TRPCError);
    expect(refusal).not.toBeInstanceOf(SpokenError);
    expect(readableFailure(wire(refusal), FALLBACK)).toBe(FALLBACK);
  });
});
