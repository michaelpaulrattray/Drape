import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for Drape.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: varchar("displayName", { length: 128 }), // Custom display name
  email: varchar("email", { length: 320 }),
  avatarUrl: text("avatarUrl"), // Profile picture S3 URL
  avatarKey: varchar("avatarKey", { length: 256 }), // S3 key for cleanup
  bannerUrl: text("bannerUrl"), // Cover photo S3 URL
  bannerKey: varchar("bannerKey", { length: 256 }), // S3 key for cleanup
  bio: text("bio"), // User bio/description
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "moderator"]).default("user").notNull(),
  // Storage quota management (in bytes)
  storageUsed: int("storageUsed").default(0).notNull(), // Current storage used
  storageLimit: int("storageLimit").default(104857600).notNull(), // 100MB default limit
  // Account suspension fields
  suspendedAt: timestamp("suspendedAt"), // When account was suspended (null = active)
  suspendedReason: text("suspendedReason"), // Reason for suspension
  suspendedBy: int("suspendedBy"), // Admin user ID who suspended
  // Account freeze fields (lighter than suspension — blocks generation/purchase only)
  frozenAt: timestamp("frozenAt"), // When account was frozen (null = not frozen)
  frozenReason: text("frozenReason"), // Reason for freeze (e.g., "Credit discrepancy of 206 credits detected")
  frozenBy: varchar("frozenBy", { length: 64 }), // "system" for auto-freeze, or moderator user ID
  // Referral system
  referralCode: varchar("referralCode", { length: 16 }).unique(), // Auto-generated unique code (e.g., DRAPE-A3K9X2)
  referredByUserId: int("referredByUserId"), // User ID who referred this user
  // Pre-launch access gating
  approved: boolean("approved").default(false).notNull(), // Whether user has been approved for access (false = waitlisted)
  accessCode: varchar("accessCode", { length: 64 }), // Invite code used to gain access
  approvedAt: timestamp("approvedAt"), // When user was approved
  // Auth provider tracking
  passwordHash: text("passwordHash"), // bcrypt hash for email/password users (null for Google/legacy users)
  authProvider: varchar("authProvider", { length: 32 }).default("manus_legacy"), // 'email', 'google', 'manus_legacy'
  // Email verification (email/password signups only — Google users auto-verified)
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 128 }),
  emailVerificationExpiresAt: timestamp("emailVerificationExpiresAt"),
  // Account lockout fields (for failed login protection)
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"), // Temporary lockout expiry
  // Canvas first-run intro (D-9): profile-persisted so it survives devices;
  // dismissed permanently by any board interaction
  canvasIntroSeen: boolean("canvasIntroSeen").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Plan tier configuration with credit allocations
 */
