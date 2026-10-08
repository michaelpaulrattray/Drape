import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getUserById: vi.fn(),
  getUserCredits: vi.fn(),
}));
/*
  THE MODULE'S OWN CONSTANTS SURVIVE THE MOCK (#1954), and that is deliberate.
  `ACCOUNT_DELETION_RENDER_IN_FLIGHT` is the refusal sentence the arms below
  assert reaches the customer; a copy of it in this fixture would keep every arm
  green while the production string was edited or emptied. Only the function is
  replaced.
*/
vi.mock("../db/accountDeletion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/accountDeletion")>()),
  deleteUserAccount: vi.fn(),
}));
/*
  PARTIAL FOR THE SAME REASON, PLUS A MEASURED ONE: a whole-module fixture here
  fails to LOAD, because `db/storageCleanup.ts` reads
  `DEFAULT_GENERATION_OPERATION_LEASE_MS` out of this module and
  `accountDeletion` imports it. A suite that cannot load reports
  "Tests: no tests" rather than a failure, so only the Test Files line says so.
*/
vi.mock("../db/generationOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/generationOperations")>()),
  findRenderInFlightForUser: vi.fn(),
}));
vi.mock("../stripe/stripeService", () => ({
  stripe: { subscriptions: { cancel: vi.fn() } },
}));
vi.mock("../auditLog", () => ({ logAuditEvent: vi.fn() }));

import { getUserById, getUserCredits } from "../db";
import {
  ACCOUNT_DELETION_RENDER_IN_FLIGHT,
  deleteUserAccount,
} from "../db/accountDeletion";
import { findRenderInFlightForUser } from "../db/generationOperations";
import { stripe } from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";
import { deleteUserData } from "./deleteUserData";

const getUser = vi.mocked(getUserById);
const getCredits = vi.mocked(getUserCredits);
const deleteAccount = vi.mocked(deleteUserAccount);
const findInFlight = vi.mocked(findRenderInFlightForUser);
const cancel = vi.mocked(stripe.subscriptions.cancel);

