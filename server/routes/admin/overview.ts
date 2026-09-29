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
import { getActiveBannerCount } from "../../db/announcementQueries";
import {
  getDailyGenerationStats,
  getDailySignupStats,
  getDailyCreditFlow,
  getChangeRequestDistribution,
} from "../../db/adminTimeSeriesQueries";
import { errorReportingConfigured } from "../../monitoring/errorTracker";
import { productEventsConfigured } from "../../monitoring/productEvents";

/** Captured at module load — gives us server uptime. */
const serverStartTime = new Date();

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
      activeBanners,
    ] = await Promise.all([
      getGenerationHealth(),
      getActiveUsers24h(),
      getUserGrowthMetrics(),
      getCreditEconomyMetrics(),
      getGovernanceMetrics(),
      getRecentAlerts(15),
      getActiveBannerCount(),
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
      system: {
        activeBanners,
        serverStartedAt: serverStartTime,
      },
      /*
        WHETHER THERE IS A DASHBOARD TO LINK TO (#1441) — his *"Links — no
        fourth key"* on #1419.

        ⚠ **TWO BOOLEANS AND NOTHING ELSE, AND THAT IS THE WHOLE POINT OF THE
        ANSWER HE GAVE.** The alternative he declined was a fourth Sentry key
        that could READ his errors back, so this procedure could print a count
        on his page. It does not, so nothing here can go stale: the page draws
        a link, the vendor draws the truth.

        Read fresh on every call rather than captured at module load like
        `serverStartTime` above, because a key can be pasted onto the service
        between two requests — and the page polls every 30 seconds, so the link
        appears on its own rather than on a redeploy.
      */
      monitoring: {
        errorsConfigured: errorReportingConfigured(),
        eventsConfigured: productEventsConfigured(),
      },
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
