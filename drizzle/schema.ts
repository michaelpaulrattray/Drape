import {
  boolean,
  check,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

import { BODY_ANCHOR_REGIONS } from "../shared/bodyAnchorRegions";
import { KIND_LOCALITIES } from "../shared/kindLocality";
import { INK_PLACEMENTS } from "../shared/inkPlacementVocabulary";
import { INK_SIDES } from "../shared/inkReleasedPlacements";
import { INK_PROVENANCES } from "../shared/inkProvenance";
import { INK_TEMPLATE_KINDS } from "../shared/inkTemplateKinds";
import { REFERENCE_INTENTS, type ReferenceIntent } from "../shared/referenceIntents";

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
export const IDENTITY_SNAPSHOT_REASONS = [
  "bootstrap",
  "create",
  "identity_edit",
  "anchor_reroll",
  "document_compact",
  "evidence_accept",
  "evidence_remove",
  "restore",
  "fork_bootstrap",
] as const;

export const PACKAGE_SNAPSHOT_REASONS = [
  "bootstrap",
  "create",
  "identity_change",
  "image_refine",
  "slot_generate",
  "slot_refresh",
  "slot_restore",
  "add_views",
  "whole_restore",
  "mint",
  "late_view",
  "evidence_accept",
] as const;

export const PACKAGE_SLOT_COMPATIBILITY = ["current", "stale", "unverified"] as const;

export const PACKAGE_SLOT_SELECTION_REASONS = [
  "generated",
  "carried",
  "refreshed",
  "restored",
  "late_view",
  "bootstrap",
  "evidence_accept",
] as const;

export const models = mysqlTable("models", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agencyId: varchar("agencyId", { length: 32 }).unique(), // new: "KI-XXXX-XXXX-XXXX-XXXX"; legacy MOD-* remains valid
  name: varchar("name", { length: 128 }), // User-assigned name
  masterPrompt: text("masterPrompt").notNull(), // Full generation prompt
  technicalSchema: json("technicalSchema").notNull(), // JSON object with model specs
  preferences: json("preferences").notNull(), // Original ModelPreferences input
  status: mysqlEnum("status", ["draft", "active", "locked", "archived", "provisioning"]).default("draft").notNull(),
  /*
    CASTING V2 LINEAGE — migration 0018, additive.

    A Cast made by Sign records the cohort it was cast under and the candidate
    and roll it came from. `sourceCandidateId` is what the Sign adjudicator
    reads to find a model whose operation never got to bind one: the candidate
    knows its Cast via `signedCastId`, so recovery can always work backwards
    from the durable row rather than from the operation's unbound modelId.
  */
  cohortKey: varchar("cohortKey", { length: 48 }),
  styleKey: varchar("styleKey", { length: 48 }),
  sourceCandidateId: int("sourceCandidateId"),
  sourceRollId: int("sourceRollId"),
  // provisioning = invisible evidence-aware Fork under construction
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
  // R7-7 explicit effective-state head. Nullable throughout mixed-version
  // bootstrap; models without a filled headshot legitimately have no head.
  currentPackageSnapshotId: varchar("currentPackageSnapshotId", { length: 36 }),
  stateVersion: int("stateVersion").default(0).notNull(),
  // Set by the mint transition during dual-write. Snapshot reads remain off
  // until shadow parity and the separate R7-7B founder gate pass.
  sealedIdentitySnapshotId: varchar("sealedIdentitySnapshotId", { length: 36 }),
  sealedPackageSnapshotId: varchar("sealedPackageSnapshotId", { length: 36 }),
  mintedAt: timestamp("mintedAt"), // When the model was exported/minted
  // R7-5 permanent-deletion tombstone marker. Nullable is required for the
  // mixed-version migration window; non-null rows are unavailable forever.
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_models_user").on(table.userId, table.status),
  index("idx_models_current_package_snapshot").on(table.currentPackageSnapshotId),
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
    "frontClose",   // Head-and-shoulders portrait ("Portrait" from package v3)
    "threeQuarter", // Three-quarter portrait (D-39 face cluster; added R3b)
    "frontFull",    // Full body front
    "sideClose",    // Side profile headshot
    "sideFull",     // Full body side
    "backFull",     // Full body back
    /*
      PACKAGE v3 (migration 0019, founder ruling 2026-08-02). A genuinely new
      view: a tight face macro at 2K, the micro-detail lead for the
      character-sheet artifact. Appended rather than inserted — MySQL enums are
      ordered, and appending is the additive form that needs no table rewrite.

      It could not reuse a retired slot. `threeQuarter` holding a close-up would
      make every legacy row's name disagree with its content, which is the
      record-that-lies class this program keeps closing.
    */
    "closeUp",      // True close-up: tight face macro (package v3)
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
 * R7-7 immutable identity documents and anchor authority. These rows are
 * append-only outside permanent model/account deletion.
 */
export const modelIdentitySnapshots = mysqlTable("model_identity_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  modelId: int("modelId").notNull(),
  sequence: int("sequence").notNull(),
  parentSnapshotId: varchar("parentSnapshotId", { length: 36 }),
  restoredFromSnapshotId: varchar("restoredFromSnapshotId", { length: 36 }),
  reason: mysqlEnum("reason", IDENTITY_SNAPSHOT_REASONS).notNull(),
  masterPrompt: text("masterPrompt").notNull(),
  technicalSchema: json("technicalSchema").notNull(),
  preferences: json("preferences").notNull(),
  identityText: text("identityText").notNull(),
  identityTextHash: varchar("identityTextHash", { length: 64 }).notNull(),
  anchorAssetId: int("anchorAssetId").notNull(),
  recipeVersion: varchar("recipeVersion", { length: 64 }).notNull(),
  // Null is reserved for convergent bootstrap/backfill. Live user operations
  // must carry their durable operation id through the snapshot service.
  createdByOperationId: varchar("createdByOperationId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_model_identity_snapshots_model_sequence").on(table.modelId, table.sequence),
  index("idx_model_identity_snapshots_model_created").on(table.modelId, table.createdAt),
  index("idx_model_identity_snapshots_anchor").on(table.anchorAssetId),
]));

export type ModelIdentitySnapshot = typeof modelIdentitySnapshots.$inferSelect;
export type InsertModelIdentitySnapshot = typeof modelIdentitySnapshots.$inferInsert;

/**
 * R7-7 immutable package timeline. One package points at one identity
 * snapshot; the model holds only the current package pointer.
 */
export const modelPackageSnapshots = mysqlTable("model_package_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  modelId: int("modelId").notNull(),
  identitySnapshotId: varchar("identitySnapshotId", { length: 36 }).notNull(),
  sequence: int("sequence").notNull(),
  parentPackageSnapshotId: varchar("parentPackageSnapshotId", { length: 36 }),
  reason: mysqlEnum("reason", PACKAGE_SNAPSHOT_REASONS).notNull(),
  createdByOperationId: varchar("createdByOperationId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_model_package_snapshots_model_sequence").on(table.modelId, table.sequence),
  index("idx_model_package_snapshots_identity").on(table.identitySnapshotId),
  index("idx_model_package_snapshots_model_created").on(table.modelId, table.createdAt),
]));

export type ModelPackageSnapshot = typeof modelPackageSnapshots.$inferSelect;
export type InsertModelPackageSnapshot = typeof modelPackageSnapshots.$inferInsert;

/**
 * Explicit selected assets for one package state. Missing rows mean missing
 * slots. Failure markers and future unaccepted candidates are never selected.
 */
export const modelPackageSnapshotSlots = mysqlTable("model_package_snapshot_slots", {
  id: varchar("id", { length: 36 }).primaryKey(),
  packageSnapshotId: varchar("packageSnapshotId", { length: 36 }).notNull(),
  viewAngle: mysqlEnum("viewAngle", [
    "frontClose",
    "threeQuarter",
    "frontFull",
    "sideClose",
    "sideFull",
    "backFull",
    // Package v3 — the slot ledger must be able to select it, or a close-up
    // could be an asset the package snapshot cannot record.
    "closeUp",
  ]).notNull(),
  selectedAssetId: int("selectedAssetId").notNull(),
  compatibility: mysqlEnum("compatibility", PACKAGE_SLOT_COMPATIBILITY).notNull(),
  selectionReason: mysqlEnum("selectionReason", PACKAGE_SLOT_SELECTION_REASONS).notNull(),
  sourceSelectionId: varchar("sourceSelectionId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_model_package_slots_snapshot_angle").on(table.packageSnapshotId, table.viewAngle),
  uniqueIndex("uq_model_package_slots_snapshot_asset").on(table.packageSnapshotId, table.selectedAssetId),
  index("idx_model_package_slots_asset").on(table.selectedAssetId),
]));

export type ModelPackageSnapshotSlot = typeof modelPackageSnapshotSlots.$inferSelect;
export type InsertModelPackageSnapshotSlot = typeof modelPackageSnapshotSlots.$inferInsert;

/**
 * Generations table for tracking all AI generation requests.
 */
export const generations = mysqlTable("generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId"), // Nullable - may be a new model creation
  // R7-2 durable parent linkage. Nullable keeps historical rows and Wardrobe
  // attempts compatible until those products adopt the operation contract.
  operationId: varchar("operationId", { length: 36 }),
  stepKey: varchar("stepKey", { length: 64 }),
  viewAngle: varchar("viewAngle", { length: 32 }),
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
    "evidenceCandidate",
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
  index("idx_generations_operation_created").on(table.operationId, table.createdAt),
  index("idx_generations_operation_step").on(table.operationId, table.stepKey),
]));

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;

/**
 * R7 parent operation receipt. One row represents one user intent rather than
 * one provider attempt. Raw prompts, references, masks and image payloads are
 * never stored here; payloadHash is the only persisted request material.
 */
export const generationOperations = mysqlTable("generation_operations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  clientRequestId: varchar("clientRequestId", { length: 36 }).notNull(),
  kind: varchar("kind", { length: 48 }).notNull(),
  modelId: int("modelId"),
  originBoardId: int("originBoardId"),
  originItemId: int("originItemId"),
  payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
  status: varchar("status", { length: 24 }).default("claimed").notNull(),
  expectedIdentityRevisionId: varchar("expectedIdentityRevisionId", { length: 64 }),
  // R7-7 effective-state expectations. Nullable keeps every pre-0010 receipt
  // and the old runtime shape valid during migration-before-runtime rollout.
  expectedStateVersion: int("expectedStateVersion"),
  expectedIdentitySnapshotId: varchar("expectedIdentitySnapshotId", { length: 36 }),
  expectedPackageSnapshotId: varchar("expectedPackageSnapshotId", { length: 36 }),
  plannedCredits: int("plannedCredits").default(0).notNull(),
  chargedCredits: int("chargedCredits").default(0).notNull(),
  refundedCredits: int("refundedCredits").default(0).notNull(),
  chargeReferenceId: varchar("chargeReferenceId", { length: 64 }),
  result: json("result"),
  errorCode: varchar("errorCode", { length: 32 }),
  publicMessage: text("publicMessage"),
  phase: varchar("phase", { length: 48 }),
  progress: json("progress"),
  heartbeatAt: timestamp("heartbeatAt"),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  landingStatus: varchar("landingStatus", { length: 24 }).default("not_applicable").notNull(),
  landedItemId: int("landedItemId"),
  landingAcknowledgedAt: timestamp("landingAcknowledgedAt"),
  recoveryAttemptedAt: timestamp("recoveryAttemptedAt"),
  // R7-5 replay fence. Once set, old receipts may retain accounting/idempotency
  // truth but must not expose a saved subject result or invoke an executor.
  subjectDeletedAt: timestamp("subjectDeletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ([
  uniqueIndex("uq_generation_ops_user_request").on(table.userId, table.clientRequestId),
  index("idx_generation_ops_model_status_created").on(table.modelId, table.status, table.createdAt),
  index("idx_generation_ops_user_created").on(table.userId, table.createdAt),
  index("idx_generation_ops_status_lease").on(table.status, table.leaseExpiresAt),
  uniqueIndex("uq_generation_ops_charge_ref").on(table.chargeReferenceId),
]));

export type GenerationOperation = typeof generationOperations.$inferSelect;
export type InsertGenerationOperation = typeof generationOperations.$inferInsert;

