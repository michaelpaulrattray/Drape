/**
 * Slack Dispatcher - Barrel re-export
 * 
 * All implementation has been split into focused modules:
 *   - slackCore.ts              → Channel config, dedup, dispatch, routing, signature, raw send
 *   - slackConvenienceHelpers.ts → Security alerts, emergency actions, audit, admin, billing helpers
 * 
 * This barrel preserves backward compatibility for slackNotification.ts
 * and slackApproval.ts which import from "./slackDispatcher".
 */

// Core dispatch & infrastructure
export {
  dispatch,
  sendRawToChannel,
  verifySlackSignature,
  _clearDedupCache,
  getDedupCacheSize,
} from "./slackCore";

export type { SlackChannel, SlackEvent } from "./slackCore";

// Convenience helpers
export {
  dispatchSecurityAlert,
  dispatchEmergencyActions,
  dispatchAuditLog,
  dispatchAdminAction,
  dispatchAdminActionWithAudit,
  dispatchBillingAlert,
  dispatchBillingAlertWithAudit,
} from "./slackConvenienceHelpers";
