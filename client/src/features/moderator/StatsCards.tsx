/**
 * The count row at the top of the Moderation surface.
 *
 * ⚠ **NOT one of brief 09's four surfaces, and it is here deliberately rather
 * than by drift.** It sits on the same page as the three that are, it drew four
 * Tailwind tints (blue, emerald, red, amber) on figures that are mostly not
 * faults, and `.dp-countrow` / `.dp-counttile` already existed from brief 06 to
 * draw exactly this. Leaving it would have meant a page whose top strip was the
 * only coloured thing left on it.
 *
 * The one figure that keeps accent is **critical alerts** — brief 06's rule for
 * this component, in its own words: *"a count carries accent ONLY where it is
 * the thing a reader came to check, because three coloured figures out of four
 * means the fourth cannot stand out."* Warnings do not; total logs and the last
 * 24 hours are volume, not fault.
 */
import { Skeleton } from "@/foundation";

interface StatsCardsProps {
  statsQuery: any;
  alertsQuery: any;
}

export function StatsCards({ statsQuery, alertsQuery }: StatsCardsProps) {
  const tiles = [
    {
      label: "Total logs",
      value: statsQuery.data?.totalLogs ?? 0,
      loading: statsQuery.isLoading,
      alert: false,
    },
    {
      label: "Last 24 hours",
      value: statsQuery.data?.last24Hours ?? 0,
      loading: statsQuery.isLoading,
      alert: false,
    },
    {
      label: "Critical alerts",
      value: alertsQuery.data?.criticalCount ?? 0,
      loading: alertsQuery.isLoading,
      alert: (alertsQuery.data?.criticalCount ?? 0) > 0,
    },
    {
      label: "Warnings",
      value: alertsQuery.data?.warningCount ?? 0,
      loading: alertsQuery.isLoading,
      alert: false,
    },
  ];

  return (
    <div className="dp-countrow">
      {tiles.map((tile) => (
        <div key={tile.label} className="dp-counttile">
          <span className="dp-eyebrow">{tile.label}</span>
          {tile.loading ? (
            <Skeleton className="dp-counttile__skeleton" />
          ) : (
            <span
              className={`dp-counttile__value${tile.alert ? " dp-counttile__value--alert" : ""}`}
            >
              {tile.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
