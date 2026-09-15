/**
 * EVERY AUDIT ACTION THE PRODUCT WRITES — the one declaration (#940).
 *
 * This list was declared in `drizzle/schema.ts` and is unchanged, byte for
 * byte, below. It moved here because the audit panels' category CHIP is now
 * derived from the server's bucket list rather than re-implemented as a prefix
 * rule (`shared/auditActionCategories.ts`), and that derivation has to be
 * readable by the client — which must not import `drizzle/schema.ts`, since
 * doing so drags `drizzle-orm` into the browser bundle.
 *
 * ⚠ `drizzle/schema.ts` RE-EXPORTS both names, so every existing importer is
 * untouched and there is still exactly ONE declaration. Import from either
 * place on the server; the client imports from here.
 */

export const AUDIT_ACTIONS = {
  // Billing events
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_CANCELED: "subscription.canceled",
  SUBSCRIPTION_UPDATED: "subscription.updated",
  CREDITS_PURCHASED: "credits.purchased",
  CREDITS_ADDED: "credits.admin_added",
  CREDITS_DEDUCTED: "credits.admin_deducted",
  CREDITS_REFUNDED: "credits.refunded",
  STRIPE_REFUND_ISSUED: "billing.stripe_refund_issued",
  // Money that did NOT do what the record says (#771, founder ruling
  // 2026-09-10): a refund Stripe later reported failed, and an invoice paid on
  // a road built to close it. Both surface on the admin overview's alerts
  // feed and the staff audit log's billing filter — production has no Slack
  // webhook, so a log line is a surface nobody is subscribed to.
  STRIPE_REFUND_FAILED: "billing.stripe_refund_failed",
  INVOICE_PAID_AFTER_PLAN_ENDED: "billing.invoice_paid_after_plan_ended",
  // #800 — the three webhook alerts whose only output used to be a Slack
  // channel production never had. Same #771 pattern: the row is the surface.
  BILLING_PAYMENT_FINAL_FAILURE: "billing.payment_final_failure",
  BILLING_CHARGEBACK_FILED: "billing.chargeback_filed",
  BILLING_CHARGEBACK_RESOLVED: "billing.chargeback_resolved",
  
  // Model events
  MODEL_CREATED: "model.created",
  MODEL_DELETED: "model.deleted",
  MODEL_MINTED: "model.minted",

  /*
    A REFUSAL A USER EXPERIENCED, counted (fable-498 §5).

    A free refusal writes no variant row on purpose — a zero-credit row is noise
    in the ledger and a phantom for the recovery sweep — so its only record was
    a log line, and a log line is not an artifact a rate can be read from. It
    carries the REASON and the FACET and never the customer's own words: staff
    read this table, and her sentence about her own face is creative content.
  */
  CASTING_REFUSAL: "casting.refusal",
  /*
    A SCAN THAT HAD TO BE BOUGHT — and whether it had been bought before.

    The scan cache is in memory, keyed (candidate, version), and it dies with
    the process: on a night with a dozen deploys, a version she looked at twice
    is read twice. The re-scan rate is what decides whether that cache earns a
    table, and the design note said it would be "a reading rather than an
    anecdote" — but it was only ever a LOG LINE, and a log line whose window
    rotates on deploy is exactly the artifact this program keeps learning it
    does not have (the refusal counter's own lesson, one surface over).

    So a MISS writes a row: rescan or not, and what it cost. A hit writes
    nothing, because a free answer is not worth a row. It carries no reading
    about her face — only that a read happened.
  */
  CASTING_SCAN_MISS: "casting.scan_miss",
  
  // Security events
  LOGIN_SUCCESS: "auth.login",
  LOGIN_FAILED: "auth.login_failed",
  RATE_LIMIT_EXCEEDED: "security.rate_limit",
  INSUFFICIENT_CREDITS: "security.insufficient_credits",
  
  // Authentication events
  LOGIN_BLOCKED_SUSPENDED: "auth.login_blocked_suspended",
  LOGIN_BLOCKED_LOCKED: "auth.login_blocked_locked",
  ACCOUNT_LOCKOUT: "auth.account_lockout",
  
  // Account suspension events
  ACCOUNT_SUSPENDED: "admin.account_suspended",
  ACCOUNT_UNSUSPENDED: "admin.account_unsuspended",
  
  // Abuse detection
  ABUSE_DETECTED: "abuse.detected",
  ABUSE_PATTERN_CREDITS: "abuse.credits_exploit_attempt",
  ABUSE_PATTERN_DELETION: "abuse.rapid_deletion",
  ABUSE_PATTERN_BILLING: "abuse.billing_anomaly",
  ABUSE_CREDENTIAL_STUFFING: "abuse.credential_stuffing",
  ABUSE_GLOBAL_ATTACK: "abuse.global_attack_detected",
  
  // IP blocking events
  IP_BLOCKED: "admin.ip_blocked",
  IP_UNBLOCKED: "admin.ip_unblocked",
  IP_BLOCKED_REQUEST: "security.ip_blocked_request",
  
  // Referral events
  REFERRAL_CODE_GENERATED: "referral.code_generated",
  REFERRAL_INVITE_SENT: "referral.invite_sent",
  REFERRAL_CLAIMED: "referral.claimed",
  REFERRAL_REDEEMED: "referral.redeemed",
  REFERRAL_COMPLETED: "referral.completed",
  REFERRAL_SAME_IP_FLAG: "referral.same_ip_flagged",
  REFERRAL_MULTI_CLAIM_BLOCKED: "referral.multi_claim_blocked",
  
  // Emergency actions — historical rows only. The Slack buttons that wrote
  // this are retired (#800); the name stays so old rows keep their label and
  // the overview alerts feed keeps matching them.
  EMERGENCY_ACTION_EXECUTED: "security.emergency_action",
  
  // System events (#800 — the panels are the alert surface; these land on
  // the admin overview's alerts feed by their severity)
  SYSTEM_HEALTH_ALERT: "system.health_alert",
  SYSTEM_CRITICAL_ERROR: "system.critical_error",

  // Admin activity tracking
  ADMIN_ACTION: "admin.action",
  SECURITY_UNAUTHORIZED_ADMIN: "security.unauthorized_admin_access",
  SECURITY_IMMUTABLE_LOG: "security.immutable_log",
  ADMIN_CONFIRMATION_REQUIRED: "admin.confirmation_required",
  
  // Moderator events
  MODERATOR_ESCALATION: "moderator.escalation",
  ROLE_CHANGED: "admin.role_changed",
  
  // Change request events
  CHANGE_REQUEST_CREATED: "moderator.change_request_created",
  CHANGE_REQUEST_APPROVED: "admin.change_request_approved",
  CHANGE_REQUEST_DENIED: "admin.change_request_denied",
  CHANGE_REQUEST_CANCELLED: "moderator.change_request_cancelled",
  // An approved sensitive request whose executor threw (#800). Warning
  // severity, so it lands on the admin overview's alerts feed; the request
  // itself stays `pending_execution` — shown as "Outcome unconfirmed", no
  // self-serve retry, because a retry road is how a refund gets issued twice.
  CHANGE_REQUEST_EXECUTION_FAILED: "admin.change_request_execution_failed",
  
  // Account freeze events (billing investigation)
  ACCOUNT_AUTO_FROZEN: "account.auto_frozen",
  /** A freeze by a moderator or admin — with their id on the row. The scan no longer freezes (#119). */
  ACCOUNT_FROZEN: "account.frozen",
  ACCOUNT_UNFROZEN: "account.unfrozen",
  
  // Account lifecycle events
  ACCOUNT_DELETED: "account.deleted",
  ACCOUNT_DELETION_REQUESTED: "account.deletion_requested",
  ACCOUNT_DELETION_FAILED: "account.deletion_failed",
  ACCOUNT_DELETION_COMPLETED: "account.deletion_completed",
  
  // Export events
  AUDIT_LOG_EXPORTED: "audit_log.exported",
  CREDIT_HISTORY_EXPORTED: "credit_history.exported",
  GENERATION_HISTORY_EXPORTED: "generation_history.exported",
  
  // GDPR data export
  DATA_EXPORT_REQUESTED: "account.data_export_requested",

  // Email verification events
  EMAIL_VERIFICATION_SENT: "auth.email_verification_sent",
  EMAIL_VERIFICATION_RESENT: "auth.email_verification_resent",
  EMAIL_VERIFIED: "auth.email_verified",
  EMAIL_VERIFICATION_FAILED: "auth.email_verification_failed",

  // Announcement / banner events
  BANNER_CREATED: "admin.banner_created",
  BANNER_UPDATED: "admin.banner_updated",
  BANNER_ACTIVATED: "admin.banner_activated",
  BANNER_DEACTIVATED: "admin.banner_deactivated",
  BANNER_DELETED: "admin.banner_deleted",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];
