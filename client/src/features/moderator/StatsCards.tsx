/**
 * Stats summary cards shown at the top of the Moderator Dashboard.
 */
import { Activity, AlertTriangle, Shield, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  statsQuery: any;
  alertsQuery: any;
}

export function StatsCards({ statsQuery, alertsQuery }: StatsCardsProps) {
  const cards = [
    { label: "Total Logs", value: statsQuery.data?.totalLogs ?? 0, icon: Activity, accent: "text-blue-600", loading: statsQuery.isLoading },
    { label: "Last 24 Hours", value: statsQuery.data?.last24Hours ?? 0, icon: Clock, accent: "text-emerald-600", loading: statsQuery.isLoading },
    { label: "Critical Alerts", value: alertsQuery.data?.criticalCount ?? 0, icon: Shield, accent: "text-red-600", loading: alertsQuery.isLoading },
    { label: "Warnings", value: alertsQuery.data?.warningCount ?? 0, icon: AlertTriangle, accent: "text-amber-600", loading: alertsQuery.isLoading },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#999] uppercase tracking-wide">{c.label}</span>
            <c.icon className={`w-4 h-4 ${c.accent}`} />
          </div>
          {c.loading ? (
            <Skeleton className="h-8 w-20 bg-[#E5E5E5]" />
          ) : (
            <p className="text-2xl font-bold text-[#0A0A0A] tabular-nums">{c.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}