/**
 * Exclusive operation lease. R7-1 never steals an expired row; expiry is
 * support/recovery evidence until R7-2 introduces heartbeat and adjudication.
 */
export const generationOperationLocks = mysqlTable("generation_operation_locks", {
  lockKey: varchar("lockKey", { length: 96 }).primaryKey(),
  operationId: varchar("operationId", { length: 36 }).notNull(),
  kind: varchar("kind", { length: 48 }).notNull(),
  acquiredAt: timestamp("acquiredAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, (table) => ([
  uniqueIndex("uq_generation_operation_locks_operation").on(table.operationId),
]));

export type GenerationOperationLock = typeof generationOperationLocks.$inferSelect;
export type InsertGenerationOperationLock = typeof generationOperationLocks.$inferInsert;

// ============================================================================
// OWNED STORAGE CLEANUP (R7-5)
// ============================================================================

export const STORAGE_CLEANUP_BATCH_KINDS = [
  "model_delete",
  "account_delete",
  "evidence_cleanup",
  // `candidate_cleanup` is EVIDENCE candidates and predates Casting V2. The
  // roll domain's expiring candidates needed their own value rather than
  // sharing it — two retention policies behind one enum value would make the
  // worker's batches ambiguous (§G.6).
  "candidate_cleanup",
  "casting_candidate_cleanup",
  /*
    Refused-render diagnostics (migration 0024). Its own value for the same
    reason `casting_candidate_cleanup` got one: these are frames of a person's
    FACE kept only to diagnose a failure, and their retention answers to that
    purpose rather than to a candidate's lifecycle. One enum value covering two
    retention policies makes the worker's batches ambiguous, and this is the
    policy nobody would want guessed at.
  */
  "casting_diagnostic_cleanup",
] as const;
export type StorageCleanupBatchKind = typeof STORAGE_CLEANUP_BATCH_KINDS[number];

export const STORAGE_CLEANUP_BATCH_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "partial",
  "failed",
] as const;
export type StorageCleanupBatchStatus = typeof STORAGE_CLEANUP_BATCH_STATUSES[number];

export const STORAGE_CLEANUP_ITEM_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
] as const;
export type StorageCleanupItemStatus = typeof STORAGE_CLEANUP_ITEM_STATUSES[number];

export const STORAGE_CLEANUP_BACKENDS = [
  "public_r2",
  "private_evidence_r2",
] as const;
export type StorageCleanupBackend = typeof STORAGE_CLEANUP_BACKENDS[number];

/**
 * One durable cleanup intent. The source transaction creates this manifest
 * before scrubbing its source rows; the later worker owns only these keys.
 */
export const storageCleanupBatches = mysqlTable("storage_cleanup_batches", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  operationId: varchar("operationId", { length: 36 }).notNull(),
  kind: mysqlEnum("kind", STORAGE_CLEANUP_BATCH_KINDS).notNull(),
  status: mysqlEnum("status", STORAGE_CLEANUP_BATCH_STATUSES)
    .default("pending")
    .notNull(),
  expectedCount: int("expectedCount").default(0).notNull(),
  deletedCount: int("deletedCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  leaseToken: varchar("leaseToken", { length: 64 }),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  heartbeatAt: timestamp("heartbeatAt"),
  attemptedAt: timestamp("attemptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_storage_cleanup_batches_operation").on(table.operationId),
  index("idx_storage_cleanup_batches_status_lease").on(table.status, table.leaseExpiresAt),
]));

export type StorageCleanupBatch = typeof storageCleanupBatches.$inferSelect;
export type InsertStorageCleanupBatch = typeof storageCleanupBatches.$inferInsert;

/** Transient exact-owned keys. Succeeded items are removed/scrubbed in R7-5D. */
export const storageCleanupItems = mysqlTable("storage_cleanup_items", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageBackend: mysqlEnum("storageBackend", STORAGE_CLEANUP_BACKENDS)
    .default("public_r2")
    .notNull(),
  status: mysqlEnum("status", STORAGE_CLEANUP_ITEM_STATUSES)
    .default("pending")
    .notNull(),
  attempts: int("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  lastErrorCode: varchar("lastErrorCode", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_storage_cleanup_items_batch_key")
    .on(table.batchId, table.storageBackend, table.storageKey),
  index("idx_storage_cleanup_items_status_next").on(table.status, table.nextAttemptAt),
]));

export type StorageCleanupItem = typeof storageCleanupItems.$inferSelect;
export type InsertStorageCleanupItem = typeof storageCleanupItems.$inferInsert;

// ============================================================================
// OWNED CAST EVIDENCE (R7-7C)
// ============================================================================

export const CASTING_EVIDENCE_INGESTION_PURPOSES = [
  "reference_plate",
  "evidence_crop",
  "fork_copy",
] as const;
export type CastingEvidenceIngestionPurpose =
  typeof CASTING_EVIDENCE_INGESTION_PURPOSES[number];

export const CASTING_EVIDENCE_INGESTION_STATUSES = [
  "planned",
  "stored",
  "attached",
  "cleanup_pending",
  "cleaned",
] as const;
export type CastingEvidenceIngestionStatus =
  typeof CASTING_EVIDENCE_INGESTION_STATUSES[number];

export const CASTING_EVIDENCE_ENTITY_KINDS = [
  "reference_plate",
  "evidence_crop",
] as const;
export type CastingEvidenceEntityKind =
  typeof CASTING_EVIDENCE_ENTITY_KINDS[number];

export const MODEL_REFERENCE_PLATE_KINDS = [
  "uploaded_reference",
  "accepted_candidate",
] as const;
export type ModelReferencePlateKind = typeof MODEL_REFERENCE_PLATE_KINDS[number];

/**
 * Mutable R2/MySQL crash-recovery receipt. It persists exact owned keys and
 * closed metadata only—never bytes, prompts, URLs, or provider output.
 *
 * Deliberately no DB foreign keys: mixed-version deletion must never be
 * blocked or cascade evidence rows without first creating an exact-key
 * cleanup manifest.
 */
export const castingEvidenceIngestions = mysqlTable("casting_evidence_ingestions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId").notNull(),
  operationId: varchar("operationId", { length: 36 }).notNull(),
  stepKey: varchar("stepKey", { length: 64 }).default("primary").notNull(),
  purpose: mysqlEnum("purpose", CASTING_EVIDENCE_INGESTION_PURPOSES).notNull(),
  status: mysqlEnum("status", CASTING_EVIDENCE_INGESTION_STATUSES)
    .default("planned")
    .notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mime: varchar("mime", { length: 32 }).notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  byteSize: int("byteSize").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  attachedEntityKind: mysqlEnum("attachedEntityKind", CASTING_EVIDENCE_ENTITY_KINDS),
  attachedEntityId: varchar("attachedEntityId", { length: 36 }),
  cleanupBatchId: varchar("cleanupBatchId", { length: 36 }),
  attachedAt: timestamp("attachedAt"),
  cleanupQueuedAt: timestamp("cleanupQueuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_casting_evidence_ingestions_operation_step").on(
    table.operationId,
    table.stepKey,
  ),
  uniqueIndex("uq_casting_evidence_ingestions_storage_key").on(table.storageKey),
  index("idx_casting_evidence_ingestions_status_updated").on(table.status, table.updatedAt),
  index("idx_casting_evidence_ingestions_owner_model_status").on(
    table.userId,
    table.modelId,
    table.status,
  ),
]));

export type CastingEvidenceIngestion = typeof castingEvidenceIngestions.$inferSelect;
export type InsertCastingEvidenceIngestion = typeof castingEvidenceIngestions.$inferInsert;

/**
 * Immutable owner-uploaded reference plate. Only an exact owned key is
 * persisted; a delivery locator is resolved at read time by the later adapter.
 */
export const modelReferencePlates = mysqlTable("model_reference_plates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId").notNull(),
  featureIntentId: varchar("featureIntentId", { length: 36 }),
  kind: mysqlEnum("kind", MODEL_REFERENCE_PLATE_KINDS).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mime: varchar("mime", { length: 32 }).notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  byteSize: int("byteSize").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  createdByOperationId: varchar("createdByOperationId", { length: 36 }).notNull(),
  createdByOperationStepKey: varchar("createdByOperationStepKey", { length: 64 })
    .default("primary")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_model_reference_plates_storage_key").on(table.storageKey),
  uniqueIndex("uq_model_reference_plates_feature_intent").on(table.featureIntentId),
  uniqueIndex("uq_model_reference_plates_operation_step").on(
    table.createdByOperationId,
    table.createdByOperationStepKey,
  ),
  index("idx_model_reference_plates_owner_model_created").on(
    table.userId,
    table.modelId,
    table.createdAt,
  ),
]));

export type ModelReferencePlate = typeof modelReferencePlates.$inferSelect;
export type InsertModelReferencePlate = typeof modelReferencePlates.$inferInsert;

/**
 * Immutable contextual crop. Zone/surface/side are versioned ontology labels,
 * not client authority; the later server recipe owns their closed validation.
 */
export const modelEvidenceCrops = mysqlTable("model_evidence_crops", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId").notNull(),
  plateId: varchar("plateId", { length: 36 }).notNull(),
  ontologyVersion: varchar("ontologyVersion", { length: 64 }).notNull(),
  zone: varchar("zone", { length: 64 }).notNull(),
  surface: varchar("surface", { length: 64 }).notNull(),
  side: varchar("side", { length: 32 }).notNull(),
  sourceX: decimal("sourceX", { precision: 10, scale: 9 }).notNull(),
  sourceY: decimal("sourceY", { precision: 10, scale: 9 }).notNull(),
  sourceWidth: decimal("sourceWidth", { precision: 10, scale: 9 }).notNull(),
  sourceHeight: decimal("sourceHeight", { precision: 10, scale: 9 }).notNull(),
  sourceImageWidth: int("sourceImageWidth").notNull(),
  sourceImageHeight: int("sourceImageHeight").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mime: varchar("mime", { length: 32 }).notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  byteSize: int("byteSize").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  cropRecipeVersion: varchar("cropRecipeVersion", { length: 64 }).notNull(),
  createdByOperationId: varchar("createdByOperationId", { length: 36 }).notNull(),
  createdByOperationStepKey: varchar("createdByOperationStepKey", { length: 64 })
    .default("primary")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_model_evidence_crops_storage_key").on(table.storageKey),
  uniqueIndex("uq_model_evidence_crops_operation_step").on(
    table.createdByOperationId,
    table.createdByOperationStepKey,
  ),
  index("idx_model_evidence_crops_plate").on(table.plateId),
  index("idx_model_evidence_crops_owner_model_created").on(
    table.userId,
    table.modelId,
    table.createdAt,
  ),
]));

export type ModelEvidenceCrop = typeof modelEvidenceCrops.$inferSelect;
export type InsertModelEvidenceCrop = typeof modelEvidenceCrops.$inferInsert;

// ============================================================================
// R7-7D TYPED IDENTITY FEATURES AND CANDIDATES
// ============================================================================

export const IDENTITY_FEATURE_INTENT_STATUSES = [
  "pending",
  "resolved",
  "cancelled",
] as const;

export const EVIDENCE_CANDIDATE_STATUSES = [
  "processing",
  "ready",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
  "invalid",
] as const;

export const EVIDENCE_CANDIDATE_ATTEMPT_STATUSES = [
  "planned",
  "generating",
  "stored",
  "probe_passed",
  "probe_failed",
  "probe_unknown",
  "promoted",
  "cleanup_pending",
  "cleaned",
] as const;

export const EVIDENCE_PROBE_OUTCOMES = ["pass", "fail", "unknown"] as const;
export const EVIDENCE_CANDIDATE_PURPOSES = [
  "feature_authoring",
  "feature_projection",
] as const;
export const EVIDENCE_CANDIDATE_TARGET_COVERAGE_BASES = [
  "registry_affected",
  "observed_visible",
] as const;
export const IDENTITY_FEATURE_SELECTION_REASONS = [
  "accepted",
  "carried",
  "restored",
] as const;

/**
 * One resumable, owner-scoped authoring session. The nullable active key uses
 * MySQL's multiple-NULL uniqueness law to retain terminal history while
 * allowing only one pending capability per model.
 */
