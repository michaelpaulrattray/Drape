import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  User,
  Activity,
  X,
  Eye,
  Home,
  Globe,
  Send,
  FileText,
  Users,
  Ban,
  Loader2,
  Coins,
  Image,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Constants
const SEVERITY_COLORS = {
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
} as const;

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
} as const;

const CATEGORY_COLORS = {
  billing: "bg-emerald-500/10 text-emerald-400",
  model: "bg-purple-500/10 text-purple-400",
  security: "bg-orange-500/10 text-orange-400",
  abuse: "bg-red-500/10 text-red-400",
} as const;

const PAGE_SIZE = 20;

interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: "info" | "warning" | "critical";
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getActionCategory(action: string): keyof typeof CATEGORY_COLORS | null {
  if (action.startsWith("subscription.") || action.startsWith("credits.")) return "billing";
  if (action.startsWith("model.")) return "model";
  if (action.startsWith("auth.") || action.startsWith("security.")) return "security";
  if (action.startsWith("abuse.") || action.startsWith("moderator.")) return "abuse";
  return null;
}

function formatAction(action: string): string {
  return action
    .split(".")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" → ");
}

export default function ModeratorDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"audit-logs" | "users" | "blocked-ips">("audit-logs");
  const [userDetailTab, setUserDetailTab] = useState<"overview" | "credits" | "generations" | "activity">("overview");
  const [creditTypeFilter, setCreditTypeFilter] = useState<string>("all");
  const [creditPage, setCreditPage] = useState(0);
  const [genStatusFilter, setGenStatusFilter] = useState<string>("all");
  const [genTypeFilter, setGenTypeFilter] = useState<string>("all");
  const [genPage, setGenPage] = useState(0);
  const [page, setPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userIdSearch, setUserIdSearch] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Escalation modal state
  const [escalationOpen, setEscalationOpen] = useState(false);
  const [escalationActionType, setEscalationActionType] = useState<"suspendUser" | "blockIP" | "investigateUser" | "other">("investigateUser");
  const [escalationTargetId, setEscalationTargetId] = useState("");
  const [escalationTargetName, setEscalationTargetName] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [escalationSeverity, setEscalationSeverity] = useState<"warning" | "critical">("warning");
  const [escalationRelatedLogIds, setEscalationRelatedLogIds] = useState<number[]>([]);

  // User investigation state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Queries - using moderator endpoints
  const logsQuery = trpc.moderator.getAuditLogs.useQuery(
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      severity: severityFilter as "info" | "warning" | "critical" | "all",
      actionCategory: categoryFilter as "billing" | "model" | "security" | "abuse" | "all",
      userId: userIdSearch ? parseInt(userIdSearch) : undefined,
    },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  const alertsQuery = trpc.moderator.getAbuseAlerts.useQuery(
    { limit: 10 },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  const statsQuery = trpc.moderator.getAuditStats.useQuery(
    undefined,
    { refetchInterval: autoRefresh ? 60000 : false }
  );

  const blockedIpsQuery = trpc.moderator.listBlockedIPs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: activeTab === "blocked-ips" }
  );

  const usersQuery = trpc.moderator.listUsers.useQuery(
    {
      limit: PAGE_SIZE,
      offset: userPage * PAGE_SIZE,
      search: userSearchQuery || undefined,
    },
    { enabled: activeTab === "users" }
  );

  const userDetailsQuery = trpc.moderator.getUserFullDetails.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  const userActivityQuery = trpc.moderator.getUserActivity.useQuery(
    { userId: selectedUserId!, limit: 20 },
    { enabled: !!selectedUserId }
  );

  const creditHistoryQuery = trpc.moderator.getUserCreditHistory.useQuery(
    {
      userId: selectedUserId!,
      limit: 20,
      offset: creditPage * 20,
      type: creditTypeFilter as any,
    },
    { enabled: !!selectedUserId && userDetailTab === "credits" }
  );

  const generationHistoryQuery = trpc.moderator.getUserGenerationHistory.useQuery(
    {
      userId: selectedUserId!,
      limit: 20,
      offset: genPage * 20,
      status: genStatusFilter as any,
      type: genTypeFilter as any,
    },
    { enabled: !!selectedUserId && userDetailTab === "generations" }
  );

  // Escalation mutation
  const escalateMutation = trpc.moderator.escalateToAdmin.useMutation({
    onSuccess: (result) => {
      if (result.slackSent) {
        toast.success("Escalation sent to admin team via Slack");
      } else {
        toast.warning("Escalation logged but Slack notification could not be sent");
      }
      setEscalationOpen(false);
      resetEscalationForm();
    },
    onError: (error) => {
      toast.error(`Failed to escalate: ${error.message}`);
    },
  });

  useEffect(() => {
    if (logsQuery.data) setLastRefresh(new Date());
  }, [logsQuery.data]);

  useEffect(() => {
    if (autoRefresh) toast.success("Auto-refresh enabled (30s interval)");
  }, [autoRefresh]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
      </div>
    );
  }

  // Auth check
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Role check - allow moderators and admins
  if (user?.role !== "moderator" && user?.role !== "admin") {
    toast.error("Access denied. Moderator or admin privileges required.");
    return <Redirect to="/dashboard" />;
  }

  // Reset user detail sub-tab state when user changes
  useEffect(() => {
    setUserDetailTab("overview");
    setCreditPage(0);
    setGenPage(0);
    setCreditTypeFilter("all");
    setGenStatusFilter("all");
    setGenTypeFilter("all");
  }, [selectedUserId]);

  const handleRefresh = () => {
    logsQuery.refetch();
    alertsQuery.refetch();
    statsQuery.refetch();
    setLastRefresh(new Date());
    toast.success("Data refreshed");
  };

  const handleResetFilters = () => {
    setSeverityFilter("all");
    setCategoryFilter("all");
    setUserIdSearch("");
    setPage(0);
  };

  const resetEscalationForm = () => {
    setEscalationActionType("investigateUser");
    setEscalationTargetId("");
    setEscalationTargetName("");
    setEscalationReason("");
    setEscalationSeverity("warning");
    setEscalationRelatedLogIds([]);
  };

  const openEscalation = (options?: {
    actionType?: "suspendUser" | "blockIP" | "investigateUser" | "other";
    targetId?: string;
    targetName?: string;
    relatedLogIds?: number[];
  }) => {
    if (options?.actionType) setEscalationActionType(options.actionType);
    if (options?.targetId) setEscalationTargetId(options.targetId);
    if (options?.targetName) setEscalationTargetName(options.targetName);
    if (options?.relatedLogIds) setEscalationRelatedLogIds(options.relatedLogIds);
    setEscalationOpen(true);
  };

  const handleEscalate = () => {
    if (!escalationReason || escalationReason.length < 10) {
      toast.error("Please provide a detailed reason (at least 10 characters)");
      return;
    }
    if (!escalationTargetId) {
      toast.error("Please specify a target (user ID or IP address)");
      return;
    }

    escalateMutation.mutate({
      actionType: escalationActionType,
      targetId: escalationTargetId,
      targetName: escalationTargetName || undefined,
      reason: escalationReason,
      severity: escalationSeverity,
      relatedAuditLogIds: escalationRelatedLogIds.length > 0 ? escalationRelatedLogIds : undefined,
    });
  };

  const totalPages = Math.ceil((logsQuery.data?.total || 0) / PAGE_SIZE);
  const userTotalPages = Math.ceil((usersQuery.data?.total || 0) / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <h1 className="text-lg font-semibold">Moderator Dashboard</h1>
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                  Read-Only
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "bg-blue-600 hover:bg-blue-700" : "border-white/20 text-white"}
              >
                <Clock className="w-4 h-4 mr-2" />
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={logsQuery.isRefetching}
                className="border-white/20 text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${logsQuery.isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => openEscalation()}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Escalate to Admin
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {statsQuery.isLoading ? (
                <Skeleton className="h-8 w-20 bg-white/10" />
              ) : (
                <p className="text-2xl font-bold text-white">{statsQuery.data?.totalLogs || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Last 24 Hours</CardTitle>
            </CardHeader>
            <CardContent>
              {statsQuery.isLoading ? (
                <Skeleton className="h-8 w-20 bg-white/10" />
              ) : (
                <p className="text-2xl font-bold text-white">{statsQuery.data?.last24Hours || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Critical Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsQuery.isLoading ? (
                <Skeleton className="h-8 w-20 bg-white/10" />
              ) : (
                <p className="text-2xl font-bold text-red-400">{alertsQuery.data?.criticalCount || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsQuery.isLoading ? (
                <Skeleton className="h-8 w-20 bg-white/10" />
              ) : (
                <p className="text-2xl font-bold text-amber-400">{alertsQuery.data?.warningCount || 0}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <Button
            variant={activeTab === "audit-logs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("audit-logs")}
            className={activeTab === "audit-logs" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}
          >
            <Activity className="w-4 h-4 mr-2" />
            Audit Logs
          </Button>
          <Button
            variant={activeTab === "users" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("users")}
            className={activeTab === "users" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}
          >
            <Users className="w-4 h-4 mr-2" />
            User Investigation
          </Button>
          <Button
            variant={activeTab === "blocked-ips" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("blocked-ips")}
            className={activeTab === "blocked-ips" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}
          >
            <Globe className="w-4 h-4 mr-2" />
            Blocked IPs
            {blockedIpsQuery.data?.total ? (
              <Badge className="ml-2 bg-red-500/20 text-red-400">{blockedIpsQuery.data.total}</Badge>
            ) : null}
          </Button>
        </div>

        {/* ============ Audit Logs Tab ============ */}
        {activeTab === "audit-logs" && (
          <>
            {/* Abuse Alerts Panel */}
            {(alertsQuery.data?.criticalCount || 0) > 0 && (
              <Card className="bg-red-500/5 border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Active Abuse Alerts
                    <Badge className="bg-red-500/20 text-red-400 ml-2">{alertsQuery.data?.criticalCount}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alertsQuery.data?.alerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>
                            {alert.severity}
                          </Badge>
                          <span className="text-white/80">{formatAction(alert.action)}</span>
                          <span className="text-white/40 text-sm">{formatDate(alert.createdAt)}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => {
                            const metadata = alert.metadata as Record<string, unknown> | null;
                            openEscalation({
                              actionType: metadata?.ipAddress ? "blockIP" : "suspendUser",
                              targetId: metadata?.ipAddress as string || alert.userId?.toString() || "",
                              targetName: metadata?.userName as string || undefined,
                              relatedLogIds: [alert.id],
                            });
                          }}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Escalate
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search by User ID..."
                  value={userIdSearch}
                  onChange={(e) => { setUserIdSearch(e.target.value); setPage(0); }}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 w-48"
                />
              </div>
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="model">Model</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="abuse">Abuse</SelectItem>
                </SelectContent>
              </Select>
              {(severityFilter !== "all" || categoryFilter !== "all" || userIdSearch) && (
                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-white/60 hover:text-white">
                  <X className="w-4 h-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Logs Table */}
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">IP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="px-4 py-3" colSpan={6}>
                            <Skeleton className="h-6 w-full bg-white/10" />
                          </td>
                        </tr>
                      ))
                    ) : logsQuery.data?.logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No audit logs found
                        </td>
                      </tr>
                    ) : (
                      logsQuery.data?.logs.map((log) => {
                        const SeverityIcon = SEVERITY_ICONS[log.severity as keyof typeof SEVERITY_ICONS] || Info;
                        const category = getActionCategory(log.action);
                        return (
                          <tr
                            key={log.id}
                            className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                            onClick={() => setSelectedLog(log as AuditLog)}
                          >
                            <td className="px-4 py-3 text-sm text-white/60 whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}>
                                <SeverityIcon className="w-3 h-3 mr-1" />
                                {log.severity}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {category && (
                                  <Badge className={`${CATEGORY_COLORS[category]} text-xs`}>
                                    {category}
                                  </Badge>
                                )}
                                <span className="text-sm text-white/80">{formatAction(log.action)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/60">
                              {log.userId ? `#${log.userId}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/60 font-mono text-xs">
                              {log.ipAddress || "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-white/40 hover:text-white h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLog(log as AuditLog);
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                {(log.severity === "warning" || log.severity === "critical") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-400/60 hover:text-amber-400 h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const metadata = log.metadata as Record<string, unknown> | null;
                                      openEscalation({
                                        actionType: metadata?.ipAddress ? "blockIP" : log.userId ? "suspendUser" : "other",
                                        targetId: metadata?.ipAddress as string || log.userId?.toString() || "",
                                        targetName: metadata?.userName as string || undefined,
                                        relatedLogIds: [log.id],
                                      });
                                    }}
                                  >
                                    <Send className="w-3.5 h-3.5" />
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
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                  <span className="text-sm text-white/40">
                    Page {page + 1} of {totalPages} ({logsQuery.data?.total || 0} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="border-white/20 text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="border-white/20 text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ============ User Investigation Tab ============ */}
        {activeTab === "users" && (
          <>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search users by name, email, or ID..."
                  value={userSearchQuery}
                  onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(0); }}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User List */}
              <div className="lg:col-span-2">
                <Card className="bg-white/5 border-white/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Last Active</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersQuery.isLoading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-b border-white/5">
                              <td className="px-4 py-3" colSpan={5}>
                                <Skeleton className="h-6 w-full bg-white/10" />
                              </td>
                            </tr>
                          ))
                        ) : usersQuery.data?.users.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                              No users found
                            </td>
                          </tr>
                        ) : (
                          usersQuery.data?.users.map((u) => (
                            <tr
                              key={u.id}
                              className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${selectedUserId === u.id ? "bg-blue-500/10" : ""}`}
                              onClick={() => setSelectedUserId(u.id)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                                    {(u.name || "U").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{u.name || "Unnamed"}</div>
                                    <div className="text-xs text-white/40">{u.email || "No email"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={
                                  u.role === "admin" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                  u.role === "moderator" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                  "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                }>
                                  {u.role}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {u.suspendedAt ? (
                                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Suspended</Badge>
                                ) : u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Locked</Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-white/60">
                                {formatDate(new Date(u.lastSignedIn))}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-white/40 hover:text-white h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedUserId(u.id);
                                    }}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-400/60 hover:text-amber-400 h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEscalation({
                                        actionType: "suspendUser",
                                        targetId: u.id.toString(),
                                        targetName: u.name || u.email || undefined,
                                      });
                                    }}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* User Pagination */}
                  {userTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                      <span className="text-sm text-white/40">
                        Page {userPage + 1} of {userTotalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.max(0, p - 1))}
                          disabled={userPage === 0}
                          className="border-white/20 text-white"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.min(userTotalPages - 1, p + 1))}
                          disabled={userPage >= userTotalPages - 1}
                          className="border-white/20 text-white"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* User Details Sidebar */}
              <div>
                {selectedUserId ? (
                  <div className="space-y-4">
                    {/* User Profile Header */}
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-400" />
                          User Details
                          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs ml-auto">
                            View Only
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userDetailsQuery.isLoading ? (
                          <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="h-5 w-full bg-white/10" />
                            ))}
                          </div>
                        ) : userDetailsQuery.data ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/40">Name</span>
                              <span>{userDetailsQuery.data.user.name || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Email</span>
                              <span className="text-xs">{userDetailsQuery.data.user.email || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Role</span>
                              <Badge className={
                                userDetailsQuery.data.user.role === "admin" ? "bg-purple-500/10 text-purple-400" :
                                userDetailsQuery.data.user.role === "moderator" ? "bg-blue-500/10 text-blue-400" :
                                "bg-gray-500/10 text-gray-400"
                              }>
                                {userDetailsQuery.data.user.role}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Credits</span>
                              <span className="font-medium">{userDetailsQuery.data.credits?.balance ?? "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Joined</span>
                              <span className="text-xs">{formatDate(new Date(userDetailsQuery.data.user.createdAt))}</span>
                            </div>
                            {userDetailsQuery.data.user.suspendedAt && (
                              <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                <p className="text-red-400 text-xs font-medium">Suspended</p>
                                <p className="text-white/60 text-xs mt-1">{userDetailsQuery.data.user.suspendedReason || "No reason"}</p>
                              </div>
                            )}
                            <div className="pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                onClick={() => openEscalation({
                                  actionType: "suspendUser",
                                  targetId: selectedUserId.toString(),
                                  targetName: userDetailsQuery.data?.user.name || userDetailsQuery.data?.user.email || undefined,
                                })}
                              >
                                <Send className="w-3 h-3 mr-2" />
                                Escalate User
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-white/40 text-sm">User not found</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* User Detail Sub-Tabs */}
                    <div className="flex gap-1 border-b border-white/10 pb-1">
                      <Button
                        variant={userDetailTab === "overview" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setUserDetailTab("overview")}
                        className={`text-xs ${userDetailTab === "overview" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}`}
                      >
                        <Activity className="w-3 h-3 mr-1" />
                        Activity
                      </Button>
                      <Button
                        variant={userDetailTab === "credits" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setUserDetailTab("credits")}
                        className={`text-xs ${userDetailTab === "credits" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}`}
                      >
                        <Coins className="w-3 h-3 mr-1" />
                        Credits
                      </Button>
                      <Button
                        variant={userDetailTab === "generations" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setUserDetailTab("generations")}
                        className={`text-xs ${userDetailTab === "generations" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}`}
                      >
                        <Image className="w-3 h-3 mr-1" />
                        Generations
                      </Button>
                    </div>

                    {/* Activity Sub-Tab */}
                    {userDetailTab === "overview" && (
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
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
                              {userActivityQuery.data?.logs.map((log) => (
                                <div
                                  key={log.id}
                                  className="p-2 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                  onClick={() => setSelectedLog(log as AuditLog)}
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
                    )}

                    {/* Credits Sub-Tab */}
                    {userDetailTab === "credits" && (
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Coins className="w-4 h-4 text-emerald-400" />
                            Credit History
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Credit Summary */}
                          {creditHistoryQuery.data?.summary && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
                                <p className="text-xs text-emerald-400/60">Added</p>
                                <p className="text-sm font-bold text-emerald-400">+{creditHistoryQuery.data.summary.totalCreditsEarned}</p>
                              </div>
                              <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
                                <p className="text-xs text-red-400/60">Used</p>
                                <p className="text-sm font-bold text-red-400">-{creditHistoryQuery.data.summary.totalCreditsSpent}</p>
                              </div>
                              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-center">
                                <p className="text-xs text-blue-400/60">Balance</p>
                                <p className="text-sm font-bold text-blue-400">{creditHistoryQuery.data.summary.netChange}</p>
                              </div>
                            </div>
                          )}

                          {/* Credit Type Filter */}
                          <div className="flex gap-2 mb-3">
                            <Select value={creditTypeFilter} onValueChange={(v) => { setCreditTypeFilter(v); setCreditPage(0); }}>
                              <SelectTrigger className="w-full bg-white/5 border-white/10 text-white text-xs h-8">
                                <SelectValue placeholder="Filter by type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="purchase">Purchases</SelectItem>
                                <SelectItem value="usage">Usage</SelectItem>
                                <SelectItem value="admin_adjustment">Admin Adjustments</SelectItem>
                                <SelectItem value="refund">Refunds</SelectItem>
                                <SelectItem value="bonus">Bonuses</SelectItem>
                                <SelectItem value="expiry">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Credit Transaction List */}
                          {creditHistoryQuery.isLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full bg-white/10" />
                              ))}
                            </div>
                          ) : creditHistoryQuery.data?.transactions.length === 0 ? (
                            <p className="text-white/40 text-sm text-center py-4">No credit transactions found</p>
                          ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                              {creditHistoryQuery.data?.transactions.map((tx) => (
                                <div key={tx.id} className="p-2.5 rounded bg-white/5 border border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {tx.amount > 0 ? (
                                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <ArrowDown className="w-3.5 h-3.5 text-red-400" />
                                      )}
                                      <span className={`text-sm font-medium ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                                      </span>
                                    </div>
                                    <Badge className={
                                      tx.type === "purchase" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                      tx.type === "usage" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                      tx.type === "admin_adjustment" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                      tx.type === "refund" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                      tx.type === "bonus" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                                      "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                    }>
                                      {tx.type.replace("_", " ")}
                                    </Badge>
                                  </div>
                                  {tx.description && (
                                    <p className="text-xs text-white/50 mt-1 truncate">{tx.description}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-white/30">{formatDate(new Date(tx.createdAt))}</span>
                                    <span className="text-xs text-white/30">Balance: {tx.balanceAfter}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Credit Pagination */}
                          {(creditHistoryQuery.data?.total || 0) > 20 && (
                            <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
                              <span className="text-xs text-white/40">
                                Page {creditPage + 1} of {Math.ceil((creditHistoryQuery.data?.total || 0) / 20)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCreditPage(p => Math.max(0, p - 1))}
                                  disabled={creditPage === 0}
                                  className="border-white/20 text-white h-7 w-7 p-0"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCreditPage(p => p + 1)}
                                  disabled={(creditPage + 1) * 20 >= (creditHistoryQuery.data?.total || 0)}
                                  className="border-white/20 text-white h-7 w-7 p-0"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Generations Sub-Tab */}
                    {userDetailTab === "generations" && (
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Image className="w-4 h-4 text-violet-400" />
                            Generation History
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Generation Summary */}
                          {generationHistoryQuery.data?.summary && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
                                <p className="text-xs text-emerald-400/60">Completed</p>
                                <p className="text-sm font-bold text-emerald-400">{generationHistoryQuery.data.summary.completedCount}</p>
                              </div>
                              <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
                                <p className="text-xs text-red-400/60">Failed</p>
                                <p className="text-sm font-bold text-red-400">{generationHistoryQuery.data.summary.failedCount}</p>
                              </div>
                              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-center">
                                <p className="text-xs text-blue-400/60">Credits Used</p>
                                <p className="text-sm font-bold text-blue-400">{generationHistoryQuery.data.summary.totalCreditsUsed}</p>
                              </div>
                            </div>
                          )}

                          {/* Generation Filters */}
                          <div className="flex gap-2 mb-3">
                            <Select value={genStatusFilter} onValueChange={(v) => { setGenStatusFilter(v); setGenPage(0); }}>
                              <SelectTrigger className="w-1/2 bg-white/5 border-white/10 text-white text-xs h-8">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="queued">Queued</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={genTypeFilter} onValueChange={(v) => { setGenTypeFilter(v); setGenPage(0); }}>
                              <SelectTrigger className="w-1/2 bg-white/5 border-white/10 text-white text-xs h-8">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="headshot">Headshot</SelectItem>
                                <SelectItem value="full_body">Full Body</SelectItem>
                                <SelectItem value="creative">Creative</SelectItem>
                                <SelectItem value="background_swap">BG Swap</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Generation List */}
                          {generationHistoryQuery.isLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full bg-white/10" />
                              ))}
                            </div>
                          ) : generationHistoryQuery.data?.generations.length === 0 ? (
                            <p className="text-white/40 text-sm text-center py-4">No generations found</p>
                          ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                              {generationHistoryQuery.data?.generations.map((gen) => (
                                <div key={gen.id} className="p-2.5 rounded bg-white/5 border border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {gen.status === "completed" ? (
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : gen.status === "failed" ? (
                                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                                      ) : (
                                        <ClockIcon className="w-3.5 h-3.5 text-amber-400" />
                                      )}
                                      <span className="text-sm text-white/80">#{gen.id}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className={
                                        gen.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        gen.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                        gen.status === "processing" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                      }>
                                        {gen.status}
                                      </Badge>
                                      {gen.pointsCost > 0 && (
                                        <span className="text-xs text-white/40">{gen.pointsCost} cr</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">
                                      {(gen.type || "unknown").replace("_", " ")}
                                    </Badge>
                                    {gen.modelName && (
                                      <span className="text-xs text-white/40 truncate">Model: {gen.modelName}</span>
                                    )}
                                  </div>
                                  {gen.errorMessage && (
                                    <p className="text-xs text-red-400/80 mt-1 truncate">Error: {gen.errorMessage}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-white/30">{formatDate(new Date(gen.createdAt))}</span>
                                    {gen.completedAt && gen.createdAt && (
                                      <span className="text-xs text-white/30">{((new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime()) / 1000).toFixed(1)}s</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Generation Pagination */}
                          {(generationHistoryQuery.data?.total || 0) > 20 && (
                            <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
                              <span className="text-xs text-white/40">
                                Page {genPage + 1} of {Math.ceil((generationHistoryQuery.data?.total || 0) / 20)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setGenPage(p => Math.max(0, p - 1))}
                                  disabled={genPage === 0}
                                  className="border-white/20 text-white h-7 w-7 p-0"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setGenPage(p => p + 1)}
                                  disabled={(genPage + 1) * 20 >= (generationHistoryQuery.data?.total || 0)}
                                  className="border-white/20 text-white h-7 w-7 p-0"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="py-12 text-center">
                      <User className="w-8 h-8 mx-auto mb-3 text-white/20" />
                      <p className="text-white/40 text-sm">Select a user to view details</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {/* ============ Blocked IPs Tab ============ */}
        {activeTab === "blocked-ips" && (
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Blocked By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Blocked At</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedIpsQuery.isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="px-4 py-3" colSpan={5}>
                          <Skeleton className="h-6 w-full bg-white/10" />
                        </td>
                      </tr>
                    ))
                  ) : blockedIpsQuery.data?.ips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                        <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No blocked IPs
                      </td>
                    </tr>
                  ) : (
                    blockedIpsQuery.data?.ips.map((ip) => (
                      <tr key={ip.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm">{ip.ipAddress}</td>
                        <td className="px-4 py-3 text-sm text-white/60">{ip.reason}</td>
                        <td className="px-4 py-3 text-sm text-white/60">Admin #{ip.blockedBy}</td>
                        <td className="px-4 py-3 text-sm text-white/60">
                          {ip.expiresAt ? formatDate(new Date(ip.expiresAt)) : "Permanent"}
                        </td>
                        <td className="px-4 py-3 text-sm text-white/60">
                          {formatDate(new Date(ip.createdAt))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* ============ Log Detail Modal ============ */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Audit Log Detail
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">Log ID</p>
                  <p className="text-sm">#{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Severity</p>
                  <Badge className={SEVERITY_COLORS[selectedLog.severity]}>
                    {selectedLog.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Action</p>
                  <p className="text-sm">{formatAction(selectedLog.action)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Time</p>
                  <p className="text-sm">{formatFullDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">User ID</p>
                  <p className="text-sm">{selectedLog.userId ? `#${selectedLog.userId}` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">IP Address</p>
                  <p className="text-sm font-mono">{selectedLog.ipAddress || "—"}</p>
                </div>
                {selectedLog.resourceType && (
                  <div>
                    <p className="text-xs text-white/40 mb-1">Resource Type</p>
                    <p className="text-sm">{selectedLog.resourceType}</p>
                  </div>
                )}
                {selectedLog.resourceId && (
                  <div>
                    <p className="text-xs text-white/40 mb-1">Resource ID</p>
                    <p className="text-sm font-mono">{selectedLog.resourceId}</p>
                  </div>
                )}
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-2">Metadata</p>
                  <pre className="bg-white/5 rounded-lg p-3 text-xs overflow-x-auto text-white/80 max-h-48">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <p className="text-xs text-white/40 mb-1">User Agent</p>
                  <p className="text-xs text-white/60 break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {/* Escalation button in detail view */}
              {(selectedLog.severity === "warning" || selectedLog.severity === "critical") && (
                <div className="pt-2 border-t border-white/10">
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      const metadata = selectedLog.metadata as Record<string, unknown> | null;
                      openEscalation({
                        actionType: metadata?.ipAddress ? "blockIP" : selectedLog.userId ? "suspendUser" : "other",
                        targetId: metadata?.ipAddress as string || selectedLog.userId?.toString() || "",
                        targetName: metadata?.userName as string || undefined,
                        relatedLogIds: [selectedLog.id],
                      });
                      setSelectedLog(null);
                    }}
                  >
                    <Send className="w-3 h-3 mr-2" />
                    Escalate to Admin
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ Escalation Modal ============ */}
      <Dialog open={escalationOpen} onOpenChange={(open) => { if (!open) { setEscalationOpen(false); resetEscalationForm(); } }}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-400" />
              Escalate to Admin
            </DialogTitle>
            <DialogDescription className="text-white/50">
              This will send a notification to the #admin-actions Slack channel for admin review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Action Type</label>
              <Select value={escalationActionType} onValueChange={(v) => setEscalationActionType(v as typeof escalationActionType)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suspendUser">Suspend User</SelectItem>
                  <SelectItem value="blockIP">Block IP Address</SelectItem>
                  <SelectItem value="investigateUser">Investigate User</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">
                {escalationActionType === "blockIP" ? "IP Address" : "User ID"}
              </label>
              <Input
                value={escalationTargetId}
                onChange={(e) => setEscalationTargetId(e.target.value)}
                placeholder={escalationActionType === "blockIP" ? "e.g., 192.168.1.1" : "e.g., 42"}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">Target Name (optional)</label>
              <Input
                value={escalationTargetName}
                onChange={(e) => setEscalationTargetName(e.target.value)}
                placeholder="User name or description"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">Severity</label>
              <Select value={escalationSeverity} onValueChange={(v) => setEscalationSeverity(v as "warning" | "critical")}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1 block">Reason (min 10 characters)</label>
              <Textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Describe the issue and why admin action is needed..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[100px]"
              />
              <p className="text-xs text-white/30 mt-1">{escalationReason.length}/2000 characters</p>
            </div>

            {escalationRelatedLogIds.length > 0 && (
              <div>
                <label className="text-xs text-white/40 mb-1 block">Related Audit Logs</label>
                <div className="flex gap-1 flex-wrap">
                  {escalationRelatedLogIds.map(id => (
                    <Badge key={id} className="bg-white/10 text-white/60">
                      #{id}
                      <button
                        className="ml-1 hover:text-white"
                        onClick={() => setEscalationRelatedLogIds(ids => ids.filter(i => i !== id))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEscalationOpen(false); resetEscalationForm(); }}
              className="border-white/20 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEscalate}
              disabled={escalateMutation.isPending || escalationReason.length < 10 || !escalationTargetId}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {escalateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Escalation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
