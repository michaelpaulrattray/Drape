/**
 * Activity sub-tab within User Investigation — shows recent audit log entries for a user.
 */
import { Activity, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditLog,
  SEVERITY_COLORS,
  formatDate,
  formatAction,
} from "./moderatorConstants";

interface ActivitySubTabProps {
  userActivityQuery: any;
  onSelectLog: (log: AuditLog) => void;
}

export function ActivitySubTab({ userActivityQuery, onSelectLog }: ActivitySubTabProps) {
  if (userActivityQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-[#E5E5E5] rounded-lg" />
        ))}
      </div>
    );
  }

  const activities = userActivityQuery.data?.logs || [];

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E5E5] py-8 text-center">
        <Activity className="w-6 h-6 mx-auto mb-2 text-[#CCC]" />
        <p className="text-sm text-[#999]">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] divide-y divide-[#F0F0F0] max-h-[400px] overflow-y-auto">
      {activities.map((log: any) => (
        <button
          key={log.id}
          onClick={() => onSelectLog(log as AuditLog)}
          className="w-full px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] ${SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}`}>
                {log.severity}
              </Badge>
              <span className="text-xs text-[#0A0A0A] truncate">{formatAction(log.action)}</span>
            </div>
            <p className="text-[10px] text-[#999] mt-0.5">{formatDate(log.createdAt)}</p>
          </div>
          <Eye className="w-3.5 h-3.5 text-[#CCC] shrink-0" />
        </button>
      ))}
    </div>
  );
}