describe("deleteUserData account-erasure coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ id: 7, role: "user" } as never);
    getCredits.mockResolvedValue({ stripeSubscriptionId: null } as never);
    deleteAccount.mockResolvedValue({
      success: true,
      cleanupBatchId: "11111111-1111-4111-8111-111111111111",
      cleanupObjects: 4,
      deletedCounts: {
        changeRequestAttachments: 0,
        changeRequests: 0,
        referrals: 0,
        boardEdges: 0,
        boardItemVersions: 0,
        boardItems: 0,
        boards: 0,
        wardrobeLooks: 0,
        wardrobeSessions: 0,
        wardrobeOutfits: 0,
        wardrobeGarments: 0,
        modelAssets: 6,
        models: 2,
        generations: 9,
        creditTransactions: 1,
        credits: 1,
        auditLogsAnonymized: 3,
        user: 1,
      },
    });
    findInFlight.mockResolvedValue(null);
    vi.mocked(logAuditEvent).mockResolvedValue(undefined);
  });

  it("refuses an unknown or admin account before external or database mutation", async () => {
    getUser.mockResolvedValueOnce(undefined);
    await expect(deleteUserData(7)).resolves.toEqual({ success: false, error: "User not found" });
    getUser.mockResolvedValueOnce({ id: 7, role: "admin" } as never);
    await expect(deleteUserData(7)).resolves.toMatchObject({ success: false });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("stops before erasure when an active subscription cannot be cancelled", async () => {
    getCredits.mockResolvedValue({ stripeSubscriptionId: "sub_live" } as never);
    cancel.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(deleteUserData(7)).resolves.toMatchObject({ success: false });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("treats an already-missing Stripe subscription as cancelled", async () => {
    getCredits.mockResolvedValue({ stripeSubscriptionId: "sub_missing" } as never);
    cancel.mockRejectedValue({ code: "resource_missing" });
    await expect(deleteUserData(7)).resolves.toMatchObject({ success: true });
    expect(deleteAccount).toHaveBeenCalledWith(7);
  });

  it("returns queued-storage truth without calling storage directly", async () => {
    const result = await deleteUserData(7, "1.2.3.4", "TestBrowser");
    expect(result).toEqual({
      success: true,
      summary: {
        stripeSubscriptionCancelled: true,
        storageFilesQueued: 4,
        cleanupBatchId: "11111111-1111-4111-8111-111111111111",
        modelsDeleted: 2,
        generationsDeleted: 9,
        creditsZeroed: true,
        userAnonymized: true,
      },
    });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
      ipAddress: "1.2.3.4",
      userAgent: "TestBrowser",
    }));
  });

  it("reports atomic database erasure failure without claiming queued cleanup", async () => {
    deleteAccount.mockResolvedValueOnce({
      success: false,
      cleanupBatchId: null,
      cleanupObjects: 0,
      deletedCounts: {
        changeRequestAttachments: 0,
        changeRequests: 0,
        referrals: 0,
        boardEdges: 0,
        boardItemVersions: 0,
        boardItems: 0,
        boards: 0,
        wardrobeLooks: 0,
        wardrobeSessions: 0,
        wardrobeOutfits: 0,
        wardrobeGarments: 0,
        modelAssets: 0,
        models: 0,
        generations: 0,
        creditTransactions: 0,
        credits: 0,
        auditLogsAnonymized: 0,
        user: 0,
      },
      error: "rollback",
    });
    await expect(deleteUserData(7)).resolves.toMatchObject({ success: false });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ severity: "critical" }));
  });

  /*
    A RENDER STILL BEING EXECUTED REFUSES THE WHOLE THING — #1954.

    Two roads reach the same refusal and they stop two different harms, so each
    is driven on its own.

    The PRE-FLIGHT road stops an irreversible money act: `cancelStripe
    SubscriptionImmediate` is the statement after it, and a customer refused
    AFTER it would be left with their account intact and their plan gone. The
    TRANSACTION road is the actual control — it is the locking read, and it
    catches a claim that committed in the microsecond after the pre-flight one.
  */
  const RENDERING = { operationId: "op-1", kind: "castingV2.roll", status: "running" } as const;

  it("⚠ refuses BEFORE the subscription is cancelled, so no money moves", async () => {
    getCredits.mockResolvedValue({ stripeSubscriptionId: "sub_live" } as never);
    findInFlight.mockResolvedValue(RENDERING);

    await expect(deleteUserData(7)).rejects.toMatchObject({
      code: "CONFLICT",
      message: ACCOUNT_DELETION_RENDER_IN_FLIGHT,
    });

    expect(cancel, "a paying customer's subscription was cancelled and then the"
      + " erasure was refused — plan gone, account still there").not.toHaveBeenCalled();
    expect(deleteAccount, "the erasure ran anyway").not.toHaveBeenCalled();
  });

  it("refuses when the claim lands after the pre-flight read — the locking read's road", async () => {
    /* Nothing in flight when asked the first time; the transaction's own
       locking read is what sees it. */
    findInFlight.mockResolvedValue(null);
    deleteAccount.mockResolvedValueOnce({
      success: false,
      cleanupBatchId: null,
      cleanupObjects: 0,
      deletedCounts: {} as never,
      refusal: "render_in_flight",
      refusedOnOperationId: "op-2",
      error: ACCOUNT_DELETION_RENDER_IN_FLIGHT,
    });

    await expect(deleteUserData(7)).rejects.toMatchObject({
      code: "CONFLICT",
      message: ACCOUNT_DELETION_RENDER_IN_FLIGHT,
    });
    expect(deleteAccount, "the pre-flight read refused instead, so this road"
      + " was never driven").toHaveBeenCalledWith(7);
    /*
      ⚠ THE ARM THAT MATTERS MOST ON THIS ROAD. The refusal is read BEFORE
      `!result.success`, so it must not take the failure branch — which writes
      a `critical` ACCOUNT_DELETED row saying the erasure failed. Nothing
      failed, and an audit trail saying otherwise is what support would read.
    */
    expect(
      logAuditEvent,
      "a refused erasure was written to the audit log as a failure",
    ).not.toHaveBeenCalled();
  });

  it("the refusal is a thrown tRPC sentence, not a `success: false` the routes flatten", async () => {
    findInFlight.mockResolvedValue(RENDERING);
    /*
      Both routes replace a returned failure with their own copy — `routes/
      account.ts` with "contact support", `routes/auth.ts` under
      INTERNAL_SERVER_ERROR, which the client swaps out. A throw carrying
      CONFLICT is the only shape that reaches her unaltered through either
      door, and `spoken` marks it as written-for-a-person besides.
    */
    const thrown = await deleteUserData(7).then(() => null, (error: unknown) => error);
    expect(thrown, "the refusal was returned rather than thrown").not.toBeNull();
    expect((thrown as { code?: string }).code).toBe("CONFLICT");
    expect((thrown as { name?: string }).name).toBe("TRPCError");
  });
});
