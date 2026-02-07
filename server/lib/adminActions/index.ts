/**
 * Admin Action Dispatcher — routes approved Slack actions to the correct handler.
 *
 * Sub-modules:
 *   directActions         — admin-initiated actions (suspend, unsuspend, block, adjust credits)
 *   changeRequestActions  — moderator-escalated actions (cr_suspend, cr_refund, cr_stripeRefund, etc.)
 */

import { type PendingAction } from "../../slackApproval";
import { executeDirectAction } from "./directActions";
import { executeChangeRequestAction } from "./changeRequestActions";

export type AdminActionContext = {
  user: { id: number; name: string | null; email: string | null; role: string };
  req: any;
  res: any;
};

const CHANGE_REQUEST_ACTIONS = new Set([
  "cr_suspendUser",
  "cr_unsuspendUser",
  "cr_refundCredits",
  "cr_addCredits",
  "cr_blockIP",
  "cr_stripeRefund",
]);

export async function executeApprovedAdminAction(
  pendingAction: PendingAction,
  ctx: AdminActionContext
): Promise<{ message: string }> {
  if (CHANGE_REQUEST_ACTIONS.has(pendingAction.action)) {
    return executeChangeRequestAction(pendingAction, ctx);
  }
  return executeDirectAction(pendingAction, ctx);
}
