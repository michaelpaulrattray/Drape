import { AUDIT_ACTIONS, type AuditAction } from "./auditActions";

/**
 * THE AUDIT CATEGORY BUCKETS — one list, read by the filter AND by the chip
 * (#940).
 *
 * This map moved here from `server/auditLog.ts` unchanged. What changed is who
 * reads it: the coloured category chip on an audit row used to be a SECOND
 * list — a prefix rule (`action.startsWith("credits.")`) written out twice, in
 * `features/admin/adminConstants.ts` and `features/moderator/moderatorConstants.ts`.
 *
 * Two lists describing one thing is working law 4, and they had drifted twice
 * in a fortnight: #939 found thirteen actions drawing a chip whose own filter
 * dropped the row, and #940 found the mirror — three money rows
 * (`billing.stripe_refund_issued`, `billing.stripe_refund_failed`,
 * `billing.invoice_paid_after_plan_ended`) that the Billing filter finds and
 * the prefix rule labels with nothing at all, because it has no `billing.`
 * branch.
 *
 * ⚠ THE ONE-LINE REPAIR WAS `|| action.startsWith("billing.")`, TWICE, AND IT
 * WAS DECLINED. It buys three chips and makes the copies one branch wider,
 * which is the thing that produced both defects. The chip is derived now, so
 * the class cannot come back: an action with no bucket draws no chip, and an
 * action in a bucket draws that bucket's chip, because they are the same read.
 *
 * ⚠ ONE BEHAVIOUR NOTE, SAID OUT LOUD: the prefix rule was OPTIMISTIC — a new
 * `credits.*` action drew a Billing chip the day it was written, whether or not
 * the filter could find it. Derivation is the other way round: a new action
 * draws no chip until it is bucketed here. That is the safer direction (a blank
 * is honest; a chip whose filter drops the row is not) and it is the direction
 * the founder ruling above the abuse bucket asks for.
 */
