import {
  Activity,
  User,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-white/10" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-white/40">
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
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                  onClick={() => onSelectLog(log)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}`}>
                      <SeverityIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{formatAction(log.action)}</span>
                        {category && (
                          <Badge variant="outline" className={CATEGORY_COLORS[category]}>
                            {category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-white/40 mt-1">
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
                    <span className="text-sm text-white/40 hidden md:block">{formatDate(log.createdAt)}</span>
                    <Eye className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <span className="text-sm text-white/40">
              Showing {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + logs.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="border-white/20 text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-white/60 px-2">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
                className="border-white/20 text-white disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
