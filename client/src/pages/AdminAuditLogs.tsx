import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState, useEffect } from "react";
import {
  Shield,
  RefreshCw,
  Clock,
  Home,
  Download,
  Activity,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PAGE_SIZE,
  type AuditLog,
} from "@/features/admin/adminConstants";
import { AuditStatsCards, AbuseAlertsPanel, AuditFiltersBar } from "@/features/admin/AuditLogsFilters";
import { AuditLogTable } from "@/features/admin/AuditLogTable";
import { AuditLogDetailModal } from "@/features/admin/AuditLogDetailModal";
import { SuspendUserModal, BlockIpModal } from "@/features/admin/AuditActionModals";
import { BlockedIPsTab } from "@/features/admin/BlockedIPsTab";

export default function AdminAuditLogs() {
  const { user, isAuthenticated, loading } = useAuth();
  const [page, setPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userIdSearch, setUserIdSearch] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendingUserId, setSuspendingUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "blocked-ips">("logs");
  const [blockIpModalOpen, setBlockIpModalOpen] = useState(false);
  const [blockIpAddress, setBlockIpAddress] = useState("");
  const [blockIpReason, setBlockIpReason] = useState("");
  const [blockIpDuration, setBlockIpDuration] = useState<string>("permanent");

  // Queries
  const logsQuery = trpc.admin.getAuditLogs.useQuery(
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      severity: severityFilter as "info" | "warning" | "critical" | "all",
      actionCategory: categoryFilter as "billing" | "model" | "security" | "abuse" | "all",
      userId: userIdSearch ? parseInt(userIdSearch) : undefined,
    },
    { refetchInterval: autoRefresh ? 30000 : false }
  );

  useEffect(() => {
    if (logsQuery.data) setLastRefresh(new Date());
  }, [logsQuery.data]);

  const alertsQuery = trpc.admin.getAbuseAlerts.useQuery(
    { limit: 10 },
    { refetchInterval: autoRefresh ? 30000 : false }
  );
  const statsQuery = trpc.admin.getAuditStats.useQuery(
    undefined,
    { refetchInterval: autoRefresh ? 60000 : false }
  );
  const blockedIpsQuery = trpc.admin.listBlockedIPs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: activeTab === "blocked-ips" }
  );
  const userDetailsQuery = trpc.admin.getUserDetails.useQuery(
    { userId: selectedLog?.userId || 0 },
    { enabled: !!selectedLog?.userId }
  );

  // Mutations
  const exportMutation = trpc.admin.exportAuditLogs.useMutation();
  const suspendMutation = trpc.admin.suspendUser.useMutation();
  const unsuspendMutation = trpc.admin.unsuspendUser.useMutation();
  const blockIpMutation = trpc.admin.blockIP.useMutation();
  const unblockIpMutation = trpc.admin.unblockIP.useMutation();

  useEffect(() => {
    if (autoRefresh) toast.success("Auto-refresh enabled (30s interval)");
  }, [autoRefresh]);

  // Auth guards
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/dashboard" />;
  }

  // Handlers
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

  const handleExportCsv = async () => {
    try {
      const result = await exportMutation.mutateAsync({
        severity: severityFilter as "info" | "warning" | "critical" | "all",
        actionCategory: categoryFilter as "billing" | "model" | "security" | "abuse" | "all",
        userId: userIdSearch ? parseInt(userIdSearch) : undefined,
        maxRecords: 1000,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.recordCount} records`);
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  const handleSuspendUser = async () => {
    if (!suspendingUserId || !suspendReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }
    try {
      await suspendMutation.mutateAsync({ userId: suspendingUserId, reason: suspendReason.trim() });
      toast.success("User suspended successfully");
      setSuspendModalOpen(false);
      setSuspendReason("");
      setSuspendingUserId(null);
      logsQuery.refetch();
      userDetailsQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend user");
    }
  };

  const handleUnsuspendUser = async (userId: number) => {
    try {
      await unsuspendMutation.mutateAsync({ userId });
      toast.success("User unsuspended successfully");
      logsQuery.refetch();
      userDetailsQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to unsuspend user");
    }
  };

  const handleBlockIp = async () => {
    if (!blockIpAddress.trim() || !blockIpReason.trim()) {
      toast.error("Please provide IP address and reason");
      return;
    }
    try {
      const expiresInHours = blockIpDuration === "permanent" ? undefined :
        blockIpDuration === "1h" ? 1 :
        blockIpDuration === "24h" ? 24 :
        blockIpDuration === "7d" ? 168 :
        blockIpDuration === "30d" ? 720 : undefined;
      await blockIpMutation.mutateAsync({ ipAddress: blockIpAddress.trim(), reason: blockIpReason.trim(), expiresInHours });
      toast.success(`IP ${blockIpAddress} blocked successfully`);
      setBlockIpModalOpen(false);
      setBlockIpAddress("");
      setBlockIpReason("");
      setBlockIpDuration("permanent");
      blockedIpsQuery.refetch();
      logsQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to block IP");
    }
  };

  const handleUnblockIp = async (ipAddress: string) => {
    try {
      await unblockIpMutation.mutateAsync({ ipAddress });
      toast.success(`IP ${ipAddress} unblocked successfully`);
      blockedIpsQuery.refetch();
      logsQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to unblock IP");
    }
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
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={logsQuery.isRefetching} className="border-white/20 text-white">
                <RefreshCw className={`w-4 h-4 mr-2 ${logsQuery.isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportMutation.isPending} className="border-white/20 text-white">
                {exportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <AuditStatsCards
          statsData={statsQuery.data}
          statsLoading={statsQuery.isLoading}
          alertsData={alertsQuery.data}
          alertsLoading={alertsQuery.isLoading}
        />

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <Button
            variant={activeTab === "logs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("logs")}
            className={activeTab === "logs" ? "bg-emerald-600 hover:bg-emerald-700" : "text-white/60 hover:text-white"}
          >
            <Activity className="w-4 h-4 mr-2" />
            Audit Logs
          </Button>
          <Button
            variant={activeTab === "blocked-ips" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("blocked-ips")}
            className={activeTab === "blocked-ips" ? "bg-emerald-600 hover:bg-emerald-700" : "text-white/60 hover:text-white"}
          >
            <Globe className="w-4 h-4 mr-2" />
            Blocked IPs
            {blockedIpsQuery.data?.total ? (
              <Badge className="ml-2 bg-red-500/20 text-red-400">{blockedIpsQuery.data.total}</Badge>
            ) : null}
          </Button>
        </div>

        {/* Audit Logs Tab */}
        {activeTab === "logs" && (
          <>
            <AbuseAlertsPanel alertsData={alertsQuery.data} onSelectLog={setSelectedLog} />
            <AuditFiltersBar
              severityFilter={severityFilter}
              setSeverityFilter={setSeverityFilter}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              userIdSearch={userIdSearch}
              setUserIdSearch={setUserIdSearch}
              setPage={setPage as (fn: (p: number) => number) => void}
              onResetFilters={handleResetFilters}
            />
            <AuditLogTable
              logs={(logsQuery.data?.logs || []) as AuditLog[]}
              isLoading={logsQuery.isLoading}
              hasMore={logsQuery.data?.hasMore || false}
              page={page}
              setPage={setPage}
              onSelectLog={setSelectedLog}
            />
          </>
        )}

        {/* Blocked IPs Tab */}
        {activeTab === "blocked-ips" && (
          <BlockedIPsTab
            ips={blockedIpsQuery.data?.ips || []}
            isLoading={blockedIpsQuery.isLoading}
            onBlockIp={() => setBlockIpModalOpen(true)}
            onUnblockIp={handleUnblockIp}
            unblockPending={unblockIpMutation.isPending}
          />
        )}
      </main>

      {/* Modals */}
      <AuditLogDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        userDetails={userDetailsQuery.data ?? undefined}
        onFilterByUser={setUserIdSearch}
        onSuspendUser={(userId) => { setSuspendingUserId(userId); setSuspendModalOpen(true); }}
        onUnsuspendUser={handleUnsuspendUser}
        unsuspendPending={unsuspendMutation.isPending}
        onBlockIp={(ip) => { setBlockIpAddress(ip); setBlockIpModalOpen(true); }}
      />
      <SuspendUserModal
        open={suspendModalOpen}
        onOpenChange={setSuspendModalOpen}
        reason={suspendReason}
        setReason={setSuspendReason}
        onConfirm={handleSuspendUser}
        isPending={suspendMutation.isPending}
        onCancel={() => { setSuspendModalOpen(false); setSuspendReason(""); setSuspendingUserId(null); }}
      />
      <BlockIpModal
        open={blockIpModalOpen}
        onOpenChange={setBlockIpModalOpen}
        ipAddress={blockIpAddress}
        setIpAddress={setBlockIpAddress}
        reason={blockIpReason}
        setReason={setBlockIpReason}
        duration={blockIpDuration}
        setDuration={setBlockIpDuration}
        onConfirm={handleBlockIp}
        isPending={blockIpMutation.isPending}
        onCancel={() => { setBlockIpModalOpen(false); setBlockIpAddress(""); setBlockIpReason(""); setBlockIpDuration("permanent"); }}
      />
    </div>
  );
}