export const modelIdentityFeatureIntents = mysqlTable(
  "model_identity_feature_intents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    modelId: int("modelId").notNull(),
    capabilityKey: varchar("capabilityKey", { length: 96 }).notNull(),
    activeCapabilityKey: varchar("activeCapabilityKey", { length: 96 }),
    status: mysqlEnum("status", IDENTITY_FEATURE_INTENT_STATUSES)
      .default("pending")
      .notNull(),
    category: mysqlEnum("category", ["ink"]).notNull(),
    operation: mysqlEnum("operation", ["add"]).notNull(),
    ontologyVersion: varchar("ontologyVersion", { length: 64 }).notNull(),
    zone: varchar("zone", { length: 64 }).notNull(),
    surface: varchar("surface", { length: 64 }).notNull(),
    side: varchar("side", { length: 32 }).notNull(),
    normalizedDescriptor: varchar("normalizedDescriptor", { length: 512 }),
    sourceAssetId: int("sourceAssetId").notNull(),
    expectedStateVersion: int("expectedStateVersion").notNull(),
    identitySnapshotId: varchar("identitySnapshotId", { length: 36 }).notNull(),
    packageSnapshotId: varchar("packageSnapshotId", { length: 36 }).notNull(),
    createdByOperationId: varchar("createdByOperationId", { length: 36 }).notNull(),
    resolvedByOperationId: varchar("resolvedByOperationId", { length: 36 }),
    resolvedCandidateId: varchar("resolvedCandidateId", { length: 36 }),
    resolvedFeatureId: varchar("resolvedFeatureId", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  (table) => ([
    uniqueIndex("uq_identity_feature_intents_model_active").on(
      table.modelId,
      table.activeCapabilityKey,
    ),
    uniqueIndex("uq_identity_feature_intents_created_operation").on(
      table.createdByOperationId,
    ),
    index("idx_identity_feature_intents_owner_model_status").on(
      table.userId,
      table.modelId,
      table.status,
    ),
    index("idx_identity_feature_intents_model_created").on(
      table.modelId,
      table.createdAt,
    ),
  ]),
);

export type ModelIdentityFeatureIntent =
  typeof modelIdentityFeatureIntents.$inferSelect;
export type InsertModelIdentityFeatureIntent =
  typeof modelIdentityFeatureIntents.$inferInsert;

/**
 * One user-priced candidate episode. An episode may own one charged attempt
 * and one included system retry, but only one ready candidate can remain
 * active for its intent.
 */
export const castingEvidenceCandidates = mysqlTable(
  "casting_evidence_candidates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    modelId: int("modelId").notNull(),
    // Authoring candidates own an intent. Projection candidates are package
    // work and therefore have no feature-authoring intent.
    intentId: varchar("intentId", { length: 36 }),
    originatingOperationId: varchar("originatingOperationId", { length: 36 }).notNull(),
    capabilityKey: varchar("capabilityKey", { length: 96 }).notNull(),
    activeSlot: mysqlEnum("activeSlot", ["active"]),
    expectedStateVersion: int("expectedStateVersion").notNull(),
    identitySnapshotId: varchar("identitySnapshotId", { length: 36 }).notNull(),
    packageSnapshotId: varchar("packageSnapshotId", { length: 36 }).notNull(),
    targetViewAngle: mysqlEnum("targetViewAngle", [
      "frontClose",
      "threeQuarter",
      "frontFull",
      "sideClose",
      "sideFull",
      "backFull",
    ]).notNull(),
    sourceAssetId: int("sourceAssetId").notNull(),
    status: mysqlEnum("status", EVIDENCE_CANDIDATE_STATUSES)
      .default("processing")
      .notNull(),
    readyAttemptId: varchar("readyAttemptId", { length: 36 }),
    acceptedAssetId: int("acceptedAssetId"),
    acceptedIdentitySnapshotId: varchar("acceptedIdentitySnapshotId", { length: 36 }),
    acceptedPackageSnapshotId: varchar("acceptedPackageSnapshotId", { length: 36 }),
    cleanupBatchId: varchar("cleanupBatchId", { length: 36 }),
    composerRecipeVersion: varchar("composerRecipeVersion", { length: 64 }).notNull(),
    probeRecipeVersion: varchar("probeRecipeVersion", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
    resolvedAt: timestamp("resolvedAt"),
    resolvedByOperationId: varchar("resolvedByOperationId", { length: 36 }),
    // Appended by R7-7G migration 0015 so old rows close as authoring.
    purpose: mysqlEnum("purpose", EVIDENCE_CANDIDATE_PURPOSES)
      .default("feature_authoring")
      .notNull(),
  },
  (table) => ([
    uniqueIndex("uq_evidence_candidates_origin_operation").on(
      table.originatingOperationId,
    ),
    uniqueIndex("uq_evidence_candidates_intent_active").on(
      table.intentId,
      table.activeSlot,
    ),
    uniqueIndex("uq_evidence_candidates_model_active").on(
      table.modelId,
      table.activeSlot,
    ),
    index("idx_evidence_candidates_owner_model_status").on(
      table.userId,
      table.modelId,
      table.status,
    ),
    index("idx_evidence_candidates_intent_created").on(
      table.intentId,
      table.createdAt,
    ),
    index("idx_evidence_candidates_status_expiry").on(
      table.status,
      table.expiresAt,
    ),
  ]),
);

export type CastingEvidenceCandidate =
  typeof castingEvidenceCandidates.$inferSelect;
export type InsertCastingEvidenceCandidate =
  typeof castingEvidenceCandidates.$inferInsert;

/**
 * Immutable target set for one private feature-projection candidate. A single
 * accepted target image may prove several selected feature versions at the
 * same angle, so the candidate owns one row per version instead of a nullable
 * feature pointer on the candidate itself.
 */
export const castingEvidenceCandidateFeatureTargets = mysqlTable(
  "casting_evidence_candidate_feature_targets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    candidateId: varchar("candidateId", { length: 36 }).notNull(),
    userId: int("userId").notNull(),
    modelId: int("modelId").notNull(),
    identitySnapshotId: varchar("identitySnapshotId", { length: 36 }).notNull(),
    featureId: varchar("featureId", { length: 36 }).notNull(),
    featureVersionId: varchar("featureVersionId", { length: 36 }).notNull(),
    coverageBasis: mysqlEnum(
      "coverageBasis",
      EVIDENCE_CANDIDATE_TARGET_COVERAGE_BASES,
    ).notNull(),
    coverageProbeRecipeVersion: varchar("coverageProbeRecipeVersion", {
      length: 64,
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ([
    uniqueIndex("uq_candidate_feature_targets_candidate_feature").on(
      table.candidateId,
      table.featureId,
    ),
    uniqueIndex("uq_candidate_feature_targets_candidate_version").on(
      table.candidateId,
      table.featureVersionId,
    ),
    index("idx_candidate_feature_targets_owner_model").on(
      table.userId,
      table.modelId,
    ),
    index("idx_candidate_feature_targets_version").on(table.featureVersionId),
  ]),
);

export type CastingEvidenceCandidateFeatureTarget =
  typeof castingEvidenceCandidateFeatureTargets.$inferSelect;
export type InsertCastingEvidenceCandidateFeatureTarget =
  typeof castingEvidenceCandidateFeatureTargets.$inferInsert;

/**
 * Crash-recovery receipt and exact-key owner for one internal attempt.
 * Probe fields are deliberately closed; raw provider prose is never stored.
 */
export const castingEvidenceCandidateAttempts = mysqlTable(
  "casting_evidence_candidate_attempts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    candidateId: varchar("candidateId", { length: 36 }).notNull(),
    attemptNumber: int("attemptNumber").notNull(),
    generationId: int("generationId"),
    status: mysqlEnum("status", EVIDENCE_CANDIDATE_ATTEMPT_STATUSES)
      .default("planned")
      .notNull(),
    privatePlateId: varchar("privatePlateId", { length: 36 }).notNull(),
    privateStorageKey: varchar("privateStorageKey", { length: 512 }),
    mime: varchar("mime", { length: 32 }),
    width: int("width"),
    height: int("height"),
    byteSize: int("byteSize"),
    contentHash: varchar("contentHash", { length: 64 }),
    promotedPublicStorageKey: varchar("promotedPublicStorageKey", { length: 512 }),
    cleanupBatchId: varchar("cleanupBatchId", { length: 36 }),
    actualImageEngine: varchar("actualImageEngine", { length: 64 }).notNull(),
    composerRecipeVersion: varchar("composerRecipeVersion", { length: 64 }).notNull(),
    probeModel: varchar("probeModel", { length: 64 }).notNull(),
    probeRecipeVersion: varchar("probeRecipeVersion", { length: 64 }).notNull(),
    predictedVisibility: mysqlEnum("predictedVisibility", EVIDENCE_PROBE_OUTCOMES),
    identityOutcome: mysqlEnum("identityOutcome", EVIDENCE_PROBE_OUTCOMES),
    placementOutcome: mysqlEnum("placementOutcome", EVIDENCE_PROBE_OUTCOMES),
    featureMatchOutcome: mysqlEnum("featureMatchOutcome", EVIDENCE_PROBE_OUTCOMES),
    priorInkOutcome: mysqlEnum("priorInkOutcome", EVIDENCE_PROBE_OUTCOMES),
    poseFramingOutcome: mysqlEnum("poseFramingOutcome", EVIDENCE_PROBE_OUTCOMES),
    unexpectedInkOutcome: mysqlEnum("unexpectedInkOutcome", EVIDENCE_PROBE_OUTCOMES),
    overallOutcome: mysqlEnum("overallOutcome", EVIDENCE_PROBE_OUTCOMES),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    storedAt: timestamp("storedAt"),
    probedAt: timestamp("probedAt"),
    promotedAt: timestamp("promotedAt"),
  },
  (table) => ([
    check(
      "chk_evidence_candidate_attempt_number",
      sql`${table.attemptNumber} in (1, 2)`,
    ),
    uniqueIndex("uq_evidence_candidate_attempt_number").on(
      table.candidateId,
      table.attemptNumber,
    ),
    uniqueIndex("uq_evidence_candidate_attempt_generation").on(table.generationId),
    uniqueIndex("uq_evidence_candidate_attempt_plate").on(table.privatePlateId),
    uniqueIndex("uq_evidence_candidate_attempt_private_key").on(table.privateStorageKey),
    uniqueIndex("uq_evidence_candidate_attempt_public_key").on(
      table.promotedPublicStorageKey,
    ),
    index("idx_evidence_candidate_attempt_status").on(
      table.candidateId,
      table.status,
    ),
  ]),
);

export type CastingEvidenceCandidateAttempt =
  typeof castingEvidenceCandidateAttempts.$inferSelect;
export type InsertCastingEvidenceCandidateAttempt =
  typeof castingEvidenceCandidateAttempts.$inferInsert;

export const modelIdentityFeatures = mysqlTable(
  "model_identity_features",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    modelId: int("modelId").notNull(),
    category: mysqlEnum("category", ["ink"]).notNull(),
    createdByOperationId: varchar("createdByOperationId", { length: 36 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    createdByOperationStepKey: varchar("createdByOperationStepKey", {
      length: 64,
    }).default("primary").notNull(),
  },
  (table) => ([
    uniqueIndex("uq_identity_features_operation_step").on(
      table.createdByOperationId,
      table.createdByOperationStepKey,
    ),
    index("idx_identity_features_model_created").on(table.modelId, table.createdAt),
  ]),
);

export type ModelIdentityFeature = typeof modelIdentityFeatures.$inferSelect;
export type InsertModelIdentityFeature = typeof modelIdentityFeatures.$inferInsert;

export const modelIdentityFeatureVersions = mysqlTable(
  "model_identity_feature_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    modelId: int("modelId").notNull(),
    featureId: varchar("featureId", { length: 36 }).notNull(),
    operation: mysqlEnum("operation", ["present"]).notNull(),
    ontologyVersion: varchar("ontologyVersion", { length: 64 }).notNull(),
    zone: varchar("zone", { length: 64 }).notNull(),
    surface: varchar("surface", { length: 64 }).notNull(),
    side: varchar("side", { length: 32 }).notNull(),
    normalizedDescriptor: varchar("normalizedDescriptor", { length: 512 }).notNull(),
    sourceAssetId: int("sourceAssetId"),
    sourceViewAngle: mysqlEnum("sourceViewAngle", [
      "frontClose",
      "threeQuarter",
      "frontFull",
      "sideClose",
      "sideFull",
      "backFull",
    ]).notNull(),
    sourceReferencePlateId: varchar("sourceReferencePlateId", { length: 36 }),
    acceptedCandidatePlateId: varchar("acceptedCandidatePlateId", { length: 36 }).notNull(),
    evidenceCropId: varchar("evidenceCropId", { length: 36 }),
    recipeVersion: varchar("recipeVersion", { length: 64 }).notNull(),
    createdByOperationId: varchar("createdByOperationId", { length: 36 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    // Appended by 0014 so the startup schema contract matches physical order.
    acceptedAssetId: int("acceptedAssetId"),
    createdByOperationStepKey: varchar("createdByOperationStepKey", {
      length: 64,
    }).default("primary").notNull(),
  },
  (table) => ([
    uniqueIndex("uq_identity_feature_versions_operation_step").on(
      table.createdByOperationId,
      table.createdByOperationStepKey,
    ),
    uniqueIndex("uq_identity_feature_versions_accepted_asset").on(
      table.acceptedAssetId,
    ),
    index("idx_identity_feature_versions_model_created").on(
      table.modelId,
      table.createdAt,
    ),
    index("idx_identity_feature_versions_feature").on(table.featureId),
  ]),
);

export type ModelIdentityFeatureVersion =
  typeof modelIdentityFeatureVersions.$inferSelect;
export type InsertModelIdentityFeatureVersion =
  typeof modelIdentityFeatureVersions.$inferInsert;

/**
 * Accepted evidence for a newly exposed view/surface of one immutable feature
 * version. The authoring plate remains on the version row; these append-only
 * rows prove later projections without creating a second logical tattoo.
 */
export const modelIdentityFeatureProjectionEvidence = mysqlTable(
  "model_identity_feature_projection_evidence",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull(),
    modelId: int("modelId").notNull(),
    featureId: varchar("featureId", { length: 36 }).notNull(),
    featureVersionId: varchar("featureVersionId", { length: 36 }).notNull(),
    targetViewAngle: mysqlEnum("targetViewAngle", [
      "frontClose",
      "threeQuarter",
      "frontFull",
      "sideClose",
      "sideFull",
      "backFull",
    ]).notNull(),
    sourceAssetId: int("sourceAssetId"),
    acceptedAssetId: int("acceptedAssetId").notNull(),
    acceptedCandidatePlateId: varchar("acceptedCandidatePlateId", {
      length: 36,
    }).notNull(),
    recipeVersion: varchar("recipeVersion", { length: 64 }).notNull(),
    createdByOperationId: varchar("createdByOperationId", {
      length: 36,
    }).notNull(),
    createdByOperationStepKey: varchar("createdByOperationStepKey", {
      length: 64,
    }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ([
    uniqueIndex("uq_feature_projection_version_angle").on(
      table.featureVersionId,
      table.targetViewAngle,
    ),
    index("idx_feature_projection_accepted_asset").on(
      table.acceptedAssetId,
    ),
    uniqueIndex("uq_feature_projection_operation_step").on(
      table.createdByOperationId,
      table.createdByOperationStepKey,
    ),
    index("idx_feature_projection_owner_model").on(
      table.userId,
      table.modelId,
    ),
    index("idx_feature_projection_feature").on(table.featureId),
    index("idx_feature_projection_version").on(table.featureVersionId),
    index("idx_feature_projection_plate").on(table.acceptedCandidatePlateId),
  ]),
);

export type ModelIdentityFeatureProjectionEvidence =
  typeof modelIdentityFeatureProjectionEvidence.$inferSelect;
export type InsertModelIdentityFeatureProjectionEvidence =
  typeof modelIdentityFeatureProjectionEvidence.$inferInsert;

export const modelSnapshotFeatureSelections = mysqlTable(
  "model_snapshot_feature_selections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    modelId: int("modelId").notNull(),
    identitySnapshotId: varchar("identitySnapshotId", { length: 36 }).notNull(),
    featureId: varchar("featureId", { length: 36 }).notNull(),
    featureVersionId: varchar("featureVersionId", { length: 36 }).notNull(),
    selectionReason: mysqlEnum(
      "selectionReason",
      IDENTITY_FEATURE_SELECTION_REASONS,
    ).notNull(),
    sourceSelectionId: varchar("sourceSelectionId", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ([
    uniqueIndex("uq_snapshot_feature_selections_snapshot_feature").on(
      table.identitySnapshotId,
      table.featureId,
    ),
    uniqueIndex("uq_snapshot_feature_selections_snapshot_version").on(
      table.identitySnapshotId,
      table.featureVersionId,
    ),
    index("idx_snapshot_feature_selections_model").on(table.modelId),
    index("idx_snapshot_feature_selections_snapshot").on(table.identitySnapshotId),
    index("idx_snapshot_feature_selections_version").on(table.featureVersionId),
  ]),
);

export type ModelSnapshotFeatureSelection =
  typeof modelSnapshotFeatureSelections.$inferSelect;
export type InsertModelSnapshotFeatureSelection =
  typeof modelSnapshotFeatureSelections.$inferInsert;


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
  index("idx_board_items_source_model").on(table.sourceModelId),
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

/* ==========================================================================
   CASTING V2 — the roll domain (plan §G, migration 0017)

   The pre-Sign world: a resumable sheet, immutable rolls of eight, and the
   candidates a user keeps or discards. Deliberately NOT built on the existing
   model/evidence tables — evidence is owned identity truth, whereas candidates
   are exploratory, expiring and non-authoritative. Reusing those tables would
   have made "delete every candidate after 7 idle days" a dangerous statement
   to write.

   Convention: every "→" below is a LOGICAL foreign key — an indexed plain
   column plus an application join. This repo contains zero engine-level
   foreign keys, and adding them here would fight `db:push`, the D-64 purge
   ordering and the append-only migration journal.

   A durable Cast record exists only at Sign (M7). Nothing here is identity
   authority.
   ========================================================================== */

export const CASTING_SESSION_STATUSES = ["open", "abandoned", "expired"] as const;
export type CastingSessionStatus = typeof CASTING_SESSION_STATUSES[number];

export const CASTING_SESSION_ORIGINS = ["roster", "canvas", "wardrobe"] as const;
export type CastingSessionOrigin = typeof CASTING_SESSION_ORIGINS[number];

export const CASTING_ROLL_STATUSES = [
  "pending",
  "generating",
  "complete",
  "partial",
  "failed",
  "cancelled",
] as const;
export type CastingRollStatus = typeof CASTING_ROLL_STATUSES[number];

export const CASTING_CANDIDATE_STATUSES = [
  "queued",
  "dispatched",
  "ready",
  "failed",
  "discarded",
  "signed",
  "cancelled",
  "expired",
] as const;
export type CastingCandidateStatus = typeof CASTING_CANDIDATE_STATUSES[number];

/**
 * The two meanings of `expired`, told apart at last.
 *
 * `cancelled_unseen` — dispatched before a cancel, landed after it, never shown
 * to anyone. Refunded under the late-landing generosity ruling.
 * `retention` — the 7-day sweep aged it out. The user received this candidate
 * and looked at it; refunding it would undo work that was genuinely delivered.
 */
export const CASTING_EXPIRED_REASONS = ["cancelled_unseen", "retention"] as const;
export type CastingExpiredReason = typeof CASTING_EXPIRED_REASONS[number];

/**
 * The resumable unsigned sheet.
 *
 * A session stays `open` after a Sign — multiple Signs are legal, each its own
 * ceremony, and the tray keeps the rest. There is no user-facing "close":
 * navigation never destroys work. The other states are reached only by expiry.
 */
export const castingSessions = mysqlTable("casting_sessions", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // →users; the ownership predicate on every statement
  originType: mysqlEnum("originType", CASTING_SESSION_ORIGINS).default("roster").notNull(),
  // Server-owned canvas return destination, verified against board ownership
  // in the same statement that creates the session.
  originBoardId: int("originBoardId"),
  originItemId: int("originItemId"),
  activeRollId: int("activeRollId"),
  status: mysqlEnum("status", CASTING_SESSION_STATUSES).default("open").notNull(),
  signedCastCount: int("signedCastCount").default(0).notNull(),
  parentCastId: int("parentCastId"), // fork-from-room lineage →models
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().onUpdateNow().notNull(),
  // Slides with activity; 7 idle days (§G.6). The bulk purge reads this.
  expiresAt: timestamp("expiresAt"),
}, (table) => ([
  uniqueIndex("uq_casting_sessions_public").on(table.publicId),
  index("idx_casting_sessions_user_status").on(table.userId, table.status),
  index("idx_casting_sessions_expires").on(table.expiresAt),
]));

export type CastingSession = typeof castingSessions.$inferSelect;
export type InsertCastingSession = typeof castingSessions.$inferInsert;

/**
 * An immutable version. Rolls are never edited after a terminal state — a
 * changed mind produces a new roll, which is what makes roll history navigable.
 */
export const castingRolls = mysqlTable("casting_rolls", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  sessionId: int("sessionId").notNull(), // →casting_sessions
  userId: int("userId").notNull(), // denormalized so child writes prove ownership without a join
  // Allocated under SELECT … FOR UPDATE on the session row, so two tabs get
  // sequential indexes instead of a duplicate-key failure after the charge.
  rollIndex: int("rollIndex").notNull(),
  briefText: text("briefText").notNull(), // the user's own sentence
  compiledBrief: json("compiledBrief"), // INTERNAL — never projected
  cohortKey: varchar("cohortKey", { length: 48 }),
  styleKey: varchar("styleKey", { length: 48 }),
  // Sub-style descriptors for stylized cohorts (style-profile law, 2026-07-30).
  // Internal; surfaced only as a removable chip.
  styleProfile: json("styleProfile"),
  lockContract: json("lockContract"),
  // Follow lineage. The parent candidate is resolved through
  // casting_candidates.userId = ctx.user.id in the same insert-select, so a
  // client-supplied id can never reference a foreign candidate.
  parentRollId: int("parentRollId"),
  parentCandidateId: int("parentCandidateId"),
  /**
   * WHICH refinement of the parent this family descends from (D-123).
   *
   * NULL means the parent's original face, which is every roll written before
   * M8. Stamped in the same insert-select that re-anchors the parent candidate
   * to `ctx.user.id`, so a client-supplied id can never name a foreign variant.
   *
   * Recorded from day one because lineage is cheap to write while the row is
   * being created and painful to backfill once rolls exist without it — the
   * derivation would have to guess which variant was selected at the time.
   */
  parentVariantId: int("parentVariantId"),
  status: mysqlEnum("status", CASTING_ROLL_STATUSES).default("pending").notNull(),
  // = 8 × perCandidateCredits. Integer by construction: the ledger is
  // integer-only and refund slices come from each candidate's own row.
  priceCredits: int("priceCredits").default(0).notNull(),
  operationId: varchar("operationId", { length: 36 }).notNull(), // →generation_operations
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_casting_rolls_public").on(table.publicId),
  // Idempotency: a replayed claim returns the existing roll rather than
  // creating a second one for the same operation.
  uniqueIndex("uq_casting_rolls_operation").on(table.operationId),
  uniqueIndex("uq_casting_rolls_session_index").on(table.sessionId, table.rollIndex),
]));

export type CastingRoll = typeof castingRolls.$inferSelect;
export type InsertCastingRoll = typeof castingRolls.$inferInsert;

/**
 * One of eight. Every status transition is a CAS predicate, never a
 * read-modify-write, so two tabs cannot both win.
 */
export const castingCandidates = mysqlTable("casting_candidates", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  rollId: int("rollId").notNull(), // →casting_rolls
  sessionId: int("sessionId").notNull(), // denormalized — the tray query is session-scoped
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  position: int("position").notNull(), // display only; never keys a transition
  status: mysqlEnum("status", CASTING_CANDIDATE_STATUSES).default("queued").notNull(),
  // The integer per-candidate slice. Refund authority reads it from the row
  // rather than deriving a fraction of the roll price.
  pointsCost: int("pointsCost").default(0).notNull(),
  imageKey: varchar("imageKey", { length: 512 }),
  thumbKey: varchar("thumbKey", { length: 512 }),
  // INTERNAL provenance (D-12). Never projected.
  provider: varchar("provider", { length: 32 }),
  providerModel: varchar("providerModel", { length: 96 }),
  providerRef: varchar("providerRef", { length: 96 }),
  personaLine: varchar("personaLine", { length: 160 }),
  internalPrompt: json("internalPrompt"), // INTERNAL — the compiled instruction
  keptAt: timestamp("keptAt"),
  discardedAt: timestamp("discardedAt"),
  attemptCount: int("attemptCount").default(0).notNull(),
  failureClass: varchar("failureClass", { length: 24 }),
  // Set only by the Sign CAS (M7). The unique index is a backstop preventing
  // two candidates claiming one Cast; the CAS is the double-Sign defence.
  signedCastId: int("signedCastId"),
  /**
   * Which refinement of this face is the one — NULL means the original (M8).
   *
   * **A pointer, not a `selected` flag on the variant rows, and the reason is
   * mechanical rather than stylistic.** MySQL has no partial unique index, so
   * "exactly one variant selected" enforced by flag is two UPDATEs racing and
   * a state where zero or two are selected is reachable. A pointer holds one
   * value by construction; there is no state to get out of step.
   *
   * Everything that reads a candidate's FACE reads through this — Sign,
   * Follow, the tile projection, the echo. Reading the candidate's own
   * `imageKey` while a variant is selected is the record-lies class: Sign would
   * snapshot the original's identity documents under the variant's face.
   */
  selectedVariantId: int("selectedVariantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /**
   * Stamped on discard, not at insert. A candidate's expiry is unknowable when
   * it is created — it depends on whether the user discards it, and on when
   * the next roll makes that discard un-undoable (§G.6). Everything else
   * purges with its session.
   */
  expiresAt: timestamp("expiresAt"),
  /**
   * WHY this candidate expired — migration 0018, and it closes a real money
   * window rather than tidying a taxonomy.
   *
   * `expired` means two different things. A candidate that was already
   * dispatched when the roll was cancelled lands unseen and is refunded under
   * the generosity ruling; a candidate the 7-day retention sweep ages out was
   * delivered and looked at for a week, and must never be refunded. Because the
   * status could not tell them apart, the refund had to happen inline at the
   * landing site and the recovery sweep had to keep its hands off entirely —
   * which left a crash between the landing CAS and the refund as a slice nobody
   * ever pays back.
   *
   * Written in the SAME statement as the status at both write sites, so the
   * reason can never disagree with the fact. Deliberately records the REASON
   * rather than whether a refund happened: "was it refunded" already has an
   * authority — the ledger's unique reference index — and a second copy of that
   * fact would be a copy that can be wrong.
   *
   * NULL means a row written before 0018. The sweep leaves those alone, which
   * is the fail-closed direction: it declines to refund rather than risking a
   * double refund on data whose meaning it cannot recover.
   */
  expiredReason: mysqlEnum("expiredReason", CASTING_EXPIRED_REASONS),
}, (table) => ([
  uniqueIndex("uq_casting_candidates_public").on(table.publicId),
  uniqueIndex("uq_casting_candidates_roll_position").on(table.rollId, table.position),
  // Backstop only — see signedCastId above. Sparse: MySQL permits many NULLs.
  uniqueIndex("uq_casting_candidates_signed_cast").on(table.signedCastId),
  index("idx_casting_candidates_roll").on(table.rollId),
  index("idx_casting_candidates_tray").on(table.sessionId, table.keptAt),
  index("idx_casting_candidates_expires").on(table.expiresAt),
]));

export type CastingCandidate = typeof castingCandidates.$inferSelect;
export type InsertCastingCandidate = typeof castingCandidates.$inferInsert;

/**
 * What a user did with a refinement (D-151a).
 *
 * `selected` — kept as the face. `backed_up` — abandoned by choosing an earlier
 * version. `rephrased` — followed immediately by another instruction on the
 * SAME facet, which is the signal that the words did not land. `corrected` —
 * followed by an instruction naming the reading they actually meant.
 *
 * Rephrased and corrected are the two that matter most: they are the product
 * telling us a term is resistant or mis-owned, in the user's own behaviour
 * rather than in a survey.
 */
export const CASTING_VARIANT_OUTCOMES = [
  "selected",
  "backed_up",
  "rephrased",
  "corrected",
] as const;
export type CastingVariantOutcome = typeof CASTING_VARIANT_OUTCOMES[number];

export const CASTING_VARIANT_STATUSES = [
  "queued",
  "dispatched",
  "ready",
  "failed",
  "expired",
] as const;
export type CastingVariantStatus = typeof CASTING_VARIANT_STATUSES[number];

/**
 * One refinement of one candidate — the Refine surface's record (M8, §14).
 *
 * **Append-only.** A variant is never edited; a changed mind produces another
 * variant, which is what makes the stack navigable and what makes "back up to
 * the previous one" free selection rather than a paid re-render (D-121).
 *
 * **Every variant is one edit of the ORIGINAL, never an edit of an edit.** The
 * whole instruction list is re-composed against the candidate's own resolved
 * identity and rendered from the candidate's own image, so there is no chain
 * for error to compound along: the tenth variant is exactly as close to the
 * signed face as the first. `instructions` is denormalized per row for the same
 * reason — the row says what it IS, without walking a parent chain to find out.
 *
 * **`userId`, `candidateId` and `sessionId` are denormalized** exactly as
 * `casting_candidates` denormalizes them, and for the same reason: a variant is
 * a child of a child, and every read or write must be able to prove ownership
 * in the single statement that does the work rather than in a SELECT before it.
 */
export const castingCandidateVariants = mysqlTable("casting_candidate_variants", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  candidateId: int("candidateId").notNull(), // →casting_candidates
  sessionId: int("sessionId").notNull(), // denormalized — retention is session-scoped
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  status: mysqlEnum("status", CASTING_VARIANT_STATUSES).default("queued").notNull(),
  /**
   * THE FACE THIS EDIT WAS MADE FROM — the version-jumping tree, made explicit.
   *
   * NULL means it was made from the candidate itself, which is the first edit
   * of any branch. Anything else names the variant that was SELECTED when this
   * one was asked for, and that is the founder's own semantics: *"if you go
   * back to a previous edit, the layers are only what that currently selected
   * image holds — you can fork-edit from any previous edit."*
   *
   * # Why a column rather than a derivation
   *
   * Refinement history is a TREE, and until now the only ancestry in this row
   * was `instructions`, the accumulated recipe. Reconstructing the tree by
   * prefix-matching recipes would be a second implementation of the chain
   * matcher — law 4's own failure mode — and it would be wrong the moment a
   * re-ask REWRITES a facet's step instead of appending one.
   *
   * The segment store is what forced it: the set of kept pieces a render
   * carries has one answer per BRANCH, and a single global "currently live"
   * flag cannot hold more than one answer. A fork from B was carrying D's
   * glasses (fable-091).
   *
   * This changes nothing about base-anchoring. Every variant is still
   * `edit(the ORIGINAL, instructions 1..N)` — see `claimVariant` — and this
   * column records which face the user was LOOKING AT, never which image was
   * fed to the painter.
   */
  parentVariantId: int("parentVariantId"), // →casting_candidate_variants, NULL = from the candidate
  /**
   * The user's OWN sentences, in order, oldest first.
   *
   * Provenance and the only refinement text a projection may return. The
   * parsed deltas are the thing the prompt is built from; this is what the
   * person actually typed, kept so the stack can be read back in their words.
   */
  instructions: json("instructions").notNull(),
  /**
   * The composed absolute deltas — INTERNAL, never projected (§10).
   *
   * Parsed once at entry, never re-interpreted at render, so a re-render is
   * deterministic and removing an instruction is arithmetic.
   */
  deltas: json("deltas"),
  /**
   * Each instruction's OWN delta, in order — INTERNAL (D-163).
   *
   * Index i lines up with `instructions[i]`, denormalized per row for the same
   * reason the instruction list is: every row stays self-describing, so removal
   * is local arithmetic rather than a walk back through ancestor rows.
   *
   * **The composed delta cannot be un-composed.** "Removing an instruction is
   * arithmetic" has been promised in the comment above since this table was
   * written, and was never implementable without this column: recovering a
   * step's delta by diffing a row against its predecessor is inexact, because a
   * step that restates a value the chain already holds diffs to nothing and
   * would vanish silently.
   *
   * NULL on rows written before typed removal existed. Those refuse rather than
   * approximate — an honest "not on this one" beats a reconstruction that is
   * right most of the time.
   */
  stepDeltas: json("stepDeltas"),
  /**
   * What the user actually TYPED to produce this variant (D-163).
   *
   * For an edit it is the last entry of `instructions`. For a REMOVAL the two
   * differ and the difference matters: removal is memory surgery, so the
   * removal sentence is deliberately absent from the recipe — which left the
   * in-flight ghost chip (D-161) reading `instructions.at(-1)` and showing the
   * last SURVIVING sentence while the user waited on "remove the earrings".
   * A pending row that names someone else's instruction is the lost-contact
   * defect wearing a new hat.
   *
   * NULL on rows written before this column; the projection falls back to the
   * instruction list, which was correct for every one of them.
   */
  requestText: varchar("requestText", { length: 220 }),
  // INTERNAL — the composed instruction and the FULL resolved identity of this
  // variant. Sign reads its identity documents from here when it is selected,
  // which is why it must be written from the same deltas the prompt was.
  internalPrompt: json("internalPrompt"),
  imageKey: varchar("imageKey", { length: 512 }),
  thumbKey: varchar("thumbKey", { length: 512 }),
  // INTERNAL provenance (D-12). Never projected.
  provider: varchar("provider", { length: 32 }),
  providerModel: varchar("providerModel", { length: 96 }),
  providerRef: varchar("providerRef", { length: 96 }),
  pointsCost: int("pointsCost").default(0).notNull(),
  failureClass: varchar("failureClass", { length: 24 }),
  operationId: varchar("operationId", { length: 36 }).notNull(), // →generation_operations
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /**
   * Ordinary candidate retention, ruled rather than assumed (D-122).
   *
   * Sign copies its own anchor, so a Cast depends on nothing in this table — a
   * signed candidate's unselected variants are ordinary sheet debris and age
   * out on the ordinary schedule. No second retention path to keep in step.
   */
  expiresAt: timestamp("expiresAt"),
  /**
   * What became of this refinement — the satisfaction ledger (D-151a).
   *
   * Written as the user acts rather than derived later, because **a signal not
   * collected is lost forever** and the dogfood era is the richest labelling
   * this product will ever get. Which variant was selected at a given moment is
   * genuinely unrecoverable after the fact; the rest is derivable, and is
   * derived rather than duplicated.
   *
   * NULL means nothing has happened to it yet, which is the honest state for a
   * refinement the user has not responded to.
   */
  outcome: mysqlEnum("outcome", CASTING_VARIANT_OUTCOMES),
  outcomeAt: timestamp("outcomeAt"),
}, (table) => ([
  uniqueIndex("uq_casting_variants_public").on(table.publicId),
  // Idempotency: a replayed refine returns the existing variant rather than
  // buying a second one — the roll's clientRequestId gate, one image wide.
  uniqueIndex("uq_casting_variants_operation").on(table.operationId),
  index("idx_casting_variants_candidate").on(table.candidateId),
  index("idx_casting_variants_expires").on(table.expiresAt),
]));

export type CastingCandidateVariant = typeof castingCandidateVariants.$inferSelect;
export type InsertCastingCandidateVariant = typeof castingCandidateVariants.$inferInsert;

/**
 * WHERE A SEGMENT CAME FROM — and it is the load-bearing column of this table.
 *
 * `edit_patch` — pixels an edit ADDED and the user kept. The compositor pastes
 * these back on later renders, which is what makes a delivered facet permanent
 * instead of a dice roll re-rolled on every subsequent paint.
 *
 * `detected_born` — a thing the picture says she already has: glasses from her
 * brief, a tattoo the roll gave her, her own earrings. Catalogued at cast time
 * so the product can NAME what is on her face, and for three hard reasons it is
 * not the same kind of row as a patch:
 *
 * 1. **A detected segment is a FACT, never a delivery.** It has no promise
 *    behind it and no verdict, so it never enters a delivery denominator and is
 *    never "compliant". The picture is the record of what she was born with.
 * 2. **It has no pixels to re-composite** — it already lives in the master, so
 *    the compositor never pastes it. Its mask and crop are for reference and
 *    for the face chart's UI.
 * 3. **Removing one is still a real render.** Born-versus-added is the whole
 *    distinction: dropping a patch is arithmetic, but taking off glasses she
 *    was born wearing means inventing the skin behind them, and that is the
 *    departed/vacancy machinery, untouched.
 */
export const CASTING_SEGMENT_PROVENANCES = ["edit_patch", "detected_born"] as const;
export type CastingSegmentProvenance = typeof CASTING_SEGMENT_PROVENANCES[number];

/**
 * One named region of one face — the unified segment store (segment
 * permanence, slice 1; the founder's "build the whole system together").
 *
 * **Why one table for patches and born-worn things.** They are the same object
 * seen from two ends: a named, masked region of her face, in the stylist's
 * vocabulary, with its own history and its own "remove this". The face chart
 * (M12) reads exactly this list, and a chart that could only show the things
 * she had been edited into would be a chart of our engineering rather than of
 * her face. One store, one provenance column, one retention regime.
 *
 * **`userId` and `candidateId` are denormalized** for the same reason
 * `casting_candidate_variants` denormalizes them: every read and write proves
 * ownership inside the single statement that does the work (invariant 1),
 * never in a SELECT before it.
 *
 * **No `sessionId` and no `expiresAt`, deliberately.** A segment's lifetime is
 * its candidate's, and it is purged by the candidate sweep inside the same
 * transaction and on the same cleanup manifest as the candidate's own objects
 * (§3 of the design). Two schedules for one lifetime is two things to keep in
 * step, and the one that falls behind leaves paid pictures of a person at
 * public URLs after the sheet they belonged to is gone.
 */
export const castingSegments = mysqlTable("casting_segments", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  candidateId: int("candidateId").notNull(), // →casting_candidates
  /**
   * The variant that delivered these pixels — the provenance of a patch.
   *
   * NULL on `detected_born` rows, and the NULL is meaningful rather than
   * missing data: nothing delivered them, they were found on the master.
   */
  variantId: int("variantId"), // →casting_candidate_variants
  provenance: mysqlEnum("provenance", CASTING_SEGMENT_PROVENANCES).notNull(),
  /**
   * What this segment IS, in the product's own vocabulary — a `Facet` id for a
   * patch (`marks`, `hair.colour`), a worn class for a detected thing
   * (`glasses`, `earrings`). This is the key the compositor, the undo and the
   * face chart all read, so it is the user's ontology and not a mask id.
   */
  facet: varchar("facet", { length: 48 }).notNull(),
  /**
   * The segmentation question that drew this region (`face skin`, `eyes`).
   *
   * Part of the identity of a segment, not decoration: one face can wear two
   * tattoos, and a catalogue keyed on class alone would fold them into one row
   * on every re-scan. Detectors improve, so the scan must be re-runnable, and
   * re-runnable means the key has to name the thing precisely enough that an
   * upsert lands on the right row.
   */
  region: varchar("region", { length: 48 }).notNull(),
  /**
   * §7 of the design: per-segment history falls out of this column.
   *
   * "Make the freckles heavier" retires its predecessor and writes version 2 —
   * one facet, one live segment, newest version wins. The old version stays
   * readable, because a segment is evidence of a delivered render.
   */
  version: int("version").default(1).notNull(),
  /** R2 objects: one single-channel mask, one cropped RGB. Public bucket. */
  maskKey: varchar("maskKey", { length: 512 }).notNull(),
  contentKey: varchar("contentKey", { length: 512 }).notNull(),
  /** So a paste does not decode a full frame to find its region. */
  bboxX: int("bboxX").notNull(),
  bboxY: int("bboxY").notNull(),
  bboxW: int("bboxW").notNull(),
  bboxH: int("bboxH").notNull(),
  /**
   * The dimensions of the frame this was cut from.
   *
   * A mask and a crop are only meaningful against a frame of the same size, and
   * a paste onto a differently-sized frame does not fail — it silently lands in
   * the wrong place, which is the worst failure this store could have. Recorded
   * so the compositor can refuse rather than misplace her freckles.
   */
  frameWidth: int("frameWidth").notNull(),
  frameHeight: int("frameHeight").notNull(),
  /**
   * The reading that earned these pixels — §6. A pasted patch needs no
   * re-verification because it IS the verified pixels, and this records by what.
   *
   * Always NULL on `detected_born`: a fact about her face has no verdict,
   * because nothing promised it.
   */
  verifiedAt: timestamp("verifiedAt"),
  verdict: varchar("verdict", { length: 24 }),
  /**
   * Which detector catalogued this, for `detected_born` rows — INTERNAL
   * provenance, never projected, like `provider` on the other casting tables.
   * Detectors improve; a row that cannot say which one found it cannot be
   * re-earned by a better one.
   */
  detector: varchar("detector", { length: 64 }),
  /**
   * Out of the composite, but NOT out of storage — the one deliberate
   * asymmetry (§3). An undo drops the segment; the bytes survive so redo can
   * exist. Her account-level deletion still removes everything, because that
   * runs on the candidate.
   */
  retiredAt: timestamp("retiredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_casting_segments_public").on(table.publicId),
  /*
    Identity, and idempotency for free.

    A replayed harvest lands on the row it already wrote rather than buying a
    second copy of the same pixels, and the born-worn scan's re-run is an
    ordinary upsert. Every column here is NOT NULL, because MySQL lets NULLs
    repeat inside a unique index and a key that can quietly hold duplicates is
    not a key.
  */
  /*
    Its counterpart is `casting_cast_segments`, and the two are SEPARATE ON
    PURPOSE — see that table's own note. In one line: this key is keyed on the
    candidate, the other on the Cast, and neither may be widened to cover both
    because a shared key would have to admit NULLs and MySQL lets NULLs repeat.
  */
  uniqueIndex("uq_casting_segments_identity").on(
    table.candidateId,
    table.facet,
    table.region,
    table.version,
  ),
  index("idx_casting_segments_candidate").on(table.candidateId),
  index("idx_casting_segments_variant").on(table.variantId),
]));

