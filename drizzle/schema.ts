import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for FormaStudio.
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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Storage quota management (in bytes)
  storageUsed: int("storageUsed").default(0).notNull(), // Current storage used
  storageLimit: int("storageLimit").default(104857600).notNull(), // 100MB default limit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Plan tier configuration with credit allocations
 */
export const PLAN_TIERS = {
  free: { name: 'Free', monthlyCredits: 100, price: 0, rolloverPercent: 0 },
  starter: { name: 'Starter', monthlyCredits: 1500, price: 1200, rolloverPercent: 50 }, // $12/month in cents
  pro: { name: 'Pro', monthlyCredits: 4000, price: 2900, rolloverPercent: 75 }, // $29/month
  studio: { name: 'Studio', monthlyCredits: 10000, price: 5900, rolloverPercent: 100 }, // $59/month
  enterprise: { name: 'Enterprise', monthlyCredits: 50000, price: 0, rolloverPercent: 100 }, // Custom pricing
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

/**
 * Credits table for tracking user balances and subscription tiers.
 * Note: Database table name remains "points" for backward compatibility.
 */
export const credits = mysqlTable("points", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").notNull().default(100),
  planTier: mysqlEnum("planTier", ["free", "starter", "pro", "studio", "enterprise"]).default("free").notNull(),
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
  type: mysqlEnum("type", ["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription"]).notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 64 }),
  balanceAfter: int("balanceAfter").notNull(),
  // Track which engine was used (for Flash fallback pricing)
  engineUsed: varchar("engineUsed", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
  mintedAt: timestamp("mintedAt"), // When the model was exported/minted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
    "frontFull",    // Full body front
    "sideClose",    // Side profile headshot
    "sideFull",     // Full body side
    "backFull",     // Full body back
  ]).notNull(),
  resolution: mysqlEnum("resolution", ["1K", "2K", "4K"]).default("1K").notNull(),
  storageUrl: text("storageUrl").notNull(), // S3 URL
  storageKey: varchar("storageKey", { length: 256 }), // S3 key for management
  pointsCost: int("pointsCost").notNull(), // Points spent on this asset
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

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
  ]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  pointsCost: int("pointsCost").notNull(),
  resultUrl: text("resultUrl"), // Output image URL
  errorMessage: text("errorMessage"), // Error if failed
  metadata: json("metadata"), // Additional generation params
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;
