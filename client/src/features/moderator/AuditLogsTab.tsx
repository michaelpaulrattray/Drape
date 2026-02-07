/**
 * Audit Logs tab — abuse alerts, filters, paginated log table.
 */
import {
  Search,
  X,
  Eye,
  Activity,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Info,
  Calendar,
  Download,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditLog,
  SEVERITY_COLORS,
  SEVERITY_ICONS,
  CATEGORY_COLORS,
  PAGE_SIZE,
  formatDate,
  formatAction,
  getActionCategory,
  type OpenChangeRequestOptions,
} from "./moderatorConstants";

interface AuditLogsTabProps {
  logsQuery: any;
  alertsQuery: any;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  userIdSearch: string;
  setUserIdSearch: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  totalPages: number;
  onSelectLog: (log: AuditLog) => void;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
  onResetFilters: () => void;
}

export function AuditLogsTab({
  logsQuery,
  alertsQuery,
  page,
  setPage,
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  userIdSearch,
  setUserIdSearch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  totalPages,
  onSelectLog,
  onOpenChangeRequest,
  onResetFilters,
}: AuditLogsTabProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportQuery = trpc.moderatorExports.exportAuditLogsCsv.useQuery(
    {
      severity: severityFilter as any,
      actionCategory: categoryFilter as any,
      userId: userIdSearch && !isNaN(parseInt(userIdSearch)) ? parseInt(userIdSearch) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `audit-logs-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${result.data.total} audit log entries`);
      }
    } catch {
      toast.error("Failed to export audit logs");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Abuse Alerts Panel */}
      {(alertsQuery.data?.criticalCount || 0) > 0 && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Active Abuse Alerts
              <Badge className="bg-red-500/20 text-red-400 ml-2">{alertsQuery.data?.criticalCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertsQuery.data?.alerts.slice(0, 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>
                      {alert.severity}
                    </Badge>
                    <span className="text-white/80">{formatAction(alert.action)}</span>
                    <span className="text-white/40 text-sm">{formatDate(alert.createdAt)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {
                      const metadata = alert.metadata as Record<string, unknown> | null;
                      onOpenChangeRequest({
                        type: metadata?.ipAddress ? "block_ip" : "flag_account",
                        targetUserId: alert.userId?.toString() || "",
                        targetUserName: metadata?.userName as string || undefined,
                        relatedAuditLogId: alert.id,
                        ipAddress: metadata?.ipAddress as string || undefined,
                      });
                    }}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Request Action
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search by User ID..."
            value={userIdSearch}
            onChange={(e) => { setUserIdSearch(e.target.value); setPage(() => 0); }}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 w-48"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(() => 0); }}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(() => 0); }}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="model">Model</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="abuse">Abuse</SelectItem>
          </SelectContent>
        </Select>
        {(severityFilter !== "all" || categoryFilter !== "all" || userIdSearch || startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={onResetFilters} className="text-white/60 hover:text-white">
            <X className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        )}
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || logsQuery.isLoading}
            className="border-white/20 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-2 items-center max-w-md">
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(() => 0); }}
            className="w-full h-9 pl-8 pr-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
            placeholder="From"
          />
        </div>
        <span className="text-white/30 text-sm">–</span>
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(() => 0); }}
            className="w-full h-9 pl-8 pr-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
            placeholder="To"
          />
        </div>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStartDate(""); setEndDate(""); setPage(() => 0); }}
            className="h-9 w-9 p-0 text-white/40 hover:text-white"
            title="Clear dates"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Logs Table */}
      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">IP</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-6 w-full bg-white/10" />
                    </td>
                  </tr>
                ))
              ) : logsQuery.data?.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logsQuery.data?.logs.map((log: any) => {
                  const SeverityIcon = SEVERITY_ICONS[log.severity as keyof typeof SEVERITY_ICONS] || Info;
                  const category = getActionCategory(log.action);
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => onSelectLog(log as AuditLog)}
                    >
                      <td className="px-4 py-3 text-sm text-white/60 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}>
                          <SeverityIcon className="w-3 h-3 mr-1" />
                          {log.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {category && (
                            <Badge className={`${CATEGORY_COLORS[category]} text-xs`}>
                              {category}
                            </Badge>
                          )}
                          <span className="text-sm text-white/80">{formatAction(log.action)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60">
                        {log.userId ? `#${log.userId}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60 font-mono text-xs">
                        {log.ipAddress || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/40 hover:text-white h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLog(log as AuditLog);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {(log.severity === "warning" || log.severity === "critical") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-400/60 hover:text-amber-400 h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                const metadata = log.metadata as Record<string, unknown> | null;
                                onOpenChangeRequest({
                                  type: metadata?.ipAddress ? "block_ip" : log.userId ? "flag_account" : "note_incident",
                                  targetUserId: log.userId?.toString() || "",
                                  targetUserName: metadata?.userName as string || undefined,
                                  relatedAuditLogId: log.id,
                                  ipAddress: metadata?.ipAddress as string || undefined,
                                });
                              }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <span className="text-sm text-white/40">
              Page {page + 1} of {totalPages} ({logsQuery.data?.total || 0} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="border-white/20 text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="border-white/20 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
