import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getUserById: vi.fn(),
  getUserCredits: vi.fn(),
}));
vi.mock("../db/accountDeletion", () => ({
  deleteUserAccount: vi.fn(),
}));
vi.mock("../stripe/stripeService", () => ({
  stripe: { subscriptions: { cancel: vi.fn() } },
}));
vi.mock("../auditLog", () => ({ logAuditEvent: vi.fn() }));

import { getUserById, getUserCredits } from "../db";
import { deleteUserAccount } from "../db/accountDeletion";
import { stripe } from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";
import { deleteUserData } from "./deleteUserData";

const getUser = vi.mocked(getUserById);
const getCredits = vi.mocked(getUserCredits);
const deleteAccount = vi.mocked(deleteUserAccount);
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
});