export type CastingSegment = typeof castingSegments.$inferSelect;
export type InsertCastingSegment = typeof castingSegments.$inferInsert;

/**
 * What a signed Cast KEEPS — the promoted segment set (fable-092).
 *
 * Sign copies and never invents, and this table is that law at the row level.
 * At Sign, the signed variant's whole lineage-derived set is copied here and
 * its objects are re-manifested onto the Cast's own lifetime, so the face chart
 * on the object she actually keeps does not go empty a week later when the
 * candidate purges.
 *
 * # Why this is a SECOND TABLE and not a `castId` column on `casting_segments`
 *
 * Ruled fable-101 on two artifacts, and recorded here because the next reader's
 * first instinct will be to unify them:
 *
 * 1. **A nullable `castId`/`candidateId` pair kills the identity key.**
 *    `uq_casting_segments_identity` is `(candidateId, facet, region, version)`
 *    and every column in it is NOT NULL precisely because MySQL lets NULLs
 *    repeat inside a unique index. A promoted row with `candidateId NULL` is
 *    outside that key's reach — and promotion is re-run by the Sign adjudicator
 *    when a lease lapses, so that is an idempotency hole on the one path that
 *    replays by design.
 * 2. **A non-null sentinel puts promoted rows inside the candidate purge.**
 *    `listPurgeableSegmentsIn` matches on `candidateId` alone and its breadth
 *    is deliberate. A promoted row sharing the candidate's id would be deleted,
 *    with its objects, seven days after Sign — which is the exact permanence
 *    expiry this promotion exists to prevent, reintroduced as a forgotten
 *    `WHERE`.
 *
 * Two lifetimes, two owners, two tables — the row-level form of fable-093's
 * "never share a key with a thing that is going to be deleted". The candidate's
 * sweep structurally cannot reach this table; this table is deleted by the
 * Cast's own deletion, in that transaction, with its objects on that manifest.
 *
 * # No `retiredAt`, deliberately
 *
 * A Cast's segment set is **immutable except through an M12-style ceremony**
 * (fable-092 §4): what she signed is what persists, and post-Sign refinement
 * happens on candidates and variants. `retiredAt` on the candidate-side table
 * serves the undo and the storage lifecycle; neither exists here, and a column
 * that can only ever be NULL is an invitation to invent a meaning for it.
 */