// Pricing: 50x display multiplier applied. Volume discounts at higher tiers.
export const PLAN_TIERS = {
  free: { name: 'Free', monthlyCredits: 5000, price: 0, rolloverPercent: 0 },
  starter: { name: 'Starter', monthlyCredits: 75000, price: 2700, rolloverPercent: 50 },              // $27/mo  — $0.00036/cr
  pro: { name: 'Pro', monthlyCredits: 200000, price: 6800, rolloverPercent: 75 },                     // $68/mo  — $0.00034/cr
  studio: { name: 'Studio', monthlyCredits: 500000, price: 15900, rolloverPercent: 100 },              // $159/mo — $0.000318/cr
  studio_plus: { name: 'Studio Plus', monthlyCredits: 1250000, price: 37500, rolloverPercent: 100 },   // $375/mo — $0.0003/cr
  business: { name: 'Business', monthlyCredits: 3000000, price: 84000, rolloverPercent: 100 },         // $840/mo — $0.00028/cr
  business_plus: { name: 'Business Plus', monthlyCredits: 7500000, price: 195000, rolloverPercent: 100 }, // $1,950/mo — $0.00026/cr
  scale: { name: 'Scale', monthlyCredits: 20000000, price: 480000, rolloverPercent: 100 },             // $4,800/mo — $0.00024/cr
  scale_plus: { name: 'Scale Plus', monthlyCredits: 40000000, price: 880000, rolloverPercent: 100 },   // $8,800/mo — $0.00022/cr
  enterprise: { name: 'Enterprise', monthlyCredits: 75000000, price: 1500000, rolloverPercent: 100 },  // $15,000/mo — $0.0002/cr
  enterprise_plus: { name: 'Enterprise Plus', monthlyCredits: 150000000, price: 2700000, rolloverPercent: 100 }, // $27,000/mo — $0.00018/cr
  ultimate: { name: 'Ultimate', monthlyCredits: 300000000, price: 4800000, rolloverPercent: 100 },     // $48,000/mo — $0.00016/cr
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

/**
 * Credits table for tracking user balances and subscription tiers.
 * Note: Database table name remains "points" for backward compatibility.
 */
export const credits = mysqlTable("points", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").notNull().default(5000),
  planTier: mysqlEnum("planTier", ["free", "starter", "pro", "studio", "studio_plus", "business", "business_plus", "scale", "scale_plus", "enterprise", "enterprise_plus", "ultimate"]).default("free").notNull(),
  planExpiresAt: timestamp("planExpiresAt"),
  // Stripe subscription tracking
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due", "unpaid", "trialing"]),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  // Track credits purchased vs earned for analytics
  creditsPurchased: int("creditsPurchased").default(0).notNull(),
  creditsUsed: int("creditsUsed").default(0).notNull(),
  // Rollover tracking
  rolloverCredits: int("rolloverCredits").default(0).notNull(),
  lastRefreshAt: timestamp("lastRefreshAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Credits = typeof credits.$inferSelect;
export type InsertCredits = typeof credits.$inferInsert;

// Legacy aliases for backward compatibility during migration
export const points = credits;
export type Points = Credits;
export type InsertPoints = InsertCredits;

/**
 * Credit transactions table for tracking all credit movements.
 * Note: Database table name remains "point_transactions" for backward compatibility.
 */
export const creditTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  type: mysqlEnum("type", ["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription", "admin_add", "admin_deduct"]).notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 64 }),
  balanceAfter: int("balanceAfter").notNull(),
  // Track which engine was used (for Flash fallback pricing)
  engineUsed: varchar("engineUsed", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_point_txn_user_ref").on(table.userId, table.referenceId),
  index("idx_credit_txn_user_created").on(table.userId, table.createdAt),
]));

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

// Legacy aliases
export const pointTransactions = creditTransactions;
export type PointTransaction = CreditTransaction;
export type InsertPointTransaction = InsertCreditTransaction;

/**
 * Waitlist table for capturing early access signups.
 */
export const waitlist = mysqlTable("waitlist", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  company: text("company"),
  role: varchar("role", { length: 128 }), // e.g., "Creative Director", "Brand Manager"
  source: varchar("source", { length: 64 }), // e.g., "landing_page", "referral"
  referralCode: varchar("referralCode", { length: 32 }),
  notified: boolean("notified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = typeof waitlist.$inferInsert;

/**
 * AI Models table for storing generated model specifications.
 */
export const models = mysqlTable("models", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agencyId: varchar("agencyId", { length: 32 }).unique(), // e.g., "MOD-26-A1B2C3" - null until minted on export
  name: varchar("name", { length: 128 }), // User-assigned name
  masterPrompt: text("masterPrompt").notNull(), // Full generation prompt
  technicalSchema: json("technicalSchema").notNull(), // JSON object with model specs
  preferences: json("preferences").notNull(), // Original ModelPreferences input
  status: mysqlEnum("status", ["draft", "active", "locked", "archived"]).default("draft").notNull(),
  // draft = work in progress, mutable
  // active = minted with agencyId, identity locked
  // locked = permanently immutable (legacy support)
  // archived = soft deleted
  // Identity revision (Batch C, IDENTITY_EDIT_INTERIM_POLICY §7.4): the
  // server-owned era between identity-authorized anchor changes. Additive,
  // forward-only; NULL = the genesis revision for existing models — legacy
  // rows are never backfilled or promoted. Written only inside the §8.6
  // atomic identity commit and the server-side anchor re-roll.
  identityRevisionId: varchar("identityRevisionId", { length: 64 }),
  mintedAt: timestamp("mintedAt"), // When the model was exported/minted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_models_user").on(table.userId, table.status),
]));

export type Model = typeof models.$inferSelect;
export type InsertModel = typeof models.$inferInsert;

/**
 * Model assets table for storing generated images.
 */
