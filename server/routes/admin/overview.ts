/**
 * Admin Overview Router — real-time platform KPIs and alerts feed.
 */
import { router, adminProcedure } from "../../_core/trpc";
import {
  getGenerationHealth,
  getActiveUsers24h,
  getUserGrowthMetrics,
  getCreditEconomyMetrics,
  getGovernanceMetrics,
  getRecentAlerts,
} from "../../db/adminOverviewQueries";
import {
  getDailyGenerationStats,
  getDailySignupStats,
  getDailyCreditFlow,
  getChangeRequestDistribution,
} from "../../db/adminTimeSeriesQueries";

export const overviewRouter = router({
  /**
   * Get all dashboard KPIs in a single call.
   * Runs all queries in parallel for minimum latency.
   */
  getOverview: adminProcedure.query(async () => {
    const [
      generationHealth,
      activeUsers24h,
      userGrowth,
      creditEconomy,
      governance,
      alerts,
    ] = await Promise.all([
      getGenerationHealth(),
      getActiveUsers24h(),
      getUserGrowthMetrics(),
      getCreditEconomyMetrics(),
      getGovernanceMetrics(),
      getRecentAlerts(15),
    ]);

    return {
      health: {
        ...generationHealth,
        activeUsers24h,
      },
      users: userGrowth,
      credits: creditEconomy,
      governance,
      alerts,
      fetchedAt: new Date(),
    };
  }),

  /**
   * Get time-series data for charts (14-day windows).
   * Separate procedure to allow independent caching/polling.
   */
  getTimeSeries: adminProcedure.query(async () => {
    const [
      dailyGenerations,
      dailySignups,
      dailyCreditFlow,
      changeRequestDist,
    ] = await Promise.all([
      getDailyGenerationStats(14),
      getDailySignupStats(14),
      getDailyCreditFlow(14),
      getChangeRequestDistribution(),
    ]);

    return {
      dailyGenerations,
      dailySignups,
      dailyCreditFlow,
      changeRequestDist,
      fetchedAt: new Date(),
    };
  }),
});
