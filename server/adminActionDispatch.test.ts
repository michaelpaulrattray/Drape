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
 * ⚠ THE ROUTING TABLE WAS A SECOND HAND-TYPED LIST WHEN THIS FILE WAS WRITTEN,
 * AND THAT PARAGRAPH OUTLIVED ITS OWN REPAIR BY ONE SITTING. It said the two
 * lists were unreconciled and that the fix was "filed for its own
 * countersign". It landed the same day (fable-1628 §3): all five copies now
 * derive from `CHANGE_REQUEST_ACTION_BY_TYPE`, and the first arm below is what
 * reads it. Corrected 2026-08-25 — a stale paragraph in a test file is read as
 * the current state by whoever opens the file to change it.
 *
 * ⚠ AND WHAT HAPPENS TO A NAME THIS ROUTER DOES NOT RECOGNISE CANNOT BE ASKED
 * IN THIS FILE. Both handlers are replaced below, so any outcome that depends
 * on what they do is a property of the double. That question — and the false
 * answer this file once gave it — is `server/adminActionRefusal.test.ts`.
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
   * would make the arm agree with whatever set the module happens to hold,
   * which is the failure this whole row is about. They are the product's
   * contract, quoted, and a name changing on either side must break something.
   *
   * ⚠ Since the three production copies were unified into
   * `CHANGE_REQUEST_ACTION_BY_TYPE`, this quoted list has a second job: it is
   * now the ONLY independent statement of those six names anywhere, so the
   * `agrees with the one declaration` arm below is what keeps the unification
   * from silently changing what the product accepts.
   */
  const CHANGE_REQUEST_ACTIONS = [
    "cr_suspendUser",
    "cr_unsuspendUser",
    "cr_refundCredits",
    "cr_addCredits",
    "cr_blockIP",
    "cr_stripeRefund",
  ];

  it("the ONE declaration holds exactly these six, keyed by the change-request type", async () => {
    const { CHANGE_REQUEST_ACTION_BY_TYPE } = await import("./lib/adminActions");
    expect(CHANGE_REQUEST_ACTION_BY_TYPE).toEqual({
      suspend_user: "cr_suspendUser",
      unsuspend_user: "cr_unsuspendUser",
      refund_credits: "cr_refundCredits",
      add_credits: "cr_addCredits",
      block_ip: "cr_blockIP",
      stripe_refund: "cr_stripeRefund",
    });
    // …and the tuple the zod enum derives from is those same values, in a
    // shape `z.enum` accepts. An empty tuple would make the enum accept
    // nothing and this arm is the population control against it.
    const { CHANGE_REQUEST_ACTION_NAMES } = await import("./lib/adminActions");
    expect([...CHANGE_REQUEST_ACTION_NAMES].sort()).toEqual([...CHANGE_REQUEST_ACTIONS].sort());
  });

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

  it("an UNKNOWN action is ROUTED to the direct road — the dispatcher itself has no default", async () => {
    // This arm proves ROUTING and nothing else, and the distinction is the
    // whole content of the correction below: `directHandler` is a
    // `mockResolvedValue`, so it CANNOT throw. Any claim of the form "and it
    // does not error" read off this arm would be a property of the double.
    // What the product does with an unrecognised name is proven one describe
    // down, against the real handlers.
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

/*
 * The companion arms — what the product ACTUALLY does with an unrecognised
 * action name — are in `server/adminActionRefusal.test.ts`, and they are in a
 * SEPARATE FILE on purpose: `vi.mock` above is file-wide, and `importActual`
 * un-mocks the module you name without un-mocking what that module imports.
 * A question about the real handlers cannot be asked under these doubles.
 */