export const modelAssets = mysqlTable("model_assets", {
  id: int("id").autoincrement().primaryKey(),
  modelId: int("modelId").notNull(),
  viewType: mysqlEnum("viewType", [
    "frontClose",   // Headshot/portrait
    "threeQuarter", // Three-quarter portrait (D-39 face cluster; added R3b)
    "frontFull",    // Full body front
    "sideClose",    // Side profile headshot
    "sideFull",     // Full body side
    "backFull",     // Full body back
  ]).notNull(),
  resolution: mysqlEnum("resolution", ["1K", "2K", "4K"]).default("1K").notNull(),
  storageUrl: text("storageUrl").notNull(), // S3 URL
  storageKey: varchar("storageKey", { length: 256 }), // S3 key for management
  pointsCost: int("pointsCost").notNull(), // Points spent on this asset
  // D-39/D-43 package columns (additive, R3b): the model-level package is the
  // single per-slot ledger — pins mark finished work; provenance records the
  // exact inputs + engine each view consumed (D-12 reproducibility)
  pinned: boolean("pinned").default(false).notNull(),
  status: json("status"),
  provenance: json("provenance"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_model_assets_model").on(table.modelId),
]));

export type ModelAsset = typeof modelAssets.$inferSelect;
export type InsertModelAsset = typeof modelAssets.$inferInsert;

/**
 * Generations table for tracking all AI generation requests.
 */
