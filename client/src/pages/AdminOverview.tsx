import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  HealthMetrics,
  GenerationChart,
  NeedsHuman,
  UserGrowthCard,
  CreditEconomyCard,
  GovernanceCard,
  AlertsFeed,
  BannerManagement,
  SystemStatusCard,
} from "@/features/admin/overview";
import "@/features/admin/overview/overview.css";
import { Button, Skeleton, TableHead } from "@/foundation";
import { StaffBarAdmin, StaffLoading, StaffSurface } from "@/features/staff";

/**
 * The admin dashboard (brief 07).
 *
 * ## One column, sections stacked (§4)
 *
 * The `lg:grid-cols-5` split with `col-span-3` / `col-span-2` is gone. His
 * reason: *"That split puts alerts in a narrow right rail where each row
 * truncates at `max-w-[280px]`, and it means the page has two reading orders
 * depending on width."*
 *
 * Section order is his: **Needs a human · Last 24 hours · Charts · System and
 * banners · Recent alerts**, and every grid inside them is
 * `repeat(auto-fit, minmax(N, 1fr))` — never a fixed column count.
 *
 * ## What did NOT change
 *
 * Both queries, their inputs, their 30s refetch, their `staleTime`, the
 * auto-refresh toggle and the manual refresh. §1: *"The `admin.getOverview` and
 * `admin.getTimeSeries` queries are untouched."* §11's last bar is that every
 * number, series and action is identical to before, and that is the thing this
 * shift measured against `main`.
 *
 * ## The `Data as of …` footer is deleted (§9)
 *
 * It was 10px centred at `#bbb` — below the type floor — and it said the same
 * thing the staff bar's own stamp says, which is the correct home for it.
 */

const REFRESH_INTERVAL_MS = 30_000;

export default function AdminOverview() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const isAdmin = isAuthenticated && user?.role === "admin";

  const overviewQuery = trpc.admin.getOverview.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: autoRefresh ? REFRESH_INTERVAL_MS : false,
    staleTime: 10_000,
  });

  const timeSeriesQuery = trpc.admin.getTimeSeries.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: autoRefresh ? REFRESH_INTERVAL_MS : false,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (overviewQuery.dataUpdatedAt) {
      setLastRefresh(new Date(overviewQuery.dataUpdatedAt));
    }
  }, [overviewQuery.dataUpdatedAt]);

  const handleRefresh = useCallback(() => {
    overviewQuery.refetch();
    timeSeriesQuery.refetch();
    toast.success("Dashboard refreshed");
  }, [overviewQuery, timeSeriesQuery]);

  // Auth guards
  if (authLoading) {
    return <StaffLoading />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. */
  if (user?.role !== "admin") return <Redirect to="/app" />;

  const data = overviewQuery.data;
  const ts = timeSeriesQuery.data;
  const isLoading = overviewQuery.isLoading && !data;

  return (
    <StaffSurface
      breadcrumb="Admin / Overview"
      bar={
        <StaffBarAdmin
          refreshControls={{
            autoRefresh,
            onToggleAutoRefresh: () => {
              setAutoRefresh(!autoRefresh);
              toast.info(autoRefresh ? "Auto-refresh paused" : "Auto-refresh enabled (30s)");
            },
            onRefresh: handleRefresh,
            isRefetching: overviewQuery.isRefetching,
            lastRefresh,
          }}
        />
      }
    >
      <main className="dp-ov">
        {/* §9 — the primitive, at each section's real height. */}
        {isLoading && (
          <>
            <section className="dp-ov__section">
              <TableHead eyebrow="Last 24 hours" />
              <div className="dp-ov__kpigrid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} style={{ height: 118 }} />
                ))}
              </div>
            </section>
            <Skeleton style={{ height: 268 }} />
            <div className="dp-ov__pairgrid">
              <Skeleton style={{ height: 340 }} />
              <Skeleton style={{ height: 340 }} />
            </div>
          </>
        )}

        {/* §9 — the `--error` family, one line of what failed, the raw message
            in mono, and Retry. Staff surfaces keep raw error text on purpose. */}
        {overviewQuery.isError && (
          <div className="dp-ov__error">
            <p className="dp-ov__errortitle">The dashboard could not load.</p>
            <p className="dp-ov__errorraw">{overviewQuery.error?.message}</p>
            <Button variant="secondary" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        )}

        {data && (
          <>
            {/* 1 · The only section that can disappear. */}
            <NeedsHuman governance={data.governance} alerts={data.alerts} />

            {/* 2 · Last 24 hours */}
            <HealthMetrics data={data.health} chartData={ts?.dailyGenerations} />

            {/* 3 · Charts.
                ⚠ NO EYEBROW HERE, ON PURPOSE. §4 names exactly four:
                `NEEDS A HUMAN`, `LAST 24 HOURS`, `SYSTEM`, `RECENT ALERTS` —
                five sections, four heads. The charts carry their own card
                titles ("Generation activity", "User growth", "Governance",
                "Credit economy"), so a fifth head would label a group whose
                members are already labelled. Driven and looked at: it read as
                one redundant word above four titled cards. */}
            <section className="dp-ov__section">
              <GenerationChart chartData={ts?.dailyGenerations} />
              <div className="dp-ov__pairgrid">
                <UserGrowthCard data={data.users} chartData={ts?.dailySignups} />
                <GovernanceCard
                  data={data.governance}
                  chartData={ts?.changeRequestDist}
                />
              </div>
              <CreditEconomyCard data={data.credits} chartData={ts?.dailyCreditFlow} />
            </section>

            {/* 4 · System and banners.
                ⚠ The eyebrow reads "System and banners", which is §4's own name
                for this section in its ORDER list, rather than §4's one-word
                `SYSTEM` in its eyebrow list. His brief says both, and driven
                the one-word version printed SYSTEM twice, six pixels apart —
                once as the section head and again as the card's own label. The
                section covers two cards; naming both is what the head is for. */}
            <section className="dp-ov__section">
              <TableHead eyebrow="System and banners" />
              <div className="dp-ov__sysgrid">
                <SystemStatusCard
                  activeBanners={data.system.activeBanners}
                  serverStartedAt={data.system.serverStartedAt}
                />
                <BannerManagement />
              </div>
            </section>

            {/* 5 · Recent alerts — full width now, so nothing truncates. */}
            <AlertsFeed alerts={data.alerts} />
          </>
        )}
      </main>
    </StaffSurface>
  );
}
