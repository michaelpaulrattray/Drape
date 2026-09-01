import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  TYPE_CONFIG,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  ALL_TYPES,
  ALL_STATUSES,
  ALL_PRIORITIES,
} from "@/features/admin/ChangeRequestConstants";
import { TableFilter, TableHead } from "@/foundation";
import { ChangeRequestList } from "@/features/admin/ChangeRequestList";
import { ReviewModal } from "@/features/admin/ReviewModal";
import { StaffBarAdmin, StaffLoading, StaffSurface } from "@/features/staff";

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
    return <StaffLoading />;
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/app" />;

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
    <StaffSurface
      breadcrumb="Admin / Change requests"
      /* The page keeps no `lastRefresh` and no auto-refresh preference, so it
         gets the manual button alone. Inventing the other two would be state
         no reader produces (brief 05 §4). */
      bar={
        <StaffBarAdmin
          refreshControls={{
            onRefresh: () => listQuery.refetch(),
            isRefetching: listQuery.isFetching,
          }}
        />
      }
    >
      <main className="space-y-6">
        {/*
          ⚠ THE FOUR SUMMARY TILES ARE GONE, AND THEY WERE A SECOND FILTER.

          They read `12 Pending Review`, `3 Approved`, `1 Denied`,
          `16 Total Requests` — and clicking one set `statusFilter`. So this
          page had TWO controls for one piece of state, in two different
          shapes, and after brief 06 added the filter row below it would have
          had two visible at once with no way to tell they were the same thing.

          The counts were the useful half and they survive as the filter's own
          option labels, which is where a count earns its place: it tells you
          what choosing that option would show you. Same resolution as the bug
          report queue's five pills and My requests' five tiles — three
          surfaces, one answer.
        */}
        <TableHead eyebrow="Change requests">
          <TableFilter
            label="Status"
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setPage(0); }}
            options={ALL_STATUSES.map((status) => ({
              value: status,
              label: statusLabel(status, summary),
            }))}
          />
          <TableFilter
            label="Type"
            value={typeFilter}
            onChange={(value) => { setTypeFilter(value); setPage(0); }}
            options={[
              { value: "all", label: "All types" },
              ...ALL_TYPES.map((type) => ({ value: type, label: TYPE_CONFIG[type]?.label || type })),
            ]}
          />
          <TableFilter
            label="Priority"
            value={priorityFilter}
            onChange={(value) => { setPriorityFilter(value); setPage(0); }}
            options={ALL_PRIORITIES.map((priority) => ({
              value: priority,
              label: priority === "all" ? "All priorities" : PRIORITY_CONFIG[priority]?.label || priority,
            }))}
          />
        </TableHead>

        {/* Brief 06 §2 — one table, rows opening in place. The 2/5 + 3/5 grid
            is gone: at 1280px its list column was 400px wide, so a request's
            title truncated to make room for a pane that was empty until you
            clicked something. */}
        <ChangeRequestList
          requests={requests}
          isLoading={listQuery.isLoading}
          selectedRequestId={selectedRequestId}
          onSelect={setSelectedRequestId}
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          selectedRequest={selectedRequest}
          detailLoading={detailQuery.isLoading}
          slackStatus={slackStatusQuery.data?.slackStatus}
          isSlackExecuting={executeAfterSlackMutation.isPending}
          onApprove={() => openReviewDialog("approved")}
          onDeny={() => openReviewDialog("denied")}
        />
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
    </StaffSurface>
  );
}

/**
 * A status's label with its count, where the summary has one.
 *
 * ⚠ **It shows a count only for the four the summary actually reports.** The
 * procedure returns pending, approved, denied, pendingExecution and total —
 * so `cancelled` and `expired` get their bare labels rather than a `(0)` that
 * would be a number no reader produces.
 */
function statusLabel(
  status: string,
  summary: {
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    pendingExecutionCount: number;
    totalCount: number;
  },
): string {
  const base = status === "all" ? "All statuses" : STATUS_CONFIG[status]?.label || status;
  const count =
    status === "all"
      ? summary.totalCount
      : status === "pending"
        ? summary.pendingCount
        : status === "approved"
          ? summary.approvedCount
          : status === "denied"
            ? summary.deniedCount
            : status === "pending_execution"
              ? summary.pendingExecutionCount
              : undefined;
  return count ? `${base} (${count})` : base;
}
