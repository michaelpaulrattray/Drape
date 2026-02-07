import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AuditLogsTab,
  UserInvestigationTab,
  BlockedIPsTab,
  MyRequestsTab,
  FlaggedReferralsTab,
  LogDetailModal,
  ChangeRequestModal,
  DashboardHeader,
  StatsCards,
  FlaggedDiscrepanciesCard,
  TabNavigation,
  PAGE_SIZE,
  type AuditLog,
  type ModeratorTab,
  type ChangeRequestType,
  type ChangeRequestPriority,
  type OpenChangeRequestOptions,
} from "@/features/moderator";

export default function ModeratorDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ModeratorTab>("audit-logs");
  const [page, setPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [userIdSearch, setUserIdSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  // Change request form state
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [crType, setCrType] = useState<ChangeRequestType>("note_incident");
  const [crPriority, setCrPriority] = useState<ChangeRequestPriority>("normal");
  const [crTargetUserId, setCrTargetUserId] = useState("");
  const [crTargetUserName, setCrTargetUserName] = useState("");
  const [crTitle, setCrTitle] = useState("");
  const [crDescription, setCrDescription] = useState("");
  const [crEvidenceSummary, setCrEvidenceSummary] = useState("");
  const [crRelatedAuditLogId, setCrRelatedAuditLogId] = useState("");
  const [crCreditAmount, setCrCreditAmount] = useState("");
  const [crCreditReason, setCrCreditReason] = useState("");
  const [crIpAddress, setCrIpAddress] = useState("");
  const [crStripeSessionId, setCrStripeSessionId] = useState("");
  const [crRefundType, setCrRefundType] = useState<"full" | "proportional">("proportional");
  const [crOriginalAmountCents, setCrOriginalAmountCents] = useState(0);
  const [crOriginalCredits, setCrOriginalCredits] = useState(0);

  // User investigation state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // User detail filter state (lifted from UserInvestigationTab so queries get real values)
  const [creditTypeFilter, setCreditTypeFilter] = useState("all");
  const [creditPage, setCreditPage] = useState(0);
  const [creditStartDate, setCreditStartDate] = useState("");
  const [creditEndDate, setCreditEndDate] = useState("");
  const [genStatusFilter, setGenStatusFilter] = useState("all");
  const [genTypeFilter, setGenTypeFilter] = useState("all");
  const [genPage, setGenPage] = useState(0);
  const [genStartDate, setGenStartDate] = useState("");
  const [genEndDate, setGenEndDate] = useState("");

  // Audit log date range state
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");

  // Flagged referrals state
  const [flaggedPage, setFlaggedPage] = useState(0);

  // ── Queries ──

  const logsQuery = trpc.moderator.getAuditLogs.useQuery(
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      severity: severityFilter as "info" | "warning" | "critical" | "all",
      actionCategory: categoryFilter as "billing" | "model" | "security" | "abuse" | "all",
      userId: userIdSearch && !isNaN(parseInt(userIdSearch)) ? parseInt(userIdSearch) : undefined,
      startDate: logStartDate || undefined,
      endDate: logEndDate || undefined,
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
    { limit: PAGE_SIZE, offset: userPage * PAGE_SIZE, search: userSearchQuery || undefined },
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
      userId: selectedUserId!, limit: 20, offset: creditPage * 20, type: creditTypeFilter as any,
      startDate: creditStartDate || undefined, endDate: creditEndDate || undefined,
    },
    { enabled: !!selectedUserId }
  );

  const generationHistoryQuery = trpc.moderator.getUserGenerationHistory.useQuery(
    {
      userId: selectedUserId!, limit: 20, offset: genPage * 20, status: genStatusFilter as any, type: genTypeFilter as any,
      startDate: genStartDate || undefined, endDate: genEndDate || undefined,
    },
    { enabled: !!selectedUserId }
  );

  const flaggedReferralsQuery = trpc.moderator.getFlaggedReferrals.useQuery(
    { limit: 20, offset: flaggedPage * 20 },
    { enabled: activeTab === "flagged-referrals" }
  );

  const myRequestsQuery = trpc.moderator.getMyChangeRequests.useQuery(
    { limit: 50, offset: 0 },
    { enabled: activeTab === "my-requests" }
  );

  const createChangeRequestMutation = trpc.moderator.createChangeRequest.useMutation({
    onSuccess: (result) => {
      toast[result.slackSent ? "success" : "warning"](
        `Change request #${result.requestId} submitted${result.slackSent ? " and admin team notified" : " but Slack notification could not be sent"}`
      );
      setChangeRequestOpen(false);
      resetChangeRequestForm();
      myRequestsQuery.refetch();
    },
    onError: (error) => toast.error(`Failed to submit change request: ${error.message}`),
  });

  // ── Effects ──

  useEffect(() => { if (logsQuery.data) setLastRefresh(new Date()); }, [logsQuery.data]);
  useEffect(() => { if (autoRefresh) toast.success("Auto-refresh enabled (30s interval)"); }, [autoRefresh]);

  const isUnauthorized = !loading && isAuthenticated && user?.role !== "moderator" && user?.role !== "admin";
  useEffect(() => { if (isUnauthorized) toast.error("Access denied. Moderator or admin privileges required."); }, [isUnauthorized]);

  // ── Handlers ──

  const handleRefresh = () => {
    logsQuery.refetch(); alertsQuery.refetch(); statsQuery.refetch();
    setLastRefresh(new Date());
    toast.success("Data refreshed");
  };

  const handleResetFilters = () => {
    setSeverityFilter("all"); setCategoryFilter("all"); setUserIdSearch(""); setLogStartDate(""); setLogEndDate(""); setPage(0);
  };

  const resetChangeRequestForm = () => {
    setCrType("note_incident"); setCrPriority("normal");
    setCrTargetUserId(""); setCrTargetUserName("");
    setCrTitle(""); setCrDescription(""); setCrEvidenceSummary(""); setCrRelatedAuditLogId("");
    setCrCreditAmount(""); setCrCreditReason(""); setCrIpAddress("");
    setCrStripeSessionId(""); setCrRefundType("proportional");
    setCrOriginalAmountCents(0); setCrOriginalCredits(0);
  };

  const openChangeRequest = (options?: OpenChangeRequestOptions) => {
    resetChangeRequestForm();
    if (options?.type) setCrType(options.type);
    if (options?.targetUserId) setCrTargetUserId(options.targetUserId);
    if (options?.targetUserName) setCrTargetUserName(options.targetUserName);
    if (options?.relatedAuditLogId) setCrRelatedAuditLogId(String(options.relatedAuditLogId));
    if (options?.ipAddress) setCrIpAddress(options.ipAddress);
    if (options?.stripeSessionId) setCrStripeSessionId(options.stripeSessionId);
    if (options?.originalAmountCents) setCrOriginalAmountCents(options.originalAmountCents);
    if (options?.originalCredits) setCrOriginalCredits(options.originalCredits);
    setChangeRequestOpen(true);
  };

  const linkAttachmentsMutation = trpc.moderatorAttachments.linkAttachments.useMutation();

  const handleSubmitChangeRequest = (attachmentIds: number[]) => {
    if (!crTitle || crTitle.length < 5) return toast.error("Please provide a title (at least 5 characters)");
    if (!crDescription || crDescription.length < 10) return toast.error("Please provide a description (at least 10 characters)");
    if (!crTargetUserId || isNaN(parseInt(crTargetUserId))) return toast.error("Please specify a valid target user ID");
    if ((crType === "refund_credits" || crType === "add_credits") && (!crCreditAmount || parseInt(crCreditAmount) < 1)) return toast.error("Please specify a valid credit amount");
    if (crType === "block_ip" && !crIpAddress) return toast.error("Please specify an IP address");
    if (crType === "stripe_refund" && !crStripeSessionId) return toast.error("Stripe session ID is required for refund requests");

    createChangeRequestMutation.mutate({
      type: crType, priority: crPriority,
      targetUserId: parseInt(crTargetUserId),
      targetUserName: crTargetUserName || undefined,
      title: crTitle, description: crDescription,
      evidenceSummary: crEvidenceSummary || undefined,
      relatedAuditLogId: crRelatedAuditLogId ? parseInt(crRelatedAuditLogId) : undefined,
      creditAmount: crCreditAmount ? parseInt(crCreditAmount) : undefined,
      creditReason: crCreditReason || undefined,
      ipAddress: crIpAddress || undefined,
      stripeSessionId: crStripeSessionId || undefined,
      refundType: crType === "stripe_refund" ? crRefundType : undefined,
      originalAmountCents: crType === "stripe_refund" ? crOriginalAmountCents : undefined,
      originalCredits: crType === "stripe_refund" ? crOriginalCredits : undefined,
    }, {
      onSuccess: (result) => {
        if (attachmentIds.length > 0 && result.requestId) {
          linkAttachmentsMutation.mutate({ changeRequestId: result.requestId, attachmentIds });
        }
      },
    });
  };

  // ── Guards ──

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (isUnauthorized) return <Redirect to="/dashboard" />;

  const totalPages = Math.ceil((logsQuery.data?.total || 0) / PAGE_SIZE);
  const userTotalPages = Math.ceil((usersQuery.data?.total || 0) / PAGE_SIZE);

  // ── Render ──

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DashboardHeader
        lastRefresh={lastRefresh}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        onRefresh={handleRefresh}
        isRefetching={logsQuery.isRefetching}
        onNewChangeRequest={() => openChangeRequest()}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <StatsCards statsQuery={statsQuery} alertsQuery={alertsQuery} />

        <FlaggedDiscrepanciesCard
          onSelectUser={(userId) => {
            setSelectedUserId(userId);
            setActiveTab("users");
          }}
          autoRefreshInterval={autoRefresh ? 60000 : false}
        />

        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          blockedIpCount={blockedIpsQuery.data?.total}
          flaggedReferralCount={flaggedReferralsQuery.data?.total}
          pendingRequestCount={myRequestsQuery.data?.summary?.pendingCount}
        />

        {activeTab === "audit-logs" && (
          <AuditLogsTab
            logsQuery={logsQuery} alertsQuery={alertsQuery}
            page={page} setPage={setPage}
            severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            userIdSearch={userIdSearch} setUserIdSearch={setUserIdSearch}
            startDate={logStartDate} setStartDate={setLogStartDate}
            endDate={logEndDate} setEndDate={setLogEndDate}
            totalPages={totalPages}
            onSelectLog={setSelectedLog}
            onOpenChangeRequest={openChangeRequest}
            onResetFilters={handleResetFilters}
          />
        )}

        {activeTab === "users" && (
          <UserInvestigationTab
            usersQuery={usersQuery} userDetailsQuery={userDetailsQuery}
            userActivityQuery={userActivityQuery} creditHistoryQuery={creditHistoryQuery}
            generationHistoryQuery={generationHistoryQuery}
            userSearchQuery={userSearchQuery} setUserSearchQuery={setUserSearchQuery}
            userPage={userPage} setUserPage={setUserPage}
            selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId}
            userTotalPages={userTotalPages}
            onSelectLog={setSelectedLog} onOpenChangeRequest={openChangeRequest}
            creditTypeFilter={creditTypeFilter} setCreditTypeFilter={setCreditTypeFilter}
            creditPage={creditPage} setCreditPage={setCreditPage}
            creditStartDate={creditStartDate} setCreditStartDate={setCreditStartDate}
            creditEndDate={creditEndDate} setCreditEndDate={setCreditEndDate}
            genStatusFilter={genStatusFilter} setGenStatusFilter={setGenStatusFilter}
            genTypeFilter={genTypeFilter} setGenTypeFilter={setGenTypeFilter}
            genPage={genPage} setGenPage={setGenPage}
            genStartDate={genStartDate} setGenStartDate={setGenStartDate}
            genEndDate={genEndDate} setGenEndDate={setGenEndDate}
          />
        )}

        {activeTab === "blocked-ips" && <BlockedIPsTab blockedIpsQuery={blockedIpsQuery} />}

        {activeTab === "flagged-referrals" && (
          <FlaggedReferralsTab
            data={flaggedReferralsQuery.data}
            isLoading={flaggedReferralsQuery.isLoading}
            page={flaggedPage}
            setPage={setFlaggedPage}
            onOpenChangeRequest={openChangeRequest}
          />
        )}

        {activeTab === "my-requests" && (
          <MyRequestsTab data={myRequestsQuery.data} isLoading={myRequestsQuery.isLoading} refetch={() => myRequestsQuery.refetch()} />
        )}
      </main>

      <LogDetailModal
        selectedLog={selectedLog}
        onClose={() => setSelectedLog(null)}
        onOpenChangeRequest={(opts) => { openChangeRequest(opts); setSelectedLog(null); }}
      />

      <ChangeRequestModal
        open={changeRequestOpen}
        onOpenChange={(open) => { if (!open) { setChangeRequestOpen(false); resetChangeRequestForm(); } }}
        isPending={createChangeRequestMutation.isPending}
        onSubmit={handleSubmitChangeRequest}
        crType={crType} setCrType={setCrType}
        crPriority={crPriority} setCrPriority={setCrPriority}
        crTargetUserId={crTargetUserId} setCrTargetUserId={setCrTargetUserId}
        crTargetUserName={crTargetUserName} setCrTargetUserName={setCrTargetUserName}
        crTitle={crTitle} setCrTitle={setCrTitle}
        crDescription={crDescription} setCrDescription={setCrDescription}
        crEvidenceSummary={crEvidenceSummary} setCrEvidenceSummary={setCrEvidenceSummary}
        crRelatedAuditLogId={crRelatedAuditLogId} setCrRelatedAuditLogId={setCrRelatedAuditLogId}
        crCreditAmount={crCreditAmount} setCrCreditAmount={setCrCreditAmount}
        crCreditReason={crCreditReason} setCrCreditReason={setCrCreditReason}
        crIpAddress={crIpAddress} setCrIpAddress={setCrIpAddress}
        crStripeSessionId={crStripeSessionId} setCrStripeSessionId={setCrStripeSessionId}
        crRefundType={crRefundType} setCrRefundType={setCrRefundType}
        crOriginalAmountCents={crOriginalAmountCents} setCrOriginalAmountCents={setCrOriginalAmountCents}
        crOriginalCredits={crOriginalCredits} setCrOriginalCredits={setCrOriginalCredits}
      />
    </div>
  );
}
