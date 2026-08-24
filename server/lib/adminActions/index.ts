/**
 * Admin Action Dispatcher — routes approved Slack actions to the correct handler.
 *
 * Sub-modules:
 *   directActions         — admin-initiated actions (suspend, unsuspend, block, adjust credits)
 *   changeRequestActions  — moderator-escalated actions (cr_suspend, cr_refund, cr_stripeRefund, etc.)
 */

import { type PendingAction } from "../../slack/slackApproval";
import { executeDirectAction } from "./directActions";
import { executeChangeRequestAction } from "./changeRequestActions";

export type AdminActionContext = {
  user: { id: number; name: string | null; email: string | null; role: string };
  req: any;
  res: any;
};

/**
 * The approval action each change-request type becomes — THE one declaration.
 *
 * ⚠ THIS WAS THREE HAND-TYPED LISTS OF THE SAME SIX NAMES until 2026-08-25
 * (3g's D): a `Set` here, `CR_TO_APPROVAL_ACTION` inline in the body of
 * `routes/admin/changeRequests.ts`'s review procedure, and a `z.enum` in
 * `routes/admin/slackApproval.ts`. Nothing compared them. They agreed —
 * measured at all three, six each, identical — and the day a seventh
 * change-request type is added and only one list learns it, the approved
 * action routes to the WRONG HANDLER in silence. All three now derive from
 * here. Working law 4: derive, never mirror.
 */
export const CHANGE_REQUEST_ACTION_BY_TYPE = {
  suspend_user: "cr_suspendUser",
  unsuspend_user: "cr_unsuspendUser",
  refund_credits: "cr_refundCredits",
  add_credits: "cr_addCredits",
  block_ip: "cr_blockIP",
  stripe_refund: "cr_stripeRefund",
} as const;

export type ChangeRequestAction =
  (typeof CHANGE_REQUEST_ACTION_BY_TYPE)[keyof typeof CHANGE_REQUEST_ACTION_BY_TYPE];

/** The same six, as the non-empty tuple `z.enum` needs — literal union preserved. */
export const CHANGE_REQUEST_ACTION_NAMES = Object.values(
  CHANGE_REQUEST_ACTION_BY_TYPE,
) as unknown as [ChangeRequestAction, ...ChangeRequestAction[]];

const CHANGE_REQUEST_ACTIONS: ReadonlySet<string> = new Set(CHANGE_REQUEST_ACTION_NAMES);

/**
 * ⚠ AN OPEN PRODUCT QUESTION, filed here so it is asked once and deliberately
 * rather than discovered after a seventh action type ships (fable-1628):
 * there is NO DEFAULT REFUSAL. An action name that is not in the set above —
 * including a typo'd `cr_` name — does not error; it takes the OTHER road and
 * runs as an admin-initiated action, settling no change request. Whether the
 * dispatcher should instead refuse an unrecognised `cr_*` is a small product
 * call, not a defect to patch quietly. `server/adminActionDispatch.test.ts`
 * asserts the CURRENT behaviour so the answer, whichever it is, has to be
 * given on purpose.
 */
export async function executeApprovedAdminAction(
  pendingAction: PendingAction,
  ctx: AdminActionContext
): Promise<{ message: string }> {
  if (CHANGE_REQUEST_ACTIONS.has(pendingAction.action)) {
    return executeChangeRequestAction(pendingAction, ctx);
  }
  return executeDirectAction(pendingAction, ctx);
}
