/**
 * `executeApprovedAdminAction` — the dispatcher that runs an admin action once
 * it has been approved.
 *
 * ⚠ THIS FILE EXISTS BECAUSE 3g's D READ FOUND THE FUNCTION HAD NO TEST AT
 * ALL. Its two live call sites are `routes/admin/changeRequests.ts:362` and
 * `routes/admin/slackApproval.ts:108`; a repository-wide grep for the symbol
 * across `*.test.ts` returned nothing. What stood in its place were arms in
 * `changeRequests.test.ts` that called a mock themselves and then asserted the
 * mock had been called — a coverage claim over an untested procedure, which
 * reads as protection and protects nothing.
 *
 * The dispatcher is a ROUTER: six `cr_*` actions go to the change-request
 * handler (moderator-escalated, always carrying a change request id), and
 * everything else goes to the direct handler (admin-initiated). Getting that
 * wrong is not cosmetic — the two handlers do different things with the same
 * action, and a `cr_*` name that falls through to `executeDirectAction` would
 * suspend a user or move credits without ever settling the change request that
 * authorised it.
 *
 * ⚠ AND THE ROUTING TABLE IS A SECOND HAND-TYPED LIST. `CHANGE_REQUEST_ACTIONS`
 * in `lib/adminActions/index.ts` and `CR_TO_APPROVAL_ACTION` in
 * `routes/admin/changeRequests.ts:87` name the same six actions in two modules,
 * and nothing compares them. They agree today — read at both, 2026-08-25. The
 * day a seventh change-request type is added and only one list learns it, the
 * approved action routes to the wrong handler and nothing says so. That repair
 * is one declaration rather than two and is filed for its own countersign; the
 * arms below are what stands in the meantime.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const changeRequestHandler = vi.fn().mockResolvedValue({ message: "cr" });
const directHandler = vi.fn().mockResolvedValue({ message: "direct" });

vi.mock("./lib/adminActions/changeRequestActions", () => ({
  executeChangeRequestAction: (...args: unknown[]) => changeRequestHandler(...args),
}));
vi.mock("./lib/adminActions/directActions", () => ({
  executeDirectAction: (...args: unknown[]) => directHandler(...args),
}));

const CTX = {
  user: { id: 1, name: "Admin", email: "admin@example.com", role: "admin" },
  req: {},
  res: {},
} as never;

function pending(action: string) {
  return { action, targetId: "42", params: { changeRequestId: 7 } } as never;
}

describe("executeApprovedAdminAction — the routing, driven", () => {
  beforeEach(() => vi.clearAllMocks());

  /*
   * The six names are written out here ON PURPOSE and it is the one list in
   * this file that is hand-typed. Deriving them from the module under test
   * would make the arm agree with any set the module happens to hold, which is
   * the failure this whole row is about. They are the product's contract,
   * quoted, and a name changing on either side must break something.
   */
  const CHANGE_REQUEST_ACTIONS = [
    "cr_suspendUser",
    "cr_unsuspendUser",
    "cr_refundCredits",
    "cr_addCredits",
    "cr_blockIP",
    "cr_stripeRefund",
  ];

  it("routes every cr_* action to the change-request handler and NOT to the direct one", async () => {
    const { executeApprovedAdminAction } = await import("./lib/adminActions");
    for (const action of CHANGE_REQUEST_ACTIONS) {
      vi.clearAllMocks();
      const result = await executeApprovedAdminAction(pending(action), CTX);
      expect(changeRequestHandler, `${action} must reach the change-request handler`).toHaveBeenCalledOnce();
      expect(directHandler, `${action} must NOT reach the direct handler`).not.toHaveBeenCalled();
      expect(result.message).toBe("cr");
    }
  });

  it("routes an admin-initiated action to the direct handler", async () => {
    const { executeApprovedAdminAction } = await import("./lib/adminActions");
    for (const action of ["suspendUser", "unsuspendUser", "blockIP", "adjustCredits"]) {
      vi.clearAllMocks();
      const result = await executeApprovedAdminAction(pending(action), CTX);
      expect(directHandler, `${action} must reach the direct handler`).toHaveBeenCalledOnce();
      expect(changeRequestHandler).not.toHaveBeenCalled();
      expect(result.message).toBe("direct");
    }
  });

  it("an UNKNOWN action falls through to the direct handler rather than throwing", async () => {
    // Stated because it is a real property and a slightly uncomfortable one:
    // the dispatcher has no default refusal, so a typo in a cr_ name does not
    // error — it silently takes the other road. That is exactly what makes the
    // two-list drift worth guarding.
    const { executeApprovedAdminAction } = await import("./lib/adminActions");
    await executeApprovedAdminAction(pending("cr_suspendUserr"), CTX);
    expect(directHandler).toHaveBeenCalledOnce();
    expect(changeRequestHandler).not.toHaveBeenCalled();
  });

  it("hands the handler the SAME pendingAction and ctx it was given", async () => {
    const { executeApprovedAdminAction } = await import("./lib/adminActions");
    const action = pending("cr_refundCredits");
    await executeApprovedAdminAction(action, CTX);
    expect(changeRequestHandler).toHaveBeenCalledWith(action, CTX);
  });

  it("does not swallow a handler failure — the caller must see it", async () => {
    const { executeApprovedAdminAction } = await import("./lib/adminActions");
    changeRequestHandler.mockRejectedValueOnce(new Error("the refund did not record"));
    await expect(executeApprovedAdminAction(pending("cr_refundCredits"), CTX)).rejects.toThrow(
      "the refund did not record",
    );
  });
});
