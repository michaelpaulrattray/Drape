/**
 * My Requests tab — list of moderator's change requests with status summary.
 */
import { RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  denied: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  expired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const PRIORITY_BADGES: Record<string, string> = {
  low: "bg-zinc-500/10 text-zinc-400",
  normal: "bg-blue-500/10 text-blue-400",
  high: "bg-amber-500/10 text-amber-400",
  urgent: "bg-red-500/10 text-red-400",
};

const TYPE_LABELS: Record<string, string> = {
  refund_credits: "Refund Credits",
  add_credits: "Add Credits",
  flag_account: "Flag Account",
  note_incident: "Note Incident",
  suspend_user: "Suspend User",
  unsuspend_user: "Unsuspend User",
  block_ip: "Block IP",
  other: "Other",
};

interface MyRequestsTabProps {
  data: any;
  isLoading: boolean;
  refetch: () => void;
}

export function MyRequestsTab({ data, isLoading, refetch }: MyRequestsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full bg-white/5" />
        ))}
      </div>
    );
  }

  const requests = data?.requests || [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-amber-400">{summary.pendingCount}</p>
              <p className="text-xs text-white/40">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">{summary.approvedCount}</p>
              <p className="text-xs text-white/40">Approved</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-red-400">{summary.deniedCount}</p>
              <p className="text-xs text-white/40">Denied</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-500/5 border-zinc-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-zinc-400">{summary.cancelledCount + summary.expiredCount}</p>
              <p className="text-xs text-white/40">Closed</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-white">{summary.totalCount}</p>
              <p className="text-xs text-white/40">Total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch} className="border-white/20 text-white">
          <RefreshCw className="w-3 h-3 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Request List */}
      {requests.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No change requests yet</p>
            <p className="text-xs text-white/30 mt-1">Use the "New Change Request" button to submit one</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req: any) => (
            <Card key={req.id} className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/30">#{req.id}</span>
                      <Badge className={STATUS_BADGES[req.status] || "bg-white/10 text-white/60"}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                      <Badge className={PRIORITY_BADGES[req.priority] || "bg-white/10 text-white/60"}>
                        {req.priority.charAt(0).toUpperCase() + req.priority.slice(1)}
                      </Badge>
                      <Badge className="bg-white/10 text-white/50">
                        {TYPE_LABELS[req.type] || req.type}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-white truncate">{req.title}</p>
                    <p className="text-xs text-white/40 mt-1 line-clamp-2">{req.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                      <span>Target: {req.targetUserName || `User ${req.targetUserId}`}</span>
                      {req.creditAmount && <span>{req.creditAmount} credits</span>}
                      <span>{new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {req.status !== "pending" && req.reviewedByName && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-white/30">Reviewed by</p>
                      <p className="text-xs text-white/50">{req.reviewedByName}</p>
                      {req.reviewNotes && (
                        <p className="text-xs text-white/30 mt-1 max-w-[200px] truncate" title={req.reviewNotes}>
                          "{req.reviewNotes}"
                        </p>
                      )}
                      {req.reviewedAt && (
                        <p className="text-xs text-white/20 mt-0.5">{new Date(req.reviewedAt).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