export const AUDIT_CATEGORIES = ["billing", "model", "security", "moderator", "abuse"] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/*
  Action category mappings for filtering.

  EXPORTED for `server/auditLogCategoryAgreement.test.ts` (#939), which holds
  this list against the chip the panels draw. It is exported rather than
  re-read with a regex because a guard that parses the thing it guards shares
  the guarded file's blind spots — four Atlas collectors were found doing
  exactly that, and the rule from it is in CLAUDE.md: do not shape-match where
  a declaration exists.
*/
export const ACTION_CATEGORIES: Record<AuditCategory, AuditAction[]> = {
  billing: [
    AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
    AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
    AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
    AUDIT_ACTIONS.CREDITS_PURCHASED,
    AUDIT_ACTIONS.CREDITS_DEDUCTED,
    AUDIT_ACTIONS.CREDITS_REFUNDED,
    /*
      THE TWO MONEY ANOMALIES (#771). Same lesson as the login alarm below:
      without these lines the billing filter would drop the rows the moment a
      refund fails or an invoice is paid after its plan ended, and the only
      surface production has for them is this panel.
    */
    AUDIT_ACTIONS.STRIPE_REFUND_ISSUED,
    AUDIT_ACTIONS.STRIPE_REFUND_FAILED,
    AUDIT_ACTIONS.INVOICE_PAID_AFTER_PLAN_ENDED,
    /*
      #939. The panel already draws a "Billing" chip on this row — its
      `getActionCategory` sends every `credits.*` to billing — so the row
      claimed a category whose filter dropped it. The three siblings above it
      are already here; this is the missing line, not a new reading.
    */
    AUDIT_ACTIONS.CREDITS_ADDED,
  ],
  model: [
    AUDIT_ACTIONS.MODEL_CREATED,
    AUDIT_ACTIONS.MODEL_DELETED,
    AUDIT_ACTIONS.MODEL_MINTED,
  ],
  security: [
    AUDIT_ACTIONS.LOGIN_SUCCESS,
    AUDIT_ACTIONS.LOGIN_FAILED,
    AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
    AUDIT_ACTIONS.INSUFFICIENT_CREDITS,
    /*
      #939 — ELEVEN MORE OF THE SAME DEFECT THE ABUSE COMMENT BELOW DESCRIBES.
      The four lines above establish this bucket's reading: `auth.*` AND
      `security.*` are both security here, which is also exactly what the
      panel's own `getActionCategory` has always told staff. Every action
      below was drawing a red "Security" chip while the Security filter — and
      the Security CSV export (`routes/moderatorExports.ts`) — dropped it.
      Eight of the thirteen in #939 have a live writer, and all eight are in
      this bucket.

      `security.emergency_action` writes nothing today (the Slack buttons were
      retired in #800) and is here for the reason its schema comment gives:
      the historical rows are still in the table and still carry the label.
    */
    AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED,
    AUDIT_ACTIONS.LOGIN_BLOCKED_LOCKED,
    AUDIT_ACTIONS.ACCOUNT_LOCKOUT,
    AUDIT_ACTIONS.IP_BLOCKED_REQUEST,
    AUDIT_ACTIONS.EMERGENCY_ACTION_EXECUTED,
    AUDIT_ACTIONS.SECURITY_UNAUTHORIZED_ADMIN,
    AUDIT_ACTIONS.SECURITY_IMMUTABLE_LOG,
    AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT,
    AUDIT_ACTIONS.EMAIL_VERIFICATION_RESENT,
    AUDIT_ACTIONS.EMAIL_VERIFIED,
    AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
  ],
  /*
    HIS RULING, Crew reply #187, 2026-09-14, verbatim and entire: *"Give
    moderator actions their own category"* (#938).

    The three `moderator.*` actions had no bucket at all, so choosing ANY
    category — Abuse included — dropped them on both panels, while the
    moderator console's own chip rule labelled them `abuse`. One panel told a
    moderator the row was abuse and the Abuse filter was the one thing that
    would never show it.

    ⚠ THE OTHER REPAIR WAS TO DELETE THAT BRANCH, AND IT WAS NOT TAKEN. It
    would have made the two copies agree and left the rows unfilterable, which
    is the shape the ABUSE_GLOBAL_ATTACK comment below exists to refuse. A
    change request is not abuse, and #939 deliberately stopped here rather than
    inventing a category: a new one is a staff-visible control, so it was his.

    ⚠ A NEW BUCKET IS UNREACHABLE UNTIL THE ROUTE ENUMS OFFER IT — three files,
    and `server/auditLogCategoryAgreement.test.ts` has an arm pointed at
    exactly that landmine.
  */
  moderator: [
    AUDIT_ACTIONS.MODERATOR_ESCALATION,
    AUDIT_ACTIONS.CHANGE_REQUEST_CREATED,
    AUDIT_ACTIONS.CHANGE_REQUEST_CANCELLED,
  ],
  abuse: [
    AUDIT_ACTIONS.ABUSE_DETECTED,
    AUDIT_ACTIONS.ABUSE_PATTERN_CREDITS,
    AUDIT_ACTIONS.ABUSE_PATTERN_DELETION,
    AUDIT_ACTIONS.ABUSE_PATTERN_BILLING,
    /*
      THE SITE-WIDE LOGIN ALARM (founder ruling 2026-08-19, relayed fable-1018).
      Without this line the panel's own abuse filter would drop every row the
      alarm writes — the wire would exist, the row would exist, and staff would
      never see it. `getAbuseAlertsSummary` filters on this same list.
    */
    AUDIT_ACTIONS.ABUSE_GLOBAL_ATTACK,
    /*
      #939. The comment above was written about one action and was true of six.
      This is the sixth: the panel sends every `abuse.*` to the abuse chip, so
      the day something writes a credential-stuffing row it would have been
      dropped by the Abuse filter exactly as described.
    */
    AUDIT_ACTIONS.ABUSE_CREDENTIAL_STUFFING,
  ],
};

/**
 * Reverse index, built once. A flat lookup rather than a scan per row, because
 * the admin table draws this for every row on the page.
 */
const CATEGORY_OF_ACTION: ReadonlyMap<string, AuditCategory> = new Map(
  (Object.entries(ACTION_CATEGORIES) as [AuditCategory, AuditAction[]][]).flatMap(
    ([category, actions]) => actions.map((action) => [action as string, category] as const),
  ),
);

/**
 * The category an audit row belongs to, or `null` when it belongs to none.
 *
 * THE CHIP AND THE FILTER ARE THIS ONE READ. Both panels call it, and
 * `getFilteredAuditLogs` filters on the same map, so a chip can no longer
 * promise a category whose filter drops the row.
 */
export function getActionCategory(action: string): AuditCategory | null {
  return CATEGORY_OF_ACTION.get(action) ?? null;
}
