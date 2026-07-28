/**
 * Server-owned credit prices.
 *
 * Keep this module declaration-only so read-only planners can quote prices
 * without importing provider, queue, storage, or logging modules.
 */
export const CREDIT_COSTS = {
  castingImage: 350,
  fullBody: 300,
  multiView: 300,
  allViews: 900,
  iterate: 350,
  eraser: 350,
  upscale: 300,
  exportPack: 1500,
  flashMultiplier: 0.5,
} as const;

// Legacy alias for backward compatibility during migration.
export const POINT_COSTS = CREDIT_COSTS;
