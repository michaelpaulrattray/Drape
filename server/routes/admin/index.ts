import { router } from "../../_core/trpc";
import { slackApprovalRouter } from "./slackApproval";
import { auditLogsRouter } from "./auditLogs";
import { usersRouter } from "./users";
import { rolesRouter } from "./roles";
import { ipBlockingRouter } from "./ipBlocking";
import { changeRequestsRouter } from "./changeRequests";
import { overviewRouter } from "./overview";

/**
 * Admin router — combines all admin sub-routers into a flat namespace.
 * 
 * The frontend accesses procedures as `trpc.admin.<procedureName>`,
 * so we merge all sub-routers into a single flat router to preserve
 * backward compatibility with existing client code.
 */
export const adminRouter = router({
  // Slack Approval Flow
  ...slackApprovalRouter._def.procedures,
  // Audit Logs
  ...auditLogsRouter._def.procedures,
  // User Management (suspend, unsuspend, list, details, credits, activity)
  ...usersRouter._def.procedures,
  // Role Management
  ...rolesRouter._def.procedures,
  // IP Blocking
  ...ipBlockingRouter._def.procedures,
  // Change Request Review
  ...changeRequestsRouter._def.procedures,
  // Dashboard Overview KPIs
  ...overviewRouter._def.procedures,
});