export const castingCastSegments = mysqlTable("casting_cast_segments", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  castId: int("castId").notNull(), // →models.id, the signed Cast
  /**
   * The candidate-side row these pixels were copied from, for provenance only.
   *
   * Nullable and never joined to: the source row purges on the candidate's own
   * schedule, so a NULL here means "her candidate is gone", which is the normal
   * end state rather than missing data. Nothing about the Cast's set depends on
   * it — the bytes are the Cast's own copies.
   */
  sourceSegmentId: int("sourceSegmentId"),
  provenance: mysqlEnum("provenance", CASTING_SEGMENT_PROVENANCES).notNull(),
  /** The stylist's word for what this is — see `casting_segments.facet`. */
  facet: varchar("facet", { length: 48 }).notNull(),
  /** The segmentation question that drew it — see `casting_segments.region`. */
  region: varchar("region", { length: 48 }).notNull(),
  /**
   * Which version of that facet she signed.
   *
   * The lineage walk resolves supersession at promotion time, so exactly one
   * version per facet is ever promoted; this records WHICH, because "the
   * freckles she signed" is version 2 of that facet and the record should say
   * so rather than flattening her history to 1.
   */
  version: int("version").default(1).notNull(),
  /** The Cast's OWN objects — copied bytes, never the candidate's keys. */
  maskKey: varchar("maskKey", { length: 512 }).notNull(),
  contentKey: varchar("contentKey", { length: 512 }).notNull(),
  bboxX: int("bboxX").notNull(),
  bboxY: int("bboxY").notNull(),
  bboxW: int("bboxW").notNull(),
  bboxH: int("bboxH").notNull(),
  frameWidth: int("frameWidth").notNull(),
  frameHeight: int("frameHeight").notNull(),
  /** The reading that earned these pixels, carried across unchanged. */
  verifiedAt: timestamp("verifiedAt"),
  verdict: varchar("verdict", { length: 24 }),
  /** Which detector catalogued a `detected_born` row. Internal, never projected. */
  detector: varchar("detector", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_casting_cast_segments_public").on(table.publicId),
  /*
    Identity, and promotion idempotency for free.

    Every column is NOT NULL — the same requirement as
    `uq_casting_segments_identity`, and the reason these are two keys on two
    tables rather than one key on one: a shared key would need a nullable owner
    column, and a nullable column inside a unique index enforces nothing.

    A re-run of the promotion (the Sign adjudicator finishing a lapsed lease)
    lands on the rows it already wrote instead of buying a second copy of her
    face.
  */
  uniqueIndex("uq_casting_cast_segments_identity").on(
    table.castId,
    table.facet,
    table.region,
    table.version,
  ),
  index("idx_casting_cast_segments_cast").on(table.castId),
]));

