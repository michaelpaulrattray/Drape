/**
 * Audit Logs tab — abuse alerts, filters, paginated log table.
 */
import {
  X,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Download,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditLog,
  SEVERITY_COLORS,
  CATEGORY_COLORS,
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
  const hasFilters = severityFilter !== "all" || categoryFilter !== "all" || userIdSearch || startDate || endDate;

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
        link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <div className="space-y-4">
      {/* Abuse Alerts Banner */}
      {(alertsQuery.data?.criticalCount || 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <h4 className="text-sm font-semibold text-red-800">Active Abuse Alerts</h4>
            <Badge className="bg-red-100 text-red-700 text-[10px]">{alertsQuery.data?.criticalCount}</Badge>
          </div>
          <div className="space-y-1.5">
            {alertsQuery.data?.alerts.slice(0, 5).map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white hover:bg-red-50 border border-red-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>{alert.severity}</Badge>
                  <span className="text-sm text-[#0A0A0A]">{formatAction(alert.action)}</span>
                  <span className="text-xs text-[#999]">{formatDate(alert.createdAt)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
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
                  <FileText className="w-3 h-3 mr-1" /> Request Action
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-1">User ID</label>
            <input
              type="text"
              value={userIdSearch}
              onChange={(e) => { setUserIdSearch(e.target.value); setPage(() => 0); }}
              placeholder="e.g., 42"
              className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs text-[#0A0A0A] placeholder:text-[#CCC] w-24"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(() => 0); }}
              className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs text-[#0A0A0A]"
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(() => 0); }}
              className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs text-[#0A0A0A]"
            >
              <option value="all">All</option>
              <option value="billing">Billing</option>
              <option value="model">Model</option>
              <option value="security">Security</option>
              <option value="abuse">Abuse</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider block mb-1">Date Range</label>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#999]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(() => 0); }}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs text-[#0A0A0A] w-32"
              />
              <span className="text-xs text-[#999]">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(() => 0); }}
                className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs text-[#0A0A0A] w-32"
              />
            </div>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={onResetFilters} className="text-xs text-[#999] hover:text-[#0A0A0A]">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || logsQuery.isLoading}
              className="border-[#E5E5E5] text-[#666] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-[#999] uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-[#999] uppercase tracking-wider">Severity</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-[#999] uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-[#999] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-[#999] uppercase tracking-wider">IP</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-[#999] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-5 w-full bg-[#E5E5E5]" />
                    </td>
                  </tr>
                ))
              ) : logsQuery.data?.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#999] text-sm">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-[#CCC]" />
                    No audit logs found matching the current filters
                  </td>
                </tr>
              ) : (
                logsQuery.data?.logs.map((log: any) => {
                  const category = getActionCategory(log.action);
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      onClick={() => onSelectLog(log as AuditLog)}
                    >
                      <td className="px-4 py-3 text-xs text-[#999] whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge className={SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}>{log.severity}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#0A0A0A]">{formatAction(log.action)}</span>
                          {category && <Badge className={`text-[10px] ${CATEGORY_COLORS[category]}`}>{category}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#666] font-mono">{log.userId ? `#${log.userId}` : "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#999] font-mono">{log.ipAddress || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-[#999] hover:text-[#0A0A0A]"
                            onClick={(e) => { e.stopPropagation(); onSelectLog(log as AuditLog); }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {(log.severity === "warning" || log.severity === "critical") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E5E5]">
            <span className="text-xs text-[#999]">
              Page {page + 1} of {totalPages} ({logsQuery.data?.total || 0} total)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
