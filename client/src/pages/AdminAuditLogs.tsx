import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState, useEffect } from "react";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  X,
  Eye,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Constants moved outside component
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
  if (action.startsWith("abuse.")) return "abuse";
  return null;
}

function formatAction(action: string): string {
  return action
    .split(".")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" → ");
}

export default function AdminAuditLogs() {
  const { user, isAuthenticated, loading } = useAuth();
  const [page, setPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userIdSearch, setUserIdSearch] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Queries
  const logsQuery = trpc.admin.getAuditLogs.useQuery(
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      severity: severityFilter as "info" | "warning" | "critical" | "all",
      actionCategory: categoryFilter as "billing" | "model" | "security" | "abuse" | "all",
      userId: userIdSearch ? parseInt(userIdSearch) : undefined,
    },
    {
      refetchInterval: autoRefresh ? 30000 : false,
    }
  );

  // Update last refresh time when data changes
  useEffect(() => {
    if (logsQuery.data) {
      setLastRefresh(new Date());
    }
  }, [logsQuery.data]);

  const alertsQuery = trpc.admin.getAbuseAlerts.useQuery(
    { limit: 10 },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  const statsQuery = trpc.admin.getAuditStats.useQuery(
    undefined,
    { refetchInterval: autoRefresh ? 60000 : false }
  );

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      toast.success("Auto-refresh enabled (30s interval)");
    }
  }, [autoRefresh]);

  // Redirect non-admin users
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/dashboard" />;
  }

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
                <Shield className="w-5 h-5 text-emerald-400" />
                <h1 className="text-lg font-semibold">Audit Logs</h1>
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
                className={autoRefresh ? "bg-emerald-600 hover:bg-emerald-700" : "border-white/20 text-white"}
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

        {/* Abuse Alerts Panel */}
        {(alertsQuery.data?.criticalCount || 0) > 0 && (
          <Card className="bg-red-500/5 border-red-500/20">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Active Abuse Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alertsQuery.data?.alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(alert as AuditLog)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>
                        {alert.severity}
                      </Badge>
                      <span className="text-white/80">{formatAction(alert.action)}</span>
                      {alert.userId && (
                        <span className="text-white/40 text-sm">User #{alert.userId}</span>
                      )}
                    </div>
                    <span className="text-white/40 text-sm">{formatDate(alert.createdAt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    placeholder="Search by User ID..."
                    value={userIdSearch}
                    onChange={(e) => {
                      setUserIdSearch(e.target.value);
                      setPage(0);
                    }}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
              </div>
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full md:w-40 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full md:w-40 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="model">Model</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="abuse">Abuse</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-white/60 hover:text-white"
              >
                <X className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            {logsQuery.isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-white/10" />
                ))}
              </div>
            ) : logsQuery.data?.logs.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found matching your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logsQuery.data?.logs.map((log) => {
                  const category = getActionCategory(log.action);
                  const SeverityIcon = SEVERITY_ICONS[log.severity as keyof typeof SEVERITY_ICONS];
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                      onClick={() => setSelectedLog(log as AuditLog)}
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
            {(logsQuery.data?.logs.length || 0) > 0 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                <span className="text-sm text-white/40">
                  Showing {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + (logsQuery.data?.logs.length || 0)}
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
                    disabled={!logsQuery.data?.hasMore}
                    className="border-white/20 text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Log Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Audit Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/40 uppercase">ID</label>
                  <p className="font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase">Timestamp</label>
                  <p>{formatFullDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase">Action</label>
                  <p>{formatAction(selectedLog.action)}</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase">Severity</label>
                  <Badge className={SEVERITY_COLORS[selectedLog.severity]}>{selectedLog.severity}</Badge>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase">User ID</label>
                  <p>{selectedLog.userId || "System"}</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase">Resource</label>
                  <p>{selectedLog.resourceType ? `${selectedLog.resourceType}: ${selectedLog.resourceId}` : "N/A"}</p>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-white/40 uppercase">IP Address</label>
                <p className="font-mono text-sm">{selectedLog.ipAddress || "N/A"}</p>
              </div>
              
              <div>
                <label className="text-xs text-white/40 uppercase">User Agent</label>
                <p className="text-sm text-white/60 break-all">{selectedLog.userAgent || "N/A"}</p>
              </div>
              
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="text-xs text-white/40 uppercase mb-2 block">Metadata</label>
                  <pre className="bg-white/5 rounded-lg p-4 text-sm overflow-x-auto font-mono text-white/80">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUserIdSearch(selectedLog.userId?.toString() || "");
                    setSelectedLog(null);
                  }}
                  disabled={!selectedLog.userId}
                  className="border-white/20 text-white"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filter by User
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
