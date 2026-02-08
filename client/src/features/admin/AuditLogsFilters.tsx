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
      <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
        <p className="text-xs text-[#999] font-medium uppercase tracking-wide">Total Logs</p>
        {statsLoading ? (
          <Skeleton className="h-8 w-20 mt-1 bg-[#E5E5E5]" />
        ) : (
          <p className="text-2xl font-bold text-[#0A0A0A] mt-1">{statsData?.totalLogs || 0}</p>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
        <p className="text-xs text-[#999] font-medium uppercase tracking-wide">Last 24 Hours</p>
        {statsLoading ? (
          <Skeleton className="h-8 w-20 mt-1 bg-[#E5E5E5]" />
        ) : (
          <p className="text-2xl font-bold text-[#0A0A0A] mt-1">{statsData?.last24Hours || 0}</p>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
        <p className="text-xs text-[#999] font-medium uppercase tracking-wide">Critical Alerts</p>
        {alertsLoading ? (
          <Skeleton className="h-8 w-20 mt-1 bg-[#E5E5E5]" />
        ) : (
          <p className="text-2xl font-bold text-red-600 mt-1">{alertsData?.criticalCount || 0}</p>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
        <p className="text-xs text-[#999] font-medium uppercase tracking-wide">Warnings</p>
        {alertsLoading ? (
          <Skeleton className="h-8 w-20 mt-1 bg-[#E5E5E5]" />
        ) : (
          <p className="text-2xl font-bold text-amber-600 mt-1">{alertsData?.warningCount || 0}</p>
        )}
      </div>
    </div>
  );
}

export function AbuseAlertsPanel({
  alertsData,
  onSelectLog,
}: Pick<AuditLogsFiltersProps, "alertsData" | "onSelectLog">) {
  if (!alertsData || (alertsData.criticalCount || 0) === 0) return null;

  return (
    <div className="bg-red-50 rounded-xl border border-red-200 p-4">
      <h3 className="text-red-700 font-semibold flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5" />
        Active Abuse Alerts
      </h3>
      <div className="space-y-2">
        {alertsData.alerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3 rounded-lg bg-white hover:bg-red-50/50 cursor-pointer transition-colors border border-red-100"
            onClick={() => onSelectLog(alert as AuditLog)}
          >
            <div className="flex items-center gap-3">
              <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>
                {alert.severity}
              </Badge>
              <span className="text-[#0A0A0A]">{formatAction(alert.action)}</span>
              {alert.userId && (
                <span className="text-[#999] text-sm">User #{alert.userId}</span>
              )}
            </div>
            <span className="text-[#999] text-sm">{formatDate(alert.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
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
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CCC]" />
            <Input
              placeholder="Search by User ID..."
              value={userIdSearch}
              onChange={(e) => {
                setUserIdSearch(e.target.value);
                setPage(() => 0);
              }}
              className="pl-10 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]"
            />
          </div>
        </div>
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(() => 0); }}>
          <SelectTrigger className="w-full md:w-40 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#E5E5E5]">
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(() => 0); }}>
          <SelectTrigger className="w-full md:w-40 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#E5E5E5]">
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
          className="text-[#999] hover:text-[#0A0A0A]"
        >
          <X className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}
