/**
 * Admin actions — the change-request executors and their routing table.
 *
 * Until #800 (2026-09-11, the Slack retirement) this module was a DISPATCHER
 * over two roads: `directActions` (admin-initiated suspend/credits/IP actions
 * approved through the Slack approval flow) and `changeRequestActions`
 * (moderator-escalated). The Slack road never ran in production — no webhook
 * was ever configured, so its "approval" self-approved — and the direct road's
 * only entrances were the deleted `admin.slackApproval.*` router (zero client
 * callers) and the deleted Slack message buttons. The admin panel's own
 * procedures in `routes/admin/users.ts` are, and always were, how an admin
 * acts directly. What remains is the change-request road: an admin's Approve
 * in the panel IS the approval, and the executor runs in that same mutation.
 */

import { executeChangeRequestAction } from "./changeRequestActions";

export { executeChangeRequestAction };

export type AdminActionContext = {
  user: { id: number; name: string | null; email: string | null; role: string };
  req: any;
  res: any;
};

/**
 * An approved change-request action, carried from the review procedure to the
 * executor. `resolvedBy` names the admin whose panel Approve authorised it.
 */
export type ApprovedChangeRequestAction = {
  action: string;
  targetId: string;
  params: Record<string, unknown>;
  resolvedBy: string;
};

/**
 * The routing table lives in `shared/changeRequestLabels.ts` since #800 —
 * the admin panel derives its "executes on approve" warning from the same
 * declaration the server routes with. Re-exported here so server call sites
 * keep their import path. Working law 4: derive, never mirror.
 */
export {
  CHANGE_REQUEST_ACTION_BY_TYPE,
  type ChangeRequestAction,
} from "@shared/changeRequestLabels";