export const generations = mysqlTable("generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId"), // Nullable - may be a new model creation
  type: mysqlEnum("type", [
    "masterPrompt",
    "castingImage",
    "fullBody",
    "multiView",
    "iteration",
    "upscale",
    "wardrobeVTO",
    "wardrobeComposite",
    "wardrobeRefinement",
    "wardrobeDigitize",
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  pointsCost: int("pointsCost").notNull(),
  resultUrl: text("resultUrl"), // Output image URL
  errorMessage: text("errorMessage"), // Error if failed
  metadata: json("metadata"), // Additional generation params
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ([
  index("idx_generations_user").on(table.userId, table.createdAt),
  index("idx_generations_status").on(table.status, table.createdAt),
]));

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;


/**
 * Audit logs table for tracking security-sensitive operations.
 * Used for compliance, investigation, and abuse detection.
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Nullable for system events or unauthenticated actions
  action: varchar("action", { length: 64 }).notNull(), // e.g., "subscription.created", "model.deleted"
  resourceType: varchar("resourceType", { length: 32 }), // e.g., "subscription", "model", "credits"
  resourceId: varchar("resourceId", { length: 64 }), // ID of the affected resource
  metadata: json("metadata"), // Additional context (plan, amount, reason, etc.)
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_audit_severity_created").on(table.severity, table.createdAt),
  index("idx_audit_user").on(table.userId, table.createdAt),
]));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Audit action constants for consistent logging
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
  
  // Model events
  MODEL_CREATED: "model.created",
  MODEL_DELETED: "model.deleted",
  MODEL_MINTED: "model.minted",
  
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
  
  // Emergency actions (from Slack buttons)
  EMERGENCY_ACTION_EXECUTED: "security.emergency_action",
  
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
  
  // Account freeze events (billing investigation)
  ACCOUNT_AUTO_FROZEN: "account.auto_frozen",
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


/**
 * Blocked IPs table for IP-based access control
 * Blocked IPs are denied access to all endpoints
 */
export const blockedIps = mysqlTable("blocked_ips", {
  id: int("id").autoincrement().primaryKey(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(), // IPv6 max length
  reason: text("reason").notNull(),
  blockedBy: int("blockedBy").notNull(), // Admin user ID who blocked
  expiresAt: timestamp("expiresAt"), // null = permanent block
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertBlockedIp = typeof blockedIps.$inferInsert;

/**
 * Emergency action tokens for Slack button interactions
 * Single-use tokens that allow emergency actions without authentication
 */
export const emergencyTokens = mysqlTable("emergency_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(), // UUID v4
  action: mysqlEnum("action", ["block_ip", "suspend_user"]).notNull(),
  targetId: varchar("targetId", { length: 128 }).notNull(), // IP address or user ID
  metadata: json("metadata"), // Additional context (reason, alert details)
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"), // null = not yet used
  usedBy: varchar("usedBy", { length: 128 }), // Slack user ID who clicked
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmergencyToken = typeof emergencyTokens.$inferSelect;
export type InsertEmergencyToken = typeof emergencyTokens.$inferInsert;

/**
 * Change request types for moderator-initiated actions
 */
export const CHANGE_REQUEST_TYPES = [
  "refund_credits",
  "add_credits",
  "flag_account",
  "note_incident",
  "suspend_user",
  "unsuspend_user",
  "block_ip",
  "stripe_refund",
  "other",
] as const;

export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];

export const CHANGE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "denied",
  "cancelled",
  "expired",
  "pending_execution",
] as const;

export type ChangeRequestStatus = typeof CHANGE_REQUEST_STATUSES[number];

export const CHANGE_REQUEST_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export type ChangeRequestPriority = typeof CHANGE_REQUEST_PRIORITIES[number];

/**
 * Change requests table for moderator-initiated actions requiring admin approval.
 * Replaces free-text escalation with structured, trackable requests.
 */
export const changeRequests = mysqlTable("change_requests", {
  id: int("id").autoincrement().primaryKey(),
  // Request metadata
  type: mysqlEnum("type", ["refund_credits", "add_credits", "flag_account", "note_incident", "suspend_user", "unsuspend_user", "block_ip", "stripe_refund", "other"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "denied", "cancelled", "expired", "pending_execution"]).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  // Who submitted
  submittedById: int("submittedById").notNull(), // Moderator user ID
  submittedByName: varchar("submittedByName", { length: 256 }),
  // Target user
  targetUserId: int("targetUserId").notNull(),
  targetUserName: varchar("targetUserName", { length: 256 }),
  // Request details
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description").notNull(), // Detailed reason/justification
  evidenceSummary: text("evidenceSummary"), // What the moderator found in logs
  relatedAuditLogId: int("relatedAuditLogId"), // Link to relevant audit log entry
  // For credit-related requests
  creditAmount: int("creditAmount"), // Number of credits to refund/add
  creditReason: varchar("creditReason", { length: 512 }), // Specific reason for credit change
  // For IP-related requests
  ipAddress: varchar("ipAddress", { length: 45 }), // IP to block (for block_ip type)
  // For Stripe refund requests
  stripeSessionId: varchar("stripeSessionId", { length: 128 }), // Original Stripe checkout session ID
  refundType: mysqlEnum("refundType", ["full", "proportional"]), // Type of Stripe refund
  refundAmountCents: int("refundAmountCents"), // Calculated refund amount in cents
  originalCredits: int("originalCredits"), // Credits from the original purchase
  creditsToDeduct: int("creditsToDeduct"), // Credits to deduct (floored at 0 balance)
  // Admin review
  reviewedById: int("reviewedById"), // Admin who reviewed
  reviewedByName: varchar("reviewedByName", { length: 256 }),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"), // Admin's notes on approval/denial
  // Slack approval flow (for sensitive types)
  slackApprovalId: varchar("slackApprovalId", { length: 64 }), // Links to pending Slack approval action
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ChangeRequest = typeof changeRequests.$inferSelect;
export type InsertChangeRequest = typeof changeRequests.$inferInsert;

/**
 * Attachments for change requests — files/images uploaded by moderators as evidence.
 */
export const changeRequestAttachments = mysqlTable("change_request_attachments", {
  id: int("id").autoincrement().primaryKey(),
  changeRequestId: int("changeRequestId"), // Null until linked to a request
  filename: varchar("filename", { length: 256 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  url: text("url").notNull(), // Public S3 URL
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  size: int("size").notNull(), // File size in bytes
  uploadedById: int("uploadedById").notNull(), // Moderator who uploaded
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChangeRequestAttachment = typeof changeRequestAttachments.$inferSelect;
export type InsertChangeRequestAttachment = typeof changeRequestAttachments.$inferInsert;

/**
 * Referrals table for tracking user-to-user referrals.
 *
 * Flow: pending → signed_up → completed (referee first gen, referee gets credits)
 *                            → subscribed (referee pays, referrer gets credits)
 *
 * Reward: 12,500 credits per party. Referee on first generation, referrer on first paid action.
 * Lifetime cap: 250,000 credits earned via referrals per user.
 */
export const REFERRAL_REWARD_CREDITS = 12500;
export const REFERRAL_LIFETIME_CAP = 250000; // Max credits a user can earn from referrals

export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerUserId: int("referrerUserId").notNull(), // User who shared the link
  referredUserId: int("referredUserId"), // User who signed up (null until signup)
  referredEmail: varchar("referredEmail", { length: 320 }), // Optional: track invited email
  status: mysqlEnum("status", ["pending", "signed_up", "completed", "subscribed", "expired"]).default("pending").notNull(),
  // pending = link shared but no signup yet
  // signed_up = referred user created account
  // completed = referred user did first generation → referee credited
  // subscribed = referred user made first paid subscription → referrer credited
  // expired = referral link expired (optional TTL)
  referrerCredited: boolean("referrerCredited").default(false).notNull(),
  referredCredited: boolean("referredCredited").default(false).notNull(),
  creditsAwarded: int("creditsAwarded").default(0).notNull(), // Credits given to each party
  referrerIp: varchar("referrerIp", { length: 45 }), // IP of referrer when invite sent
  referredIp: varchar("referredIp", { length: 45 }), // IP of referred user on claim
  sameIpFlag: boolean("sameIpFlag").default(false).notNull(), // Fraud flag: same IP within 24hrs
  completedAt: timestamp("completedAt"), // When referee first generation happened
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ============================================================================
// ANNOUNCEMENTS / MAINTENANCE BANNERS
// ============================================================================

export const ANNOUNCEMENT_TYPES = ["info", "warning", "maintenance", "feature"] as const;

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "warning", "maintenance", "feature"]).default("info").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  startsAt: timestamp("startsAt"), // null = immediately when activated
  endsAt: timestamp("endsAt"), // null = no auto-expiry
  createdBy: int("createdBy").notNull(), // admin user ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

// ============================================================================
// INVITE CODES (Pre-launch access gating)
// ============================================================================

export const inviteCodes = mysqlTable("invite_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(), // e.g., DRAPE-EARLYBIRD-A3K9
  createdBy: int("createdBy").notNull(), // Admin who created the code
  maxUses: int("maxUses").default(1).notNull(), // How many times this code can be used
  currentUses: int("currentUses").default(0).notNull(), // How many times it's been used
  isActive: boolean("isActive").default(true).notNull(), // Can be deactivated
  expiresAt: timestamp("expiresAt"), // Optional expiry
  note: text("note"), // Admin note about who this code is for
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;

// ============================================================================
// STRIPE WEBHOOK EVENTS (Idempotency tracking)
// ============================================================================
export const stripeWebhookEvents = mysqlTable("stripe_webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 128 }).notNull().unique(), // Stripe event ID (evt_xxx)
  eventType: varchar("eventType", { length: 128 }).notNull(), // e.g., checkout.session.completed
  processedAt: timestamp("processedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_webhook_event_id").on(table.eventId),
  index("idx_webhook_processed_at").on(table.processedAt),
]);
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;

// ============================================================================
// BUG REPORTS (User-submitted feedback)
// ============================================================================
export const bugReports = mysqlTable("bug_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["casting", "wardrobe", "export", "billing", "ui", "other", "feedback"]).default("other").notNull(),
  page: varchar("page", { length: 256 }), // URL/route where bug was reported
  modelId: int("modelId"), // Model ID if applicable
  userAgent: varchar("userAgent", { length: 512 }),
  viewport: varchar("viewport", { length: 32 }), // e.g., "1920x1080"
  status: mysqlEnum("status", ["new", "reviewing", "resolved", "dismissed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_bug_reports_user").on(table.userId),
  index("idx_bug_reports_status").on(table.status),
]);
export type BugReport = typeof bugReports.$inferSelect;
export type InsertBugReport = typeof bugReports.$inferInsert;

// ============================================================================
// WARDROBE STUDIO
// ============================================================================

/**
 * Wardrobe garments — user's persistent garment library.
 * Each garment goes through: upload → detection → digitization → analysis.
 * Garments persist permanently in the user's closet.
 */
export const wardrobeGarments = mysqlTable("wardrobe_garments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  slotType: mysqlEnum("slotType", ["full_look", "tops", "bottoms", "shoes", "accessories"]).notNull(),
  shortName: varchar("shortName", { length: 128 }),
  description: text("description"),
  tags: json("tags"),                          // string[]
  suggestedActions: json("suggestedActions"),    // string[]
  originalImageUrl: text("originalImageUrl").notNull(), // S3 URL of uploaded image
  originalImageKey: varchar("originalImageKey", { length: 256 }),
  isolatedImageUrl: text("isolatedImageUrl"),    // S3 URL of digitized flat-lay
  isolatedImageKey: varchar("isolatedImageKey", { length: 256 }),
  sourceImageUrl: text("sourceImageUrl"),        // S3 URL of cropped source (from detection)
  sourceImageKey: varchar("sourceImageKey", { length: 256 }),
  qualityIssues: json("qualityIssues"),          // string[] from quality check
  detectedItems: json("detectedItems"),          // DetectedItem[] (for full_look decomposition)
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_wardrobe_garments_user").on(table.userId, table.slotType),
]));

export type WardrobeGarment = typeof wardrobeGarments.$inferSelect;
export type InsertWardrobeGarment = typeof wardrobeGarments.$inferInsert;

/**
 * Wardrobe outfits — saved garment combinations.
 * Users can save and reload outfit presets with style notes.
 */
export const wardrobeOutfits = mysqlTable("wardrobe_outfits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  garmentIds: json("garmentIds").notNull(),       // number[] of wardrobe_garment IDs
  styleNotes: json("styleNotes"),                  // Record<garmentId, string>
  resultThumbUrl: text("resultThumbUrl"),          // S3 URL of VTO result thumbnail
  resultThumbKey: varchar("resultThumbKey", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_wardrobe_outfits_user").on(table.userId),
]));

export type WardrobeOutfit = typeof wardrobeOutfits.$inferSelect;
export type InsertWardrobeOutfit = typeof wardrobeOutfits.$inferInsert;

/**
 * Wardrobe sessions — VTO generation history for undo/redo persistence.
 * Tracks the current canvas state and history stack per user per model.
 */
export const wardrobeSessions = mysqlTable("wardrobe_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId"),                        // FK to models table (null if uploaded model)
  modelImageUrl: text("modelImageUrl").notNull(),  // S3 URL of the base model image
  history: json("history"),                        // string[] of S3 URLs for undo/redo stack
  historyIndex: int("historyIndex").default(0),
  activeGarmentIds: json("activeGarmentIds"),      // number[] currently selected
  tattooMapData: json("tattooMapData"),            // TattooMap cached result
  styleNotes: json("styleNotes"),                    // Record<garmentId, string> for style instructions
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_wardrobe_sessions_user").on(table.userId),
]));

export type WardrobeSession = typeof wardrobeSessions.$inferSelect;
export type InsertWardrobeSession = typeof wardrobeSessions.$inferInsert;

// ── Wardrobe Looks (curated VTO results saved by the user) ──────────
export const wardrobeLooks = mysqlTable("wardrobe_looks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),                   // FK to wardrobe_sessions (optional — look persists if session deleted)
  modelId: int("modelId").notNull(),             // FK to models table — required for export grouping
  imageUrl: text("imageUrl").notNull(),           // S3 URL of the saved VTO result
  name: varchar("name", { length: 100 }),         // Optional user-given name (defaults to "Look N")
  garmentIds: json("garmentIds"),                 // number[] snapshot of garments worn at save time
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_wardrobe_looks_user").on(table.userId),
  index("idx_wardrobe_looks_model").on(table.modelId),
]));