export type CastingCastSegment = typeof castingCastSegments.$inferSelect;
export type InsertCastingCastSegment = typeof castingCastSegments.$inferInsert;

/**
 * Which IMAGE a library row's key holds — and `vacancy`, which holds none.
 *
 * See {@link castingReferenceLibrary}. The third value (migration 0030) is the
 * library learning to hold an ABSENCE: a slot she has taken something OFF, with
 * words and no crop. Every reader on the recipe path filters `carry` or merges
 * by role, so a vacancy is invisible to all of them until the code that reads it
 * lands — which is what makes the migration and the rows dark by construction.
 */
export const CASTING_REFERENCE_ROLES = ["anchor", "carry", "vacancy"] as const;
export type CastingReferenceRole = typeof CASTING_REFERENCE_ROLES[number];

/** Which carrier the tier boundary gives a feature (§3.0a, fable-192). */
export const CASTING_REFERENCE_TIERS = ["item", "anatomy", "surface"] as const;
export type CastingReferenceTier = typeof CASTING_REFERENCE_TIERS[number];

/**
 * THE REFERENCE LIBRARY — what a face's features ARE, ready for the painter
 * (COMPOSITOR_SWAP_DESIGN §2, ruled fable-196; migration 0028).
 *
 * One row is the state of ONE feature slot as of ONE render, plus the image
 * that render froze (`anchor`) or minted (`carry`) for it. The recipe assembler
 * reads a whole library and emits a prompt from it; nothing else keeps a copy.
 *
 * # It is keyed by the PANEL'S slots, never the ledger's
 *
 * `casting_segments` is keyed `facet@region` — *which instruction wrote these
 * pixels*. This is keyed `lips`, `eye@left`, `earring@right` — *what is this a
 * picture of*. They look alike and they are not, and the ledger's own drift is
 * the proof: "add nude lip gloss" filed itself at `makeup@face skin` on one
 * render and `makeup@lips` on the next. The segment store stays the undo store;
 * different facts, different keys, so this is not a second list of it.
 *
 * # Rows are immutable; the live library is DERIVED
 *
 * Refinement is a tree, and a mutable one-row-per-slot library would hold one
 * answer for a candidate that has many — the mistake that had a fork from B
 * carrying D's glasses (fable-091). Each row names the variant that minted it,
 * and a branch's library is the newest version per (slot, role) along that
 * variant's own ancestry. A retired newest means *gone from this branch*, and a
 * fork taken before the removal still finds its own newest live.
 *
 * `variantId` NULL means the row was minted from the candidate's MASTER — born
 * anatomy, or an item introduced before any edit landed — so it belongs to
 * every branch.
 *
 * # `storageKey` NULL is the tier boundary, not missing data
 *
 * A SURFACE is carried by words and never by a crop (§3.0a), so its rows hold a
 * word stack and no image, always. An anatomy slot with accumulated words that
 * nothing has delivered yet is the other legal NULL. Every other combination is
 * refused at the write.
 */
