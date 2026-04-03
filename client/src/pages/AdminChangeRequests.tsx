import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useMemo, useEffect } from "react";
import {
  ClipboardList,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TYPE_CONFIG,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  ALL_TYPES,
  ALL_STATUSES,
  ALL_PRIORITIES,
} from "@/features/admin/ChangeRequestConstants";
import { ChangeRequestList } from "@/features/admin/ChangeRequestList";
import { ChangeRequestDetail } from "@/features/admin/ChangeRequestDetail";
import { ReviewModal } from "@/features/admin/ReviewModal";
import { AdminHeader } from "@/features/admin/AdminHeader";

export default function AdminChangeRequests() {
  const { user, loading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approved" | "denied">("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [page, setPage] = useState(0);

  const pageSize = 20;

  const queryInput = useMemo(() => ({
    status: statusFilter as "pending" | "approved" | "denied" | "cancelled" | "expired" | "pending_execution" | "all",
    type: typeFilter === "all" ? undefined : typeFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    limit: pageSize,
    offset: page * pageSize,
  }), [statusFilter, typeFilter, priorityFilter, page]);

  const listQuery = trpc.admin.listChangeRequests.useQuery(queryInput);
  const detailQuery = trpc.admin.getChangeRequest.useQuery(
    { id: selectedRequestId! },
    { enabled: !!selectedRequestId }
  );

  const reviewMutation = trpc.admin.reviewChangeRequest.useMutation({
    onSuccess: (result: any) => {
      if (result.pendingExecution) {
        toast.info(`${result.message}${!result.slackSent ? " (Slack not configured — will auto-approve)" : ""}`);
      } else {
        const executionInfo = result.executionResult;
        if (executionInfo?.executed && executionInfo?.success) {
          toast.success(`${result.message} — Action auto-executed successfully.`);
        } else if (executionInfo?.executed && !executionInfo?.success) {
          toast.warning(`${result.message} — Auto-execution failed: ${executionInfo.error || "Unknown error"}. Manual action may be required.`);
        } else {
          toast.success(result.message);
        }
      }
      setReviewDialogOpen(false);
      setReviewNotes("");
      if (!result.pendingExecution) setSelectedRequestId(null);
      listQuery.refetch();
      detailQuery.refetch();
    },
    onError: (error: { message: string }) => {
      toast.error(`Review failed: ${error.message}`);
    },
  });

  const selectedRequest = detailQuery.data;

  const slackStatusQuery = trpc.admin.checkChangeRequestSlackStatus.useQuery(
    { changeRequestId: selectedRequestId! },
    {
      enabled: !!selectedRequestId && selectedRequest?.status === "pending_execution",
      refetchInterval: 3000,
    }
  );

  const executeAfterSlackMutation = trpc.admin.executeChangeRequestAfterSlack.useMutation({
    onSuccess: (result: { success: boolean; message: string }) => {
      toast.success(result.message);
      setSelectedRequestId(null);
      listQuery.refetch();
    },
    onError: (error: { message: string }) => {
      toast.error(`Execution failed: ${error.message}`);
    },
  });

  useEffect(() => {
    if (
      slackStatusQuery.data?.slackStatus === "approved" &&
      selectedRequestId &&
      !executeAfterSlackMutation.isPending
    ) {
      executeAfterSlackMutation.mutate({ changeRequestId: selectedRequestId });
    }
  }, [slackStatusQuery.data?.slackStatus, selectedRequestId]);

  // ─── Guards ──────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#999]" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/studio" />;

  // ─── Derived data ────────────────────────────────────────────────────────

  const requests = listQuery.data?.requests || [];
  const summary = listQuery.data?.summary || { pendingCount: 0, approvedCount: 0, deniedCount: 0, pendingExecutionCount: 0, totalCount: 0 };
  const total = listQuery.data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  function openReviewDialog(action: "approved" | "denied") {
    setReviewAction(action);
    setReviewNotes("");
    setReviewDialogOpen(true);
  }

  function handleReview() {
    if (!selectedRequestId) return;
    reviewMutation.mutate({
      id: selectedRequestId,
      action: reviewAction,
      reviewNotes: reviewNotes.trim() || undefined,
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      <AdminHeader
        title="Change Requests"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => listQuery.refetch()}
            className="border-[#D5D5D5] text-[#999] text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => { setStatusFilter("pending"); setPage(0); }}
            className={`bg-white rounded-lg p-4 border transition-all text-left ${statusFilter === "pending" ? "border-amber-400 ring-1 ring-amber-200" : "border-[#E5E5E5] hover:border-[#CCC]"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{summary.pendingCount}</span>
            </div>
            <div className="text-sm text-[#999]">Pending Review</div>
          </button>
          <button
            onClick={() => { setStatusFilter("approved"); setPage(0); }}
            className={`bg-white rounded-lg p-4 border transition-all text-left ${statusFilter === "approved" ? "border-emerald-400 ring-1 ring-emerald-200" : "border-[#E5E5E5] hover:border-[#CCC]"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-600">{summary.approvedCount}</span>
            </div>
            <div className="text-sm text-[#999]">Approved</div>
          </button>
          <button
            onClick={() => { setStatusFilter("denied"); setPage(0); }}
            className={`bg-white rounded-lg p-4 border transition-all text-left ${statusFilter === "denied" ? "border-red-400 ring-1 ring-red-200" : "border-[#E5E5E5] hover:border-[#CCC]"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{summary.deniedCount}</span>
            </div>
            <div className="text-sm text-[#999]">Denied</div>
          </button>
          <button
            onClick={() => { setStatusFilter("all"); setPage(0); }}
            className={`bg-white rounded-lg p-4 border transition-all text-left ${statusFilter === "all" ? "border-blue-400 ring-1 ring-blue-200" : "border-[#E5E5E5] hover:border-[#CCC]"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">{summary.totalCount}</span>
            </div>
            <div className="text-sm text-[#999]">Total Requests</div>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] bg-white border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All Statuses" : STATUS_CONFIG[s]?.label || s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] bg-white border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ALL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_CONFIG[t]?.label || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px] bg-white border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {ALL_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "all" ? "All Priorities" : PRIORITY_CONFIG[p]?.label || p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content: List + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-2">
            <ChangeRequestList
              requests={requests}
              isLoading={listQuery.isLoading}
              selectedRequestId={selectedRequestId}
              onSelect={setSelectedRequestId}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>

          <div className="lg:col-span-3">
            <ChangeRequestDetail
              selectedRequestId={selectedRequestId}
              selectedRequest={selectedRequest}
              isLoading={detailQuery.isLoading}
              slackStatus={slackStatusQuery.data?.slackStatus}
              isSlackExecuting={executeAfterSlackMutation.isPending}
              onApprove={() => openReviewDialog("approved")}
              onDeny={() => openReviewDialog("denied")}
            />
          </div>
        </div>
      </main>

      <ReviewModal
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        action={reviewAction}
        notes={reviewNotes}
        onNotesChange={setReviewNotes}
        onConfirm={handleReview}
        isPending={reviewMutation.isPending}
        selectedRequestId={selectedRequestId}
        selectedRequestType={selectedRequest?.type}
      />
    </div>
  );
}
