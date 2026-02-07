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
});