export const castingReferenceLibrary = mysqlTable("casting_reference_library", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  candidateId: int("candidateId").notNull(), // →casting_candidates
  /**
   * The render that minted this row — provenance, and the branch it belongs to.
   *
   * NULL is meaningful rather than missing: minted from the candidate's own
   * master, so every branch of the tree inherits it.
   */
  variantId: int("variantId"), // →casting_candidate_variants, NULL = from the master
  role: mysqlEnum("role", CASTING_REFERENCE_ROLES).notNull(),
  /** The panel's slot key: `lips`, `hair`, `eye@left`, `earring@right`. */
  slot: varchar("slot", { length: 64 }).notNull(),
  tier: mysqlEnum("tier", CASTING_REFERENCE_TIERS).notNull(),
  /** How the slot is SPOKEN about — bare and plain: `lips`, `left earring`. */
  noun: varchar("noun", { length: 64 }).notNull(),
  /**
   * The full declarative stack for this slot, oldest first — everything ever
   * accepted about the feature, which is what D-244 line 2 regenerates from.
   *
   * Not a copy of `casting_candidate_variants.instructions`: those are the
   * user's own sentences in the ledger's key space; this is declarative state
   * in the panel's.
   */
  words: json("words").notNull(),
  /** The RECTANGULAR crop, or the frozen reference. NULL only where the tier
   *  allows — see above. This is what a recipe sends (§5.1). */
  storageKey: varchar("storageKey", { length: 512 }),
  /** The single-channel mask that makes the crop a CUTOUT for the panel, and the
   *  only artifact that could re-measure its coverage. Absent on an uploaded
   *  anchor, which is not a cut. */
  maskKey: varchar("maskKey", { length: 512 }),
  /** sha256 of the object's bytes: the byte-identity refusal (§2.4) and the
   *  carry-stability proof both read this rather than re-fetching pixels. */
  digest: varchar("digest", { length: 64 }),
  bboxX: int("bboxX"),
  bboxY: int("bboxY"),
  bboxW: int("bboxW"),
  bboxH: int("bboxH"),
  frameWidth: int("frameWidth"),
  frameHeight: int("frameHeight"),
  /**
   * What the completeness guard READ when this crop was minted (§2.4), in basis
   * points of the region — evidence, never a gate at read time. A crop that
   * failed the guard was refused loudly and never stored, and under D-246 no
   * subtle reading may refuse a render after the fact.
   */
  guardKind: varchar("guardKind", { length: 48 }),
  guardCoverage: int("guardCoverage"),
  guardSpill: int("guardSpill"),
  guardThreshold: int("guardThreshold"),
  /**
   * THE CROP THE GUARD TURNED AWAY (migration 0029, fable-214/215).
   *
   * A `noSpecimen` refusal is the one refusal that exists in order to produce
   * the specimen — the kind has no measured positive, so no number here is
   * earned, so the guard refuses and a human must look at the pixels to say
   * what complete means for it. These columns are those pixels and that
   * reading.
   *
   * **Nothing on the recipe path reads them, and that is the design.** The keys
   * are deliberately not `storageKey`/`maskKey`: those are what make a crop ride
   * into the next render's prompt, and an unverified picture must be openable by
   * a human and invisible to the assembler. Structural, not remembered.
   *
   * `refusedKind` is the specimen family the number belongs to — `hair`,
   * `earring` — which is not the slot (`earring@left`) and is not derivable from
   * it without the catalogue. A coverage adopted under the wrong family is the
   * wrong-boundary class. `guardKind` cannot carry it: that one records what was
   * read when a crop was MINTED, and a refusal minted nothing.
   *
   * The write helper enforces the shape MySQL cannot: both keys or neither,
   * keys only on `noSpecimen`, never beside a `storageKey`, `carry` role only.
   */
  refusedContentKey: varchar("refusedContentKey", { length: 512 }),
  refusedMaskKey: varchar("refusedMaskKey", { length: 512 }),
  /** One of `referenceCompleteness.ts`'s five reasons. Text rather than an enum
   *  so a new reason is a deploy and not a database ceremony. */
  refusedReason: varchar("refusedReason", { length: 32 }),
  refusedKind: varchar("refusedKind", { length: 48 }),
  /** Basis points of the region, like {@link guardCoverage}. Absent when the
   *  refusal recorded no reading at all (`readDidNotSettle`). */
  refusedCoverage: int("refusedCoverage"),
  /**
   * Where the kept crop sat on the frame it was cut from.
   *
   * Its stored mask is CROP-LOCAL (`encodeCut` writes the cut's own box), so
   * without these the pixels can be looked at and never placed — and the
   * demonstration this column group exists for is her hoop drawn on her own
   * face. Same rule as a delivered crop's geometry, on the same reasoning: a
   * crop means nothing except against the frame it came from.
   */
  refusedBboxX: int("refusedBboxX"),
  refusedBboxY: int("refusedBboxY"),
  refusedBboxW: int("refusedBboxW"),
  refusedBboxH: int("refusedBboxH"),
  refusedFrameWidth: int("refusedFrameWidth"),
  refusedFrameHeight: int("refusedFrameHeight"),
  version: int("version").default(1).notNull(),
  /** A fact about a VERSION, not about a slot: this branch's newest word on the
   *  slot is "gone". Other branches keep theirs. */
  retiredAt: timestamp("retiredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uq_casting_reference_library_public").on(table.publicId),
  /*
    Identity. `variantId` is deliberately NOT in it: MySQL lets NULLs repeat
    inside a unique index, so a key that a master-minted row sits outside of is
    not a key at all — the same reasoning that made `casting_cast_segments` a
    second table rather than a nullable column on `casting_segments`.
  */
  uniqueIndex("uq_casting_reference_library_identity").on(
    table.candidateId,
    table.slot,
    table.role,
    table.version,
  ),
  index("idx_casting_reference_library_candidate").on(table.candidateId),
  index("idx_casting_reference_library_variant").on(table.variantId),
]));

export type CastingReferenceLibraryRow = typeof castingReferenceLibrary.$inferSelect;
export type InsertCastingReferenceLibraryRow = typeof castingReferenceLibrary.$inferInsert;

/**
 * How an open-lane ask went. Five words, because five different answers would
 * change the promotion decision this table exists to price.
 *
 * `words_only` and not `words-only`: a value that cannot be a TypeScript
 * identifier invites a second spelling at the boundary.
 */
export const CASTING_OPEN_LANE_OUTCOMES = [
  "delivered",
  "refunded",
  "words_only",
  "unreadable",
  "refused",
] as const;

/**
 * THE OPEN LANE'S DEMAND RECORD (OPEN_LANE_DESIGN_NOTE §7, migration 0031).
 *
 * One row is: somebody asked for a thing the catalogue does not own, and this
 * is how it went. **The column list is the privacy boundary** — this table is
 * built to be read by staff, so the customer's own sentence, their account,
 * their cast and any image key are not omitted from a projection, they are
 * absent from the row. See the migration for the full reasoning, including the
 * one correlation this shape still permits.
 *
 * Nothing writes it yet: the writer is §8 step 6 and lands after the lane.
 */
