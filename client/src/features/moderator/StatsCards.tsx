/**
 * Stats summary cards shown at the top of the Moderator Dashboard.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  statsQuery: any;
  alertsQuery: any;
}

export function StatsCards({ statsQuery, alertsQuery }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Total Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-white">{statsQuery.data?.totalLogs || 0}</p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Last 24 Hours</CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-white">{statsQuery.data?.last24Hours || 0}</p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Critical Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-red-400">{alertsQuery.data?.criticalCount || 0}</p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Warnings</CardTitle>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-amber-400">{alertsQuery.data?.warningCount || 0}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
