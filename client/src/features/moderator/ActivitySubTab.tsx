/**
 * Activity sub-tab within User Investigation — shows recent audit log entries for a user.
 */
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
          <Activity className="w-4 h-4 text-blue-400" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {userActivityQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-white/10" />
            ))}
          </div>
        ) : userActivityQuery.data?.logs.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-4">No activity found</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {userActivityQuery.data?.logs.map((log: any) => (
              <div
                key={log.id}
                className="p-2 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => onSelectLog(log as AuditLog)}
              >
                <div className="flex items-center gap-2">
                  <Badge className={`${SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]} text-xs`}>
                    {log.severity}
                  </Badge>
                  <span className="text-xs text-white/80 truncate">{formatAction(log.action)}</span>
                </div>
                <p className="text-xs text-white/40 mt-1">{formatDate(log.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