export type WardrobeLook = typeof wardrobeLooks.$inferSelect;
export type InsertWardrobeLook = typeof wardrobeLooks.$inferInsert;

// ============================================================================
// CANVAS BOARDS (Phase 1 — persistent project workspaces)
// ============================================================================

/**
 * Boards — persistent project workspaces that group assets across tools.
 * Each board is a canvas where models, garments, and VTO results live together.
 */
export const boards = mysqlTable("boards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull().default("Untitled Board"),
  description: text("description"),
  thumbnailUrl: text("thumbnailUrl"), // S3 URL — auto-generated from first asset
  thumbnailKey: varchar("thumbnailKey", { length: 256 }),
  startedWith: mysqlEnum("startedWith", ["casting", "wardrobe", "blank"]).notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  // Canvas viewport state (for resume)
  viewportX: int("viewportX").default(0),
  viewportY: int("viewportY").default(0),
  viewportZoom: int("viewportZoom").default(100), // stored as percentage (100 = 1.0x)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_boards_user_status").on(table.userId, table.status),
]));

export type Board = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;

/**
 * Board items — individual assets placed on a board canvas.
 * Each item represents a model, garment, VTO result, reference image, or iteration.
 * Items link back to their source records via optional foreign keys.
 */
export const BOARD_ITEM_TYPES = ["model", "garment", "vto_result", "reference", "iteration", "note", "frame"] as const;
export type BoardItemType = typeof BOARD_ITEM_TYPES[number];

