import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import {
  ClipboardList,
  ChevronLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowUpCircle,
  User,
  Coins,
  Shield,
  Globe,
  FileText,
  Flag,
  Eye,
  Ban,
  UserCheck,
  HelpCircle,
  Loader2,
  ChevronRight,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Coins; color: string }> = {
  refund_credits: { label: "Refund Credits", icon: Coins, color: "text-amber-400" },
  add_credits: { label: "Add Credits", icon: Coins, color: "text-emerald-400" },
  flag_account: { label: "Flag Account", icon: Flag, color: "text-orange-400" },
  note_incident: { label: "Note Incident", icon: FileText, color: "text-blue-400" },
  suspend_user: { label: "Suspend User", icon: Ban, color: "text-red-400" },
  unsuspend_user: { label: "Unsuspend User", icon: UserCheck, color: "text-green-400" },
  block_ip: { label: "Block IP", icon: Globe, color: "text-red-400" },
  other: { label: "Other", icon: HelpCircle, color: "text-gray-400" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  denied: { label: "Denied", className: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: XCircle },
  expired: { label: "Expired", className: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
  pending_execution: { label: "Awaiting Slack", className: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Timer },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  normal: { label: "Normal", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  high: { label: "High", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  urgent: { label: "Urgent", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const ALL_TYPES = [
  "refund_credits", "add_credits", "flag_account", "note_incident",
  "suspend_user", "unsuspend_user", "block_ip", "other",
];

const ALL_STATUSES = ["all", "pending", "pending_execution", "approved", "denied", "cancelled", "expired"];

// Sensitive types that go through Slack approval
const SENSITIVE_TYPES = ["suspend_user", "unsuspend_user", "block_ip", "refund_credits", "add_credits"];
const ALL_PRIORITIES = ["all", "low", "normal", "high", "urgent"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${config.className}`}>
      {priority === "urgent" && <ArrowUpCircle className="w-3 h-3" />}
      {priority === "high" && <AlertTriangle className="w-3 h-3" />}
      {config.label}
    </span>
  );
}

function TypeIcon({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
  const Icon = config.icon;
  return <Icon className={`w-4 h-4 ${config.color}`} />;
}

function formatDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
        // Sensitive type — routed through Slack
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
      // Don't deselect if pending execution — user may want to monitor
      if (!result.pendingExecution) setSelectedRequestId(null);
      listQuery.refetch();
      detailQuery.refetch();
    },
    onError: (error: { message: string }) => {
      toast.error(`Review failed: ${error.message}`);
    },
  });

  // Slack approval status polling for pending_execution requests
  const slackStatusQuery = trpc.admin.checkChangeRequestSlackStatus.useQuery(
    { changeRequestId: selectedRequestId! },
    {
      enabled: !!selectedRequestId && selectedRequest?.status === "pending_execution",
      refetchInterval: 3000, // Poll every 3 seconds
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

  // Auto-execute when Slack approves
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/dashboard" />;

  // ─── Derived data ────────────────────────────────────────────────────────

  const requests = listQuery.data?.requests || [];
  const summary = listQuery.data?.summary || { pendingCount: 0, approvedCount: 0, deniedCount: 0, pendingExecutionCount: 0, totalCount: 0 };
  const total = listQuery.data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const selectedRequest = detailQuery.data;

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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-400" />
                <h1 className="text-xl font-semibold">Change Requests</h1>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQuery.refetch()}
              className="border-white/10 hover:bg-white/5"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${listQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => { setStatusFilter("pending"); setPage(0); }}
            className={`bg-white/5 rounded-lg p-4 border transition-all text-left ${statusFilter === "pending" ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-white/10 hover:border-white/20"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">{summary.pendingCount}</span>
            </div>
            <div className="text-sm text-gray-400">Pending Review</div>
          </button>
          <button
            onClick={() => { setStatusFilter("approved"); setPage(0); }}
            className={`bg-white/5 rounded-lg p-4 border transition-all text-left ${statusFilter === "approved" ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-white/10 hover:border-white/20"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">{summary.approvedCount}</span>
            </div>
            <div className="text-sm text-gray-400">Approved</div>
          </button>
          <button
            onClick={() => { setStatusFilter("denied"); setPage(0); }}
            className={`bg-white/5 rounded-lg p-4 border transition-all text-left ${statusFilter === "denied" ? "border-red-500/50 ring-1 ring-red-500/20" : "border-white/10 hover:border-white/20"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-2xl font-bold text-red-400">{summary.deniedCount}</span>
            </div>
            <div className="text-sm text-gray-400">Denied</div>
          </button>
          <button
            onClick={() => { setStatusFilter("all"); setPage(0); }}
            className={`bg-white/5 rounded-lg p-4 border transition-all text-left ${statusFilter === "all" ? "border-blue-500/50 ring-1 ring-blue-500/20" : "border-white/10 hover:border-white/20"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-blue-400" />
              <span className="text-2xl font-bold text-blue-400">{summary.totalCount}</span>
            </div>
            <div className="text-sm text-gray-400">Total Requests</div>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
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
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
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
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white">
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
          {/* Request List */}
          <div className="lg:col-span-2 space-y-2">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-white/50" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No change requests found</p>
                <p className="text-sm mt-1">Adjust your filters or check back later</p>
              </div>
            ) : (
              <>
                {requests.map((req) => {
                  const typeConf = TYPE_CONFIG[req.type] || TYPE_CONFIG.other;
                  const isSelected = selectedRequestId === req.id;
                  return (
                    <button
                      key={req.id}
                      onClick={() => setSelectedRequestId(req.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-white/10 border-blue-500/50 ring-1 ring-blue-500/20"
                          : "bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TypeIcon type={req.type} />
                          <span className="text-sm font-medium truncate">{req.title}</span>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">#{req.id}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={req.status} />
                        <PriorityBadge priority={req.priority} />
                        <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400">
                          {typeConf.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>by {req.submittedByName || `User ${req.submittedById}`}</span>
                        <span>{formatRelativeTime(req.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="text-gray-400 hover:text-white"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                    </Button>
                    <span className="text-xs text-gray-500">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="text-gray-400 hover:text-white"
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-3">
            {!selectedRequestId ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center text-gray-500">
                <Eye className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Select a request to view details</p>
              </div>
            ) : detailQuery.isLoading ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/50" />
              </div>
            ) : !selectedRequest ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center text-gray-500">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Request not found</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                {/* Detail Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TypeIcon type={selectedRequest.type} />
                        <h2 className="text-lg font-semibold">{selectedRequest.title}</h2>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={selectedRequest.status} />
                        <PriorityBadge priority={selectedRequest.priority} />
                        <Badge variant="outline" className="text-xs border-white/10 text-gray-400">
                          {TYPE_CONFIG[selectedRequest.type]?.label || selectedRequest.type}
                        </Badge>
                        <span className="text-xs text-gray-500">#{selectedRequest.id}</span>
                      </div>
                    </div>

                    {/* Action Buttons — only for pending requests */}
                    {selectedRequest.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog("approved")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {SENSITIVE_TYPES.includes(selectedRequest.type) ? "Approve (Slack)" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReviewDialog("denied")}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    )}

                    {/* Pending Slack Execution Status */}
                    {selectedRequest.status === "pending_execution" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {slackStatusQuery.data?.slackStatus === "approved" ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-emerald-400">Slack Approved</span>
                            {executeAfterSlackMutation.isPending && (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            )}
                          </div>
                        ) : slackStatusQuery.data?.slackStatus === "denied" ? (
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">Slack Denied</span>
                          </div>
                        ) : slackStatusQuery.data?.slackStatus === "expired" ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400">Slack Expired</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 animate-pulse text-purple-400" />
                            <span className="text-sm text-purple-400">Awaiting Slack Approval...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detail Body */}
                <div className="p-6 space-y-6">
                  {/* Description */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {selectedRequest.description}
                    </p>
                  </div>

                  {/* Key Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Submitted By</div>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm">{selectedRequest.submittedByName || `User ${selectedRequest.submittedById}`}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Target User</div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm">
                          {selectedRequest.targetUserName
                            ? `${selectedRequest.targetUserName} (ID: ${selectedRequest.targetUserId})`
                            : `User ID: ${selectedRequest.targetUserId}`}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Created</div>
                      <div className="text-sm">{formatDate(selectedRequest.createdAt)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="text-xs text-gray-500 mb-1">Last Updated</div>
                      <div className="text-sm">{formatDate(selectedRequest.updatedAt)}</div>
                    </div>
                  </div>

                  {/* Credit Details */}
                  {(selectedRequest.type === "refund_credits" || selectedRequest.type === "add_credits") && selectedRequest.creditAmount && (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-4">
                      <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Credit Details</h3>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Amount</div>
                          <div className="text-lg font-bold text-amber-400">{selectedRequest.creditAmount} credits</div>
                        </div>
                        {selectedRequest.creditReason && (
                          <div className="flex-1">
                            <div className="text-xs text-gray-500">Reason</div>
                            <div className="text-sm text-gray-300">{selectedRequest.creditReason}</div>
                          </div>
                        )}
                      </div>
                      {selectedRequest.status === "pending" && (
                        <p className="text-xs text-amber-400/70 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Approving will automatically {selectedRequest.type === "refund_credits" ? "refund" : "add"} {selectedRequest.creditAmount} credits to the target user.
                        </p>
                      )}
                    </div>
                  )}

                  {/* IP Details */}
                  {selectedRequest.type === "block_ip" && selectedRequest.ipAddress && (
                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4">
                      <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">IP Address</h3>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-red-400" />
                        <code className="text-sm font-mono text-red-300">{selectedRequest.ipAddress}</code>
                      </div>
                      {selectedRequest.status === "pending" && (
                        <p className="text-xs text-red-400/70 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Approving will automatically block this IP address.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Suspend/Unsuspend Warning */}
                  {(selectedRequest.type === "suspend_user" || selectedRequest.type === "unsuspend_user") && selectedRequest.status === "pending" && (
                    <div className={`${selectedRequest.type === "suspend_user" ? "bg-red-500/5 border-red-500/10" : "bg-green-500/5 border-green-500/10"} border rounded-lg p-4`}>
                      <p className={`text-xs ${selectedRequest.type === "suspend_user" ? "text-red-400/70" : "text-green-400/70"} flex items-center gap-1`}>
                        <AlertTriangle className="w-3 h-3" />
                        Approving will require Slack confirmation before {selectedRequest.type === "suspend_user" ? "suspending" : "unsuspending"} the target user's account.
                      </p>
                    </div>
                  )}

                  {/* Pending Execution Banner */}
                  {selectedRequest.status === "pending_execution" && (
                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="w-4 h-4 text-purple-400" />
                        <h3 className="text-sm font-medium text-purple-400">Awaiting Slack Confirmation</h3>
                      </div>
                      <p className="text-xs text-purple-400/70">
                        This change request has been approved by an admin but requires Slack confirmation before the action is executed.
                        {slackStatusQuery.data?.slackStatus === "pending" && " Check your Slack #admin-actions channel for the approval buttons."}
                        {slackStatusQuery.data?.slackStatus === "denied" && " The Slack approval was denied. This request will not be executed."}
                        {slackStatusQuery.data?.slackStatus === "expired" && " The Slack approval has expired. This request will not be executed."}
                      </p>
                      {selectedRequest.reviewedByName && (
                        <p className="text-xs text-gray-500 mt-2">
                          Approved by {selectedRequest.reviewedByName} at {formatDate(selectedRequest.reviewedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Evidence Summary */}
                  {selectedRequest.evidenceSummary && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Evidence Summary</h3>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap bg-white/5 rounded-lg p-3 border border-white/5">
                        {selectedRequest.evidenceSummary}
                      </p>
                    </div>
                  )}

                  {/* Related Audit Log */}
                  {selectedRequest.relatedAuditLogId && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Related Audit Log</h3>
                      <Link href={`/admin/audit-logs?highlight=${selectedRequest.relatedAuditLogId}`}>
                        <span className="text-sm text-blue-400 hover:underline cursor-pointer">
                          View Audit Log Entry #{selectedRequest.relatedAuditLogId} →
                        </span>
                      </Link>
                    </div>
                  )}

                  {/* Review Info (for already reviewed requests) */}
                  {selectedRequest.reviewedById && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Review Decision</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Reviewed by:</span>
                          <span className="text-sm">{selectedRequest.reviewedByName || `Admin ${selectedRequest.reviewedById}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Reviewed at:</span>
                          <span className="text-sm">{formatDate(selectedRequest.reviewedAt)}</span>
                        </div>
                        {selectedRequest.reviewNotes && (
                          <div>
                            <span className="text-xs text-gray-500">Notes:</span>
                            <p className="text-sm text-gray-300 mt-1">{selectedRequest.reviewNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Review Confirmation Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="bg-[#141414] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === "approved" ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Approve Change Request
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  Deny Change Request
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {reviewAction === "approved" ? (
                <>
                  This will approve request <strong>#{selectedRequestId}</strong>.
                  {selectedRequest && SENSITIVE_TYPES.includes(selectedRequest.type) && (
                    <span className="block mt-1 text-purple-400 font-medium">
                      This is a sensitive action. A Slack confirmation will be required before execution.
                    </span>
                  )}
                  {selectedRequest && !SENSITIVE_TYPES.includes(selectedRequest.type) && (
                    <span className="block mt-1 text-gray-400">
                      This will approve the request. No auto-execution for this type.
                    </span>
                  )}
                </>
              ) : (
                <>This will deny request <strong>#{selectedRequestId}</strong>. No action will be taken.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-sm text-gray-400">Review Notes (optional)</label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={reviewAction === "approved" ? "Any notes about this approval..." : "Reason for denial..."}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setReviewDialogOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending}
              className={
                reviewAction === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : reviewAction === "approved" ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {reviewAction === "approved"
                ? (selectedRequest && SENSITIVE_TYPES.includes(selectedRequest.type)
                    ? "Approve & Send to Slack"
                    : "Approve")
                : "Deny Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
