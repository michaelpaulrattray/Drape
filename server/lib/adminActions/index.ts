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
 * This function has no `default:` of its own — membership decides the road,
 * and an unrecognised name takes the direct one.
 *
 * ⚠ AND THIS DOCBLOCK SAID THAT MEANT THERE WAS "NO DEFAULT REFUSAL", THAT AN
 * UNRECOGNISED NAME "DOES NOT ERROR", AND THAT IT "RUNS AS AN ADMIN-INITIATED
 * ACTION, SETTLING NO CHANGE REQUEST". **All three are false of the product**,
 * corrected 2026-08-25 by driving it. Both handlers end in a `default:` that
 * throws — `Unknown direct action type: …` and `Unknown change request action
 * type: …` — so an unrecognised name is refused on whichever road it lands on
 * and nothing executes. There is no unrefused path.
 *
 * The claim came from an arm in `server/adminActionDispatch.test.ts` that
 * replaces BOTH handlers with `vi.fn().mockResolvedValue(...)`. A double that
 * cannot throw makes "and it does not throw" true before the subject is
 * reached, so the conclusion was a property of the mock. It was then filed
 * from there into this docblock and onto the roadmap as an open product
 * question about admin money actions — which is the cost worth remembering: a
 * property read off a double became a question on a planning page.
 *
 * What actually survives is smaller and is diagnostic rather than monetary.
 * Because the road is chosen by MEMBERSHIP and not by the `cr_` prefix, a
 * typo'd `cr_` name is refused BY THE DIRECT ROAD, so the operator reading the
 * failure is told about a "direct action type". Whether the dispatcher should
 * recognise the prefix and refuse in its own words is a small product call, not
 * a defect to patch quietly. `server/adminActionRefusal.test.ts` drives the
 * real handlers and pins all of it — including that misleading message — so the
 * answer, whichever it is, is given on purpose.
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
