import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState } from "react";
import { Users, RefreshCw, ChevronLeft, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserStatsCards } from "@/features/admin/UserStatsCards";
import { UserFilters } from "@/features/admin/UserFilters";
import { UserTable } from "@/features/admin/UserTable";
import { UserDetailModal } from "@/features/admin/UserDetailModal";
import { SuspendModal, CreditModal, RoleChangeModal } from "@/features/admin/UserActionModals";

const ITEMS_PER_PAGE = 20;

export default function AdminUserManagement() {
  const { user, isAuthenticated, loading } = useAuth();

  // List state
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "locked" | "frozen">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin" | "moderator">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSignedIn" | "name">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "credits" | "activity">("profile");

  // Modal state
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditAction, setCreditAction] = useState<"add" | "deduct">("add");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<"user" | "moderator">("moderator");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
  const [unfreezeNotes, setUnfreezeNotes] = useState("");

  // Queries
  const statsQuery = trpc.admin.getUserStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const usersQuery = trpc.admin.listUsers.useQuery({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    search: search || undefined,
    status: statusFilter,
    role: roleFilter,
    sortBy,
    sortOrder,
  }, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const userDetailsQuery = trpc.admin.getUserFullDetails.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && isAuthenticated && user?.role === "admin" }
  );

  const userActivityQuery = trpc.admin.getUserActivity.useQuery(
    { userId: selectedUserId!, limit: 50 },
    { enabled: !!selectedUserId && activeTab === "activity" && isAuthenticated && user?.role === "admin" }
  );

  // Mutations
  const suspendMutation = trpc.admin.suspendUser.useMutation({
    onSuccess: () => { toast.success("User suspended successfully"); setSuspendModalOpen(false); setSuspendReason(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const unsuspendMutation = trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => { toast.success("User unsuspended successfully"); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation({
    onSuccess: (data) => { toast.success(`Credits adjusted. New balance: ${data.newBalance}`); setCreditModalOpen(false); setCreditAmount(""); setCreditReason(""); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const changeRoleMutation = trpc.admin.changeUserRole.useMutation({
    onSuccess: (data) => { toast.success(`Role changed: ${data.previousRole} → ${data.newRole}`); setRoleModalOpen(false); setRoleChangeReason(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const freezeMutation = trpc.admin.freezeUser.useMutation({
    onSuccess: () => { toast.success("Account frozen successfully"); setFreezeModalOpen(false); setFreezeReason(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const unfreezeMutation = trpc.admin.unfreezeUser.useMutation({
    onSuccess: () => { toast.success("Account unfrozen successfully"); setUnfreezeModalOpen(false); setUnfreezeNotes(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  // Handlers
  const handleSearch = () => { setSearch(searchInput); setPage(0); };

  const handleSuspend = () => {
    if (!selectedUserId || !suspendReason.trim()) return;
    suspendMutation.mutate({ userId: selectedUserId, reason: suspendReason });
  };

  const handleAdjustCredits = () => {
    if (!selectedUserId || !creditAmount || !creditReason.trim()) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid positive amount"); return; }
    adjustCreditsMutation.mutate({ userId: selectedUserId, amount: creditAction === "deduct" ? -amount : amount, reason: creditReason });
  };

  const handleChangeRole = () => {
    if (!selectedUserId || !roleChangeReason.trim()) return;
    changeRoleMutation.mutate({ userId: selectedUserId, newRole: roleChangeTarget, reason: roleChangeReason });
  };

  const handleFreeze = () => {
    if (!selectedUserId || !freezeReason.trim()) return;
    freezeMutation.mutate({ userId: selectedUserId, reason: freezeReason });
  };

  const handleUnfreeze = () => {
    if (!selectedUserId || !unfreezeNotes.trim()) return;
    unfreezeMutation.mutate({ userId: selectedUserId, notes: unfreezeNotes });
  };

  // Auth guards
  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><RefreshCw className="w-8 h-8 text-gray-400 animate-spin" /></div>;
  }
  if (!isAuthenticated) return <Redirect to="/" />;
  if (user?.role !== "admin") { toast.error("Access denied. Admin privileges required."); return <Redirect to="/dashboard" />; }

  const totalPages = Math.ceil((usersQuery.data?.total || 0) / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4 mr-1" />Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <h1 className="text-xl font-semibold">User Management</h1>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { usersQuery.refetch(); statsQuery.refetch(); }} className="border-white/10 hover:bg-white/5">
              <RefreshCw className={`w-4 h-4 mr-2 ${usersQuery.isFetching ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <UserStatsCards stats={statsQuery.data} />

        <UserFilters
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={handleSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setPage(0); }}
          roleFilter={roleFilter}
          onRoleFilterChange={(v) => { setRoleFilter(v); setPage(0); }}
          sortBy={sortBy}
          onSortByChange={(v) => { setSortBy(v); setPage(0); }}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />

        <UserTable
          users={usersQuery.data?.users}
          isLoading={usersQuery.isLoading}
          page={page}
          totalPages={totalPages}
          total={usersQuery.data?.total || 0}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setPage}
          onSelectUser={(id) => { setSelectedUserId(id); setActiveTab("profile"); }}
        />
      </main>

      <UserDetailModal
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        selectedUser={userDetailsQuery.data ?? undefined}
        isLoading={userDetailsQuery.isLoading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activityLogs={userActivityQuery.data?.logs}
        activityLoading={userActivityQuery.isLoading}
        onSuspend={() => setSuspendModalOpen(true)}
        onUnsuspend={() => { if (selectedUserId) unsuspendMutation.mutate({ userId: selectedUserId }); }}
        unsuspendPending={unsuspendMutation.isPending}
        onPromote={() => { setRoleChangeTarget("moderator"); setRoleModalOpen(true); }}
        onDemote={() => { setRoleChangeTarget("user"); setRoleModalOpen(true); }}
        onAddCredits={() => { setCreditAction("add"); setCreditModalOpen(true); }}
        onDeductCredits={() => { setCreditAction("deduct"); setCreditModalOpen(true); }}
        onFreeze={() => setFreezeModalOpen(true)}
        onUnfreeze={() => setUnfreezeModalOpen(true)}
        freezePending={freezeMutation.isPending}
        unfreezePending={unfreezeMutation.isPending}
      />

      <SuspendModal
        open={suspendModalOpen}
        onOpenChange={setSuspendModalOpen}
        reason={suspendReason}
        onReasonChange={setSuspendReason}
        onConfirm={handleSuspend}
        isPending={suspendMutation.isPending}
      />

      <CreditModal
        open={creditModalOpen}
        onOpenChange={setCreditModalOpen}
        action={creditAction}
        amount={creditAmount}
        onAmountChange={setCreditAmount}
        reason={creditReason}
        onReasonChange={setCreditReason}
        onConfirm={handleAdjustCredits}
        isPending={adjustCreditsMutation.isPending}
      />

      <RoleChangeModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        targetRole={roleChangeTarget}
        reason={roleChangeReason}
        onReasonChange={setRoleChangeReason}
        onConfirm={handleChangeRole}
        isPending={changeRoleMutation.isPending}
        selectedUser={userDetailsQuery.data ?? undefined}
      />

      {/* Freeze Modal */}
      <Dialog open={freezeModalOpen} onOpenChange={setFreezeModalOpen}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <Snowflake className="w-5 h-5" />
              Freeze Account
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">Freezing restricts the user from generating content or spending credits. This is lighter than a full suspension.</p>
          <textarea
            value={freezeReason}
            onChange={(e) => setFreezeReason(e.target.value)}
            placeholder="Reason for freezing this account..."
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFreezeModalOpen(false)} className="text-gray-400">Cancel</Button>
            <Button onClick={handleFreeze} disabled={!freezeReason.trim() || freezeMutation.isPending} className="bg-cyan-600 hover:bg-cyan-700">
              {freezeMutation.isPending ? "Freezing..." : "Freeze Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unfreeze Modal */}
      <Dialog open={unfreezeModalOpen} onOpenChange={setUnfreezeModalOpen}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Snowflake className="w-5 h-5" />
              Unfreeze Account
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">This will restore the user's ability to generate content and spend credits.</p>
          <textarea
            value={unfreezeNotes}
            onChange={(e) => setUnfreezeNotes(e.target.value)}
            placeholder="Notes for unfreezing (e.g., issue resolved, false positive)..."
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUnfreezeModalOpen(false)} className="text-gray-400">Cancel</Button>
            <Button onClick={handleUnfreeze} disabled={!unfreezeNotes.trim() || unfreezeMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {unfreezeMutation.isPending ? "Unfreezing..." : "Unfreeze Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
