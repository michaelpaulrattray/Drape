import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useEffect } from "react";
import { Button as FoundationButton } from "@/foundation";

import { toast } from "sonner";
import {
  PAGE_SIZE,
  type AuditLog,
} from "@/features/admin/adminConstants";
import { StaffBarAdmin, StaffLoading, StaffSurface } from "@/features/staff";
import { AuditStatsCards, AbuseAlertsPanel, AuditFiltersBar } from "@/features/admin/AuditLogsFilters";
import { AuditLogTable } from "@/features/admin/AuditLogTable";
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
    return <StaffLoading />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. */
  if (user?.role !== "admin") return <Redirect to="/app" />;

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
    <StaffSurface
      breadcrumb="Admin / Audit logs"
      bar={
        <StaffBarAdmin
          refreshControls={{
            autoRefresh,
            onToggleAutoRefresh: () => setAutoRefresh(!autoRefresh),
            onRefresh: handleRefresh,
            isRefetching: logsQuery.isRefetching,
            lastRefresh,
          }}
          /* The page's own action, carried across untouched — its styling is
             page content and belongs to brief 06, not to the frame. */
          right={
            <FoundationButton
              variant="secondary"
              size="small"
              onClick={handleExportCsv}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? "Exporting…" : "Export CSV"}
            </FoundationButton>
          }
        />
      }
    >
      <main className="space-y-6">
        <AuditStatsCards
          statsData={statsQuery.data}
          statsLoading={statsQuery.isLoading}
          alertsData={alertsQuery.data}
          alertsLoading={alertsQuery.isLoading}
        />

        {/* The page's two panes. `.dp-segmented` is the house's one segmented
            control — the same one the staff bar draws — rather than a third
            pair of hand-styled buttons. The count is omitted at zero, which is
            `showsMenuCount`'s rule and the staff bar's. */}
        <div className="dp-segmented" role="tablist" aria-label="Audit view">
          {([
            { value: "logs", label: "Audit logs" },
            { value: "blocked-ips", label: "Blocked IPs", count: blockedIpsQuery.data?.total },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={activeTab === option.value}
              className={`dp-segmented__seg${activeTab === option.value ? " dp-segmented__seg--on" : ""}`}
              onClick={() => setActiveTab(option.value)}
            >
              {option.label}
              {"count" in option && option.count ? (
                <span className="dp-segmented__count">{option.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Audit Logs Tab */}
        {activeTab === "logs" && (
          <>
            <AbuseAlertsPanel alertsData={alertsQuery.data} />
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
              selectedLog={selectedLog}
              onSelectLog={setSelectedLog}
              userDetails={userDetailsQuery.data ?? undefined}
              onFilterByUser={setUserIdSearch}
              onSuspendUser={(userId) => { setSuspendingUserId(userId); setSuspendModalOpen(true); }}
              onUnsuspendUser={handleUnsuspendUser}
              unsuspendPending={unsuspendMutation.isPending}
              onBlockIp={(ip) => { setBlockIpAddress(ip); setBlockIpModalOpen(true); }}
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

      {/* The two FORM modals stay: both need a typed reason before they fire,
          and a dialog is right for "type a reason and confirm" and wrong for
          "show me this". The detail modal, which only showed, is gone. */}
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
    </StaffSurface>
  );
}
