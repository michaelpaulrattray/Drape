import {
  AlertCircle,
  Activity,
  Search,
  User,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SEVERITY_COLORS,
  formatAction,
  formatDate,
  type AuditLog,
} from "./adminConstants";

interface StatsData {
  totalLogs: number;
  last24Hours: number;
}

interface AlertsData {
  criticalCount: number;
  warningCount: number;
  alerts: Array<{
    id: number;
    severity: string;
    action: string;
    userId: number | null;
    createdAt: Date;
  }>;
}

interface AuditLogsFiltersProps {
  statsData?: StatsData;
  statsLoading: boolean;
  alertsData?: AlertsData;
  alertsLoading: boolean;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  userIdSearch: string;
  setUserIdSearch: (v: string) => void;
  setPage: (fn: (p: number) => number) => void;
  onResetFilters: () => void;
  onSelectLog: (log: AuditLog) => void;
}

export function AuditStatsCards({
  statsData,
  statsLoading,
  alertsData,
  alertsLoading,
}: Pick<AuditLogsFiltersProps, "statsData" | "statsLoading" | "alertsData" | "alertsLoading">) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Total Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-white">{statsData?.totalLogs || 0}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Last 24 Hours</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-white">{statsData?.last24Hours || 0}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Critical Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-red-400">{alertsData?.criticalCount || 0}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">Warnings</CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <Skeleton className="h-8 w-20 bg-white/10" />
          ) : (
            <p className="text-2xl font-bold text-amber-400">{alertsData?.warningCount || 0}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AbuseAlertsPanel({
  alertsData,
  onSelectLog,
}: Pick<AuditLogsFiltersProps, "alertsData" | "onSelectLog">) {
  if (!alertsData || (alertsData.criticalCount || 0) === 0) return null;

  return (
    <Card className="bg-red-500/5 border-red-500/20">
      <CardHeader>
        <CardTitle className="text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Active Abuse Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alertsData.alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
              onClick={() => onSelectLog(alert as AuditLog)}
            >
              <div className="flex items-center gap-3">
                <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>
                  {alert.severity}
                </Badge>
                <span className="text-white/80">{formatAction(alert.action)}</span>
                {alert.userId && (
                  <span className="text-white/40 text-sm">User #{alert.userId}</span>
                )}
              </div>
              <span className="text-white/40 text-sm">{formatDate(alert.createdAt)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditFiltersBar({
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  userIdSearch,
  setUserIdSearch,
  setPage,
  onResetFilters,
}: Omit<AuditLogsFiltersProps, "statsData" | "statsLoading" | "alertsData" | "alertsLoading" | "onSelectLog">) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search by User ID..."
                value={userIdSearch}
                onChange={(e) => {
                  setUserIdSearch(e.target.value);
                  setPage(() => 0);
                }}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>
          <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(() => 0); }}>
            <SelectTrigger className="w-full md:w-40 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(() => 0); }}>
            <SelectTrigger className="w-full md:w-40 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="model">Model</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="abuse">Abuse</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="text-white/60 hover:text-white"
          >
            <X className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
