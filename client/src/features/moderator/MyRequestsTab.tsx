/**
 * My Requests tab — list of moderator's change requests with status summary.
 */
import { RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  denied: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  expired: "bg-gray-100 text-gray-600",
};

const PRIORITY_BADGES: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
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
          <Skeleton key={i} className="h-20 w-full bg-[#E5E5E5]" />
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-700">{summary.pendingCount}</p>
            <p className="text-xs text-amber-600">Pending</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-700">{summary.approvedCount}</p>
            <p className="text-xs text-emerald-600">Approved</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-700">{summary.deniedCount}</p>
            <p className="text-xs text-red-600">Denied</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-gray-600">{summary.cancelledCount + summary.expiredCount}</p>
            <p className="text-xs text-gray-500">Closed</p>
          </div>
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-[#0A0A0A]">{summary.totalCount}</p>
            <p className="text-xs text-[#999]">Total</p>
          </div>
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch} className="border-[#E5E5E5] text-[#666] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]">
          <RefreshCw className="w-3 h-3 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Request List */}
      {requests.length === 0 ? (
        <div className="bg-white border border-[#E5E5E5] rounded-xl py-12 text-center">
          <FileText className="w-10 h-10 text-[#CCC] mx-auto mb-3" />
          <p className="text-[#999]">No change requests yet</p>
          <p className="text-xs text-[#CCC] mt-1">Use the "New Change Request" button to submit one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req: any) => (
            <div key={req.id} className="bg-white border border-[#E5E5E5] rounded-xl p-4 hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[#CCC]">#{req.id}</span>
                    <Badge className={STATUS_BADGES[req.status] || "bg-gray-100 text-gray-600"}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                    <Badge className={PRIORITY_BADGES[req.priority] || "bg-gray-100 text-gray-600"}>
                      {req.priority.charAt(0).toUpperCase() + req.priority.slice(1)}
                    </Badge>
                    <Badge className="bg-[#F0F0F0] text-[#666]">
                      {TYPE_LABELS[req.type] || req.type}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-[#0A0A0A] truncate">{req.title}</p>
                  <p className="text-xs text-[#999] mt-1 line-clamp-2">{req.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#CCC]">
                    <span>Target: {req.targetUserName || `User ${req.targetUserId}`}</span>
                    {req.creditAmount && <span>{req.creditAmount} credits</span>}
                    <span>{new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {req.status !== "pending" && req.reviewedByName && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[#CCC]">Reviewed by</p>
                    <p className="text-xs text-[#999]">{req.reviewedByName}</p>
                    {req.reviewNotes && (
                      <p className="text-xs text-[#CCC] mt-1 max-w-[200px] truncate" title={req.reviewNotes}>
                        "{req.reviewNotes}"
                      </p>
                    )}
                    {req.reviewedAt && (
                      <p className="text-xs text-[#CCC] mt-0.5">{new Date(req.reviewedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
