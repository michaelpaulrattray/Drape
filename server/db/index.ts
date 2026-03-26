/**
 * Database Module Index — re-exports all domain modules.
 *
 * Consumers continue to import from "./db" or "../db" as before.
 * As domains are extracted, their exports move here from the legacy db.ts.
 *
 * Migration strategy:
 *   1. Extract domain to server/db/<domain>.ts
 *   2. Remove functions from server/db.ts (legacy)
 *   3. Add re-export line here
 *   4. Verify build + tests pass
 *   5. Repeat until server/db.ts is empty, then delete it
 */

// Connection
export { getDb, withTransaction } from "./connection";

// ---- Extracted domain modules ----

// Users
export {
  upsertUser,
  getUserByOpenId,
  getUserById,
  getUserStorageInfo,
  updateUserStorageUsed,
  updateUserProfile,
  type ProfileUpdateData,
} from "./users";

// Credits
export {
  initializeUserCredits,
  initializeUserPoints,
  getUserCredits,
  getUserPoints,
  getCreditTransactions,
  getPointTransactions,
  getCreditTransactionByRef,
  deductCredits,
  deductPoints,
  addCredits,
  addPoints,
} from "./credits";

// Models
export {
  createModel,
  getModelById,
  getModelByAgencyId,
  getUserModels,
  updateModel,
  mintModel,
  deleteModel,
  createModelAsset,
  getModelAssets,
  getModelAssetByView,
  getModelAssetsForCleanup,
  deleteModelWithAssetKeys,
} from "./models";

// Generations
export {
  createGeneration,
  updateGeneration,
  getUserGenerations,
  getGenerationById,
} from "./generations";

// Billing
export {
  updateUserSubscription,
  getUserByStripeCustomerId,
  refreshMonthlyCredits,
  addTopupCredits,
  getSubscriptionByUserId,
  getCreditHistory,
  getUsageStats,
  getDailyUsage,
} from "./billing";

// Waitlist
export {
  addToWaitlist,
  getWaitlistPosition,
  getWaitlistCount,
  checkEmailOnWaitlist,
} from "./waitlist";

// Security
export {
  suspendUser,
  unsuspendUser,
  freezeUser,
  unfreezeUser,
  updateUserRole,
  recordFailedLogin,
  resetFailedLogins,
  isAccountLocked,
} from "./security";

// IP Blocking
export {
  isIpBlocked,
  blockIp,
  unblockIp,
  getBlockedIps,
  createEmergencyToken,
  consumeEmergencyToken,
} from "./ipBlocking";

// Change Requests
export {
  createChangeRequest,
  getChangeRequestById,
  listChangeRequests,
  updateChangeRequestStatus,
  getChangeRequestsByModerator,
} from "./changeRequests";

// Admin (user management, statistics, credit adjustments)
export {
  listAllUsers,
  getUserFullDetails,
  adjustUserCredits,
  getUserStatistics,
} from "./admin";

// Moderator Queries (read-only history, velocity limits)
export {
  getDetailedCreditHistory,
  getDetailedGenerationHistory,
  getRecentTopupCount,
  getRecentTopupCredits,
  getFlaggedReferrals,
} from "./moderatorQueries";

// Referrals
export {
  getOrCreateReferralCode,
  getUserByReferralCode,
  claimReferral,
  redeemReferralCode,
  completeReferral,
  creditReferrerOnPaidAction,
  getReferralCreditsEarned,
  getReferralStats,
  getReferralHistory,
  recordEmailInvite,
  isValidReferralCodeFormat,
  expireStalePendingReferrals,
} from "./referrals";

// GDPR Data Export
export { exportUserData, type GdprExportData } from "./gdprExport";

// Bug Reports
export { createBugReport } from "./bugReports";

// Invite Codes (Pre-launch access gating)
export {
  redeemInviteCode,
  createInviteCode,
  listInviteCodes,
  deactivateInviteCode,
  approveUserDirectly,
} from "./inviteCodes";

// Wardrobe
export {
  createGarment,
  getGarmentById,
  getUserGarments,
  getUserGarmentsBySlot,
  updateGarment,
  deleteGarment,
  createOutfit,
  getUserOutfits,
  getOutfitById,
  updateOutfit,
  deleteOutfit,
  createSession,
  getSessionById,
  getUserSessions,
  updateSession,
  deleteSession,
  getLatestUserSession,
  getRecentUserSessions,
  capUserSessions,
} from "./wardrobe";