/**
 * Canvas rebuild (docs/specs/CANVAS_FOUNDATIONS.md Decision 1): `kind` governs
 * rendering; everything else lives in metadata.provenance. The legacy `type`
 * enum remains one migration cycle as a compatibility fallback — new code
 * writes both, reads `kind`.
 */
export const BOARD_ITEM_KINDS = ["image", "cast_config", "wardrobe_config", "note", "frame", "video"] as const;
export type BoardItemKind = typeof BOARD_ITEM_KINDS[number];

export const boardItems = mysqlTable("board_items", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  type: mysqlEnum("type", ["model", "garment", "vto_result", "reference", "iteration", "note", "frame"]).notNull(),
  kind: mysqlEnum("kind", ["image", "cast_config", "wardrobe_config", "note", "frame", "video"]), // null until backfilled
  label: varchar("label", { length: 256 }),
  imageUrl: text("imageUrl"), // S3 URL of the visual (null for notes)
  imageKey: varchar("imageKey", { length: 256 }),
  // Canvas positioning
  positionX: int("positionX").default(0).notNull(),
  positionY: int("positionY").default(0).notNull(),
  width: int("width").default(280).notNull(),
  height: int("height").default(280).notNull(),
  zIndex: int("zIndex").default(0).notNull(),
  // Relationships — optional back-references to source records
  parentItemId: int("parentItemId"), // Self-ref: legacy lineage. Frozen — new code writes board_edges (Decision 2)
  sourceModelId: int("sourceModelId"), // FK → models (if this item is a cast model)
  sourceGarmentId: int("sourceGarmentId"), // FK → wardrobe_garments (if this item is a garment)
  sourceSessionId: int("sourceSessionId"), // FK → wardrobe_sessions (if this item is a VTO result)
  sourceLookId: int("sourceLookId"), // FK → wardrobe_looks (if this item is a saved look)
  // Tool-specific metadata (casting attributes, provenance, status, pinned…)
  metadata: json("metadata"),
  // Soft delete (foundations Decision 7 — delete is undoable)
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_board_items_board").on(table.boardId, table.type),
  index("idx_board_items_kind").on(table.kind),
]));