export const castingOpenLaneDemand = mysqlTable("casting_open_lane_demand", {
  id: int("id").autoincrement().primaryKey(),
  /** The NORMALIZED noun, never the sentence. */
  kind: varchar("kind", { length: 64 }).notNull(),
  outcome: mysqlEnum("outcome", CASTING_OPEN_LANE_OUTCOMES).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ([
  index("idx_casting_open_lane_demand_kind").on(table.kind, table.outcome),
  index("idx_casting_open_lane_demand_created").on(table.createdAt),
]));

export type CastingOpenLaneDemandRow = typeof castingOpenLaneDemand.$inferSelect;
export type InsertCastingOpenLaneDemandRow = typeof castingOpenLaneDemand.$inferInsert;

/**
 * How a read of a customer's reference ended.
 *
 * One value per way the reader can finish, taken from the reader's own refusal
 * codes rather than invented here, so a tally can tell *we could not see any
 * makeup* apart from *the transport was down* — two rows that would otherwise
 * both read as "it did not work" and send a reviewer to the wrong repair.
 *
 * `referenceReadDemand.test.ts` asserts that every refusal code the reader can
 * produce has a value here, so adding a refusal without a migration reddens the
 * suite rather than writing a value MySQL truncates to the empty string.
 */
export const CASTING_REFERENCE_READ_OUTCOMES = [
  "delivered",
  "no_transport",
  "unreadable",
  "no_makeup_visible",
  "names_hair",
] as const;

/**
 * WHAT CUSTOMERS TAKE FROM REFERENCES, AND HOW IT GOES (migration 0036, ruled
 * fable-941 §3a).
 *
 * One row is: somebody took a declared feature from a reference, and this is
 * how it went. It exists because the forms that keep NOTHING — makeup travels
 * as words, and the picture is read and discarded — have no row for the intent
 * declaration to ride on, so without this their demand would be invisible while
 * the one form that keeps bytes was counted. That is backwards, and fable-937
 * §3's tally is the thing it would have been backwards for.
 *
 * **The column list is the privacy boundary.** The sentence the reader produced
 * is the sharpest exclusion: a makeup note read off her own reference describes
 * a real person's face. It is absent from the row, not omitted from a
 * projection. So is the account, the cast, and any key.
 */
export const castingReferenceReads = mysqlTable("casting_reference_reads", {
  id: int("id").autoincrement().primaryKey(),
  /** Which feature was taken — the ruled vocabulary, even where unbuilt. */
  intent: mysqlEnum("intent", REFERENCE_INTENTS).notNull(),
  outcome: mysqlEnum("outcome", CASTING_REFERENCE_READ_OUTCOMES).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ([
  index("idx_casting_reference_reads_intent").on(table.intent, table.outcome),
  index("idx_casting_reference_reads_created").on(table.createdAt),
]));

export type CastingReferenceReadRow = typeof castingReferenceReads.$inferSelect;
export type InsertCastingReferenceReadRow = typeof castingReferenceReads.$inferInsert;

/**
 * THE FACE SCAN, KEPT — one row per (candidate, version) (migration 0032).
 *
 * The panel scans a face-version the first time it is looked at: twelve
 * segmenter questions, about ten cents, and until now remembered in memory
 * alone. The memory dies with the process, and this program deploys many times
 * a night, so the same face was bought again and again — 58 paid scans for 28
 * distinct faces across two days of ordinary live use.
 *
 * The founder's yes carried a bound — *"as long as it wont clog up storage"* —
 * and that bound is why the stencils are NOT in this row. Measured on 29 clean
 * production scans: geometry and words are 1,212 B, the same row with stencils
 * base64 inside is 12,365 B, which is 4.7 GB of MySQL at ten thousand users.
 * So each slot's entry in {@link geometry} names an OBJECT key instead, swept
 * with the candidate exactly as segment and library crops are.
 *
 * `versionKey` is a NOT NULL string — the variant's id, or `master` — because
 * MySQL lets NULLs repeat inside a unique index, and a bound of one row per
 * version enforced by a key that admits duplicates is not enforced at all. It
 * is `casting_segments`' lesson, applied rather than re-learned.
 */
export const castingFaceScans = mysqlTable("casting_face_scans", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  candidateId: int("candidateId").notNull(), // →casting_candidates
  /** The variant's id as text, or `master` for the candidate's own frame. */
  versionKey: varchar("versionKey", { length: 24 }).notNull(),
  /** WHICH bytes were read: a row whose frame has moved is refused, not served. */
  frameKey: varchar("frameKey", { length: 512 }).notNull(),
  /** Boxes, described rows, sides and counts — each slot naming its own object. */
  geometry: json("geometry").notNull(),
  /** What the stencils cost, so the growth curve stays a reading. */
  stencilBytes: int("stencilBytes").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ([
  uniqueIndex("uq_casting_face_scans_public").on(table.publicId),
  uniqueIndex("uq_casting_face_scans_identity").on(table.candidateId, table.versionKey),
  index("idx_casting_face_scans_candidate").on(table.candidateId),
]));

export type CastingFaceScanRow = typeof castingFaceScans.$inferSelect;
export type InsertCastingFaceScanRow = typeof castingFaceScans.$inferInsert;

/**
 * WHAT THE CATALOGUE WOULD HAVE KNOWN ABOUT A KIND NOBODY CATALOGUED —
 * one row per open-lane noun, ever (migration 0033,
 * `OPEN_KIND_PROPERTIES_DESIGN.md` §5).
 *
 * Two properties, both facts about the WORD rather than about any picture or any
 * person: `paired` (does the noun denote a matched set) and `anchorRegion` (where
 * on a body the thing is anchored). They are answered by one text call the first
 * time a noun is seen and never again, which is what makes a per-kind table the
 * right home: written onto every ask instead, the same fact would be stored N
 * times waiting to disagree with itself.
 *
 * **`anchorRegion` is a PLACE and not a boolean** (ruled fable-897 §3). The
 * property it stands in for — *does this thing present inside the frame* — has a
 * different answer in each of the product's eight framings (the waist-up master,
 * a close-up, three head-and-shoulders views, three head-to-feet views), and a
 * row cannot hold eight answers. So the model answers the kind and
 * `bodyAnchorRegions.ts` derives the frame.
 *
 * **The unique key is `kind` alone, on purpose.** Two rows for one kind is two
 * answers to one question and a per-reader rule for picking between them; the
 * answering model and prompt ride ON the row as provenance instead, and a
 * re-ask under a new prompt is an UPDATE by a build that decided to re-ask.
 *
 * **Both properties are NOT NULL and a declined read writes NO ROW.** The
 * absence of a row is the third state. A nullable `paired` read by a gate that
 * treats null as false mints a crop of one wing under the name of two, which is
 * exactly what fable-872 §2 forbids.
 */
export const castingOpenKindProperties = mysqlTable("casting_open_kind_properties", {
  id: int("id").autoincrement().primaryKey(),
  /** The NORMALIZED key the open lane minted — a single lowercase token. */
  kind: varchar("kind", { length: 64 }).notNull(),
  /** P1 — the KIND's question, never "did this render make two" (that is D1).
   *  A LOCALITY rather than a boolean since the founder's fangs ruling
   *  (fable-951): what decides whether a crop may carry a kind is not how many
   *  instances there are but whether ONE CROP CAN HOLD THEM. Derived from
   *  `KIND_LOCALITIES` rather than retyped, so the enum and the vocabulary
   *  cannot come apart. */
  locality: mysqlEnum("locality", KIND_LOCALITIES).notNull(),
  /** P2's per-kind half — `belowWaist` for a tail, `hands` for nails. Derived
   *  from `BODY_ANCHOR_REGIONS` rather than retyped, so the enum and the
   *  vocabulary cannot come apart. */
  anchorRegion: mysqlEnum("anchorRegion", BODY_ANCHOR_REGIONS).notNull(),
  /** Which model answered, so a later reading is a delta rather than an anecdote. */
  model: varchar("model", { length: 128 }).notNull(),
  /** Which prompt asked — a property that moved because the question moved. */
  promptVersion: varchar("promptVersion", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ([
  uniqueIndex("uq_casting_open_kind_properties_kind").on(table.kind),
]));

export type CastingOpenKindPropertiesRow = typeof castingOpenKindProperties.$inferSelect;
export type InsertCastingOpenKindPropertiesRow = typeof castingOpenKindProperties.$inferInsert;

/**
 * THE INK DESIGNS A CUSTOMER HAS ATTACHED — M12 row 15's upload, tattoos first
 * (migration 0034, `CASTING_INK_STUDIO_SCOPE`).
 *
 * One row is: **a design she supplied, the place on her it is meant for, and
 * where our copy of the bytes lives.** It is not a reference the painter reads
 * and it is not a library row — an uploaded photograph never reaches a render
 * (D-138: ink is re-drawn onto a neutral mannequin, ruled fable-684 §2), so this
 * table holds the SEED and the plate that comes from it is a separate artifact
 * with its own columns when the mannequin templates exist.
 *
 * # COPY, NEVER POINTER — the condition this build inherited
 *
 * `storageKey` is OUR object, written under the candidate's own purge path with
 * `storagePut`, exactly as `referenceMint.ts` writes a reference's bytes. It is
 * never a URL into a customer's own storage. That is a condition rather than a
 * preference: `POST_SIGN_ROADMAP.md` §7's L10 (the refine deferred-delete
 * question) closed as MOOT on the grounds that *a reference holds its own
 * bytes*, and an attachment by POINTER is the one thing that reopens it. There
 * is still no `notBefore` concept anywhere in `server/`.
 *
 * # WHY THE SIDE IS PART OF THE ROW AND NOT A MODIFIER ON IT
 *
 * Laterality is this road's proven killer, with a receipt: the legacy ink road
 * refunded 300 credits twice for *"wrong anatomical side"* at 90% confidence
 * (DECISION_LOG R7-7G), and V2 measured the same failure independently three
 * weeks later. A left upper arm and a right upper arm are two different places
 * that earn their release separately (`shared/inkReleasedPlacements.ts`).
 *
 * # RETENTION
 *
 * Rows and their objects die with the candidate, unconditionally and NOT gated
 * on the studio flag — the same rule the library crops and face scans follow. A
 * customer's uploaded picture leaves with the work it was uploaded for.
 */
export const castingInkDesigns = mysqlTable("casting_ink_designs", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  candidateId: int("candidateId").notNull(), // →casting_candidates
  /** One of the three surfaces the casting frame was MEASURED to contain. */
  placement: mysqlEnum("placement", INK_PLACEMENTS).notNull(),
  /** Which of her, spelled out — see the header. */
  side: mysqlEnum("side", INK_SIDES).notNull(),
  /** What was CLAIMED about where the design came from. Never guessed. */
  provenance: mysqlEnum("provenance", INK_PROVENANCES).notNull(),
  /**
   * WHAT THIS REFERENCE WAS UPLOADED FOR (migration 0035, ruled fable-937).
   *
   * A set rather than a value: "take the tattoo and the hair from this one" is
   * a legal ask. The members are `shared/referenceIntents.ts`; the shape is
   * enforced at the door, where each refusal can be driven.
   */
  intents: json("intents").$type<readonly ReferenceIntent[]>().notNull(),
  /** Our copy of the bytes, under the candidate's purge path. Never a pointer. */
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  /** sha256 of the object's bytes — byte identity, as the library does it. */
  digest: varchar("digest", { length: 64 }).notNull(),
  mime: varchar("mime", { length: 64 }).notNull(),
  byteSize: int("byteSize").notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ([
  index("ix_casting_ink_designs_candidate").on(table.candidateId),
  uniqueIndex("uq_casting_ink_designs_publicId").on(table.publicId),
]));

export type CastingInkDesignRow = typeof castingInkDesigns.$inferSelect;
export type InsertCastingInkDesignRow = typeof castingInkDesigns.$inferInsert;

/**
 * THE PLATE STORE (migration 0037, ruled fable-959 §3) — a design re-drawn onto
 * a blank ghost mannequin, which is the ONLY ink artifact an engine is ever
 * shown (D-138, fable-684 §2).
 *
 * # Why it is not columns on the design row
 *
 * The plate court mints one design on BOTH candidate engines, which is two
 * plates for one design. Columns would make that a two-engine hack and would
 * make "which engine drew this" an inference from which column is non-null.
 *
 * # What the row is for, beyond holding a key
 *
 * `engine` is the court's own axis, from the first commit. `templateDigest` is
 * the sha256 the mint actually read off disk — the suite's pin protects every
 * plate minted after a swap and says nothing about the ones minted before, and
 * a plate persists and is shown to an engine on every later render. On the row,
 * "which artwork is this standing on" is a query rather than an eye.
 *
 * # Retention
 *
 * A plate dies with its design, which dies with its Cast — unconditionally, not
 * gated on the studio flag. There is deliberately no `candidateId` here: the
 * sweep reaches these rows through the design's own (law 4), which fixes the
 * delete order as plates-then-designs.
 */
export const castingInkPlates = mysqlTable("casting_ink_plates", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull(),
  userId: int("userId").notNull(), // denormalized — single-statement ownership
  designId: int("designId").notNull(), // →casting_ink_designs
  /** The model as the provider names it, so a verdict and an invoice line meet. */
  engine: varchar("engine", { length: 128 }).notNull(),
  /** Which blank form it stands on — derived from the vocabulary, never retyped. */
  templateKind: mysqlEnum("templateKind", INK_TEMPLATE_KINDS).notNull(),
  /** The template bytes this plate was actually drawn on. See the header. */
  templateDigest: varchar("templateDigest", { length: 64 }).notNull(),
  /**
   * THE WORDS THIS PLATE WAS DRAWN FROM — sha256 of the exact prompt sent.
   *
   * `templateDigest` above pins the SHEET, and it paid for itself the day after
   * it was written when the sheet moved by ruling. This pins the other half of
   * the input, and it is here because that half moved too: on 2026-08-18 the
   * plate prompt was rewritten (it described a one-view form while every
   * committed template is a turnaround), and the two plates minted either side
   * of that change are **indistinguishable in this table** — same design, same
   * engine, same template digest, wildly different plates.
   *
   * A court's verdict is about an input. An input nothing records is an input
   * that can move silently, which is the same failure the sheet's digest exists
   * to prevent.
   *
   * The DIGEST rather than the prompt: the words are derived from data already
   * on the row (placement, side, and the template's own view list), so storing
   * them would be a mirror that drifts (law 4). A digest answers the only
   * question a later reader actually asks — *were these two plates drawn from
   * the same words?* — and cannot disagree with the source it hashes.
   *
   * NULL on the two rows minted before this column existed. They refuse rather
   * than approximate, exactly as `stepDeltas` does on the variants table.
   */
  promptDigest: varchar("promptDigest", { length: 64 }),
  /** Our copy of the plate's bytes, under the candidate's purge path. */
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  /** sha256 of the plate's own bytes — byte identity, as the library does it. */
  digest: varchar("digest", { length: 64 }).notNull(),
  mime: varchar("mime", { length: 64 }).notNull(),
  byteSize: int("byteSize").notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ([
  /* One plate per design per engine — the door's exactness, in the schema.
     Its leftmost column is `designId`, so "every plate of this design" needs no
     second index over the same prefix. */
  uniqueIndex("uq_casting_ink_plates_design_engine").on(table.designId, table.engine),
  uniqueIndex("uq_casting_ink_plates_publicId").on(table.publicId),
]));

export type CastingInkPlateRow = typeof castingInkPlates.$inferSelect;
export type InsertCastingInkPlateRow = typeof castingInkPlates.$inferInsert;
