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
 * Points table for tracking user balances and subscription tiers.
 */
export const points = mysqlTable("points", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").notNull().default(100),
  planTier: mysqlEnum("planTier", ["free", "pro", "enterprise"]).default("free").notNull(),
  planExpiresAt: timestamp("planExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Points = typeof points.$inferSelect;
export type InsertPoints = typeof points.$inferInsert;

/**
 * Point transactions table for tracking all point movements.
 */
export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  type: mysqlEnum("type", ["generation", "purchase", "bonus", "refund", "signup"]).notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 64 }),
  balanceAfter: int("balanceAfter").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertPointTransaction = typeof pointTransactions.$inferInsert;

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
  agencyId: varchar("agencyId", { length: 32 }).notNull().unique(), // e.g., "MOD-26-A1B2C3"
  name: varchar("name", { length: 128 }), // User-assigned name
  masterPrompt: text("masterPrompt").notNull(), // Full generation prompt
  technicalSchema: json("technicalSchema").notNull(), // JSON object with model specs
  preferences: json("preferences").notNull(), // Original ModelPreferences input
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("active").notNull(),
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
