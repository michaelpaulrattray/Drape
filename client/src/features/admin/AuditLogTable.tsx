import {
  Activity,
  User,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SEVERITY_COLORS,
  SEVERITY_ICONS,
  CATEGORY_COLORS,
  PAGE_SIZE,
  formatAction,
  formatDate,
  getActionCategory,
  type AuditLog,
} from "./adminConstants";

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onSelectLog: (log: AuditLog) => void;
}

export function AuditLogTable({
  logs,
  isLoading,
  hasMore,
  page,
  setPage,
  onSelectLog,
}: AuditLogTableProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-[#E5E5E5]" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-[#999]">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No audit logs found matching your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const category = getActionCategory(log.action);
            const SeverityIcon = SEVERITY_ICONS[log.severity as keyof typeof SEVERITY_ICONS];
            return (
              <div
                key={log.id}
                className="flex items-center justify-between p-4 rounded-lg bg-[#FAFAFA] hover:bg-[#F0F0F0] cursor-pointer transition-colors group border border-[#E5E5E5]"
                onClick={() => onSelectLog(log)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}`}>
                    <SeverityIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#0A0A0A]">{formatAction(log.action)}</span>
                      {category && (
                        <Badge variant="outline" className={CATEGORY_COLORS[category]}>
                          {category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[#999] mt-1">
                      {log.userId && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          User #{log.userId}
                        </span>
                      )}
                      {log.resourceType && (
                        <span>{log.resourceType}: {log.resourceId}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#999] hidden md:block">{formatDate(log.createdAt)}</span>
                  <Eye className="w-4 h-4 text-[#CCC] group-hover:text-[#666] transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E5E5E5]">
          <span className="text-sm text-[#999]">
            Showing {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + logs.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-[#E5E5E5] text-[#666] disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-[#999] px-2">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="border-[#E5E5E5] text-[#666] disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