export type BoardItem = typeof boardItems.$inferSelect;
export type InsertBoardItem = typeof boardItems.$inferInsert;

/**
 * Version history for board items — stores each iteration snapshot.
 * Enables "layers" icon on nodes to browse and revert to past versions.
 */
export const boardItemVersions = mysqlTable("board_item_versions", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(), // FK → board_items
  version: int("version").notNull(), // 1-based sequential version number
  imageUrl: text("imageUrl").notNull(), // S3 URL of this version's image
  prompt: text("prompt"), // The iteration prompt that produced this version (null for initial)
  tool: varchar("tool", { length: 32 }), // 'chat' | 'surgical' | 'eraser' | 'initial'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_biv_item").on(table.itemId, table.version),
]));

export type BoardItemVersion = typeof boardItemVersions.$inferSelect;
export type InsertBoardItemVersion = typeof boardItemVersions.$inferInsert;

/**
 * Board edges — first-class DAG lineage for canvas items
 * (CANVAS_FOUNDATIONS.md Decision 2). Fashion workflows are DAGs, not trees:
 * one VTO result has one model parent plus N garment parents. New code writes
 * edges; `board_items.parentItemId` is frozen legacy.
 */
export const BOARD_EDGE_RELATIONS = [
  "iterated_from",
  "vto_input_model",
  "vto_input_garment",
  "reference_for",
  "variant_of",
  "generated_from_cast",
  "forked_from",
] as const;
export type BoardEdgeRelation = typeof BOARD_EDGE_RELATIONS[number];

export const boardEdges = mysqlTable("board_edges", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  sourceItemId: int("sourceItemId").notNull(),
  targetItemId: int("targetItemId").notNull(),
  relation: mysqlEnum("relation", [
    "iterated_from",
    "vto_input_model",
    "vto_input_garment",
    "reference_for",
    "variant_of",
    "generated_from_cast",
    "forked_from",
  ]).notNull(),
  // Edge-level context (D-30 reserves { viewAngle } for weighted references)
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  index("idx_board_edges_source").on(table.sourceItemId),
  index("idx_board_edges_target").on(table.targetItemId),
  index("idx_board_edges_board").on(table.boardId),
]));

export type BoardEdge = typeof boardEdges.$inferSelect;
export type InsertBoardEdge = typeof boardEdges.$inferInsert;
